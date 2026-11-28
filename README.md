# 邮件 / Mail

[![license](https://img.shields.io/npm/l/@mysterycode-liwen/dsh-mail.svg)](LICENSE)
[![DeepSeek Harness plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4C6EF5)](https://github.com/deepseek-ai/DeepSeek-Harness)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) 侧边栏插件：在左侧栏收发 QQ、163、Gmail 等邮箱的邮件。用标准 IMAP 收信、SMTP 发信，账号与授权码保存在本机凭据保险箱，不经过任何第三方服务器。

A sidebar plugin for DeepSeek Harness that sends and receives mail from QQ / 163 / Gmail and other IMAP/SMTP accounts. Credentials stay in the local credential vault — nothing is relayed through a third-party server.

> ⚠️ QQ / 163 邮箱需要用**授权码**（app password），不是登录密码；Gmail 需要用**应用专用密码**。邮箱服务商要求开启 IMAP/SMTP 服务后才能使用。

## 目录

- [安装](#安装--install)
- [快速上手](#快速上手--quick-start)
- [功能](#功能--features)
- [新邮件通知](#新邮件通知--new-mail-alerts)
- [邮件翻译](#邮件翻译--mail-translation)
- [AI 助手查询邮箱（需开启）](#ai-助手查询邮箱需开启--ai-assistant-mail-query)
- [支持的邮箱与服务器](#支持的邮箱与服务器--server-presets)
- [工作原理](#工作原理--how-it-works)
- [安全说明](#安全说明--security-notice)
- [常见问题](#常见问题--faq)
- [从源码构建](#从源码构建--from-source)
- [许可](#许可--license)

## 安装 / Install

从 npm 安装（推荐）：

```bash
dsh plugin --profile desktop add @mysterycode-liwen/dsh-mail
```

从 GitHub 源码安装（跟踪 `main` 的最新改动）：

```bash
dsh plugin --profile desktop add github:mysterycode-liwen/dsh-email
```

也可以在本仓库的插件索引中一键安装：在「设置 → 插件」中启用「自定义插件索引」，然后在「发现」标签添加索引源

```
https://mysterycode-liwen.github.io/dsh-email/index.json
```

从本地目录安装（开发用）：

```bash
dsh plugin --profile desktop add link:E:/DeepSeek/dsh-email
```

安装后重启 DeepSeek Harness（或在插件卡片上关闭再启用），左侧栏会出现「邮件」入口。

本机需要 **Python 3.10+**：插件通过 Python 标准库 `imaplib` / `smtplib` 处理邮件，无需 pip 安装任何依赖。插件会依次尝试环境变量 `MAIL_PYTHON`、`C:\Python314\python.exe` 到 `C:\Python310\python.exe`，最后是 PATH 中的 `python`。

## 快速上手 / Quick start

1. 安装并重启 DSH → 左侧栏点「邮件」。
2. 切到「账号」视图 → 点预设（QQ 邮箱 / 网易 163 / Gmail）自动填好服务器与端口，或手动填自定义服务器。
3. 填邮箱地址、授权码，点「测试连接」验证 IMAP 登录 + SMTP 登录都通过，再点「保存」。
4. 回到「收件箱」，从顶部下拉框选账号 → 点「刷新」拉取最近邮件。
5. 点列表中的邮件读正文（链接可点、图片可显示）；点「写邮件」填写收件人 / 主题 / 正文发送或添加附件。

## 功能 / Features

**侧边栏面板**

- 左侧栏「邮件」面板 + 主区域邮件视图，账号、邮件列表与正文在面板内缓存，切视图不会重新拉取。
- 有新邮件时侧边栏入口旁出现红色未读小圆点（鼠标悬停显示封数），点开邮件后清除。

**账号**

- 多账号管理：添加 / 删除，快速设置预设，支持完全自定义的 IMAP/SMTP 主机、端口与 TLS 开关。
- 账号名称可随时在账号卡片上「重命名」；新账号默认用邮箱 `@` 前的部分作为名称。名称只在本机显示，不会写回邮箱服务器。

**收件**

- 收件箱：按 UID 拉取最近 N 封（默认 25，接口上限 100），显示主题 / 发件人 / 日期 / 摘要。
- 已读 / 未读筛选：收件箱顶部「全部 / 未读 / 已读」三个按钮带数量，选择后只显示对应邮件。
- 新邮件自动出现：后台检测到新邮件后，当前账号的列表会自动刷新，不用手动点刷新。
- 点「刷新」有加载动效：图标旋转 + 按钮禁用，完成后短暂显示对勾（成功）或感叹号（失败）再复位。

**读信**

- 正文支持富文本——保留可点击链接与内嵌图片；HTML 经消毒（剥离脚本、样式、危险属性与 `javascript:` 链接），`cid:` 内嵌图片转成 `data:` URI 显示。
- **翻译邮件**：读信页点「翻译」即可把正文译成中文，再点「查看原文」切回；译文不写入本地存储。复用 DSH 内置翻译服务（默认 Bing，免登录 / 免 API Key / 无额外费用），超长正文自动分段翻译后拼回。
- 附件：显示文件名 / 大小，点「下载」按需取回并保存到本地下载目录；单封邮件附件上限 25 MB。
- 一键把发件人加为联系人（已在联系人中的显示为已完成态，不会覆盖你改过的姓名）。

**写信**

- 收件人支持逗号分隔多个地址；正文 UTF-8 纯文本。
- 附件：点「添加附件」或直接把文件拖到投递区，可多选、可逐个移除；总大小超过 25 MB 会被拦下并提示分开发送。

**发件箱**

- 已发送读自服务器 Sent 文件夹（在别的设备上发的信也能看到），服务器不可达时回退到本地缓存。
- 发件详情可把收件人一键加为联系人；随信附件显示名称与大小。

**联系人**

- 本地地址簿：手动添加（姓名 + 邮箱）、删除、一键写信。
- 联系人只保存在本机，不上传到邮箱服务器。

**其他**

- 连接测试：一键验证 IMAP 选定 INBOX + SMTP 登录。
- 本地化：中文 / 英文界面，跟随 DSH 语言设置。
- 主题：全部样式使用 DSH `--dsw-alias-*` 变量，日间 / 夜间主题都能正常显示。

## 新邮件通知 / New mail alerts

设置页（「设置 → 插件 → 邮件」）里可配置后台检查：

- **通知方式**：桌宠播报 / 系统通知（需浏览器权限）/ 两者都要。
- **检查间隔**：15–3600 秒，默认 60 秒。
- **检测状态**：显示轮询是否运行、账号数、检查次数、告警次数、上次检查时间与最近错误，方便判断「为什么没提醒」。
- **立即检查新邮件**：立刻跑一次检测并报告发现几封。
- **发送测试通知**：验证所选通道是否真的能弹出来。

桌宠播报不需要浏览器通知权限，走的是桌宠插件的同源广播接口（`/dsh-pet-7340/broadcast`），桌宠睡着时会被拒绝。系统通知需要浏览器授权，首次点按钮时申请。

## 邮件翻译 / Mail translation

读信页正文上方有「翻译」按钮，点一下把邮件正文译成中文并显示「译文」卡片，再点「查看原文」切回。翻译复用 DSH 内置的 `translator` 服务（默认 Bing 提供方，免登录、免 API Key、无额外费用）；邮件正文超过单次 4000 字符上限时会按行自动分段翻译后拼回。

该服务来自实验性扩展包 `@deepseek-ai/dsh-experimental-cot-translation-bundle`，**不是默认开启的**。如果点翻译提示「当前环境未启用翻译服务」，请在「设置 → 插件」中启用该扩展包后重试。译文只做机器翻译，仅供参考；译文不会写入本地缓存或 profile 存储。

The detail view has a "Translate" button that translates the message body into Chinese and shows a "Translation" card; "Show original" switches back. Translation uses DSH's built-in `translator` service (Bing by default — no login, no API key, no extra cost), automatically splitting long bodies into chunks. The service comes from the opt-in experimental bundle `@deepseek-ai/dsh-experimental-cot-translation-bundle`; if it reports "translation service unavailable", enable that bundle under Settings → Plugins. Translations are machine-generated and are never persisted.

## AI 助手查询邮箱（需开启）/ AI assistant mail query

插件提供只读工具 `mail_query`，让 DeepSeek Harness 的 AI 助手方便查询邮箱内容（列出账号 / 列出邮件 / 读某封邮件 / 最近已发送）。出于隐私，**默认关闭**：必须先在「设置 → 插件 → dsh-mail」中打开「允许 AI 助手查询邮箱内容」开关，助手才能拿到邮件；关闭时工具直接返回“未开启”，不会访问邮箱。

该工具只读取邮件，**不能发信、删信或修改任何数据**，也**不会返回授权码 / 密码等凭据**。开关实时生效，关闭后立即失效，无需重启插件。

The read-only `mail_query` tool lets the DSH AI assistant query mail (list accounts / messages / read a message / recent sent). For privacy it is **off by default**: enable "Allow the AI assistant to query mailbox content" in Settings → Plugins → dsh-mail before the assistant can read mail; when off the tool returns "disabled" and never touches the mailbox. It cannot send, delete, or modify mail, and never returns credentials. The switch takes effect immediately.

## 支持的邮箱与服务器 / Server presets

| 服务商 | IMAP | SMTP | 凭据 |
| --- | --- | --- | --- |
| QQ 邮箱 | `imap.qq.com:993` (SSL) | `smtp.qq.com:465` (SSL) | 授权码 |
| 网易 163 | `imap.163.com:993` (SSL) | `smtp.163.com:465` (SSL) | 授权码 |
| Gmail | `imap.gmail.com:993` (SSL) | `smtp.gmail.com:465` (SSL) | 应用专用密码 |
| 自定义 | 任意 | 任意 | 密码 / 授权码 |

非 993/465 端口可关闭 TLS 走 STARTTLS（IMAP 非 TLS 连接强制要求 STARTTLS 成功，否则拒绝发送凭据）。

## 工作原理 / How it works

浏览器端 `client.js` 通过 `POST /api/dsh-mail` 调 Host 端注册的私有 HTTP 路由（DSH `connection.fetch.register`，带连接层鉴权）。Host 端 `index.js`：

- 账号与授权码存进 DSH 凭据保险箱（`ctx.credentials`），记录 key 形如 `mail/acct-xxxxxxxx`，只把脱敏后的账号元数据返回给 UI；
- 每次操作启动一个 Python 子进程运行 `bridge.py`，通过环境变量 `MAIL_REQUEST` 传 JSON 请求、stdout 读 JSON 结果；
- `bridge.py` 用标准库实现 `test` / `listMessages` / `getMessage` / `getAttachment` / `sendMessage` / `listSent` 等操作；正文解码处理 charset 回退（UTF-8 / GB18030 / GBK / Big5 / Shift-JIS / EUC-KR）以消除中文乱码，附件按 RFC 2231 编码以保留中文文件名。

Host 端操作一览：`getSettings` / `setSettings` / `listAccounts` / `saveAccount` / `renameAccount` / `deleteAccount` / `testAccount` / `listMessages` / `getMessage` / `getAttachment` / `sendMessage` / `sentMessages` / `listContacts` / `saveContact` / `deleteContact` / `translate`（后者走 DSH `ctx.translator` 可选服务，不属于 Python bridge）。

联系人、发件箱缓存、设置都存在本机的 profile 存储里，不经过邮箱服务器（联系人不会同步到服务器通讯录）。

所有邮件操作在同一台机器上完成；插件本身没有对外上传行为。

## 安全说明 / Security notice

- 邮箱授权码保存在 DSH 凭据保险箱中，界面 API 只返回脱敏元数据，授权码不会下发到 Web 客户端。
- 邮件正文的 HTML 经过白名单消毒：脚本、`<style>`、事件属性、`javascript:` 链接全部剥离，仅保留安全标签与属性；`data:` URL 仅允许 `data:image/`。
- 子进程环境变量中会短暂包含授权码（进程生命周期内）；该值不被记录到日志，也不回传浏览器。
- 邮件正文中的远程图片 URL 由邮件发送方控制，阅读邮件时浏览器可能向其发起请求——这是所有邮件客户端的通用行为，请留意发件人是否可信。
- 附件由你主动点「下载」才会取回；发送时不经过任何中转服务器。
- 本插件不加密本地缓存；请勿在公用电脑上使用。

## 常见问题 / FAQ

**侧边栏没有「邮件」入口？**
`client.js` 里 `window.__ModuleLoader__.load({ id })` 的 `id` 必须与 `package.json` 的 `name` 完全一致（DSH 按包名查浏览器模块表）。装完先重启 DSH；仍没有就运行 `npm run check`。

**测试连接失败？**
确认邮箱已开启 IMAP/SMTP 服务，且使用的是授权码而非登录密码；QQ/163 需要到邮箱设置里生成授权码。TLS/SSL 端口用 993 / 465。

**读信乱码？**
插件会对未声明 charset 的正文逐个尝试常见中文编码。若某封邮件仍乱码，请把截图与邮箱服务商发我。

**图片显示不出来？**
远程图片需要能访问对应 URL；`cid:` 内嵌图片仅在邮件本身带有内嵌资源时显示（大于 2 MB 的内嵌图会被跳过以免撑爆响应）。

**授权码存在哪？会上传吗？**
存在 DSH 凭据保险箱，仅本地；插件没有网络上传行为。你也可以在「凭据保险箱」侧栏面板中查看 / 删除这些记录（key 形如 `mail/acct-…`）。

**新邮件没有提醒？**
先看设置页的「检测状态」：如果显示「轮询未运行」，检查开关是否打开；如果检查次数在涨但告警次数是 0，说明没检测到新邮件（可点「立即检查新邮件」验证）。用桌宠播报时，桌宠处于睡眠状态会被拒绝，叫醒它即可；用系统通知时，需要在浏览器里允许本页通知。

**改了插件代码但界面没反应，或报 `unknown op: xxx`？**
插件分为 Host 与 Client 两半。Client 半在刷新页面时重新加载，Host 半只在 DSH 进程启动时加载一次。改了 Host 半（`index.js`、`bridge.py`）必须**完全退出** DeepSeek Harness 再启动——关掉窗口只是隐藏到托盘，请在托盘图标上右键退出，或用任务管理器结束所有 DeepSeek Harness 进程。

**附件发不出去 / 下载失败？**
单封邮件附件总量上限 25 MB，超过请分开发送。下载失败请确认邮箱服务商允许 IMAP 取信（部分企业邮箱对附件大小有限制）。

## 从源码构建 / From source

```bash
git clone https://github.com/mysterycode-liwen/dsh-email.git
cd dsh-email
npm run check      # 校验 client id / patch name / manifest 一致
dsh plugin --profile desktop add link:$(pwd)
```

发布前 `prepublishOnly` 会自动跑 `npm run check`。

## 更新日志 / Changelog

**1.3.1**

- 改进：从保险箱读取授权码时按「可访问插件」授权过滤——只有明确授权给邮箱插件的凭据才会出现在选择列表里，其它凭据对邮箱插件不可见。

**1.3.0**

- 新增：账号「授权码」可从凭据保险箱一键填入——在授权码输入框点「从保险箱选择」，选中账号即自动填入真实密码 / 授权码（ECDH + AES-GCM 加密传输；未安装保险箱时按钮自动隐藏）。
- 改进：IMAP 邮件列表解析使用部分 FETCH（只取所需头部与摘要），减少大附件下载。

**1.2.0**

- 新增：邮件翻译——读信页一键把正文译成中文（复用 DSH 内置翻译服务，免登录 / 免 API Key，超长正文自动分段），可随时切回原文。

**1.1.0**

- 新增：附件收发（写信可添加 / 拖入附件，收信可下载附件，单封上限 25 MB，中文文件名正常）。
- 新增：新邮件被检测到后，当前账号的邮件列表自动刷新。
- 新增：侧边栏「邮件」入口的未读小红点，点开邮件后清除。
- 新增：账号重命名（取代此前从邮件头猜昵称的做法），新账号默认用邮箱前缀作为名称。
- 新增：在读信与发件详情中一键把发件人 / 收件人加为联系人。
- 改进：Host 半过期时提示「请完全退出并重启 DeepSeek Harness」，而不是抛出 `unknown op`。

**1.0.1**

- 新邮件通知（桌宠播报 / 系统通知 / 两者），带检测状态面板与「立即检查」「发送测试通知」。
- 收件箱已读 / 未读筛选，刷新按钮加载动效，设置保存提示修复。

## 许可 / License

[MIT](LICENSE) © 李文 (mysterycode-liwen)
