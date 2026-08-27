<h1 align="center">dsh-loghud</h1>

<p align="center">
  <a href="./README.md">简体中文</a> | <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://dsh.market/"><img src="https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-zh.svg" alt="DSH Market 已收录"></a>
</p>

`dsh-loghud` 是面向 DeepSeek Harness `0.1.1-rc.2` 的可扩展本地开发错误监控 Web 插件。v0.3.0 支持 Python、Node.js、TypeScript、Java 与 Spring，将运行时、编译、模块解析、构建、测试和应用启动错误整理成有界、去重的错误卡片。

AI 解释完全由用户手动触发。检测到错误时，插件不会自动调用模型。

当前 v0.3.0 支持 Python、Node.js/TypeScript 与 Java/Spring。Go 及其他生态将在后续版本扩展；当前不承诺生产日志、原生程序崩溃或任意文本日志监控。

## 界面预览

![LogHUD 检测 MyBatis 错误并提供中文 AI 诊断](./docs/assets/loghud-demo.png)

> DeepSeek Harness 目前仍处于 developer preview。该插件将所有 `@deepseek-ai/*` 依赖锁定在同一 RC 版本，并且只使用公开的 Cordis 服务、Tool 事件、Terminal、LLM Streaming、Web 路由和 Client Slot。

## 兼容性

| dsh-loghud | DeepSeek Harness | 状态 |
| --- | --- | --- |
| v0.3.0 | 0.1.1-rc.2 | 已验证 |

## 功能

- 识别 Node.js 运行时、TypeScript `TSxxxx`、模块缺失、网络连接、npm/pnpm/yarn 生命周期以及 Vite、Rollup、Webpack、Next.js 构建错误。
- 识别 Python 3.10–3.14 Traceback、异常链、导入失败、SyntaxError、asyncio 后台异常和 pytest 测试失败。
- 保留 Spring IOC、MyBatis、MySQL/数据库、Redis、Spring MVC、Java 运行时和应用启动错误识别。
- 提取根异常、错误代码、语言、工具链、文件、行列号、业务栈帧、目标对象和端口。
- 使用稳定指纹合并重复错误，并记录出现次数和最近发生时间。
- 按 Session 隔离活动、已解决、已忽略错误；被忽略错误不计入 `BROKEN`。
- 通过带 revision 的 SSE 推送状态，并在 HUD 中显示连接、重连和离线状态。
- 支持搜索、语言/分类筛选、JSON/Markdown 导出、可拖动和可调整尺寸的悬浮面板。
- 支持中英文界面、Harness 明暗主题变量、键盘操作及布局持久化。
- 在 Harness 原生设置菜单中提供独立的 LogHUD 页面，配置可实时生效、持久化并恢复继承值。
- AI 诊断按需调用，并在发送前遮盖常见密钥和凭据。

## 日志采集模式

- **普通 Harness Shell（`tool-result`）**：`tools/result` 是只读的最终结果，因此命令结束后才会更新 HUD。
- **Harness 后台任务**：关联 `pwsh` 或 Shell 返回的任务句柄及最终 `job_output`；中间轮询和无关 PowerShell 命令不会改变项目健康状态。
- **增量模式（`streaming-tool`）**：让 Agent 使用 `loghud_run`，或直接调用该工具。命令通过官方 Terminal 服务运行，增量输出会持续送入采集器。

插件不会替换或修改 Harness 原生 Shell。界面会明确显示当前采集方式。

## 安装

直接安装当前正式版：

```sh
dsh plugin --profile web add https://github.com/XuXcode/dsh-loghud/releases/download/v0.3.0/dsh-loghud-0.3.0.tgz
```

安装后可通过 `dsh --profile web --dump-config` 验证，配置输出中应当包含已启用的 `dsh-loghud` patch。随后正常启动 Harness 并打开 Coding Session。

## 从源码构建

需要 Node.js 22.19 或更高版本以及 pnpm。

```sh
pnpm install
pnpm check
pnpm pack
dsh plugin --profile web add ./dsh-loghud-0.3.0.tgz
dsh --profile web --dump-config
```

`LogHUD` 徽标和面板标题均可拖动，面板右下角可调整尺寸，浏览器会记住位置和尺寸。也可以使用 `Alt` 加方向键移动面板，或在 HUD 中恢复默认布局。监控配置位于 Harness 设置菜单的独立 `LogHUD` 页面，设置页跟随 Harness 当前语言；中文 AI 解释会保留代码标识符原文。

## 支持矩阵

| 生态 | v0.3.0 状态 | 典型错误 |
| --- | --- | --- |
| Node.js / JavaScript | 正式支持 | TypeError、模块缺失、EADDRINUSE、ECONNREFUSED |
| TypeScript | 正式支持 | TSxxxx、Vite/Rollup/Webpack/Next.js 构建失败 |
| Java / Spring | 保持支持 | IOC、MyBatis、数据库、Redis、MVC、运行时与启动错误 |
| Python 3.10–3.14 | 正式支持 | Traceback、导入失败、SyntaxError、asyncio、pytest |
| Go | 后续版本 | 尚未实现 |

Node.js 无依赖演示位于 [`examples/node-demo`](examples/node-demo/README.md)，Python 无依赖演示位于 [`examples/python-demo`](examples/python-demo/README.md)。

## 配置

```yaml
enabled: true
enableAiAnalysis: true       # 仅允许手动触发，不会自动调用
maxErrorContextLines: 120
maxActiveErrors: 100
maxResolvedHistory: 50
maxIgnoredHistory: 50
secretRedaction: true
beginnerFriendly: true
```

推荐通过 Harness 设置菜单中的 `LogHUD` 页面修改配置。Cordis patch 中的值是基础配置，Harness 用户设置是可持久化的覆盖层；降低活动、已解决或已忽略上限时会立即裁剪旧卡片。关闭 `enabled` 会隐藏 HUD 并停止新采集与 AI 请求，但不会删除已有错误。

缺少 Terminal 服务时，只会禁用 `loghud_run`，命令结束后的结果检测仍可使用。缺少 LLM 路由时，只会禁用 AI 诊断，本地错误卡片不会受到影响。没有兼容的 `storageDomain` 时，状态会保存在进程内存中，并保持有界。

## 错误识别与健康状态

解析器链固定按 TypeScript、Node.js、Python、Spring、Java、Generic 的优先级运行。它会选择第一个非依赖目录、非运行时内部目录的业务栈帧，将异常链归并到有效根因，并在规范化路径、虚拟环境、构建哈希、PID、端口和临时目录后生成稳定 SHA-256 指纹。

健康状态定义如下：

- `UNKNOWN`：尚未观察到受支持的命令。
- `HEALTHY`：已成功观察命令，且当前没有活动错误。
- `BROKEN`：当前存在活动错误卡片。

自动恢复范围刻意保持严格：只有同一命令族再次出现 Spring 启动成功标记，且没有错误退出时，才会解决此前相关的启动错误。其他错误不会猜测因果关系。

## AI 诊断与隐私

AI 诊断按钮点击前不会调用模型。一次用户操作最多发起一次诊断请求，同一错误版本的并发请求会被合并。

发送给模型的内容仅包含结构化错误摘要、异常链、有限上下文和命令类型。启用敏感信息遮盖后，Bearer Token、JWT、密码、API Key、URL 凭据、私钥和常见 Secret 环境变量会在发送前被替换。AI 超时、取消或返回错误不会删除本地错误记录。

## HTTP 与 SSE 接口

所有 Session ID 和错误指纹都会在路由入口进行校验。

- `GET /api/loghud/:sessionId/snapshot`
- `GET /api/loghud/:sessionId/events` (SSE)
- `POST /api/loghud/:sessionId/diagnose`
- `POST /api/loghud/:sessionId/resolve`
- `POST /api/loghud/:sessionId/ignore`
- `POST /api/loghud/:sessionId/unignore`
- `POST /api/loghud/:sessionId/clear-resolved`
- `POST /api/loghud/:sessionId/clear`

更多信息请参阅[架构说明](docs/architecture.md)、[技术可行性](docs/technical-feasibility.md)、[限制说明](docs/limitations.md)、[验证记录](docs/verification.md)和[示例工程](examples/spring-demo/README.md)。

## 开发与验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

## 许可证

本项目使用 [MIT License](./LICENSE)。
