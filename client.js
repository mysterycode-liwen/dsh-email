window.__ModuleLoader__.load({
  id: '@mysterycode-liwen/dsh-mail',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect } = React;

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

    // ---------------------------------------------------------------------
    // Visual layer. Everything is class-based and scoped under .dsh-mail so
    // it cannot leak into the host app. Colors come only from DSH theme
    // tokens, so light/dark themes both look native. Interaction feedback
    // uses transform/opacity/brightness (theme-independent) instead of the
    // hardcoded gray buttons the previous version had.
    // ---------------------------------------------------------------------
    const CSS = [
      '.dsh-mail { display:flex; flex-direction:column; height:100%; box-sizing:border-box; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-family:inherit; font-size:13px; line-height:1.5; }',
      '.dsh-mail * { box-sizing:border-box; }',
      '.dsh-mail button, .dsh-mail input, .dsh-mail textarea, .dsh-mail select { font-family:inherit; }',
      '.dsh-mail-spacer { flex:1; min-width:0; }',

      /* top bar */
      '.dsh-mail-topbar { display:flex; align-items:center; gap:12px; padding:14px 18px 13px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }',
      '.dsh-mail-brand { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:650; letter-spacing:.2px; }',
      '.dsh-mail-brandmark { width:32px; height:32px; border-radius:10px; display:grid; place-items:center; background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); box-shadow:0 2px 8px rgba(0,0,0,.14); }',
      '.dsh-mail-brandsub { font-size:11px; color:var(--dsw-alias-label-secondary); font-weight:400; }',

      /* buttons */
      '.dsh-mail-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:7px 12px; font-size:12px; font-weight:600; line-height:1.4; cursor:pointer; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); transition:filter .12s, transform .06s, box-shadow .12s; white-space:nowrap; }',
      '.dsh-mail-btn:hover:not(:disabled) { filter:brightness(.94); }',
      '.dsh-mail-btn:active:not(:disabled) { transform:translateY(1px); box-shadow:inset 0 2px 5px rgba(0,0,0,.12); }',
      '.dsh-mail-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }',
      '.dsh-mail-btn:disabled { opacity:.45; cursor:not-allowed; }',
      '.dsh-mail-btn-primary { background:var(--dsw-alias-brand-primary); border-color:transparent; color:var(--dsw-alias-bg-base); box-shadow:0 2px 8px rgba(0,0,0,.16); }',
      '.dsh-mail-btn-primary:hover:not(:disabled) { filter:brightness(1.08); }',
      '.dsh-mail-btn-danger { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); background:transparent; }',
      '.dsh-mail-btn-danger:hover:not(:disabled) { filter:none; background:var(--dsw-alias-state-error-primary); color:#fff; }',
      '.dsh-mail-iconbtn { width:30px; height:30px; padding:0; border-radius:8px; }',

      /* segmented navigation */
      '.dsh-mail-tabs { display:flex; align-items:center; gap:2px; padding:0 12px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); overflow-x:auto; }',
      '.dsh-mail-tab { position:relative; display:inline-flex; align-items:center; gap:7px; padding:11px 13px 12px; border:0; background:transparent; color:var(--dsw-alias-label-secondary); font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap; transition:color .12s; }',
      '.dsh-mail-tab:hover { color:var(--dsw-alias-label-primary); }',
      '.dsh-mail-tab.is-active { color:var(--dsw-alias-brand-primary); }',
      '.dsh-mail-tab.is-active::after { content:""; position:absolute; left:10px; right:10px; bottom:0; height:2px; border-radius:2px 2px 0 0; background:var(--dsw-alias-brand-primary); }',
      '.dsh-mail-badge { display:grid; place-items:center; min-width:17px; height:17px; padding:0 5px; border-radius:9px; background:var(--dsw-alias-brand-primary); color:var(--dsw-alias-bg-base); font-size:10px; font-weight:700; }',

      /* account chip */
      '.dsh-mail-accountbar { display:flex; align-items:center; gap:9px; padding:9px 16px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); }',
      '.dsh-mail-select { flex:1; min-width:0; max-width:320px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:6px 9px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:12px; cursor:pointer; }',

      /* message list */
      '.dsh-mail-list { flex:1; min-height:0; overflow:auto; padding:6px 8px 18px; }',
      '.dsh-mail-row { display:flex; align-items:flex-start; gap:11px; padding:12px 11px; border-radius:11px; border:1px solid transparent; cursor:pointer; transition:background .12s, border-color .12s; }',
      '.dsh-mail-row:hover { background:var(--dsw-alias-bg-layer-2); }',
      '.dsh-mail-row:active { transform:scale(.995); }',
      '.dsh-mail-avatar { width:36px; height:36px; flex:none; border-radius:50%; display:grid; place-items:center; color:#fff; font-size:14px; font-weight:700; box-shadow:inset 0 -6px 10px rgba(0,0,0,.10); }',
      '.dsh-mail-rowmain { flex:1; min-width:0; }',
      '.dsh-mail-rowtop { display:flex; align-items:baseline; gap:8px; }',
      '.dsh-mail-from { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; font-size:13px; }',
      '.dsh-mail-time { flex:none; font-size:11px; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-subject { margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12.5px; }',
      '.dsh-mail-preview { margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11.5px; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-row.is-unread { background:color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent); border-left:3px solid var(--dsw-alias-brand-primary); padding-left:8px; }',
      '.dsh-mail-row.is-unread .dsh-mail-from, .dsh-mail-row.is-unread .dsh-mail-subject { color:var(--dsw-alias-label-primary); font-weight:700; }',
      '.dsh-mail-unread { width:9px; height:9px; margin-top:7px; flex:none; border-radius:50%; background:var(--dsw-alias-brand-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); }',
      '.dsh-mail-read .dsh-mail-from, .dsh-mail-read .dsh-mail-subject { color:var(--dsw-alias-label-secondary); font-weight:400; }',

      /* cards / forms */
      '.dsh-mail-card { border:1px solid var(--dsw-alias-border-l1); border-radius:12px; padding:16px; margin-bottom:12px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 1px 3px rgba(0,0,0,.05); }',
      '.dsh-mail-cardhead { display:flex; align-items:center; gap:8px; margin-bottom:14px; font-size:14px; font-weight:650; }',
      '.dsh-mail-grid { display:flex; gap:12px; flex-wrap:wrap; }',
      '.dsh-mail-field { display:flex; flex-direction:column; gap:5px; flex:1; min-width:160px; margin-bottom:11px; }',
      '.dsh-mail-label { font-size:11px; font-weight:600; color:var(--dsw-alias-label-secondary); }',
      '.dsh-mail-input, .dsh-mail-textarea, .dsh-mail-selectinput { width:100%; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:8px 10px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:13px; transition:border-color .12s, box-shadow .12s; }',
      '.dsh-mail-input:focus, .dsh-mail-textarea:focus, .dsh-mail-selectinput:focus { outline:none; border-color:var(--dsw-alias-brand-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); }',
      '.dsh-mail-textarea { min-height:200px; resize:vertical; line-height:1.6; }',
      '.dsh-mail-hint { font-size:11.5px; color:var(--dsw-alias-label-secondary); line-height:1.6; }',

      /* presets */
      '.dsh-mail-pill { display:inline-flex; align-items:center; gap:5px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; padding:5px 12px; font-size:11.5px; font-weight:600; cursor:pointer; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-secondary); transition:all .12s; }',
      '.dsh-mail-pill:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-brand-primary); }',
      '.dsh-mail-pill:active { transform:translateY(1px); }',
      '.dsh-mail-pill.is-active { background:var(--dsw-alias-brand-primary); border-color:transparent; color:var(--dsw-alias-bg-base); }',

      /* flash */
      '.dsh-mail-flash { display:flex; align-items:flex-start; gap:8px; margin:12px 16px 0; padding:10px 12px; border-radius:9px; font-size:12px; line-height:1.55; white-space:pre-wrap; }',
      '.dsh-mail-flash-error { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent); color:var(--dsw-alias-state-error-primary); border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent); }',
      '.dsh-mail-flash-success { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 14%, transparent); color:var(--dsw-alias-state-success-primary); border:1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 30%, transparent); }',

      /* empty & loading */
      '.dsh-mail-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:64px 28px; text-align:center; }',
      '.dsh-mail-emptyicon { width:56px; height:56px; border-radius:18px; display:grid; place-items:center; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); margin-bottom:4px; }',
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
      '.dsh-mail-detailhead { padding:20px 4px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); margin-bottom:16px; }',
      '.dsh-mail-detailtitle { margin:0 0 12px; font-size:20px; font-weight:650; line-height:1.4; }',
      '.dsh-mail-detailfrom { display:flex; align-items:center; gap:10px; }',
      '.dsh-mail-detailmeta { font-size:11.5px; color:var(--dsw-alias-label-secondary); margin-top:2px; }',
      '.dsh-mail-mailbody { width:100%; padding:18px; border:1px solid var(--dsw-alias-border-l1); border-radius:12px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); line-height:1.75; overflow-wrap:anywhere; word-break:break-word; }',

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
    ].join('\n');

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

    // Solid envelope for the sidebar panel icon (the sidebar draws its own
    // button; this component only renders the glyph).
    function Icon({ size, active }) {
      return h('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { fill: active ? 'var(--dsw-alias-brand-primary)' : 'currentColor', d: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 8.2L4.2 7h15.6L12 13.2zM4 8.3V17h16V8.3l-8 6.1-8-6.1z' })
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
      const [messages, setMessages] = usePersistent('messages', []);
      const [detail, setDetail] = usePersistent('detail', null);
      const [busy, setBusy] = useState(false);
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
      // Per-account cache of fetched message lists. Survives account switching
      // and remounts so we can show cached mail immediately while refreshing.
      const [cache, setCache] = usePersistent('mailCache', {});

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

      async function loadMessages(showProgress) {
        if (!activeId) return;
        // Cache-first: if we already have this account's list, keep it visible
        // while the fresh list loads in the background (no blank/Loading flash).
        const cached = cache[activeId];
        if (showProgress !== false) setLoadingMessages(!(cached && cached.length));
        try {
          const data = await rpc('listMessages', { id: activeId, limit: 25 });
          const fresh = data.messages || [];
          setMessages(fresh);
          setCache(prev => Object.assign({}, prev, { [activeId]: fresh }));
        } catch (e) {
          reportError(e);
        } finally {
          setLoadingMessages(false);
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
          PERSIST.loadedIds = { inbox: activeId, sent: activeId, contacts: activeId };
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

      async function openMessage(msg) {
        const uid = typeof msg === 'object' ? msg.uid : msg;
        // Mark as read locally right away: update the visible list, the unread
        // badge, and the per-account cache so the change survives switching away.
        const markRead = (list) => (list || []).map(m => String(m.uid) === String(uid) ? Object.assign({}, m, { seen: true }) : m);
        setMessages(prev => markRead(prev));
        setCache(prev => Object.assign({}, prev, { [activeId]: markRead(prev[activeId]) }));
        setBusy(true);
        try {
          const data = await rpc('getMessage', { id: activeId, uid });
          const full = data.message || data;
          setDetail(Object.assign({}, full, { seen: true }));
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

      function refreshCurrent() {
        if (view === 'sent') loadSent();
        else if (view === 'contacts') loadContacts();
        else loadMessages();
      }

      function composeTo(email) {
        setCompose(Object.assign({}, compose, { to: email }));
        setView('compose');
      }

      const account = (accounts || []).find(a => a.id === activeId);
      const unread = (messages || []).filter(m => m && m.seen === false).length;
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

        flash && h('div', { className: 'dsh-mail-flash ' + (flash.kind === 'error' ? 'dsh-mail-flash-error' : 'dsh-mail-flash-success') },
          h(Ico, { name: flash.kind === 'error' ? 'warning' : 'check', size: 15 }),
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
          h('button', { className: 'dsh-mail-btn dsh-mail-iconbtn', onClick: refreshCurrent, disabled: !activeId || busy, title: t('refresh') }, h(Ico, { name: 'refresh', size: 15 }))
        ),

        /* ------------------------------- INBOX ------------------------------ */
        view === 'inbox' && h('div', { className: 'dsh-mail-view' },
          !activeId
            ? h(Empty, { icon: 'user', title: t('accounts'), sub: t('noAccounts') })
            : (loadingMessages && messages.length === 0)
              ? h(Loading)
              : (messages.length === 0)
                ? h(Empty, { icon: 'inbox', title: t('inbox'), sub: t('noMessages') })
                : h('div', { className: 'dsh-mail-list' }, messages.map(m =>
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
                h('h2', { className: 'dsh-mail-detailtitle' }, sentDetail.subject || t('noSubject')),
                h('div', { className: 'dsh-mail-detailmeta' }, t('to') + ': ' + (sentDetail.to || '') + ' · ' + fmtDate(sentDetail.date))
              ),
              h('div', { className: 'dsh-mail-mailbody', style: { whiteSpace: 'pre-wrap' } }, String(sentDetail.body || ''))
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
                  h('div', { style: { fontWeight: 650 } }, a.name),
                  h('div', { className: 'dsh-mail-hint' }, a.username)
                )
              ),
              h('div', { className: 'dsh-mail-hint', style: { marginBottom: 12 } }, (a.imapHost || '') + ':' + a.imapPort + ' · ' + (a.smtpHost || '') + ':' + a.smtpPort),
              h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                h('button', { className: 'dsh-mail-btn', onClick: () => testAccount(a.id), disabled: busy }, h(Ico, { name: 'check', size: 14 }), t('test')),
                h('button', { className: 'dsh-mail-btn', onClick: () => { setActiveId(a.id); navTo('inbox'); } }, h(Ico, { name: 'inbox', size: 14 }), t('inbox')),
                h('button', { className: 'dsh-mail-btn dsh-mail-btn-danger', onClick: () => deleteAccount(a.id), disabled: busy }, h(Ico, { name: 'trash', size: 14 }), t('delete'))
              )
            )),
            h('div', { className: 'dsh-mail-card' },
              h('div', { className: 'dsh-mail-cardhead' }, h(Ico, { name: 'plus', size: 16 }), t('addAccount')),
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
                  h('input', { className: 'dsh-mail-input', value: form.name, onChange: e => setForm(Object.assign({}, form, { name: e.target.value })) })
                ),
                h('div', { className: 'dsh-mail-field' },
                  h('span', { className: 'dsh-mail-label' }, t('username')),
                  h('input', { className: 'dsh-mail-input', value: form.username, placeholder: 'me@qq.com', onChange: e => setForm(Object.assign({}, form, { username: e.target.value })) })
                )
              ),
              h('div', { className: 'dsh-mail-field' },
                h('span', { className: 'dsh-mail-label' }, t('authCode')),
                h('input', { className: 'dsh-mail-input', type: 'password', value: form.authCode, onChange: e => setForm(Object.assign({}, form, { authCode: e.target.value })) })
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

        /* ------------------------------- DETAIL ----------------------------- */
        view === 'detail' && h('div', { className: 'dsh-mail-view' },
          h('div', { className: 'dsh-mail-scroll' },
            h('button', { className: 'dsh-mail-btn', onClick: () => setView('inbox') }, h(Ico, { name: 'back', size: 15 }), t('back')),
            detail && h('div', null,
              h('div', { className: 'dsh-mail-detailhead' },
                h('h2', { className: 'dsh-mail-detailtitle' }, detail.subject || t('noSubject')),
                h('div', { className: 'dsh-mail-detailfrom' },
                  h('div', { className: 'dsh-mail-avatar', style: { background: avatarColor(detail.from || detail.subject) } }, avatarLetter(detail.from || detail.subject)),
                  h('div', { style: { minWidth: 0 } },
                    h('div', { style: { fontWeight: 600 } }, String(detail.from || '').replace(/<.*>/, '').trim() || detail.from || ''),
                    h('div', { className: 'dsh-mail-detailmeta' }, t('to') + ': ' + (detail.to || '') + ' · ' + fmtDate(detail.date))
                  )
                )
              ),
              h('div', {
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
              })
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
                h('button', { className: 'dsh-mail-btn dsh-mail-btn-primary', onClick: sendMail, disabled: busy || !compose.to }, h(Ico, { name: 'sent', size: 15 }), t('send'))
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
    function MailSettingsSection(props) {
      const tr = props && props.t ? props.t : t;
      const [draft, setDraft] = useState(false);
      const [stored, setStored] = useState(false);
      const [saving, setSaving] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [failed, setFailed] = useState(false);

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
            const on = data && data.ok && data.settings && data.settings.agentMailAccess === true;
            setStored(on);
            setDraft(on);
            setLoaded(true);
          })
          .catch(() => { if (alive) setLoaded(true); });
        return () => { alive = false; };
      }, []);

      const save = async () => {
        if (saving) return;
        setSaving(true);
        setFailed(false);
        try {
          const r = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ op: 'setSettings', value: { agentMailAccess: draft } }),
          });
          const data = await r.json();
          if (!r.ok || !data || data.ok === false) throw new Error('save failed');
          setStored(draft);
        } catch { setFailed(true); }
        setSaving(false);
      };

      const dirty = draft !== stored;
      return h('div', { style: { padding: 4, maxWidth: 560 } },
        h('h2', { style: { margin: '0 0 8px', fontSize: 18, lineHeight: 1.4 } }, tr('settingsTitle')),
        h('p', { style: { margin: '0 0 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } }, tr('settingsDescription')),
        h('label', {
          htmlFor: 'settings-dsh-mail-agent-access',
          style: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)' },
        },
          h('input', {
            id: 'settings-dsh-mail-agent-access',
            type: 'checkbox',
            checked: draft,
            disabled: saving || !loaded,
            onChange: (e) => setDraft(!!(e && e.target && e.target.checked)),
            style: { width: 16, height: 16, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
          }),
          tr('agentMailAccessLabel')
        ),
        h('p', { style: { margin: '8px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, tr('agentMailAccessHint')),
        failed ? h('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, tr('settingsSaveFailed')) : null,
        h('div', { style: { display: 'flex', gap: 8, marginTop: 16 } },
          h('button', {
            type: 'button',
            disabled: !dirty || saving,
            onClick: () => { void save(); },
            style: {
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: dirty && !saving ? 'pointer' : 'default',
              background: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)', fontSize: 13,
              opacity: dirty && !saving ? 1 : 0.5,
            },
          }, saving ? tr('settingsSaving') : tr('settingsSave')),
          dirty ? h('button', {
            type: 'button',
            disabled: saving,
            onClick: () => setDraft(stored),
            style: {
              padding: '6px 16px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)',
              background: 'transparent', color: 'var(--dsw-alias-label-primary)', fontSize: 13, cursor: 'pointer',
            },
          }, tr('cancel')) : null
        )
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mail: dictionaries');
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
