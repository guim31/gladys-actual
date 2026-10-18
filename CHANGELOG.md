# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-18

### Added

- Actual Budget in Gladys, read only, through the official `@actual-app/api` package: one device
  per open account (balance), per visible expense category (budgeted, spent, left and share of the
  envelope used this month) and one for the month (to budget, spent, income).
- End-to-end encrypted budgets (encryption password), envelope and tracking budgeting, the only
  budget of the server or the one of a sync ID.
- Dashboard widget "Actual Budget overview": money to budget, balances and envelopes of the month.
- Scene trigger "envelope threshold" (50, 75, 90 or 100 %, or overspent), fired once per level and
  per month, even across restarts.
- Scene actions reading the balances and the envelopes as a sentence.
- "Test the connection" action (it lists the budgets of the server when there are several),
  currency taken from Actual or chosen, refresh interval from 5 to 60 minutes.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-actual/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-actual/releases/tag/v1.0.0
