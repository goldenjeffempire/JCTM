---
name: Render SMTP verification
description: How to distinguish workspace SMTP connectivity from live Render email delivery.
---

Treat Render SMTP settings and Replit workspace secrets as separate environments. A workspace SMTP authentication or connection test does not prove the live service is working or broken: after credentials were updated, this workspace could not open TCP connections to mail ports 587 or 465, while a test message sent from the live Render-backed admin page was received and a subsequent normal subscriber send showed no new failures.

**Why:** Workspace egress and deployment environment settings differ, so diagnosing the live service solely through the development shell can give a false negative.

**How to apply:** For live email incidents, check the live admin Email (SMTP) verification, send a test message from the live dashboard to a mailbox the owner controls, and check delivery failures after a normal subscriber send. Do not request or display SMTP credentials in chat or logs.