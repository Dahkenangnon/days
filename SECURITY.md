# Security Policy

> Before using DaysUnit data in payroll or financial systems, read [DISCLAIMER.md](DISCLAIMER.md) — DaysUnit is **not the legal source of record**.

## Scope

DaysUnit is a static data service — it has no server-side processing, no user accounts, and no authentication system.

Security issues in this project are primarily **data integrity issues**: incorrect public holiday dates, wrong `isWorkingDay` or `isPublicHoliday` flags, missing holidays, or data that could cause downstream financial or payroll errors.

Traditional CVE-class vulnerabilities (RCE, SQLi, auth bypass, etc.) do not apply to the data layer. For the `@claviscore/days` npm library, dependency vulnerabilities or unsafe parsing issues are in scope.

---

## Supported Versions

| Component | Supported |
|-----------|-----------|
| `@claviscore/days` — latest release | ✅ |
| `@claviscore/days` — previous minor | ✅ security fixes only |
| CDN data — current calendar year and forward | ✅ |
| CDN data — past years | ⚠️ corrections merged, but no re-deployment guaranteed |

---

## Reporting a Vulnerability

**Please do not report security issues in public GitHub issues.**

Send a private email to **dah.kenangnon@gmail.com** with:

1. A clear description of the issue
2. Affected component: data file path(s) and/or npm package version
3. The potential impact (e.g. "payroll systems using `isLastWorkingDayOfMonth` on 2026-04-30 in BJ will process payments one day late")
4. A link to an authoritative source confirming the correct data (for data issues)

### Response timeline

| Stage | Target |
|-------|--------|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Resolution / corrected data merged | Within 10 business days for confirmed data errors |

---

## Data Error vs. Security Issue

If a date is simply incorrect but there is no immediate financial or operational risk, you may report it publicly via the [data error issue template](https://github.com/Dahkenangnon/days/issues/new?template=data-error.yml).

Use private disclosure when:
- The error affects `isLastWorkingDayOfMonth` or `isFirstWorkingDayOfMonth` and could cause payroll systems to execute transfers on the wrong date
- Multiple years of data share the same wrong holiday definition
- A schema-level issue causes all API consumers to receive silently malformed data

---

## Dependency Vulnerabilities

Run `npm audit` or `pnpm audit` against your own integration. For vulnerabilities in the `@claviscore/days` package dependencies, open a private report at the email above or use [GitHub private security advisories](https://github.com/Dahkenangnon/days/security/advisories/new).
