import { test, expect, login, expectViewportFits } from './fixtures.mjs';
test.setTimeout(90_000);

async function prepare(page) {
  await login(page);
  await page.evaluate(async () => {
    await _campaignDb.ref('schedePG/michele').set({
      _v2: true,
      chars: {
        hero: {
          nomePersonaggio: 'Aria offline',
          schedaTipo: 'normale',
          hpAttuali: '20',
          oro: 100,
          storia: 'Una storia disponibile senza rete',
        },
      },
    });
    await new Promise((resolve) => fbLoadSchede(resolve));
  });
  await page.locator('.nav-item').filter({ hasText: 'Telefono e offline' }).click();
  await expect.poll(() => page.evaluate(() => OfflineSheets.connected)).toBe(true);
  await page.getByRole('button', { name: 'Prepara schede offline', exact: true }).click();
  await expect(page.locator('.phone-page [role=status]')).toContainText(
    'Schede salvate sul dispositivo'
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000 })
    .toBe(true);
}
async function editOffline(page) {
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => OfflineSheets.connected)).toBe(false);
  await page.evaluate(async () => {
    state.schedaAttivaId = 'hero';
    state.scheda = SheetStore.seed(
      'michele',
      Object.assign(
        _schedaFix({
          nomePersonaggio: 'Aria offline',
          hpAttuali: '20',
          oro: 100,
          storia: 'Una storia disponibile senza rete',
        }),
        { id: 'hero' }
      )
    );
    state.scheda.hpAttuali = '7';
    await fbSaveScheda(true);
  });
}
test('installed shell opens offline copies after navigation and synchronizes durable edits after login', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await prepare(page);
  // Let native service-worker navigation handle the network instead of routing it through Playwright.
  await page.unrouteAll();
  await page.evaluate(() => setAppTheme('halloween'));
  await editOffline(page);
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.hpAttuali
    )
  ).toBe('20');
  await expect(page.locator('.sheet-sync-status')).toContainText('1 modifiche');
  await page.evaluate(() => location.assign(new URL('./', location.href).href));
  await expect(page.getByRole('heading', { name: 'Schede offline', exact: true })).toBeVisible();
  await expect(page.locator('#status')).toContainText('1 modifiche ancora da sincronizzare');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'halloween');
  await expect(page.locator('#sheet')).toContainText('Una storia disponibile senza rete');
  await expect(
    page
      .locator('#sheet section')
      .filter({ has: page.getByRole('heading', { name: 'Punti vita attuali', exact: true }) })
      .first()
  ).toContainText('7');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: info.outputPath('offline-phone.png'), fullPage: true });
  await page.context().setOffline(false);
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await expect
    .poll(() => page.evaluate(() => OfflineSheets.operations.length), { timeout: 15000 })
    .toBe(0);
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.hpAttuali
    )
  ).toBe('7');
  await expect(page.locator('.sheet-sync-status')).toContainText('sincronizzate con Firebase');
  expect(errors).toEqual([]);
});
test('offline copies stay with their account and logout locks the offline reader', async ({
  page,
}) => {
  await prepare(page);
  await login(page, 'montre');
  await page.goto('/D-D/offline.html');
  await expect(page.locator('#status')).toContainText('Nessuna copia disponibile');
  await expect(page.locator('#sheet')).not.toContainText('Aria offline');
  await login(page);
  await page.getByRole('button', { name: 'Account e impostazioni · michele', exact: true }).click();
  await page.getByRole('button', { name: 'Esci e cambia account', exact: true }).click();
  await expect(page.locator('#login-username-input')).toBeVisible();
  await page.goto('/D-D/offline.html');
  await expect(page.locator('#status')).toContainText('Nessuna copia disponibile');
});
test('remote conflicts remain pending until explicitly resolved and installation has browser instructions', async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Installa sul telefono' }).click();
  await expect(page.locator('.phone-page [role=status]')).toContainText(/menu|Safari/);
  await editOffline(page);
  await page.evaluate(() => {
    __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.hpAttuali = '5';
  });
  await page.context().setOffline(false);
  await expect(page.locator('.offline-operation')).toContainText('campi sono cambiati online', {
    timeout: 15000,
  });
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.hpAttuali
    )
  ).toBe('5');
  await page.getByRole('button', { name: 'Mantieni dati online e scarta questa modifica' }).click();
  await expect(page.locator('.offline-operation')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => state.scheda.hpAttuali)).toBe('5');
});
