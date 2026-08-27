# Verification record

## v0.3.0 feature verification

Verified on Windows 11 on 2026-08-27 against DeepSeek Harness `0.1.1-rc.2`:

- Node.js 24.12.0 and pnpm 11.4.0.
- Strict TypeScript passed.
- The complete Vitest suite passed: 13 test files and 100 tests, including more than 20 Python cases, v0.1/v0.2 snapshot migration, Settings live updates, disabled-state behavior, client accessibility states, existing Java/Spring and Node.js/TypeScript coverage, secret redaction, and the 100,000-line performance case.
- Host, Core, and browser Client production builds passed. The Client bundle passed the ModuleLoader registration guard.
- The allowlisted `dsh-loghud-0.3.0.tgz` package was generated successfully and contains the Python demo, native Settings client, schema v3 Host code, documentation, and no build cache or credentials.
- A temporary Web profile accepted the tarball. `--dump-config` showed the official file-backed Settings provider, the official client Settings modules, and the LogHUD defaults including `maxActiveErrors: 100`.
- The exact-version temporary Web Host started on an isolated loopback port. The index, packaged LogHUD Client bundle, and schema v3 snapshot API returned HTTP 200. The revisioned SSE route returned `text/event-stream`, `id: 0`, and a complete snapshot event. Host logs contained no LogHUD warning or error.
- The Settings page behavior is covered with the official `SettingsScope` contract: immediate switch saves, validated numeric blur/Enter saves, per-field reset, inherited/overridden display, unavailable/read-only degradation, Harness locale changes, keyboard controls, and ARIA status output.

The machine used for verification does not have `python` or the Windows `py` launcher installed, so the dependency-free Python demo could not be executed as a real subprocess. Python parsing, arbitrary chunk boundaries, ANSI/CRLF input, chained exceptions, asyncio, pytest, Windows/Unix paths, syntax columns, business-frame selection, and 1,000-occurrence deduplication all pass deterministic fixtures.

The locally cached standalone Harness CLI omitted several peer packages declared by the `0.1.1-rc.2` bundle graph. Those exact-version Harness peers were added only to the isolated smoke profile before Host startup; no workaround was added to LogHUD's production dependencies.

No live provider-backed LLM request was sent. Beginner-friendly and concise technical prompts, click-only invocation, coalescing, cancellation/failure preservation, safe JSON fallback, and redaction remain covered with deterministic test doubles.

## v0.2.1 compatibility verification

Verified on Windows 11 on 2026-08-25 against the exact DeepSeek Harness `0.1.1-rc.2` release train:

- Confirmed `@deepseek-ai/dsh` and every directly used DSH package publishes `0.1.1-rc.2`; package exports and used public declarations were compared with `0.1.0-rc.8` before editing.
- `pnpm peers check` passes, and `pnpm-lock.yaml` contains no mixed `0.1.0-rc.8` packages.
- Strict TypeScript, the complete Vitest suite, Host/Core/Client builds, client ModuleLoader verification, tarball dry-run, and real tarball generation pass.
- A clean temporary Web profile accepted `dsh-loghud-0.2.1.tgz`; `--dump-config` contains the LogHUD bundle and enabled patch.
- The exact `0.1.1-rc.2` Web Host started on an isolated loopback port. The index, plugin client bundle, snapshot API, and revisioned SSE snapshot all returned successfully.
- The real browser loaded the LogHUD badge and panel without console warnings or ModuleLoader errors. Live Harness light/dark switching updated the panel background, text, and borders; resize constraints remained active.
- The packaged Spring Demo reproduced MyBatis `BindingException`, Redis connection failure, and `NullPointerException`; all three exited with code 1 as expected.
- The dependency-free Node Demo reproduced `TypeError`, `ERR_MODULE_NOT_FOUND`, and `EADDRINUSE` with the expected non-zero exit.
- Harness tool-result observation, Node/TypeScript parser cases, Spring/Java fixtures, SSE reconnect logic, Session isolation, persistence migration, AI opt-in/coalescing/failure behavior, redaction, and 100,000-line performance remain covered by deterministic tests.
- `loghud_run` is exercised against the `0.1.1-rc.2` Terminal contract for incremental output, exit status, error-card creation, cancellation propagation, and terminal cleanup.

No live provider-backed LLM request was sent. AI routing, exactly-once opt-in behavior, cancellation/failure preservation, safe JSON fallback, locale prompts, and secret redaction use deterministic test doubles so verification never transmits credentials or project logs.

## v0.2.0 feature verification

v0.2.0 acceptance adds strict typecheck, more than 20 Node.js/TypeScript parser cases including Windows and Unix frames, ignored-state migration tests, client filtering/export/reconnect checks, package verification, and Windows/Ubuntu CI. Existing Java/Spring, fingerprint, recovery, redaction, AI opt-in, and 100,000-line performance checks remain required.

Verified on Windows 11 on 2026-08-20:

- Node.js 24.12.0 and pnpm 11.19.0.
- Strict TypeScript: passed.
- Vitest unit, security, performance, store, and jsdom client suites: passed.
- tsdown Host/Core and browser Client bundles: passed.
- npm tarball dry run: passed; 49 allowlisted files, no cache, build target, or secrets.
- Maven 3.9.12 / Java 17 dependency resolution and Spring demo packaging: passed after using a project-local Maven repository.
- Packaged Spring demo profiles: MyBatis `BindingException`, Redis `RedisConnectionFailureException`, and Java `NullPointerException` each reproduced with expected exit code 1.
