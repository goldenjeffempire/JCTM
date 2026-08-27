---
name: GitHub publishing blocker
description: What to do when Replit's GitHub integration is attached but repository writes cannot reach GitHub.
---

An authorized GitHub integration does not guarantee that a repository update has reached GitHub. If both the connector proxy and SDK return a Cloudflare "Attention Required" page, and direct Git push reports invalid credentials, treat this as an environment-level publishing block rather than an application failure.

**Why:** Render deploys the remote GitHub revision, not the local Replit checkout. A successful local commit alone cannot fix production.

**How to apply:** Verify the remote revision after each publish attempt. Preserve only the intended code commits locally, avoid pushing unrelated uploaded assets, and use the workspace Git interface or repair the GitHub connection before triggering a Render deploy.