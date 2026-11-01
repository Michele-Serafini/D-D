import { test, expect, login, expectViewportFits } from './fixtures.mjs';

async function preparePlayer(page) {
  await login(page);
  await page.evaluate(async () => {
    await _campaignDb.ref('schedePG/michele').set({
      _v2: true,
      chars: {
        hero: {
          nomePersonaggio: 'Aria',
          schedaTipo: 'normale',
          oro: 200,
          equipaggiamento: 'Corda',
        },
      },
    });
    await new Promise((resolve) => fbLoadSchede(resolve));
  });
}

test('a first character is saved in the current schema and is available to the shop after login', async ({
  page,
}) => {
  await login(page);
  await page.locator('.nav-item').filter({ hasText: 'Scheda PG' }).click();
  await page.getByRole('button', { name: 'Crea Scheda', exact: true }).click();
  await page.getByText('D&D 5e', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Nome Personaggio', exact: true })
    .first()
    .fill('Primo eroe');
  await expect
    .poll(() =>
      page.evaluate(() => __testDatabase.campaigns.principale.data?.schedePG?.michele?._v2)
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.values(__testDatabase.campaigns.principale.data.schedePG.michele.chars)[0]
            ?.nomePersonaggio
      )
    )
    .toBe('Primo eroe');
  await login(page);
  await page.locator('.nav-item').filter({ hasText: 'Inventario e acquisti' }).click();
  await expect(page.getByLabel('Personaggio del negozio')).toContainText('Primo eroe');
  expect(await page.evaluate(() => state.schedeList.length)).toBe(1);
});

async function buyPotion(page, quantity = 1) {
  await page
    .locator('.weapon-card')
    .filter({ has: page.getByRole('heading', { name: 'Pozione di Cura', exact: true }) })
    .getByRole('button', { name: 'Acquista Pozione di Cura', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Acquista oggetto', exact: true });
  await dialog.getByLabel('Quantità', { exact: true }).fill(String(quantity));
  await dialog.getByRole('button', { name: 'Conferma acquisto', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Operazione registrata');
  await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
}

test('purchase approval updates one inventory entry and the existing sheet coins exactly once', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await preparePlayer(page);
  await buyPotion(page, 2);
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.oro
    )
  ).toBe(200);
  await page.locator('.nav-item').filter({ hasText: 'Inventario e acquisti' }).click();
  await expect(page.locator('.commerce-order')).toContainText('In attesa');
  await login(page, 'sebastiano');
  await page.getByRole('button', { name: 'Negozio e ricompense', exact: true }).click();
  await page.getByRole('button', { name: 'Approva', exact: true }).click();
  await expect(page.locator('.commerce-order')).toContainText('Completata');
  const result = await page.evaluate(async () => {
    const request = Object.keys(CommerceService.requests.michele.hero)[0];
    await CommerceService.run({ username: 'michele', id: 'hero' }, request, { action: 'approve' });
    const sheet = __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero;
    return {
      balance: CommerceModel.balance(sheet, 'mo'),
      inventory: Object.values(sheet.trade.inventory),
      receipts: Object.keys(__testDatabase.campaigns.principale.data.commerceReceipts.michele.hero)
        .length,
      equipment: sheet.equipaggiamento,
    };
  });
  expect(result).toEqual({
    balance: 10000,
    inventory: [{ id: 'emporio:srd_o_001', name: 'Pozione di Cura', quantity: 2 }],
    receipts: 1,
    equipment: 'Corda',
  });
  await login(page);
  await page.locator('.nav-item').filter({ hasText: 'Scheda PG' }).click();
  await page.locator('.sium-pg-card').filter({ hasText: 'Aria' }).click();
  await page.getByText('Inventario, monete e acquisti', { exact: true }).click();
  await expect(page.locator('.commerce-inventory')).toContainText('Pozione di Cura × 2');
  await expect(page.locator('[data-sheet-field=platino]')).toHaveValue('10');
  await page.evaluate(async () => {
    state.scheda.hpAttuali = '8';
    await fbSaveScheda(true);
  });
  expect(
    await page.evaluate(() =>
      CommerceModel.balance(
        __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero,
        'mo'
      )
    )
  ).toBe(10000);
  expect(errors).toEqual([]);
});

test('automatic purchases stack items, fail safely on insufficient funds and cancel pending requests', async ({
  page,
}, testInfo) => {
  await preparePlayer(page);
  await page.evaluate(() => _campaignDb.ref('commercePolicy/requireApproval').set(false));
  await buyPotion(page);
  await buyPotion(page);
  const inventory = await page.evaluate(() =>
    Object.values(
      __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero.trade.inventory
    )
  );
  expect(inventory).toHaveLength(1);
  expect(inventory[0].quantity).toBe(2);
  await page
    .locator('.weapon-card')
    .filter({ has: page.getByRole('heading', { name: 'Pozione di Cura', exact: true }) })
    .getByRole('button', { name: 'Acquista Pozione di Cura', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Acquista oggetto', exact: true });
  await dialog.getByLabel('Quantità', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: 'Conferma acquisto', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Monete insufficienti');
  await dialog.getByRole('button', { name: 'Riprova la stessa operazione' }).click();
  await expect(dialog.getByRole('status')).toContainText('Monete insufficienti');
  await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await page.locator('.nav-item').filter({ hasText: 'Inventario e acquisti' }).click();
  const pending = page.locator('.commerce-order').filter({ hasText: 'In attesa' });
  await pending.getByRole('button', { name: 'Annulla richiesta' }).click();
  await expect(page.locator('.commerce-order').filter({ hasText: 'Annullata' })).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      CommerceModel.balance(
        __testDatabase.campaigns.principale.data.schedePG.michele.chars.hero,
        'mo'
      )
    )
  ).toBe(10000);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectViewportFits(page);
  await page.screenshot({ path: testInfo.outputPath('commerce-mobile.png'), fullPage: true });
});

test('master rewards update native currency fields and are isolated from other campaigns', async ({
  page,
}) => {
  await preparePlayer(page);
  await page.evaluate(() =>
    _campaignDb
      .ref('schedePG/michele/chars/pokemon')
      .set({ schedaTipo: 'pokemon', nome: 'Allenatore', soldi: 5 })
  );
  await login(page, 'sebastiano');
  await page.getByRole('button', { name: 'Negozio e ricompense', exact: true }).click();
  await page.getByLabel('Personaggio del negozio').selectOption('michele/pokemon');
  await page.getByRole('button', { name: 'Assegna ricompensa', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Assegna ricompensa', exact: true });
  await dialog.getByLabel('Motivo della ricompensa').fill('Sessione completata');
  await dialog.getByLabel('Monete da assegnare').fill('150');
  await dialog.getByLabel('Valuta della ricompensa').selectOption('poke');
  await dialog.getByRole('button', { name: 'Conferma ricompensa' }).click();
  await expect(dialog.getByRole('status')).toContainText('Operazione registrata');
  await dialog.getByRole('button', { name: 'Chiudi', exact: true }).click();
  expect(
    await page.evaluate(
      () => __testDatabase.campaigns.principale.data.schedePG.michele.chars.pokemon.soldi
    )
  ).toBe(155);
  await page.getByRole('button', { name: /^Cambia campagna/ }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page
      .locator('[data-campaign-id=mare]')
      .getByRole('button', { name: 'Entra', exact: true })
      .click(),
  ]);
  await page.getByRole('button', { name: 'Negozio e ricompense', exact: true }).click();
  await expect(page.locator('.commerce-order')).toHaveCount(0);
});
