import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  calcAbilityMod,
  formatModifier,
  getRarityCssClass,
  convertCurrencyToCopper,
  evaluateD20Roll
} from './compendiumIntegrity.ts';

test('D&D 5e ability modifier math and formatting', () => {
  assert.equal(calcAbilityMod(10), 0);
  assert.equal(calcAbilityMod(18), 4);
  assert.equal(calcAbilityMod(8), -1);
  assert.equal(formatModifier(calcAbilityMod(16)), '+3');
  assert.equal(formatModifier(calcAbilityMod(7)), '-2');
});

test('Rarity class mapping matches CSS selectors', () => {
  assert.equal(getRarityCssClass('Molto raro'), 'rarity-Moltoraro');
  assert.equal(getRarityCssClass('Leggendario'), 'rarity-Leggendario');
  assert.equal(getRarityCssClass('Arma divina'), 'rarity-Armadivina');
});

test('Currency conversion to copper pieces (MR/MA/MO/MP)', () => {
  assert.equal(convertCurrencyToCopper({ mr: 5, ma: 2, mo: 3, mp: 1 }), 1325);
});

test('D20 3D roller advantage, disadvantage, crit, and fumble logic', () => {
  const adv = evaluateD20Roll(4, 20, 'vantaggio', 5);
  assert.equal(adv.natural, 20);
  assert.equal(adv.total, 25);
  assert.equal(adv.isCrit, true);

  const dis = evaluateD20Roll(1, 17, 'svantaggio', 2);
  assert.equal(dis.natural, 1);
  assert.equal(dis.total, 3);
  assert.equal(dis.isFumble, true);
});

test('Phase 1 & Phase 5 Complete Inventory Checklist Verification', () => {
  // 1. Check all modular directories and files exist
  assert.ok(fs.existsSync('index.html'), 'index.html exists');
  assert.ok(fs.existsSync('README.md'), 'README.md exists');
  assert.ok(fs.existsSync('css/variables.css'), 'css/variables.css exists');
  assert.ok(fs.existsSync('css/theme.css'), 'css/theme.css exists');
  assert.ok(fs.existsSync('css/animations.css'), 'css/animations.css exists');
  assert.ok(fs.existsSync('css/legacy.css'), 'css/legacy.css exists');
  assert.ok(fs.existsSync('data/catalog-data.js'), 'data/catalog-data.js exists');
  assert.ok(fs.existsSync('data/world-data.js'), 'data/world-data.js exists');
  assert.ok(fs.existsSync('js/app.js'), 'js/app.js exists');
  assert.ok(fs.existsSync('js/animations.js'), 'js/animations.js exists');

  // 2. Check all 4 external multi-system character sheets exist
  for (const sheet of ['brancalonia.js', 'sw5e.js', 'pokemon.js', 'naruto.js']) {
    assert.ok(fs.existsSync('js/sheets/' + sheet), `js/sheets/${sheet} exists`);
  }

  // 3. Check asset counts (34 audio, >=59 img, 12 schede)
  const audioFiles = fs.readdirSync('audio');
  const imgFiles = fs.readdirSync('img');
  const schedeFiles = fs.readdirSync('schede');
  assert.equal(audioFiles.length, 34, 'All 34 audio MP3 tracks preserved');
  assert.ok(imgFiles.length >= 59, 'All item & background images preserved');
  assert.equal(schedeFiles.length, 12, 'All 12 character sheet backgrounds preserved');

  // 4. Evaluate extracted data modules and verify item/spell/monster/NPC counts
  const ctx: Record<string, any> = {};
  vm.runInNewContext(fs.readFileSync('data/catalog-data.js', 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync('data/world-data.js', 'utf8'), ctx);

  assert.ok(ctx.SRD_OGGETTI.length >= 522, 'All 522+ weapons/items present in SRD_OGGETTI');
  assert.equal(ctx.SRD_INCANTESIMI.length, 398, 'All 398 spells present in SRD_INCANTESIMI');
  assert.ok(ctx.SRD_BESTIARIO.length >= 363, 'All 354 SRD + 12 custom monsters present');
  assert.equal(ctx.DATABASE_NPC_DEFAULT.length, 6, 'All 6 saved NPCs present');
  assert.equal(ctx.SCENE_AUDIO.length, 21, 'All 21 audio scenes present');
  assert.equal(ctx.LIBRI_DEFAULT.length, 8, 'All 8 default books present');
});

test('Unified User System (js/users.js), Arcane Portal Login & 3D Dice Arena Verification', () => {
  assert.ok(fs.existsSync('js/users.js'), 'js/users.js exists');

  const userCtx: Record<string, any> = { window: {}, document: {}, localStorage: {} };
  vm.runInNewContext(fs.readFileSync('js/users.js', 'utf8'), userCtx);

  assert.equal(userCtx.DEFAULT_USERS.length, 7, 'All 7 default accounts present in js/users.js');
  assert.ok(userCtx.UserManager, 'UserManager is exported');
  assert.equal(userCtx.UserManager.findDefaultUser('matteo').role, 'DM');
  assert.equal(userCtx.UserManager.findDefaultUser('luca').role, 'Giocatore');
  assert.equal(userCtx.UserManager.passwordMatch({}, 'Matteo', 'Dungeonmaster!'), true);
  assert.equal(userCtx.UserManager.passwordMatch({}, 'Matteo', 'wrong'), false);
  assert.equal(userCtx.UserManager.getAllUsers().length, 7);

  // Verify index.html has sium-login-portal, js/users.js, and no login-whiteout
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('id="sium-login-portal"'), 'Arcane login portal present in index.html');
  assert.ok(html.includes('src="js/users.js"'), 'js/users.js included in index.html');
  assert.ok(!html.includes('class="login-whiteout"'), 'Blinding login-whiteout removed from index.html');

  // Verify 3D Dice Arena and Section Herald exist in js/app.js and js/animations.js
  const appJs = fs.readFileSync('js/app.js', 'utf8');
  const animJs = fs.readFileSync('js/animations.js', 'utf8');
  assert.ok(appJs.includes('sium-3d-dice-arena'), '3D dice arena present in renderDadi');
  assert.ok(!appJs.includes('var DEFAULT_USERS ='), 'No duplicate DEFAULT_USERS in js/app.js');
  assert.ok(animJs.includes('build3DDieElement'), 'build3DDieElement exported in js/animations.js');
  assert.ok(animJs.includes('SECTION_HERALDS'), 'Section Herald transitions present in js/animations.js');
});

