// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Actual Budget serving
// the answer recorded on actual-server 26.10.0 (test/fixtures/actual), a
// manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';
import { ActualError } from '../../src/actual.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

export const PASSWORD = 'test-password-0000';
export const URL_BASE = 'http://192.0.2.10:5006';
export const SYNC_ID = '0b5e7a4e-1111-4222-8333-944455556666';
export const CONFIG = { url: URL_BASE, password: PASSWORD, sync_id: SYNC_ID };

// The budget was recorded on 18/10/2026, Paris time.
export const START = Date.parse('2026-10-18T14:00:00+02:00');

/** Ids of the recorded budget (test/fixtures/actual/budget.json), by name. */
export const IDS = {
  checking: '9cf13c64-54c1-4f2f-bc9f-741c6c4ceb6c',
  savings: 'fc8eab47-0112-4692-a299-6a5d14b9333e',
  card: '87a445e9-b9d2-4d84-9e22-e6e259b5a7da',
  brokerage: '7c92e3f7-f0ec-427b-8871-c278684fc05d',
};

/**
 * Fake Actual Budget: answers what the worker of src/reader.js answered on a
 * real actual-server 26.10.0 (a budget seeded with @actual-app/api).
 * `actual.down`: an error code of the package ('network-failure',
 * 'invalid-password'...) or false. `actual.raw` is the answer to change.
 */
export function createActual() {
  const actual = {
    down: false,
    raw: fixture('actual/budget.json'),
    calls: [],
    budgets: undefined,

    /** A category of the current month, by name. */
    category(name) {
      return actual.raw.month.categoryGroups
        .flatMap((group) => group.categories)
        .find((category) => category.name === name);
    },

    /** An account, by name. */
    account(name) {
      return actual.raw.accounts.find((account) => account.name === name);
    },

    async read(options) {
      actual.calls.push(options);
      const code =
        typeof actual.down === 'function' ? actual.down(actual.calls.length) : actual.down;
      if (code) {
        throw new ActualError(code, actual.budgets);
      }
      if (options.password !== PASSWORD) {
        throw new ActualError('invalid-password');
      }
      return structuredClone(actual.raw);
    },
  };
  return actual;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.actual] from createActual
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = CONFIG,
  devices = [],
  actual = createActual(),
  connect = true,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-actual-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    read: actual.read,
    cacheDir: join(dataDir, 'budget'),
    timers: false,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, actual, clock, store, dataDir };
}

/** Create discovered devices in Gladys, as the user would (all, or those matching). */
export async function createAll(world, filter = () => true) {
  const devices = world.fake.discoveredDevices.filter(filter);
  for (const device of devices) {
    await world.fake.deviceCreated(device);
  }
  return devices;
}

/** The discovered device of an Actual object: type and id. */
export const deviceOf = (world, type, id) =>
  world.fake.discoveredDevices.find((device) => device.external_id.endsWith(`:${type}:${id}`));

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 15) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
