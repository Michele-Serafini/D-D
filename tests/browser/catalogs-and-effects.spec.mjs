import { test, expect, login, expectViewportFits } from './fixtures.mjs';
test.setTimeout(120_000);

async function open(page, section) {
  await page.locator('.sidebar [data-section="' + section + '"]').click();
}

test('campaign masters add objects and spells with dedicated buttons; players can read them', async ({
  page,
}) => {
  // Seed a campaign master whose global account is still a player.
  await page.addInitScript(() => {
    window.__testDatabase.campaigns.principale.members.michele = 'dm';
  });
  await login(page);
  expect(await page.evaluate(() => [isAdmin(), isDM()])).toEqual([false, true]);
  await open(page, 'emporio');
  await page.getByRole('button', { name: 'Aggiungi oggetto', exact: true }).click();
  const object = page.getByRole('dialog', { name: 'Aggiungi oggetto', exact: true });
  await object.getByLabel('Nome *', { exact: true }).fill('Bussola della compagnia');
  await object.getByLabel('Prezzo', { exact: true }).fill('17.5');
  await object.getByLabel('Valuta', { exact: true }).selectOption('ma');
  await object.getByRole('button', { name: 'Aggiungi al Compendio', exact: true }).click();
  await expect(object).toHaveCount(0);
  await expect(page.locator('.weapon-card')).toContainText('Bussola della compagnia');
  const saved = await page.evaluate(() =>
    state.armi.find((item) => item.nome === 'Bussola della compagnia')
  );
  expect(saved.prezzo).toBe(17.5);
  expect(saved.valuta).toBe('ma');

  await open(page, 'incantesimi');
  await page.getByRole('button', { name: 'Aggiungi incantesimo', exact: true }).click();
  const spell = page.getByRole('dialog', { name: 'Aggiungi incantesimo', exact: true });
  await spell.getByLabel('Nome', { exact: true }).fill('Luce della compagnia');
  await spell
    .getByLabel('Descrizione', { exact: true })
    .fill('Un bagliore per ritrovare il gruppo.');
  // A realtime refresh must not erase an unfinished form.
  await page.evaluate(() => renderMain());
  await expect(spell.getByLabel('Nome', { exact: true })).toHaveValue('Luce della compagnia');
  await spell.getByRole('button', { name: 'Aggiungi Incantesimo', exact: true }).click();
  await expect(spell).toHaveCount(0);
  await expect(page.locator('.sium-spell-card')).toContainText('Luce della compagnia');

  await login(page, 'montre');
  await expect(page.getByRole('button', { name: 'Aggiungi oggetto', exact: true })).toHaveCount(0);
  await page.getByPlaceholder('es. spada, pozione, runico...').fill('Bussola della compagnia');
  await expect(page.locator('.weapon-card')).toHaveCount(1);
  await expect(page.locator('.weapon-card')).toContainText('Bussola della compagnia');
  await expect(page.locator('.weapon-card .edit-btn, .weapon-card .del-btn')).toHaveCount(0);
  await open(page, 'incantesimi');
  await expect(page.getByRole('button', { name: 'Aggiungi incantesimo', exact: true })).toHaveCount(
    0
  );
  await page.getByPlaceholder('nome, scuola, descrizione...').fill('Luce della compagnia');
  await expect(page.locator('.sium-spell-card')).toHaveCount(1);
  await page.getByRole('heading', { name: 'Luce della compagnia', exact: true }).click();
  await expect(page.locator('#inc-detail-overlay')).toContainText(
    'Un bagliore per ritrovare il gruppo.'
  );
  await expect(page.getByRole('button', { name: 'Elimina incantesimo' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
});

test('master edits and deletions of default spells survive catalog refreshes and login', async ({
  page,
}) => {
  await login(page, 'sebastiano');
  await open(page, 'incantesimi');
  const source = await page.evaluate(() => ({
    id: SRD_INCANTESIMI[0].id,
    name: SRD_INCANTESIMI[0].nome,
  }));
  await page.getByPlaceholder('nome, scuola, descrizione...').fill(source.name);
  const card = page
    .locator('.sium-spell-card')
    .filter({ has: page.getByRole('heading', { name: source.name, exact: true }) });
  await card.getByRole('button', { name: '✎ Modifica', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Modifica incantesimo', exact: true });
  await dialog
    .getByLabel('Descrizione', { exact: true })
    .fill('Versione personalizzata dal master.');
  await dialog.getByRole('button', { name: 'Salva Modifiche', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await login(page, 'sebastiano');
  await open(page, 'incantesimi');
  await page.getByPlaceholder('nome, scuola, descrizione...').fill(source.name);
  await card.getByRole('heading', { name: source.name, exact: true }).click();
  await expect(page.locator('#inc-detail-overlay')).toContainText(
    'Versione personalizzata dal master.'
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('#inc-detail-overlay')).toHaveCount(0);
  page.once('dialog', (confirmation) => confirmation.accept());
  await card.getByRole('button', { name: 'Elimina incantesimo', exact: true }).click();
  await expect(card).toHaveCount(0);
  await login(page, 'sebastiano');
  await open(page, 'incantesimi');
  await page.getByPlaceholder('nome, scuola, descrizione...').fill(source.name);
  await expect(card).toHaveCount(0);
});

test('all themed effects, page transitions, animated headings and dice remain active', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'on');
  await expect(page.locator('#sium-particles-canvas')).toBeVisible();
  for (const theme of ['dark', 'light', 'halloween', 'christmas', 'valentine', 'easter']) {
    await page.getByLabel('Tema del sito', { exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    if (!['dark', 'light'].includes(theme))
      await expect(page.locator('#sium-' + theme + '-decor')).toBeVisible();
  }
  await open(page, 'dadi');
  await expect(
    page.locator('.main-content > .sheet-sync-status.sium-section-transition')
  ).toHaveCount(0);
  await expect(page.locator('.main-content > .sium-section-transition')).toHaveCount(1);
  await expect(page.locator('.header-title')).toHaveClass(/sium-rune-title/);
  await page.locator('.dice-roll-btn').click();
  await expect(page.locator('.sium-die-3d-rig').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('restored-effects.png') });
});
