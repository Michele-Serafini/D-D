import { test, expect, login, expectViewportFits } from './fixtures.mjs';

test('admin manages profiles, DM privileges, additions and removal from one page', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'admin', true);
  await expect(page.locator('#admin-users > li')).toHaveCount(4);
  await page.locator('#player-name').fill('nuovo');
  await page.locator('#add-player button').click();
  const row = page.locator('#admin-users > li').filter({ hasText: 'nuovo' });
  await expect(row).toHaveCount(1);
  await row.getByText('Profilo', { exact: true }).click();
  await row.getByLabel('Titolo').fill('Cartografo');
  await row.getByRole('button', { name: 'Salva profilo' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__testDatabase.users.nuovo.title))
    .toBe('Cartografo');
  await row.getByRole('button', { name: 'Abilita DM' }).click();
  await expect(row.getByRole('button', { name: 'Revoca DM' })).toBeVisible();
  await row.getByRole('button', { name: 'Rimuovi', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Riattiva' })).toBeVisible();
  await row.getByRole('button', { name: 'Riattiva' }).click();
  await expect(row.getByRole('button', { name: 'Rimuovi', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  expect(errors).toEqual([]);
});

test('player navigation, catalog search and every character-sheet system work', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'MICHELE');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  expect(await page.locator('.weapon-card img[loading="lazy"]').count()).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const section of [
    'emporio',
    'bestiario',
    'incantesimi',
    'libri',
    'scheda',
    'note',
    'iniziativa',
    'dadi',
    'caos',
    'mappa',
    'bacheca',
    'tavolo',
  ]) {
    await page.evaluate((section) => {
      state.section = section;
      renderMain();
    }, section);
    await expect(page.locator('.main-content')).not.toBeEmpty();
    await expect(page.locator('.main-content')).not.toContainText('ERRORE RENDER');
  }
  await page.evaluate(() => {
    state.section = 'emporio';
    state.search = 'spada';
    renderMain();
  });
  expect(await page.locator('.weapon-card').count()).toBeGreaterThan(0);
  for (const type of [
    'normale',
    'onepiece',
    '7thsea',
    'brancalonia',
    'sw5e',
    'pokemon',
    'naruto',
  ]) {
    await page.evaluate((type) => {
      const defaults = {
        pokemon: window._pokemonDefault,
        naruto: window._narutoDefault,
        brancalonia: window._brancaloniaDefault,
        sw5e: window._sw5eDefault,
      };
      state.scheda = defaults[type]
        ? defaults[type]('fixture-sheet')
        : Object.assign(_schedaDefault(), { id: 'fixture-sheet', schedaTipo: type });
      state.schedaAttivaId = 'fixture-sheet';
      state.schedeList = [state.scheda];
      state.section = 'scheda';
      renderMain();
    }, type);
    expect(
      await page.locator('.main-content input, .main-content textarea').count()
    ).toBeGreaterThan(0);
    if (type === 'normale' || type === 'onepiece') {
      await page
        .getByRole('textbox', { name: 'Nome Personaggio', exact: true })
        .first()
        .fill('Eroe di prova');
      expect(await page.evaluate(() => state.scheda.nomePersonaggio)).toBe('Eroe di prova');
    }
  }
  expect(errors).toEqual([]);
});

test('master sections, all shop categories, themes and lazy map engine remain available', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'sebastiano');
  expect(await page.evaluate(() => typeof window.L)).toBe('undefined');
  for (const section of ['generatore', 'worldbuilding', 'storia', 'archivio', 'schedepg']) {
    await page.evaluate((section) => {
      state.section = section;
      renderMain();
    }, section);
    await expect(page.locator('.main-content')).not.toBeEmpty();
    await expect(page.locator('.main-content')).not.toContainText('Errore Storia:');
  }
  for (const name of [
    'renderEmporioCyber',
    'renderEmporioDroghe',
    'renderEmporioVeicoli',
    'renderEmporioArmiFuoco',
  ]) {
    expect(await page.evaluate((name) => window[name]().childElementCount, name)).toBeGreaterThan(
      0
    );
  }
  for (const theme of ['light', 'dark', 'halloween', 'christmas', 'valentine', 'easter']) {
    await page.evaluate((theme) => window.setAppTheme(theme), theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.evaluate(() => ensureLeaflet());
  expect(await page.evaluate(() => typeof L.map)).toBe('function');
  expect(await page.locator('script[src="vendor/leaflet/leaflet.js"]').count()).toBe(1);
  await page.evaluate(() => ensureLeaflet());
  expect(await page.locator('script[src="vendor/leaflet/leaflet.js"]').count()).toBe(1);
  expect(errors).toEqual([]);
});

test('IndexedDB reuses its connection, commits images and restores local notes', async ({
  page,
}) => {
  await page.goto('/D-D/');
  const result = await page.evaluate(async () => {
    const first = await ImageDB.init();
    const second = await ImageDB.init();
    await ImageDB.save('fixture-image', 'data:image/png;base64,fixture');
    const image = await ImageDB.get('fixture-image');
    state.notes = 'Appunti salvati';
    flushStorage();
    await ImageDB.saveState(JSON.stringify({ notes: state.notes }));
    return { sameConnection: first === second, image };
  });
  expect(result.sameConnection).toBe(true);
  expect(result.image).toBe('data:image/png;base64,fixture');
  await page.reload();
  await expect.poll(() => page.evaluate(() => state.notes)).toBe('Appunti salvati');
});

test('sheet zoom fits the viewport when native CSS zoom is unavailable', async ({ page }) => {
  await page.goto('/D-D/');
  const size = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.width = '400px';
    const sheet = document.createElement('div');
    sheet.style.height = '200px';
    host.appendChild(sheet);
    document.body.appendChild(host);
    const style = new Proxy(sheet.style, {
      has: (target, key) => (key === 'zoom' ? false : Reflect.has(target, key)),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    });
    applySheetZoom({ style }, 0.5);
    const rect = sheet.getBoundingClientRect();
    host.remove();
    return { width: rect.width, height: rect.height };
  });
  expect(size.width).toBeCloseTo(400, 0);
  expect(size.height).toBeCloseTo(100, 0);
});
