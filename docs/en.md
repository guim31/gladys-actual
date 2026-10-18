# Actual Budget

Bring your envelope budget into Gladys: the balances of your accounts, the money still to budget and how each
envelope of the month is doing, read from your own [Actual Budget](https://actualbudget.org), the free and
self-hosted budgeting app.

The integration only reads: it never writes to your budget, never creates a transaction. It talks to your Actual
server directly on your network, with the official `@actual-app/api` package. Not affiliated with Actual Budget.

## What you get

- One **device per open account** (checking, savings, credit card, off-budget investment…): its balance, with
  its history.
- One **device per category** of the budget (an envelope): budgeted, spent and left this month, and the share of
  the envelope used.
- One **month device**: money to budget, spent this month and income this month.
- A **dashboard widget**: the money to budget, the balances of your accounts and the envelopes of the month.
- A **scene trigger**: an envelope reaching 50, 75, 90 or 100 % of its money, or overspent.
- Two **scene actions**: read the balances or the envelopes, as a sentence to send by message or have read aloud.

## Requirements

- Gladys Assistant 5.1 or later.
- An Actual server (`actual-server`, tested with 26.10.0), reachable from the Gladys host (same network, VPN or a
  public address), with a password login.
- The password of the server, and the encryption password if your budget uses end-to-end encryption.

## Configuration

### Finding the sync ID

If your server holds a single budget, leave the sync ID empty: the integration takes that one. Otherwise, in
Actual, open the budget, then **Settings → Show advanced settings**: the **Sync ID** is shown there. Copy it
whole.

### Settings

| Setting                      | What it does                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Address of the Actual server | The address you open Actual with, e.g. `http://192.168.1.20:5006` or `https://budget.home` |
| Server password              | The password you log in to Actual with                                                     |
| Sync ID of the budget        | Empty for the only budget of the server, otherwise the sync ID found above                 |
| Encryption password          | Only for a budget with end-to-end encryption                                               |
| Currency                     | Automatic (the default currency set in Actual, euro if none), or euro, dollar, pound, CHF… |
| Refresh interval             | 5, 10, 15 (default), 30 or 60 minutes                                                      |
| Language of the texts        | Names of the features (at their creation) and sentences of the scenes                      |

Save, then click **Test the connection**: the answer gives how many open accounts and categories the budget
holds, or, with several budgets and no sync ID, their names and sync IDs. Then open the **Discover** tab and add
the devices you want in Gladys. **Only the devices added are followed**: their states, the widget, the trigger
and the actions only cover them.

## Devices

| Device   | Features                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| Account  | Balance (negative for a credit card in debt)                                                |
| Category | Budgeted, Spent, Left (negative when overspent), Envelope used (%)                          |
| Month    | To budget, Spent this month, Income this month (all the income, starting balances included) |

Amounts in euros, dollars or pounds show their unit; another currency is added to the device name
(`Savings (CHF)`). Closed accounts, hidden categories (or in a hidden group) and income categories are left out.
The values are the ones of the current month, in the time zone of Gladys.

**Envelope used** is what was spent this month out of the money the envelope had: what was budgeted plus what
was carried over from last month. An envelope spent from while it was empty shows 1000 %, the cap.

To be warned when a balance falls under a threshold, use the standard trigger of Gladys **"Device state
change"** on the **Balance** of the account, with the condition "less": no need for a trigger of the integration.
The same goes for the money to budget.

## Dashboard widget

**Actual Budget overview** shows the money to budget (if the month device is added) and the accounts added in
Gladys with their balance (red when negative), then the categories added (8 at most) with what was spent and
what is left, and the share of the envelope used: green under 75 %, orange up to 100 %, red when overspent. Tap a
category to see what was budgeted. The footer gives the time of the last reading.

## Scene triggers

- **Actual Budget: envelope threshold**: the spending of a category added in Gladys reaches 50, 75, 90 or 100 %
  of its money this month, or the category is overspent (choose one). It fires once per level and per month.
  The levels already reached when the category is first read are the starting point and fire nothing.
  Variables: name, budgeted, spent, left, share used (%), currency and a ready-made sentence.

What was fired is kept in the integration's data: a restart fires nothing twice.

## Scene actions

- **Actual Budget: read the balances**: the balance of every account added, in one sentence. Outputs: `text`,
  `count`, `total` (sum of the balances).
- **Actual Budget: read the envelopes**: the money to budget (month device added), then what every category
  added has spent and has left. Outputs: `text`, `count`, `over_count` (categories overspent), `to_budget`.

An action reads the budget again when the last reading is older than the refresh interval.

## Scene examples

- **Groceries almost spent**: trigger "envelope threshold", 90 %, on the groceries category; action: notify the
  family on Telegram with `{{triggerEvent.data.text}}`.
- **Overspent**: trigger "envelope threshold", "Overspent", on any category; action: send a message to cover it.
- **Monday morning brief**: every Monday at 8 am, action "read the envelopes", then have `{{output.text}}` read
  aloud by the speaker of the kitchen.

## Privacy and data

- The integration reads your budget and never writes to it.
- The passwords are stored by Gladys like any secret setting, and never written to the logs.
- The logs never hold an amount, a name of account or category, a sync ID or the address of the server, even at
  debug level: only counts, error codes and levels.
- No account number is put in Gladys. Account and category names become device names, which you can rename.
- The integration's data volume keeps a **local copy of the budget** (like the Actual app does), so a reading
  only downloads what changed. This copy is not encrypted, even for an end-to-end encrypted budget: protect the
  Gladys host accordingly. It is removed when another server or budget is configured, and at every restart of
  the integration. The volume also keeps which levels were fired (identifiers, months and levels).

## Troubleshooting

| Message                                | What to do                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| The Actual server refuses the password | Check the password; a server using OpenID login is not supported                          |
| The Actual server does not answer      | Check the address from the Gladys host (port 5006, `http`/`https`), and that Actual is up |
| No budget with this sync ID            | Copy the sync ID again from Settings → Show advanced settings                             |
| The server holds several budgets       | Enter the sync ID: "Test the connection" lists the budgets with theirs                    |
| This budget is end-to-end encrypted    | Enter its encryption password                                                             |
| This budget needs a newer version      | Actual was updated: update the integration too                                            |
| A device has no value                  | Add it in the Discover tab: only the devices added are followed                           |

The logs of the integration (Integrations → Actual Budget → logs) say what happened; set `LOG_LEVEL=debug` for
more detail. An `https` address needs a certificate the integration trusts: with a self-signed one, use the
`http` address of the server on your network.

## Limits

- Read only: no transaction can be created from Gladys.
- One server, one budget; password login only (no OpenID).
- No conversion between currencies: Actual has one currency per budget.
- A tracking budget has no "to budget": that feature stays empty.
- The values follow the refresh interval: a transaction appears in Gladys at the next reading. Bank sync is not
  started by the integration.
- Each reading loads the Actual package for a few seconds (about 100 MB of memory), then frees it.
- Tested against a real `actual-server` 26.10.0 in Docker, with and without end-to-end encryption, not yet on a
  Gladys installation with real accounts: feedback welcome.
