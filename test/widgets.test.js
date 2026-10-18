// -----------------------------------------------------------------------------
// The `overview` widget and the scene and configuration actions, on the
// recorded Actual Budget answer: what is shown and told is what was added in
// Gladys, in the language asked, within the budget of the core.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { CONFIG, IDS, createActual, createAll, createWorld } from './helpers/world.js';

const plain = (value) => JSON.parse(JSON.stringify(value).replace(/[\u00a0\u202f]/g, ' '));

async function world(t, options = {}) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

const content = async (w, language = 'en') => {
  const { success, data } = await w.fake.widgetGet('overview', { language, settings: {} });
  assert.equal(success, true);
  return data.content;
};

test('the widget shows what was added, within the core budget', async (t) => {
  const w = await world(t);
  await createAll(w);
  for (const language of ['en', 'fr', 'de', 'es']) {
    assert.deepEqual(validateWidgetContent(await content(w, language)), [], language);
  }
  const data = plain(await content(w, 'fr'));
  assert.equal(data.components.length, 3);
  const status = data.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['À budgéter', '8 572,95 €', 'success'],
      ['Brokerage', '10 000,00 €', 'neutral'],
      ['Checking', '3 832,95 €', 'neutral'],
      ['Savings', '5 000,00 €', 'neutral'],
      ['Credit card', '-120,50 €', 'danger'],
    ],
  );
  const list = data.components.find((c) => c.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge.text, item.badge.color]),
    [
      ['Gifts', '25,00 € dépensé · -25,00 € restant', '1 000 %', 'danger'],
      ['Food', '320,50 € dépensé · 79,50 € restant', '80 %', 'warning'],
      ['General', '45,00 € dépensé · 55,00 € restant', '45 %', 'success'],
      ['Bills', '90,00 € dépensé · -10,00 € restant', '113 %', 'danger'],
      ['Bills (Flexible)', '0,00 € dépensé · 0,00 € restant', '0 %', 'success'],
      ['Savings', '0,00 € dépensé · 0,00 € restant', '0 %', 'success'],
    ],
  );
  assert.equal(list.items[1].description, 'Budgété : 400,00 €');
  assert.match(data.components.at(-1).text, /^Actual Budget · Lu le 18\/10 14:00/);
});

test('the widget before any device, and before any answer', async (t) => {
  const w = await world(t);
  assert.equal((await content(w, 'en')).components[0].text, 'Add accounts or categories');
  const actual = createActual();
  actual.down = 'network-failure';
  const down = await world(t, { actual });
  const failed = await content(down, 'de');
  assert.deepEqual(validateWidgetContent(failed), []);
  assert.deepEqual(failed.components, [
    {
      type: 'text',
      variant: 'body',
      text: 'Der Actual-Server antwortet nicht: die letzten Werte bleiben erhalten.',
    },
  ]);
  // Values kept after a failure: the footer says the last reading failed.
  await createAll(w);
  w.actual.down = 'invalid-password';
  await w.monitor.fresh(true);
  assert.match((await content(w, 'en')).components.at(-1).text, / · last reading failed$/);
});

test('read_balances: the accounts added, in the language of the configuration', async (t) => {
  const w = await world(t, { config: { ...CONFIG, language: 'en' } });
  await createAll(w, (device) => /:account:/.test(device.external_id));
  const { success, data } = await w.fake.sceneAction('read_balances', {});
  assert.equal(success, true);
  assert.deepEqual(plain(data.outputs), {
    text: 'Brokerage: €10,000.00. Checking: €3,832.95. Savings: €5,000.00. Credit card: -€120.50.',
    count: 4,
    total: 18712.45,
  });
});

test('read_budgets: the money to budget, then the categories added', async (t) => {
  const w = await world(t);
  await createAll(
    w,
    (device) =>
      device.external_id.endsWith(':month:budget') || ['Food', 'Bills'].includes(device.name),
  );
  const { data } = await w.fake.sceneAction('read_budgets', {});
  assert.deepEqual(plain(data.outputs), {
    text: 'À budgéter : 8 572,95 €. Food : 320,50 € dépensés, 79,50 € restants. Bills : 90,00 € dépensés, -10,00 € restants.',
    count: 2,
    over_count: 1,
    to_budget: 8572.95,
  });
});

test('nothing added: the actions say so', async (t) => {
  const w = await world(t, { config: { ...CONFIG, language: 'es' } });
  const balances = await w.fake.sceneAction('read_balances', {});
  assert.equal(balances.data.outputs.text, 'Ninguna cuenta añadida a Gladys.');
  const budgets = await w.fake.sceneAction('read_budgets', {});
  assert.equal(budgets.data.outputs.text, 'Ninguna categoría añadida a Gladys.');
});

test('a scene action fails with the reason when the password is refused', async (t) => {
  const w = await world(t, { config: { ...CONFIG, password: 'wrong' } });
  const result = await w.fake.sceneAction('read_balances', {});
  assert.equal(result.success, false);
  assert.match(result.error, /refuse le mot de passe/);
});

test('check_now reads again and says what the budget holds', async (t) => {
  const w = await world(t);
  const calls = w.actual.calls.length;
  const { success, data } = await w.fake.action('check_now', {});
  assert.equal(success, true);
  assert.equal(w.actual.calls.length, calls + 1);
  assert.equal(
    data.message.fr,
    'Connecté à Actual Budget : 4 compte(s) ouvert(s), 6 catégorie(s).',
  );
});

test('check_now lists the budgets to choose from when there are several', async (t) => {
  const actual = createActual();
  actual.down = 'choose-budget';
  actual.budgets = [
    { syncId: '11111111-2222-4333-8444-555566667777', name: 'Family' },
    { syncId: '88888888-2222-4333-8444-555566667777', name: 'Business' },
  ];
  const w = await world(t, { actual, config: { ...CONFIG, sync_id: '' } });
  assert.equal(w.actual.calls[0].syncId, '');
  const { data } = await w.fake.action('check_now', {});
  assert.equal(
    data.message.en,
    'The server holds several budgets: enter the sync ID of the one to read. Budgets on the server: Family (11111111-2222-4333-8444-555566667777), Business (88888888-2222-4333-8444-555566667777).',
  );
});

test('the account devices are the ones the widget and actions read', async (t) => {
  const w = await world(t);
  await createAll(w, (device) => device.external_id.endsWith(IDS.card));
  const data = plain(await content(w, 'en'));
  assert.deepEqual(
    data.components[0].items.map((item) => item.label),
    ['Credit card'],
  );
});

test('check_now during a reading uses it instead of reading twice', async (t) => {
  const w = await world(t);
  const calls = w.actual.calls.length;
  w.clock.advance(60 * 60 * 1000);
  const cycle = w.monitor.runCycle();
  const { data } = await w.fake.action('check_now', {});
  await cycle;
  assert.equal(w.actual.calls.length, calls + 1);
  assert.match(data.message.en, /^Connected to Actual Budget/);
});
