// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, Actual Budget lost and back, a scene trigger, a user action),
// never one line per refresh cycle; a failure that repeats at every cycle is
// logged once, plus one line when it is over. Money is private: no amount, no
// name, no password, no sync id and no server address, even at debug.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  PASSWORD,
  SYNC_ID,
  URL_BASE,
  captureLogs,
  createActual,
  createAll,
  createWorld,
  cycle,
} from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), ['[INFO] [actual] Started: Actual Budget read every 15 min']);
});

test('normal refresh cycles write nothing at info', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  w.actual.account('Checking').balance = 1200;
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines, []);
});

test('a scene trigger is one info line, without name nor amount', async (t) => {
  const w = await world(t);
  await createAll(w);
  const lines = captureLogs(t, 'info');
  w.actual.category('General').spent = -6000;
  w.actual.category('General').balance = 4000;
  await cycle(w);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [actual] Scene trigger: Category #af375fd4 reached 50',
  ]);
});

test('Actual down at every cycle: one warning, then one line at recovery', async (t) => {
  const actual = createActual();
  const w = await world(t, { actual });
  const lines = captureLogs(t, 'info');
  actual.down = 'network-failure';
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.deepEqual(lines.map(strip), [
    '[WARN] [actual] Reading the budget failed: network-failure',
  ]);
  actual.down = false;
  await cycle(w);
  assert.deepEqual(lines.slice(1).map(strip), ['[INFO] [actual] Actual Budget answers again']);
});

test('even at debug: no amount, no name, no password, no sync id, no address', async (t) => {
  const lines = captureLogs(t, 'debug');
  const actual = createActual();
  const w = await world(t, { actual, config: { ...CONFIG, encryption_password: 'e2e-secret' } });
  await createAll(w);
  w.actual.category('General').spent = -11000;
  w.actual.category('General').balance = -1000;
  await cycle(w);
  await w.fake.action('check_now', {});
  await w.fake.sceneAction('read_budgets', {});
  actual.down = 'network-failure';
  await cycle(w);
  actual.down = 'choose-budget';
  actual.budgets = [{ syncId: SYNC_ID, name: 'Family budget' }];
  await w.fake.action('check_now', {});
  actual.down = false;
  await w.fake.configUpdated({ ...CONFIG, password: 'wrong-password' });
  // Without the timestamp prefix: its milliseconds could match a number looked for below.
  const text = lines.map(strip).join('\n');
  assert.ok(lines.length > 5);
  for (const secret of [
    PASSWORD,
    'wrong-password',
    'e2e-secret',
    SYNC_ID,
    URL_BASE,
    '192.0.2.10',
    'Family budget',
    'Checking',
    'General',
    'Food',
    '3832',
    '110',
    '8572',
  ]) {
    assert.ok(!text.includes(secret), `"${secret}" in the logs`);
  }
});
