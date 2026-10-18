// -----------------------------------------------------------------------------
// The scene actions `read_balances` and `read_budgets`, and the configuration
// action `check_now`. They read the budget again when the last cycle is older
// than one interval, and answer with a sentence a scene can send by message
// or read aloud. Only the devices added in Gladys are told.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { DEVICE_TYPES } from './devices.js';
import { PHRASES, STATUS, formatAmount, render } from './texts.js';

const logger = createLogger({ name: 'actual-actions' });

export const SCENE_ACTIONS = {
  BALANCES: 'read_balances',
  BUDGETS: 'read_budgets',
};
export const CONFIG_ACTION = 'check_now';

/** The snapshot, or the reason there is none, thrown in the language of the configuration. */
async function snapshotOf(monitor) {
  const snapshot = await monitor.fresh();
  if (!snapshot || monitor.problem) {
    const problem = monitor.problem ?? 'unreachable';
    // The last values are better than nothing for a reading, but not a refused password.
    if (!snapshot || problem !== 'unreachable') {
      throw new Error(STATUS[monitor.config.language][problem]);
    }
  }
  return snapshot;
}

const sentence = (parts, none) => (parts.length === 0 ? none : `${parts.join('. ')}.`);

/** Scene action: the balance of every account added. Outputs `text`, `count`, `total`. */
export async function readBalances(monitor) {
  await snapshotOf(monitor);
  const language = monitor.config.language;
  const currency = monitor.currency();
  const phrases = PHRASES[language];
  const accounts = monitor.created(DEVICE_TYPES.ACCOUNT);
  const parts = accounts.map((account) =>
    phrases.balance({
      name: account.name,
      amount: formatAmount(account.balance, currency, language),
    }),
  );
  const total = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
  return {
    text: sentence(parts, phrases.noAccount),
    count: accounts.length,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Scene action: the money to budget (month device added), then what every
 * category added has spent and has left. Outputs `text`, `count`,
 * `over_count`, `to_budget`.
 */
export async function readBudgets(monitor) {
  await snapshotOf(monitor);
  const language = monitor.config.language;
  const currency = monitor.currency();
  const phrases = PHRASES[language];
  const categories = monitor.created(DEVICE_TYPES.CATEGORY);
  const [month] = monitor.created(DEVICE_TYPES.MONTH);
  const parts = categories.map((category) =>
    phrases.category({
      name: category.name,
      spent: formatAmount(category.spent, currency, language),
      left: formatAmount(category.left, currency, language),
    }),
  );
  if (month && month.toBudget !== null) {
    parts.unshift(phrases.toBudget({ amount: formatAmount(month.toBudget, currency, language) }));
  }
  return {
    text: sentence(parts, phrases.noCategory),
    count: categories.length,
    over_count: categories.filter((category) => category.left !== null && category.left < 0).length,
    to_budget: month?.toBudget ?? 0,
  };
}

/** Configuration action: a reading now, and what the budget holds, in every language. */
export async function checkNow(monitor) {
  const snapshot = await monitor.fresh(true);
  if (monitor.problem || !snapshot) {
    const problem = monitor.problem ?? 'unreachable';
    logger.info(`Connection test: failed (${problem})`);
    const message = render(STATUS, problem);
    if (problem === 'chooseBudget' && monitor.budgets?.length) {
      // Shown to the user only, never logged: the names and sync ids to choose from.
      const list = monitor.budgets.map((budget) => `${budget.name} (${budget.syncId})`).join(', ');
      const budgets = render(STATUS, 'budgets', { list });
      for (const language of Object.keys(message)) {
        message[language] = `${message[language]} ${budgets[language]}`;
      }
    }
    return message;
  }
  logger.info('Connection test: Actual Budget answers');
  return render(STATUS, 'summary', {
    accounts: snapshot.accounts.length,
    categories: snapshot.categories.length,
  });
}
