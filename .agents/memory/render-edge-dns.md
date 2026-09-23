---
name: Render edge versus DNS ownership
description: Distinguish Render's Cloudflare-backed response edge from the domain's actual DNS provider.
---

Do not infer that a domain has a user-owned Cloudflare account just because its HTTP response says `server: cloudflare` or carries CF headers. A Render-hosted site can emit those headers while its authoritative nameservers belong to another provider.

**Why:** Assuming Cloudflare owned the zone led to a proposed Cloudflare connection when the domain's DNS was actually managed elsewhere.

**How to apply:** Check authoritative NS records before directing the user to a DNS or WAF dashboard. For crawler failures, distinguish a verified public response from Google-specific access or past intermittent outages; one successful fetch cannot certify a prior review period.