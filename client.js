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
    };

    const S = {
      root: { display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)', fontFamily: 'inherit', fontSize: 13 },
      header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-1)' },
      title: { fontWeight: 600, fontSize: 15 },
      spacer: { flex: 1 },
      btn: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-2)', color: 'var(--dsw-alias-label-primary)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 },
      primary: { border: '1px solid var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-brand-primary)', color: '#fff', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 },
      body: { flex: 1, overflow: 'auto', padding: 16 },
      card: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--dsw-alias-bg-layer-1)' },
      row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
      field: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
      label: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      input: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '7px 9px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box' },
      textarea: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '7px 9px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box', minHeight: 180, resize: 'vertical' },
      hint: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.5 },
      msg: { fontSize: 12, padding: '6px 10px', borderRadius: 6, marginBottom: 10 },
      error: { background: 'var(--dsw-alias-state-error-primary)', color: '#fff' },
      success: { background: 'var(--dsw-alias-state-success-primary)', color: '#fff' },
      item: { borderBottom: '1px solid var(--dsw-alias-border-l1)', padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 },
      subject: { fontWeight: 600 },
      muted: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      snippet: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      pill: { fontSize: 11, padding: '3px 8px', borderRadius: 12, border: '1px solid var(--dsw-alias-border-l2)', cursor: 'pointer' },
      select: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 6, padding: '5px 8px', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', fontSize: 12 },
      mailBody: { lineHeight: 1.6, padding: 12, border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-1)', overflowWrap: 'anywhere' },
      mailHtmlCss: [
        '.dsh-mail-html a { color: var(--dsw-alias-brand-primary); text-decoration: underline; cursor: pointer; }',
        '.dsh-mail-html img { max-width: 100%; height: auto; border-radius: 6px; }',
        '.dsh-mail-html p, .dsh-mail-html div { margin: 0 0 8px; }',
        '.dsh-mail-html table { max-width: 100%; border-collapse: collapse; }',
        '.dsh-mail-html blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }',
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

    function MailPanel() {
      const [accounts, setAccounts] = usePersistent('accounts', null);
      const [activeId, setActiveId] = usePersistent('activeId', '');
      const [view, setView] = usePersistent('view', 'inbox');
      const [messages, setMessages] = usePersistent('messages', []);
      const [detail, setDetail] = usePersistent('detail', null);
      const [busy, setBusy] = useState(false);
      const [flash, setFlash] = useState(null);
      const [form, setForm] = usePersistent('form', { preset: 'qq', name: '', username: '', authCode: '', imapHost: PRESETS.qq.imapHost, imapPort: 993, smtpHost: PRESETS.qq.smtpHost, smtpPort: 465 });
      const [compose, setCompose] = usePersistent('compose', { to: '', subject: '', body: '' });

      useEffect(() => {
        if (!PERSIST.accounts) refreshAccounts();
      }, []);

      function notify(kind, text) {
        setFlash({ kind, text });
      }

      async function rpc(op, extra) {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ op }, extra || {})),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
        return data;
      }

      async function refreshAccounts() {
        try {
          const data = await rpc('listAccounts');
          setAccounts(data.accounts || []);
          if (!activeId && data.accounts && data.accounts.length) setActiveId(data.accounts[0].id);
        } catch (e) {
          notify('error', e.message);
        }
      }

      async function loadMessages() {
        if (!activeId) return;
        setBusy(true);
        try {
          const data = await rpc('listMessages', { id: activeId, limit: 25 });
          setMessages(data.messages || []);
        } catch (e) {
          notify('error', e.message);
        } finally {
          setBusy(false);
        }
      }

      // Only (re)load the list when the ACCOUNT actually changes — never on
      // view changes (inbox→detail→inbox), so entering a mail no longer blanks
      // it and returning does not refetch. PERSIST.loadedId guards remounts.
      useEffect(() => {
        if (!activeId) {
          setMessages([]);
          setDetail(null);
          PERSIST.loadedId = '';
          return;
        }
        if (PERSIST.loadedId !== activeId) {
          setMessages([]);
          setDetail(null);
          PERSIST.loadedId = activeId;
          loadMessages();
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
          notify('error', e.message);
        } finally {
          setBusy(false);
        }
      }

      async function testAccount(id) {
        setBusy(true);
        try {
          const data = await rpc('testAccount', { id });
          notify(data.ok ? 'success' : 'error', data.ok ? t('ok') : data.error);
        } catch (e) {
          notify('error', e.message);
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
          notify('error', e.message);
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
          notify('error', e.message);
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
          setView('inbox');
        } catch (e) {
          notify('error', e.message);
        } finally {
          setBusy(false);
        }
      }

      const account = (accounts || []).find(a => a.id === activeId);

      return h('div', { style: S.root },
        h('div', { style: S.header },
          h('span', { style: S.title }, t('label')),
          h('span', { style: S.spacer }),
          h('button', { style: S.btn, onClick: () => setView('accounts') }, t('accounts')),
          h('button', { style: S.btn, onClick: () => setView(view === 'compose' ? 'inbox' : 'compose'), disabled: !activeId }, t('compose'))
        ),
        flash && h('div', { style: Object.assign({}, S.msg, flash.kind === 'error' ? S.error : S.success) }, flash.text),

        view === 'accounts' && h('div', { style: S.body },
          (accounts || []).map(a => h('div', { key: a.id, style: S.card },
            h('div', { style: S.row },
              h('strong', null, a.name),
              h('span', { style: S.muted }, ' ' + a.username)
            ),
            h('div', { style: S.hint }, (a.imapHost || '') + ':' + a.imapPort + ' · ' + (a.smtpHost || '') + ':' + a.smtpPort),
            h('div', { style: Object.assign({}, S.row, { marginTop: 10 }) },
              h('button', { style: S.btn, onClick: () => testAccount(a.id), disabled: busy }, t('test')),
              h('button', { style: S.btn, onClick: () => { setActiveId(a.id); setView('inbox'); } }, t('inbox')),
              h('button', { style: S.btn, onClick: () => deleteAccount(a.id), disabled: busy }, t('delete'))
            )
          )),
          h('div', { style: S.card },
            h('div', { style: Object.assign({}, S.row, { marginBottom: 12 }) }, h('strong', null, t('addAccount'))),
            h('div', { style: S.hint, marginBottom: 10 }, t('note')),
            h('div', { style: S.row },
              Object.keys(PRESETS).map(k => h('button', {
                key: k, type: 'button', 'aria-pressed': form.preset === k,
                style: Object.assign({}, S.pill, form.preset === k ? { borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-brand-primary)' } : {}),
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
            h('button', { style: S.primary, onClick: saveAccount, disabled: busy || !form.username || !form.authCode }, t('save'))
          )
        ),

        view === 'inbox' && h('div', { style: S.body },
          h('div', { style: S.row },
            accounts && accounts.length > 0
              ? h('select', { style: S.select, value: activeId, onChange: e => setActiveId(e.target.value) }, accounts.map(a => h('option', { key: a.id, value: a.id }, a.name)))
              : h('span', { style: S.hint }, t('noAccounts')),
            h('span', { style: S.spacer }),
            h('button', { style: S.btn, onClick: loadMessages, disabled: !activeId || busy }, t('refresh'))
          ),
          !activeId ? null : (busy && messages.length === 0
            ? h('div', { style: S.hint }, t('loading'))
            : (messages.length === 0
              ? h('div', { style: S.hint }, t('noMessages'))
              : messages.map(m => h('div', { key: m.uid, style: S.item, onClick: () => openMessage(m.uid) },
                h('div', { style: S.subject }, m.subject || t('noSubject')),
                h('div', { style: S.muted }, (m.from || '') + '  ·  ' + (m.date || '')),
                h('div', { style: S.snippet }, m.snippet || '')
              ))
            ))
        ),

        view === 'detail' && h('div', { style: S.body },
          h('button', { style: S.btn, onClick: () => setView('inbox') }, '← ' + t('back')),
          detail && h('div', { style: { marginTop: 12 } },
            h('h3', null, detail.subject || t('noSubject')),
            h('div', { style: S.muted, marginBottom: 12 }, (detail.from || '') + '  →  ' + (detail.to || '') + '  ·  ' + (detail.date || '')),
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

        view === 'compose' && h('div', { style: S.body },
          h('div', { style: S.row },
            h('button', { style: S.btn, onClick: () => setView('inbox') }, '← ' + t('back')),
            h('span', { style: S.spacer }),
            h('span', { style: S.hint }, account ? account.username : ''),
            h('button', { style: S.primary, onClick: sendMail, disabled: busy || !compose.to }, t('send'))
          ),
          h('div', { style: S.field, marginBottom: 10 }, h('span', { style: S.label }, t('to')), h('input', { style: S.input, value: compose.to, placeholder: 'friend@example.com', onChange: e => setCompose(Object.assign({}, compose, { to: e.target.value })) })),
          h('div', { style: S.field, marginBottom: 10 }, h('span', { style: S.label }, t('subject')), h('input', { style: S.input, value: compose.subject, onChange: e => setCompose(Object.assign({}, compose, { subject: e.target.value })) })),
          h('div', { style: S.field }, h('span', { style: S.label }, t('body')), h('textarea', { style: S.textarea, value: compose.body, onChange: e => setCompose(Object.assign({}, compose, { body: e.target.value })) }))
        )
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mail: dictionaries');
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
