// -----------------------------------------------------------------------------
// The refresh cycle against the recorded Actual Budget answer: devices, states
// of the devices added in Gladys, connection status, the scene trigger, the
// container's own timer, and what is kept under /data.
// -----------------------------------------------------------------------------

import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  CONFIG,
  IDS,
  PASSWORD,
  SYNC_ID,
  URL_BASE,
  createActual,
  createAll,
  createWorld,
  cycle,
  deviceOf,
  featureId,
} from './helpers/world.js';
import { registerHandlers } from '../src/app.js';
import { Store } from '../src/store.js';

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const categoryId = (w, name) => w.actual.category(name).id;
const last = (w, type, id, key) => w.fake.lastState(featureId(deviceOf(w, type, id), key));
// Intl separates thousands and currencies with narrow no-break spaces.
const plain = (value) => JSON.parse(JSON.stringify(value).replace(/[\u00a0\u202f]/g, ' '));
const events = (w) => plain(w.fake.sceneEvents.filter((e) => e.key === 'category_threshold'));

test('the reading gets the server, the budget and the month of Gladys', async (t) => {
  const w = await world(t);
  assert.equal(w.actual.calls.length, 1);
  const [call] = w.actual.calls;
  assert.equal(call.serverUrl, URL_BASE);
  assert.equal(call.password, PASSWORD);
  assert.equal(call.syncId, SYNC_ID);
  assert.equal(call.encryptionPassword, '');
  assert.equal(call.month, '2026-10');
  assert.equal(call.dataDir, join(w.dataDir, 'budget'));
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('one device per open account, visible expense category, and the month', async (t) => {
  const w = await world(t);
  const names = w.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, [
    'Brokerage',
    'Checking',
    'Savings',
    'Credit card',
    'Gifts',
    'Food',
    'General',
    'Bills',
    'Bills (Flexible)',
    'Savings',
    'Actual Budget – mois',
  ]);
  // Hidden, in a hidden group, income: left out. No sync id anywhere.
  const json = JSON.stringify(w.fake.discoveredDevices);
  for (const absent of ['Hidden one', 'Archived hobby', 'Income', 'Starting Balances', SYNC_ID]) {
    assert.ok(!json.includes(absent), absent);
  }
  const checking = deviceOf(w, 'account', IDS.checking);
  assert.equal(checking.features[0].name, 'Solde');
  assert.equal(checking.features[0].unit, 'euro');
  assert.equal(checking.should_poll, false);
  assert.deepEqual(
    deviceOf(w, 'category', categoryId(w, 'Food')).features.map((f) => f.name),
    ['Budgété', 'Dépensé', 'Restant', 'Enveloppe consommée'],
  );
  assert.ok(deviceOf(w, 'month', 'budget'));
});

test('only the devices added in Gladys get states, with the values of Actual', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.states.length, 0);
  await createAll(w);
  assert.equal(last(w, 'account', IDS.checking, 'balance'), 3832.95);
  assert.equal(last(w, 'account', IDS.card, 'balance'), -120.5);
  assert.equal(last(w, 'account', IDS.brokerage, 'balance'), 10000);
  const food = categoryId(w, 'Food');
  assert.equal(last(w, 'category', food, 'budgeted'), 400);
  assert.equal(last(w, 'category', food, 'spent'), 320.5);
  assert.equal(last(w, 'category', food, 'left'), 79.5);
  assert.equal(last(w, 'category', food, 'percent'), 80.1);
  // Overspent: 90 spent of 80.
  assert.equal(last(w, 'category', categoryId(w, 'Bills'), 'left'), -10);
  assert.equal(last(w, 'category', categoryId(w, 'Bills'), 'percent'), 112.5);
  // Spent from an empty envelope: the cap.
  assert.equal(last(w, 'category', categoryId(w, 'Gifts'), 'percent'), 1000);
  assert.equal(last(w, 'month', 'budget', 'to_budget'), 8572.95);
  assert.equal(last(w, 'month', 'budget', 'spent_month'), 490.5);
  assert.equal(last(w, 'month', 'budget', 'income_month'), 9202.95);
});

test('an unchanged cycle publishes nothing, a new balance publishes only it', async (t) => {
  const w = await world(t);
  await createAll(w);
  const before = w.fake.states.length;
  await cycle(w);
  assert.equal(w.fake.states.length, before);
  w.actual.account('Checking').balance = 340000;
  await cycle(w);
  assert.deepEqual(
    w.fake.states.slice(before).map((s) => [s.device_feature_external_id, s.state]),
    [[featureId(deviceOf(w, 'account', IDS.checking), 'balance'), 3400]],
  );
});

test('the container reads Actual on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const actual = createActual();
  const dataDir = mkdtempSync(join(tmpdir(), 'gladys-actual-'));
  const gladys = createFakeGladys({ config: { ...CONFIG, refresh_interval: '30' } });
  const app = registerHandlers(gladys, {
    store: new Store(dataDir),
    read: actual.read,
    cacheDir: join(dataDir, 'budget'),
  });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  await app.monitor.running;
  assert.equal(actual.calls.length, 1);
  t.mock.timers.tick(30 * 60 * 1000);
  await app.monitor.running;
  assert.equal(actual.calls.length, 2);
});

test('onDeviceCreated publishes the states of the new device and refreshes the widget', async (t) => {
  const w = await world(t);
  const refreshes = w.fake.widgetRefreshes.length;
  w.clock.advance(20000);
  await w.fake.deviceCreated(deviceOf(w, 'account', IDS.savings));
  assert.equal(last(w, 'account', IDS.savings, 'balance'), 5000);
  assert.equal(w.fake.widgetRefreshes.length, refreshes + 1);
});

test('envelope threshold: each level once a month, from the first reading on', async (t) => {
  const w = await world(t);
  await createAll(w);
  // Already reached at the first reading: the starting point, not news.
  await cycle(w);
  assert.deepEqual(events(w), []);
  // General: 45 of 100 spent, then 95.
  w.actual.category('General').spent = -9500;
  w.actual.category('General').balance = 500;
  await cycle(w);
  const general = deviceOf(w, 'category', categoryId(w, 'General')).external_id;
  assert.deepEqual(
    events(w).map((e) => [e.data.device, e.data.level]),
    [
      [general, '50'],
      [general, '75'],
      [general, '90'],
    ],
  );
  assert.deepEqual(events(w)[2].data, {
    device: general,
    level: '90',
    name: 'General',
    budgeted: 100,
    spent: 95,
    left: 5,
    percent: 95,
    currency: 'EUR',
    text: 'Enveloppe General : 95 % consommés, 95,00 € dépensés, 5,00 € restants.',
  });
  await cycle(w);
  assert.equal(events(w).length, 3);
  // Overspent: 100 % and "over".
  w.actual.category('General').spent = -11000;
  w.actual.category('General').balance = -1000;
  await cycle(w);
  assert.deepEqual(
    events(w)
      .slice(3)
      .map((e) => [e.data.level, e.data.text]),
    [
      ['100', 'Enveloppe General : 110 % consommés, 110,00 € dépensés, -10,00 € restants.'],
      ['over', 'Enveloppe General dépassée : -10,00 €.'],
    ],
  );
});

test('a new month starts the levels again; a category not added fires nothing', async (t) => {
  const w = await world(t, { config: { ...CONFIG, language: 'en' } });
  await createAll(w, (device) => !device.external_id.includes(categoryId(w, 'Food')));
  await cycle(w);
  w.actual.category('Food').spent = -39000;
  w.actual.category('Food').balance = 1000;
  await cycle(w);
  assert.deepEqual(events(w), []);
  // November: Bills is overspent again, a new month for its levels.
  w.actual.raw.month.month = '2026-11';
  await cycle(w);
  assert.deepEqual(
    events(w).map((e) => [e.data.name, e.data.level]),
    [
      ['Gifts', '50'],
      ['Gifts', '75'],
      ['Gifts', '90'],
      ['Gifts', '100'],
      ['Gifts', 'over'],
      ['Bills', '50'],
      ['Bills', '75'],
      ['Bills', '90'],
      ['Bills', '100'],
      ['Bills', 'over'],
    ],
  );
  assert.equal(events(w)[4].data.text, 'Envelope Gifts overspent: -€25.00.');
});

test('the levels fired are kept under /data: a restart fires nothing twice', async (t) => {
  const first = await world(t);
  await createAll(first);
  first.actual.category('General').spent = -9500;
  first.actual.category('General').balance = 500;
  await cycle(first);
  assert.equal(events(first).length, 3);
  await first.app.stop();
  const second = await world(t, {
    dataDir: first.dataDir,
    actual: first.actual,
    devices: first.fake.discoveredDevices,
  });
  await cycle(second);
  assert.deepEqual(events(second), []);
});

test('the currency: the one of Actual, or the one chosen', async (t) => {
  const actual = createActual();
  actual.raw.currency = 'USD';
  const usd = await world(t, { actual });
  assert.equal(deviceOf(usd, 'account', IDS.checking).features[0].unit, 'dollar');
  const chf = await world(t, { config: { ...CONFIG, currency: 'CHF' } });
  const checking = deviceOf(chf, 'account', IDS.checking);
  assert.equal(checking.name, 'Checking (CHF)');
  assert.equal(checking.features[0].unit, undefined);
});

test('a refused password, then an unreachable server keeping the last values', async (t) => {
  const w = await world(t, { config: { ...CONFIG, password: 'wrong' } });
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.fr, /refuse le mot de passe/);
  assert.equal(w.fake.discoveredDevices.length, 0);
  await w.fake.configUpdated(CONFIG);
  await createAll(w);
  assert.equal(w.fake.connectionStatus.connected, true);
  w.actual.down = 'network-failure';
  await cycle(w);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /last values are kept/);
  assert.equal(w.monitor.snapshot.accounts.length, 4);
});

test('an encrypted budget without its password says so', async (t) => {
  const actual = createActual();
  actual.down = 'missing-key';
  const w = await world(t, { actual });
  assert.match(w.fake.connectionStatus.message.en, /end-to-end encrypted/);
  actual.down = 'decrypt-failure';
  await cycle(w);
  assert.match(w.fake.connectionStatus.message.en, /encryption password of the budget is wrong/);
});

test('a budget reset in Actual: the local copy is dropped and downloaded again', async (t) => {
  const actual = createActual();
  const w = await world(t, { actual });
  mkdirSync(join(w.dataDir, 'budget', 'My-budget-1234'), { recursive: true });
  actual.down = (call) => (call === 2 ? 'file-has-reset' : false);
  await cycle(w);
  assert.equal(actual.calls.length, 3);
  assert.equal(existsSync(join(w.dataDir, 'budget')), false);
  assert.equal(w.fake.connectionStatus.connected, true);
});

test('another budget configured: the old one is forgotten, its copy removed', async (t) => {
  const w = await world(t);
  mkdirSync(join(w.dataDir, 'budget', 'My-budget-1234'), { recursive: true });
  w.actual.down = 'budget-not-found';
  await w.fake.configUpdated({ ...CONFIG, sync_id: 'other' });
  assert.equal(existsSync(join(w.dataDir, 'budget')), false);
  assert.equal(w.monitor.snapshot, null);
  assert.match(w.fake.connectionStatus.message.en, /No budget with this sync ID/);
});

test('a month Actual has not created yet: accounts only', async (t) => {
  const actual = createActual();
  actual.raw.month = null;
  const w = await world(t, { actual });
  assert.equal(w.fake.discoveredDevices.length, 4);
  await createAll(w);
  await cycle(w);
  assert.deepEqual(events(w), []);
});

test('without address or password, nothing is read and the status says why', async (t) => {
  const w = await world(t, { config: { url: '', password: '' } });
  assert.equal(w.actual.calls.length, 0);
  assert.match(w.fake.connectionStatus.message.en, /Enter the address of the Actual server/);
  await w.fake.configUpdated({ url: 'http://user:pass@192.0.2.10', password: PASSWORD });
  assert.match(w.fake.connectionStatus.message.en, /not understood/);
  assert.equal(w.actual.calls.length, 0);
});
