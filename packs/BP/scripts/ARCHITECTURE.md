# Kaleidoscope Ranching Script Architecture

**Role:** ADDON (registers into the Kaleidoscope Cookery host)

Ranching owns its own identifiers and data and registers them with Cookery
through Cookery's public Script Event API. Removing Ranching must never require
an edit to Cookery. Ranching is also a small host of its own: other add-ons can
register animals, feed and recipes through the `kaleidoscope_ranching:*` events
described in `docs/PROPOSAL.zh-TW.md`.

## Folders

- `main.js` — bootstrap only: integrations, components, events.
- `api/` — integration with Cookery and other hosts, and Ranching's own public registration API.
- `data/` — declarative tables. The single source of truth for animals, items, feed, processing recipes and butchering.
- `custom_components/` — block and item custom components.
- `events/` — gameplay event subscriptions.
- `utils/` — small helpers with no lifecycle responsibility.

## Rules

- Data first. Adding an animal, a feed or a recipe is a change to `data/`, not to logic.
- `data/` modules must not import `@minecraft/*`, so `tools/validate.mjs` can load them in Node.
- Every `kaleidoscope_ranching:` identifier used anywhere in `data/` must be declared in `data/items.js` or `data/blocks.js`. The validator enforces this.
- No vanilla file overrides and no world-wide polling. State lives on the entity or block it belongs to; daily needs are settled lazily from elapsed days.
- Check Cookery capabilities before registering optional features; registration must be idempotent.
- Use `// ##` for notes that explain non-obvious Bedrock behaviour or a compatibility constraint.
