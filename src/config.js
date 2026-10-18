// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minutes between two readings. Each reading syncs the budget: a household's
// money does not need more than this.
export const REFRESH_INTERVALS = ['5', '10', '15', '30', '60'];

// Levels of the "category threshold" trigger: percent of the money of the
// envelope spent, and `over` for an overspent envelope (negative balance).
// A select of the trigger: the scene filter only compares values, so each
// level reached is its own event.
export const CATEGORY_LEVELS = ['50', '75', '90', '100', 'over'];

// Currency of the amounts: `auto` takes the default currency set in Actual
// (Settings → Currency), euro when none is set.
export const CURRENCIES = ['auto', 'EUR', 'USD', 'GBP', 'CHF', 'CAD'];
export const FALLBACK_CURRENCY = 'EUR';

export const DEFAULT_CONFIG = {
  url: '',
  password: '',
  sync_id: '',
  encryption_password: '',
  currency: 'auto',
  refresh_interval: '15',
  language: 'fr',
};

// The local copy of the budget, under /data (the only writable path).
export const CACHE_DIR = `${process.env.ACTUAL_DATA_DIR || '/data'}/budget`;

/**
 * The address of the Actual server, from what the user typed: scheme added
 * when missing, trailing slashes removed, credentials refused (they would end
 * up in logs). `null` when it cannot be a URL.
 */
export function parseUrl(text) {
  let value = String(text ?? '').trim();
  if (value === '') {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) {
    return null;
  }
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const typedUrl = String(source.url ?? '').trim();
  return {
    url: parseUrl(typedUrl),
    // A URL typed but not understood, told apart from no URL at all.
    invalidUrl: typedUrl !== '' && parseUrl(typedUrl) === null,
    password: String(source.password ?? ''),
    syncId: String(source.sync_id ?? '').trim(),
    encryptionPassword: String(source.encryption_password ?? ''),
    currency: CURRENCIES.includes(source.currency) ? source.currency : DEFAULT_CONFIG.currency,
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
