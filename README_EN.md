<h1 align="center">dsh-loghud</h1>

<p align="center">
  <a href="./README.md">简体中文</a> | <a href="./README_EN.md">English</a>
</p>

<p align="center">
  <a href="https://dsh.market/"><img src="https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-listed-en.svg" alt="Listed on DSH Market"></a>
</p>

`dsh-loghud` is a DeepSeek Harness `0.1.0-rc.8` Web plugin for monitoring errors in local Java and Spring applications. It turns Java runtime exceptions, Spring startup and dependency-injection failures, MyBatis, database, Redis, and HTTP/MVC errors into bounded, deduplicated error cards.

AI explanations are strictly opt-in. Detecting an error never calls a model automatically.

The current V0.1 release focuses on the Java/Spring ecosystem. A generic fallback can retain otherwise unclassified Java exception chains, but Python, Node.js, Go, native crashes, and arbitrary text logs are not currently claimed as supported inputs.

## Preview

![LogHUD detecting a MyBatis error and providing an AI diagnosis in Chinese](./docs/assets/loghud-demo.png)

> DeepSeek Harness is still a developer preview. This plugin pins every `@deepseek-ai/*` dependency to the same RC version and only uses public Cordis services, Tool events, Terminal, LLM Streaming, Web routes, and Client Slots.

## Features

- Detects Spring IOC, MyBatis, MySQL/database, Redis, Spring MVC, Java runtime, and application startup errors.
- Extracts the root exception, core message, file, line, symbol, target, and port when available.
- Merges repeated errors using stable fingerprints and tracks occurrence count and last-seen time.
- Isolates active errors, resolved history, and project health by Session.
- Supports manual resolution, clearing resolved history, and clearing the current Session.
- Pushes coalesced browser updates through SSE.
- Supports Chinese and English UI, light and dark themes, keyboard operation, and a draggable floating panel.
- Runs AI diagnosis only on request and redacts common secrets before sending context.

## Capture modes

- **Ordinary Harness shell tools (`tool-result`)**: `tools/result` is read-only and final, so the HUD updates after the command completes.
- **Harness background jobs**: `pwsh` or shell job handles are correlated with their final `job_output`; partial polls and unrelated PowerShell commands do not change project health.
- **Incremental mode (`streaming-tool`)**: ask the Agent to use `loghud_run`, or call it directly. The command runs through the official Terminal service and output deltas are continuously sent to the collector.

The plugin never replaces or monkey-patches the native Harness shell. The UI clearly identifies the current capture mode.

## Installation

Install the current stable release directly:

```sh
dsh plugin --profile web add https://github.com/XuXcode/dsh-loghud/releases/download/v0.1.0/dsh-loghud-0.1.0.tgz
```

Run `dsh --profile web --dump-config` after installation. The dumped Web profile should contain the enabled `dsh-loghud` patch. Then start Harness normally and open a Coding Session.

## Build from source

Node.js 22.19 or later and pnpm are required.

```sh
pnpm install
pnpm check
pnpm pack
dsh plugin --profile web add ./dsh-loghud-0.1.0.tgz
dsh --profile web --dump-config
```

Drag the `LogHUD` badge or panel header to place it anywhere inside the viewport. The browser remembers its position. `Alt` plus the arrow keys also moves the panel, and Settings can restore the default position. UI labels and opt-in AI explanations follow the browser language. Chinese locales request Simplified Chinese diagnosis while preserving code identifiers.

## Configuration

```yaml
enabled: true
enableAiAnalysis: true       # manual only; never automatic
maxErrorContextLines: 120
maxResolvedHistory: 50
secretRedaction: true
beginnerFriendly: true
```

Missing Terminal support disables only `loghud_run`; final tool-result detection continues. Missing LLM routing disables only diagnosis and leaves every local error card intact. Without a compatible `storageDomain`, state remains bounded and process-local.

## Detection and health state

The parser chain covers Spring IOC, MyBatis, MySQL/database, Redis, Spring MVC, Java runtime exceptions, application startup failures, and a generic Java fallback. It collapses wrapper chains to a useful root cause, normalizes dynamic noise, creates a stable SHA-256 fingerprint, and increments the occurrence count for repeats.

Health states are defined as follows:

- `UNKNOWN`: no supported command has been observed.
- `HEALTHY`: a command has been observed successfully and there are no active errors.
- `BROKEN`: at least one active error card exists.

Automatic recovery is deliberately narrow. A successful Spring startup marker with no error exit resolves related startup errors only within the same command family. The plugin does not guess causality for other errors.

## AI diagnosis and privacy

No model is called before the AI diagnosis button is clicked. A single user action creates at most one diagnosis request, and concurrent requests for the same error version are coalesced.

The model receives only a structured error summary, exception chain, bounded context, and command type. With secret redaction enabled, Bearer tokens, JWTs, passwords, API keys, URL credentials, private keys, and common secret environment variables are replaced before transmission. AI timeout, cancellation, or response errors never remove the locally detected error.

## HTTP and SSE API

All Session IDs and error fingerprints are validated at the route boundary.

- `GET /api/loghud/:sessionId/snapshot`
- `GET /api/loghud/:sessionId/events`
- `POST /api/loghud/:sessionId/diagnose`
- `POST /api/loghud/:sessionId/resolve`
- `POST /api/loghud/:sessionId/clear-resolved`
- `POST /api/loghud/:sessionId/clear`

See [architecture](docs/architecture.md), [technical feasibility](docs/technical-feasibility.md), [limitations](docs/limitations.md), [verification record](docs/verification.md), and the [demo project](examples/spring-demo/README.md).

## Development and verification

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
```

## License

This project is licensed under the [MIT License](./LICENSE).
