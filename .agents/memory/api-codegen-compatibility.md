---
name: API generator compatibility
description: Explicit runtime-version targets are needed when regenerating the shared API clients.
---

Keep the API generator's Zod and React Query version targets explicit and aligned with the installed consumers.

**Why:** A newer generator defaulted to Zod 4 output while this app still used Zod 3, producing nonexistent `zod.int()` calls. The API build completed with a warning, so a successful bundle alone did not establish runtime compatibility. React Query detection also defaulted to an older major in the monorepo.

**How to apply:** When regenerating or upgrading the generator, inspect the resulting imports and validation calls, run consumer typechecks, and smoke-test existing API endpoints before deployment. Do not upgrade runtime libraries merely to accommodate an implicit generator default.
