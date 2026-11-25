window.__ModuleLoader__.load({
  id: '@mysterycode-liwen/dsh-mail',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect } = React;
    const { SettingsForm, Checkbox } = require('@deepseek-ai/dsh-client-ui-primitives');

    const NS = 'dsh-mail';
    const API = '/api/dsh-mail';

    function escHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      // For known errors the friendly message already explains every possible
      // cause, so hide the raw protocol text (it is long, English and scares
      // users). Only unknown errors keep the raw detail, as a diagnostic hint.
      const raw = String(info.error || '').trim();
      const detail = (!known && raw && raw !== head) ? '\n' + t('errDetail') + raw : '';
      return stage + head + detail;
    }

    const zh = {
      label: '邮件',
      accounts: '账号',
      addAccount: '添加账号',
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
      loading: '加载中…',
      selectAccount: '请选择一个账号。',
      qq: 'QQ 邮箱',
      netease: '网易 163',
      gmail: 'Gmail',
      custom: '自定义',
      presets: '快速设置',
      note: 'QQ / 163 需要邮箱授权码，而不是登录密码。授权码保存在凭据保险箱中。',
      confirmDelete: '确定删除此账号吗？',
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
      // Sent box & contacts
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
      emailRequired: '请填写有效的邮箱地址。',
      saved: '已保存。',
      selectContact: '用此地址写邮件',
      attached: '附件',
      // AI assistant mail access settings card
      settingsTitle: '邮件插件设置',
      settingsDescription: '配置 AI 助手是否可以读取你的邮箱。',
      agentMailAccessLabel: '允许 AI 助手查询邮箱',
      agentMailAccessHint: '开启后，AI 助手可以列出账号、读取邮件列表与内容、查看发件箱；不会暴露密码或授权码，也不能发送或删除邮件。默认关闭。',
      agentMailAccessOn: '已开启：AI 助手可以读取邮箱。',
      agentMailAccessOff: '已关闭：AI 助手无法读取邮箱。',
      settingsUnavailable: '本页没有可编辑的配置表单；请在 profile 配置中设置 agentMailAccess。',
      settingsReadOnly: '本部署的设置为只读。',
      settingsSave: '保存',
      settingsSaving: '保存中…',
      settingsSaveFailed: '设置未保存成功，请重试。',
    };
    const en = {
      label: 'Mail',
      accounts: 'Accounts',
      addAccount: 'Add account',
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
      loading: 'Loading…',
      selectAccount: 'Select an account.',
      qq: 'QQ Mail',
      netease: 'NetEase 163',
      gmail: 'Gmail',
      custom: 'Custom',
      presets: 'Presets',
      note: 'QQ / 163 need an app password, not your login password. Stored in the credential vault.',
      confirmDelete: 'Delete this account?',
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
      // Sent box & contacts
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
      emailRequired: 'Please enter a valid email address.',
      saved: 'Saved.',
      selectContact: 'Compose to this address',
      attached: 'Attachments',
      // AI assistant mail access settings card
      settingsTitle: 'Mail settings',
      settingsDescription: 'Control whether the AI assistant may read your mailbox.',
      agentMailAccessLabel: 'Allow AI assistant to query mail',
      agentMailAccessHint: 'When on, the AI assistant can list accounts, read message lists and bodies, and view sent mail. Passwords and app codes are never exposed, and it cannot send or delete mail. Off by default.',
      agentMailAccessOn: 'On: the AI assistant can read your mailbox.',
      agentMailAccessOff: 'Off: the AI assistant cannot read your mailbox.',
      settingsUnavailable: 'This page has no editable configuration form; set `agentMailAccess` in the profile configuration instead.',
      settingsReadOnly: 'This deployment stores settings read-only.',
      settingsSave: 'Save',
      settingsSaving: 'Saving…',
      settingsSaveFailed: 'The deployment did not accept this value; please try again.',
    };

    const S = {
      root: { display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)', fontFamily: 'inherit', fontSize: 13 },
      header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' },
      title: { fontWeight: 600, fontSize: 15 },
      spacer: { flex: 1 },
      // Buttons use CSS classes (not inline styles) so :hover / :active states
      // can give clear click feedback. Fixed colors guarantee the text and
      // background are never similar, whatever the host theme variables are.
      btnCss: [
        '.dsh-mail-btn {',
        '  border: 1px solid #4b5563 !important;',
        '  border-radius: 6px;',
        '  padding: 6px 12px;',
        '  font-size: 12px;',
        '  font-weight: 600;',
        '  line-height: 1.4;',
        '  cursor: pointer;',
        '  transition: background-color .12s, box-shadow .12s, transform .06s;',
        '  background-color: #e5e7eb !important;',
        '  color: #111827 !important;',
        '}',
        '.dsh-mail-btn:hover:not(:disabled) { background-color: #d1d5db !important; border-color: #1f2937 !important; }',
        '.dsh-mail-btn:active:not(:disabled) { background-color: #9ca3af !important; transform: translateY(1px); box-shadow: inset 0 2px 4px rgba(0,0,0,.25); }',
        '.dsh-mail-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
        '.dsh-mail-btn:disabled { opacity: .5; cursor: not-allowed; }',
        '.dsh-mail-btn-primary { background-color: #1d4ed8 !important; border-color: #1e3a8a !important; color: #ffffff !important; }',
        '.dsh-mail-btn-primary:hover:not(:disabled) { background-color: #1e40af !important; }',
        '.dsh-mail-btn-primary:active:not(:disabled) { background-color: #172554 !important; }',
        '.dsh-mail-btn-danger { background-color: #b91c1c !important; border-color: #7f1d1d !important; color: #ffffff !important; }',
        '.dsh-mail-btn-danger:hover:not(:disabled) { background-color: #991b1b !important; }',
        '.dsh-mail-btn-danger:active:not(:disabled) { background-color: #7f1d1d !important; }',
        '.dsh-mail-pill {',
        '  border: 1px solid #6b7280 !important;',
        '  border-radius: 12px;',
        '  padding: 4px 10px;',
        '  font-size: 11px;',
        '  font-weight: 600;',
        '  cursor: pointer;',
        '  background-color: #f3f4f6 !important;',
        '  color: #1f2937 !important;',
        '  transition: background-color .12s, transform .06s;',
        '}',
        '.dsh-mail-pill:hover { background-color: #dbeafe !important; border-color: #2563eb !important; }',
        '.dsh-mail-pill:active { background-color: #bfdbfe !important; transform: translateY(1px); }',
        '.dsh-mail-pill.is-active { background-color: #1d4ed8 !important; border-color: #1e3a8a !important; color: #ffffff !important; }',
        '.dsh-mail-pill.is-active:hover { background-color: #1e40af !important; }',
        '.dsh-mail-pill.is-active:active { background-color: #172554 !important; }',
        // List rows: hover uses a dark background with forced white text so
        // the text can never blend into the highlight (host themes may use
        // light text colors, which were nearly invisible on light gray).
        '.dsh-mail-item:hover { background-color: #1d4ed8 !important; }',
        '.dsh-mail-item:hover * { color: #ffffff !important; }',
        '.dsh-mail-item:active { background-color: #172554 !important; }',
        '.dsh-mail-item:active * { color: #ffffff !important; }',
        // Loading feedback: a spinning indicator, a sliding top progress bar,
        // and a gentle fade-in so data does not appear abruptly.
        '.dsh-mail-spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid var(--dsw-alias-border-l2); border-top-color: #2563eb; border-radius: 50%; animation: dsh-mail-spin .7s linear infinite; }',
        '@keyframes dsh-mail-spin { to { transform: rotate(360deg); } }',
        '.dsh-mail-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 44px 16px; color: var(--dsw-alias-label-secondary); animation: dsh-mail-fade .25s ease-out; }',
        '@keyframes dsh-mail-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }',
        '.dsh-mail-progress { position: relative; height: 3px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }',
        '.dsh-mail-progress::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 40%; background: #2563eb; animation: dsh-mail-slide 1.1s ease-in-out infinite; }',
        '@keyframes dsh-mail-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }',
        '.dsh-mail-view { animation: dsh-mail-fade .2s ease-out; }',
        '@media (prefers-reduced-motion: reduce) { .dsh-mail-spinner, .dsh-mail-progress::after, .dsh-mail-loading, .dsh-mail-view { animation: none; } }',
      ].join('\n'),
      body: { flex: 1, overflow: 'auto', padding: 16 },
      card: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--dsw-alias-bg-layer-1)' },
      row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
      field: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
      label: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      input: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '7px 9px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box' },
      textarea: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '7px 9px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box', minHeight: 180, resize: 'vertical' },
      hint: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.5 },
      msg: { fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 },
      error: { background: 'var(--dsw-alias-state-error-primary)', color: '#fff' },
      success: { background: 'var(--dsw-alias-state-success-primary)', color: '#fff' },
      item: { borderBottom: '1px solid var(--dsw-alias-border-l1)', padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 },
      subject: { fontWeight: 600 },
      muted: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      snippet: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      pill: { fontSize: 11, padding: '3px 8px', borderRadius: 12, border: '1px solid var(--dsw-alias-border-l2)', cursor: 'pointer' },
      select: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '5px 8px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 12 },
      detailWrap: { width: '100%', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
      detailHead: { textAlign: 'center', marginTop: 12, marginBottom: 4 },
      detailMeta: { textAlign: 'center', marginBottom: 16 },
      mailBody: { width: '100%', boxSizing: 'border-box', lineHeight: 1.8, padding: 16, border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere', wordBreak: 'break-word', textAlign: 'center' },
      // 邮件正文是第三方 HTML，常带写死的颜色（多为白底深字）。主题切到暗色后
      // 这些固定色会与容器背景撞色。下面用 !important 强制所有子元素改用 DSH
      // 自带的高对比主题变量（文字 label-primary / 透明背景），明/暗主题都清晰。
      // 双写类名用于压过部分邮件内联 <style> 注入的样式。
      mailHtmlCss: [
        '.dsh-mail-html { text-align: center; }',
        // 统一改色/透明背景时排除按钮和链接（含其子元素）：邮件里自带样式的
        // CTA 按钮要保留原本的外观与 :hover/:active 等交互效果，不能被抹掉。
        '.dsh-mail-html.dsh-mail-html *:not(button, button *, a, a *, [role="button"], [role="button"] *) { max-width: 100% !important; box-sizing: border-box !important; color: var(--dsw-alias-label-primary) !important; background-color: transparent !important; border-color: var(--dsw-alias-border-l2) !important; }',
        '.dsh-mail-html.dsh-mail-html a, .dsh-mail-html.dsh-mail-html a * { color: var(--dsw-alias-brand-primary) !important; text-decoration: underline; cursor: pointer; }',
        '.dsh-mail-html img { max-width: 100%; height: auto; border-radius: 6px; }',
        '.dsh-mail-html p, .dsh-mail-html div { margin: 0 0 8px; }',
        '.dsh-mail-html table { max-width: 100%; border-collapse: collapse; }',
        '.dsh-mail-html blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid var(--dsw-alias-border-l2) !important; }',
      ].join('\n'),
    };

    const PRESETS = {
      qq: { nameKey: 'qq', imapHost: 'imap.qq.com', imapPort: 993, smtpHost: 'smtp.qq.com', smtpPort: 465 },
      netease: { nameKey: 'netease', imapHost: 'imap.163.com', imapPort: 993, smtpHost: 'smtp.163.com', smtpPort: 465 },
      gmail: { nameKey: 'gmail', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 },
      custom: { nameKey: 'custom', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465 },
    };

    // Module-level store survives MailPanel unmount/remount when the user
    // switches sidebar panels, so coming back never refetches everything.
    const PERSIST = {
      accounts: null,
      activeId: '',
      view: 'inbox',
      messages: [],
      detail: null,
      form: null,
      compose: { to: '', subject: '', body: '' },
      loadedId: '', // account id whose message list is currently cached
      sent: [],
      contacts: [],
      contactForm: { name: '', email: '' },
      loadedIds: { inbox: '', sent: '', contacts: '' }, // per-view cached account ids
    };
    function usePersistent(key, initial) {
      // `!= null` treats both null and undefined as "not cached yet", so the
      // default object is used for keys like `form` that start as null.
      const [value, setValue] = useState(() => (PERSIST[key] != null ? PERSIST[key] : initial));
      const update = (next) => {
        const resolved = typeof next === 'function' ? next(PERSIST[key]) : next;
        PERSIST[key] = resolved;
        setValue(resolved);
      };
      return [value, update];
    }

    function Icon({ size, active }) {
      return h('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { fill: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor', d: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8.2L4.2 7h15.6L12 13.2zM4 8.3V17h16V8.3l-8 6.1-8-6.1z' })
      );
    }

    function Loading(label) {
      return h('div', { className: 'dsh-mail-loading' },
        h('div', { className: 'dsh-mail-spinner' }),
        h('span', null, label || t('loading'))
      );
    }

    function MailPanel() {
      const [accounts, setAccounts] = usePersistent('accounts', null);
      const [activeId, setActiveId] = usePersistent('activeId', '');
      const [view, setView] = usePersistent('view', 'inbox');
      const [messages, setMessages] = usePersistent('messages', []);
      const [detail, setDetail] = usePersistent('detail', null);
      const [busy, setBusy] = useState(false);
      // Loading is tracked per fetch, so the indicator stays until THAT
      // request resolves (the global `busy` is shared by save/send/delete
      // and by three concurrent account-switch loads).
      const [loadingMessages, setLoadingMessages] = useState(false);
      const [loadingSent, setLoadingSent] = useState(false);
      const [loadingContacts, setLoadingContacts] = useState(false);
      const [flash, setFlash] = useState(null);
      const [form, setForm] = usePersistent('form', { preset: 'qq', name: '', username: '', authCode: '', imapHost: PRESETS.qq.imapHost, imapPort: 993, smtpHost: PRESETS.qq.smtpHost, smtpPort: 465 });
      const [compose, setCompose] = usePersistent('compose', { to: '', subject: '', body: '' });
      const [sent, setSent] = usePersistent('sent', []);
      const [contacts, setContacts] = usePersistent('contacts', []);
      const [contactForm, setContactForm] = usePersistent('contactForm', { name: '', email: '' });
      const [sentDetail, setSentDetail] = useState(null);

      useEffect(() => {
        if (!PERSIST.accounts) refreshAccounts();
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

      async function refreshAccounts() {
        try {
          const data = await rpc('listAccounts');
          setAccounts(data.accounts || []);
          if (!activeId && data.accounts && data.accounts.length) setActiveId(data.accounts[0].id);
        } catch (e) {
          reportError(e);
        }
      }

      async function loadMessages() {
        if (!activeId) return;
        setBusy(true);
        setLoadingMessages(true);
        try {
          const data = await rpc('listMessages', { id: activeId, limit: 25 });
          setMessages(data.messages || []);
        } catch (e) {
          reportError(e);
        } finally {
          setLoadingMessages(false);
          setBusy(false);
        }
      }

      async function loadSent() {
        if (!activeId) return;
        setBusy(true);
        setLoadingSent(true);
        try {
          const data = await rpc('sentMessages', { id: activeId });
          setSent(data.sent || []);
        } catch (e) {
          reportError(e);
        } finally {
          setLoadingSent(false);
          setBusy(false);
        }
      }

      async function loadContacts() {
        if (!activeId) return;
        setBusy(true);
        setLoadingContacts(true);
        try {
          const data = await rpc('listContacts', { id: activeId });
          setContacts(data.contacts || []);
        } catch (e) {
          reportError(e);
        } finally {
          setLoadingContacts(false);
          setBusy(false);
        }
      }

      // Only (re)load the list when the ACCOUNT actually changes — never on
      // view changes (inbox→detail→inbox), so entering a mail no longer blanks
      // it and returning does not refetch. PERSIST.loadedId guards remounts.
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
          setMessages([]);
          setSent([]);
          setContacts([]);
          setDetail(null);
          PERSIST.loadedIds = { inbox: activeId, sent: activeId, contacts: activeId };
          // Every view is tied to an account; loading all three keeps data in
          // sync when the user switches accounts or the active view changes.
          loadMessages();
          loadSent();
          loadContacts();
        }
      }, [activeId]);

      function applyPreset(preset) {
        const p = PRESETS[preset] || PRESETS.custom;
        setForm(Object.assign({}, form, {
          preset,
          name: preset === 'custom' ? '' : t(p.nameKey),
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
            name: form.name || form.username,
            username: form.username,
            authCode: form.authCode,
            imapHost: form.imapHost,
            imapPort: Number(form.imapPort),
            smtpHost: form.smtpHost,
            smtpPort: Number(form.smtpPort),
          });
          notify('success', t('ok'));
          setForm(Object.assign({}, form, { authCode: '' }));
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

      async function openMessage(uid) {
        setBusy(true);
        try {
          const data = await rpc('getMessage', { id: activeId, uid });
          setDetail(data.message || data);
          setView('detail');
        } catch (e) {
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      async function sendMail() {
        setBusy(true);
        try {
          await rpc('sendMessage', { id: activeId, to: compose.to, subject: compose.subject, body: compose.body });
          notify('success', t('ok'));
          setCompose({ to: '', subject: '', body: '' });
          await loadSent();
          setView('sent');
        } catch (e) {
          reportError(e);
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
          // Use the authoritative response; never re-fetch, which could bring
          // back a stale copy from a server-side sync record.
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
        // Remove from the visible list immediately so the action always takes
        // effect, even before the request completes.
        const next = contacts.filter(c => String(c.email).toLowerCase() !== String(email).toLowerCase());
        setContacts(next);
        try {
          const data = await rpc('deleteContact', { id: activeId, email });
          // Trust the response over any further read: a stale server-side sync
          // copy would otherwise re-add the contact we just removed.
          if (Array.isArray(data.contacts)) setContacts(data.contacts);
        } catch (e) {
          // Keep the optimistic removal on failure; re-adding a deleted
          // contact is worse than showing the local list until next refresh.
          reportError(e);
        } finally {
          setBusy(false);
        }
      }

      function composeTo(email) {
        setCompose(Object.assign({}, compose, { to: email }));
        setView('compose');
      }

      const account = (accounts || []).find(a => a.id === activeId);

      return h('div', { style: S.root },
        h('style', null, S.btnCss),
        (loadingMessages || loadingSent || loadingContacts) && h('div', { className: 'dsh-mail-progress' }),
        h('div', { style: S.header },
          h('span', { style: S.title }, t('label')),
          h('span', { style: S.spacer }),
          h('button', { className: 'dsh-mail-btn', onClick: () => setView('accounts') }, t('accounts')),
          h('button', { className: 'dsh-mail-btn', onClick: () => setView('sent'), disabled: !activeId }, t('sent')),
          h('button', { className: 'dsh-mail-btn', onClick: () => setView('contacts'), disabled: !activeId }, t('contacts')),
          h('button', { className: 'dsh-mail-btn', onClick: () => setView(view === 'compose' ? 'inbox' : 'compose'), disabled: !activeId }, t('compose'))
        ),
        flash && h('div', { style: Object.assign({}, S.msg, flash.kind === 'error' ? S.error : S.success) }, flash.text),

        view === 'accounts' && h('div', { className: 'dsh-mail-view', style: S.body },
          (accounts || []).map(a => h('div', { key: a.id, style: S.card },
            h('div', { style: S.row },
              h('strong', null, a.name),
              h('span', { style: S.muted }, ' ' + a.username)
            ),
            h('div', { style: S.hint }, (a.imapHost || '') + ':' + a.imapPort + ' · ' + (a.smtpHost || '') + ':' + a.smtpPort),
            h('div', { style: Object.assign({}, S.row, { marginTop: 10 }) },
              h('button', { className: 'dsh-mail-btn', onClick: () => testAccount(a.id), disabled: busy }, t('test')),
              h('button', { className: 'dsh-mail-btn', onClick: () => { setActiveId(a.id); setView('inbox'); } }, t('inbox')),
              h('button', { className: 'dsh-mail-btn dsh-mail-btn-danger', onClick: () => deleteAccount(a.id), disabled: busy }, t('delete'))
            )
          )),
          h('div', { style: S.card },
            h('div', { style: Object.assign({}, S.row, { marginBottom: 12 }) }, h('strong', null, t('addAccount'))),
            h('div', { style: S.hint, marginBottom: 10 }, t('note')),
            h('div', { style: S.row },
              Object.keys(PRESETS).map(k => h('button', {
                key: k, type: 'button', 'aria-pressed': form.preset === k,
                className: 'dsh-mail-pill' + (form.preset === k ? ' is-active' : ''),
                onClick: () => applyPreset(k),
              }, t(k)))
            ),
            h('div', { style: S.row },
              h('div', { style: S.field }, h('span', { style: S.label }, t('name')), h('input', { style: S.input, value: form.name, onChange: e => setForm(Object.assign({}, form, { name: e.target.value })) })),
              h('div', { style: S.field }, h('span', { style: S.label }, t('username')), h('input', { style: S.input, value: form.username, placeholder: 'me@qq.com', onChange: e => setForm(Object.assign({}, form, { username: e.target.value })) }))
            ),
            h('div', { style: S.field, marginBottom: 8 }, h('span', { style: S.label }, t('authCode')), h('input', { style: S.input, type: 'password', value: form.authCode, onChange: e => setForm(Object.assign({}, form, { authCode: e.target.value })) })),
            h('div', { style: S.row },
              h('div', { style: S.field }, h('span', { style: S.label }, t('imapHost')), h('input', { style: S.input, value: form.imapHost, onChange: e => setForm(Object.assign({}, form, { imapHost: e.target.value })) })),
              h('div', { style: { flex: '0 0 90px' } }, h('span', { style: S.label }, t('imapPort')), h('input', { style: S.input, value: form.imapPort, onChange: e => setForm(Object.assign({}, form, { imapPort: e.target.value })) }))
            ),
            h('div', { style: S.row },
              h('div', { style: S.field }, h('span', { style: S.label }, t('smtpHost')), h('input', { style: S.input, value: form.smtpHost, onChange: e => setForm(Object.assign({}, form, { smtpHost: e.target.value })) })),
              h('div', { style: { flex: '0 0 90px' } }, h('span', { style: S.label }, t('smtpPort')), h('input', { style: S.input, value: form.smtpPort, onChange: e => setForm(Object.assign({}, form, { smtpPort: e.target.value })) }))
            ),
            h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: saveAccount, disabled: busy || !form.username || !form.authCode }, t('save'))
          )
        ),

        view === 'inbox' && h('div', { className: 'dsh-mail-view', style: S.body },
          h('div', { style: S.row },
            accounts && accounts.length > 0
              ? h('select', { style: S.select, value: activeId, onChange: e => setActiveId(e.target.value) }, accounts.map(a => h('option', { key: a.id, value: a.id }, a.name)))
              : h('span', { style: S.hint }, t('noAccounts')),
            h('span', { style: S.spacer }),
            h('button', { className: 'dsh-mail-btn', onClick: loadMessages, disabled: !activeId || busy }, t('refresh')),
            loadingMessages && messages.length > 0 && h('div', { className: 'dsh-mail-spinner', style: { width: 14, height: 14 } }),
          ),
          !activeId ? null : (loadingMessages && messages.length === 0
            ? Loading()
            : (messages.length === 0
              ? h('div', { style: S.hint }, t('noMessages'))
              : messages.map(m => h('div', { key: m.uid, className: 'dsh-mail-item', style: S.item, onClick: () => openMessage(m.uid) },
                h('div', { style: S.subject }, m.subject || t('noSubject')),
                h('div', { style: S.muted }, (m.from || '') + '  ·  ' + (m.date || '')),
                h('div', { style: S.snippet }, m.snippet || '')
              ))
            ))
        ),

        view === 'sent' && h('div', { className: 'dsh-mail-view', style: S.body },
          h('div', { style: S.row },
            h('button', { className: 'dsh-mail-btn', onClick: () => setView('inbox') }, '← ' + t('back')),
            h('span', { style: S.spacer }),
            h('span', { style: S.hint }, account ? account.username : ''),
            h('button', { className: 'dsh-mail-btn', onClick: loadSent, disabled: !activeId || busy }, t('refresh')),
            loadingSent && sent.length > 0 && h('div', { className: 'dsh-mail-spinner', style: { width: 14, height: 14 } }),
          ),
          loadingSent && sent.length === 0
            ? Loading()
            : (sent.length === 0
              ? h('div', { style: S.hint }, t('noSent'))
            : sent.map(m => h('div', { key: m.id, className: 'dsh-mail-item', style: S.item, onClick: () => setSentDetail(m) },
              h('div', { style: S.subject }, m.subject || t('noSubject')),
              h('div', { style: S.muted }, t('to') + ': ' + (m.to || '') + '  ·  ' + (m.date || '')),
              h('div', { style: S.snippet }, m.body || '')
            )))
        ),

        view === 'sent' && sentDetail && h('div', { className: 'dsh-mail-view', style: S.body },
          h('button', { className: 'dsh-mail-btn', style: { alignSelf: 'flex-start' }, onClick: () => setSentDetail(null) }, '‹ ' + t('back')),
          h('h3', { style: S.detailHead }, sentDetail.subject || t('sent')),
          h('div', { style: Object.assign({}, S.muted, S.detailMeta) }, (sentDetail.to || '') + ' · ' + (sentDetail.date || '')),
          h('div', { style: S.mailBody }, String(sentDetail.body || '')),
        ),
        view === 'contacts' && h('div', { className: 'dsh-mail-view', style: S.body },
          h('div', { style: S.row },
            h('button', { className: 'dsh-mail-btn', onClick: () => setView('inbox') }, '← ' + t('back')),
          ),
          h('div', { style: S.hint, marginBottom: 12 }, t('contactsHint')),
          h('div', { style: S.card },
            h('div', { style: S.row },
              h('div', { style: S.field }, h('span', { style: S.label }, t('contactName')), h('input', { style: S.input, value: contactForm.name, onChange: e => setContactForm(Object.assign({}, contactForm, { name: e.target.value })) })),
              h('div', { style: S.field }, h('span', { style: S.label }, t('contactEmail')), h('input', { style: S.input, value: contactForm.email, placeholder: 'friend@example.com', onChange: e => setContactForm(Object.assign({}, contactForm, { email: e.target.value })) }))
            ),
            h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: saveContact, disabled: busy || !contactForm.email }, t('saveContact'))
          ),
          loadingContacts && contacts.length === 0
            ? Loading()
            : (contacts.length === 0
              ? h('div', { style: S.hint }, t('noContacts'))
            : contacts.map(c => h('div', { key: c.email, style: S.item },
              h('div', { style: S.row },
                h('strong', null, c.name || c.email),
                h('span', { style: S.muted }, ' ' + c.email)
              ),
              h('div', { style: S.row },
                h('button', { className: 'dsh-mail-btn', onClick: () => composeTo(c.email) }, t('selectContact')),
                h('button', { className: 'dsh-mail-btn dsh-mail-btn-danger', onClick: () => deleteContact(c.email), disabled: busy }, t('deleteContact'))
              )
            )))
        ),

        view === 'detail' && h('div', { style: Object.assign({}, S.body, { display: 'flex', flexDirection: 'column', alignItems: 'center' }) },
          h('button', { className: 'dsh-mail-btn', style: { alignSelf: 'flex-start' }, onClick: () => setView('inbox') }, '← ' + t('back')),
          detail && h('div', { style: S.detailWrap },
            h('h3', { style: S.detailHead }, detail.subject || t('noSubject')),
            h('div', { style: Object.assign({}, S.muted, S.detailMeta) }, (detail.from || '') + '  →  ' + (detail.to || '') + '  ·  ' + (detail.date || '')),
            h('style', null, S.mailHtmlCss),
            h('div', {
              className: 'dsh-mail-html',
              style: S.mailBody,
              onClick: (e) => {
                const a = e.target && e.target.closest && e.target.closest('a[href]');
                if (!a) return;
                const href = a.getAttribute('href');
                if (!href) return;
                e.preventDefault();
                if (window.open) window.open(href, '_blank', 'noopener,noreferrer');
              },
              dangerouslySetInnerHTML: { __html: detail.html || ('<div style="white-space:pre-wrap">' + escHtml(detail.body || '') + '</div>') },
            })
          )
        ),

        view === 'compose' && h('div', { className: 'dsh-mail-view', style: S.body },
          h('div', { style: S.row },
            h('button', { className: 'dsh-mail-btn', onClick: () => setView('inbox') }, '← ' + t('back')),
            h('span', { style: S.spacer }),
            h('span', { style: S.hint }, account ? account.username : ''),
            h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: sendMail, disabled: busy || !compose.to }, t('send'))
          ),
          h('div', { style: S.field, marginBottom: 10 }, h('span', { style: S.label }, t('to')), h('input', { style: S.input, value: compose.to, placeholder: 'friend@example.com', onChange: e => setCompose(Object.assign({}, compose, { to: e.target.value })) })),
          h('div', { style: S.field, marginBottom: 10 }, h('span', { style: S.label }, t('subject')), h('input', { style: S.input, value: compose.subject, onChange: e => setCompose(Object.assign({}, compose, { subject: e.target.value })) })),
          h('div', { style: S.field }, h('span', { style: S.label }, t('body')), h('textarea', { style: S.textarea, value: compose.body, onChange: e => setCompose(Object.assign({}, compose, { body: e.target.value })) }))
        )
      );
    }

    // Dedicated "邮件" section in the main Settings panel. Reads/writes
    // Config.agentMailAccess through ctx.configForms so this toggle and the AI
    // tool share one host-owned value (no separate storage).
    function MailSettingsSection(props) {
      const { form, t } = props;
      const [snap, setSnap] = useState(() => form.getSnapshot());
      useEffect(() => form.subscribe(() => setSnap(form.getSnapshot())), [form]);
      const stored = snap.value?.agentMailAccess === true;
      const writable = snap.writable === true;
      const available = snap.status !== 'unavailable';
      const [draft, setDraft] = useState(stored);
      const [saving, setSaving] = useState(false);
      const [failed, setFailed] = useState(false);
      // Follow external changes to the host value (e.g. another editor).
      useEffect(() => { setDraft(stored); }, [stored]);
      const dirty = draft !== stored;
      const save = async () => {
        if (saving) return;
        setSaving(true);
        setFailed(false);
        let landed = false;
        try {
          // form.set fences the write with the latest known revision.
          landed = await form.set('agentMailAccess', draft);
        } catch { landed = false; }
        setSaving(false);
        if (!landed) setFailed(true);
      };
      return h('div', { style: { padding: 4 } },
        h('h2', { style: { margin: '0 0 8px', fontSize: 18, lineHeight: 1.4 } }, t('settingsTitle')),
        h('p', { style: { margin: '0 0 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } }, t('settingsDescription')),
        h(SettingsForm, {
          labels: {
            unavailable: t('settingsUnavailable'),
            readOnly: t('settingsReadOnly'),
            saveFailed: t('settingsSaveFailed'),
            save: t('settingsSave'),
            saving: t('settingsSaving'),
          },
          state: {
            available,
            writable,
            dirty,
            invalid: false,
            saving,
            failed,
          },
          onSave: () => { void save(); },
          onDiscard: () => { setDraft(stored); },
          children: [
            h(Checkbox, {
              id: 'settings-dsh-mail-agent-access',
              label: t('agentMailAccessLabel'),
              checked: draft,
              disabled: !writable || saving,
              onChange: (checked) => setDraft(checked === true),
            }),
            h('p', { style: { margin: '8px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, t('agentMailAccessHint')),
          ],
        })
      );
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mail: dictionaries');
        // A top-level "邮件" entry in the main Settings panel, alongside
        // 通用 / 模型 / 插件 / 账号. Shown only while our Config is served.
        const configForm = ctx.configForms.get(NS);
        ctx.effect(() => ctx.configForms.whileServed([NS], () =>
          ctx.slots.inject('settings.section', () => ctx.slots.register({
            name: 'settings.section',
            id: NS,
            order: 25,
            label: () => t('settingsTitle'),
            locale: NS,
            inject: () => ({ form: configForm, t: (k) => t(k) }),
          }, MailSettingsSection))));
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
