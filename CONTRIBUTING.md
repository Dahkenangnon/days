# Contributing to DaysUnit

Thank you for helping improve West African calendar data and the DaysUnit library. This guide covers data corrections, new country data, and library contributions.

## Table of Contents

- [Contributing to DaysUnit](#contributing-to-daysunit)
  - [Table of Contents](#table-of-contents)
  - [1. Reporting a Data Error](#1-reporting-a-data-error)
  - [2. Submitting a Data Correction (PR)](#2-submitting-a-data-correction-pr)
    - [Requirements](#requirements)
    - [Steps](#steps)
    - [PR checklist](#pr-checklist)
  - [3. Development Setup](#3-development-setup)
    - [Prerequisites](#prerequisites)
    - [Install](#install)
    - [Workspace scripts](#workspace-scripts)
    - [Project structure](#project-structure)
  - [4. Adding Data for a New Country or Year](#4-adding-data-for-a-new-country-or-year)
    - [Day file format](#day-file-format)
    - [Confidence rules](#confidence-rules)
    - [`tools/sources.json` — country-level fields](#toolssourcesjson--country-level-fields)
  - [5. Library Contributions](#5-library-contributions)
  - [6. Commit \& Branch Conventions](#6-commit--branch-conventions)
    - [Branch naming](#branch-naming)
    - [Commit messages](#commit-messages)
    - [Release tags](#release-tags)
  - [7. Maintainer: Annual Pre-generation](#7-maintainer-annual-pre-generation)
  - [8. Maintainer: Reviewing AI-proposed PRs](#8-maintainer-reviewing-ai-proposed-prs)

---

## 1. Reporting a Data Error

Use the [data error issue template](https://github.com/Dahkenangnon/days/issues/new?template=data-error.yml). Please include:

- The affected country and date(s)
- What is wrong (e.g. "2026-03-20 should be a public holiday")
- A link to the official source document (Journal Officiel, government decree, etc.)

---

## 2. Submitting a Data Correction (PR)

All data corrections follow the same process:

### Requirements

Every modified day file **must**:

1. **Pass schema validation** — the `validate.yml` CI check must pass on your PR.
2. **Include a `source` URL** pointing to an official document (Journal Officiel, ministry decree, government website).
3. **Set `verifiedAt`** to the date of your PR submission (ISO 8601, e.g. `"2026-03-15"`).
4. **Set `confidence`**:
   - `"confirmed"` — you have verified the data against the source document
   - `"tentative"` — the data is plausible but the source is not fully authoritative

### Steps

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_FORK/days.git
cd days

# 2. Create a branch
git checkout -b fix/bj-2026-03-20-holiday

# 3. Edit the relevant day file(s) under packages/data/
# e.g. packages/data/bj/2026/03/20.json

# 4. Regenerate month and year aggregates
pnpm install
pnpm generate -- --year 2026 --country BJ

# 5. Validate schema
pnpm validate

# 6. Commit and push
git add packages/data/bj/
git commit -m "fix(data): BJ 2026-03-20 — add Prophet's Birthday"
git push origin fix/bj-2026-03-20-holiday

# 7. Open a PR — fill in the template
```

### PR checklist

The pull request template will ask you to confirm:

- [ ] Schema validation passes locally (`pnpm validate`)
- [ ] `source` field is set to a URL pointing to an official document
- [ ] `verifiedAt` is set to today's date
- [ ] `confidence` is `confirmed` or `tentative` (not `ai-generated`)
- [ ] Month and year aggregates were regenerated (`pnpm generate`)

---

## 3. Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 9 (`npm install -g pnpm`)

### Install

```bash
git clone https://github.com/Dahkenangnon/days.git
cd days
pnpm install
```

### Workspace scripts

```bash
# Validate all data files against JSON Schema
pnpm validate

# Build the @claviscore/days npm package
pnpm build:js

# Type-check the JS library
pnpm --filter @claviscore/days run typecheck

# Regenerate month + year aggregates for a given year
pnpm generate -- --year 2026

# Dry run (validate without writing)
pnpm generate -- --year 2026 --dry-run

# Regenerate for a specific country
pnpm generate -- --year 2026 --country BJ
```

### Project structure

```
days/
├── packages/
│   ├── data/            ← Static JSON calendar files (CDN root)
│   │   ├── schema/      ← JSON Schema Draft 2020-12 definitions
│   │   ├── manifest.json
│   │   └── {country}/{year}/{month}/{day}.json
│   └── js/              ← @claviscore/days npm package
│       └── src/
│           ├── index.ts        ← public API
│           ├── builder.ts      ← fluent chain
│           ├── resolver.ts     ← local cache → CDN
│           ├── fetcher.ts      ← runtime-agnostic fetch
│           ├── types.ts        ← exported types
│           ├── errors.ts       ← DaysError
│           └── cli.ts          ← days binary
└── tools/
    ├── generate-aggregates.ts  ← builds month + year aggregates
    └── seed-country.ts         ← seeds day files from sources.json
```

---

## 4. Adding Data for a New Country or Year

New country or year data is added in batches via a `data/pre-gen-{year}` or `data/add-{country}` branch.

### Day file format

Each day file lives at `packages/data/{country-lowercase}/{year}/{mm}/{dd}.json` and must conform to `packages/data/schema/day.schema.json`.

Minimum required fields for a non-holiday working day:

```json
{
  "schemaVersion": "1.0",
  "date": "2026-02-02",
  "country": "BJ",
  "countryName": "Bénin",
  "countryNames": { "fr": "Bénin", "en": "Benin" },
  "timezone": "Africa/Porto-Novo",
  "dayOfWeek": 1,
  "isWeekend": false,
  "isPublicHoliday": false,
  "isWorkingDay": true,
  "isFirstWorkingDayOfMonth": false,
  "isLastWorkingDayOfMonth": false,
  "isRamadanPeriod": false,
  "holidayName": null,
  "holidayType": null,
  "religiousAffiliation": null,
  "observedDate": null,
  "legalBasis": null,
  "source": null,
  "verifiedAt": "2025-11-01",
  "confidence": "confirmed",
  "weekNumber": 6,
  "quarter": 1,
  "workingDayOfMonth": 2,
  "workingDayOfYear": 23
}
```

After editing day files, always regenerate aggregates:

```bash
pnpm generate -- --year 2026 --country BJ
```

### Confidence rules

| `confidence` | When to use |
|---|---|
| `confirmed` | Verified against an official source you can link |
| `tentative` | Best estimate; no fully authoritative source available |
| `ai-generated` | **Do not submit in PRs.** This value is reserved for the automated monitor. |

### `tools/sources.json` — country-level fields

Each country entry in `tools/sources.json` accepts the following fields. The seeder reads these and populates the §A fields automatically (see [README §Annex A](./README.md#annex-a--field-provenance) for the field-provenance taxonomy):

| Field | Required | Purpose |
|---|---|---|
| `timezone` | ✓ | IANA timezone (e.g. `Africa/Porto-Novo`) |
| `countryName` | ✓ | Native-language country name |
| `countryNames` | ✓ | i18n map; `fr` and `en` mandatory, `pt` mandatory for Guinea-Bissau |
| `holidays["YYYY"]` | ✓ | Array of holiday definitions for the year |
| `observedDateRule` | optional | One of `"none"` (default), `"shift-sunday-to-monday"`, `"shift-weekend-to-monday"`. Drives the auto-computation of `observedDate` and the auto-creation of synthetic `observance` entries on the substituted date. |
| `ramadan["YYYY"]` | optional | `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }` — inclusive date range used to flag `isRamadanPeriod: true`. Required for ML, NE, SN, BF where it carries legal weight; optional elsewhere. |
| `references` | optional | Array of `{ url, description }` entries documenting the research sources used to verify the holiday list. Not consumed by tooling — kept for human auditability. Append new sources whenever a year is added or a date is corrected. |

A minimal new-country entry looks like:

```jsonc
"XX": {
  "timezone": "Africa/Some_City",
  "countryName": "...",
  "countryNames": { "fr": "...", "en": "..." },
  "observedDateRule": "none",
  "references": [
    { "url": "https://...", "description": "Official gazette listing" }
  ],
  "holidays": {
    "2026": [ /* HolidayDef[] — see existing entries for shape */ ]
  }
}
```

The `references` array is the primary place to record per-country source URLs (Wikipedia, official gazette, government communiqués, calendar cross-checks, lunar-prediction tables, etc.). Per-holiday `source` URLs still belong on the individual `HolidayDef` entries — `references` is for the broader research trail.

---

## 5. Library Contributions

For changes to the `@claviscore/days` TypeScript library:

```bash
# Make changes in packages/js/src/

# Type-check
pnpm --filter @claviscore/days run typecheck

# Build
pnpm build:js
```

**Guidelines:**
- Maintain strict TypeScript — no `any`, no type assertions without comment
- The main library bundle must use zero Node.js built-ins (only Web Standard APIs)
- New API methods must have corresponding type exports in `types.ts`
- Follow the existing error-handling pattern (`DaysError` with a `code` string)

---

## 6. Commit & Branch Conventions

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Data fix | `fix/data-{country}-{date}` | `fix/data-bj-2026-03-20` |
| New country data | `data/add-{country}-{year}` | `data/add-sn-2027` |
| Annual pre-gen | `data/pre-gen-{year}` | `data/pre-gen-2027` |
| Library feature | `feat/days-{description}` | `feat/days-batch-range` |
| Library fix | `fix/days-{description}` | `fix/days-resolver-cache` |

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(data): BJ 2026-03-20 — add Prophet's Birthday
feat(days): add workingDaysBetween() helper
chore: bump @claviscore/days to 1.1.0
```

### Release tags

```bash
# Data release
git tag data/v2026-02
git push --tags

# Package release (triggers GitHub Release + npm publish)
git tag js/v1.1.0
git push --tags
```

---

## 7. Maintainer: Annual Pre-generation

This section is for ClavisCore maintainers responsible for adding a new year of data.

**Timeline:** Run each November for the following year. Merge before December 1.

**Process:**

1. Create a branch: `git checkout -b data/pre-gen-{year}`
2. Collect public holiday data from each country's official sources (see `tools/sources.json`).
3. Update `tools/sources.json` with the new year's holiday definitions.
4. Seed day files:
   ```bash
   # Run for each country
   tsx tools/seed-country.ts --country BJ --year 2027
   ```
5. Generate aggregates:
   ```bash
   pnpm generate -- --year 2027
   ```
6. Validate:
   ```bash
   pnpm validate
   ```
7. Update `packages/data/manifest.json` to include the new year in `yearsAvailable`.
8. Open a PR with label `pre-generation`.
9. At least one other maintainer reviews the data against the source list.
10. Tag after merge: `git tag data/v2027-01 && git push --tags`

---

## 8. Maintainer: Reviewing AI-proposed PRs

The automated exception monitor opens PRs labelled `ai-proposed` when it detects a change in an official source. These PRs set `confidence: "ai-generated"` on all modified records.

**Review checklist:**

1. Read the PR body — it contains the raw excerpt from the source document and the monitor's reasoning.
2. Verify the affected dates against the linked source URL.
3. Change `confidence` on each modified record to `"confirmed"` (verified) or `"tentative"` (plausible but not fully authoritative).
4. Run `pnpm validate` locally to confirm the schema still passes.
5. Approve and merge.

> **Never auto-merge AI-proposed PRs.** Human approval is always required.

