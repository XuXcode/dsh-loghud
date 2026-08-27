# Changelog

## Unreleased

## 0.3.0 - 2026-08-26

- Added first-class Python 3.10–3.14 parsing for standard tracebacks, chained exceptions, imports, syntax errors, asyncio task failures, and pytest failures.
- Added Python command/toolchain detection, normalized Python-environment fingerprints, more than 20 deterministic fixtures, and a dependency-free Python demo.
- Added a dedicated native LogHUD page in Harness Settings with live persistence, per-field inheritance reset, validation, bilingual copy, and read-only/unavailable degradation.
- Added `maxActiveErrors`, snapshot schema version 3, active-card pruning statistics, and v0.1/v0.2 snapshot migration.
- Made the enabled setting stop new capture, `loghud_run`, AI requests, and the HUD surface without deleting existing Session cards.
- Made beginner-friendly mode affect the AI prompt while preserving manual-only AI invocation and secret redaction.
- Kept Java/Spring and Node.js/TypeScript behavior compatible with DeepSeek Harness `0.1.1-rc.2`.

## 0.2.1 - 2026-08-25

- Updated the verified DeepSeek Harness integration from `0.1.0-rc.8` to `0.1.1-rc.2`.
- Kept every direct DSH peer and development dependency on the same exact release train.
- Confirmed the public Tool, Terminal, LLM, Web Server, Storage Domain, Session, Client Runtime, and Client Slot APIs used by LogHUD remain source-compatible.
- Revalidated Java/Spring and Node.js/TypeScript capture, opt-in AI diagnosis, SSE synchronization, Session isolation, and theme-aware Web HUD behavior.

## 0.2.0 - 2026-08-25

- Added the extensible `LogErrorParser` chain and first-class Node.js/TypeScript parsing.
- Added Node runtime, module resolution, TypeScript compilation, build-tool, network, and port-in-use detection.
- Added per-Session ignored errors with persistence migration from v0.1 snapshots.
- Added error search, language/category filters, active/resolved/ignored views, connection feedback, resizable layout, and JSON/Markdown export.
- Added SSE revision event IDs and reconnect-safe full snapshots.
- Added a dependency-free Node demo, 20+ Node/TypeScript fixtures, Windows/Ubuntu CI, and tag-driven release automation.
- Kept all DeepSeek Harness dependencies on `0.1.0-rc.8` and preserved existing Java/Spring behavior.

- Fixed LogHUD surfaces, text, borders, controls, and status colors to follow the live Harness light/dark theme tokens.
- Removed emoji decoration from the LogHUD AI action labels.
- Made the README installation section expose one direct Release tarball command for marketplace parsers.
- Added localized DSH Market listing badges to both READMEs.
- Centered the README title, language navigation, and market badge as a consistent header block.

## 0.1.0 - 2026-08-20

- Initial rc.8-compatible Host/Client plugin.
- Final-result and explicit real-time capture modes.
- Spring/Java parsing, deduplication, lifecycle, SSE HUD, redaction, and opt-in AI diagnosis.
- Draggable, viewport-bounded LogHUD placement with persistence, keyboard movement, and reset.
- Harness `pwsh` background jobs are correlated with final `job_output` results, including textual exit-code extraction.
- The HUD is consistently named LogHUD and Chinese browser locales receive fully localized UI labels and Simplified Chinese AI diagnosis.
