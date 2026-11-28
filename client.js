window.__ModuleLoader__.load({
  id: '@mysterycode-liwen/dsh-mail',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useLayoutEffect } = React;

    const NS = 'dsh-mail';
    const API = '/api/dsh-mail';
    // ---- Credential-vault bridge client (self-contained, zero deps) ----
    // Enables "fill from vault" only when the credential-vault plugin is installed.
    // Uninstalled -> isAvailable() false -> the feature silently hides.
    /*
     * vault-bridge-client.js — reusable client module for the DSH credential vault bridge
     * ------------------------------------------------------------------------------
     * Copy this whole file's contents into your plugin's client.js (inside
     * factory(require)), or load it through your plugin's build step. ZERO deps:
     * it only uses window.crypto.subtle, btoa/atob and TextEncoder/TextDecoder.
     *
     * WHY THIS EXISTS
     *   The vault keeps real secrets in its own browser localStorage. The Harness
     *   Host process only ever sees metadata (secrets are masked), so a plugin that
     *   needs a real value (e.g. a mail app password) must talk to the vault's
     *   browser-side bridge. This module does that.
     *
     *   All payloads are encrypted with an ECDH (P-256) + AES-GCM session:
     *     1. client.query(...)  -> bridge.hello() = vault ephemeral public key + id
     *     2. client generates its own ephemeral key pair, derives the shared AES key
     *     3. client seals the query, vault decrypts / reads secrets / seals result
     *     4. client opens the result with the same derived key.
     *   No plaintext and no long-lived key ever crosses the bridge. If the vault is
     *   not installed, isAvailable() is false and query() rejects NOT_INSTALLED —
     *   gate your UI on isAvailable() so the feature silently disappears.
     *
     * SECURITY NOTE
     *   The bridge is a same-document JS object. ECDH stops passive observers and
     *   other plugins from reading the payload, but a hostile script in the same
     *   document could still call the bridge as if it were your plugin. The vault
     *   never auto-authorises: each session is one-time use and expires in 60s.
     *
     * USAGE
     *   const vault = createVaultV1Client({ callerId: 'my-plugin-id' }); // REQUIRED for scoped reads
     *   if (vault.isAvailable()) {
     *     const entries = await vault.query({ category: 'account', title: 'qq' });
     *     const secret = vault.secretOf(entries[0]);  // real password / key value
     *   }
     *
     * Node (tests): also exported via module.exports when available.
     */
    
    function createVaultV1Client(options) {
      options = options || {};
      // Identity declared by the calling plugin. The vault only returns credentials
      // whose "accessible plugins" list includes this id. Without it, nothing is returned.
      var callerId = typeof options.callerId === 'string' && options.callerId.trim() ? options.callerId.trim() : '';
      var win = options.window || (typeof window !== 'undefined' ? window : null);
      var BRIDGE_KEY = '@mysterycode-liwen/dsh-credential-vault/bridge/v1';
    
      function cryptoObj() {
        return (win && win.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
      }
      function subtle() {
        var c = cryptoObj();
        return c && c.subtle ? c.subtle : null;
      }
      function randomFill(bytes) {
        var c = cryptoObj();
        if (!c || !c.getRandomValues) throw new Error('NO_CRYPTO');
        c.getRandomValues(bytes);
        return bytes;
      }
      function toB64u(bytes) {
        var s = '';
        for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        var btoaFn = options.btoa || (typeof btoa === 'function' ? btoa : (win && win.btoa));
        return btoaFn(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      function fromB64u(str) {
        var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        var atobFn = options.atob || (typeof atob === 'function' ? atob : (win && win.atob));
        var bin = atobFn(s), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      function enc(str) { return new TextEncoder().encode(str); }
      function dec(bytes) { return new TextDecoder().decode(bytes); }
    
      function bridge() {
        if (!win || !win[BRIDGE_KEY]) return null;
        var b = win[BRIDGE_KEY];
        return b && b.version === 1 && typeof b.hello === 'function' && typeof b.query === 'function' ? b : null;
      }
    
      function generatePair(s) {
        return s.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      }
      function deriveKey(s, priv, peerJwk) {
        return s.importKey('jwk', peerJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
          .then(function (pub) { return s.deriveBits({ name: 'ECDH', public: pub }, priv, 256); })
          .then(function (bits) { return s.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); });
      }
      function seal(s, key, obj) {
        var iv = randomFill(new Uint8Array(12));
        return s.encrypt({ name: 'AES-GCM', iv: iv }, key, enc(JSON.stringify(obj)))
          .then(function (ct) { return { iv: toB64u(iv), ciphertext: toB64u(new Uint8Array(ct)) }; });
      }
      function open(s, key, payload) {
        if (!payload || typeof payload.iv !== 'string' || typeof payload.ciphertext !== 'string') {
          return Promise.reject(new Error('BAD_CIPHERTEXT'));
        }
        return s.decrypt({ name: 'AES-GCM', iv: fromB64u(payload.iv) }, key, fromB64u(payload.ciphertext))
          .then(function (plain) { return JSON.parse(dec(new Uint8Array(plain))); });
      }
    
      function isAvailable() { return !!bridge(); }
    
      function query(criteria) {
        criteria = criteria || {};
        var b = bridge();
        if (!b) return Promise.reject(new Error('NOT_INSTALLED'));
        var s = subtle();
        if (!s) return Promise.reject(new Error('NO_CRYPTO'));
        var vaultPub, sessionId, priv, aes;
        return Promise.resolve(b.hello())
          .then(function (hello) {
            if (!hello || !hello.sessionId || !hello.publicKeyJwk) throw new Error('BAD_HELLO');
            sessionId = hello.sessionId;
            vaultPub = hello.publicKeyJwk;
            return generatePair(s);
          })
          .then(function (kp) {
            priv = kp.privateKey;
            return s.exportKey('jwk', kp.publicKey);
          })
          .then(function (pubJwk) {
            return deriveKey(s, priv, vaultPub).then(function (key) {
              aes = key;
              return seal(s, aes, {
                category: criteria.category || 'all',
                title: criteria.title || '',
                limit: criteria.limit || 100,
                callerId: callerId
              }).then(function (sealed) {
                return b.query({
                  sessionId: sessionId,
                  publicKeyJwk: pubJwk,
                  iv: sealed.iv,
                  ciphertext: sealed.ciphertext
                });
              });
            });
          })
          .then(function (result) {
            if (!result) throw new Error('NO_RESPONSE');
            if (result.error) throw new Error(result.error);
            return open(s, aes, result);
          })
          .then(function (plain) { return plain && Array.isArray(plain.entries) ? plain.entries : []; });
      }
    
      function secretOf(entry) {
        if (!entry) return '';
        var keys = ['password', 'keyValue', 'apiKey', 'content', 'appSecret', 'token', 'encodingAesKey', 'uploadKey'];
        for (var i = 0; i < keys.length; i++) {
          if (typeof entry[keys[i]] === 'string' && entry[keys[i]]) return entry[keys[i]];
        }
        return '';
      }
    
      return {
        version: 1,
        isAvailable: isAvailable,
        query: query,
        secretOf: secretOf,
        _debug: { toB64u: toB64u, fromB64u: fromB64u, deriveKey: deriveKey, seal: seal, open: open }
      };
    }


    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Best-effort plain-text extraction from a sanitized mail body, used as the
    // translation source when the bridge did not supply a plain-text part.
    function htmlToText(html) {
      return String(html == null ? '' : html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    let t = (key) => key;

    // Map a structured bridge error ({ code, error, stage }) to a short,
    // human-readable message. The raw server text is kept as a second line so
    // nothing diagnostic is lost, but it is no longer the whole message.
    function friendlyError(data) {
      const info = (data && typeof data === 'object') ? data : { error: String(data || '') };
      const stage = info.stage
        ? (info.stage === 'imap' ? t('imapHost') : t('smtpHost')) + ' · '
        : '';
      const map = {
        auth_failed: t('errAuthFailed'),
        rate_limited: t('errRateLimited'),
        service_disabled: t('errServiceDisabled'),
        timeout: t('errTimeout'),
        tls: t('errTls'),
        network: t('errNetwork'),
        folder: t('errFolder'),
        search: t('errSearch'),
        not_found: t('errNotFound'),
        generic: t('errGeneric'),
      };
      const known = Object.prototype.hasOwnProperty.call(map, info.code);
      const head = known ? map[info.code] : t('errGeneric');
      const raw = String(info.error || '').trim();
      // "unknown op" means the Host half predates this Client half: the plugin
      // was updated on disk but DeepSeek Harness was never restarted, so the
      // running Host has no case for the op the UI just sent.
      if (/unknown op/i.test(raw)) return t('errOutdatedHost');
      const detail = (!known && raw && raw !== head) ? '\n' + t('errDetail') + raw : '';
      return stage + head + detail;
    }

    const zh = {
      label: '邮件',
      badgeTitle: '有新邮件',
      accounts: '账号',
      addAccount: '添加账号',
      clearForm: '清空表单',
      noAccounts: '还没有账号，添加一个即可开始收发邮件。',
      name: '名称',
      username: '邮箱地址',
      authCode: '密码 / 授权码',
      imapHost: 'IMAP 主机',
      imapPort: 'IMAP 端口',
      smtpHost: 'SMTP 主机',
      smtpPort: 'SMTP 端口',
      save: '保存',
      cancel: '取消',
      test: '测试连接',
      delete: '删除',
      refresh: '刷新',
      refreshing: '刷新中…',
      refreshed: '已刷新',
      refreshFailed: '刷新失败',
      inbox: '收件箱',
      compose: '写邮件',
      to: '收件人',
      subject: '主题',
      body: '正文',
      send: '发送',
      back: '返回',
      from: '发件人',
      date: '日期',
      noMessages: '没有邮件。',
      filterAll: '全部',
      filterUnread: '未读',
      filterRead: '已读',
      noFiltered: '没有符合条件的邮件。',
      loading: '加载中…',
      selectAccount: '请选择一个账号。',
      qq: 'QQ 邮箱',
      netease: '网易 163',
      gmail: 'Gmail',
      custom: '自定义',
      presets: '快速设置',
      note: 'QQ / 163 需要邮箱授权码，而不是登录密码。授权码保存在凭据保险箱中。',
      fillFromVault: '从保险箱选择',
      vaultUnavailable: '未安装凭据保险箱插件，或保险箱中没有账号类凭据。',
      vaultPickTitle: '从凭据保险箱选择授权码',
      vaultPickHint: '以下是保险箱中的账号凭据，选择一个用其密码/授权码填入。',
      vaultPickEmpty: '保险箱中没有可用的账号凭据。',
      vaultPickError: '读取保险箱失败，请确认保险箱插件已启用。',
      vaultPickLoading: '正在读取…',
      confirmDelete: '确定删除此账号吗？',
      rename: '重命名',
      renameHint: '名称只在本机显示，默认用邮箱前缀。',
      noSubject: '(无主题)',
      ok: '成功',
      failed: '失败',
      errAuthFailed: '登录失败：邮箱账号或授权码不正确，也可能是 IMAP/SMTP 服务未开启、操作太频繁。QQ/163 请使用「授权码」而非登录密码，并确认已在邮箱设置中开启 IMAP/SMTP 服务。',
      errRateLimited: '登录过于频繁，邮箱服务器暂时拒绝了请求。请稍等几分钟后再试。',
      errServiceDisabled: '邮箱的 IMAP/SMTP 服务未开启。请登录邮箱网页版，在「设置 → 账户」中开启 POP3/IMAP/SMTP 服务后再试。',
      errTimeout: '连接邮箱服务器超时，请检查网络后重试。',
      errTls: '加密连接失败，请检查服务器地址和端口，确认已启用 TLS/SSL（993 / 465 端口）。',
      errNetwork: '无法连接邮箱服务器，请检查网络、服务器地址和端口是否正确。',
      errFolder: '读取邮件文件夹失败，请刷新后重试。',
      errSearch: '搜索邮件失败，请稍后重试。',
      errNotFound: '未找到这封邮件，它可能已被删除。',
      errGeneric: '操作失败，请稍后重试。',
      errDetail: '服务器返回：',
      errOutdatedHost: '插件已更新，但 DeepSeek Harness 仍在运行旧版本。请完全退出并重新启动 DeepSeek Harness（仅刷新页面不够）。',
      sent: '发件箱',
      contacts: '联系人',
      noSent: '还没有已发送的邮件。',
      noContacts: '还没有联系人，请在下方手动添加。',
      addContact: '添加联系人',
      contactName: '姓名',
      contactEmail: '邮箱地址',
      saveContact: '保存联系人',
      deleteContact: '删除',
      contactsHint: '手动添加的联系人仅保存在本地，不会上传到邮箱服务器。',
      addSender: '加为联系人',
      addRecipient: '加收件人',
      contactAdded: '已加为联系人。',
      contactExists: '已在联系人中。',
      emailRequired: '请填写有效的邮箱地址。',
      saved: '已保存。',
      selectContact: '用此地址写邮件',
      attached: '附件',
      attachments: '附件',
      attachmentsHint: '拖拽文件到此处，或点击「添加附件」',
      addAttachment: '添加附件',
      removeAttachment: '移除',
      downloadAttachment: '下载',
      noAttachments: '没有附件',
      attachmentTooLarge: '附件总大小超过 25 MB，请分开发送。',
      attachmentFailed: '附件操作失败：',
      attachmentSaved: '已保存到下载目录：',
      sending: '发送中…',
      settingsTitle: '邮件',
      settingsDescription: '配置 AI 助手是否可以读取你的邮箱。',
      agentMailAccessLabel: '允许 AI 助手查询邮箱',
      agentMailAccessHint: '开启后，AI 助手可以列出账号、读取邮件列表与内容、查看发件箱；不会暴露密码或授权码，也不能发送或删除邮件。默认关闭。',
      agentMailAccessOn: '已开启：AI 助手可以读取邮箱。',
      agentMailAccessOff: '已关闭：AI 助手无法读取邮箱。',
      settingsUnavailable: '本页没有可编辑的配置表单；请在 profile 配置中设置 agentMailAccess。',
      settingsReadOnly: '本部署的设置为只读。',
      settingsSave: '保存',
      settingsSaving: '保存中…',
      settingsSaveFailed: '设置保存失败，请重试。',
      settingsSaveSuccess: '设置已保存。',
      notifySectionTitle: '新邮件通知',
      notifySectionHint: '后台定时检查邮箱，收到新邮件时让桌宠气泡播报；若浏览器已授权，也会同时弹出系统通知。',
      notifySectionHintSystem: '后台定时检查邮箱，收到新邮件时弹出系统通知（需浏览器授权）。',
      notifyEnabledLabel: '启用新邮件提醒（桌宠播报）',
      notifyEnabledLabelSystem: '启用新邮件提醒（系统通知）',
      notifyIntervalLabel: '检查间隔（秒）',
      notifyPermission: '申请通知权限',
      notifyPermissionGranted: '通知权限已开启',
      notifyPermissionDenied: '通知权限被浏览器阻止，请在浏览器设置中允许本站通知',
      notifyPermissionUnsupported: '当前环境不支持系统通知',
      notifyPermissionAsking: '申请中…',
      notifyTest: '发送测试通知',
      notifyTestSent: '测试通知已发出（请到系统通知中心查看）',
      notifyTestFailed: '测试通知发送失败',
      notifyTitle: '新邮件',
      notifyBody: '封未读新邮件',
      notifyAnnounceOne: '你有一封{name}发来的邮件请注意查收！',
      notifyAnnounceMany: '你有{n}封{name}发来的邮件请注意查收！',
      notifyAnnounceGeneric: '你有{n}封新邮件请注意查收！',
      notifyUnknownSender: '未知发件人',
      notifyTestTitle: '邮件播报测试',
      notifyTestBody: '你有一封君莫笑发来的邮件请注意查收！',
      notifyTestTitleSystem: '新邮件通知测试',
      notifyTestBodySystem: '如果你在系统通知中心看到这条消息，说明新邮件通知已正常工作。',
      notifyPetOk: '已让桌宠播报（请留意桌面桌宠）',
      notifyPetNone: '未发现可用的桌宠，仅发送了系统通知',
      notifyMode: '通知方式',
      notifyModePet: '桌宠播报',
      notifyModeSystem: '系统通知（需浏览器权限）',
      notifyModeBoth: '桌宠播报 + 系统通知',
      notifyCheckNow: '立即检查新邮件',
      notifyChecking: '检查中…',
      notifyCheckDone: '检查完成：发现 {n} 封新邮件',
      notifyDiagTitle: '检测状态',
      notifyDiagRunning: '轮询运行中',
      notifyDiagStopped: '轮询未运行',
      notifyDiagAccounts: '账号数',
      notifyDiagChecks: '检查次数',
      notifyDiagAlerts: '播报次数',
      notifyDiagAlertsSystem: '通知次数',
      notifyDiagLastCheck: '上次检查',
      notifyDiagNever: '从未',
      notifyDiagError: '最近错误',
      notifyDiagOk: '正常',
      // 邮件翻译
      translate: '翻译',
      translating: '翻译中…',
      translated: '译文',
      translateShowOriginal: '查看原文',
      translatedNotice: '由 DSH 翻译（机器翻译，仅供参考）',
      translateFailed: '翻译失败：',
      translateUnavailable: '当前环境未启用翻译服务。请在「设置 → 插件」中启用实验性翻译扩展后重试。',
      translateTextLimit: '邮件内容过长，翻译失败。',
    };
    const en = {
      label: 'Mail',
      badgeTitle: 'New mail',
      accounts: 'Accounts',
      addAccount: 'Add account',
      clearForm: 'Clear form',
      noAccounts: 'No accounts yet. Add one to start sending and receiving mail.',
      name: 'Name',
      username: 'Email address',
      authCode: 'Password / app code',
      imapHost: 'IMAP host',
      imapPort: 'IMAP port',
      smtpHost: 'SMTP host',
      smtpPort: 'SMTP port',
      save: 'Save',
      cancel: 'Cancel',
      test: 'Test connection',
      delete: 'Delete',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      refreshed: 'Refreshed',
      refreshFailed: 'Refresh failed',
      inbox: 'Inbox',
      compose: 'Compose',
      to: 'To',
      subject: 'Subject',
      body: 'Body',
      send: 'Send',
      back: 'Back',
      from: 'From',
      date: 'Date',
      noMessages: 'No messages.',
      filterAll: 'All',
      filterUnread: 'Unread',
      filterRead: 'Read',
      noFiltered: 'No messages match this filter.',
      loading: 'Loading…',
      selectAccount: 'Select an account.',
      qq: 'QQ Mail',
      netease: 'NetEase 163',
      gmail: 'Gmail',
      custom: 'Custom',
      presets: 'Presets',
      note: 'QQ / 163 need an app password, not your login password. Stored in the credential vault.',
      fillFromVault: 'Fill from vault',
      vaultUnavailable: 'Credential vault plugin not installed, or no account credentials in it.',
      vaultPickTitle: 'Choose app password from vault',
      vaultPickHint: 'These are the account credentials in your vault. Pick one to fill its password / app code.',
      vaultPickEmpty: 'No account credentials found in the vault.',
      vaultPickError: 'Failed to read the vault. Make sure the vault plugin is enabled.',
      vaultPickLoading: 'Reading…',
      confirmDelete: 'Delete this account?',
      rename: 'Rename',
      renameHint: 'The name is local to this machine; it defaults to the mailbox prefix.',
      noSubject: '(no subject)',
      ok: 'OK',
      failed: 'Failed',
      errAuthFailed: 'Login failed: the email address or app password is wrong, or IMAP/SMTP is disabled / you tried too often. For QQ/163 use an app password (not your login password) and enable IMAP/SMTP in your mailbox settings.',
      errRateLimited: 'Too many login attempts — the mail server temporarily refused the request. Please wait a few minutes and try again.',
      errServiceDisabled: 'IMAP/SMTP is not enabled for this mailbox. Sign in to the webmail, enable POP3/IMAP/SMTP under settings, then retry.',
      errTimeout: 'Connection to the mail server timed out. Check your network and try again.',
      errTls: 'Encrypted connection failed. Check the server and port, and make sure TLS/SSL is enabled (port 993 / 465).',
      errNetwork: 'Could not reach the mail server. Check your network and verify the server address and port.',
      errFolder: 'Could not open the mail folder. Please refresh and try again.',
      errSearch: 'Search failed. Please try again later.',
      errNotFound: 'This message was not found — it may have been deleted.',
      errGeneric: 'The operation failed. Please try again later.',
      errDetail: 'Server said: ',
      errOutdatedHost: 'The plugin was updated but DeepSeek Harness is still running the old version. Fully quit and restart DeepSeek Harness (refreshing the page is not enough).',
      sent: 'Sent',
      contacts: 'Contacts',
      noSent: 'No sent messages yet.',
      noContacts: 'No contacts yet. Add one with the form below.',
      addContact: 'Add contact',
      contactName: 'Name',
      contactEmail: 'Email address',
      saveContact: 'Save contact',
      deleteContact: 'Delete',
      contactsHint: 'Contacts you add are saved locally only and are not uploaded to the mail server.',
      addSender: 'Add sender',
      addRecipient: 'Add recipient',
      contactAdded: 'Added to contacts.',
      contactExists: 'Already in contacts.',
      emailRequired: 'Please enter a valid email address.',
      saved: 'Saved.',
      selectContact: 'Compose to this address',
      attached: 'Attachments',
      attachments: 'Attachments',
      attachmentsHint: 'Drop files here, or click "Add attachment"',
      addAttachment: 'Add attachment',
      removeAttachment: 'Remove',
      downloadAttachment: 'Download',
      noAttachments: 'No attachments',
      attachmentTooLarge: 'Attachments exceed 25 MB in total; please send them separately.',
      attachmentFailed: 'Attachment failed: ',
      attachmentSaved: 'Saved to your downloads folder: ',
      sending: 'Sending…',
      settingsTitle: 'Mail',
      settingsDescription: 'Control whether the AI assistant may read your mailbox.',
      agentMailAccessLabel: 'Allow AI assistant to query mail',
      agentMailAccessHint: 'When on, the AI assistant can list accounts, read message lists and bodies, and view sent mail. Passwords and app codes are never exposed, and it cannot send or delete mail. Off by default.',
      agentMailAccessOn: 'On: the AI assistant can read your mailbox.',
      agentMailAccessOff: 'Off: the AI assistant cannot read your mailbox.',
      settingsUnavailable: 'This page has no editable configuration form; set `agentMailAccess` in the profile configuration instead.',
      settingsReadOnly: 'This deployment stores settings read-only.',
      settingsSave: 'Save',
      settingsSaving: 'Saving…',
      settingsSaveFailed: 'Failed to save settings. Please try again.',
      settingsSaveSuccess: 'Settings saved.',
      notifySectionTitle: 'New mail notifications',
      notifySectionHint: 'Check your mailbox in the background and have your desktop pet announce new mail in a speech bubble; a system notification is also shown when browser permission is granted.',
      notifySectionHintSystem: 'Check your mailbox in the background and show a system notification for new mail (needs browser permission).',
      notifyEnabledLabel: 'Enable new mail alerts (pet announcement)',
      notifyEnabledLabelSystem: 'Enable new mail alerts (system notification)',
      notifyIntervalLabel: 'Check interval (seconds)',
      notifyPermission: 'Grant notification permission',
      notifyPermissionGranted: 'Notification permission is granted',
      notifyPermissionDenied: 'Notifications are blocked by the browser; allow them for this site in browser settings',
      notifyPermissionUnsupported: 'System notifications are not supported here',
      notifyPermissionAsking: 'Requesting…',
      notifyTest: 'Send a test notification',
      notifyTestSent: 'Test notification sent (check your notification center)',
      notifyTestFailed: 'Failed to send test notification',
      notifyTitle: 'New mail',
      notifyBody: 'new unread message(s)',
      notifyAnnounceOne: 'You have one new email from {name} — please check it!',
      notifyAnnounceMany: 'You have {n} new emails from {name} — please check them!',
      notifyAnnounceGeneric: 'You have {n} new emails — please check them!',
      notifyUnknownSender: 'Unknown sender',
      notifyTestTitle: 'Mail announcement test',
      notifyTestBody: 'You have one new email from John — please check it!',
      notifyTestTitleSystem: 'New mail notification test',
      notifyTestBodySystem: 'If you see this message in your notification center, new mail notifications are working.',
      notifyPetOk: 'Asked your desktop pet to announce it (watch the desktop)',
      notifyPetNone: 'No desktop pet available; only a system notification was sent',
      notifyMode: 'Notification mode',
      notifyModePet: 'Pet announcement',
      notifyModeSystem: 'System notification (needs browser permission)',
      notifyModeBoth: 'Pet announcement + system notification',
      notifyCheckNow: 'Check new mail now',
      notifyChecking: 'Checking…',
      notifyCheckDone: 'Check complete: {n} new message(s)',
      notifyDiagTitle: 'Detection status',
      notifyDiagRunning: 'Poller running',
      notifyDiagStopped: 'Poller not running',
      notifyDiagAccounts: 'Accounts',
      notifyDiagChecks: 'Checks',
      notifyDiagAlerts: 'Alerts',
      notifyDiagAlertsSystem: 'Notifications',
      notifyDiagLastCheck: 'Last check',
      notifyDiagNever: 'Never',
      notifyDiagError: 'Last error',
      notifyDiagOk: 'OK',
      // Mail translation
      translate: 'Translate',
      translating: 'Translating…',
      translated: 'Translation',
      translateShowOriginal: 'Show original',
      translatedNotice: 'Translated by DSH (machine translation, for reference only)',
      translateFailed: 'Translation failed: ',
      translateUnavailable: 'Translation is not enabled in this environment. Enable the experimental translation extension under Settings → Plugins and retry.',
      translateTextLimit: 'This message is too long to translate.',
    };

    // ---------------------------------------------------------------------
    // Visual layer. Everything is class-based and scoped under .dsh-mail so
    // it cannot leak into the host app. Colors come only from DSH theme
    // tokens, so light/dark themes both look native. Interaction feedback
    // uses transform/opacity/brightness (theme-independent) instead of the
    // hardcoded gray buttons the previous version had.
    // ---------------------------------------------------------------------
    const CSS = [
      '.dsh-mail { display:flex; flex-direction:column; height:100%; box-sizing:border-box; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-family:inherit; font-size:13px; line-height:1.55; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }',
      '.dsh-mail * { box-sizing:border-box; }',
      '.dsh-mail button, .dsh-mail input, .dsh-mail textarea, .dsh-mail select { font-family:inherit; }',
      '.dsh-mail-spacer { flex:1; min-width:0; }',

      /* top bar */
      '.dsh-mail-topbar { display:flex; align-items:center; gap:12px; padding:15px 20px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); background:linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-bg-layer-1)), var(--dsw-alias-bg-layer-1)); }',
      '.dsh-mail-brand { display:flex; align-items:center; gap:11px; font-size:16px; font-weight:700; letter-spacing:.3px; }',
      '.dsh-mail-brandmark { width:34px; height:34px; border-radius:11px; display:grid; place-items:center; background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 78%, white), var(--dsw-alias-brand-primary)); color:var(--dsw-alias-bg-base); box-shadow:0 4px 12px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent), inset 0 1px 0 rgba(255,255,255,.22); }',
      '.dsh-mail-brandsub { font-size:10.5px; color:var(--dsw-alias-label-secondary); font-weight:500; letter-spacing:.6px; text-transform:uppercase; }',

      /* buttons */
      '.dsh-mail-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--dsw-alias-border-l2); border-radius:9px; padding:7px 13px; font-size:12px; font-weight:600; line-height:1.4; cursor:pointer; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); transition:filter .15s, transform .08s, box-shadow .15s, border-color .15s, background .15s; white-space:nowrap; }',
      '.dsh-mail-btn:hover:not(:disabled) { filter:brightness(.97); border-color:var(--dsw-alias-brand-primary); box-shadow:0 2px 8px rgba(0,0,0,.08); }',
      '.dsh-mail-btn:active:not(:disabled) { transform:translateY(1px); box-shadow:inset 0 2px 5px rgba(0,0,0,.12); }',
      '.dsh-mail-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }',
      '.dsh-mail-btn:disabled { opacity:.45; cursor:not-allowed; }',
      '.dsh-mail-btn-primary { background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 82%, white), var(--dsw-alias-brand-primary)); border-color:transparent; color:var(--dsw-alias-bg-base); box-shadow:0 3px 10px color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent), inset 0 1px 0 rgba(255,255,255,.2); }',
      '.dsh-mail-btn-primary:hover:not(:disabled) { filter:brightness(1.06); box-shadow:0 5px 14px color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); }',
      '.dsh-mail-btn-danger { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); background:transparent; }',
      '.dsh-mail-btn-danger:hover:not(:disabled) { filter:none; background:var(--dsw-alias-state-error-primary); color:#fff; }',
      '.dsh-mail-iconbtn { width:30px; height:30px; padding:0; border-radius:8px; }',
      '.dsh-mail-iconbtn .dsh-mail-spinicon { animation:dsh-mail-spin .8s linear infinite; }',
      '.dsh-mail-refresh-ok { color:var(--dsw-alias-state-success-primary); }',
      '.dsh-mail-refresh-err { color:var(--dsw-alias-state-error-primary); }',

      /* segmented navigation */
      '.dsh-mail-tabs { display:flex; align-items:center; gap:4px; padding:0 14px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); overflow-x:auto; }',
      '.dsh-mail-tab { position:relative; display:inline-flex; align-items:center; gap:7px; padding:12px 14px 13px; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:color .15s, transform .08s; }',
      '.dsh-mail-tab:hover { color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-tab:active { transform:scale(.96); }',
      '.dsh-mail-tab.is-active { color:var(--dsw-alias-brand-primary); }',
      '.dsh-mail-tab.is-active::after { content:""; position:absolute; left:12px; right:12px; bottom:0; height:3px; border-radius:3px 3px 0 0; background:linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, white), var(--dsw-alias-brand-primary)); box-shadow:0 -1px 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); }',
      '.dsh-mail-badge { display:grid; place-items:center; min-width:18px; height:18px; padding:0 5px; border-radius:9px; background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 80%, white), var(--dsw-alias-brand-primary)); color:var(--dsw-alias-bg-base); font-size:10px; font-weight:700; box-shadow:0 2px 6px color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent); }',

      /* account chip */
      '.dsh-mail-accountbar { display:flex; align-items:center; gap:9px; padding:9px 16px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }',
      '.dsh-mail-select { flex:1; min-width:0; max-width:320px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:6px 9px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:12px; cursor:pointer; }',

      /* read/unread filter */
      '.dsh-mail-filterbar { display:flex; align-items:center; gap:4px; padding:7px 12px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }',
      '.dsh-mail-filter { display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:600; cursor:pointer; transition:background .12s,color .12s; }',
      '.dsh-mail-filter:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-filter.is-active { background:color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent); color:var(--dsw-alias-brand-primary); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }',
      '.dsh-mail-filtercount { display:grid; place-items:center; min-width:17px; height:17px; padding:0 5px; border-radius:9px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font-size:10px; font-weight:700; }',
      '.dsh-mail-filter.is-active .dsh-mail-filtercount { background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); }',

      /* message list */
      '.dsh-mail-list { flex:1; min-height:0; overflow:auto; padding:8px 10px 20px; }',
      '.dsh-mail-list::-webkit-scrollbar, .dsh-mail-scroll::-webkit-scrollbar { width:8px; height:8px; }',
      '.dsh-mail-list::-webkit-scrollbar-thumb, .dsh-mail-scroll::-webkit-scrollbar-thumb { background:color-mix(in srgb, var(--dsw-alias-label-secondary) 22%, transparent); border-radius:8px; border:2px solid transparent; background-clip:padding-box; }',
      '.dsh-mail-list::-webkit-scrollbar-thumb:hover, .dsh-mail-scroll::-webkit-scrollbar-thumb:hover { background:color-mix(in srgb, var(--dsw-alias-label-secondary) 38%, transparent); background-clip:padding-box; }',
      '.dsh-mail-row { display:flex; align-items:flex-start; gap:12px; padding:13px 12px; margin-bottom:3px; border-radius:12px; border:1px solid transparent; cursor:pointer; transition:background .15s, border-color .15s, transform .1s, box-shadow .15s; }',
      '.dsh-mail-row:hover { background:var(--dsw-alias-bg-layer-2); border-color:var(--dsw-alias-border-l1); box-shadow:0 2px 8px rgba(0,0,0,.05); }',
      '.dsh-mail-row:active { transform:scale(.992); }',
      '.dsh-mail-avatar { width:38px; height:38px; flex:none; border-radius:12px; display:grid; place-items:center; color:#fff; font-size:14px; font-weight:700; box-shadow:inset 0 -6px 10px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.1); }',
      '.dsh-mail-rowmain { flex:1; min-width:0; }',
      '.dsh-mail-rowtop { display:flex; align-items:baseline; gap:8px; }',
      '.dsh-mail-from { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; font-size:13px; }',
      '.dsh-mail-time { flex:none; font-size:11px; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-subject { margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; }',
      '.dsh-mail-preview { margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-row.is-unread { background:color-mix(in srgb, var(--dsw-alias-brand-primary) 5%, transparent); }',
      '.dsh-mail-row.is-unread:hover { background:color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, var(--dsw-alias-bg-layer-2)); }',
      '.dsh-mail-row.is-unread .dsh-mail-from, .dsh-mail-row.is-unread .dsh-mail-subject { color:var(--dsw-alias-label-primary); font-weight:650; }',
      '.dsh-mail-unread { width:7px; height:7px; margin-top:8px; flex:none; border-radius:50%; background:var(--dsw-alias-brand-primary); box-shadow:0 0 0 2px var(--dsw-alias-bg-base); }',
      '.dsh-mail-read .dsh-mail-from, .dsh-mail-read .dsh-mail-subject { color:var(--dsw-alias-label-secondary); font-weight:400; }',

      /* cards / forms */
      '.dsh-mail-card { border:1px solid var(--dsw-alias-border-l1); border-radius:14px; padding:18px; margin-bottom:14px; background:linear-gradient(180deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-base)); box-shadow:0 2px 10px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.04); }',
      '.dsh-mail-cardhead { display:flex; align-items:center; gap:9px; margin-bottom:16px; font-size:14px; font-weight:700; }',
      '.dsh-mail-grid { display:flex; gap:12px; flex-wrap:wrap; }',
      '.dsh-mail-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:160px; margin-bottom:11px; }',
      '.dsh-mail-label { font-size:11px; font-weight:600; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-input, .dsh-mail-textarea, .dsh-mail-selectinput { width:100%; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:8px 10px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:13px; transition:border-color .12s, box-shadow .12s; }',
      '.dsh-mail-input:focus, .dsh-mail-textarea:focus, .dsh-mail-selectinput:focus { outline:none; border-color:var(--dsw-alias-brand-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); background:var(--dsw-alias-bg-layer-1); }',
      '.dsh-mail-textarea { min-height:200px; resize:vertical; line-height:1.6; }',
      '.dsh-mail-hint { font-size:11.5px; color:var(--dsw-alias-label-secondary); line-height:1.6; }',

      /* attachments */
      '.dsh-mail-attachbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }',
      '.dsh-mail-attachlist { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }',
      '.dsh-mail-attach { display:flex; align-items:center; gap:8px; border:1px solid var(--dsw-alias-border-l1); border-radius:8px; padding:7px 10px; background:var(--dsw-alias-bg-base); font-size:12px; }',
      '.dsh-mail-attach-name { font-weight:600; color:var(--dsw-alias-label-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }',
      '.dsh-mail-attach-size { flex:none; font-size:11px; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-attach .dsh-mail-iconbtn { width:26px; height:26px; flex:none; }',
      '.dsh-mail-drop { border:1px dashed var(--dsw-alias-border-l2); border-radius:8px; padding:12px; text-align:center; font-size:11.5px; color:var(--dsw-alias-label-secondary); margin-bottom:12px; }',
      '.dsh-mail-drop.is-over { border-color:var(--dsw-alias-brand-primary); color:var(--dsw-alias-brand-primary); background:color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }',

      /* presets */
      '.dsh-mail-pill { display:inline-flex; align-items:center; gap:5px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; padding:5px 12px; font-size:11.5px; font-weight:600; cursor:pointer; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-secondary); transition:all .12s; }',
      '.dsh-mail-pill:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-brand-primary); }',
      '.dsh-mail-pill:active { transform:translateY(1px); }',
      '.dsh-mail-pill.is-active { background:var(--dsw-alias-brand-primary); border-color:transparent; color:var(--dsw-alias-bg-base); }',

      /* flash */
      '.dsh-mail-flash { display:flex; align-items:flex-start; gap:8px; margin:12px 16px 0; padding:10px 12px; border-radius:9px; font-size:12px; line-height:1.55; white-space:pre-wrap; }',
      '.dsh-mail-flash-error { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent); color:var(--dsw-alias-state-error-primary); border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent); }',
      '.dsh-mail-flash-success { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); color:var(--dsw-alias-state-success-primary); border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 30%, transparent); }',
      '.dsh-mail-flash-info { background:color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent); color:var(--dsw-alias-label-secondary); border:1px solid color-mix(in srgb, var(--dsw-alias-label-secondary) 28%, transparent); }',

      /* empty & loading */
      '.dsh-mail-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:64px 28px; text-align:center; }',
      '.dsh-mail-emptyicon { width:60px; height:60px; border-radius:20px; display:grid; place-items:center; background:color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, var(--dsw-alias-bg-layer-2)); color:var(--dsw-alias-brand-primary); margin-bottom:4px; box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 4px 14px rgba(0,0,0,.06); }',
      '.dsh-mail-emptytitle { font-size:14px; font-weight:650; color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-emptysub { font-size:12px; color:var(--dsw-alias-label-secondary); max-width:320px; line-height:1.6; }',
      '.dsh-mail-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:56px 16px; color:var(--dsw-alias-label-secondary); animation:dsh-mail-fade .25s ease-out; }',
      '.dsh-mail-spinner { display:inline-block; width:20px; height:20px; border:2px solid var(--dsw-alias-border-l2); border-top-color:var(--dsw-alias-brand-primary); border-radius:50%; animation:dsh-mail-spin .7s linear infinite; }',
      '@keyframes dsh-mail-spin { to { transform:rotate(360deg); } }',
      '@keyframes dsh-mail-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }',
      '.dsh-mail-progress { position:relative; height:3px; overflow:hidden; background:var(--dsw-alias-bg-layer-1); }',
      '.dsh-mail-progress::after { content:""; position:absolute; top:0; bottom:0; left:0; width:40%; background:var(--dsw-alias-brand-primary); animation:dsh-mail-slide 1.1s ease-in-out infinite; }',
      '@keyframes dsh-mail-slide { 0% { transform:translateX(-100%); } 100% { transform:translateX(350%); } }',
      '.dsh-mail-view { flex:1; min-height:0; display:flex; flex-direction:column; animation:dsh-mail-fade .2s ease-out; }',
      '.dsh-mail-scroll { flex:1; min-height:0; overflow:auto; padding:16px; }',
      '@media (prefers-reduced-motion: reduce) { .dsh-mail-spinner, .dsh-mail-progress::after, .dsh-mail-loading, .dsh-mail-view { animation:none; } }',

      /* detail */
      '.dsh-mail-detailhead { padding:22px 4px 16px; border-bottom:1px solid var(--dsw-alias-border-l1); margin-bottom:18px; }',
      '.dsh-mail-detailtitle { margin:0 0 12px; font-size:21px; font-weight:700; line-height:1.4; letter-spacing:.2px; }',
      '.dsh-mail-detailfrom { display:flex; align-items:center; gap:10px; }',
      '.dsh-mail-detailfrom > div:nth-child(2) { flex:1; min-width:0; }',
      // A sender already in the address book keeps the button as a quiet state
      // marker instead of an action that would overwrite the saved name.
      '.dsh-mail-btn.is-done { color:var(--dsw-alias-state-success-primary); border-color:var(--dsw-alias-state-success-primary); }',
      '.dsh-mail-detailmeta { font-size:11.5px; color:var(--dsw-alias-label-secondary); margin-top:2px; }',
      '.dsh-mail-detailtoolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:12px; }',
      '.dsh-mail-mailbody { width:100%; padding:20px; border:1px solid var(--dsw-alias-border-l1); border-radius:14px; background:linear-gradient(180deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-base)); color:var(--dsw-alias-label-primary); line-height:1.8; overflow-wrap:anywhere; word-break:break-word; box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 2px 8px rgba(0,0,0,.04); }',
      '.dsh-mail-translated { border-color:var(--dsw-alias-brand-primary); background:color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, var(--dsw-alias-bg-layer-1)); }',
      '.dsh-mail-translatednotice { display:flex; align-items:center; gap:6px; margin-bottom:10px; padding-bottom:10px; border-bottom:1px dashed var(--dsw-alias-border-l2); font-size:11px; color:var(--dsw-alias-label-secondary); }',

      // Third-party HTML: force theme colors so hardcoded mail colors (usually
      // white bg / dark text) never clash with the dark theme. Buttons and links
      // keep their own styling so CTA buttons stay interactive.
      '.dsh-mail-html { text-align:left; }',
      '.dsh-mail-html.dsh-mail-html *:not(button, button *, a, a *, [role="button"], [role="button"] *) { max-width:100% !important; box-sizing:border-box !important; color:var(--dsw-alias-label-primary) !important; background-color:transparent !important; border-color:var(--dsw-alias-border-l2) !important; }',
      '.dsh-mail-html.dsh-mail-html a, .dsh-mail-html.dsh-mail-html a * { color:var(--dsw-alias-brand-primary) !important; text-decoration:underline; cursor:pointer; }',
      '.dsh-mail-html img { max-width:100%; height:auto; border-radius:6px; }',
      '.dsh-mail-html p, .dsh-mail-html div { margin:0 0 8px; }',
      '.dsh-mail-html table { max-width:100%; border-collapse:collapse; }',
      '.dsh-mail-html blockquote { margin:8px 0; padding-left:12px; border-left:3px solid var(--dsw-alias-border-l2) !important; }',
      '.dsh-mail-modal-backdrop { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; padding:20px; }',
      '.dsh-mail-modal { width:100%; max-width:480px; max-height:80vh; overflow:auto; background:var(--dsw-alias-bg-layer-1); border:1px solid var(--dsw-alias-border-l2); border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,.35); }',
      '.dsh-mail-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid var(--dsw-alias-border-l1); font-weight:700; color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-modal-body { padding:14px 18px 18px; }',
      '.dsh-mail-hint { color:var(--dsw-alias-label-secondary); font-size:12px; line-height:1.6; margin-bottom:10px; }',
      '.dsh-mail-vault-opt { display:flex; flex-direction:column; align-items:flex-start; gap:2px; width:100%; text-align:left; padding:10px 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:9px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); cursor:pointer; margin-top:8px; }',
      '.dsh-mail-vault-opt:hover { border-color:var(--dsw-alias-brand-primary); filter:brightness(.98); }',
    ].join('\n');

    const PRESETS = {
      qq: { nameKey: 'qq', imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465 },
      netease: { nameKey: 'netease', imapHost: 'imap.163.com', imapPort: 993, smtpHost: 'smtp.163.com', smtpPort: 465 },
      gmail: { nameKey: 'gmail', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 },
      custom: { nameKey: 'custom', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465 },
    };

    // A fresh, fully-empty account form. Account ids are derived from the
    // username, so the form MUST be reset between accounts — otherwise a
    // second "add" silently reuses the previous username's id and overwrites
    // the first account (which looks like the list only ever shows one).
    function emptyAccountForm() {
      return { preset: 'qq', name: '', username: '', authCode: '', imapHost: PRESETS.qq.imapHost, imapPort: 993, smtpHost: PRESETS.qq.smtpHost, smtpPort: 465 };
    }

    // Module-level store survives MailPanel unmount/remount when the user
    // switches sidebar panels, so coming back never refetches everything.
    const PERSIST = {
      accounts: null,
      activeId: '',
      view: 'inbox',
      inboxFilter: 'all',
      messages: [],
      detail: null,
      form: null,
      compose: { to: '', subject: '', body: '' },
      loadedId: '',
      sent: [],
      contacts: [],
      contactForm: { name: '', email: '' },
      loadedIds: { inbox: '', sent: '', contacts: '' },
    };
    function usePersistent(key, initial) {
      // `!= null` treats both null and undefined as "not cached yet", so the
      // default object is used for keys like `form` that start as null.
      const [value, setValue] = useState(() => (PERSIST[key] != null ? PERSIST[key] : initial));
      const update = (next) => {
        const current = PERSIST[key] != null ? PERSIST[key] : value;
        const resolved = typeof next === 'function' ? next(current) : next;
        PERSIST[key] = resolved;
        setValue(resolved);
      };
      return [value, update];
    }

    // ---------------------------------------------------------------------
    // New-mail detection + system notification engine.
    // DSH has no dedicated toast service: like DSH itself and the pet plugin,
    // we use the browser Notification API. A single process-wide timer polls
    // every configured account via the existing listMessages op and compares
    // UID baselines; newly arrived messages raise a system notification. This
    // lives at module scope so it keeps working even while the mail panel is
    // closed, and is intentionally independent of MailPanel's React state.
    // ---------------------------------------------------------------------
    const NOTIFY = {
      ctx: null,
      disposeTimer: null,
      settings: { notifyEnabled: true, notifyInterval: 60, notifyMode: 'pet' },
      baselines: {},   // accountId -> array of last-seen uids
      busy: false,
      lastError: null, // last notification failure reason, surfaced in settings
      petId: null,     // cached desktop-pet instance id
      // Live diagnostics. The detection chain runs in the background with no UI,
      // so without this the user cannot tell a working poller from a dead one.
      diag: {
        running: false,   // is a poll timer armed?
        accounts: 0,      // accounts seen on the last check
        checks: 0,        // successful poll ticks
        alerts: 0,        // new-mail alerts fired
        lastCheck: 0,     // epoch ms of last successful poll
        lastAlert: 0,     // epoch ms of last alert
        error: null,      // last detection/delivery failure reason
      },
    };

    // Unread badge on the sidebar entry. Kept at module scope because the
    // shell renders Icon inside its own button (not as part of MailPanel), so
    // the badge must survive the panel being closed. The background poller
    // increments it; Icon subscribes; opening the panel clears it.
    const BADGE = {
      count: 0,
      listeners: new Set(),
      get() { return this.count; },
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
      emit() { for (const fn of this.listeners) { try { fn(this.count); } catch { /* dead listener */ } } },
      add(n) {
        n = Math.max(0, Number(n) || 0);
        if (!n) return;
        this.count += n;
        this.emit();
      },
      clear() {
        if (!this.count) return;
        this.count = 0;
        this.emit();
      },
    };

    // When the background poller detects new mail it publishes the affected
    // account ids plus the freshly seen messages, so an open MailPanel can
    // merge them into its list without re-running the same IMAP query.
    // Module scope because detection happens outside React, in the poller.
    const MAIL_EVENTS = {
      listeners: new Set(),
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
      emit(accountIds, freshByAccount) {
        for (const fn of this.listeners) {
          try { fn(accountIds, freshByAccount); } catch { /* dead listener */ }
        }
      },
    };

    // A mail that arrived while DSH was restarting must not be swallowed by
    // baseline seeding. On first sight we still alert on unseen messages whose
    // Date header is within this window.
    const RECENT_MAIL_MS = 3 * 60 * 1000;

    const PET_ROUTE = '/dsh-pet-7340';

    // The desktop pet exposes a same-origin prefix route on the DSH web server.
    // /state lists every pet instance under `pets`; pick the first one. Cached
    // because it rarely changes, but refreshed on a miss so a late pet works.
    async function resolvePetId() {
      if (NOTIFY.petId) return NOTIFY.petId;
      try {
        const r = await fetch(PET_ROUTE + '/state', { cache: 'no-store' });
        const data = await r.json();
        const pets = data && data.pets && typeof data.pets === 'object' ? data.pets : null;
        if (pets) {
          const ids = Object.keys(pets);
          if (ids.length > 0) { NOTIFY.petId = ids[0]; return NOTIFY.petId; }
        }
      } catch { /* pet not installed or route unavailable */ }
      return null;
    }

    // Feed a speech bubble to the desktop pet. `speak:true` asks the pet to
    // voice the line; surface=web works for the common web-displayed pet and
    // we fall back to `any` (bubble only) if the surface gate rejects us.
    async function announceViaPet(text) {
      const petId = await resolvePetId();
      if (!petId) return false;
      const post = async (surface) => {
        const body = { text, speak: true, anim: false, duration: 8000 };
        const r = await fetch(PET_ROUTE + '/broadcast?pet=' + encodeURIComponent(petId) + '&surface=' + surface, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        let ok = false;
        try { const d = await r.json(); ok = !!(d && d.ok); } catch { ok = r.ok; }
        return ok;
      };
      try {
        if (await post('web')) return true;
        if (await post('any')) return true;
      } catch { /* fall through */ }
      NOTIFY.petId = null; // force re-resolve next time (pet may have changed)
      return false;
    }

    function notifyPermission() {
      return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    }

    async function askNotifyPermission() {
      if (typeof Notification === 'undefined') return 'unsupported';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      try {
        return await Notification.requestPermission();
      } catch {
        return 'error';
      }
    }

    function showSystemToast(title, body, opts) {
      const perm = notifyPermission();
      if (perm !== 'granted') {
        NOTIFY.lastError = perm === 'unsupported' ? 'unsupported' : 'permission:' + perm;
        return null;
      }
      try {
        // For real new-mail alerts a stable tag coalesces bursts. Test
        // notifications pass a unique tag so a lingering toast never hides
        // them (a stale tagged notification is a common "nothing happened"
        // cause in Electron shells).
        const options = { body };
        const tag = opts && opts.tag;
        if (tag) options.tag = tag;
        const n = new Notification(title, options);
        n.onclick = () => {
          try { n.close(); } catch { /* already closed */ }
          try { window.focus(); } catch { /* headless */ }
          if (NOTIFY.ctx) {
            try { NOTIFY.ctx.get('layout').selectPanel('dsh-mail'); } catch { /* panel service unavailable */ }
          }
        };
        return n;
      } catch (e) {
        NOTIFY.lastError = 'construct: ' + (e && e.message ? e.message : String(e));
        return null;
      }
    }

    // Deliver a new-mail alert according to the configured mode.
    // Returns a short status string used by the test button for inline feedback.
    async function deliverAlert(title, body, opts) {
      const mode = (opts && opts.mode) || NOTIFY.settings.notifyMode || 'pet';
      let petOk = false;
      let sysOk = false;
      if (mode === 'pet' || mode === 'both') {
        petOk = await announceViaPet(body);
      }
      if (mode === 'system' || mode === 'both' || (mode === 'pet' && !petOk)) {
        // In pet mode, fall back to a system toast when the pet route is absent.
        const n = showSystemToast(title, body, opts);
        sysOk = !!n;
      }
      NOTIFY.lastError = (petOk || sysOk) ? null : 'no-channel';
      return { petOk, sysOk };
    }

    // Prefer the Cordis timer service; fall back to the browser timer so the
    // engine works in every client runtime variant.
    function armPoller(callback, delayMs) {
      const ctx = NOTIFY.ctx;
      let timer = ctx && ctx.timer;
      if ((!timer || typeof timer.interval !== 'function') && ctx && typeof ctx.get === 'function') {
        try { timer = ctx.get('timer'); } catch { timer = null; }
      }
      if (timer && typeof timer.interval === 'function') return timer.interval(callback, delayMs);
      // Last resort: plain browser timer (client halves expose setInterval).
      const id = setInterval(callback, delayMs);
      return () => clearInterval(id);
    }

    function stopPoller() {
      if (NOTIFY.disposeTimer) {
        try { NOTIFY.disposeTimer(); } catch { /* already disposed */ }
        NOTIFY.disposeTimer = null;
      }
      NOTIFY.diag.running = false;
    }

    function startPoller() {
      stopPoller();
      if (!NOTIFY.ctx || !NOTIFY.settings.notifyEnabled) {
        NOTIFY.diag.error = NOTIFY.ctx ? 'notifyEnabled=false' : 'no-ctx';
        return;
      }
      // A desktop-pet announcement needs no browser permission. Only the
      // pure "system notification" mode requires it; in that case start the
      // poller once permission is granted via the settings button.
      const mode = NOTIFY.settings.notifyMode || 'pet';
      if (mode === 'system' && notifyPermission() !== 'granted') {
        NOTIFY.diag.error = 'permission:' + notifyPermission();
        return;
      }
      const delayMs = Math.max(15, NOTIFY.settings.notifyInterval || 60) * 1000;
      // The Cordis timer service can throw on some runtime variants (wrong
      // signature, disposed context). Fall back to a browser timer instead of
      // letting the exception kill the whole poller — and, when called from
      // settings save(), falsely report the save as failed.
      try {
        NOTIFY.disposeTimer = armPoller(() => { void pollNewMail(); }, delayMs);
      } catch (e) {
        NOTIFY.diag.error = 'timer: ' + (e && e.message ? e.message : String(e));
        const id = setInterval(() => { void pollNewMail(); }, delayMs);
        NOTIFY.disposeTimer = () => clearInterval(id);
      }
      NOTIFY.diag.running = true;
      if (!NOTIFY.diag.error) NOTIFY.diag.error = null;
      void pollNewMail(); // seed baselines on start without spamming old mail
    }

    // Detect new mail and alert. Returns a diag snapshot so the "check now"
    // button can show what actually happened.
    async function pollNewMail() {
      if (NOTIFY.busy) return Object.assign({}, NOTIFY.diag);
      NOTIFY.busy = true;
      const changedAccounts = [];
      const freshByAccount = Object.create(null);
      try {
        const mode = NOTIFY.settings.notifyMode || 'pet';
        if (mode === 'system' && notifyPermission() !== 'granted') {
          NOTIFY.diag.error = 'permission:' + notifyPermission();
          return Object.assign({}, NOTIFY.diag);
        }
        const ar = await fetch(API, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'listAccounts' }),
        });
        const ad = await ar.json();
        if (!ad || ad.ok === false || !Array.isArray(ad.accounts)) {
          NOTIFY.diag.error = 'listAccounts:' + (ad && ad.error ? ad.error : 'bad-response');
          return Object.assign({}, NOTIFY.diag);
        }
        const accounts = ad.accounts;
        NOTIFY.diag.accounts = accounts.length;
        NOTIFY.diag.checks += 1;
        NOTIFY.diag.lastCheck = Date.now();
        NOTIFY.diag.error = null;
        const now = Date.now();
        // Check every account concurrently; previously a slow IMAP session on
        // one account delayed every other account's check behind it.
        await Promise.all(accounts.map(async acc => {
          try {
            const mr = await fetch(API, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ op: 'listMessages', id: acc.id, limit: 20 }),
            });
            const md = await mr.json();
            if (!md || md.ok === false || !Array.isArray(md.messages)) {
              NOTIFY.diag.error = 'listMessages:' + (acc.name || acc.id) + ':' + (md && md.error ? md.error : 'bad-response');
              return;
            }
            const uids = md.messages.map(m => String(m.uid));
            const prev = NOTIFY.baselines[acc.id];
            NOTIFY.baselines[acc.id] = uids;
            let fresh = [];
            if (!prev) {
              // First observation: normally seed only, but a mail that arrived
              // during a restart (unread + recent Date header) must still alert.
              fresh = md.messages.filter(m =>
                m && m.seen === false && m.date &&
                (now - Date.parse(m.date)) >= 0 &&
                (now - Date.parse(m.date)) <= RECENT_MAIL_MS
              );
            } else {
              const prevSet = new Set(prev);
              fresh = md.messages.filter(m => !prevSet.has(String(m.uid)));
            }
            if (fresh.length > 0) {
              const res = await deliverAlert(
                t('notifyTitle'),
                newMailAnnouncement(fresh),
                { tag: 'dsh-mail-new' }
              );
              NOTIFY.diag.alerts += 1;
              NOTIFY.diag.lastAlert = Date.now();
              BADGE.add(fresh.length);
              changedAccounts.push(acc.id);
              // Hand the list we already fetched to the open panel so it can
              // update in place instead of issuing a second listMessages.
              freshByAccount[acc.id] = md.messages;
              if (!res.petOk && !res.sysOk) NOTIFY.diag.error = 'deliver:' + (NOTIFY.lastError || 'no-channel');
            }
          } catch (e) {
            NOTIFY.diag.error = 'account:' + (acc.name || acc.id) + ':' + (e && e.message ? e.message : String(e));
          }
        }));
      } catch (e) {
        NOTIFY.diag.error = 'poll:' + (e && e.message ? e.message : String(e));
      } finally {
        NOTIFY.busy = false;
      }
      if (changedAccounts.length) MAIL_EVENTS.emit(changedAccounts, freshByAccount);
      return Object.assign({}, NOTIFY.diag);
    }

    async function refreshNotifySettings() {
      try {
        const r = await fetch(API, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'getSettings' }),
        });
        const data = await r.json();
        if (data && data.ok && data.settings) {
          NOTIFY.settings = {
            notifyEnabled: data.settings.notifyEnabled !== false,
            notifyInterval: Number(data.settings.notifyInterval) || 60,
            notifyMode: data.settings.notifyMode || 'pet',
          };
        }
      } catch { /* keep current settings */ }
      startPoller();
    }

    // Solid envelope for the sidebar panel icon. The sidebar owns the button
    // ([panelGlyph(our icon)] [panelTitle(label text)]); the label is a plain
    // string also used for aria-label, so we cannot inject a React node there.
    // Instead we mount a small unread dot imperatively as the LAST child of the
    // button, which renders it AFTER the label text in the expanded state (and
    // beside the icon when the sidebar is collapsed and has no text). A quiet
    // dot (no number) is the least intrusive unread cue and ages well.
    const BADGE_STYLE = {
      display: 'block', width: '7px', height: '7px', borderRadius: '50%',
      background: 'var(--dsw-alias-state-error-primary)',
      flex: 'none', alignSelf: 'center', marginLeft: '4px',
      boxShadow: '0 0 0 2px var(--dsw-alias-bg-base)',
    };
    function Icon(props) {
      const size = (props && props.size) || 20;
      const active = !!(props && props.active);
      const rootRef = useRef(null);
      const badgeRef = useRef(null);
      const [count, setCount] = useState(() => BADGE.get());
      useEffect(() => BADGE.subscribe(setCount), []);
      useEffect(() => () => {
        if (badgeRef.current && badgeRef.current.parentNode) badgeRef.current.parentNode.removeChild(badgeRef.current);
        badgeRef.current = null;
      }, []);
      useLayoutEffect(() => {
        const root = rootRef.current;
        // Find the owning sidebar button by structure, not by DSH's hashed
        // CSS-module class names. closest('button') tolerates any wrapper
        // elements that renderSlot/renderFactorySlot may insert.
        const button = root && root.closest && root.closest('button');
        if (!button) return;
        if (!count) {
          if (badgeRef.current && badgeRef.current.parentNode) badgeRef.current.parentNode.removeChild(badgeRef.current);
          badgeRef.current = null;
          return;
        }
        let badge = badgeRef.current;
        if (!badge || badge.parentNode !== button) {
          badge = document.createElement('span');
          badge.className = 'dsh-mail-sidebadge';
          badge.title = t('badgeTitle');
          Object.assign(badge.style, BADGE_STYLE);
          button.appendChild(badge);
          badgeRef.current = badge;
        }
        // Keep the count as accessible metadata (tooltip) but render only a dot.
        badge.title = t('badgeTitle') + ' (' + count + ')';
      });
      return h('span', { ref: rootRef, style: { display: 'inline-flex', alignItems: 'center', lineHeight: 0 } },
        h('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
          h('path', { fill: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor', d: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8.2L4.2 7h15.6L12 13.2zM4 8.3V17h16V8.3l-8 6.1-8-6.1z' })
        )
      );
    }

    // Stroke-style glyphs for in-panel navigation (unified icon language).
    const ICONS = {
      inbox: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 11v5h16v-5h-5a3 3 0 0 1-6 0H4z',
      sent: 'M21 3L3 10.5l7 2.5 2.5 7L21 3zM10 13l4-4',
      contacts: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M11 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.38M16 3.6a3.5 3.5 0 0 1 0 6.8',
      accounts: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 12c0-.4-.04-.8-.11-1.18l2.03-1.58-2-3.47-2.4.97a7 7 0 0 0-2.02-1.17L14.6 3h-4l-.3 2.57a7 7 0 0 0-2.03 1.17l-2.4-.97-2 3.47 2.03 1.58A8 8 0 0 0 6 12c0 .4.04.8.11 1.18l-2.03 1.58 2 3.47 2.4-.97c.62.51 1.3.9 2.02 1.17l.3 2.57h4l.31-2.57c.72-.27 1.4-.66 2.02-1.17l2.39.97 2-3.47-2.02-1.58c.07-.38.11-.78.11-1.18z',
      compose: 'M4 20h4l10.6-10.6a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 6.5l3 3',
      refresh: 'M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6',
      back: 'M15 18l-6-6 6-6',
      trash: 'M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7M10 11v6m4-6v6',
      mail: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm9 7L3.5 7.5h17L12 13z',
      user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
      users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M11 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
      check: 'M4 12l5 5L20 6',
      warning: 'M12 3L2 20h20L12 3zm0 6v5m0 3v.5',
      plus: 'M12 5v14M5 12h14',
      attach: 'M20 11.5l-8.2 8.2a4.5 4.5 0 0 1-6.4-6.4l8.5-8.5a3 3 0 0 1 4.3 4.3l-8.5 8.5a1.5 1.5 0 0 1-2.2-2.2l7.8-7.8',
      download: 'M12 4v11m0 0l-4-4m4 4l4-4M4 19h16',
      translate: 'M12.9 15L8 20l-4-5h3.1a7 7 0 0 0 1.4-4H4v-2h5.1A11 11 0 0 0 11 3h2c-.6 1.7-1.5 3.2-2.7 4.5A9 9 0 0 1 17 11h2.9l-4.3 4.3m-2-2.3c-.6-2.2-2-4-3.9-5.3A9 9 0 0 1 18 9',
    };
    function Ico(props) {
      // Rendered as a React component via h(Ico, { name, size }); the first
      // argument is a props object, not a positional name string.
      const name = (props && props.name) || 'mail';
      const size = (props && props.size) || 18;
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true,
        style: { display: 'block', flex: 'none', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
      }, h('path', { d: ICONS[name] || ICONS.mail }));
    }

    const AVATAR_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#e11d48'];
    function avatarColor(seed) {
      let hash = 0;
      const s = String(seed || '');
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
      return AVATAR_COLORS[hash % AVATAR_COLORS.length];
    }
    function avatarLetter(s) {
      const v = String(s || '').trim();
      return v ? v.charAt(0).toUpperCase() : '?';
    }
    // The local label shown for an account defaults to the part before "@", so
    // a fresh mailbox reads as "1101522940" instead of a generic "QQ邮箱" or a
    // guessed display name the user never chose.
    function defaultAccountName(username) {
      const v = String(username || '').trim();
      if (!v) return '';
      const at = v.indexOf('@');
      return at > 0 ? v.slice(0, at) : v;
    }
    // Split a raw address header ("李文" <li@x.com>, "b@y.com") into the parts a
    // contact needs. Accepts the first address only, which is what a sender or a
    // single recipient field carries in practice.
    function parseAddress(raw) {
      const s = String(raw || '').trim();
      if (!s) return null;
      const angled = s.match(/^(.*?)<([^<>]+)>/);
      const name = angled ? String(angled[1] || '').trim().replace(/^["']|["']$/g, '').trim() : '';
      const email = String(angled ? angled[2] : s).trim().replace(/^["']|["']$/g, '');
      if (!email || email.indexOf('@') < 1) return null;
      return { name, email: email.toLowerCase() };
    }
    // Resolve a human-friendly sender name for the spoken alert: prefer the
    // display name in the From header, then a locally saved contact, then the
    // address local-part. Never fall back to the account's own name.
    function senderName(raw) {
      const addr = parseAddress(raw);
      if (!addr) {
        const s = String(raw || '').replace(/<.*>/, '').trim();
        return s || t('notifyUnknownSender');
      }
      if (addr.name) return addr.name.trim();
      const contact = (PERSIST.contacts || []).find(c => String(c.email || '').trim().toLowerCase() === addr.email);
      if (contact && contact.name) return String(contact.name).trim();
      return addr.email.split('@')[0] || t('notifyUnknownSender');
    }
    // Fixed, readable voice line: only WHO sent and HOW MANY. The subject and
    // the mailbox account name are deliberately never spoken.
    function newMailAnnouncement(fresh) {
      const list = Array.isArray(fresh) ? fresh : [];
      const names = [];
      list.forEach(m => {
        const n = senderName(m && m.from);
        if (names.indexOf(n) < 0) names.push(n);
      });
      const count = list.length;
      if (names.length === 1) {
        const key = count === 1 ? 'notifyAnnounceOne' : 'notifyAnnounceMany';
        return t(key).replace('{name}', names[0]).replace('{n}', String(count));
      }
      return t('notifyAnnounceGeneric').replace('{n}', String(count));
    }
    function fmtDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16);
      const now = new Date();
      const hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      if (d.toDateString() === now.toDateString()) return hh;
      if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
      return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
    }

    function fmtSize(bytes) {
      const n = Number(bytes) || 0;
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
      return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // The Host half buffers the whole bridge reply, so keep one attachment under
    // this cap; the send path enforces a 25 MB total for the same reason.
    const MAX_ATTACH_BYTES = 25 * 1024 * 1024;

    function readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          resolve(comma === -1 ? result : result.slice(comma + 1));
        };
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.readAsDataURL(file);
      });
    }

    function saveAttachmentBytes(name, mime, base64) {
      // Decode base64 to bytes, then hand the browser a Blob download. This keeps
      // the file binary-exact and never goes through the network again.
      const bin = atob(base64 || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    function Loading(props) {
      // Rendered as a React component via h(Loading), so the first argument is
      // a props object ({} when none is passed) — never treat it as a string.
      const label = (props && typeof props.label === 'string' && props.label) || t('loading');
      return h('div', { className: 'dsh-mail-loading' },
        h('div', { className: 'dsh-mail-spinner' }),
        h('span', null, label)
      );
    }

    function Empty({ icon, title, sub }) {
      return h('div', { className: 'dsh-mail-empty' },
        h('div', { className: 'dsh-mail-emptyicon' }, h(Ico, { name: icon, size: 26 })),
        h('div', { className: 'dsh-mail-emptytitle' }, title),
        sub ? h('div', { className: 'dsh-mail-emptysub' }, sub) : null
      );
    }

    function MailPanel() {
      const [accounts, setAccounts] = usePersistent('accounts', null);
      const [activeId, setActiveId] = usePersistent('activeId', '');
      const [view, setView] = usePersistent('view', 'inbox');
      const [inboxFilter, setInboxFilter] = usePersistent('inboxFilter', 'all');
      const [messages, setMessages] = usePersistent('messages', []);
      const [detail, setDetail] = usePersistent('detail', null);
      // Translated body for the currently open message. Kept out of PERSIST:
      // translations are disposable and never written to profile storage.
      const [translatedText, setTranslatedText] = useState(null);
      const [translating, setTranslating] = useState(false);
      const [busy, setBusy] = useState(false);
      const [loadingMessages, setLoadingMessages] = useState(false);
      const [loadingSent, setLoadingSent] = useState(false);
      const [loadingContacts, setLoadingContacts] = useState(false);
      const [refreshState, setRefreshState] = useState('idle'); // idle | loading | ok | error
      const refreshTimerRef = useRef(null);
      // In-flight dedupe must survive re-renders; a plain let would reset every
      // time React re-rendered the panel and allow duplicate IMAP sessions.
      const inflightRef = useRef({ messages: null, sent: null, contacts: null });
      const [flash, setFlash] = useState(null);
      const [form, setForm] = usePersistent('form', emptyAccountForm());
      // Credential-vault bridge (no-op if the vault plugin is not installed).
      const vaultClientRef = useRef(null);
      if (!vaultClientRef.current) vaultClientRef.current = createVaultV1Client({ callerId: 'dsh-mail' });
      const [vaultOpen, setVaultOpen] = useState(false);
      const [vaultEntries, setVaultEntries] = useState(null);
      const [vaultBusy, setVaultBusy] = useState(false);
      async function openVaultPicker() {
        setVaultOpen(true);
        setVaultEntries(null);
        setVaultBusy(true);
        try {
          const list = await vaultClientRef.current.query({ category: 'account', limit: 100 });
          setVaultEntries(list);
        } catch (e) {
          setVaultEntries([]);
        } finally {
          setVaultBusy(false);
        }
      }
      function pickVaultSecret(entry) {
        const value = vaultClientRef.current.secretOf(entry);
        setForm(function (f) { return Object.assign({}, f, { authCode: value }); });
        setVaultOpen(false);
        notify('success', t('saved'));
      }
      const [compose, setCompose] = usePersistent('compose', { to: '', subject: '', body: '' });
      // Outgoing attachments live in React state (not PERSIST): they hold base64
      // file bytes, which must not be written to profile storage.
      const [composeAtts, setComposeAtts] = useState([]);
      const [attachBusy, setAttachBusy] = useState(false);
      // Received attachments are fetched on demand from the mail server.
      const [attachState, setAttachState] = useState({});
      const [dropOver, setDropOver] = useState(false);
      const [sent, setSent] = usePersistent('sent', []);
      const [contacts, setContacts] = usePersistent('contacts', []);
      const [contactForm, setContactForm] = usePersistent('contactForm', { name: '', email: '' });
      const [sentDetail, setSentDetail] = useState(null);
      // Per-account cache of fetched message lists. Survives account switching
      // and remounts so we can show cached mail immediately while refreshing.
      const [cache, setCache] = usePersistent('mailCache', {});
      // Inline rename: the account id being edited plus the draft label.
      const [renameId, setRenameId] = useState('');
      const [renameDraft, setRenameDraft] = useState('');

      // Keep a fresh handler so the mail-event subscription never sees stale
      // activeId/view. New mail on the currently open account refreshes the
      // inbox list in place (silent, no spinner/flash).
      const onMailRef = useRef(() => {});
      onMailRef.current = (accountIds, freshByAccount) => {
        if (!activeId || view !== 'inbox') return;
        if (Array.isArray(accountIds) && accountIds.length && accountIds.indexOf(activeId) === -1) return;
        // The poller already fetched this account's list to detect the new
        // mail. Merge any new UIDs straight into state/cache instead of
        // opening a second IMAP session for the same data.
        const polled = freshByAccount && freshByAccount[activeId];
        const current = cache[activeId] || messages || [];
        if (Array.isArray(polled) && current.length) {
          const seen = new Set(current.map(m => String(m.uid)));
          const added = polled.filter(m => !seen.has(String(m.uid)));
          if (added.length) {
            const merged = added.concat(current);
            setMessages(merged);
            setCache(prev => Object.assign({}, prev, { [activeId]: merged }));
          }
          return;
        }
        void loadMessages(false);
      };

      useEffect(() => {
        if (!PERSIST.accounts) refreshAccounts();
        const off = MAIL_EVENTS.subscribe((ids, freshByAccount) => onMailRef.current(ids, freshByAccount));
        return () => {
          off();
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
      }, []);

      function notify(kind, text) {
        setFlash({ kind, text });
      }

      function reportError(e) {
        notify('error', e && e.info ? friendlyError(e.info) : (e && e.message ? e.message : t('errGeneric')));
      }

      async function rpc(op, extra) {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ op }, extra || {})),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          const err = new Error(data.error || ('HTTP ' + res.status));
          err.info = data;
          throw err;
        }
        return data;
      }

      // Account labels are set by the user, not guessed from mail headers: a
      // mailbox's own display name is only visible after signing in to the
      // provider, so any guess is unreliable. The default label is the mailbox
      // prefix and this just persists whatever the user prefers.
      async function renameAccount(id, name) {
        const next = String(name == null ? '' : name).trim();
        if (!next) return false;
        try {
          const data = await rpc('renameAccount', { id, name: next });
          if (data && data.account) {
            setAccounts(prev => (prev || []).map(a => a.id === data.account.id ? Object.assign({}, a, { name: data.account.name }) : a));
          }
          return true;
        } catch (e) {
          reportError(e);
          return false;
        }
      }

      function startRename(account) {
        setRenameId(account.id);
        setRenameDraft(account.name || defaultAccountName(account.username));
      }

      function cancelRename() {
        setRenameId('');
        setRenameDraft('');
      }

      async function commitRename(id) {
        const name = String(renameDraft || '').trim();
        if (!name) { cancelRename(); return; }
        setBusy(true);
        try {
          const ok = await renameAccount(id, name);
          if (ok) { notify('success', t('saved')); cancelRename(); }
        } finally {
          setBusy(false);
        }
      }

      async function refreshAccounts() {
        try {
          const data = await rpc('listAccounts');
          setAccounts(data.accounts || []);
          if (!activeId && data.accounts && data.accounts.length) setActiveId(data.accounts[0].id);
        } catch (e) {
          reportError(e);
        }
      }

      async function loadMessages(showProgress) {
        if (!activeId) return false;
        // Collapse overlapping refreshes (account switch vs. new-mail event)
        // into one request per account instead of opening duplicate sessions.
        const inflight = inflightRef.current;
        if (inflight.messages && inflight.messages.id === activeId) return inflight.messages.promise;
        // Cache-first: if we already have this account's list, keep it visible
        // while the fresh list loads in the background (no blank/Loading flash).
        const cached = cache[activeId];
        if (showProgress !== false) setLoadingMessages(!(cached && cached.length));
        const id = activeId;
        const promise = (async () => {
          try {
            const data = await rpc('listMessages', { id, limit: 25 });
            const fresh = data.messages || [];
            setMessages(fresh);
            setCache(prev => Object.assign({}, prev, { [id]: fresh }));
            return true;
          } catch (e) {
            reportError(e);
            return false;
          } finally {
            setLoadingMessages(false);
          }
        })();
        inflight.messages = { id, promise };
        try {
          return await promise;
        } finally {
          if (inflight.messages && inflight.messages.id === id) inflight.messages = null;
        }
      }

      async function loadSent() {
        if (!activeId) return false;
        const inflight = inflightRef.current;
        if (inflight.sent && inflight.sent.id === activeId) return inflight.sent.promise;
        setBusy(true);
        setLoadingSent(true);
        const id = activeId;
        const promise = (async () => {
          try {
            const data = await rpc('sentMessages', { id });
            setSent(data.sent || []);
            return true;
          } catch (e) {
            reportError(e);
            return false;
          } finally {
            setLoadingSent(false);
            setBusy(false);
          }
        })();
        inflight.sent = { id, promise };
        try {
          return await promise;
        } finally {
          if (inflight.sent && inflight.sent.id === id) inflight.sent = null;
        }
      }

      async function loadContacts() {
        if (!activeId) return false;
        const inflight = inflightRef.current;
        if (inflight.contacts && inflight.contacts.id === activeId) return inflight.contacts.promise;
        setBusy(true);
        setLoadingContacts(true);
        const id = activeId;
        const promise = (async () => {
          try {
            const data = await rpc('listContacts', { id });
            setContacts(data.contacts || []);
            return true;
          } catch (e) {
            reportError(e);
            return false;
          } finally {
            setLoadingContacts(false);
            setBusy(false);
          }
        })();
        inflight.contacts = { id, promise };
        try {
          return await promise;
        } finally {
          if (inflight.contacts && inflight.contacts.id === id) inflight.contacts = null;
        }
      }

      // Only (re)load the list when the ACCOUNT actually changes — never on
      // view changes (inbox→detail→inbox), so entering a mail no longer blanks
      // it and returning does not refetch. PERSIST.loadedIds guards remounts.
      useEffect(() => {
        if (!activeId) {
          setMessages([]);
          setSent([]);
          setContacts([]);
          setDetail(null);
          PERSIST.loadedIds = { inbox: '', sent: '', contacts: '' };
          return;
        }
        if (PERSIST.loadedIds.inbox !== activeId) {
          // Show this account's cached messages immediately, then refresh in
          // the background. Only clear when there is no cache for the account.
          const cached = cache[activeId];
          setMessages(cached || []);
          setSent([]);
          setContacts([]);
          setDetail(null);
          PERSIST.loadedIds = { inbox: activeId, sent: '', contacts: '' };
          loadMessages();
        }
      }, [activeId]);

      function applyPreset(preset) {
        const p = PRESETS[preset] || PRESETS.custom;
        setForm(Object.assign({}, form, {
          preset,
          imapHost: p.imapHost,
          imapPort: p.imapPort,
          smtpHost: p.smtpHost,
          smtpPort: p.smtpPort,
        }));
      }

      async function saveAccount() {
        setBusy(true);
        try {
          await rpc('saveAccount', {
            name: String(form.name || '').trim() || defaultAccountName(form.username),
            username: form.username,
            authCode: form.authCode,
            imapHost: form.imapHost,
            imapPort: Number(form.imapPort),
            smtpHost: form.smtpHost,
            smtpPort: Number(form.smtpPort),
          });
          notify('success', t('ok'));
          // Reset the WHOLE form, not just authCode: the account id is the
          // hash of the username, so keeping the old username would make the
          // next account overwrite this one.
          setForm(emptyAccountForm());
          await refreshAccounts();
          setView('inbox');
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function testAccount(id) {
        setBusy(true);
        try {
          const data = await rpc('testAccount', { id });
          notify(data.ok ? 'success' : 'error', data.ok ? t('ok') : friendlyError(data));
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function deleteAccount(id) {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm(t('confirmDelete'))) return;
        setBusy(true);
        try {
          await rpc('deleteAccount', { id });
          if (activeId === id) setActiveId('');
          await refreshAccounts();
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function openMessage(msg) {
        const uid = typeof msg === 'object' ? msg.uid : msg;
        // Mark as read locally right away: update the visible list, the unread
        // badge, and the per-account cache so the change survives switching away.
        const markRead = (list) => (list || []).map(m => String(m.uid) === String(uid) ? Object.assign({}, m, { seen: true }) : m);
        setMessages(prev => markRead(prev));
        setCache(prev => Object.assign({}, prev, { [activeId]: markRead(prev[activeId]) }));
        BADGE.clear();
        setBusy(true);
        try {
          const data = await rpc('getMessage', { id: activeId, uid });
          const full = data.message || data;
          setDetail(Object.assign({}, full, { seen: true }));
          setTranslatedText(null);
          setView('detail');
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      // Translate the currently open message through the Host's `translate`
      // op. Prefer the plain-text part; fall back to stripping tags from the
      // sanitized HTML when the mail is HTML-only.
      async function translateMessage() {
        if (!detail || translating) return;
        const source = typeof detail.body === 'string' && detail.body.trim()
          ? detail.body
          : htmlToText(detail.html);
        if (!source.trim()) {
          notify('error', t('translateFailed') + t('errGeneric'));
          return;
        }
        setTranslating(true);
        try {
          const data = await rpc('translate', { text: source, targetLanguage: 'zh-CN' });
          setTranslatedText(String(data.text || ''));
        } catch (e) {
          const code = e && e.info && e.info.code;
          if (code === 'TRANSLATION_UNAVAILABLE') {
            notify('error', t('translateUnavailable'));
          } else if (code === 'TRANSLATION_TEXT_LIMIT') {
            notify('error', t('translateTextLimit'));
          } else {
            notify('error', t('translateFailed') + (e && e.message ? e.message : t('errGeneric')));
          }
        } finally {
          setTranslating(false);
        }
      }

      async function sendMail() {
        setBusy(true);
        try {
          await rpc('sendMessage', {
            id: activeId,
            to: compose.to,
            subject: compose.subject,
            body: compose.body,
            attachments: composeAtts.map(a => ({ name: a.name, mime: a.mime, content: a.content })),
          });
          notify('success', t('ok'));
          setCompose({ to: '', subject: '', body: '' });
          setComposeAtts([]);
          await loadSent();
          setView('sent');
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function addAttachments(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setAttachBusy(true);
        try {
          const next = composeAtts.slice();
          for (const file of files) {
            if (next.some(a => a.name === file.name && a.size === file.size)) continue; // 去重同一个文件
            if (file.size > MAX_ATTACH_BYTES) {
              notify('error', t('attachmentTooLarge'));
              continue;
            }
            const content = await readFileAsBase64(file);
            next.push({ name: file.name, size: file.size, mime: file.type || '', content });
          }
          const total = next.reduce((sum, a) => sum + (Number(a.size) || 0), 0);
          if (total > MAX_ATTACH_BYTES) {
            // 超限时整体拒绝，避免用户以为附件已带上却发送失败。
            notify('error', t('attachmentTooLarge'));
          } else {
            setComposeAtts(next);
          }
        } catch (e) {
          notify('error', t('attachmentFailed') + (e && e.message ? e.message : ''));
        } finally {
          setAttachBusy(false);
        }
      }

      function removeAttachment(index) {
        setComposeAtts(prev => prev.filter((_, i) => i !== index));
      }

      async function downloadAttachment(att) {
        if (!detail || !activeId) return;
        const key = String(att.index);
        setAttachState(prev => Object.assign({}, prev, { [key]: 'loading' }));
        try {
          const data = await rpc('getAttachment', { id: activeId, uid: detail.uid, index: att.index });
          saveAttachmentBytes(data.name || att.name, data.mime || att.mime, data.content);
          setAttachState(prev => Object.assign({}, prev, { [key]: 'ok' }));
        } catch (e) {
          setAttachState(prev => Object.assign({}, prev, { [key]: 'error' }));
          reportError(e);
        }
      }

      // Turn a raw address header ("李文" <li@x.com>) into a contact without
      // leaving the mail. An entry that already exists is reported instead of
      // being duplicated, since saveContact would otherwise just overwrite it.
      function contactKnown(email) {
        const key = String(email || '').toLowerCase();
        if (!key) return false;
        return (contacts || []).some(c => String(c.email || '').toLowerCase() === key);
      }

      async function addAsContact(raw) {
        const parsed = parseAddress(raw);
        if (!parsed) {
          notify('error', t('emailRequired'));
          return false;
        }
        if (!activeId) return false;
        if (contactKnown(parsed.email)) {
          notify('info', t('contactExists'));
          return false;
        }
        setBusy(true);
        try {
          const data = await rpc('saveContact', { id: activeId, email: parsed.email, name: parsed.name });
          if (Array.isArray(data.contacts)) setContacts(data.contacts);
          notify('success', t('contactAdded'));
          return true;
        } catch (e) {
          reportError(e);
          return false;
        } finally {
          setBusy(false);
        }
      }

      async function saveContact() {
        const email = String(contactForm.email || '').trim();
        if (!email || !email.includes('@')) {
          notify('error', t('emailRequired'));
          return;
        }
        setBusy(true);
        try {
          const data = await rpc('saveContact', { id: activeId, email, name: contactForm.name });
          setContactForm({ name: '', email: '' });
          if (Array.isArray(data.contacts)) setContacts(data.contacts);
          notify('success', t('saved'));
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function deleteContact(email) {
        setBusy(true);
        const next = contacts.filter(c => String(c.email).toLowerCase() !== String(email).toLowerCase());
        setContacts(next);
        try {
          const data = await rpc('deleteContact', { id: activeId, email });
          if (Array.isArray(data.contacts)) setContacts(data.contacts);
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function refreshCurrent() {
        if (!activeId || refreshState === 'loading') return;
        setRefreshState('loading');
        // Clear any previous terminal state timer so a new click starts clean.
        if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
        let ok = false;
        try {
          if (view === 'sent') ok = await loadSent();
          else if (view === 'contacts') ok = await loadContacts();
          else ok = await loadMessages();
        } catch (e) {
          reportError(e);
          ok = false;
        }
        // Tie the spinner result to the actual outcome, then revert to idle.
        setRefreshState(ok ? 'ok' : 'error');
        refreshTimerRef.current = setTimeout(() => {
          setRefreshState('idle');
          refreshTimerRef.current = null;
        }, 1400);
      }

      function composeTo(email) {
        setCompose(Object.assign({}, compose, { to: email }));
        setView('compose');
      }

      const account = (accounts || []).find(a => a.id === activeId);
      const unread = (messages || []).filter(m => m && m.seen === false).length;
      const readCount = (messages || []).length - unread;
      const filters = [
        { key: 'all', label: t('filterAll'), count: (messages || []).length },
        { key: 'unread', label: t('filterUnread'), count: unread },
        { key: 'read', label: t('filterRead'), count: readCount },
      ];
      const filteredMessages = inboxFilter === 'unread'
        ? (messages || []).filter(m => m && m.seen === false)
        : inboxFilter === 'read'
          ? (messages || []).filter(m => m && m.seen !== false)
          : (messages || []);
      const tabs = [
        { key: 'inbox', icon: 'inbox', label: t('inbox'), badge: unread },
        { key: 'sent', icon: 'sent', label: t('sent') },
        { key: 'contacts', icon: 'users', label: t('contacts') },
        { key: 'accounts', icon: 'accounts', label: t('accounts') },
      ];
      const isList = view === 'inbox' || view === 'sent' || view === 'contacts' || view === 'accounts';

      function navTo(key) {
        setSentDetail(null);
        setView(key);
        // Sent/contacts are loaded on demand (first visit after an account
        // switch), so opening the mail panel no longer waits on three IMAP
        // sessions at once. Guard with PERSIST.loadedIds to avoid refetching
        // on every tab click or remount.
        if (key === 'sent' && activeId && PERSIST.loadedIds.sent !== activeId) {
          PERSIST.loadedIds.sent = activeId;
          loadSent();
        } else if (key === 'contacts' && activeId && PERSIST.loadedIds.contacts !== activeId) {
          PERSIST.loadedIds.contacts = activeId;
          loadContacts();
        }
      }

      return h('div', { className: 'dsh-mail' },
        h('style', null, CSS),
        (loadingMessages || loadingSent || loadingContacts) && h('div', { className: 'dsh-mail-progress' }),

        // Brand header + primary action
        h('div', { className: 'dsh-mail-topbar' },
          h('div', { className: 'dsh-mail-brand' },
            h('div', { className: 'dsh-mail-brandmark' }, h(Ico, { name: 'mail', size: 18 })),
            h('div', null, t('label'), h('div', { className: 'dsh-mail-brandsub' }, t('note').slice(0, 0) || 'IMAP / SMTP'))
          ),
          h('span', { className: 'dsh-mail-spacer' }),
          h('button', {
            className: 'dsh-mail-btn dsh-mail-btn-primary',
            onClick: () => navTo('compose'),
            disabled: !activeId || view === 'compose',
          }, h(Ico, { name: 'compose', size: 15 }), t('compose'))
        ),

        // Segmented navigation
        h('div', { className: 'dsh-mail-tabs' },
          tabs.map(tab => h('button', {
            key: tab.key,
            className: 'dsh-mail-tab' + (view === tab.key ? ' is-active' : ''),
            onClick: () => navTo(tab.key),
          },
            h(Ico, { name: tab.icon, size: 16 }),
            h('span', null, tab.label),
            tab.badge > 0 ? h('span', { className: 'dsh-mail-badge' }, tab.badge) : null
          ))
        ),

        flash && h('div', { className: 'dsh-mail-flash ' + (flash.kind === 'error' ? 'dsh-mail-flash-error' : (flash.kind === 'info' ? 'dsh-mail-flash-info' : 'dsh-mail-flash-success')) },
          h(Ico, { name: flash.kind === 'error' ? 'warning' : (flash.kind === 'info' ? 'inbox' : 'check'), size: 15 }),
          h('span', null, flash.text)
        ),

        // Account switcher + contextual refresh, shown on data views
        isList && view !== 'accounts' && h('div', { className: 'dsh-mail-accountbar' },
          h(Ico, { name: 'user', size: 15 }),
          accounts && accounts.length > 0
            ? h('select', { className: 'dsh-mail-select', value: activeId, onChange: e => setActiveId(e.target.value) },
              accounts.map(a => h('option', { key: a.id, value: a.id }, a.name + ' · ' + a.username)))
            : h('span', { className: 'dsh-mail-hint' }, t('noAccounts')),
          h('span', { className: 'dsh-mail-spacer' }),
          h('button', {
            className: 'dsh-mail-btn dsh-mail-iconbtn' + (refreshState === 'ok' ? ' dsh-mail-refresh-ok' : refreshState === 'error' ? ' dsh-mail-refresh-err' : ''),
            onClick: refreshCurrent,
            disabled: !activeId || busy || refreshState === 'loading',
            title: refreshState === 'loading' ? t('refreshing') : refreshState === 'ok' ? t('refreshed') : refreshState === 'error' ? t('refreshFailed') : t('refresh'),
            'aria-label': refreshState === 'loading' ? t('refreshing') : t('refresh'),
          }, h('span', { className: refreshState === 'loading' ? 'dsh-mail-spinicon' : '', style: { display: 'inline-flex' } },
            h(Ico, { name: refreshState === 'ok' ? 'check' : refreshState === 'error' ? 'warning' : 'refresh', size: 15 })))
        ),

        /* ------------------------------- INBOX ------------------------------ */
        view === 'inbox' && h('div', { className: 'dsh-mail-view' },
          !activeId
            ? h(Empty, { icon: 'user', title: t('accounts'), sub: t('noAccounts') })
            : h('div', { className: 'dsh-mail-filterbar' }, filters.map(f =>
                h('button', {
                  key: f.key,
                  className: 'dsh-mail-filter' + (inboxFilter === f.key ? ' is-active' : ''),
                  onClick: () => setInboxFilter(f.key),
                },
                  f.label,
                  h('span', { className: 'dsh-mail-filtercount' }, f.count)
                )
              )),
          !activeId
            ? null
            : (loadingMessages && messages.length === 0)
              ? h(Loading)
              : (filteredMessages.length === 0)
                ? h(Empty, { icon: 'inbox', title: t('inbox'), sub: inboxFilter === 'all' ? t('noMessages') : t('noFiltered') })
                : h('div', { className: 'dsh-mail-list' }, filteredMessages.map(m =>
                  h('div', {
                    key: m.uid,
                    className: 'dsh-mail-row' + (m.seen === false ? ' is-unread' : ' dsh-mail-read'),
                    onClick: () => openMessage(m),
                  },
                    h('div', { className: 'dsh-mail-avatar', style: { background: avatarColor(m.from || m.subject) } }, avatarLetter(m.from || m.subject)),
                    h('div', { className: 'dsh-mail-rowmain' },
                      h('div', { className: 'dsh-mail-rowtop' },
                        h('span', { className: 'dsh-mail-from' }, String(m.from || '').replace(/<.*>/, '').trim() || m.from || ''),
                        h('span', { className: 'dsh-mail-time' }, fmtDate(m.date))
                      ),
                      h('div', { className: 'dsh-mail-subject' }, m.subject || t('noSubject')),
                      h('div', { className: 'dsh-mail-preview' }, m.snippet || '')
                    ),
                    m.seen === false ? h('span', { className: 'dsh-mail-unread', title: t('inbox') }) : null
                  )
                ))
        ),

        /* -------------------------------- SENT ------------------------------ */
        view === 'sent' && h('div', { className: 'dsh-mail-view' },
          sentDetail
            ? h('div', { className: 'dsh-mail-scroll' },
              h('button', { className: 'dsh-mail-btn', onClick: () => setSentDetail(null) }, h(Ico, { name: 'back', size: 15 }), t('back')),
              h('div', { className: 'dsh-mail-detailhead' },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  h('h2', { className: 'dsh-mail-detailtitle' }, sentDetail.subject || t('noSubject')),
                  parseAddress(sentDetail.to)
                    ? h('button', {
                        className: 'dsh-mail-btn' + (contactKnown(parseAddress(sentDetail.to).email) ? ' is-done' : ''),
                        'data-testid': 'add-recipient',
                        onClick: () => addAsContact(sentDetail.to),
                        disabled: busy,
                        title: t('addRecipient'),
                      }, h(Ico, { name: contactKnown(parseAddress(sentDetail.to).email) ? 'check' : 'plus', size: 14 }), t('addRecipient'))
                    : null
                ),
                h('div', { className: 'dsh-mail-detailmeta' }, t('to') + ': ' + (sentDetail.to || '') + ' · ' + fmtDate(sentDetail.date))
              ),
              h('div', { className: 'dsh-mail-mailbody', style: { whiteSpace: 'pre-wrap' } }, String(sentDetail.body || '')),
              // Sent mail keeps attachment metadata only (names/sizes), which is
              // enough to confirm what went out with the message.
              Array.isArray(sentDetail.attachments) && sentDetail.attachments.length > 0
                ? h('div', { className: 'dsh-mail-field', style: { marginTop: 14 } },
                    h('span', { className: 'dsh-mail-label' }, t('attachments') + ' (' + sentDetail.attachments.length + ')'),
                    h('div', { className: 'dsh-mail-attachlist' }, sentDetail.attachments.map((att, i) =>
                      h('div', { key: String(att.name) + i, className: 'dsh-mail-attach' },
                        h(Ico, { name: 'attach', size: 14 }),
                        h('span', { className: 'dsh-mail-attach-name', title: att.name }, att.name),
                        att.size ? h('span', { className: 'dsh-mail-attach-size' }, fmtSize(att.size)) : null
                      )
                    ))
                  )
                : null
            )
            : h('div', { className: 'dsh-mail-view' },
              loadingSent && sent.length === 0
                ? h(Loading)
                : (sent.length === 0)
                  ? h(Empty, { icon: 'sent', title: t('sent'), sub: t('noSent') })
                  : h('div', { className: 'dsh-mail-list' }, sent.map(m =>
                    h('div', { key: m.id, className: 'dsh-mail-row dsh-mail-read', onClick: () => setSentDetail(m) },
                      h('div', { className: 'dsh-mail-avatar', style: { background: avatarColor(m.to || m.subject) } }, avatarLetter(m.to || m.subject)),
                      h('div', { className: 'dsh-mail-rowmain' },
                        h('div', { className: 'dsh-mail-rowtop' },
                          h('span', { className: 'dsh-mail-from' }, t('to') + ': ' + (m.to || '')),
                          h('span', { className: 'dsh-mail-time' }, fmtDate(m.date))
                        ),
                        h('div', { className: 'dsh-mail-subject' }, m.subject || t('noSubject')),
                        h('div', { className: 'dsh-mail-preview' }, m.body || '')
                      )
                    )
                  ))
            )
        ),

        /* ------------------------------ CONTACTS ---------------------------- */
        view === 'contacts' && h('div', { className: 'dsh-mail-view' },
          h('div', { className: 'dsh-mail-scroll' },
            h('div', { className: 'dsh-mail-card' },
              h('div', { className: 'dsh-mail-cardhead' }, h(Ico, { name: 'user', size: 16 }), t('addContact')),
              h('div', { className: 'dsh-mail-hint', style: { marginBottom: 12 } }, t('contactsHint')),
              h('div', { className: 'dsh-mail-grid' },
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('contactName')),
                  h('input', { className: 'dsh-mail-input', value: contactForm.name, placeholder: t('contactName'), onChange: e => setContactForm(Object.assign({}, contactForm, { name: e.target.value })) })
                ),
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('contactEmail')),
                  h('input', { className: 'dsh-mail-input', value: contactForm.email, placeholder: 'friend@example.com', onChange: e => setContactForm(Object.assign({}, contactForm, { email: e.target.value })) })
                )
              ),
              h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: saveContact, disabled: busy || !contactForm.email }, h(Ico, { name: 'check', size: 15 }), t('saveContact'))
            ),
            loadingContacts && contacts.length === 0
              ? h(Loading)
              : (contacts.length === 0)
                ? h(Empty, { icon: 'users', title: t('contacts'), sub: t('noContacts') })
                : h('div', null, contacts.map(c =>
                  h('div', { key: c.email, className: 'dsh-mail-card', style: { padding: '12px 14px' } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                      h('div', { className: 'dsh-mail-avatar', style: { width: 32, height: 32, fontSize: 13, background: avatarColor(c.email) } }, avatarLetter(c.name || c.email)),
                      h('div', { style: { flex: 1, minWidth: 0 } },
                        h('div', { style: { fontWeight: 600 } }, c.name || c.email),
                        c.name ? h('div', { className: 'dsh-mail-hint' }, c.email) : null
                      ),
                      h('button', { className: 'dsh-mail-btn', onClick: () => composeTo(c.email) }, h(Ico, { name: 'compose', size: 14 }), t('selectContact')),
                      h('button', { className: 'dsh-mail-btn dsh-mail-iconbtn dsh-mail-btn-danger', onClick: () => deleteContact(c.email), disabled: busy, title: t('deleteContact') }, h(Ico, { name: 'trash', size: 14 }))
                    )
                  )
                ))
          )
        ),

        /* ------------------------------- ACCOUNTS --------------------------- */
        view === 'accounts' && h('div', { className: 'dsh-mail-view' },
          h('div', { className: 'dsh-mail-scroll' },
            (accounts || []).map(a => h('div', { key: a.id, className: 'dsh-mail-card' },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } },
                h('div', { className: 'dsh-mail-avatar', style: { background: avatarColor(a.username) } }, avatarLetter(a.name || a.username)),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  renameId === a.id
                    ? h('input', {
                        className: 'dsh-mail-input',
                        'data-testid': 'rename-input',
                        value: renameDraft,
                        autoFocus: true,
                        placeholder: defaultAccountName(a.username),
                        onChange: e => setRenameDraft(e.target.value),
                        onKeyDown: e => { if (e.key === 'Enter') commitRename(a.id); if (e.key === 'Escape') cancelRename(); },
                      })
                    : h('div', { style: { fontWeight: 650 } }, a.name || a.username),
                  h('div', { className: 'dsh-mail-hint' }, a.username)
                )
              ),
              h('div', { className: 'dsh-mail-hint', style: { marginBottom: 12 } }, (a.imapHost || '') + ':' + a.imapPort + ' · ' + (a.smtpHost || '') + ':' + a.smtpPort),
              renameId === a.id
                ? h('div', null,
                    h('div', { className: 'dsh-mail-hint', style: { marginBottom: 8 } }, t('renameHint')),
                    h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                      h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: () => commitRename(a.id), disabled: busy }, h(Ico, { name: 'check', size: 14 }), t('save')),
                      h('button', { className: 'dsh-mail-btn', onClick: cancelRename, disabled: busy }, t('cancel'))
                    )
                  )
                : h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                    h('button', { className: 'dsh-mail-btn', onClick: () => testAccount(a.id), disabled: busy }, h(Ico, { name: 'check', size: 14 }), t('test')),
                    h('button', { className: 'dsh-mail-btn', onClick: () => startRename(a), disabled: busy }, h(Ico, { name: 'compose', size: 14 }), t('rename')),
                    h('button', { className: 'dsh-mail-btn', onClick: () => { setActiveId(a.id); navTo('inbox'); } }, h(Ico, { name: 'inbox', size: 14 }), t('inbox')),
                    h('button', { className: 'dsh-mail-btn dsh-mail-btn-danger', onClick: () => deleteAccount(a.id), disabled: busy }, h(Ico, { name: 'trash', size: 14 }), t('delete'))
                  )
            )),
            h('div', { className: 'dsh-mail-card' },
              h('div', { className: 'dsh-mail-cardhead' },
                h(Ico, { name: 'plus', size: 16 }), t('addAccount'),
                h('button', {
                  className: 'dsh-mail-btn', type: 'button',
                  style: { marginLeft: 'auto' },
                  onClick: () => setForm(emptyAccountForm()),
                  title: t('clearForm'),
                }, h(Ico, { name: 'refresh', size: 14 }), t('clearForm'))
              ),
              h('div', { className: 'dsh-mail-hint', style: { marginBottom: 12 } }, t('note')),
              h('div', { style: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 } },
                Object.keys(PRESETS).map(k => h('button', {
                  key: k, type: 'button', 'aria-pressed': form.preset === k,
                  className: 'dsh-mail-pill' + (form.preset === k ? ' is-active' : ''),
                  onClick: () => applyPreset(k),
                }, t(k)))
              ),
              h('div', { className: 'dsh-mail-grid' },
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('name')),
                  h('input', { className: 'dsh-mail-input', value: form.name, placeholder: defaultAccountName(form.username) || 'me', onChange: e => setForm(Object.assign({}, form, { name: e.target.value })) })
                ),
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('username')),
                  h('input', { className: 'dsh-mail-input', value: form.username, placeholder: 'me@qq.com', onChange: e => setForm(Object.assign({}, form, { username: e.target.value })) })
                )
              ),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('authCode')),
                h('input', { className: 'dsh-mail-input', type: 'password', value: form.authCode, onChange: e => setForm(Object.assign({}, form, { authCode: e.target.value })) }),
                vaultClientRef.current.isAvailable()
                  ? h('button', { className: 'dsh-mail-btn', type: 'button', style: { marginTop: 8 }, onClick: openVaultPicker }, h(Ico, { name: 'accounts', size: 15 }), t('fillFromVault'))
                  : null
              ),
              h('div', { className: 'dsh-mail-grid' },
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('imapHost')),
                  h('input', { className: 'dsh-mail-input', value: form.imapHost, onChange: e => setForm(Object.assign({}, form, { imapHost: e.target.value })) })
                ),
                h('div', { className: 'dsh-mail-field', style: { flex: '0 0 96px', minWidth: 96 } },
                  h('span', { className: 'dsh-mail-label' }, t('imapPort')),
                  h('input', { className: 'dsh-mail-input', value: form.imapPort, onChange: e => setForm(Object.assign({}, form, { imapPort: e.target.value })) })
                )
              ),
              h('div', { className: 'dsh-mail-grid' },
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('smtpHost')),
                  h('input', { className: 'dsh-mail-input', value: form.smtpHost, onChange: e => setForm(Object.assign({}, form, { smtpHost: e.target.value })) })
                ),
                h('div', { className: 'dsh-mail-field', style: { flex: '0 0 96px', minWidth: 96 } },
                  h('span', { className: 'dsh-mail-label' }, t('smtpPort')),
                  h('input', { className: 'dsh-mail-input', value: form.smtpPort, onChange: e => setForm(Object.assign({}, form, { smtpPort: e.target.value })) })
                )
              ),
              h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: saveAccount, disabled: busy || !form.username || !form.authCode }, h(Ico, { name: 'check', size: 15 }), t('save'))
            )
          )
        ),

        /* --------------------------- VAULT PICKER ---------------------------- */
        vaultOpen && h('div', { className: 'dsh-mail-modal-backdrop', onClick: () => setVaultOpen(false) },
          h('div', { className: 'dsh-mail-modal', onClick: e => e.stopPropagation() },
            h('div', { className: 'dsh-mail-modal-head' },
              h('span', null, t('vaultPickTitle')),
              h('button', { className: 'dsh-mail-btn', onClick: () => setVaultOpen(false) }, t('cancel'))
            ),
            h('div', { className: 'dsh-mail-modal-body' },
              h('div', { className: 'dsh-mail-hint' }, t('vaultPickHint')),
              vaultBusy ? h('div', { className: 'dsh-mail-hint' }, t('vaultPickLoading'))
                : (vaultEntries && vaultEntries.length === 0) ? h('div', { className: 'dsh-mail-hint' }, t('vaultPickEmpty'))
                : (vaultEntries || []).map(entry =>
                    h('button', {
                      key: entry.id, type: 'button', className: 'dsh-mail-vault-opt',
                      onClick: () => pickVaultSecret(entry)
                    },
                      h('span', { style: { fontWeight: 650 } }, entry.title || '(untitled)'),
                      h('span', { className: 'dsh-mail-hint' }, entry.username || entry.provider || '')
                    )
                  )
            )
          )
        ),

        /* ------------------------------- DETAIL ----------------------------- */
        view === 'detail' && h('div', { className: 'dsh-mail-view' },
          h('div', { className: 'dsh-mail-scroll' },
            h('button', { className: 'dsh-mail-btn', onClick: () => { BADGE.clear(); setView('inbox'); } }, h(Ico, { name: 'back', size: 15 }), t('back')),
            detail && h('div', null,
              h('div', { className: 'dsh-mail-detailhead' },
                h('h2', { className: 'dsh-mail-detailtitle' }, detail.subject || t('noSubject')),
                h('div', { className: 'dsh-mail-detailfrom' },
                  h('div', { className: 'dsh-mail-avatar', style: { background: avatarColor(detail.from || detail.subject) } }, avatarLetter(detail.from || detail.subject)),
                  h('div', { style: { minWidth: 0 } },
                    h('div', { style: { fontWeight: 600 } }, String(detail.from || '').replace(/<.*>/, '').trim() || detail.from || ''),
                    h('div', { className: 'dsh-mail-detailmeta' }, t('to') + ': ' + (detail.to || '') + ' · ' + fmtDate(detail.date))
                  ),
                  parseAddress(detail.from)
                    ? h('button', {
                        className: 'dsh-mail-btn' + (contactKnown(parseAddress(detail.from).email) ? ' is-done' : ''),
                        'data-testid': 'add-sender',
                        onClick: () => addAsContact(detail.from),
                        disabled: busy,
                        title: t('addSender'),
                      }, h(Ico, { name: contactKnown(parseAddress(detail.from).email) ? 'check' : 'plus', size: 14 }), t('addSender'))
                    : null
                )
              ),
              h('div', { className: 'dsh-mail-detailtoolbar' },
                h('button', {
                  className: 'dsh-mail-btn',
                  type: 'button',
                  'data-testid': 'translate-mail',
                  onClick: () => void translateMessage(),
                  disabled: translating || busy,
                  title: t('translate'),
                },
                  h(Ico, { name: 'translate', size: 14 }),
                  translating ? t('translating') : t('translate')
                ),
                translatedText !== null
                  ? h('button', {
                      className: 'dsh-mail-btn',
                      type: 'button',
                      onClick: () => setTranslatedText(null),
                      title: t('translateShowOriginal'),
                    }, h(Ico, { name: 'back', size: 14 }), t('translateShowOriginal'))
                  : null
              ),
              translatedText !== null
                ? h('div', null,
                    h('div', {
                      className: 'dsh-mail-mailbody dsh-mail-translated',
                      onClick: (e) => {
                        const a = e.target && e.target.closest && e.target.closest('a[href]');
                        if (!a) return;
                        const href = a.getAttribute('href');
                        if (!href) return;
                        e.preventDefault();
                        if (window.open) window.open(href, '_blank', 'noopener,noreferrer');
                      },
                    },
                      h('div', { className: 'dsh-mail-translatednotice' }, h(Ico, { name: 'translate', size: 13 }), t('translatedNotice')),
                      h('div', { style: { whiteSpace: 'pre-wrap' } }, translatedText || t('noMessages'))
                    ),
                    h('div', { style: { height: 14 } })
                  )
                : h('div', {
                    className: 'dsh-mail-mailbody',
                    onClick: (e) => {
                      const a = e.target && e.target.closest && e.target.closest('a[href]');
                      if (!a) return;
                      const href = a.getAttribute('href');
                      if (!href) return;
                      e.preventDefault();
                      if (window.open) window.open(href, '_blank', 'noopener,noreferrer');
                    },
                    dangerouslySetInnerHTML: { __html: detail.html || ('<div style="white-space:pre-wrap">' + escHtml(detail.body || '') + '</div>') },
                  }),
              // Attachments are fetched on demand so opening a mail stays fast.
              Array.isArray(detail.attachments) && detail.attachments.length > 0
                ? h('div', { className: 'dsh-mail-field', style: { marginTop: 14 } },
                    h('span', { className: 'dsh-mail-label' }, t('attachments') + ' (' + detail.attachments.length + ')'),
                    h('div', { className: 'dsh-mail-attachlist' }, detail.attachments.map(att =>
                      h('div', { key: String(att.index), className: 'dsh-mail-attach' },
                        h(Ico, { name: 'attach', size: 14 }),
                        h('span', { className: 'dsh-mail-attach-name', title: att.name }, att.name),
                        h('span', { className: 'dsh-mail-attach-size' }, fmtSize(att.size)),
                        h('button', {
                          className: 'dsh-mail-btn' + (attachState[String(att.index)] === 'ok' ? ' dsh-mail-refresh-ok' : attachState[String(att.index)] === 'error' ? ' dsh-mail-refresh-err' : ''),
                          type: 'button',
                          disabled: attachState[String(att.index)] === 'loading',
                          onClick: () => downloadAttachment(att),
                          title: t('downloadAttachment'),
                        },
                          h(Ico, { name: attachState[String(att.index)] === 'ok' ? 'check' : attachState[String(att.index)] === 'error' ? 'warning' : 'download', size: 14 }),
                          t('downloadAttachment'))
                      )
                    ))
                  )
                : null
            )
          )
        ),

        /* ------------------------------- COMPOSE ---------------------------- */
        view === 'compose' && h('div', { className: 'dsh-mail-view' },
          h('div', { className: 'dsh-mail-scroll' },
            h('div', { className: 'dsh-mail-card' },
              h('div', { className: 'dsh-mail-cardhead' },
                h(Ico, { name: 'compose', size: 16 }), t('compose'),
                h('span', { className: 'dsh-mail-spacer' }),
                h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: sendMail, disabled: busy || attachBusy || !compose.to }, h(Ico, { name: 'sent', size: 15 }), t('send'))
              ),
              h('div', { className: 'dsh-mail-hint', style: { marginBottom: 12 } }, account ? account.username : ''),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('to')),
                h('input', { className: 'dsh-mail-input', value: compose.to, placeholder: 'friend@example.com', onChange: e => setCompose(Object.assign({}, compose, { to: e.target.value })) })
              ),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('subject')),
                h('input', { className: 'dsh-mail-input', value: compose.subject, onChange: e => setCompose(Object.assign({}, compose, { subject: e.target.value })) })
              ),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('body')),
                h('textarea', { className: 'dsh-mail-textarea', value: compose.body, onChange: e => setCompose(Object.assign({}, compose, { body: e.target.value })) })
              ),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('attachments')),
                h('div', { className: 'dsh-mail-attachbar' },
                  h('label', { className: 'dsh-mail-btn', style: { cursor: 'pointer' } },
                    h(Ico, { name: 'attach', size: 15 }),
                    t('addAttachment'),
                    h('input', {
                      type: 'file', multiple: true,
                      'data-testid': 'attachment-input',
                      style: { display: 'none' },
                      onChange: e => { void addAttachments(e.target.files); e.target.value = ''; },
                    })
                  ),
                  attachBusy ? h('span', { className: 'dsh-mail-hint' }, t('loading')) : null
                ),
                // Dropping files anywhere on this card also adds them.
                h('div', {
                  className: 'dsh-mail-drop' + (dropOver ? ' is-over' : ''),
                  onDragOver: e => { e.preventDefault(); if (!dropOver) setDropOver(true); },
                  onDragLeave: () => setDropOver(false),
                  onDrop: e => {
                    e.preventDefault();
                    setDropOver(false);
                    if (e.dataTransfer && e.dataTransfer.files) void addAttachments(e.dataTransfer.files);
                  },
                }, dropOver ? t('addAttachment') : t('attachmentsHint')),
                composeAtts.length > 0
                  ? h('div', { className: 'dsh-mail-attachlist' }, composeAtts.map((a, i) =>
                      h('div', { key: a.name + '-' + i, className: 'dsh-mail-attach' },
                        h(Ico, { name: 'attach', size: 14 }),
                        h('span', { className: 'dsh-mail-attach-name', title: a.name }, a.name),
                        h('span', { className: 'dsh-mail-attach-size' }, fmtSize(a.size)),
                        h('button', {
                          className: 'dsh-mail-btn dsh-mail-iconbtn',
                          type: 'button',
                          onClick: () => removeAttachment(i),
                          title: t('removeAttachment'),
                          'aria-label': t('removeAttachment'),
                        }, h(Ico, { name: 'trash', size: 14 }))
                      )
                    ))
                  : null
              )
            )
          )
        )
      );
    }

    // Dedicated "邮件" section in the main Settings panel. Reads/writes the
    // agentMailAccess switch through the plugin's own fetch route (the Host
    // half stores it in the credential store), so this toggle and the AI tool
    // share one host-owned value without depending on configForms, which is not
    // available on this DSH build.
    // Scoped stylesheet for the Settings-panel section. The mail panel's CSS
    // lives under .dsh-mail; the settings shell renders outside that tree, so
    // this section carries its own prefixed stylesheet (same design language:
    // soft gradients, 9/14px radii, hover/active/focus states, theme tokens).
    const SETTINGS_CSS = [
      '.dsh-mail-set { padding:4px; max-width:560px; color:var(--dsw-alias-label-primary); font-size:13px; line-height:1.55; -webkit-font-smoothing:antialiased; }',
      '.dsh-mail-set * { box-sizing:border-box; }',
      '.dsh-mail-set h2 { margin:0 0 8px; font-size:18px; font-weight:700; line-height:1.4; letter-spacing:.2px; }',
      '.dsh-mail-set h3 { margin:24px 0 8px; padding-top:18px; border-top:1px solid var(--dsw-alias-border-l1); font-size:15px; font-weight:650; line-height:1.4; }',
      '.dsh-mail-set p { margin:0 0 12px; font-size:13px; line-height:1.7; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-set label { display:flex; align-items:center; gap:10px; cursor:pointer; font-size:14px; line-height:1.5; color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-set label.dsh-mail-set-gap { margin-top:10px; }',
      '.dsh-mail-set input[type="checkbox"] { width:16px; height:16px; flex:none; accent-color:var(--dsw-alias-brand-primary); cursor:pointer; }',
      '.dsh-mail-set input[type="number"], .dsh-mail-set select { width:84px; padding:5px 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:13px; font-family:inherit; transition:border-color .12s, box-shadow .12s; }',
      '.dsh-mail-set input[type="number"]:focus, .dsh-mail-set select:focus { outline:none; border-color:var(--dsw-alias-brand-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }',
      '.dsh-mail-set input:disabled, .dsh-mail-set select:disabled { opacity:.6; cursor:not-allowed; }',
      '.dsh-mail-set .dsh-mail-set-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:6px 16px; border:1px solid var(--dsw-alias-border-l2); border-radius:9px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; transition:filter .15s, transform .08s, box-shadow .15s, border-color .15s; }',
      '.dsh-mail-set .dsh-mail-set-btn:hover:not(:disabled) { filter:brightness(.97); border-color:var(--dsw-alias-brand-primary); box-shadow:0 2px 8px rgba(0,0,0,.08); }',
      '.dsh-mail-set .dsh-mail-set-btn:active:not(:disabled) { transform:translateY(1px); box-shadow:inset 0 2px 5px rgba(0,0,0,.12); }',
      '.dsh-mail-set .dsh-mail-set-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }',
      '.dsh-mail-set .dsh-mail-set-btn:disabled { opacity:.5; cursor:not-allowed; }',
      '.dsh-mail-set .dsh-mail-set-btn-primary { background:linear-gradient(135deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 82%, white), var(--dsw-alias-brand-primary)); border-color:transparent; color:var(--dsw-alias-bg-base); box-shadow:0 3px 10px color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent); }',
      '.dsh-mail-set .dsh-mail-set-btn-primary:hover:not(:disabled) { filter:brightness(1.06); box-shadow:0 5px 14px color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent); }',
      '.dsh-mail-set .dsh-mail-set-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:14px; }',
      '.dsh-mail-set .dsh-mail-set-card { margin-top:14px; padding:12px; border:1px solid var(--dsw-alias-border-l1); border-radius:14px; background:linear-gradient(180deg, var(--dsw-alias-bg-layer-1), var(--dsw-alias-bg-base)); box-shadow:0 2px 10px rgba(0,0,0,.05), inset 0 1px 0 rgba(255,255,255,.04); }',
      '.dsh-mail-set .dsh-mail-set-cardhead { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }',
      '.dsh-mail-set .dsh-mail-spacer { flex:1; min-width:0; }',
      '.dsh-mail-set .dsh-mail-set-meta { margin-top:6px; font-size:12px; line-height:1.7; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-set .dsh-mail-set-meta.is-ok { color:var(--dsw-alias-state-success-primary); }',
      '.dsh-mail-set .dsh-mail-set-meta.is-error { color:var(--dsw-alias-state-error-primary); }',
      '.dsh-mail-set p.dsh-mail-set-note { margin:8px 0 0; font-size:12px; line-height:1.6; }',
      '.dsh-mail-set p.dsh-mail-set-note.is-ok { color:var(--dsw-alias-state-success-primary); }',
      '.dsh-mail-set p.dsh-mail-set-note.is-error { color:var(--dsw-alias-state-error-primary); }',
      '@media (prefers-reduced-motion: reduce) { .dsh-mail-set .dsh-mail-set-btn { transition:none; } }',
    ].join('\n');

    function MailSettingsSection(props) {
      const tr = props && props.t ? props.t : t;
      const [draft, setDraft] = useState({ agentMailAccess: false, notifyEnabled: true, notifyInterval: 60, notifyMode: 'pet' });
      const [stored, setStored] = useState({ agentMailAccess: false, notifyEnabled: true, notifyInterval: 60, notifyMode: 'pet' });
      const [saving, setSaving] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [failed, setFailed] = useState(false);
      const [saveError, setSaveError] = useState('');
      const [saved, setSaved] = useState(false);
      const [perm, setPerm] = useState(() => notifyPermission());
      const [asking, setAsking] = useState(false);
      const [tested, setTested] = useState(false);
      const [testMsg, setTestMsg] = useState('');
      const [checking, setChecking] = useState(false);
      const [checkMsg, setCheckMsg] = useState('');
      const [diag, setDiag] = useState(() => Object.assign({}, NOTIFY.diag));

      useEffect(() => {
        let alive = true;
        fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'getSettings' }),
        })
          .then(r => r.json())
          .then(data => {
            if (!alive) return;
            const s = data && data.ok && data.settings ? data.settings : {};
            const next = {
              agentMailAccess: s.agentMailAccess === true,
              notifyEnabled: s.notifyEnabled !== false,
              notifyInterval: Number(s.notifyInterval) || 60,
              notifyMode: s.notifyMode || 'pet',
            };
            setStored(next);
            setDraft(next);
            setLoaded(true);
          })
          .catch(() => { if (alive) setLoaded(true); });
        return () => { alive = false; };
      }, []);

      // Clear stale save hints as soon as the user edits away from the
      // last saved state. Avoids a lingering "已保存" after a new change.
      useEffect(() => {
        if (JSON.stringify(draft) !== JSON.stringify(stored) && (saved || failed)) {
          setSaved(false);
          setFailed(false);
          setSaveError('');
        }
      }, [draft, stored]);

      // Mirror the background engine's diagnostics into this panel while it is
      // open, so checks/alerts/errors update live without a manual refresh.
      useEffect(() => {
        const sync = () => setDiag(Object.assign({}, NOTIFY.diag));
        sync();
        const id = setInterval(sync, 3000);
        return () => clearInterval(id);
      }, []);

      const save = async () => {
        if (saving) return;
        setSaving(true);
        setFailed(false);
        setSaveError('');
        setSaved(false);
        try {
          const r = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ op: 'setSettings', value: draft }),
          });
          const data = await r.json();
          // Only the HTTP result decides success. Side effects below (mirroring
          // state, restarting the poller) must never turn a persisted save into
          // a "failed" message — that is exactly the "saved but says failed" bug.
          if (!r.ok || !data || data.ok === false) {
            setFailed(true);
            setSaveError('http:' + (r.status || '?'));
            setSaving(false);
            return;
          }
          const applied = data.settings || draft;
          setStored(applied);
          setDraft(applied);
          NOTIFY.settings = {
            notifyEnabled: applied.notifyEnabled !== false,
            notifyInterval: Number(applied.notifyInterval) || 60,
            notifyMode: applied.notifyMode || 'pet',
          };
          setSaved(true);
          // Poller restart is best-effort: wrap it so an error here cannot
          // retroactively fail the already-persisted save.
          try { startPoller(); } catch (e) {
            if (NOTIFY.diag) NOTIFY.diag.error = 'poller: ' + (e && e.message ? e.message : String(e));
          }
        } catch (e) {
          setFailed(true);
          setSaveError(e && e.message ? e.message : String(e));
        }
        setSaving(false);
      };

      const requestPerm = async () => {
        if (asking) return;
        setAsking(true);
        const result = await askNotifyPermission();
        setPerm(result);
        setAsking(false);
        if (result === 'granted') startPoller();
        return result;
      };

      // Fired from a user gesture. Pet announcements need no browser
      // permission; system-notification mode asks for it in-gesture first.
      const sendTest = async () => {
        if (asking) return;
        const mode = draft.notifyMode || NOTIFY.settings.notifyMode || 'pet';
        if ((mode === 'system' || mode === 'both') && notifyPermission() !== 'granted') {
          const p = await requestPerm();
          if (p !== 'granted' && mode === 'system') {
            setTested(false);
            setTestMsg(p === 'denied' ? tr('notifyPermissionDenied') : (tr('notifyTestFailed') + ' (' + p + ')'));
            return;
          }
        }
        const systemOnly = mode === 'system';
        const result = await deliverAlert(
          tr(systemOnly ? 'notifyTestTitleSystem' : 'notifyTestTitle'),
          tr(systemOnly ? 'notifyTestBodySystem' : 'notifyTestBody'),
          { mode } // 用当前选择的方式，而不是已保存的设置
        );
        if (result.petOk && !systemOnly) {
          setTested(true);
          setTestMsg(tr('notifyPetOk'));
        } else if (result.sysOk) {
          setTested(true);
          setTestMsg(tr('notifyTestSent'));
        } else {
          setTested(false);
          setTestMsg(tr('notifyTestFailed') + (NOTIFY.lastError ? ' (' + NOTIFY.lastError + ')' : ''));
        }
      };

      // Run the real detection chain on demand and refresh the diagnostics.
      // This is the only way to tell a live poller from a dead one without
      // waiting for an actual mail to arrive.
      const checkNow = async () => {
        if (checking) return;
        setChecking(true);
        const before = NOTIFY.diag.alerts;
        try {
          const snap = await pollNewMail();
          setDiag(Object.assign({}, snap));
          const found = Math.max(0, (snap && snap.alerts ? snap.alerts : 0) - before);
          setCheckMsg(tr('notifyCheckDone').replace('{n}', String(found)));
        } catch (e) {
          setDiag(Object.assign({}, NOTIFY.diag));
          setCheckMsg(tr('notifyTestFailed') + (e && e.message ? ' (' + e.message + ')' : ''));
        }
        setChecking(false);
      };

      const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
      // In pure system-notification mode, hide all pet-related copy.
      const isSystemOnly = (draft.notifyMode || 'pet') === 'system';
      return h('div', { className: 'dsh-mail-set' },
        h('style', null, SETTINGS_CSS),
        h('h2', null, tr('settingsTitle')),

        // AI assistant access toggle (unchanged behaviour).
        h('p', null, tr('settingsDescription')),
        h('label', { htmlFor: 'settings-dsh-mail-agent-access' },
          h('input', {
            id: 'settings-dsh-mail-agent-access', type: 'checkbox',
            checked: draft.agentMailAccess, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, agentMailAccess: !!(e && e.target && e.target.checked) }),
          }),
          tr('agentMailAccessLabel')
        ),
        h('p', null, tr('agentMailAccessHint')),

        // New-mail notification section.
        h('h3', null, tr('notifySectionTitle')),
        h('p', null, tr(isSystemOnly ? 'notifySectionHintSystem' : 'notifySectionHint')),
        h('label', { htmlFor: 'settings-dsh-mail-notify' },
          h('input', {
            id: 'settings-dsh-mail-notify', type: 'checkbox',
            checked: draft.notifyEnabled, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyEnabled: !!(e && e.target && e.target.checked) }),
          }),
          tr(isSystemOnly ? 'notifyEnabledLabelSystem' : 'notifyEnabledLabel')
        ),
        h('label', { htmlFor: 'settings-dsh-mail-interval', className: 'dsh-mail-set-gap' },
          h('span', null, tr('notifyIntervalLabel')),
          h('input', {
            id: 'settings-dsh-mail-interval', type: 'number', min: 15, max: 3600,
            value: draft.notifyInterval, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyInterval: Number(e && e.target && e.target.value) || 60 }),
          })
        ),
        h('label', { htmlFor: 'settings-dsh-mail-mode', className: 'dsh-mail-set-gap' },
          h('span', null, tr('notifyMode')),
          h('select', {
            id: 'settings-dsh-mail-mode',
            value: draft.notifyMode || 'pet',
            disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyMode: (e && e.target && e.target.value) || 'pet' }),
          },
            h('option', { value: 'pet' }, tr('notifyModePet')),
            h('option', { value: 'system' }, tr('notifyModeSystem')),
            h('option', { value: 'both' }, tr('notifyModeBoth'))
          )
        ),

        // Permission row.
        h('div', { className: 'dsh-mail-set-row' },
          h('button', {
            type: 'button', className: 'dsh-mail-set-btn',
            disabled: asking || perm === 'granted' || perm === 'unsupported',
            onClick: () => { void requestPerm(); },
          }, asking ? tr('notifyPermissionAsking') : tr('notifyPermission')),
          h('span', null,
            perm === 'granted' ? tr('notifyPermissionGranted')
              : perm === 'denied' ? tr('notifyPermissionDenied')
              : perm === 'unsupported' ? tr('notifyPermissionUnsupported') : ''
          ),
          h('button', {
            type: 'button', className: 'dsh-mail-set-btn dsh-mail-set-btn-primary',
            disabled: asking,
            onClick: () => { void sendTest(); },
          }, tr('notifyTest'))
        ),
        testMsg ? h('p', {
          className: 'dsh-mail-set-note ' + (tested ? 'is-ok' : 'is-error'),
        }, testMsg) : null,

        // Live detection diagnostics + manual check. These make the otherwise
        // invisible background chain observable to the user and to us.
        h('div', { className: 'dsh-mail-set-card' },
          h('div', { className: 'dsh-mail-set-cardhead' },
            h('strong', null, tr('notifyDiagTitle')),
            h('span', { className: diag.running ? 'dsh-mail-set-meta is-ok' : 'dsh-mail-set-meta is-error' },
              diag.running ? tr('notifyDiagRunning') : tr('notifyDiagStopped')),
            h('span', { className: 'dsh-mail-spacer' }),
            h('button', {
              type: 'button', className: 'dsh-mail-set-btn',
              disabled: checking || !loaded,
              onClick: () => { void checkNow(); },
            }, checking ? tr('notifyChecking') : tr('notifyCheckNow'))
          ),
          h('div', { className: 'dsh-mail-set-meta' },
            tr('notifyDiagAccounts') + ': ' + (diag.accounts || 0) + '  ·  ' +
            tr('notifyDiagChecks') + ': ' + (diag.checks || 0) + '  ·  ' +
            tr(isSystemOnly ? 'notifyDiagAlertsSystem' : 'notifyDiagAlerts') + ': ' + (diag.alerts || 0) + '  ·  ' +
            tr('notifyDiagLastCheck') + ': ' + (diag.lastCheck ? new Date(diag.lastCheck).toLocaleString() : tr('notifyDiagNever'))
          ),
          h('div', { className: 'dsh-mail-set-meta ' + (diag.error ? 'is-error' : 'is-ok') },
            tr('notifyDiagError') + ': ' + (diag.error || tr('notifyDiagOk'))
          ),
          checkMsg ? h('p', { className: 'dsh-mail-set-note' }, checkMsg) : null
        ),

        failed
          ? h('p', { className: 'dsh-mail-set-note is-error' }, tr('settingsSaveFailed') + (saveError ? ' (' + saveError + ')' : ''))
          : saved
            ? h('p', { className: 'dsh-mail-set-note is-ok' }, tr('settingsSaveSuccess'))
            : null,
        h('div', { className: 'dsh-mail-set-row' },
          h('button', {
            type: 'button', className: 'dsh-mail-set-btn dsh-mail-set-btn-primary',
            disabled: !dirty || saving,
            onClick: () => { void save(); },
          }, saving ? tr('settingsSaving') : tr('settingsSave')),
          dirty ? h('button', {
            type: 'button', className: 'dsh-mail-set-btn',
            disabled: saving,
            onClick: () => setDraft(stored),
          }, tr('cancel')) : null
        )
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mail: dictionaries');
        // Start the always-on new-mail poller once the client context is live;
        // dispose it if this plugin half is torn down.
        ctx.effect(() => {
          NOTIFY.ctx = ctx;
          void refreshNotifySettings();
          return () => {
            stopPoller();
            NOTIFY.ctx = null;
          };
        }, 'dsh-mail: new-mail notifications');
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: NS,
          order: 25,
          label: () => t('settingsTitle'),
          locale: NS,
        }, MailSettingsSection));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist', id: 'dsh-mail', order: 80,
          label: () => t('label'),
        }, Icon));
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'dsh-mail',
        }, MailPanel));
      },
    };
  },
});
