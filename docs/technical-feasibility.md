# Technical feasibility

Target: DeepSeek Harness `0.1.0-rc.8`.

Harness describes a plugin-first Cordis architecture and explicitly marks the project as developer preview. The implementation stays on its public extension surfaces: Cordis plugins/services, Tool lifecycle events, Terminal sessions, LLM streaming, Web route registration, and Web Client Slots. It does not modify Harness core or patch DOM/shell behavior. See the official [architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) and [LLM streaming API](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/llm-streaming.md).

## Why capture is hybrid

In rc.8, `tools/result` exposes a final immutable tool outcome. It is suitable for ordinary shell compatibility but cannot promise stdout/stderr deltas. The official Terminal service does expose operation-scoped `readOutput()` deltas; therefore true incremental behavior is provided only by the explicit `loghud_run` tool. This is a product constraint, not a hidden emulation.

## Ecosystem comparison

- [`dsh-ci-doctor`](https://github.com/jkrandom-sudo/dsh-ci-doctor) diagnoses remote GitHub Actions failures; it does not track a local Spring Boot process or supply this HUD lifecycle.
- [`dsh-event-auditor`](https://github.com/qing3a/dsh-event-auditor) audits Harness events themselves rather than parsing application exceptions.
- [`DSH-better-sidebar`](https://github.com/omdsh-dev/DSH-better-sidebar) provides generic workbench/sidebar infrastructure but not root-cause grouping, recovery state, or explicit AI diagnosis.

## Compatibility controls

- All Harness peer/dev dependencies are `0.1.0-rc.8`; mixed RCs are forbidden.
- Public declarations from the installed packages are typechecked by strict TypeScript.
- Optional Terminal/LLM capability is detected at call time with clear error messages.
- Client registration is additive (`shell.overlay`), because the official `details` slot is single-owner.
- The package file whitelist and tarball dry run prevent local caches or secrets entering a release.

Persistence is intentionally capability-gated. The real-time authority is always bounded memory. rc.8 installations without a compatible public `storageDomain` service remain fully functional but restart without historical cards or settings.
