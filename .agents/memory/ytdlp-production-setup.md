---
name: yt-dlp production setup
description: How yt-dlp is installed and configured for the JCTM media processor
---

## Rule
Always resolve the workspace binary at `/home/runner/workspace/bin/yt-dlp` first, before any env var or system PATH lookup.

**Why:** YouTube regularly changes player-client and PO-token requirements. The June 2026 `android_vr` default began returning HTTP 403; official yt-dlp 2026.08.19 removed it from defaults and added working fallbacks.

**How to apply:**
- Binary resolver in `media-processor.ts`: check `workspace/bin/yt-dlp` first, then `YT_DLP_PATH` env var, then `yt-dlp` on PATH.
- Do not pin obsolete player clients; use the current upstream defaults unless an official current issue recommends otherwise.
- Keep the binary checksum-verified and updated to the latest official stable release because a previously working binary can break without code changes.
