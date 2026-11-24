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

也可以在 DeepSeek Harness 的「设置 → 插件 → 插件市场」中搜索 `mail`（市场索引刷新后可见）。

从 GitHub 源码安装：

```bash
dsh plugin --profile desktop add github:mysterycode-liwen/dsh-email
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
4. 回到「收件箱」，从下拉框选账号 → 点「刷新」拉取最近邮件。
5. 点列表中的邮件读正文（链接可点、图片可显示）；点「写邮件」填写收件人 / 主题 / 正文发送。

## 功能 / Features

- 左侧栏「邮件」面板 + 主区域邮件视图，账号、邮件列表与正文在面板内缓存，切视图不会重新拉取。
- 多账号管理：添加 / 删除，快速设置预设，支持完全自定义的 IMAP/SMTP 主机、端口与 TLS 开关。
- 收件箱：按 UID 拉取最近 N 封（默认 20，可调 1–100），显示主题 / 发件人 / 日期 / 摘要。
- 读信：正文支持富文本——保留可点击链接与内嵌图片；HTML 经消毒（剥离脚本、样式、危险属性与 `javascript:` 链接），`cid:` 内嵌图片转成 `data:` URI 显示。
- 写信：纯文本 / HTML 邮件正文通过 SMTP 发送（UTF-8）。
- 连接测试：一键验证 IMAP 选定 INBOX + SMTP 登录。
- 本地化：中文 / 英文界面，跟随 DSH 语言设置。

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
- `bridge.py` 用标准库实现 `test` / `listMessages` / `getMessage` / `sendMessage` 四个操作；正文解码处理 charset 回退（UTF-8 / GB18030 / GBK / Big5 / Shift-JIS / EUC-KR）以消除中文乱码。

所有邮件操作在同一台机器上完成；插件本身没有对外上传行为。

## 安全说明 / Security notice

- 邮箱授权码保存在 DSH 凭据保险箱中，界面 API 只返回脱敏元数据，授权码不会下发到 Web 客户端。
- 邮件正文的 HTML 经过白名单消毒：脚本、`<style>`、事件属性、`javascript:` 链接全部剥离，仅保留安全标签与属性；`data:` URL 仅允许 `data:image/`。
- 子进程环境变量中会短暂包含授权码（进程生命周期内）；该值不被记录到日志，也不回传浏览器。
- 邮件正文中的远程图片 URL 由邮件发送方控制，阅读邮件时浏览器可能向其发起请求——这是所有邮件客户端的通用行为，请留意发件人是否可信。
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

## 从源码构建 / From source

```bash
git clone https://github.com/mysterycode-liwen/dsh-email.git
cd dsh-email
npm run check      # 校验 client id / patch name / manifest 一致
dsh plugin --profile desktop add link:$(pwd)
```

发布前 `prepublishOnly` 会自动跑 `npm run check`。

## 许可 / License

[MIT](LICENSE) © 李文 (mysterycode-liwen)
