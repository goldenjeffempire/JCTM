---
name: VAPID key rotation pending
description: Security follow-up for a push-signing key that was removed from tracked configuration but may remain active in the database.
---

The previously tracked VAPID private key must be treated as exposed. Removing it from configuration does not rotate the database-backed key because startup loads the existing key from the database.

**Why:** Rotating the database key invalidates existing browser push subscriptions, so it requires informed consent rather than an automatic database mutation.

**How to apply:** Before production launch, obtain consent, replace the database-backed VAPID key pair, and require the seven currently active browser subscribers to opt in again.