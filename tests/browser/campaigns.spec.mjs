import { test, expect, login } from './fixtures.mjs';

test('switching campaigns isolates notes, sheets, maps and local images and restores them on return', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(async () => {
    state.notes = 'Appunti della prima campagna';
    flushStorage();
    await _campaignDb.ref('state/notes').set(state.notes);
    await _campaignDb
      .ref('schedePG/michele/chars/hero')
      .set({ nomePersonaggio: 'Eroe della prima' });
    await _campaignDb.ref('users/sebastiano/mappa/name').set('Mappa della prima');
    await ImageDB.save('same-image', 'prima-immagine');
    CampaignManager.showSelector();
  });
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await expect.poll(() => page.evaluate(() => CampaignManager.current?.id)).toBe('mare');
  const empty = await page.evaluate(async () => ({
    notes: state.notes,
    sheet: (await _campaignDb.ref('schedePG/michele/chars/hero').once('value')).val(),
    map: (await _campaignDb.ref('users/sebastiano/mappa/name').once('value')).val(),
    image: await ImageDB.get('same-image'),
  }));
  expect(empty).toEqual({ notes: '', sheet: null, map: null, image: null });
  await page.evaluate(async () => {
    state.notes = 'Appunti del mare';
    flushStorage();
    await _campaignDb.ref('state/notes').set(state.notes);
    await ImageDB.save('same-image', 'seconda-immagine');
    CampaignManager.showSelector();
  });
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=principale]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await expect.poll(() => page.evaluate(() => CampaignManager.current?.id)).toBe('principale');
  await expect.poll(() => page.evaluate(() => state.notes)).toBe('Appunti della prima campagna');
  expect(await page.evaluate(() => ImageDB.get('same-image'))).toBe('prima-immagine');
  expect(await page.evaluate(() => window.__testDatabase.state)).toBeUndefined();
});

test('master creates a campaign and manages its group without editing accounts', async ({
  page,
}) => {
  await login(page, 'sebastiano');
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  const form = page.locator('#campaign-selector form');
  await form.getByLabel('Nome della campagna').fill('Le isole dimenticate');
  await form.getByLabel('Descrizione').fill('Avventura del secondo gruppo');
  await form.getByLabel('michele', { exact: true }).check();
  await form.getByRole('button', { name: 'Crea campagna' }).click();
  const card = page
    .locator('.campaign-card')
    .filter({ has: page.getByRole('heading', { name: 'Le isole dimenticate' }) });
  await expect(card).toContainText('sebastiano');
  await expect(card).toContainText('michele');
  await card.getByText('Gestisci giocatori', { exact: true }).click();
  await card.getByLabel('Ruolo di montre').selectOption('dm');
  await card.getByRole('button', { name: 'Salva gruppo' }).click();
  await expect(card).toContainText('montre');
  const result = await page.evaluate(() => {
    const campaign = CampaignManager.campaigns.find(
      (entry) => entry.meta.name === 'Le isole dimenticate'
    );
    return {
      role: campaign.members.montre,
      access: window.__testDatabase.campaignAccess.montre[campaign.id],
      globalRole: window.__testDatabase.users.montre.role,
      campaignMaster: CampaignManager.isMaster('montre', campaign),
      currentMaster: CampaignManager.isMaster('montre'),
    };
  });
  expect(result).toEqual({
    role: 'dm',
    access: true,
    globalRole: 'Giocatore',
    campaignMaster: true,
    currentMaster: false,
  });
});

test('players select only their campaigns and removal revokes an open campaign', async ({
  page,
}) => {
  await login(page, 'montre');
  await page.evaluate(() => CampaignManager.showSelector());
  await expect(page.locator('[data-campaign-id=mare]')).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      try {
        await CampaignManager.enter('mare');
        return false;
      } catch {
        return true;
      }
    })
  ).toBe(true);
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => _db.ref('campaigns/principale/members/montre').set(null)),
  ]);
  await expect.poll(() => page.evaluate(() => CampaignManager.current?.id || null)).toBeNull();
  await expect(page.getByRole('heading', { name: 'Scegli la campagna' })).toBeVisible();
  await expect(page.locator('.main-content')).toHaveCount(0);
  await expect(page.locator('[data-campaign-id=principale]')).toHaveCount(0);
});

test('legacy migration preserves books, sheets and personal maps once and archives old profile data', async ({
  page,
}) => {
  await page.goto('/D-D/');
  await page.evaluate(() => {
    const data = window.__testDatabase;
    delete data.campaigns;
    delete data.campaignAccess;
    delete data.meta.campaignMigration;
    data.state = { notes: 'Sessione precedente' };
    data.libri = { books: { book: { titolo: 'Libro conservato' } } };
    data.schedePG = { michele: { chars: { hero: { nomePersonaggio: 'Eroe conservato' } } } };
    data.users.sebastiano.mappa = { name: 'Mappa conservata' };
    sessionStorage.setItem('__testDatabase', JSON.stringify(data));
  });
  await login(page, 'sebastiano');
  const result = await page.evaluate(() => {
    const data = window.__testDatabase;
    const migrated = data.campaigns.principale.data;
    return {
      book: migrated.libri.books.book.titolo,
      sheet: migrated.schedePG.michele.chars.hero.nomePersonaggio,
      map: migrated.users.sebastiano.mappa.name,
      legacyMap: data.users.sebastiano.mappa,
      archiveMap: data.legacyCampaignArchive.users.sebastiano.mappa.name,
    };
  });
  expect(result).toEqual({
    book: 'Libro conservato',
    sheet: 'Eroe conservato',
    map: 'Mappa conservata',
    legacyMap: undefined,
    archiveMap: 'Mappa conservata',
  });
  await expect.poll(() => page.evaluate(() => state.notes)).toBe('Sessione precedente');
});
