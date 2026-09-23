---
name: Render edge versus DNS ownership
description: Distinguish Render's Cloudflare-backed response edge from the domain's actual DNS provider.
---

Do not infer that a domain has a user-owned Cloudflare account just because its HTTP response says `server: cloudflare` or carries CF headers. A Render-hosted site can emit those headers while its authoritative nameservers belong to another provider.

**Why:** Assuming Cloudflare owned the zone led to a proposed Cloudflare connection when the domain's DNS was actually managed elsewhere.

**How to apply:** Check authoritative NS records before directing the user to a DNS or WAF dashboard. For crawler failures, distinguish a verified public response from Google-specific access or past intermittent outages; one successful fetch cannot certify a prior review period.

When switching DNS providers, change the **registrar's nameserver delegation**, not merely NS records inside the old DNS zone. If the parent registry still delegates to the old provider while the old zone advertises both old and new nameservers, recursive resolvers can receive inconsistent answers and the new provider can remain pending.

**Why:** A pending Cloudflare activation coincided with mixed NS answers inside the old zone while the parent registry still pointed exclusively to the old provider.

**How to apply:** Compare parent delegation against authoritative answers from both providers. Before switching, confirm the new zone contains website, mail, and verification records; then update the registrar nameserver setting to only the assigned new servers and verify the parent delegation changes.