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
      notifyTestTitle: '邮件播报测试',
      notifyTestBody: '如果你看到桌宠说话，说明新邮件播报已正常工作。',
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
      notifyTestTitle: 'Mail announcement test',
      notifyTestBody: 'If your desktop pet speaks, new mail announcements are working.',
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
      NOTIFY.disposeTimer = armPoller(() => { void pollNewMail(); }, delayMs);
      NOTIFY.diag.running = true;
      NOTIFY.diag.error = null;
      void pollNewMail(); // seed baselines on start without spamming old mail
    }

    // Detect new mail and alert. Returns a diag snapshot so the "check now"
    // button can show what actually happened.
    async function pollNewMail() {
      if (NOTIFY.busy) return Object.assign({}, NOTIFY.diag);
      NOTIFY.busy = true;
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
        for (const acc of accounts) {
          try {
            const mr = await fetch(API, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ op: 'listMessages', id: acc.id, limit: 20 }),
            });
            const md = await mr.json();
            if (!md || md.ok === false || !Array.isArray(md.messages)) {
              NOTIFY.diag.error = 'listMessages:' + (acc.name || acc.id) + ':' + (md && md.error ? md.error : 'bad-response');
              continue;
            }
            const uids = md.messages.map(m => String(m.uid));
            const prev = NOTIFY.baselines[acc.id];
            NOTIFY.baselines[acc.id] = uids;
            if (!prev) {
              // First observation: normally seed only, but a mail that arrived
              // during a restart (unread + recent Date header) must still alert.
              const recent = md.messages.filter(m =>
                m && m.seen === false && m.date &&
                (now - Date.parse(m.date)) >= 0 &&
                (now - Date.parse(m.date)) <= RECENT_MAIL_MS
              );
              if (recent.length === 0) continue;
              const latest = recent[0] || {};
              const who = acc.name ? acc.name + '：' : '';
              const res = await deliverAlert(
                t('notifyTitle'),
                who + (latest.subject || t('noSubject')) + ' · ' + recent.length + ' ' + t('notifyBody'),
                { tag: 'dsh-mail-new' }
              );
              NOTIFY.diag.alerts += 1;
              NOTIFY.diag.lastAlert = Date.now();
              if (!res.petOk && !res.sysOk) NOTIFY.diag.error = 'deliver:' + (NOTIFY.lastError || 'no-channel');
              continue;
            }
            const prevSet = new Set(prev);
            const fresh = md.messages.filter(m => !prevSet.has(String(m.uid)));
            if (fresh.length > 0) {
              const latest = fresh[0] || {};
              const who = acc.name ? acc.name + '：' : '';
              const res = await deliverAlert(
                t('notifyTitle'),
                who + (latest.subject || t('noSubject')) + ' · ' + fresh.length + ' ' + t('notifyBody'),
                { tag: 'dsh-mail-new' }
              );
              NOTIFY.diag.alerts += 1;
              NOTIFY.diag.lastAlert = Date.now();
              if (!res.petOk && !res.sysOk) NOTIFY.diag.error = 'deliver:' + (NOTIFY.lastError || 'no-channel');
            }
          } catch (e) {
            NOTIFY.diag.error = 'account:' + (acc.name || acc.id) + ':' + (e && e.message ? e.message : String(e));
          }
        }
      } catch (e) {
        NOTIFY.diag.error = 'poll:' + (e && e.message ? e.message : String(e));
      } finally {
        NOTIFY.busy = false;
      }
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
      const [draft, setDraft] = useState({ agentMailAccess: false, notifyEnabled: true, notifyInterval: 60, notifyMode: 'pet' });
      const [stored, setStored] = useState({ agentMailAccess: false, notifyEnabled: true, notifyInterval: 60, notifyMode: 'pet' });
      const [saving, setSaving] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [failed, setFailed] = useState(false);
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
        setSaved(false);
        try {
          const r = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ op: 'setSettings', value: draft }),
          });
          const data = await r.json();
          if (!r.ok || !data || data.ok === false) throw new Error('save failed');
          // The Host normalizes values (e.g. clamps the interval to 15..3600
          // and whitelists notifyMode). Write the applied settings back into
          // BOTH stored and draft, otherwise dirty stays true after save and
          // the save button never clears — which looks like a failed save.
          const applied = data.settings || draft;
          setStored(applied);
          setDraft(applied);
          NOTIFY.settings = {
            notifyEnabled: applied.notifyEnabled !== false,
            notifyInterval: Number(applied.notifyInterval) || 60,
            notifyMode: applied.notifyMode || 'pet',
          };
          startPoller();
          setSaved(true);
        } catch { setFailed(true); }
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

      const field = {
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        fontSize: 14, lineHeight: 1.5, color: 'var(--dsw-alias-label-primary)',
      };
      const hint = { margin: '6px 0 0', fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' };
      const numInput = {
        width: 84, padding: '4px 8px', borderRadius: 6, fontSize: 13,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
      };
      const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
      // In pure system-notification mode, hide all pet-related copy.
      const isSystemOnly = (draft.notifyMode || 'pet') === 'system';
      return h('div', { style: { padding: 4, maxWidth: 560 } },
        h('h2', { style: { margin: '0 0 8px', fontSize: 18, lineHeight: 1.4 } }, tr('settingsTitle')),

        // AI assistant access toggle (unchanged behaviour).
        h('p', { style: { margin: '0 0 12px', fontSize: 13, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } }, tr('settingsDescription')),
        h('label', { htmlFor: 'settings-dsh-mail-agent-access', style: field },
          h('input', {
            id: 'settings-dsh-mail-agent-access', type: 'checkbox',
            checked: draft.agentMailAccess, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, agentMailAccess: !!(e && e.target && e.target.checked) }),
            style: { width: 16, height: 16, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
          }),
          tr('agentMailAccessLabel')
        ),
        h('p', { style: hint }, tr('agentMailAccessHint')),

        // New-mail notification section.
        h('h3', { style: { margin: '24px 0 8px', fontSize: 15, lineHeight: 1.4 } }, tr('notifySectionTitle')),
        h('p', { style: { margin: '0 0 12px', fontSize: 13, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } }, tr(isSystemOnly ? 'notifySectionHintSystem' : 'notifySectionHint')),
        h('label', { htmlFor: 'settings-dsh-mail-notify', style: field },
          h('input', {
            id: 'settings-dsh-mail-notify', type: 'checkbox',
            checked: draft.notifyEnabled, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyEnabled: !!(e && e.target && e.target.checked) }),
            style: { width: 16, height: 16, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
          }),
          tr(isSystemOnly ? 'notifyEnabledLabelSystem' : 'notifyEnabledLabel')
        ),
        h('label', { htmlFor: 'settings-dsh-mail-interval', style: { ...field, marginTop: 10 } },
          h('span', null, tr('notifyIntervalLabel')),
          h('input', {
            id: 'settings-dsh-mail-interval', type: 'number', min: 15, max: 3600,
            value: draft.notifyInterval, disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyInterval: Number(e && e.target && e.target.value) || 60 }),
            style: numInput,
          })
        ),
        h('label', { htmlFor: 'settings-dsh-mail-mode', style: { ...field, marginTop: 10 } },
          h('span', null, tr('notifyMode')),
          h('select', {
            id: 'settings-dsh-mail-mode',
            value: draft.notifyMode || 'pet',
            disabled: saving || !loaded,
            onChange: (e) => setDraft({ ...draft, notifyMode: (e && e.target && e.target.value) || 'pet' }),
            style: numInput,
          },
            h('option', { value: 'pet' }, tr('notifyModePet')),
            h('option', { value: 'system' }, tr('notifyModeSystem')),
            h('option', { value: 'both' }, tr('notifyModeBoth'))
          )
        ),

        // Permission row.
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 } },
          h('button', {
            type: 'button', disabled: asking || perm === 'granted' || perm === 'unsupported',
            onClick: () => { void requestPerm(); },
            style: {
              padding: '6px 16px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)',
              fontSize: 13, cursor: asking || perm === 'granted' ? 'default' : 'pointer',
              opacity: asking || perm === 'granted' ? 0.6 : 1,
            },
          }, asking ? tr('notifyPermissionAsking') : tr('notifyPermission')),
          h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
            perm === 'granted' ? tr('notifyPermissionGranted')
              : perm === 'denied' ? tr('notifyPermissionDenied')
              : perm === 'unsupported' ? tr('notifyPermissionUnsupported') : ''
          ),
          h('button', {
            type: 'button', disabled: asking,
            onClick: () => { void sendTest(); },
            style: {
              padding: '6px 16px', borderRadius: 6, border: 'none',
              background: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-bg-base)',
              fontSize: 13, cursor: asking ? 'default' : 'pointer',
              opacity: asking ? 0.5 : 1,
            },
          }, tr('notifyTest'))
        ),
        testMsg ? h('p', {
          style: { ...hint, color: tested ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' },
        }, testMsg) : null,

        // Live detection diagnostics + manual check. These make the otherwise
        // invisible background chain observable to the user and to us.
        h('div', { style: { marginTop: 14, padding: 10, borderRadius: 6, background: 'var(--dsw-alias-bg-layer-1)', border: '1px solid var(--dsw-alias-border-l2)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            h('strong', { style: { fontSize: 13, color: 'var(--dsw-alias-label-primary)' } }, tr('notifyDiagTitle')),
            h('span', { style: { fontSize: 12, color: diag.running ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' } },
              diag.running ? tr('notifyDiagRunning') : tr('notifyDiagStopped')),
            h('span', { className: 'dsh-mail-spacer' }),
            h('button', {
              type: 'button', disabled: checking || !loaded,
              onClick: () => { void checkNow(); },
              style: {
                padding: '5px 12px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)',
                fontSize: 12, cursor: checking || !loaded ? 'default' : 'pointer',
                opacity: checking || !loaded ? 0.6 : 1,
              },
            }, checking ? tr('notifyChecking') : tr('notifyCheckNow'))
          ),
          h('div', { style: { marginTop: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--dsw-alias-label-secondary)' } },
            tr('notifyDiagAccounts') + ': ' + (diag.accounts || 0) + '  ·  ' +
            tr('notifyDiagChecks') + ': ' + (diag.checks || 0) + '  ·  ' +
            tr(isSystemOnly ? 'notifyDiagAlertsSystem' : 'notifyDiagAlerts') + ': ' + (diag.alerts || 0) + '  ·  ' +
            tr('notifyDiagLastCheck') + ': ' + (diag.lastCheck ? new Date(diag.lastCheck).toLocaleString() : tr('notifyDiagNever'))
          ),
          h('div', { style: { marginTop: 2, fontSize: 12, lineHeight: 1.7, color: diag.error ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)' } },
            tr('notifyDiagError') + ': ' + (diag.error || tr('notifyDiagOk'))
          ),
          checkMsg ? h('p', { style: { margin: '6px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, checkMsg) : null
        ),

        failed
          ? h('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, tr('settingsSaveFailed'))
          : saved
            ? h('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } }, tr('settingsSaveSuccess'))
            : null,
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
