<!--
Thank you for contributing to DaysUnit. Please fill in the relevant section
below and delete the others. Read CONTRIBUTING.md if you haven't already.
-->

## Type of change

- [ ] Data correction (existing country/year)
- [ ] New country or year of data
- [ ] Library feature (`@claviscore/days`)
- [ ] Library bug fix (`@claviscore/days`)
- [ ] CLI change
- [ ] Documentation
- [ ] CI / tooling
- [ ] Other (describe below)

## Summary

<!-- One or two sentences: what does this PR change and why? -->

## Linked issues

<!-- Reference any related issues, e.g. "Closes #123". -->

---

## For data corrections / new data

- [ ] `pnpm validate` passes locally (schema validation)
- [ ] Every modified day file has a `source` URL pointing to an official document (Journal Officiel, ministry decree)
- [ ] `verifiedAt` is set to today's date on every modified record
- [ ] `confidence` is set to `confirmed` (verified) or `tentative` (plausible) — **not** `ai-generated`
- [ ] Month and year aggregates regenerated (`pnpm generate -- --year <YYYY> --country <CC>`)
- [ ] If adding a new year, `packages/data/manifest.json` updated to include it in `yearsAvailable`

**Authoritative source(s):**

<!-- Paste URL(s) of the official document(s) backing this change. -->

---

## For library / CLI changes

- [ ] `pnpm --filter @claviscore/days run typecheck` passes
- [ ] `pnpm build:js` succeeds
- [ ] No new Node.js built-in imports in the main library bundle (`packages/js/src/` excluding `cli.ts` and `resolver.ts` filesystem branch)
- [ ] New public API surface is exported from `types.ts` with named, versioned types
- [ ] Errors throw `DaysError` with a `code` string (not generic `Error`)
- [ ] CHANGELOG-worthy summary included above (will be picked up by GitHub auto-generated release notes)

---

## Additional notes

<!-- Anything reviewers should know: trade-offs, follow-ups, open questions. -->
