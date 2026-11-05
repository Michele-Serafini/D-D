import { test, expect, login, expectViewportFits } from './fixtures.mjs';

test.setTimeout(90_000);

async function prepare(page) {
  await login(page);
  await page.evaluate(async () => {
    await _campaignDb.ref('schedePG/michele').set({
      _v2: true,
      chars: {
        hero: {
          nomePersonaggio: 'Aria',
          schedaTipo: 'normale',
          hpAttuali: '20',
          oro: 100,
          annotations: { note: 'Nota originale' },
        },
      },
    });
    await new Promise((resolve) => fbLoadSchede(resolve));
    await SheetStore.saveChanges('michele', 'hero', {
      hpAttuali: '1',
      'annotations/note': 'Nota errata',
    });
    // SheetStore confirms durable local storage before Firebase acknowledges the write.
    await OfflineSheets.requireSynced();
  });
}

test('the owner reviews exact changes, previews a restore and keeps both versions across login', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await prepare(page);
  await page.locator('.nav-item').filter({ hasText: 'Scheda PG' }).click();
  await page.locator('.sium-pg-card').filter({ hasText: 'Aria' }).click();
  await page
    .locator('.main-content')
    .getByRole('button', { name: 'Storico e ripristino', exact: true })
    .click();
  await expect(page.locator('.sheet-history-detail')).toContainText('Modifica di michele');
  await expect(page.locator('.sheet-history-detail')).toContainText('Nota originale');
  await expect(page.locator('.sheet-history-detail')).toContainText('Nota errata');
  await page.getByRole('button', { name: /Versione 0/ }).click();
  await page.getByRole('button', { name: 'Anteprima ripristino' }).click();
  await expect(page.locator('.sheet-history-detail')).toContainText('20');
  await page.getByRole('button', { name: 'Conferma ripristino' }).click();
  await expect(page.locator('.sheet-history [role=status]')).toContainText('Scheda ripristinata');
  await expect(page.locator('.sheet-history-detail')).toContainText('Ripristino di michele');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: info.outputPath('sheet-history-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page);
  await page.locator('.nav-item').filter({ hasText: 'Storico e ripristino' }).click();
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.hpAttuali
    )
  ).toBe('20');
  await expect(page.getByRole('button', { name: /Versione 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Versione 2/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('older revisions load on demand and a new edit invalidates an open restore preview', async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(async () => {
    for (let n = 2; n <= 32; n++)
      await SheetHistory.save('michele', 'hero', { hpAttuali: String(n) });
  });
  await page.locator('.nav-item').filter({ hasText: 'Storico e ripristino' }).click();
  await expect(page.getByRole('button', { name: /Versione 32/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Versione 1 ·/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Carica versioni precedenti' }).click();
  await page.getByRole('button', { name: /Versione 0/ }).click();
  await page.getByRole('button', { name: 'Anteprima ripristino' }).click();
  await page.evaluate(() => SheetHistory.save('michele', 'hero', { hpAttuali: '99' }));
  await expect(page.locator('.sheet-history [role=status]')).toContainText('La scheda è cambiata');
  await expect(page.getByRole('button', { name: 'Conferma ripristino' })).toBeDisabled();
  await page.getByRole('button', { name: 'Aggiorna storico' }).click();
  await expect(page.locator('.sheet-history-detail')).toContainText('Versione 33 · attuale');
});

test('masters restore player sheets without refunding later purchases; histories stay in their campaign', async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => _campaignDb.ref('commercePolicy/requireApproval').set(false));
  await page.evaluate(async () => {
    await CommerceService.run({ username: 'michele', id: 'hero' }, 'history-purchase', {
      action: 'submit',
      kind: 'purchase',
      item: CommerceModel.product({ id: 'potion', nome: 'Pozione' }, 'test'),
      quantity: 1,
      unitPrice: 50,
      currency: 'mo',
    });
  });
  await login(page, 'sebastiano');
  await page.locator('.nav-item').filter({ hasText: 'Storico e ripristino' }).click();
  await expect(page.locator('.sheet-history-detail')).toContainText('Acquisto di michele');
  await page.getByRole('button', { name: /Versione 0/ }).click();
  await page.getByRole('button', { name: 'Anteprima ripristino' }).click();
  await page.getByRole('button', { name: 'Conferma ripristino' }).click();
  await expect(page.locator('.sheet-history [role=status]')).toContainText('Scheda ripristinata');
  await expect(page.locator('.sheet-history-detail')).toContainText('Ripristino di sebastiano');
  const result = await page.evaluate(() => {
    const sheet = __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero;
    return {
      hp: sheet.hpAttuali,
      money: CommerceModel.balance(sheet, 'mo'),
      items: Object.values(sheet.trade.inventory),
      receipts: Object.keys(__testDatabase.campaigns.principale.data.commerceReceipts.michele.hero)
        .length,
    };
  });
  expect(result).toEqual({
    hp: '20',
    money: 5000,
    items: [{ id: 'test:potion', name: 'Pozione', quantity: 1 }],
    receipts: 1,
  });
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await page.locator('.nav-item').filter({ hasText: 'Storico e ripristino' }).click();
  await expect(page.locator('.sheet-history')).toContainText('Nessuna scheda disponibile');
  await expect(page.getByRole('button', { name: /Versione/ })).toHaveCount(0);
});
