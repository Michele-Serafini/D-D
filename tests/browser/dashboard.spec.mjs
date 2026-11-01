import { test, expect, login, expectViewportFits } from './fixtures.mjs';

test('master dashboard shares initiative, HP, conditions and rounds with the full tracker', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'sebastiano');
  await expect(page.getByRole('heading', { name: 'Dashboard del master' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Prossimo Turno' });
  await expect(next).toBeDisabled();
  const cards = page.locator('.combatant-card');
  await cards.nth(0).getByLabel('Nome combattente', { exact: true }).fill('Aria');
  await cards.nth(0).getByLabel('Iniziativa', { exact: true }).fill('12');
  await cards.nth(0).getByLabel('Punti vita', { exact: true }).fill('10');
  await cards.nth(1).getByLabel('Nome combattente', { exact: true }).fill('Goblin');
  await cards.nth(1).getByLabel('Iniziativa', { exact: true }).fill('18');
  await cards.nth(1).getByLabel('Categoria combattente').selectOption('sgherri');
  await cards.nth(1).getByLabel('Punti vita', { exact: true }).fill('1');
  await expect(page.locator('#dashboard-turn-order button').first()).toContainText('Goblin');
  await expect(page.locator('#dashboard-current-turn')).toContainText('Tocca a Goblin');
  await cards.nth(1).getByRole('button', { name: 'Infliggi un danno' }).click();
  await cards.nth(1).getByRole('button', { name: 'Infliggi un danno' }).click();
  await expect(cards.nth(1).getByLabel('Punti vita', { exact: true })).toHaveValue('0');
  await cards.nth(1).getByRole('button', { name: 'Recupera un punto vita' }).click();
  await expect(cards.nth(1).getByLabel('Punti vita', { exact: true })).toHaveValue('1');
  await next.click();
  await expect(page.locator('#dashboard-current-turn')).toContainText('Tocca a Aria');
  await next.click();
  await expect(page.locator('.round-num')).toHaveText('2');
  await page.locator('#dashboard-turn-order button').filter({ hasText: 'Aria' }).click();
  await expect(page.locator('#dashboard-current-turn')).toContainText('Tocca a Aria');
  await expect(page.locator('.round-num')).toHaveText('2');

  const poisoned = page
    .locator('.condition-item')
    .filter({ has: page.locator('.condition-name', { hasText: 'Avvelenato' }) });
  await poisoned.getByRole('button', { name: 'Assegna' }).click();
  await poisoned.getByRole('button', { name: 'Aria', exact: true }).click();
  await expect(cards.nth(0).locator('.condition-badge')).toContainText('Avvelenato');
  await page.getByRole('button', { name: 'Iniziativa completa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ordine di Iniziativa' })).toBeVisible();
  await expect(cards.nth(0).getByLabel('Punti vita', { exact: true })).toHaveValue('10');
  await expect(cards.nth(0).locator('.condition-badge')).toContainText('Avvelenato');
  await cards.nth(0).getByRole('button', { name: 'Rimuovi Avvelenato' }).click();
  await expect(cards.nth(0).locator('.condition-badge')).toHaveCount(0);
  expect(
    await page.evaluate(() => __testDatabase.campaigns.principale.data.state.iniziativa.round)
  ).toBe(2);
  expect(errors).toEqual([]);
});

test('private master notes save across navigation and remain isolated when changing campaigns', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'sebastiano');
  const notes = page.getByLabel('Appunti del master', { exact: true });
  await notes.fill('Il forziere è una trappola.');
  await expect
    .poll(() =>
      page.evaluate(() => __testDatabase.campaigns.principale.data?.dmConfig?.dashboardNotes)
    )
    .toBe('Il forziere è una trappola.');
  await page.getByRole('button', { name: 'Lancia dadi', exact: true }).click();
  await page.locator('.nav-item').filter({ hasText: 'Dashboard del master' }).click();
  await expect(notes).toHaveValue('Il forziere è una trappola.');
  // Remote combat updates must preserve input handlers and never reset the notes caret.
  await page.locator('.combatant-name-input').first().fill('Aria');
  await page.evaluate(async () => {
    clearTimeout(_fbSaveIniziativaTimer);
    var input = document.getElementById('dashboard-notes');
    input.focus();
    input.setSelectionRange(5, 5);
    var combatant = Object.assign({}, state.combatants[0], { hp: 7 });
    await _campaignDb
      .ref('state/iniziativa')
      .set({ combatants: [combatant], round: 3, activeIndex: 0 });
  });
  await expect(page.getByLabel('Punti vita', { exact: true }).first()).toHaveValue('7');
  expect(
    await notes.evaluate((input) => ({
      focused: document.activeElement === input,
      caret: input.selectionStart,
    }))
  ).toEqual({ focused: true, caret: 5 });
  await page.getByLabel('Punti vita', { exact: true }).first().fill('8');
  await expect.poll(() => page.evaluate(() => state.combatants[0].hp)).toBe('8');
  await notes.fill('Segreto aggiornato prima del cambio.');
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await expect(notes).toHaveValue('');
  await notes.fill('Segreto del mare');
  await expect
    .poll(() => page.evaluate(() => __testDatabase.campaigns.mare.data?.dmConfig?.dashboardNotes))
    .toBe('Segreto del mare');
  expect(
    await page.evaluate(() => __testDatabase.campaigns.principale.data.dmConfig.dashboardNotes)
  ).toBe('Segreto aggiornato prima del cambio.');
  expect(await page.evaluate(() => state.notes)).toBe('');
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=principale]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await expect(notes).toHaveValue('Segreto aggiornato prima del cambio.');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: 'test-results/master-dashboard-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('dashboard shortcuts reuse existing tools and players cannot open the master dashboard', async ({
  page,
}) => {
  await login(page, 'sebastiano');
  for (const [label, section] of [
    ['Mappa della campagna', 'mappa'],
    ['Schede dei personaggi', 'schedepg'],
    ['Generatore PNG', 'generatore'],
    ['Libri e documenti', 'libri'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    expect(await page.evaluate(() => state.section)).toBe(section);
    await expect(page.locator('.main-content')).not.toContainText('ERRORE RENDER');
    await page.locator('.nav-item').filter({ hasText: 'Dashboard del master' }).click();
  }
  await page.getByRole('button', { name: 'Apri regia sonora', exact: true }).click();
  await expect(page.locator('.regia-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi regia sonora', exact: true }).click();
  await expect(page.locator('.regia-panel')).toHaveCount(0);
  await login(page, 'michele');
  await expect(page.locator('.nav-item').filter({ hasText: 'Dashboard del master' })).toHaveCount(
    0
  );
  await page.evaluate(() => {
    state.section = 'dashboard';
    renderMain();
  });
  await expect(page.getByRole('heading', { name: 'Dashboard del master' })).toHaveCount(0);
  await expect(page.locator('#dashboard-notes')).toHaveCount(0);
});
