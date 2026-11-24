#!/usr/bin/env python3
"""Mail bridge for the DSH mail plugin.

Speaks a tiny JSON protocol over the environment: the caller puts one JSON
request into env var MAIL_REQUEST, this script writes one JSON result to stdout.
All network work uses Python's standard library (imaplib / smtplib), so the
Host half of the plugin only needs a subprocess, never raw sockets.

Operations
----------
  test         verify IMAP + SMTP connectivity for an account
  listMessages list recent messages from a mailbox folder
  getMessage   fetch one message's full body by UID
  sendMessage  send a message over SMTP
"""
import os
import sys
import re
import base64
import html as html_mod
import json
import imaplib
import smtplib
import ssl
import socket
from html.parser import HTMLParser
from email.mime.text import MIMEText
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime, formatdate

socket.setdefaulttimeout(20)

# Common CJK encodings to try when a part declares no charset or decodes with
# replacement characters (a frequent cause of mojibake in Chinese mail).
_FALLBACK_CHARSETS = ("utf-8", "gb18030", "gbk", "big5", "shift_jis", "euc-kr", "latin-1")


def decode_bytes(payload, charset=None):
    """Decode a byte payload, falling back through common charsets on failure."""
    if payload is None:
        return ""
    candidates = []
    if charset:
        candidates.append(charset)
    candidates.extend([c for c in _FALLBACK_CHARSETS if c != charset])
    best = None
    best_score = -1
    for enc in candidates:
        try:
            text = payload.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
        # Score: prefer decodes without the replacement char, then ASCII-ish.
        score = 1000 - text.count("\ufffd") * 10
        if best is None or score > best_score:
            best, best_score = text, score
        if "\ufffd" not in text:
            return text
    return best if best is not None else payload.decode("utf-8", errors="replace")


# Tags whose *content* must be dropped entirely (scripts, styles, etc.).
_DROP_CONTENT = {"script", "style", "head", "noscript", "iframe", "object", "embed", "form", "svg"}
# Tags safe to keep for rich-text email rendering.
_SAFE_TAGS = {
    "a", "img", "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "small",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "hr", "center", "font", "sub", "sup",
}
_SAFE_ATTRS = {
    "a": {"href", "title", "target", "style"},
    "img": {"src", "alt", "title", "width", "height", "style"},
}


class _SafeHTMLParser(HTMLParser):
    """Keep links/images/basic formatting; strip scripts, events, JS URLs.

    Inline ``cid:`` images are rewritten to data URIs via ``cid_map`` so they
    render instead of showing as broken images.
    """

    def __init__(self, cid_map):
        super().__init__(convert_charrefs=True)
        self.cid_map = cid_map or {}
        self.out = []
        self.drop_depth = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _DROP_CONTENT:
            self.drop_depth += 1
            return
        if self.drop_depth or tag not in _SAFE_TAGS:
            return
        allowed = _SAFE_ATTRS.get(tag, set())
        parts = []
        for key, value in attrs:
            key = key.lower()
            if key not in allowed or value is None:
                continue
            value = str(value)
            if key in ("href", "src"):
                low = value.strip().lower().replace("\x00", "")
                # Block script/JS injection.
                if low.startswith(("javascript:", "vbscript:", "file:")):
                    continue
                if low.startswith("cid:"):
                    data_uri = self.cid_map.get(low[4:].strip("<>"))
                    if not data_uri:
                        continue
                    value = data_uri
                elif low.startswith("data:"):
                    # Only allow image data URIs, never script/html data.
                    if not low.startswith("data:image/"):
                        continue
                elif not low.startswith(("http://", "https://", "mailto:")) and key == "src":
                    # Relative image src cannot resolve in this context.
                    continue
            parts.append(' %s="%s"' % (key, html_mod.escape(value, quote=True)))
        self.out.append("<%s%s>" % (tag, "".join(parts)))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _DROP_CONTENT and tag.lower() in _SAFE_TAGS and not self.drop_depth:
            self.out.append("</%s>" % tag.lower())

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _DROP_CONTENT:
            if self.drop_depth:
                self.drop_depth -= 1
            return
        if self.drop_depth or tag not in _SAFE_TAGS:
            return
        self.out.append("</%s>" % tag)

    def handle_data(self, data):
        if not self.drop_depth:
            self.out.append(html_mod.escape(data))

    def result(self):
        return "".join(self.out)


def sanitize_html(raw_html, cid_map=None):
    """Sanitize an HTML email body, keeping links/images and inline cid images."""
    if not raw_html:
        return ""
    parser = _SafeHTMLParser(cid_map)
    try:
        parser.feed(raw_html)
        parser.close()
    except Exception:
        return ""
    return parser.result()


def html_to_text(raw_html):
    """Turn an HTML fragment into readable plain text (no CSS/JS/entity junk)."""
    text = raw_html
    # Remove whole script/style/head blocks *including* their contents — CSS
    # rules like "a { color: ... }" leaking into snippets are the main culprit.
    text = re.sub(r"(?is)<(script|style|head|noscript)[^>]*>.*?</\1\s*>", " ", text)
    text = re.sub(r"(?s)<!--.*?-->", " ", text)
    text = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", text)
    text = re.sub(r"(?i)</\s*(p|div|tr|li|h[1-6]|table|section|blockquote)\s*>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html_mod.unescape(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()


def dec(value):
    """Decode a possibly RFC2047-encoded header into a readable string."""
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        try:
            return str(value)
        except Exception:
            return ""


def _decode_part(part):
    """Decode a MIME part's raw bytes into a string, honouring charset."""
    payload = part.get_payload(decode=True)  # applies quoted-printable/base64
    return decode_bytes(payload, part.get_content_charset())


def _build_cid_map(msg):
    """Map inline image Content-IDs to data URIs for rendering inside HTML."""
    cid_map = {}
    for part in msg.walk():
        if part.is_multipart():
            continue
        ctype = part.get_content_type()
        if not ctype.startswith("image/"):
            continue
        cid = part.get("Content-ID") or part.get("X-Attachment-Id")
        if not cid:
            continue
        data = part.get_payload(decode=True)
        if not data:
            continue
        # Guard against embedding huge images (data URI bloats the JSON reply).
        if len(data) > 2 * 1024 * 1024:
            continue
        b64 = base64.b64encode(data).decode("ascii")
        cid_map[cid.strip("<>")] = "data:%s;base64,%s" % (ctype, b64)
    return cid_map


def body_of(msg, want_html=False):
    """Extract body content from an email.message.Message.

    Returns plain text by default (used for snippets). When ``want_html`` is
    True returns a dict ``{"text": ..., "html": ...}`` where ``html`` is a
    sanitized rich-text version with live links and inline images.
    """
    plain = ""
    rich = ""
    try:
        cid_map = _build_cid_map(msg)
        if msg.is_multipart():
            for part in msg.walk():
                if part.is_multipart():
                    continue
                ctype = part.get_content_type()
                disp = str(part.get("Content-Disposition") or "")
                if "attachment" in disp:
                    continue
                if ctype == "text/plain" and not plain:
                    plain = _decode_part(part)
                elif ctype == "text/html" and not rich:
                    raw = _decode_part(part)
                    rich = sanitize_html(raw, cid_map)
                    if not plain:
                        plain = html_to_text(raw)
            if not plain and not rich:
                return "" if not want_html else {"text": "", "html": ""}
        else:
            ctype = msg.get_content_type()
            raw = _decode_part(msg)
            if ctype == "text/html":
                rich = sanitize_html(raw, cid_map)
                plain = html_to_text(raw)
            else:
                plain = raw
    except Exception as exc:
        err = "[body decode error: %s]" % exc
        return err if not want_html else {"text": err, "html": ""}

    plain = plain[:20000]
    rich = rich[:40000]
    if want_html:
        return {"text": plain, "html": rich or html_mod.escape(plain).replace("\n", "<br>")}
    return plain


def imap_connect(acc):
    host = acc["imapHost"]
    port = int(acc.get("imapPort") or 993)
    tls = acc.get("imapTls", True)
    if tls:
        client = imaplib.IMAP4_SSL(host, port)
    else:
        client = imaplib.IMAP4(host, port)
        # Never send credentials in cleartext: require STARTTLS on non-SSL ports.
        try:
            code, _ = client.starttls(ssl.create_default_context())
            if code != "OK":
                raise RuntimeError("server declined STARTTLS (%s)" % code)
        except Exception as exc:
            try:
                client.logout()
            except Exception:
                pass
            raise RuntimeError(
                "IMAP STARTTLS failed: %s — enable TLS and use port 993, or use a server that supports STARTTLS" % exc
            )
    client.login(acc["username"], acc["authCode"])
    return client


def smtp_connect(acc):
    host = acc["smtpHost"]
    port = int(acc.get("smtpPort") or 465)
    tls = acc.get("smtpTls", True)
    if tls and port == 465:
        client = smtplib.SMTP_SSL(host, port)
    else:
        client = smtplib.SMTP(host, port)
        client.ehlo()
        if tls:
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
    client.login(acc["username"], acc["authCode"])
    return client


def op_test(req):
    acc = req["account"]
    imap = smtp = None
    try:
        imap = imap_connect(acc)
        imap.select("INBOX", readonly=True)
    finally:
        if imap is not None:
            try:
                imap.logout()
            except Exception:
                pass
    try:
        smtp = smtp_connect(acc)
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                pass
    return {"ok": True}


def op_list_messages(req):
    acc = req["account"]
    folder = req.get("folder") or "INBOX"
    limit = max(1, min(int(req.get("limit") or 20), 100))
    client = imap_connect(acc)
    try:
        typ, data = client.select('"%s"' % folder.replace('"', ""), readonly=True)
        if typ != "OK":
            return {"ok": False, "error": "select folder failed: %s" % data}
        typ, data = client.uid("SEARCH", None, "ALL")
        if typ != "OK":
            return {"ok": False, "error": "search failed: %s" % data}
        ids = (data[0] or b"").split()
        chosen = ids[-limit:][::-1]
        messages = []
        for uid in chosen:
            try:
                typ, msg_data = client.uid("FETCH", uid, "(RFC822)")
                if typ != "OK" or not msg_data or msg_data[0] is None:
                    continue
                raw = msg_data[0][1]
                from email import message_from_bytes
                msg = message_from_bytes(raw)
                date_str = msg.get("Date")
                try:
                    date_iso = parsedate_to_datetime(date_str).isoformat() if date_str else None
                except Exception:
                    date_iso = date_str
                flags = ""
                try:
                    t, fdata = client.uid("FETCH", uid, "(FLAGS)")
                    flags = (fdata[0] or b"").decode(errors="replace") if fdata and fdata[0] else ""
                except Exception:
                    pass
                preview = body_of(msg).strip()[:200]
                messages.append({
                    "uid": uid.decode(),
                    "from": dec(msg.get("From")),
                    "to": dec(msg.get("To")),
                    "subject": dec(msg.get("Subject")) or "(no subject)",
                    "date": date_iso,
                    "snippet": preview,
                    "seen": "\\Seen" in flags,
                })
            except Exception:
                continue
        return {"ok": True, "messages": messages, "total": len(ids)}
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            client.logout()
        except Exception:
            pass


def op_get_message(req):
    acc = req["account"]
    uid = str(req["uid"])
    folder = req.get("folder") or "INBOX"
    client = imap_connect(acc)
    try:
        typ, data = client.select('"%s"' % folder.replace('"', ""), readonly=True)
        if typ != "OK":
            return {"ok": False, "error": "select folder failed: %s" % data}
        typ, msg_data = client.uid("FETCH", str(uid), "(RFC822)")
        if typ != "OK" or not msg_data or msg_data[0] is None:
            return {"ok": False, "error": "message not found"}
        from email import message_from_bytes
        msg = message_from_bytes(msg_data[0][1])
        date_str = msg.get("Date")
        try:
            date_iso = parsedate_to_datetime(date_str).isoformat() if date_str else None
        except Exception:
            date_iso = date_str
        body = body_of(msg, want_html=True)
        return {
            "ok": True,
            "uid": uid,
            "from": dec(msg.get("From")),
            "to": dec(msg.get("To")),
            "subject": dec(msg.get("Subject")) or "(no subject)",
            "date": date_iso,
            "body": body["text"],
            "html": body["html"],
        }
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            client.logout()
        except Exception:
            pass


def op_send_message(req):
    acc = req["account"]
    to = req["to"]
    subject = req.get("subject") or ""
    body = req.get("body") or ""
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = acc["username"]
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    client = smtp_connect(acc)
    try:
        client.sendmail(acc["username"], [to], msg.as_string())
        return {"ok": True}
    finally:
        try:
            client.quit()
        except Exception:
            pass


OPS = {
    "test": op_test,
    "listMessages": op_list_messages,
    "getMessage": op_get_message,
    "sendMessage": op_send_message,
}


def main():
    try:
        req = json.loads(os.environ.get("MAIL_REQUEST", "{}"))
        op = req.get("op")
        fn = OPS.get(op)
        if fn is None:
            print(json.dumps({"ok": False, "error": "unknown op: %s" % op}))
            return
        result = fn(req)
        # ensure_ascii=True (default): emit pure ASCII (\uXXXX escapes) so the
        # output never hits a UnicodeEncodeError on a GBK/cp936 console. The
        # JS side JSON.parse() restores the original characters correctly.
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)}))


if __name__ == "__main__":
    main()
