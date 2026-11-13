# End of Year Crusade 2026

The homepage, Events page, dedicated `/events/end-of-year-crusade-2026` page, invitation generator, and admin editor read the same database-backed campaign.

## Managing the campaign

Sign in as a livestream administrator under **Admin → Events → End of Year Crusade 2026**. Change the campaign, venue, minister, flyer, four programs, individual start times, and publication switches. All date/time inputs use **Nigeria time (Africa/Lagos, UTC+1)** regardless of the administrator's device timezone.

Uploading a flyer does not publish it. Click **Save campaign** to publish edits. Simultaneous edits are protected with revision checks; if another administrator saved first, reload the latest version rather than overwriting their changes. Every saved version preserves the previous campaign in `ministry_campaign_revisions`.

Keep the printed official flyer consistent with schedule changes by uploading replacement artwork when necessary. Dates printed inside an image cannot be updated automatically. The current text, countdown, cards' added schedule, and share messages always use the live saved schedule.

Unpublishing a program removes it from public schedules and generator choices. Unpublishing the campaign removes all public campaign information. Public pages refresh every 30 seconds and on focus. No notifications, emails, registrations, or payments are triggered by saving this campaign.

## Public invitations

No account or registration is required. Names and invitation messages stay in the browser; the server does not store them. Square PNGs are **1080 × 1080**; portrait PNGs are **1080 × 1350**. The displayed preview and download use the same rendered canvas.

WhatsApp shares invitation text. Facebook shares the event-page link, not an automatically uploaded image. Native image sharing is available where the browser supports file sharing; otherwise download the PNG and attach it manually.

The countdown advances to the next start, including all three baptism mornings. No unknown program end time is invented. Once the final start has passed, the campaign displays a concluded state.

## Data and deployment

An additive, idempotent migration creates `ministry_campaigns` and `ministry_campaign_revisions`; the official campaign is seeded only if absent. Subsequent deployments never reset admin edits. Existing events, event history, subscribers, and devotions are untouched.

The official supplied flyer is optimized into the bundled `/images/end-of-year-crusade-2026.webp` asset. Admin uploads reuse the existing application image-storage service; only the returned public path is saved on the campaign.

Public API: `GET /api/crusade-2026`. Administrator read/save: `GET/PUT /api/crusade-2026/admin`. Flyer upload: `POST /api/crusade-2026/admin/flyer`, multipart `flyer`, at most 10 MB. All write endpoints require the livestream administrator role. Campaign responses use no-store to prevent unpublished material being served from a stale CDN cache.
