---
name: yt-dlp production setup
description: How yt-dlp is installed and configured for the JCTM media processor
---

## Rule
Always resolve the workspace binary at `/home/runner/workspace/bin/yt-dlp` first, before any env var or system PATH lookup.

**Why:** The Nix-installed yt-dlp is outdated and cannot handle current YouTube SABR streaming (breaks with JS runtime / PO token errors). The standalone binary is downloaded to `workspace/bin/yt-dlp` to survive restarts.

**How to apply:**
- Binary resolver in `media-processor.ts`: check `workspace/bin/yt-dlp` first, then `YT_DLP_PATH` env var, then `yt-dlp` on PATH.
- Do NOT pass `--extractor-args "youtube:player_client=ios,web"` — the default `android_vr` client works without PO tokens.
- Download new binary: `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /home/runner/workspace/bin/yt-dlp && chmod +x /home/runner/workspace/bin/yt-dlp`
