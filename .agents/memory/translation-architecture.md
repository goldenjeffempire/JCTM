---
name: Translation architecture
description: Three-tier i18n system for JCTM Digital Sanctuary; how to add translations to new pages.
---

## Three translation tiers

1. **`t(key)`** — Instant static lookup from `artifacts/jctm-platform/src/i18n/ui.ts` (17 languages hardcoded). Use for nav labels, short UI strings, headings already in the table. No network call.

2. **`<T>arbitrary text</T>`** — Async AI translation via `/api/translate` (gpt-4o-mini). Use for long body text, dynamic content, strings not in the static table. Falls back to English immediately, updates async.

3. **`usePageStrings(map)`** — Batch async translation for a whole page's string map. Define a `const PAGE_STRINGS = { key: "English value" }` at module level, call `const s = usePageStrings(PAGE_STRINGS)` inside the component, then use `s.key`. Cached by language code at module level.

## Terms NEVER translated
- JCTM
- Temple TV
- TempleBots
- Prophet Amos
- Prophet Amos Evomobor
- Correction Mandate
- Global Altar

## Coverage achieved
- Navbar: t() for all nav labels (already in place before this session)
- Footer: t() for all column headings, link labels, copyright
- About: usePageStrings for all section headings + bio + contact labels; T for story paragraphs
- Events: t() for Upcoming/Past Events; T for Ministry Calendar, description
- Moments: t() for Ministry Moments header; T for loading/empty states
- Sermons: t() for Sermon Hub; T for badge + description
- Testimonies: t() for Testimony Vault header
- Give, Gallery, Prayer, Join: T for primary h1/h2 headings

## API server
`artifacts/api-server/src/routes/translate.ts` — uses gpt-4o-mini, 5000-entry server-side cache, graceful fallback to local phrase matching if no OPENAI_API_KEY.

## ui.ts gotchas
- File must end with `};` closing the UI object before the `export function uiString` declaration.
- Removing duplicate entries with Python line ranges can accidentally delete the opening `"Key": {` line of the next entry — always verify the file after batch deletions.
