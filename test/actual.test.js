// -----------------------------------------------------------------------------
// The parsing of the raw answer of Actual (amounts in cents, hidden and income
// categories, the share of an envelope used), the problems shown for the error
// codes of @actual-app/api, and the worker itself, run without a server.
// -----------------------------------------------------------------------------

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ActualError,
  MAX_PERCENT,
  localMonth,
  parseSnapshot,
  percentUsed,
  problemOf,
  readBudget,
} from '../src/actual.js';
import { fixture } from './helpers/world.js';

test('the share of an envelope used counts the money carried over', () => {
  assert.equal(percentUsed(0, 100), 0);
  assert.equal(percentUsed(25, 75), 25);
  assert.equal(percentUsed(90, -10), 112.5);
  assert.equal(percentUsed(25, -25), MAX_PERCENT, 'spent from an empty envelope');
  assert.equal(percentUsed(-10, 110), 0, 'a refund');
  assert.equal(percentUsed(null, null), null);
  assert.equal(percentUsed(1e9, -1e9 + 1), MAX_PERCENT);
});

test('the recorded budget: cents, spending as positive, hidden and income left out', () => {
  const snapshot = parseSnapshot(fixture('actual/budget.json'));
  assert.equal(snapshot.accounts.length, 4);
  assert.deepEqual(
    snapshot.accounts.find((a) => a.name === 'Credit card'),
    {
      id: '87a445e9-b9d2-4d84-9e22-e6e259b5a7da',
      name: 'Credit card',
      offbudget: false,
      balance: -120.5,
    },
  );
  assert.deepEqual(
    snapshot.categories.map((c) => c.name),
    ['Gifts', 'Food', 'General', 'Bills', 'Bills (Flexible)', 'Savings'],
  );
  assert.deepEqual(snapshot.month, {
    month: '2026-10',
    toBudget: 8572.95,
    spent: 490.5,
    income: 9202.95,
  });
  assert.equal(snapshot.currency, null);
});

test('a tracking budget has no money to budget: the value is left out', () => {
  const raw = fixture('actual/budget.json');
  raw.budgetType = 'tracking';
  assert.equal(parseSnapshot(raw).month.toBudget, null);
  // Recorded on a budget switched to tracking.
  const tracking = parseSnapshot(fixture('actual/tracking.json'));
  assert.deepEqual(tracking.month, { month: '2026-10', toBudget: null, spent: 30, income: 1000 });
  assert.deepEqual(
    tracking.categories.find((c) => c.name === 'Food'),
    { ...tracking.categories.find((c) => c.name === 'Food'), budgeted: 100, spent: 30, left: 70 },
  );
  assert.deepEqual(parseSnapshot({}), {
    accounts: [],
    categories: [],
    month: null,
    currency: null,
  });
});

test('every error code of the package has a problem the user can act on', () => {
  const cases = {
    'invalid-password': 'unauthorized',
    'network-failure': 'unreachable',
    timeout: 'unreachable',
    'budget-not-found': 'budgetNotFound',
    'missing-key': 'encryptionMissing',
    'decrypt-failure': 'encryptionWrong',
    'choose-budget': 'chooseBudget',
    'out-of-sync-migrations': 'tooNew',
    'file-has-reset': 'resync',
    'something-new': 'readFailed',
  };
  for (const [code, problem] of Object.entries(cases)) {
    assert.equal(problemOf(new ActualError(code)), problem, code);
  }
  assert.equal(
    new ActualError('missing-key').message,
    'Actual Budget reading failed (missing-key)',
  );
});

test('the month is the one of the time zone of Gladys', () => {
  process.env.TZ = 'Europe/Paris';
  assert.equal(localMonth(Date.parse('2026-10-31T23:30:00Z')), '2026-11');
});

test('the worker loads @actual-app/api and answers an error code', async () => {
  // No server: the package cannot list the budgets, nothing touches the network.
  const error = await readBudget({
    serverUrl: undefined,
    password: 'x',
    syncId: '',
    encryptionPassword: '',
    dataDir: join(mkdtempSync(join(tmpdir(), 'gladys-actual-')), 'budget'),
    month: '2026-10',
  }).catch((err) => err);
  assert.ok(error instanceof ActualError);
  assert.equal(typeof error.code, 'string');
  assert.notEqual(error.code, 'worker-failed');
});
