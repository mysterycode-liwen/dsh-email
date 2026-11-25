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
  getAttachment  download one attachment of a message as base64
  sendMessage  send a message over SMTP (with attachments)
  listSent     read the server's Sent folder (cross-device sync)
  getContacts  read the synced contacts stored on the mail server
  setContacts  write the synced contacts to the mail server
  collectAndSyncContacts  scan + merge + persist contacts in one pass
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
from email.utils import parsedate_to_datetime, formatdate, getaddresses
import uuid
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email import encoders

# Local outbox records (mirrored to Sent so they appear in the IMAP Sent folder).
_OUTBOX_FOLDER = "Sent"
_CONTACTS_FOLDER = "DSHContacts"
_CONTACTS_SUBJECT = "dsh-mail-contacts-sync"
_SENT_FOLDERS = ["Sent", "Sent Messages", "Sent Items", "INBOX.Sent", "Sent Mail",
                 "[Gmail]/Sent Mail", "[Gmail]/Sent", "已发送", "已发送邮件"]

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


def attachments_of(msg):
    """List downloadable attachments as metadata only (no payload).

    Inline images referenced by Content-ID are part of the rendered body, not
    attachments, so they are skipped unless the part also carries a filename.
    ``index`` is the part's position in ``msg.walk()``; it is stable for the
    same raw message, which lets a later call fetch exactly that part.
    """
    result = []
    try:
        for idx, part in enumerate(msg.walk()):
            if part.is_multipart():
                continue
            disp = str(part.get("Content-Disposition") or "")
            filename = part.get_filename()
            if not filename and "attachment" not in disp.lower():
                continue
            if "inline" in disp.lower() and not filename:
                continue
            try:
                filename = dec(filename)
            except Exception:
                filename = str(filename or "")
            filename = filename or ("attachment-%d" % idx)
            try:
                size = len(part.get_payload(decode=True) or b"")
            except Exception:
                size = 0
            result.append({
                "index": idx,
                "name": filename,
                "size": size,
                "mime": part.get_content_type(),
            })
    except Exception:
        pass
    return result


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
    except Exception as exc:
        return dict(fail_result(exc), stage="imap")
    finally:
        if imap is not None:
            try:
                imap.logout()
            except Exception:
                pass
    try:
        smtp = smtp_connect(acc)
    except Exception as exc:
        return dict(fail_result(exc), stage="smtp")
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                pass
    return {"ok": True}



def _imap_utf7_decode(name):
    """Decode IMAP modified UTF-7 (&XXXX-) mailbox names into Unicode."""
    if not name or '&' not in name:
        return name
    import base64
    out = []
    i = 0
    while i < len(name):
        ch = name[i]
        if ch == '&':
            j = name.find('-', i + 1)
            if j < 0:
                out.append(ch); i += 1; continue
            chunk = name[i + 1:j]
            if chunk == '':
                out.append('&')
            else:
                try:
                    data = base64.b64decode(chunk + '===')
                    out.append(data.decode('utf-16-be'))
                except Exception:
                    out.append(name[i:j + 1])
            i = j + 1
        else:
            out.append(ch); i += 1
    return ''.join(out)


def _mailbox_variants(name):
    """Both spellings of a mailbox: unicode and IMAP modified UTF-7.

    LIST returns names in modified UTF-7, which _folder_entries decodes to
    unicode. But SELECT/APPEND expect the UTF-7 spelling again, so always
    offer both.
    """
    variants = [name]
    try:
        utf7 = None
        if '&' in name:
            utf7 = name  # already in UTF-7; offer the decoded unicode form
            decoded = _imap_utf7_decode(name)
            if decoded not in variants:
                variants.append(decoded)
        else:
            utf7 = name.encode('utf-7').decode('ascii').replace('+', '&')
        if utf7 and utf7 not in variants:
            variants.append(utf7)
    except Exception:
        pass
    return variants


def _folder_entries(client):
    """Parse IMAP LIST into [(name, flags)] robustly.

    IMAP LIST looks like:  (\\HasNoChildren \\Sent) "/" "Sent Items"
    The mailbox name is everything AFTER the delimiter and may itself contain
    spaces, so it must never be found by splitting on whitespace.
    """
    entries = []
    try:
        typ, boxes = client.list()
        if typ != "OK":
            return entries
        for box in boxes or []:
            text = box.decode("utf-8", errors="replace") if isinstance(box, bytes) else str(box)
            # Strip an optional "* LIST " / "* XLIST " status prefix.
            text = re.sub(r"^\s*\*\s+(?:X?LIST)\s+", "", text, flags=re.IGNORECASE)
            # flags (...) | delimiter ("x" or NIL) | mailbox name (rest)
            m = re.match(r'^\s*(\(([^)]*)\))?\s*("(?:[^"\\]|\\.)*"|NIL)\s+(.+?)\s*$', text)
            if not m:
                continue
            flags = m.group(2) or ""
            name = m.group(4).strip()
            if len(name) >= 2 and name[0] == '"' and name[-1] == '"':
                name = name[1:-1].replace('\\"', '"').replace('\\\\', '\\')
            if name:
                entries.append((_imap_utf7_decode(name), flags))
    except Exception:
        pass
    return entries


def _folder_names(client):
    """Mailbox names from an IMAP LIST response."""
    return [name for name, _flags in _folder_entries(client)]


def _find_sent_folder(client):
    """One Sent folder (SPECIAL-USE first) for APPEND / single-folder scans."""
    folders = _sent_folders(client)
    return folders[0] if folders else None


def _sent_folders(client):
    """All folders that look like Sent, so no provider's mail is missed."""
    entries = _folder_entries(client)
    special = [name for name, flags in entries if "\\Sent" in flags]
    named = []
    for cand in _SENT_FOLDERS:
        for name, _flags in entries:
            if name not in special and cand.lower() in name.lower() and name not in named:
                named.append(name)
    result = []
    for name in special + named:
        if name not in result:
            result.append(name)
    return result


def _imap_close(client):
    """Best-effort, exception-safe IMAP teardown."""
    try:
        client.close()
    except Exception:
        pass
    try:
        client.logout()
    except Exception:
        pass


def _list_messages_in(client, folder, limit):
    """List recent messages of one folder as summary dicts."""
    selected = False
    last = None
    for variant in _mailbox_variants(folder):
        try:
            typ, data = client.select('"%s"' % variant.replace('"', ""), readonly=True)
        except Exception as exc:
            last = exc; continue
        if typ == "OK":
            selected = True; break
        last = imap_data_text(data)
    if not selected:
        return {"ok": False, "error": "\u9009\u62e9\u6587\u4ef6\u5939\u5931\u8d25\uff1a%s" % (last or ""), "code": "folder"}
    typ, data = client.uid("SEARCH", None, "ALL")
    if typ != "OK":
        return {"ok": False, "error": "\u641c\u7d22\u90ae\u4ef6\u5931\u8d25\uff1a%s" % imap_data_text(data), "code": "search"}
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


def op_list_messages(req):
    acc = req["account"]
    folder = req.get("folder") or "INBOX"
    limit = max(1, min(int(req.get("limit") or 20), 100))
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        return _list_messages_in(client, folder, limit)
    finally:
        _imap_close(client)


def op_get_message(req):
    acc = req["account"]
    uid = str(req["uid"])
    folder = req.get("folder") or "INBOX"
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        # Open the mailbox writable so reading a message can mark it \Seen,
        # matching normal mail-client behaviour. BODY.PEEK reads the content
        # without marking, then we set the flag explicitly so read state
        # persists across reloads. Marking is best-effort and never fails read.
        typ, data = client.select('"%s"' % folder.replace('"', ""), readonly=False)
        if typ != "OK":
            return {"ok": False, "error": "选择文件夹失败：%s" % imap_data_text(data), "code": "folder"}
        typ, msg_data = client.uid("FETCH", str(uid), "(BODY.PEEK[])")
        if typ != "OK" or not msg_data or msg_data[0] is None:
            return {"ok": False, "error": "未找到这封邮件（可能已被删除）。", "code": "not_found"}
        try:
            client.uid("STORE", str(uid), "+FLAGS", "(\\Seen)")
        except Exception:
            pass
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
            "attachments": attachments_of(msg),
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


def op_get_attachment(req):
    """Return one attachment's bytes as base64, addressed by part index.

    The index is the position in the message's part walk, as reported by
    ``attachments_of`` when the message was read. Reading uses BODY.PEEK so
    downloading an attachment never changes the read/unread flag.
    """
    acc = req["account"]
    uid = str(req["uid"])
    folder = req.get("folder") or "INBOX"
    index = int(req.get("index") or 0)
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        typ, data = client.select('"%s"' % folder.replace('"', ""), readonly=True)
        if typ != "OK":
            return {"ok": False, "error": "选择文件夹失败：%s" % imap_data_text(data), "code": "folder"}
        typ, msg_data = client.uid("FETCH", uid, "(BODY.PEEK[])")
        if typ != "OK" or not msg_data or msg_data[0] is None:
            return {"ok": False, "error": "未找到这封邮件（可能已被删除）。", "code": "not_found"}
        from email import message_from_bytes
        msg = message_from_bytes(msg_data[0][1])
        parts = list(msg.walk())
        if index < 0 or index >= len(parts):
            return {"ok": False, "error": "附件位置已失效，请重新打开邮件。", "code": "not_found"}
        part = parts[index]
        payload = part.get_payload(decode=True)
        if payload is None:
            return {"ok": False, "error": "这个附件没有可下载的内容。", "code": "generic"}
        # Refuse absurdly large payloads: the JSON reply carries the bytes and
        # the Host half buffers the whole bridge response in memory.
        if len(payload) > 25 * 1024 * 1024:
            return {"ok": False, "error": "附件超过 25 MB，暂不支持下载。", "code": "toolarge"}
        filename = dec(part.get_filename()) or ("attachment-%d" % index)
        return {
            "ok": True,
            "name": filename,
            "mime": part.get_content_type(),
            "size": len(payload),
            "content": base64.b64encode(payload).decode("ascii"),
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


def _contact_entries(addr_header):
    """Return [{name, email}] from a From/To/Cc header value."""
    result = []
    for name, addr in getaddresses([addr_header or ""]):
        addr = (addr or "").strip()
        if not addr or "@" not in addr:
            continue
        name = dec(name) if name else ""
        result.append({"name": name, "email": addr})
    return result


def _attachment_parts(attachments):
    """Turn [{name, content(base64)}] into MIMEBase parts."""
    import mimetypes
    parts = []
    for att in attachments or []:
        fname = str(att.get("name") or "attachment")
        try:
            data = base64.b64decode(att.get("content") or "")
        except Exception:
            data = b""
        mime = str(att.get("mime") or "").strip()
        if "/" not in mime:
            mime = mimetypes.guess_type(fname)[0] or "application/octet-stream"
        maintype, subtype = mime.split("/", 1)
        part = MIMEBase(maintype, subtype)
        part.set_payload(data)
        encoders.encode_base64(part)
        safe = fname.replace("\r", "").replace("\n", "")
        # RFC 2231 encoding keeps non-ASCII filenames intact for clients.
        part.add_header("Content-Disposition", "attachment", filename=("utf-8", "", safe))
        parts.append(part)
    return parts


def build_message(acc, recipients, subject, body, attachments=None):
    """Build the outgoing message, multipart only when attachments exist."""
    attachments = attachments or []
    if attachments:
        msg = MIMEMultipart("mixed")
        msg.attach(MIMEText(body or "", "plain", "utf-8"))
        for part in _attachment_parts(attachments):
            msg.attach(part)
    else:
        msg = MIMEText(body or "", "plain", "utf-8")
    msg["From"] = acc["username"]
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject or ""
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = "<%s@%s>" % (uuid.uuid4().hex, acc["username"].split("@")[-1] or "local")
    return msg


def _append_to_sent(acc, recipients, subject, body, attachments=None):
    """Mirror a successfully sent message into the IMAP Sent folder.

    Failures here never block the send: the message was already delivered.
    """
    client = None
    try:
        msg = build_message(acc, recipients, subject, body, attachments)
        client = imap_connect(acc)
        sent_folder = _find_sent_folder(client) or _OUTBOX_FOLDER
        try:
            client.append('"%s"' % sent_folder.replace('"', ""), None, None, msg.as_bytes())
        except Exception:
            # Some servers only allow APPEND to INBOX; fall back there so the
            # record is still retrievable, then the caller can list the folder.
            try:
                client.append("INBOX", None, None, msg.as_bytes())
            except Exception:
                pass
    except Exception:
        pass
    finally:
        if client is not None:
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
    attachments = req.get("attachments") or []
    # Multiple recipients are comma/semicolon separated; SMTP sendmail takes a
    # list, and the MIME headers keep the original recipients visible.
    recipients = [a.strip() for a in re.split(r"[,;\s]+", str(to)) if a.strip()]
    if not recipients:
        return {"ok": False, "error": "收件人不能为空。", "code": "generic"}
    msg = build_message(acc, recipients, subject, body, attachments)
    try:
        client = smtp_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        client.sendmail(acc["username"], recipients, msg.as_string())
    except Exception as exc:
        return fail_result(exc)
    finally:
        try:
            client.quit()
        except Exception:
            pass
    # Delivery succeeded — mirror to Sent so the outbox is backed by the real
    # mailbox, independent of any one device.
    _append_to_sent(acc, recipients, subject, body, attachments)
    return {"ok": True}


def op_collect_contacts(req):
    """Scan IMAP folders for addresses and return unique {name,email} entries."""
    acc = req["account"]
    limit = max(1, min(int(req.get("limit") or 30), 60))
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    contacts = {}
    try:
        folders = ["INBOX"]
        sent = _find_sent_folder(client)
        if sent:
            folders.append(sent)
        for folder in folders[:4]:
            try:
                typ, _ = client.select('"%s"' % folder.replace('"', ""), readonly=True)
                if typ != "OK":
                    continue
                typ, data = client.uid("SEARCH", None, "ALL")
                if typ != "OK" or not data or not data[0]:
                    continue
                ids = data[0].split()
                for uid in ids[-limit:]:
                    try:
                        typ, md = client.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (FROM TO CC)])")
                        if typ != "OK" or not md or md[0] is None:
                            continue
                        head = md[0][1]
                        if isinstance(head, bytes):
                            head = head.decode("utf-8", errors="replace")
                        from email import message_from_string
                        m = message_from_string(head)
                        for h in ("From", "To", "Cc"):
                            for entry in _contact_entries(m.get(h)):
                                key = entry["email"].lower()
                                if key not in contacts:
                                    contacts[key] = entry
                    except Exception:
                        continue
            except Exception:
                continue
        result = []
        for entry in contacts.values():
            if entry["email"].lower() == acc.get("username", "").lower():
                continue
            result.append(entry)
        result.sort(key=lambda c: (c["name"] or c["email"]).lower())
        return {"ok": True, "contacts": result}
    finally:
        try:
            client.close()
        except Exception:
            pass
        try:
            client.logout()
        except Exception:
            pass


def _decode_bytes_literal(token):
    """Decode a Python bytes literal (b'...') into readable text."""
    try:
        import ast
        value = ast.literal_eval(token)
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
    except Exception:
        pass
    return token[2:-1].replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\").replace("\\n", "\n")


def _clean_error_text(value):
    """Strip Python bytes reprs and collapse whitespace in an error message."""
    s = str(value)
    s = re.sub(r"b(['\"])(?:\\.|(?!\1).)*\1", lambda m: _decode_bytes_literal(m.group(0)), s)
    return re.sub(r"\s+", " ", s).strip()


def error_info(exc):
    """Classify a bridge exception into (code, readable message).

    The code lets the UI show an actionable, localized explanation instead of
    dumping a raw IMAP/SMTP protocol error at the user.
    """
    text = _clean_error_text(exc)
    low = text.lower()
    if isinstance(exc, (socket.timeout, TimeoutError)) or "timed out" in low or "timeout" in low:
        return "timeout", text
    if isinstance(exc, ssl.SSLError) or "ssl" in low or "certificate" in low or "wrong version number" in low:
        return "tls", text
    if isinstance(exc, smtplib.SMTPAuthenticationError) or \
       (isinstance(exc, smtplib.SMTPResponseException) and getattr(exc, "smtp_code", None) == 535) or \
       "authenticationfailed" in low or "authentication failed" in low or \
       "login fail" in low or "invalid credentials" in low:
        return "auth_failed", text
    if "login frequency limited" in low or "too many" in low or "频繁" in text:
        return "rate_limited", text
    if "service is not open" in low or "service not open" in low or "服务未开启" in text:
        return "service_disabled", text
    if isinstance(exc, (socket.gaierror, ConnectionRefusedError, ConnectionResetError, OSError)) or \
       "connection refused" in low or "name or service not known" in low or "network is unreachable" in low:
        return "network", text
    return "generic", text


def imap_data_text(data):
    """Readable text from an imaplib command result tuple."""
    if isinstance(data, (list, tuple)) and data:
        return _clean_error_text(data[-1])
    return _clean_error_text(data)


def fail_result(exc):
    """Build a structured, UI-friendly failure result from an exception."""
    code, message = error_info(exc)
    return {"ok": False, "error": message, "code": code}



def op_list_sent(req):
    """Read all Sent folders from the mail server (true cross-device sync)."""
    acc = req["account"]
    limit = max(1, min(int(req.get("limit") or 50), 100))
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        folders = _sent_folders(client)
        if not folders:
            return {"ok": False, "error": "未找到邮箱的已发送文件夹", "code": "folder"}
        merged = []
        seen = set()
        total = 0
        for folder in folders:
            part = _list_messages_in(client, folder, limit)
            if not part.get("ok"):
                continue
            total += int(part.get("total") or 0)
            for m in part.get("messages") or []:
                key = (str(m.get("subject") or ""), str(m.get("to") or ""),
                       str(m.get("date") or ""), str(m.get("snippet") or "")[:80])
                if key in seen:
                    continue
                seen.add(key)
                item = dict(m)
                item["folder"] = folder
                item["uid"] = str(m.get("uid") or "")
                item["id"] = folder + ":" + item["uid"]
                merged.append(item)
        merged.sort(key=lambda m: str(m.get("date") or ""), reverse=True)
        return {"ok": True, "messages": merged[:limit], "total": total or len(merged)}
    except Exception as exc:
        return fail_result(exc)
    finally:
        _imap_close(client)


def _ensure_folder(client, name):
    """Select a folder read-write, creating it if the server allows."""
    try:
        typ, _ = client.select('"%s"' % name)
        if typ == "OK":
            return True
    except Exception:
        pass
    try:
        client.create('"%s"' % name)
        typ, _ = client.select('"%s"' % name)
        return typ == "OK"
    except Exception:
        return False


def op_get_contacts(req):
    """Load the synced contact list from the mail server."""
    acc = req["account"]
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        if not _ensure_folder(client, _CONTACTS_FOLDER):
            return {"ok": False, "error": "无法访问服务器上的联系人文件夹", "code": "folder"}
        typ, data = client.uid("SEARCH", None, 'HEADER Subject "%s"' % _CONTACTS_SUBJECT)
        if typ != "OK" or not data or not data[0]:
            return {"ok": True, "contacts": []}
        # SEARCH order is not guaranteed; some providers return UIDs in
        # descending order. Try every sync message from newest to oldest and
        # use the first one that parses, so stale copies can never win.
        uids = list(data[0].split())
        try:
            uids.sort(key=lambda x: int(x), reverse=True)
        except Exception:
            pass
        from email import message_from_bytes
        for uid in uids:
            typ, md = client.uid("FETCH", uid, "(RFC822)")
            if typ != "OK" or not md or md[0] is None:
                continue
            try:
                msg = message_from_bytes(md[0][1])
                raw = msg.get_payload(decode=True) or b""
                parsed = json.loads(raw.decode("utf-8", errors="replace"))
                contacts = parsed.get("contacts") if isinstance(parsed, dict) else None
                if isinstance(contacts, list):
                    return {"ok": True, "contacts": contacts}
            except Exception:
                continue
        return {"ok": True, "contacts": []}
    except Exception as exc:
        return fail_result(exc)
    finally:
        _imap_close(client)


def op_set_contacts(req):
    """Replace the synced contact list on the mail server."""
    acc = req["account"]
    contacts = req.get("contacts") or []
    if not isinstance(contacts, list):
        return {"ok": False, "error": "contacts must be a list", "code": "generic"}
    try:
        client = imap_connect(acc)
    except Exception as exc:
        return fail_result(exc)
    try:
        if not _ensure_folder(client, _CONTACTS_FOLDER):
            return {"ok": False, "error": "无法访问服务器上的联系人文件夹", "code": "folder"}
        try:
            typ, data = client.uid("SEARCH", None, 'HEADER Subject "%s"' % _CONTACTS_SUBJECT)
            if typ == "OK" and data and data[0]:
                uids = data[0].split()
                client.uid("STORE", b",".join(uids), "+FLAGS", "(\\Deleted)")
                client.expunge()
        except Exception:
            pass
        msg = MIMEText(json.dumps({"contacts": contacts}, ensure_ascii=False), "plain", "utf-8")
        msg["Subject"] = _CONTACTS_SUBJECT
        msg["From"] = acc["username"]
        msg["To"] = acc["username"]
        msg["Date"] = formatdate(localtime=True)
        typ, _ = client.append('"%s"' % _CONTACTS_FOLDER, None, None, msg.as_bytes())
        if typ != "OK":
            return {"ok": False, "error": "写入服务器联系人失败", "code": "generic"}
        return {"ok": True, "contacts": contacts}
    except Exception as exc:
        return fail_result(exc)
    finally:
        _imap_close(client)


def op_collect_and_sync_contacts(req):
    """Scan addresses and persist the merged list in one IMAP session."""
    acc = req["account"]
    limit = max(1, min(int(req.get("limit") or 40), 60))
    client = None
    try:
        scan = op_collect_contacts({"account": acc, "limit": limit})
        found = (scan.get("contacts") or []) if scan.get("ok") else []
        current = op_get_contacts({"account": acc})
        contacts = list(current.get("contacts") or []) if current.get("ok") else []
        for c in found:
            email = str(c.get("email") or "").strip().lower()
            if not email:
                continue
            if any(str(x.get("email") or "").lower() == email for x in contacts):
                continue
            contacts.append({"email": email, "name": str(c.get("name") or "")})
        contacts.sort(key=lambda x: str(x.get("name") or x.get("email") or "").lower())
        client = imap_connect(acc)
        if not _ensure_folder(client, _CONTACTS_FOLDER):
            return {"ok": False, "error": "无法访问服务器上的联系人文件夹", "code": "folder"}
        try:
            typ, data = client.uid("SEARCH", None, 'HEADER Subject "%s"' % _CONTACTS_SUBJECT)
            if typ == "OK" and data and data[0]:
                client.uid("STORE", b",".join(data[0].split()), "+FLAGS", "(\\Deleted)")
                client.expunge()
        except Exception:
            pass
        msg = MIMEText(json.dumps({"contacts": contacts}, ensure_ascii=False), "plain", "utf-8")
        msg["Subject"] = _CONTACTS_SUBJECT
        msg["From"] = acc["username"]
        msg["To"] = acc["username"]
        msg["Date"] = formatdate(localtime=True)
        typ, _ = client.append('"%s"' % _CONTACTS_FOLDER, None, None, msg.as_bytes())
        if typ != "OK":
            return {"ok": False, "error": "写入服务器联系人失败", "code": "generic"}
        return {"ok": True, "contacts": contacts}
    except Exception as exc:
        return fail_result(exc)
    finally:
        if client is not None:
            _imap_close(client)


OPS = {
    "test": op_test,
    "listMessages": op_list_messages,
    "getMessage": op_get_message,
    "sendMessage": op_send_message,
    "getAttachment": op_get_attachment,
    "listSent": op_list_sent,
    "getContacts": op_get_contacts,
    "setContacts": op_set_contacts,
    "collectAndSyncContacts": op_collect_and_sync_contacts,
}


def main():
    try:
        req = json.loads(os.environ.get("MAIL_REQUEST", "{}"))
        op = req.get("op")
        fn = OPS.get(op)
        if fn is None:
            print(json.dumps({"ok": False, "error": "unknown op: %s" % op, "code": "generic"}))
            return
        result = fn(req)
        # ensure_ascii=True (default): emit pure ASCII (\uXXXX escapes) so the
        # output never hits a UnicodeEncodeError on a GBK/cp936 console. The
        # JS side JSON.parse() restores the original characters correctly.
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps(fail_result(exc)))


if __name__ == "__main__":
    main()
