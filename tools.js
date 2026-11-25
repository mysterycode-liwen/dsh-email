/**
 * Model-facing mailbox query tool.
 *
 * This tool is intentionally READ-ONLY: it never sends, deletes, or changes
 * mail, and it never exposes credentials (auth codes, passwords). Every call
 * is gated by the `agentMailAccess` setting — when off, the tool returns an
 * explicit "disabled" status and performs no mailbox access at all.
 *
 * All mailbox work is delegated to the plugin's existing request handler via a
 * synthetic Request, so the agent and the sidebar UI share one code path.
 *
 * NOTE: The definition below uses raw JSON Schema directly (the subset that
 * `ctx.tools.register` accepts). We deliberately avoid importing `defineTool`
 * from `@deepseek-ai/dsh-tools` because that package pulls in a deep dependency
 * chain (cordis, dsh-llm, dsh-scope, dsh-util-values, ...) that is not resolvable
 * from a local-link plugin. `defineTool` is only a DSL-to-JSON-Schema converter;
 * a plain ToolDefinition is registered identically.
 */
export function mailQueryTool(ctx, handleRequest, isEnabled) {
  // Gate is asynchronous: the authoritative switch lives in the credential
  // store (same source as the Settings UI), so we read it on every call through
  // the provided predicate. No access is granted unless it returns true.
  const gate = async () => (typeof isEnabled === 'function' && (await isEnabled()) === true);

  function disabledValue() {
    return {
      status: 'disabled',
      message: '邮箱查询未开启。请到插件设置中打开“允许 AI 助手查询邮箱内容”开关后再试。/ Mailbox query is disabled. Enable "Allow the AI assistant to query mailbox content" in the plugin settings first.',
    };
  }

  async function call(op, extra) {
    const url = 'http://dsh-mail.local/api/dsh-mail?op=' + encodeURIComponent(op);
    const request = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, ...extra }),
    });
    const response = await handleRequest(ctx, request);
    return response.json();
  }

  function render(_args, value) {
    if (!value || typeof value !== 'object') {
      return [{ type: 'text', text: String(value) }];
    }
    if (value.status === 'disabled' || value.status === 'error') {
      return [{ type: 'text', text: value.message || String(value.status) }];
    }
    return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
  }

  return {
    name: 'mail_query',
    description: 'Query the configured mailboxes (read-only). Requires the plugin setting "Allow the AI assistant to query mailbox content" to be enabled; otherwise returns a disabled status. Actions: list_accounts (list configured accounts; no secrets), list_messages (list recent messages in a folder), get_message (read one message by uid), sent_messages (recent sent mail). Never sends, deletes, or modifies mail and never returns passwords or authorization codes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Query to run: list_accounts | list_messages | get_message | sent_messages.',
          enum: ['list_accounts', 'list_messages', 'get_message', 'sent_messages'],
        },
        accountId: {
          type: 'string',
          description: 'Account id from list_accounts. Required for list_messages, get_message, and sent_messages.',
        },
        folder: {
          type: 'string',
          description: 'IMAP folder to read. Defaults to INBOX. Only used by list_messages and get_message.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of messages to return (1-100). Defaults to 20. Only used by list_messages and sent_messages.',
        },
        uid: {
          type: 'string',
          description: 'Message uid to read, from list_messages. Required for get_message.',
        },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'disabled | error | ok' },
          message: { type: 'string', description: 'Human-readable message when status is disabled or error.' },
          data: { description: 'Query payload when status is ok.' },
        },
      },
      render,
    },
    async execute(args, exec) {
      if (!(await gate())) return disabledValue();

      try {
        const a = args || {};
        let data;
        switch (a.action) {
          case 'list_accounts': {
            data = await call('listAccounts', {});
            break;
          }
          case 'list_messages': {
            if (!a.accountId) {
              return { status: 'error', message: 'accountId is required for list_messages.' };
            }
            const limit = Math.max(1, Math.min(100, Number(a.limit) || 20));
            data = await call('listMessages', {
              id: a.accountId,
              folder: a.folder || 'INBOX',
              limit,
            });
            break;
          }
          case 'get_message': {
            if (!a.accountId) {
              return { status: 'error', message: 'accountId is required for get_message.' };
            }
            if (!a.uid) {
              return { status: 'error', message: 'uid is required for get_message.' };
            }
            data = await call('getMessage', {
              id: a.accountId,
              uid: a.uid,
              folder: a.folder || 'INBOX',
            });
            break;
          }
          case 'sent_messages': {
            if (!a.accountId) {
              return { status: 'error', message: 'accountId is required for sent_messages.' };
            }
            data = await call('sentMessages', { id: a.accountId });
            break;
          }
          default:
            return { status: 'error', message: 'Unknown action: ' + a.action };
        }

        if (!data || data.ok === false) {
          const message = data && data.error ? String(data.error) : 'Mailbox query failed.';
          return { status: 'error', message };
        }
        // Strip server envelope; keep only the payload the UI would receive.
        const { ok, ...payload } = data;
        return { status: 'ok', data: payload };
      } catch (error) {
        if (exec && exec.signal && exec.signal.aborted) throw error;
        return {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
