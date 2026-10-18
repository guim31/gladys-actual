// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `overview`.
//
// The money to budget (month device added) and the accounts added in Gladys
// as a `status` list (red when negative), then the categories added as a
// `card-list` (8 rows at most, the core's cap): the category as title, spent
// and left as subtitle, the share of the envelope used as a badge, green under
// 75 %, orange up to 100 %, red when overspent. The footer gives the time of
// the reading.
// Budget: 1 status, 1 card-list, 2 texts at most.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { DEVICE_TYPES } from './devices.js';
import { WIDGET_KEY } from './monitor.js';
import { formatAmount, formatDate, formatPercent } from './texts.js';

export const MAX_ROWS = 10;
export const MAX_CATEGORIES = 8;
export const TTL_SECONDS = 300;

export const TEXT = {
  waiting: {
    en: 'Waiting for Actual Budget…',
    fr: 'En attente d’Actual Budget…',
    de: 'Warte auf Actual Budget…',
    es: 'Esperando a Actual Budget…',
  },
  empty: {
    en: 'Add accounts or categories',
    fr: 'Ajoutez comptes ou catégories',
    de: 'Füge Konten/Kategorien hinzu',
    es: 'Añada cuentas o categorías',
  },
  unreachable: {
    en: 'Actual Budget does not answer',
    fr: 'Actual Budget ne répond pas',
    de: 'Actual Budget antwortet nicht',
    es: 'Actual Budget no responde',
  },
  toBudget: { en: 'To budget', fr: 'À budgéter', de: 'Zu budgetieren', es: 'Por presupuestar' },
  spent: { en: 'spent', fr: 'dépensé', de: 'ausgegeben', es: 'gastado' },
  left: { en: 'left', fr: 'restant', de: 'übrig', es: 'restante' },
  budgeted: { en: 'Budgeted', fr: 'Budgété', de: 'Budgetiert', es: 'Presupuestado' },
  readAt: { en: 'Read', fr: 'Lu le', de: 'Gelesen', es: 'Leído' },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The colour of a category: green under 75 %, orange up to 100 %, red when overspent. */
export function categoryColor(category) {
  if (category.left !== null && category.left < 0) {
    return WIDGET_COLORS.DANGER;
  }
  if (category.percent === null) {
    return WIDGET_COLORS.NEUTRAL;
  }
  return category.percent >= 75 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

/** One row of the categories, and its detail panel. */
export function categoryItem(category, currency, language) {
  const amount = (value) => formatAmount(value, currency, language);
  const colon = language === 'fr' ? ' : ' : ': ';
  return {
    title: clip(category.name, 60),
    subtitle: clip(
      `${amount(category.spent)} ${t(TEXT.spent, language)} · ${amount(category.left)} ${t(TEXT.left, language)}`,
      60,
    ),
    badge: { text: formatPercent(category.percent, language), color: categoryColor(category) },
    description: `${t(TEXT.budgeted, language)}${colon}${amount(category.budgeted)}`,
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { language = 'en' } = {}) {
      const lang = TEXT.spent[language] ? language : 'en';
      const components = [];
      if (!monitor.snapshot) {
        const text = monitor.problem ? t(TEXT.unreachable, lang) : t(TEXT.waiting, lang);
        return { ttl_seconds: 60, components: [{ type: 'text', variant: 'heading', text }] };
      }
      const currency = monitor.currency();
      const [month] = monitor.created(DEVICE_TYPES.MONTH);
      const accounts = monitor.created(DEVICE_TYPES.ACCOUNT);
      const categories = monitor.created(DEVICE_TYPES.CATEGORY);
      const rows = [];
      if (month && month.toBudget !== null) {
        rows.push({
          label: t(TEXT.toBudget, lang),
          value: clip(formatAmount(month.toBudget, currency, lang), 40),
          icon: 'inbox',
          color: month.toBudget < 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
        });
      }
      for (const account of accounts) {
        rows.push({
          label: clip(account.name, 40),
          value: clip(formatAmount(account.balance, currency, lang), 40),
          icon: 'credit-card',
          color: account.balance < 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.NEUTRAL,
        });
      }
      if (rows.length === 0 && categories.length === 0) {
        components.push({ type: 'text', variant: 'heading', text: t(TEXT.empty, lang) });
      }
      if (rows.length > 0) {
        components.push({ type: 'status', items: rows.slice(0, MAX_ROWS) });
      }
      if (categories.length > 0) {
        components.push({
          type: 'card-list',
          display: 'list',
          items: categories
            .slice(0, MAX_CATEGORIES)
            .map((category) => categoryItem(category, currency, lang)),
        });
      }
      const unreachable = monitor.problem ? ` · ${t(TEXT.unreachable, lang)}` : '';
      components.push({
        type: 'text',
        variant: 'caption',
        text: clip(
          `Actual Budget · ${t(TEXT.readAt, lang)} ${formatDate(monitor.lastSuccessAt, lang)}${unreachable}`,
          80,
        ),
      });
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};
