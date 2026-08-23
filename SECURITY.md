# Security policy

Report vulnerabilities privately to the repository maintainer; do not include live credentials or production logs in an issue.

`dsh-loghud` executes a command only when `loghud_run` is explicitly invoked under the active Agent's authority. It does not expose a standalone remote command route. HTTP writes accept only known Session actions, and diagnosis data is redacted before it crosses the LLM boundary. Redaction is defense in depth, not a guarantee for every proprietary secret format; inspect logs before requesting AI analysis.

Supported security fixes target the latest `0.1.x` release.
