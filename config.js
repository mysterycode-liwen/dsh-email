import z from '@deepseek-ai/schemastery';

/**
 * Read one configuration value a volatile field hands over as a live reference.
 *
 * A volatile field arrives as an object carrying `get()` instead of the stored
 * value, and a Settings write updates that object in place — reading it per
 * operation is what lets the toggle saved on the Settings page apply without
 * reloading the plugin.
 */
export function liveValue(value) {
  const getter = value && value.get;
  return typeof getter === 'function' ? getter.call(value) : value;
}

/**
 * The mail plugin's user-editable settings.
 *
 * `.volatile()` is what makes the switch reachable from the browser: DSH only
 * serves a settings namespace when Config exposes at least one volatile field,
 * and accepts a write only beneath a volatile node. The default is false, so
 * the AI assistant cannot read mail until the user explicitly turns it on.
 */
export const Config = z.object({
  agentMailAccess: z.boolean()
    .default(false)
    .volatile()
    .description('允许 AI 助手查询邮箱内容（开启后才可通过 mail_query 工具读取邮件；关闭时助手无法访问邮箱）。/ Allow the AI assistant to query mailbox content (only when enabled can the mail_query tool read mail; when off the assistant has no mailbox access).'),
});
