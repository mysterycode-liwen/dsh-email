import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);
const BRIDGE_PATH = fileURLToPath(new URL('./bridge.py', import.meta.url));

export const inject = ['connection', 'credentials', 'tools'];

import { mailQueryTool } from './tools.js';

const API = '/api/dsh-mail';

function candidatePythons() {
  return [
    process.env.MAIL_PYTHON,
    'C:\\Python314\\python.exe',
    'C:\\Python313\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
    'python',
  ].filter(Boolean);
}

function findPython() {
  for (const candidate of candidatePythons()) {
    if (candidate === 'python' || existsSync(candidate)) return candidate;
  }
  return 'python';
}

async function runBridge(op, extra = {}) {
  const request = JSON.stringify({ op, ...extra });
  const { stdout } = await execFileAsync(findPython(), [BRIDGE_PATH], {
    env: { ...process.env, MAIL_REQUEST: request },
    maxBuffer: 4 * 1024 * 1024,
    timeout: 90000,
  });
  const text = String(stdout).trim();
  if (!text) return { ok: false, error: 'bridge returned empty output' };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'bridge returned invalid JSON: ' + text.slice(0, 200) };
  }
}

function accountId(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return 'acct-' + h.toString(16).padStart(8, '0');
}

function recordKey(id) {
  return 'mail/' + id;
}

function outboxKey(id) {
  return 'mail-outbox/' + id;
}

function contactsKey(id) {
  return 'mail-contacts/' + id;
}

// Global plugin settings live under their own scope so listAccounts (which
// treats every "mail/<id>" record as an account) never picks this record up.
const SETTINGS_KEY = 'mail-settings/main';

async function readSettings(ctx) {
  const data = await readData(ctx, SETTINGS_KEY, {});
  const rawInterval = Number(data.notifyInterval);
  return {
    agentMailAccess: data.agentMailAccess === true,
    // New-mail alerts are on by default. Delivery is via the desktop pet
    // (default), a browser system notification, or both.
    notifyEnabled: data.notifyEnabled !== false,
    // Clamp to 15s..3600s; 60s default. Keeps IMAP polling reasonable.
    notifyInterval: Number.isFinite(rawInterval) ? Math.min(3600, Math.max(15, Math.round(rawInterval))) : 60,
    notifyMode: ['pet', 'system', 'both'].includes(data.notifyMode) ? data.notifyMode : 'pet',
  };
}

async function writeSettings(ctx, value) {
  const input = value && typeof value === 'object' ? value : {};
  const rawInterval = Number(input.notifyInterval);
  const next = {
    agentMailAccess: input.agentMailAccess === true,
    notifyEnabled: input.notifyEnabled !== false,
    notifyInterval: Number.isFinite(rawInterval) ? Math.min(3600, Math.max(15, Math.round(rawInterval))) : 60,
    notifyMode: ['pet', 'system', 'both'].includes(input.notifyMode) ? input.notifyMode : 'pet',
  };
  await writeData(ctx, SETTINGS_KEY, next);
  return next;
}

// Read a plain JSON payload record (kind 'grant') from the credential store, returning
// a fallback when it does not exist yet. Account-specific data lives under a
// key derived from the account id, so switching accounts never mixes data.
async function readData(ctx, key, fallback) {
  try {
    const record = await ctx.credentials.readRecord(key);
    if (record && (record.kind === 'grant' || record.kind === 'data') && record.payload && typeof record.payload === 'object') {
      return record.payload;
    }
  } catch {
    // First use: the record simply does not exist.
  }
  return fallback;
}

async function writeData(ctx, key, payload) {
  await ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload }));
}

// Contacts are stored locally only (per account in the credential store);
// they are never written to the IMAP server.
function publicAccount(id, payload) {
  return {
    id,
    name: payload.name || payload.username,
    username: payload.username,
    imapHost: payload.imapHost,
    imapPort: payload.imapPort,
    smtpHost: payload.smtpHost,
    smtpPort: payload.smtpPort,
    imapTls: payload.imapTls !== false,
    smtpTls: payload.smtpTls !== false,
  };
}

async function listAccounts(ctx) {
  const entries = await ctx.credentials.listRecords();
  const accounts = [];
  for (const entry of entries) {
    const key = String(entry.key);
    if (!key.startsWith('mail/')) continue;
    const id = key.slice(5);
    const record = await ctx.credentials.readRecord(key);
    if (!record || record.kind !== 'grant' || typeof record.payload !== 'object' || record.payload === null) continue;
    accounts.push(publicAccount(id, record.payload));
  }
  return accounts.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function getAccountPayload(ctx, id) {
  const record = await ctx.credentials.readRecord(recordKey(id));
  if (!record || record.kind !== 'grant' || typeof record.payload !== 'object' || record.payload === null) {
    throw new Error('account not found: ' + id);
  }
  return record.payload;
}

function bridgeAccount(payload) {
  return {
    username: payload.username,
    authCode: payload.authCode,
    imapHost: payload.imapHost,
    imapPort: Number(payload.imapPort) || 993,
    smtpHost: payload.smtpHost,
    smtpPort: Number(payload.smtpPort) || 465,
    imapTls: payload.imapTls !== false,
    smtpTls: payload.smtpTls !== false,
  };
}

function json(result, status = 200) {
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ---------------------------------------------------------------------------
// Mail translation.
//
// Translation reuses DSH's built-in `translator` service. That service comes
// from an opt-in experimental bundle, so it is NOT declared in `inject` (a
// hard dependency would leave the whole plugin PENDING on machines where the
// bundle is off). We probe it lazily and degrade to a clear error instead.
// Bing is the default provider — no login, no API key, no extra cost.
//
// The service caps a single request at 4000 UTF-16 code units. Mail bodies are
// routinely longer, so we split on line boundaries (keeping the newlines) and
// translate chunk by chunk, then stitch the translated chunks back together.
// ---------------------------------------------------------------------------
const TRANSLATION_CHUNK_CHARS = 3500; // headroom below the service's 4000 limit

function splitForTranslation(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let current = '';
  // Keep each line's trailing newline attached so joins restore the exact
  // original line structure instead of collapsing blank lines.
  const segments = text.split(/(?<=\n)/);
  for (const segment of segments) {
    if (!segment) continue;
    if (segment.length > maxChars) {
      // One very long line: hard-split it into code-unit-sized pieces.
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < segment.length; i += maxChars) {
        chunks.push(segment.slice(i, i + maxChars));
      }
      continue;
    }
    if (current && current.length + segment.length > maxChars) {
      chunks.push(current);
      current = segment;
    } else {
      current += segment;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function getTranslator(ctx) {
  // Optional service: NEVER declare `translator` in `inject` (that would hold
  // this plugin PENDING whenever the experimental bundle is off), and NEVER
  // read `ctx.translator` here — the Context proxy throws
  // `cannot get property "translator" without inject` when it is not injected.
  // ctx.get() reads without the inject requirement; the false-strict retry
  // also finds a provider whose fiber is not currently ACTIVE.
  if (typeof ctx.get !== 'function') return undefined;
  try {
    return ctx.get('translator') ?? ctx.get('translator', false);
  } catch {
    return undefined;
  }
}

async function translateMailText(ctx, text, targetLanguage, signal) {
  const translator = getTranslator(ctx);
  if (!translator || typeof translator.translate !== 'function') {
    const error = new Error('translation service unavailable');
    error.code = 'TRANSLATION_UNAVAILABLE';
    throw error;
  }
  const chunks = splitForTranslation(text, TRANSLATION_CHUNK_CHARS);
  const results = [];
  for (const chunk of chunks) {
    if (!chunk) { results.push(''); continue; }
    const spec = translator.resolve({
      text: chunk,
      targetLanguage,
      sourceLanguage: 'auto',
    });
    results.push(await translator.translate(spec, signal));
  }
  return results.join('');
}

async function handleRequest(ctx, request) {
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid JSON body' }, 400);
    }
  }
  const op = body.op || url.searchParams.get('op');
  try {
    switch (op) {
      case 'getSettings':
        return json({ ok: true, settings: await readSettings(ctx) });
      case 'setSettings':
        return json({ ok: true, settings: await writeSettings(ctx, body.value) });
      case 'listAccounts':
        return json({ ok: true, accounts: await listAccounts(ctx) });
      case 'saveAccount': {
        const username = String(body.username || '').trim();
        if (!username) return json({ ok: false, error: 'username is required' }, 400);
        const authCode = String(body.authCode || '');
        if (!authCode) return json({ ok: false, error: 'authCode is required' }, 400);
        const id = body.id || accountId(username.toLowerCase());
        const payload = {
          name: String(body.name || username).trim(),
          username,
          authCode,
          imapHost: String(body.imapHost || '').trim(),
          imapPort: Number(body.imapPort) || 993,
          smtpHost: String(body.smtpHost || '').trim(),
          smtpPort: Number(body.smtpPort) || 465,
          imapTls: body.imapTls !== false,
          smtpTls: body.smtpTls !== false,
        };
        if (!payload.imapHost) return json({ ok: false, error: 'imapHost is required' }, 400);
        if (!payload.smtpHost) return json({ ok: false, error: 'smtpHost is required' }, 400);
        await ctx.credentials.modifyRecord(recordKey(id), async () => ({
          kind: 'grant',
          payload,
        }));
        return json({ ok: true, account: publicAccount(id, payload) });
      }
      case 'renameAccount': {
        // The account label is user-chosen and local to this machine, so nothing
        // is read from the mailbox or any online profile API.
        const id = String(body.id || '');
        const name = String(body.name || '').trim();
        if (!id) return json({ ok: false, error: 'id is required' }, 400);
        if (!name) return json({ ok: false, error: 'name is required' }, 400);
        const payload = await getAccountPayload(ctx, id);
        const next = Object.assign({}, payload, { name });
        await ctx.credentials.modifyRecord(recordKey(id), async () => ({ kind: 'grant', payload: next }));
        return json({ ok: true, account: publicAccount(id, next) });
      }
      case 'deleteAccount': {
        const id = String(body.id || '');
        if (!id) return json({ ok: false, error: 'id is required' }, 400);
        await ctx.credentials.deleteRecord(recordKey(id));
        return json({ ok: true });
      }
      case 'testAccount': {
        const payload = await getAccountPayload(ctx, String(body.id || ''));
        return json(await runBridge('test', { account: bridgeAccount(payload) }));
      }
      case 'listMessages': {
        const payload = await getAccountPayload(ctx, String(body.id || ''));
        return json(await runBridge('listMessages', {
          account: bridgeAccount(payload),
          folder: body.folder || 'INBOX',
          limit: Number(body.limit) || 20,
        }));
      }
      case 'getMessage': {
        const payload = await getAccountPayload(ctx, String(body.id || ''));
        return json(await runBridge('getMessage', {
          account: bridgeAccount(payload),
          uid: String(body.uid || ''),
          folder: body.folder || 'INBOX',
        }));
      }
      case 'getAttachment': {
        const payload = await getAccountPayload(ctx, String(body.id || ''));
        return json(await runBridge('getAttachment', {
          account: bridgeAccount(payload),
          uid: String(body.uid || ''),
          folder: body.folder || 'INBOX',
          index: Number(body.index) || 0,
        }));
      }
      case 'sendMessage': {
        const id = String(body.id || '');
        const payload = await getAccountPayload(ctx, id);
        const to = String(body.to || '').trim();
        if (!to) return json({ ok: false, error: 'to is required' }, 400);
        const attachments = Array.isArray(body.attachments) ? body.attachments : [];
        // Guard the outbound path: each attachment arrives base64-encoded in the
        // request body and is buffered in memory on both sides of the bridge.
        let totalBytes = 0;
        for (const att of attachments) {
          const content = String((att && att.content) || '');
          if (!content) continue;
          totalBytes += Math.floor((content.length * 3) / 4);
        }
        if (totalBytes > 25 * 1024 * 1024) {
          return json({ ok: false, error: '附件总大小超过 25 MB，请分开发送。' }, 400);
        }
        const result = await runBridge('sendMessage', {
          account: bridgeAccount(payload),
          to,
          subject: String(body.subject || ''),
          body: String(body.body || ''),
          attachments,
        });
        if (result.ok) {
          // Keep a local outbox record as an instant, offline-capable mirror of
          // the IMAP Sent folder. The outbox is per-account (key includes id).
          try {
            const store = await readData(ctx, outboxKey(id), { sent: [] });
            const list = Array.isArray(store.sent) ? store.sent : [];
            list.unshift({
              id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8),
              to,
              subject: String(body.subject || ''),
              body: String(body.body || ''),
              date: new Date().toISOString(),
              attachments: attachments.map(a => ({
                name: String((a && a.name) || 'attachment'),
                size: Math.floor((String((a && a.content) || '').length * 3) / 4),
                mime: String((a && a.mime) || ''),
              })),
            });
            await writeData(ctx, outboxKey(id), { sent: list.slice(0, 200) });
          } catch {
            // Local mirror must never fail an already-delivered message.
          }
        }
        return json(result);
      }
      case 'sentMessages': {
        const id = String(body.id || '');
        const payload = await getAccountPayload(ctx, id);
        // Read Sent from the mail server so mails sent on other devices show up.
        try {
          const r = await runBridge('listSent', { account: bridgeAccount(payload), limit: 50 });
          if (r && r.ok && Array.isArray(r.messages)) {
            const sent = r.messages.map(m => ({
              id: m.id || ((m.folder || '') + ':' + m.uid),
              to: m.to || '',
              subject: m.subject || '',
              body: m.snippet || '',
              date: m.date || '',
              from: m.from || '',
              uid: m.uid || '',
              folder: m.folder || '',
            }));
            try { await writeData(ctx, outboxKey(id), { sent }); } catch {}
            return json({ ok: true, sent });
          }
        } catch {
          // Fall through to the local cache below.
        }
        const store = await readData(ctx, outboxKey(id), { sent: [] });
        return json({ ok: true, sent: Array.isArray(store.sent) ? store.sent : [] });
      }
      case 'listContacts': {
        const id = String(body.id || '');
        const store = await readData(ctx, contactsKey(id), { contacts: [] });
        return json({ ok: true, contacts: Array.isArray(store.contacts) ? store.contacts : [] });
      }
      case 'saveContact': {
        const id = String(body.id || '');
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return json({ ok: false, error: 'valid email is required' }, 400);
        const emailLower = c => String(c.email || '').toLowerCase();
        const store = await readData(ctx, contactsKey(id), { contacts: [] });
        const list = Array.isArray(store.contacts) ? store.contacts.slice() : [];
        const existing = list.find(c => emailLower(c) === email);
        if (existing) existing.name = String(body.name || existing.name || '');
        else list.push({ email, name: String(body.name || '') });
        list.sort((a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)));
        await writeData(ctx, contactsKey(id), { contacts: list });
        return json({ ok: true, contacts: list });
      }
      case 'deleteContact': {
        const id = String(body.id || '');
        const email = String(body.email || '').trim().toLowerCase();
        const store = await readData(ctx, contactsKey(id), { contacts: [] });
        const list = (Array.isArray(store.contacts) ? store.contacts : [])
          .filter(c => String(c.email || '').toLowerCase() !== email);
        await writeData(ctx, contactsKey(id), { contacts: list });
        return json({ ok: true, contacts: list });
      }
      case 'translate': {
        const text = typeof body.text === 'string' ? body.text : '';
        if (!text.trim()) {
          return json({ ok: false, error: 'text is required' }, 400);
        }
        const targetLanguage =
          typeof body.targetLanguage === 'string' && body.targetLanguage.trim()
            ? body.targetLanguage.trim()
            : 'zh-CN';
        try {
          const translated = await translateMailText(ctx, text, targetLanguage, request.signal);
          return json({ ok: true, text: translated });
        } catch (error) {
          const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
          const status = code === 'TRANSLATION_UNAVAILABLE' ? 503 : 502;
          return json({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            ...(code ? { code } : {}),
          }, status);
        }
      }
      default:
        return json({ ok: false, error: 'unknown op: ' + op }, 400);
    }
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.connection.fetch.register({
    path: API,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: (request) => handleRequest(ctx, request),
  }), 'dsh-mail: fetch route');

  // Read-only mailbox tool for the AI assistant. The tool itself checks the
  // `agentMailAccess` setting on every call, so turning the switch off revokes
  // access immediately without reloading the plugin.
  ctx.effect(() => ctx.tools.register(mailQueryTool(
    ctx, handleRequest,
    async () => (await readSettings(ctx)).agentMailAccess === true
  )), 'dsh-mail: mail_query tool');
}
