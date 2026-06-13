---
name: pnpm package firewall overrides
description: Packages blocked by the Replit firewall and the overrides applied to fix pnpm install
---

## Blocked packages and overrides

Two packages were blocked by the Replit package firewall during migration:

- `protobufjs@6.11.6` — transitive dep of `@google-cloud/storage`. Overridden to `^7.4.0`.
- `shell-quote@1.8.x`, `1.7.3` — transitive dep of `react-devtools-core` in the mobile app. Overridden to `1.7.4`.

Both overrides are in `pnpm-workspace.yaml` under the `overrides:` key.

**Why:** The Replit package firewall blocks certain package versions. Specific tgz downloads fail with 403. The metadata endpoint may return a version as "available" but the tgz itself can still be blocked.

**How to apply:** When `pnpm install` fails with `ERR_PNPM_FETCH_403`, check which version is blocked and find an older version that passes by testing the metadata endpoint: `curl http://package-firewall.replit.local/npm/<pkg>/<version>`. Add the override to `pnpm-workspace.yaml`.

## Mobile app excluded from workspace

`artifacts/jctm-mobile` was excluded from `pnpm-workspace.yaml` (changed `artifacts/*` to explicit entries) because the Expo mobile app brings in `shell-quote` via `react-devtools-core` → `react-native@0.81.5`, blocking the entire workspace install. The main web app and API server work without it.
