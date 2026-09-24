---
name: SMTP incident channel
description: Privacy boundary for out-of-band transport failure alerts.
---

SMTP transport incidents must reach an admin-only surface, not the general audience push broadcast.

**Why:** Existing push subscribers are site/mobile audience members rather than identified admins. Sending SMTP diagnostics to them would disclose operational details to the wrong recipients. The persistent admin dashboard alert is the current non-email channel; it can be seen when an administrator visits, but does not notify an admin who is away from the dashboard.

**How to apply:** If adding off-dashboard alerts, first establish an authenticated admin-only device subscription and send solely to it. Do not repurpose the public push broadcast or email delivery path.