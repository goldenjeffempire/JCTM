---
name: GitHub publishing blocker
description: What to do when Replit's GitHub integration is attached but repository writes cannot reach GitHub.
---

An authorized GitHub integration does not guarantee that a repository update has reached GitHub. If both the connector proxy and SDK return a Cloudflare "Attention Required" page, and direct Git push reports invalid credentials, treat this as an environment-level publishing block rather than an application failure.

**Why:** Render deploys the remote GitHub revision, not the local Replit checkout. A successful local commit alone cannot fix production.

**How to apply:** Verify the remote revision after each publish attempt. Preserve only the intended code commits locally, avoid pushing unrelated uploaded assets, and use the workspace Git interface or repair the GitHub connection before triggering a Render deploy.

Treat publishing failures as transport- and session-specific, not a permanent repository block. A normal Git push can fail while the already-authorized GitHub connector can read or update the repository.

**Why:** Stale conclusions about an unavailable publishing transport can unnecessarily prevent a later deployment.

**How to apply:** Recheck the current authorized connection and remote revision before declaring publication blocked. If the intended files are already on the remote, verify them and avoid creating a duplicate commit or overwriting concurrent work.

Cross-environment Vite bundle filenames are not reliable deployment identities.

**Why:** A Render release can have different bundle hashes from the Replit build even when the changed component matches the tested component.

**How to apply:** Verify the remote revision, Render's successful deployment for that revision, and the live feature's code or behavior. Do not diagnose a stale deployment solely from a different local bundle filename.

A successful development page-module request does not prove that the preview has recovered from Vite's `Outdated Optimize Dep` errors.

**Why:** After forced dependency optimization, current modules returned HTTP 200 while the browser still encountered stale dependency imports. This was a preview verification issue, not evidence of a failed Render release.

**How to apply:** Confirm the rendered preview as well as its current dependency requests. Keep preview-cache failures separate from production availability checks.

Multiple Render services can deploy the same repository independently. One successful origin deployment does not prove that the custom domain is serving the upgrade.

**Why:** During an approved release, the older origin updated before the service serving jctm.org.ng, which temporarily continued exposing the previous API and frontend.

**How to apply:** Inspect deployment statuses for the approved revision across services, then verify the changed behavior directly on jctm.org.ng. Do not infer the domain's serving service from a remembered onrender.com address.