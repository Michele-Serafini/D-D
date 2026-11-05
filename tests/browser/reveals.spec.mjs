import { test, expect, login, expectViewportFits } from './fixtures.mjs';
test.setTimeout(90_000);

async function section(page, master = true) {
  await page
    .locator('.nav-item')
    .filter({ hasText: master ? 'Contenuti e segreti' : 'Contenuti rivelati' })
    .click();
}
async function create(page, type, title, notes = '') {
  await page.getByRole('button', { name: 'Nuovo contenuto', exact: true }).click();
  await page.getByLabel('Tipo di contenuto').selectOption(type);
  await page.getByLabel('Titolo', { exact: true }).fill(title);
  await page.getByLabel('Testo per i giocatori').fill('Descrizione di ' + title);
  await page.getByLabel('Note segrete del master (mai condivise)').fill(notes);
  if (type === 'immagine') {
    await page.getByLabel('Carica immagine').setInputFiles({
      name: 'map.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5S8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    await expect(page.locator('.reveal-editor .reveal-image-preview')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Salva bozza', exact: true }).click();
  await expect(page.locator('.reveals-page [role=status]')).toContainText('Bozza salvata');
}
test('masters prepare four types and explicitly reveal reviewed copies without sharing secret notes', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'sebastiano');
  await section(page);
  for (const [type, title] of [
    ['luogo', 'Torre'],
    ['npc', 'Guardiano'],
    ['immagine', 'Mappa'],
    ['indizio', 'Lettera'],
  ])
    await create(page, type, title, 'Segreto riservato: ' + title);
  const card = page
    .locator('.reveal-card')
    .filter({ has: page.getByRole('heading', { name: 'Guardiano', exact: true }) });
  await card.getByRole('button', { name: 'Rivela ai giocatori' }).click();
  await expect(card).toContainText('Visibile ai giocatori');
  await card.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('Testo per i giocatori').fill('Descrizione aggiornata');
  await page.getByRole('button', { name: 'Salva bozza' }).click();
  await expect(card).toContainText('i giocatori vedono la versione precedente');
  expect(
    await page.evaluate(
      () => Object.values(__testDatabase.campaigns.principale.data.revealedContent)[0].text
    )
  ).toBe('Descrizione di Guardiano');
  await card.getByRole('button', { name: 'Aggiorna per i giocatori' }).click();
  await expect(card).toContainText('Visibile ai giocatori');
  await login(page);
  await section(page, false);
  await expect(page.locator('.reveal-card')).toHaveCount(1);
  await expect(page.locator('.reveals-page')).toContainText('Descrizione aggiornata');
  await expect(page.locator('.reveals-page')).not.toContainText('Segreto riservato');
  await expect(page.getByRole('button', { name: 'Modifica', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: info.outputPath('revealed-content-mobile.png'), fullPage: true });
  // Simulate a master withdrawal arriving from the test backend while this player is listening.
  await page.evaluate(async () => {
    const id = Object.keys(__testDatabase.campaigns.principale.data.revealedContent)[0];
    await _campaignDb.ref('revealedContent/' + id).remove();
  });
  await expect(page.locator('.reveal-card')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('hiding keeps the private draft, re-reveal and delete work, and another campaign has no content', async ({
  page,
}) => {
  await login(page, 'sebastiano');
  await section(page);
  await create(page, 'indizio', 'Messaggio');
  await page.getByRole('button', { name: 'Rivela ai giocatori' }).click();
  await page.getByRole('button', { name: 'Nascondi ai giocatori' }).click();
  await expect(page.locator('.reveal-card')).toContainText('Segreto · solo master');
  await login(page);
  await section(page, false);
  await expect(page.locator('.reveal-card')).toHaveCount(0);
  await login(page, 'sebastiano');
  await section(page);
  await page.getByRole('button', { name: 'Rivela ai giocatori' }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.locator('.reveal-card')).toHaveCount(0);
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await section(page);
  await expect(page.locator('.reveal-card')).toHaveCount(0);
});
test('account, theme and animation controls have one location and never float above page content', async ({
  page,
}, info) => {
  await login(page);
  await section(page, false);
  await page.getByLabel('Cerca contenuti').fill('Filtro conservato');
  await expect(
    page.locator('#sium-top-controls, #gear-btn-el, #user-badge-el, #sium-floating-d20')
  ).toHaveCount(0);
  const account = page.getByRole('button', {
    name: 'Account e impostazioni · michele',
    exact: true,
  });
  await expect(account).toHaveCount(1);
  await account.click();
  const settings = page.getByRole('dialog', { name: 'Impostazioni Compendium e Party' });
  await expect(settings.getByRole('button', { name: 'Esci e cambia account' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Cambia Account|Disconnetti/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi Impostazioni' }).click();
  for (const theme of ['light', 'dark', 'halloween', 'christmas', 'valentine', 'easter']) {
    await page.getByLabel('Tema del sito', { exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await expect(page.getByLabel('Cerca contenuti')).toHaveValue('Filtro conservato');
  await account.click();
  const fx = settings.locator('.sium-fx-toggle-btn');
  const before = await fx.getAttribute('aria-pressed');
  await fx.click();
  await expect(fx).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await page.getByRole('button', { name: 'Chiudi Impostazioni' }).click();
  await page.getByRole('button', { name: 'Lancia un dado D20 rapido' }).click();
  await expect(page.locator('#quick-d20-result')).toContainText(/D20|NATURALE|CRITICO/);
  await page.setViewportSize({ width: 390, height: 844 });
  const savedInput = await page.getByLabel('Cerca contenuti').elementHandle();
  await page.getByRole('button', { name: 'Apri menu', exact: true }).click();
  await expect(page.locator('.sidebar-backdrop')).toHaveCount(1);
  await expect(page.getByLabel('Cerca contenuti')).toHaveValue('Filtro conservato');
  expect(await savedInput.evaluate((element) => element.isConnected)).toBe(true);
  await page.locator('.sidebar [data-section=telefono]').click();
  await expect(page.locator('.sidebar-backdrop')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Telefono e offline' })).toBeVisible();
  await expectViewportFits(page);
  await expect(page.locator('body > #quick-d20')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('controls-mobile.png'), fullPage: true });
});
