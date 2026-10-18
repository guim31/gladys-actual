// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of Gladys (the
// language of the configuration for the feature names and the scene texts, the
// language of the dashboard for the widget), and the number and date formats.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
export const LANGS = Object.keys(LOCALES);

// Feature names, frozen at creation in Gladys, keyed by feature key
// (src/devices.js).
export const NAMES = {
  en: {
    balance: 'Balance',
    budgeted: 'Budgeted',
    spent: 'Spent',
    left: 'Left',
    percent: 'Envelope used',
    to_budget: 'To budget',
    spent_month: 'Spent this month',
    income_month: 'Income this month',
  },
  fr: {
    balance: 'Solde',
    budgeted: 'Budgété',
    spent: 'Dépensé',
    left: 'Restant',
    percent: 'Enveloppe consommée',
    to_budget: 'À budgéter',
    spent_month: 'Dépensé ce mois-ci',
    income_month: 'Revenus du mois',
  },
  de: {
    balance: 'Kontostand',
    budgeted: 'Budgetiert',
    spent: 'Ausgegeben',
    left: 'Verbleibend',
    percent: 'Umschlag verbraucht',
    to_budget: 'Zu budgetieren',
    spent_month: 'Diesen Monat ausgegeben',
    income_month: 'Einnahmen des Monats',
  },
  es: {
    balance: 'Saldo',
    budgeted: 'Presupuestado',
    spent: 'Gastado',
    left: 'Restante',
    percent: 'Sobre consumido',
    to_budget: 'Por presupuestar',
    spent_month: 'Gastado este mes',
    income_month: 'Ingresos del mes',
  },
};

// The name of the month device (the brand is not translated).
export const MONTH_NAMES = {
  en: 'Actual Budget – month',
  fr: 'Actual Budget – mois',
  de: 'Actual Budget – Monat',
  es: 'Actual Budget – mes',
};

// Sentences of the scene actions and of the scene triggers. Functions take `p`.
export const PHRASES = {
  en: {
    balance: (p) => `${p.name}: ${p.amount}`,
    noAccount: 'No account added to Gladys.',
    toBudget: (p) => `To budget: ${p.amount}`,
    category: (p) => `${p.name}: ${p.spent} spent, ${p.left} left`,
    noCategory: 'No category added to Gladys.',
    categoryLevel: (p) =>
      `Envelope ${p.name}: ${p.percent} used, ${p.spent} spent, ${p.left} left.`,
    categoryOver: (p) => `Envelope ${p.name} overspent: ${p.left}.`,
  },
  fr: {
    balance: (p) => `${p.name} : ${p.amount}`,
    noAccount: 'Aucun compte ajouté à Gladys.',
    toBudget: (p) => `À budgéter : ${p.amount}`,
    category: (p) => `${p.name} : ${p.spent} dépensés, ${p.left} restants`,
    noCategory: 'Aucune catégorie ajoutée à Gladys.',
    categoryLevel: (p) =>
      `Enveloppe ${p.name} : ${p.percent} consommés, ${p.spent} dépensés, ${p.left} restants.`,
    categoryOver: (p) => `Enveloppe ${p.name} dépassée : ${p.left}.`,
  },
  de: {
    balance: (p) => `${p.name}: ${p.amount}`,
    noAccount: 'Kein Konto zu Gladys hinzugefügt.',
    toBudget: (p) => `Zu budgetieren: ${p.amount}`,
    category: (p) => `${p.name}: ${p.spent} ausgegeben, ${p.left} übrig`,
    noCategory: 'Keine Kategorie zu Gladys hinzugefügt.',
    categoryLevel: (p) =>
      `Umschlag ${p.name}: ${p.percent} verbraucht, ${p.spent} ausgegeben, ${p.left} übrig.`,
    categoryOver: (p) => `Umschlag ${p.name} überzogen: ${p.left}.`,
  },
  es: {
    balance: (p) => `${p.name}: ${p.amount}`,
    noAccount: 'Ninguna cuenta añadida a Gladys.',
    toBudget: (p) => `Por presupuestar: ${p.amount}`,
    category: (p) => `${p.name}: ${p.spent} gastados, ${p.left} restantes`,
    noCategory: 'Ninguna categoría añadida a Gladys.',
    categoryLevel: (p) =>
      `Sobre ${p.name}: ${p.percent} consumido, ${p.spent} gastados, ${p.left} restantes.`,
    categoryOver: (p) => `Sobre ${p.name} sobrepasado: ${p.left}.`,
  },
};

// Connection status and configuration action messages, keyed by message.
export const STATUS = {
  en: {
    initFailed: 'The integration could not start: see its logs.',
    noUrl: 'Enter the address of the Actual server and its password.',
    invalidUrl: 'The address of the Actual server is not understood (no user or password in it).',
    noPassword: 'Enter the password of the Actual server.',
    unauthorized: 'The Actual server refuses the password.',
    unreachable: 'The Actual server does not answer: the last values are kept.',
    budgetNotFound: 'No budget with this sync ID on the server (Settings → Advanced settings).',
    noBudget: 'The Actual server holds no budget yet.',
    chooseBudget: 'The server holds several budgets: enter the sync ID of the one to read.',
    encryptionMissing: 'This budget is end-to-end encrypted: enter its encryption password.',
    encryptionWrong: 'The encryption password of the budget is wrong.',
    tooNew: 'This budget needs a newer version of the integration: update it.',
    resync: 'The budget was reset or restored in Actual: it is downloaded again.',
    readFailed: 'The budget could not be read: see the logs of the integration.',
    budgets: (p) => `Budgets on the server: ${p.list}.`,
    summary: (p) =>
      `Connected to Actual Budget: ${p.accounts} open account(s), ${p.categories} category(ies).`,
  },
  fr: {
    initFailed: "L'intégration n'a pas pu démarrer : voir ses journaux.",
    noUrl: "Indiquez l'adresse du serveur Actual et son mot de passe.",
    invalidUrl:
      "L'adresse du serveur Actual n'est pas comprise (sans utilisateur ni mot de passe).",
    noPassword: 'Indiquez le mot de passe du serveur Actual.',
    unauthorized: 'Le serveur Actual refuse le mot de passe.',
    unreachable: 'Le serveur Actual ne répond pas : les dernières valeurs sont gardées.',
    budgetNotFound:
      'Aucun budget avec cet ID de synchronisation sur le serveur (Paramètres → Paramètres avancés).',
    noBudget: "Le serveur Actual n'a encore aucun budget.",
    chooseBudget:
      "Le serveur a plusieurs budgets : indiquez l'ID de synchronisation de celui à lire.",
    encryptionMissing:
      'Ce budget est chiffré de bout en bout : indiquez son mot de passe de chiffrement.',
    encryptionWrong: 'Le mot de passe de chiffrement du budget est faux.',
    tooNew: "Ce budget demande une version plus récente de l'intégration : mettez-la à jour.",
    resync: 'Le budget a été réinitialisé ou restauré dans Actual : il est retéléchargé.',
    readFailed: "Le budget n'a pas pu être lu : voir les journaux de l'intégration.",
    budgets: (p) => `Budgets du serveur : ${p.list}.`,
    summary: (p) =>
      `Connecté à Actual Budget : ${p.accounts} compte(s) ouvert(s), ${p.categories} catégorie(s).`,
  },
  de: {
    initFailed: 'Die Integration konnte nicht starten: siehe ihre Protokolle.',
    noUrl: 'Gib die Adresse des Actual-Servers und sein Passwort an.',
    invalidUrl:
      'Die Adresse des Actual-Servers wird nicht verstanden (ohne Benutzer und Passwort).',
    noPassword: 'Gib das Passwort des Actual-Servers an.',
    unauthorized: 'Der Actual-Server lehnt das Passwort ab.',
    unreachable: 'Der Actual-Server antwortet nicht: die letzten Werte bleiben erhalten.',
    budgetNotFound:
      'Kein Budget mit dieser Sync-ID auf dem Server (Einstellungen → Erweiterte Einstellungen).',
    noBudget: 'Der Actual-Server hat noch kein Budget.',
    chooseBudget: 'Der Server hat mehrere Budgets: gib die Sync-ID des zu lesenden an.',
    encryptionMissing:
      'Dieses Budget ist Ende-zu-Ende-verschlüsselt: gib sein Verschlüsselungspasswort an.',
    encryptionWrong: 'Das Verschlüsselungspasswort des Budgets ist falsch.',
    tooNew: 'Dieses Budget braucht eine neuere Version der Integration: aktualisiere sie.',
    resync: 'Das Budget wurde in Actual zurückgesetzt oder wiederhergestellt: es wird neu geladen.',
    readFailed: 'Das Budget konnte nicht gelesen werden: siehe die Protokolle der Integration.',
    budgets: (p) => `Budgets auf dem Server: ${p.list}.`,
    summary: (p) =>
      `Mit Actual Budget verbunden: ${p.accounts} offene(s) Konto/Konten, ${p.categories} Kategorie(n).`,
  },
  es: {
    initFailed: 'La integración no pudo iniciarse: consulte sus registros.',
    noUrl: 'Indique la dirección del servidor Actual y su contraseña.',
    invalidUrl: 'La dirección del servidor Actual no se entiende (sin usuario ni contraseña).',
    noPassword: 'Indique la contraseña del servidor Actual.',
    unauthorized: 'El servidor Actual rechaza la contraseña.',
    unreachable: 'El servidor Actual no responde: se conservan los últimos valores.',
    budgetNotFound:
      'Ningún presupuesto con este ID de sincronización en el servidor (Ajustes → Ajustes avanzados).',
    noBudget: 'El servidor Actual aún no tiene ningún presupuesto.',
    chooseBudget:
      'El servidor tiene varios presupuestos: indique el ID de sincronización del que desea leer.',
    encryptionMissing:
      'Este presupuesto está cifrado de extremo a extremo: indique su contraseña de cifrado.',
    encryptionWrong: 'La contraseña de cifrado del presupuesto es incorrecta.',
    tooNew: 'Este presupuesto requiere una versión más reciente de la integración: actualícela.',
    resync: 'El presupuesto se restableció o restauró en Actual: se descarga de nuevo.',
    readFailed: 'No se pudo leer el presupuesto: consulte los registros de la integración.',
    budgets: (p) => `Presupuestos del servidor: ${p.list}.`,
    summary: (p) =>
      `Conectado a Actual Budget: ${p.accounts} cuenta(s) abierta(s), ${p.categories} categoría(s).`,
  },
};

/** A STATUS (or PHRASES) entry as a multi-language object. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGS.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

const locale = (language) => LOCALES[language] ?? LOCALES.en;
const ISO_CURRENCY = /^[A-Z]{3}$/;

/** An amount with its currency: "1 234,56 €", "-12.30 CHF". */
export function formatAmount(value, currency, language, decimals = 2) {
  if (value === null || value === undefined) {
    return '–';
  }
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (currency && ISO_CURRENCY.test(currency)) {
    try {
      return new Intl.NumberFormat(locale(language), {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        ...digits,
      }).format(value);
    } catch {
      // An unknown code falls back on the plain number.
    }
  }
  const number = new Intl.NumberFormat(locale(language), digits).format(value);
  return currency ? `${number} ${currency}` : number;
}

/** A percentage without sign: "82 %", "82%". */
export function formatPercent(value, language) {
  if (value === null || value === undefined) {
    return '–';
  }
  return new Intl.NumberFormat(locale(language), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

/** Date and time in the time zone of Gladys (TZ): "15/10 17:38". */
export function formatDate(ms, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
