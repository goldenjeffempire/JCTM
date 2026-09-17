---
name: VAPID key rotation
description: Safety rule for replacing the database-backed browser push key pair
---

Rotate the persisted VAPID key pair atomically and clear all existing browser push subscriptions in the same operation.

**Why:** A subscription is bound to the VAPID public key active when the browser created it. Keeping subscriptions after rotation causes permanent push failures; users must opt in again under the new key.

**How to apply:** Explain the re-subscription impact before rotation. Replace both keys together, remove all old subscriptions, restart the server so it loads the new pair, and verify push reports configured with zero active subscribers.