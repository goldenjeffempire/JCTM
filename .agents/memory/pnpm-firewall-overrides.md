---
name: pnpm package firewall overrides
description: Packages blocked by the Replit firewall and the overrides applied to fix pnpm install
---

## Blocked packages and overrides

Two packages were blocked by the Replit package firewall during migration:

- `protobufjs@6.11.6` — transitive dep of `@google-cloud/storage`. Overridden to `^7.4.0`.
- `shell-quote` published tarballs — transitive dep of `react-devtools-core` in the mobile app. Overridden to the local API-compatible workspace package.

Both overrides are in `pnpm-workspace.yaml` under the `overrides:` key.

**Why:** The Replit package firewall blocks certain package versions. Specific tgz downloads fail with 403. The metadata endpoint may return a version as "available" but the tgz itself can still be blocked.

**How to apply:** When `pnpm install` fails with `ERR_PNPM_FETCH_403`, prefer a current safe release. If all published tarballs are blocked and the dependency has a small stable API, use an audited local compatibility package rather than excluding the affected app.

## Mobile app excluded from workspace

The mobile app must remain included in the workspace because it consumes catalog versions and a workspace API client. Excluding it makes its install and workflow fail even when the web app and API continue to work.

**Why:** Catalog references and `workspace:*` dependencies are only resolved when pnpm recognizes the mobile package as part of the root workspace.

**How to apply:** Keep the mobile artifact in the workspace package list and retain the local `shell-quote` override while the firewall blocks its published tarballs.
