import { test, expect, login, expectViewportFits } from './fixtures.mjs';

// These scenarios span a full session or several logins and campaign reloads.
test.setTimeout(90_000);

async function openJournal(page) {
  await page.locator('.nav-item').filter({ hasText: 'Diario della sessione' }).click();
  await expect(
    page.getByRole('heading', { name: 'Diario della sessione', exact: true })
  ).toBeVisible();
}
async function startSession(page, title) {
  await openJournal(page);
  await page.getByLabel('Titolo della sessione', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Avvia sessione', exact: true }).click();
  await expect(page.locator('.journal-active')).toHaveText(title);
}

test('a combat continuing across sessions updates one checkpoint and ends in the most recent session', async ({
  page,
}, testInfo) => {
  await login(page, 'sebastiano');
  await page.getByLabel('Nome combattente', { exact: true }).first().fill('Aria');
  await page.getByRole('button', { name: 'Avvia combattimento', exact: true }).click();
  await startSession(page, 'Il combattimento');
  await page.getByRole('button', { name: 'Chiudi sessione', exact: true }).click();
  await expect.poll(() => page.evaluate(() => SessionJournal.active)).toBeNull();
  await page.getByLabel('Titolo della sessione', { exact: true }).fill('La continuazione');
  await page.getByRole('button', { name: 'Avvia sessione', exact: true }).click();
  await expect(page.locator('.journal-active')).toHaveText('La continuazione');
  const latest = await page.evaluate(() => SessionJournal.active);
  await page.getByRole('button', { name: 'Chiudi sessione', exact: true }).click();
  await expect.poll(() => page.evaluate(() => SessionJournal.active)).toBeNull();
  await page.locator('.nav-item').filter({ hasText: 'Dashboard del master' }).click();
  await page.getByRole('button', { name: 'Termina combattimento', exact: true }).click();
  await openJournal(page);
  await expect(page.getByLabel('Sessione da consultare')).toHaveValue(latest);
  await expect(page.locator('.journal-event')).toHaveCount(2);
  await expect(page.locator('.journal-events')).toContainText('Combattimento concluso');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: testInfo.outputPath('journal-mobile.png'), fullPage: true });
});

test('session journal records combat, important rolls, rewards and master notes and prepares a saved recap', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'sebastiano');
  await startSession(page, 'La porta segreta');
  const firstSession = await page.evaluate(() => SessionJournal.active);
  await page.getByLabel('Nuova annotazione').fill('Il gruppo trova una chiave d’argento.');
  await page.getByRole('button', { name: 'Aggiungi annotazione', exact: true }).click();
  await expect(page.locator('.journal-event')).toContainText('chiave d’argento');
  await page.locator('.nav-item').filter({ hasText: 'Dashboard del master' }).click();
  await page.getByLabel('Nome combattente', { exact: true }).first().fill('Aria');
  await page.getByLabel('Punti vita', { exact: true }).first().fill('12');
  await page.getByRole('button', { name: 'Avvia combattimento', exact: true }).click();
  await page.getByRole('button', { name: 'Prossimo Turno', exact: true }).click();
  await page.getByRole('button', { name: 'Termina combattimento', exact: true }).click();
  await page
    .getByLabel('Appunti del master', { exact: true })
    .fill('Il custode conosce la parola segreta.');
  await expect.poll(() => page.evaluate(() => MasterDashboardNotes.dirty)).toBe(false);
  await page.locator('.nav-item').filter({ hasText: 'Lanciatore Dadi' }).click();
  await page.getByLabel('Segna il prossimo tiro come importante').check();
  await page.locator('.dice-roll-btn').click();
  await page.evaluate(async () => {
    await _campaignDb
      .ref('schedePG/michele')
      .set({ _v2: true, chars: { hero: { nomePersonaggio: 'Aria', oro: 0 } } });
    await CommerceService.run(
      { username: 'michele', id: 'hero', sheet: { nomePersonaggio: 'Aria' } },
      'journal_reward',
      { action: 'submit', kind: 'reward', currency: 'mo', coins: 25, label: 'Tesoro del custode' }
    );
  });
  await openJournal(page);
  await expect.poll(() => page.locator('.journal-event').count()).toBe(6);
  await page.getByRole('button', { name: 'Prepara riepilogo', exact: true }).click();
  const recap = page.getByLabel('Riepilogo della sessione', { exact: true });
  await expect(recap).toHaveValue(/chiave d’argento/);
  await expect(recap).toHaveValue(/Combattimento concluso/);
  await expect(recap).toHaveValue(/Tesoro del custode/);
  await expect(recap).toHaveValue(/parola segreta/);
  await recap.fill((await recap.inputValue()) + '\nDa ricordare: tornare al villaggio.');
  await page.getByRole('button', { name: 'Salva riepilogo', exact: true }).click();
  await expect(page.locator('.journal-draft-status')).toHaveText('Riepilogo salvato');
  await page.getByRole('button', { name: 'Chiudi sessione', exact: true }).click();
  await expect.poll(() => page.evaluate(() => SessionJournal.active)).toBeNull();
  await page.getByLabel('Titolo della sessione', { exact: true }).fill('Il ritorno');
  await page.getByRole('button', { name: 'Avvia sessione', exact: true }).click();
  await page
    .getByRole('button', { name: 'Riepilogo della sessione precedente', exact: true })
    .click();
  await expect(page.getByLabel('Sessione da consultare')).toHaveValue(firstSession);
  await expect(recap).toHaveValue(/tornare al villaggio/);
  expect(errors).toEqual([]);
});

test('player rolls are journalled without access to private pages and campaigns remain isolated', async ({
  page,
}) => {
  await login(page, 'sebastiano');
  await startSession(page, 'Prima campagna');
  const id = await page.evaluate(() => SessionJournal.active);
  await login(page);
  await expect(page.locator('.nav-item').filter({ hasText: 'Diario della sessione' })).toHaveCount(
    0
  );
  await page.locator('.nav-item').filter({ hasText: 'Lanciatore Dadi' }).click();
  await page.getByLabel('Segna il prossimo tiro come importante').check();
  await page.locator('.dice-roll-btn').click();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          Object.keys(__testDatabase.campaigns.principale.data.sessionJournal.events?.[id] || {})
            .length,
        id
      )
    )
    .toBe(1);
  await page.evaluate(() => {
    state.section = 'diario';
    renderMain();
  });
  await expect(
    page.getByRole('heading', { name: 'Diario della sessione', exact: true })
  ).toHaveCount(0);
  await login(page, 'sebastiano');
  await openJournal(page);
  await expect(page.locator('.journal-event')).toContainText('michele');
  await page.getByLabel('Riepilogo della sessione', { exact: true }).fill('Bozza locale riservata');
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await openJournal(page);
  await expect(page.locator('.journal-event')).toHaveCount(0);
  await expect(page.getByLabel('Riepilogo della sessione', { exact: true })).toHaveValue('');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
});
