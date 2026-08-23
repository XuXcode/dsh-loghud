# V0.1 limitations

- Ordinary Bash, PowerShell, and terminal tool calls update only after `tools/result`; only `loghud_run` is incrementally monitored.
- This is current Coding Session error state, not log search, APM, production monitoring, Kubernetes/container inspection, RAG, or Sentry replacement.
- The parser focuses on Java/Spring families. Generic rules may miss unusual logging formats or native crashes.
- Automatic resolution is restricted to successful Spring startup markers in the same normalized command family. Other causal recovery is never guessed.
- AI is manual only. There is no automatic analysis, autonomous fix, recent-change attribution, or new API-key setting.
- Diagnosis needs the current Agent to expose a provider/model route and Harness to provide `llm`; failures affect only the diagnosis region.
- Only bounded error context is retained. Ordinary logs are discarded.
- In-memory state is authoritative. Without a compatible `storageDomain`, state is not retained across Host restarts.
- `shell.overlay` preserves the native single-owner details panel, but its floating drawer may overlap narrow third-party overlays; the panel constrains itself to the viewport.
- Harness is a developer preview; a later RC may require adaptation despite the same conceptual extension points.
