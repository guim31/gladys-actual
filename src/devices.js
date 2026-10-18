// -----------------------------------------------------------------------------
// The Gladys devices built from a snapshot of the budget (src/actual.js):
//
//   account   one per open account, on or off budget: balance;
//   category  one per visible expense category: budgeted, spent and left
//             this month, and the share of the envelope spent;
//   month     one for the budget: to budget, spent and income this month.
//
// The platform id is the id Actual gives the account or category: renaming
// one in Actual keeps its device. Names of accounts and categories are the
// device names; no sync id, no account number is ever published. Every feature
// is read-only, with should_poll: false: the readings run in the container
// (src/monitor.js).
//
// Couples checked against the Gladys front in test/gladys-rules.test.js.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { MAX_PERCENT } from './actual.js';
import { MONTH_NAMES, NAMES } from './texts.js';

export const DEVICE_TYPES = {
  ACCOUNT: 'account',
  CATEGORY: 'category',
  MONTH: 'month',
};

// The one month device of the budget.
export const MONTH_ID = 'budget';

export const FEATURE_KEYS = {
  account: ['balance'],
  category: ['budgeted', 'spent', 'left', 'percent'],
  month: ['to_budget', 'spent_month', 'income_month'],
};

// Display bounds only (the core never applies them), symmetric for the
// amounts that can be negative (a credit card, an overspent envelope).
const MAX_AMOUNT = 1e12;

const CURRENCY_UNITS = { EUR: UNITS.EURO, USD: UNITS.DOLLAR, GBP: UNITS.POUND_STERLING };

/** The unit of an amount in this currency, or undefined. */
export const unitOf = (currency) => CURRENCY_UNITS[currency];

/** The platform id of an object: its Actual id, kept to safe characters. */
export const platformIdOf = (id) => String(id).replace(/[^A-Za-z0-9-]/g, '_');

/** External ids of the device of an object and of its features. */
export function deviceIds(gladys, type, id) {
  const ids = gladys.externalIds(type, platformIdOf(id));
  return {
    device: ids.device,
    ...Object.fromEntries(FEATURE_KEYS[type].map((key) => [key, ids.feature(key)])),
  };
}

const feature = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

/** The name of a device: the name in Actual, with the currency when no unit says it. */
const nameOf = (name, currency) => (currency && !unitOf(currency) ? `${name} (${currency})` : name);

const MODELS = {
  account: 'Actual Budget account',
  category: 'Actual Budget category',
  month: 'Actual Budget',
};

/**
 * The discovery payload of an object.
 * @param {object} gladys
 * @param {string} type one of DEVICE_TYPES
 * @param {object} item the parsed object (src/actual.js), `{}` for the month
 * @param {string} currency ISO code of the amounts
 * @param {string} language of the names
 */
export function buildDevice(gladys, type, item, currency, language = 'fr') {
  const ids = deviceIds(gladys, type, type === DEVICE_TYPES.MONTH ? MONTH_ID : item.id);
  const names = NAMES[language] ?? NAMES.fr;
  const unit = unitOf(currency);
  const money = (key, min = -MAX_AMOUNT) =>
    feature(names[key], ids[key], CATEGORIES.CURRENCY, TYPES.CURRENCY.DECIMAL, {
      keep_history: true,
      min,
      max: MAX_AMOUNT,
      ...(unit ? { unit } : {}),
    });
  const features = {
    account: () => [money('balance')],
    // Budgeted can be negative (money taken back from an envelope), spent too
    // (a refund).
    category: () => [
      money('budgeted'),
      money('spent'),
      money('left'),
      feature(names.percent, ids.percent, CATEGORIES.CURRENCY, TYPES.CURRENCY.DECIMAL, {
        unit: UNITS.PERCENT,
        keep_history: true,
        min: 0,
        max: MAX_PERCENT,
      }),
    ],
    month: () => [money('to_budget'), money('spent_month'), money('income_month')],
  }[type]();
  return {
    name:
      type === DEVICE_TYPES.MONTH
        ? (MONTH_NAMES[language] ?? MONTH_NAMES.fr)
        : nameOf(item.name, currency),
    external_id: ids.device,
    model: MODELS[type],
    should_poll: false,
    params: [],
    features,
  };
}
