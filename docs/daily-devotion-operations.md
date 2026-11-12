# Daily devotion editorial operations

## Publication policy

- Published history is immutable, including legacy repetitions. New publishing must never recycle it.
- Broad categories may recur; the specific topic, title, passage, and substantial message cannot.
- All reservations and imports share a PostgreSQL transaction lock across workers.
- New identity keys and content fingerprints have database uniqueness constraints.
- A future legacy duplicate is preserved, with its original date and content, in the review queue before replacement.
- Due readings pass the same publication gate for the API, prerender, push, and email. A missing valid reserve produces a devotion-specific unavailable response, not recycled material; the rest of the site remains available.
- Public historical requests are read-only and cannot consume the future reserve.

## Content and automation

The shipped reserve contains 64 independently authored readings, four in each of 16 categories. Each includes KJV Scripture, an introduction, message, concrete application, and closing prayer. Legacy API fields remain available for existing clients.

Background maintenance catches up 90 seconds after startup, then runs at Nigerian midnight and every six hours. It reserves seven days ahead. When fewer than 90 unused readings remain, it requests up to 12 fresh drafts.

AI-assisted expansion was approved by the user. It needs a working `OPENAI_API_KEY` in the deployed server environment. Generation does not run in an audience HTTP request. A separate worker lease prevents concurrent paid batches. Drafts must pass completeness checks, exact quotation verification against the public KJV Scripture service, an independent conservative editorial review of theology and meaning, and the global duplicate gate. Failed checks admit nothing.

Provider failure or exhausted credits never enables fallback recycling. Restore the provider balance and use **Admin → Devotions → Request fresh AI drafts**, or wait for the next scheduled attempt. Review upcoming readings pastorally; automated review is not a substitute for pastoral judgment.

## Administrator workflow

Use livestream administrator access in the existing Admin panel. The Devotions section shows unused stock, category distribution, upcoming content, rejected material, and expansion failures. Editors can atomically import 1–12 reviewed readings as JSON:

```json
[{
  "topic": "A specific previously unused Christian lesson",
  "category": "Faith",
  "title": "An Original Devotion Title",
  "reference": "Book 1:1",
  "scripture": "An exact KJV quotation, verified against the named passage",
  "scriptureVersion": "KJV",
  "introduction": "At least ten words of original introduction.",
  "message": "A full original exposition of at least fifty-five words.",
  "application": "At least twelve words of specific practical application.",
  "closingPrayer": "At least twelve words of original prayer."
}]
```

The example illustrates the contract, not a publishable reading. Allowed categories are Faith, Prayer, Love, Forgiveness, Salvation, Holiness, Obedience, Spiritual Growth, Patience, Gratitude, Perseverance, Divine Direction, Holy Spirit, Christian Living, Community, and Stewardship.

Endpoints (all library operations require livestream administrator authorization):

- `GET /api/devotion/admin/library`
- `POST /api/devotion/admin/library/import` with `{ "confirmReviewed": true, "devotions": [...] }`
- `POST /api/devotion/admin/library/expand` (asynchronous, bounded)

Public API compatibility is retained. New readings add `topic`, `category`, `scriptureVersion`, `introduction`, `message`, `application`, and `closingPrayer`. Existing `reflection`, `prayerFocus`, `propheticWord`, and `declaration` remain present. Website and mobile share the Nigerian calendar day. Mobile can expand the complete reading natively.

## Safe release and verification

The existing Render startup/predeploy migration path adds columns and library tables without dropping historical rows. Its one-time publication marker protects the pre-existing published archive. Do not run schema replacement or delete duplicates. Workspace database changes do not demonstrate that an external Render database has been migrated; verify the deployed service after an authorized release.

```sh
pnpm --filter @workspace/api-server run test:devotions
pnpm --filter @workspace/api-server run devotions:verify-scripture
pnpm --filter @workspace/api-server run devotions:expand --batches=1 --target=90
```

Tests use an isolated, uniquely named temporary test schema and remove only their own fixtures. They do not modify subscribers, deliveries, or public readings. Do not send test broadcasts during library validation.
