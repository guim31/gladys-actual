# Actual Budget for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration that brings your
[Actual Budget](https://actualbudget.org) (the free, self-hosted envelope budgeting app) into Gladys:
account balances, money to budget and the envelopes of the month, with a scene trigger, scene
actions and a dashboard widget.

It only reads: the integration never writes to your budget. Not affiliated with Actual Budget.

## Features

- **Devices**: one per open account (balance), one per visible expense category (budgeted, spent,
  left and share of the envelope used this month), and one for the month (to budget, spent, income).
- **Dashboard widget** "Actual Budget overview": money to budget, balances of the accounts and the
  envelopes of the month, coloured by how much is used.
- **Scene trigger**: an envelope reaching 50, 75, 90 or 100 % of its money, or overspent. A balance
  under a threshold is the standard "device state change" trigger of Gladys.
- **Scene actions**: read the balances or the envelopes, as a sentence to send or read aloud.
- End-to-end encrypted budgets supported; envelope and tracking budgeting.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- An Actual server (`actual-server`) reachable from the Gladys host, with password login, and the
  sync ID of the budget when the server holds several (Actual → Settings → Show advanced settings).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-actual` (or install it from the catalog once it is listed).
2. In **Configuration**, enter the address of the Actual server and its password (plus the sync ID
   and the encryption password if needed), then save. **Test the connection** checks them.
3. Open the **Discover** tab and add the accounts and categories you want: only the devices added
   are followed.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

Actual has no REST API: the integration uses the official
[`@actual-app/api`](https://www.npmjs.com/package/@actual-app/api) package. Every 15 minutes by
default (5 to 60), a worker thread logs in to the server, syncs a local copy of the budget kept
under `/data`, reads the open accounts with their balance and the budget of the month, then ends,
giving its memory back (the package weighs about 100 MB once loaded; the sandbox has 256 MB). The
container publishes only the values that changed, re-sends them every 12 hours, and fires the scene
trigger. Which levels were fired is kept under `/data` (identifiers, months and levels only), so a
restart fires nothing twice.

Money is private: the logs never hold an amount, a name, a password, the sync ID or the address of
the server, even at debug level (the package's own console output is muted), and no account number
reaches Gladys.

## Limitations

- Read only; one server and one budget; password login only (no OpenID).
- The local copy of the budget under `/data` is not encrypted, even for an end-to-end encrypted
  budget.
- No conversion between currencies; no bank sync started from Gladys.
- Developed and tested against a real `actual-server` 26.10.0 in Docker (budgets with accounts,
  categories and transactions created through `@actual-app/api`, with and without end-to-end
  encryption, envelope and tracking), not yet on a Gladys installation with real accounts: feedback
  welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the fake Gladys of the SDK and a fake Actual serving the answers the worker
read on a real `actual-server` 26.10.0 (`test/fixtures/actual`, made-up budgets). See
[`CLAUDE.md`](CLAUDE.md) for the rules of the project.

## Credits

- [Actual Budget](https://github.com/actualbudget/actual) and its `@actual-app/api` package by James
  Long and the Actual contributors (MIT), used as a dependency.
- The Home Assistant custom integration
  [`ha-actualbudget`](https://github.com/jlvcm/ha-actualbudget) and the
  [`actualpy`](https://github.com/bvanelli/actualpy) library showed what users expect (balances,
  budgets); no code is copied from them.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and
  the official JavaScript template.

## License

[Apache 2.0](LICENSE).
