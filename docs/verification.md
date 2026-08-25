# Verification record

v0.2.0 acceptance adds strict typecheck, more than 20 Node.js/TypeScript parser cases including Windows and Unix frames, ignored-state migration tests, client filtering/export/reconnect checks, package verification, and Windows/Ubuntu CI. Existing Java/Spring, fingerprint, recovery, redaction, AI opt-in, and 100,000-line performance checks remain required.

Verified on Windows 11 on 2026-08-20:

- Node.js 24.12.0 and pnpm 11.19.0.
- Strict TypeScript: passed.
- Vitest unit, security, performance, store, and jsdom client suites: passed.
- tsdown Host/Core and browser Client bundles: passed.
- npm tarball dry run: passed; 49 allowlisted files, no cache, build target, or secrets.
- Maven 3.9.12 / Java 17 dependency resolution and Spring demo packaging: passed after using a project-local Maven repository.
- Packaged Spring demo profiles: MyBatis `BindingException`, Redis `RedisConnectionFailureException`, and Java `NullPointerException` each reproduced with expected exit code 1.

Not executable in this environment:

- Temporary Web profile add / `--dump-config` / Host boot / browser bundle smoke, because the `dsh` CLI is not installed on the machine. The exact manual commands are in the root README. Host and Client entrypoints were still compiled against the installed rc.8 public declarations.
- A live provider-backed LLM request was not sent. Coalescing, zero-before-click, exactly-one request, success/failure preservation, JSON fallback, and secret redaction use deterministic test doubles.
