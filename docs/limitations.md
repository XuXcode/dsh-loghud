# v0.3.0 limitations

- v0.3.0 supports Python 3.10–3.14, Node.js/TypeScript, and Java/Spring on the verified DeepSeek Harness `0.1.1-rc.2` release train. Go and other ecosystems are deferred.
- Python support covers common runtime tracebacks, imports, syntax errors, asyncio task failures, and pytest output. Native crashes, mypy, Ruff, Pyright, framework-specific server recovery, and arbitrary log formats are not included.
- Node service recovery is not inferred automatically. Only the existing reliable Spring startup success rule performs automatic resolution.
- Python recovery is not inferred automatically.
- Ignore state applies only to the current Session, though it can be restored with the bounded Session snapshot.
- Search operates on detected error cards, not complete logs.

- Ordinary Bash, PowerShell, and terminal tool calls update only after `tools/result`; only `loghud_run` is incrementally monitored.
- This is current Coding Session error state, not log search, APM, production monitoring, Kubernetes/container inspection, RAG, or Sentry replacement.
- Generic rules may miss unusual logging formats or native crashes.
- Automatic resolution is restricted to successful Spring startup markers in the same normalized command family. Other causal recovery is never guessed.
- AI is manual only. There is no automatic analysis, autonomous fix, recent-change attribution, or new API-key setting.
- Diagnosis needs the current Agent to expose a provider/model route and Harness to provide `llm`; failures affect only the diagnosis region.
- Only bounded error context is retained. Ordinary logs are discarded.
- In-memory state is authoritative. Without a compatible `storageDomain`, state is not retained across Host restarts.
- Durable preferences require a writable local Harness Settings provider. Remote or read-only browsers show the effective settings without attempting unsupported writes.
- `shell.overlay` preserves the native single-owner details panel, but its floating drawer may overlap narrow third-party overlays; the panel constrains itself to the viewport.
- Harness is a developer preview; a later RC may require adaptation despite the same conceptual extension points.
