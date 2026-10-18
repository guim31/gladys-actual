// -----------------------------------------------------------------------------
// Actual Budget: one reading in a worker thread (src/reader.js), and the
// parsing of its raw answer into what the devices show.
//
// Amounts are integers in cents in Actual (12345 = 123.45); spending is
// negative. Read only: the integration never writes to the budget.
// -----------------------------------------------------------------------------

import { rm } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';

// A first download of a large budget takes a few seconds; a stuck server
// must not block the readings forever.
export const READ_TIMEOUT_MS = 120000;
// Heap of the worker: the package alone takes about 60 MB of it. The
// container has 256 MB in all.
const WORKER_HEAP_MB = 160;

/** Error codes of the package, sorted into the problems shown to the user. */
const PROBLEMS = {
  'invalid-password': 'unauthorized',
  'token-expired': 'unauthorized',
  unauthorized: 'unauthorized',
  'network-failure': 'unreachable',
  timeout: 'unreachable',
  'budget-not-found': 'budgetNotFound',
  'file-not-found': 'budgetNotFound',
  'no-budget': 'noBudget',
  'choose-budget': 'chooseBudget',
  'missing-key': 'encryptionMissing',
  'decrypt-failure': 'encryptionWrong',
  'invalid-key-state': 'encryptionWrong',
  'out-of-sync-migrations': 'tooNew',
  'out-of-sync-data': 'tooNew',
  'file-needs-upload': 'resync',
  'file-has-reset': 'resync',
  'file-old-version': 'resync',
};

export class ActualError extends Error {
  constructor(code, budgets) {
    // The code only: the messages of the package hold names and ids.
    super(`Actual Budget reading failed (${code})`);
    this.code = code;
    this.budgets = budgets;
  }
}

/** The STATUS key of a failed reading. */
export const problemOf = (err) => PROBLEMS[err?.code] ?? 'readFailed';

/**
 * One reading of the budget in a worker, which ends with it.
 * @param {object} options workerData of src/reader.js
 * @returns {Promise<object>} the raw answer; throws an ActualError
 */
export function readBudget(options) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./reader.js', import.meta.url), {
      workerData: options,
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
      // The worker writes nothing; its stdout must not reach the logs anyway.
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const settle = (fn, value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn(value);
      }
    };
    const timer = setTimeout(() => {
      settle(reject, new ActualError('timeout'));
      worker.terminate();
    }, READ_TIMEOUT_MS);
    worker.on('message', (result) => {
      if (result?.ok) {
        settle(resolve, result.raw);
      } else {
        settle(reject, new ActualError(result?.code ?? 'unknown', result?.budgets));
      }
    });
    worker.on('error', (err) => {
      const code = err?.code === 'ERR_WORKER_OUT_OF_MEMORY' ? 'out-of-memory' : 'worker-failed';
      settle(reject, new ActualError(code));
    });
    worker.on('exit', () => settle(reject, new ActualError('worker-failed')));
  });
}

/** Removes the local copy of the budget (another server or budget configured). */
export async function clearCache(dataDir) {
  await rm(dataDir, { recursive: true, force: true });
}

// `+ 0` turns the -0 of a negated zero into 0 ("-0,00 €" otherwise).
const cents = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) / 100 + 0 : null;

// Percent used is capped for display; an envelope empty from the start but
// spent from shows the cap.
export const MAX_PERCENT = 1000;

/**
 * The share of the money of an envelope already spent, in percent with one
 * decimal: spent / (what was available this month = balance + spent). 0 when
 * nothing is spent, MAX_PERCENT when something is spent from an empty
 * envelope.
 */
export function percentUsed(spent, left) {
  if (spent === null || left === null || spent <= 0) {
    return spent === null ? null : 0;
  }
  const funds = left + spent;
  if (funds <= 0) {
    return MAX_PERCENT;
  }
  return Math.min(MAX_PERCENT, Math.round((spent / funds) * 1000) / 10);
}

/**
 * The snapshot shown by the integration, from the raw answer of the worker.
 * Income categories and hidden ones (or in a hidden group) are left out.
 */
export function parseSnapshot(raw) {
  const accounts = (raw?.accounts ?? []).map((account) => ({
    id: String(account.id),
    name: String(account.name ?? ''),
    offbudget: account.offbudget === true,
    balance: cents(account.balance),
  }));
  const month = raw?.month ?? null;
  const categories = [];
  for (const group of month?.categoryGroups ?? []) {
    if (group.is_income || group.hidden) {
      continue;
    }
    for (const category of group.categories ?? []) {
      if (category.is_income || category.hidden) {
        continue;
      }
      // Spending is negative in Actual; a refund makes it positive.
      const spent = cents(category.spent === undefined ? null : -category.spent);
      const left = cents(category.balance);
      categories.push({
        id: String(category.id),
        name: String(category.name ?? ''),
        budgeted: cents(category.budgeted),
        spent,
        left,
        percent: percentUsed(spent, left),
      });
    }
  }
  return {
    accounts,
    categories,
    month: month
      ? {
          month: String(month.month),
          // Envelope budgeting only: a tracking budget has no "to budget".
          toBudget: raw.budgetType === 'tracking' ? null : cents(month.toBudget),
          spent: cents(month.totalSpent === undefined ? null : -month.totalSpent),
          income: cents(month.totalIncome),
        }
      : null,
    currency: typeof raw?.currency === 'string' && raw.currency ? raw.currency : null,
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** The calendar day in the time zone of Gladys (TZ), as YYYY-MM-DD. */
export function localDay(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The month in the time zone of Gladys (TZ), as YYYY-MM. */
export const localMonth = (ms) => localDay(ms).slice(0, 7);
