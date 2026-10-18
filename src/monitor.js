// -----------------------------------------------------------------------------
// The monitor: reads the Actual budget every `refresh_interval` minutes,
// publishes the devices and their states, fires the scene trigger and serves
// the widget and the actions.
//
// Devices are published with should_poll: false: the container runs its own
// timer (the core only polls up to one minute, and see the 5.2.0 trap in
// CLAUDE.md). Only the devices added in Gladys get states, triggers, and a
// place in the widget and the actions: the Discover tab is where the user
// picks what Gladys shows.
//
// Trigger `category_threshold`: the spending of an envelope reaches 50, 75,
// 90 or 100 % of its money, or the envelope is overspent; one event per level
// and per month. The levels already reached when a category is first seen are
// the starting point, not news. What was fired is kept under /data: a restart
// fires nothing twice.
//
// Money is private: the logs only ever hold counts, error codes and levels,
// never an amount, a name, a sync id or the address of the server.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  ActualError,
  clearCache,
  localMonth,
  parseSnapshot,
  problemOf,
  readBudget,
} from './actual.js';
import { CACHE_DIR, CATEGORY_LEVELS, FALLBACK_CURRENCY } from './config.js';
import { DEVICE_TYPES, MONTH_ID, buildDevice, deviceIds } from './devices.js';
import { PHRASES, STATUS, formatAmount, formatPercent, render } from './texts.js';

const logger = createLogger({ name: 'actual' });

export const WIDGET_KEY = 'overview';
export const TRIGGERS = { CATEGORY: 'category_threshold' };

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Problems after which the local copy of the budget is dropped and downloaded again.
const RESYNC = new Set(['resync', 'tooNew']);

/** Whether a level of the trigger is reached by a category. */
const reaches = (category, level) =>
  level === 'over'
    ? category.left !== null && category.left < 0
    : category.percent !== null && category.percent >= Number(level);

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.read] readBudget (the tests pass a fake Actual)
   * @param {string} [options.cacheDir] the local copy of the budget
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, read, cacheDir, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.read = read ?? readBudget;
    this.cacheDir = cacheDir ?? CACHE_DIR;
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.ready = false;
    this.data = emptyData();
    this.snapshot = null;
    this.problem = null;
    this.budgets = null;
    this.lastSuccessAt = null;
    this.lastCycleAt = -Infinity;
    this.discovered = null;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.signature = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message) {
    if (this.failing.has(key)) {
      logger.debug(message);
      return;
    }
    this.failing.add(key);
    logger[level](message);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    const saved = await this.store.load();
    if (saved?.version === 1) {
      const valid = (value) => value && typeof value === 'object' && !Array.isArray(value);
      this.data = { ...emptyData(), categories: valid(saved.categories) ? saved.categories : {} };
    }
    // The configuration may have changed while the container was stopped: the
    // budget is downloaded again rather than mixed with another one.
    await this.dropCache();
    this.configure(config);
    logger.info(`Started: Actual Budget read every ${config.refreshMinutes} min`);
    this.schedule();
    this.runCycle();
  }

  configure(config) {
    this.config = config;
    this.ready = Boolean(config.url && config.password);
    if (!this.ready) {
      this.problem = config.invalidUrl ? 'invalidUrl' : config.url ? 'noPassword' : 'noUrl';
      logger.warn(
        config.invalidUrl
          ? 'The address of the Actual server is not understood'
          : 'Address or password of the Actual server missing',
      );
    }
  }

  async dropCache() {
    try {
      await clearCache(this.cacheDir);
    } catch (err) {
      logger.warn(`Cannot remove the local copy of the budget: ${err.code ?? 'error'}`);
    }
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    if (connectionOf(config) !== connectionOf(this.config)) {
      // The configuration changed while Gladys was away.
      await this.reconfigure(config);
      return;
    }
    this.config = config;
    this.discovered = null;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    await this.running;
    this.problem = null;
    this.failing.delete('actual');
    logger.info('Configuration saved');
    if (budgetOf(config) !== budgetOf(this.config)) {
      // Another server or budget: its data must not be shown under the old one.
      this.snapshot = null;
      this.signature = null;
      this.lastSuccessAt = null;
      this.budgets = null;
      await this.dropCache();
    }
    this.configure(config);
    // The language or the currency may have changed: devices published again.
    this.discovered = null;
    this.schedule();
    await this.runCycle();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  // --- Devices ----------------------------------------------------------------

  /** The currency of the amounts: chosen in the configuration, or the one of Actual. */
  currency() {
    if (this.config.currency !== 'auto') {
      return this.config.currency;
    }
    return this.snapshot?.currency ?? FALLBACK_CURRENCY;
  }

  /** Every object of the last snapshot with its type: [{ type, item, ids }]. */
  entries() {
    if (!this.snapshot) {
      return [];
    }
    const of = (type, items) =>
      items.map((item) => ({ type, item, ids: deviceIds(this.gladys, type, item.id) }));
    return [
      ...of(DEVICE_TYPES.ACCOUNT, this.snapshot.accounts),
      ...of(DEVICE_TYPES.CATEGORY, this.snapshot.categories),
      ...(this.snapshot.month
        ? of(DEVICE_TYPES.MONTH, [{ ...this.snapshot.month, id: MONTH_ID }])
        : []),
    ];
  }

  isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  /** The objects of one type whose device is added in Gladys. */
  created(type) {
    return this.entries()
      .filter((entry) => entry.type === type && this.isCreated(entry.ids.device))
      .map((entry) => entry.item);
  }

  /** Whether an external id is a device of this integration. */
  owns(externalId) {
    return this.entries().some((entry) => entry.ids.device === externalId);
  }

  // --- Cycles -----------------------------------------------------------------

  runCycle() {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle()
      .catch((err) => this.failed('cycle', 'error', `Refresh cycle failed: ${err.message}`))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async readOnce(now) {
    return this.read({
      serverUrl: this.config.url,
      password: this.config.password,
      syncId: this.config.syncId,
      encryptionPassword: this.config.encryptionPassword,
      dataDir: this.cacheDir,
      month: localMonth(now),
    });
  }

  async cycle() {
    const now = this.now();
    this.lastCycleAt = now;
    if (!this.ready) {
      await this.updateConnectionStatus();
      return;
    }
    let raw;
    try {
      try {
        raw = await this.readOnce(now);
      } catch (err) {
        if (!RESYNC.has(problemOf(err))) {
          throw err;
        }
        // The local copy no longer matches the server: download it again.
        logger.info(`Local copy of the budget dropped (${err.code})`);
        await this.dropCache();
        raw = await this.readOnce(now);
      }
      this.snapshot = parseSnapshot(raw);
      this.problem = null;
      this.budgets = null;
      this.lastSuccessAt = this.now();
      this.recovered('actual', 'Actual Budget answers again');
    } catch (err) {
      this.problem = problemOf(err);
      this.budgets = err instanceof ActualError ? (err.budgets ?? null) : null;
      // The error code only: the messages of the package hold names and ids.
      this.failed('actual', 'warn', `Reading the budget failed: ${err.code ?? 'error'}`);
      await this.updateConnectionStatus();
      return;
    }
    const { accounts, categories, month } = this.snapshot;
    logger.debug(
      `Refresh cycle: ${accounts.length} accounts, ${categories.length} categories, month ${month ? 'read' : 'missing'}`,
    );
    this.recovered('cycle', 'Refresh cycles work again');
    await this.publishDiscovered();
    await this.publishStates();
    await this.checkTriggers();
    this.store.save(this.data);
    await this.updateConnectionStatus();
    const signature = JSON.stringify(this.snapshot);
    if (signature !== this.signature) {
      this.signature = signature;
      this.requestRefresh();
    }
  }

  async publishDiscovered() {
    if (!this.config || !this.snapshot) {
      return;
    }
    const currency = this.currency();
    const devices = this.entries().map(({ type, item }) =>
      buildDevice(this.gladys, type, item, currency, this.config.language),
    );
    const signature = JSON.stringify(devices);
    if (signature === this.discovered) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discovered = signature;
      this.recovered('discovery', 'Publishing the devices works again');
    } catch (err) {
      this.failed('discovery', 'warn', `Publishing the devices failed: ${err.message}`);
    }
  }

  /** The states of one object; absent values are not sent. */
  statesOf(type, item, ids) {
    const values = {
      account: () => ({ balance: item.balance }),
      category: () => ({
        budgeted: item.budgeted,
        spent: item.spent,
        left: item.left,
        percent: item.percent,
      }),
      month: () => ({
        to_budget: item.toBudget,
        spent_month: item.spent,
        income_month: item.income,
      }),
    }[type]();
    return Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({ device_feature_external_id: ids[key], state: value }));
  }

  async publishStates() {
    if (!this.snapshot) {
      return;
    }
    const states = this.entries()
      .filter(({ ids }) => this.isCreated(ids.device))
      .flatMap(({ type, item, ids }) => this.statesOf(type, item, ids));
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const connected = this.problem === null && this.lastSuccessAt !== null;
    const message = this.problem ? render(STATUS, this.problem) : undefined;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Scene trigger --------------------------------------------------------------

  async checkTriggers() {
    const language = this.config.language;
    const phrases = PHRASES[language];
    const currency = this.currency();
    const period = this.snapshot.month?.month;
    const records = this.data.categories;
    const seen = new Set();
    if (!period) {
      return;
    }
    for (const { type, item: category, ids } of this.entries()) {
      if (type !== DEVICE_TYPES.CATEGORY) {
        continue;
      }
      seen.add(category.id);
      const reached = CATEGORY_LEVELS.filter((level) => reaches(category, level));
      let record = records[category.id];
      if (!record) {
        // First seen: what is already reached is the starting point.
        records[category.id] = { period, fired: reached };
        continue;
      }
      if (record.period !== period || !Array.isArray(record.fired)) {
        record = records[category.id] = { period, fired: [] };
      }
      const news = reached.filter((level) => !record.fired.includes(level));
      if (!this.isCreated(ids.device)) {
        record.fired.push(...news);
        continue;
      }
      for (const level of news) {
        const params = {
          name: category.name,
          spent: formatAmount(category.spent, currency, language),
          left: formatAmount(category.left, currency, language),
          percent: formatPercent(category.percent, language),
        };
        const sent = await this.fire(`Category #${platformRef(ids.device)} reached ${level}`, {
          device: ids.device,
          level,
          name: category.name,
          budgeted: category.budgeted ?? 0,
          spent: category.spent ?? 0,
          left: category.left ?? 0,
          percent: category.percent ?? 0,
          currency,
          text: level === 'over' ? phrases.categoryOver(params) : phrases.categoryLevel(params),
        });
        if (!sent) {
          break; // tried again at the next cycle
        }
        record.fired.push(level);
      }
    }
    for (const id of Object.keys(records)) {
      if (!seen.has(id)) {
        delete records[id];
      }
    }
  }

  async fire(line, data) {
    // Levels and a short reference only: names and amounts stay out of the logs.
    logger.info(`Scene trigger: ${line}`);
    try {
      await this.gladys.publishSceneEvent(TRIGGERS.CATEGORY, data);
      this.recovered('scene', 'Scene triggers work again');
      return true;
    } catch (err) {
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
      return false;
    }
  }

  // --- Gladys events --------------------------------------------------------------

  async onDeviceCreated(device) {
    if (!this.owns(device?.external_id)) {
      return;
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    if (!this.owns(device?.external_id)) {
      return;
    }
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates();
    }
  }

  /** The snapshot, read again if the last cycle is older than one interval (or `force`). */
  async fresh(force = false) {
    await this.running;
    if (force || this.now() - this.lastCycleAt >= this.config.refreshMinutes * MINUTE) {
      await this.runCycle();
    }
    return this.snapshot;
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

/** The first characters of the id in an external id: enough to tell categories apart in the logs. */
const platformRef = (externalId) => externalId.split(':').pop().slice(0, 8);

/** What identifies the budget read. */
const budgetOf = (config) => config && JSON.stringify([config.url, config.syncId]);

/** What identifies the server, the budget and the reading pace of a configuration. */
const connectionOf = (config) =>
  config &&
  JSON.stringify([
    config.url,
    config.password,
    config.syncId,
    config.encryptionPassword,
    config.currency,
    config.refreshMinutes,
  ]);

function emptyData() {
  return { version: 1, categories: {} };
}
