// -----------------------------------------------------------------------------
// Worker thread: reads one Actual Budget file with the official
// @actual-app/api package, posts the raw answer back, and ends.
//
// Why a worker: the package keeps one global budget open, writes to the
// console (names, ids, sync errors) and weighs about 110 MB once loaded. In a
// worker, its console is muted without touching the integration's logs, and
// all its memory goes back when the worker ends: between two readings the
// container stays small (the sandbox has 256 MB).
//
// Input (workerData): serverUrl, password, syncId ('' = the only budget of the
// server), encryptionPassword, dataDir (the local copy of the budget, kept
// between readings so a reading only syncs what changed), month (YYYY-MM).
// Output: { ok: true, raw } or { ok: false, code, budgets? }. Error codes come
// from the package (`invalid-password`, `network-failure`, `budget-not-found`,
// `missing-key`, `decrypt-failure`...); its messages are never sent back: they
// hold the name and the sync id of the budget.
// -----------------------------------------------------------------------------

import { mkdir } from 'node:fs/promises';
import { parentPort, workerData } from 'node:worker_threads';

for (const method of [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'group',
  'groupCollapsed',
  'groupEnd',
  'table',
  'dir',
]) {
  console[method] = () => {};
}

const { default: api } = await import('@actual-app/api');

/** The budgets of the server, one per sync id (the package also lists the local copies). */
async function remoteBudgets() {
  const budgets = new Map();
  for (const budget of await api.getBudgets()) {
    if (budget.groupId && !budgets.has(budget.groupId)) {
      budgets.set(budget.groupId, budget.name);
    }
  }
  return budgets;
}

async function read({ serverUrl, password, syncId, encryptionPassword, dataDir, month }) {
  await mkdir(dataDir, { recursive: true });
  await api.init({ dataDir, serverURL: serverUrl, password, verbose: false });
  let id = syncId;
  if (!id) {
    const budgets = await remoteBudgets();
    if (budgets.size !== 1) {
      return {
        ok: false,
        code: budgets.size === 0 ? 'no-budget' : 'choose-budget',
        budgets: [...budgets].map(([groupId, name]) => ({ syncId: groupId, name })),
      };
    }
    [id] = budgets.keys();
  }
  await api.downloadBudget(id, encryptionPassword ? { password: encryptionPassword } : {});
  const accounts = [];
  for (const account of await api.getAccounts()) {
    if (!account.closed) {
      accounts.push({
        id: account.id,
        name: account.name,
        offbudget: account.offbudget === true,
        balance: await api.getAccountBalance(account.id),
      });
    }
  }
  // A month Actual has not created yet (no transaction that far) has no budget.
  const months = await api.getBudgetMonths();
  const budgetMonth = months.includes(month) ? await api.getBudgetMonth(month) : null;
  const preferences = await api.getPreferences().catch(() => ({}));
  // Envelope (default) or tracking budgeting: only the first has money to budget.
  const type = await api
    .aqlQuery(api.q('preferences').filter({ id: 'budgetType' }).select('*'))
    .then((answer) => answer?.data?.[0]?.value)
    .catch(() => undefined);
  return {
    ok: true,
    raw: {
      accounts,
      month: budgetMonth,
      currency: preferences?.defaultCurrencyCode ?? null,
      budgetType: type === 'tracking' ? 'tracking' : 'envelope',
    },
  };
}

let result;
try {
  result = await read(workerData);
} catch (err) {
  result = { ok: false, code: String(err?.code ?? err?.reason ?? 'unknown') };
} finally {
  await api.shutdown().catch(() => {});
}
parentPort.postMessage(result);
