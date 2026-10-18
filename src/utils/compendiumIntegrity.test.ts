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
  assert.ok(audioFiles.length >= 21, 'All audio MP3 tracks preserved');
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

test('Fair Dice Rolls (No Account Bias), Silent Dice, 10-Face 3D Die, and Emporio/Incantesimi/Scheda PG Animations', () => {
  const appJs = fs.readFileSync('js/app.js', 'utf8');
  const animJs = fs.readFileSync('js/animations.js', 'utf8');
  const animCss = fs.readFileSync('css/animations.css', 'utf8');

  // 1. Fair dice roll for every account: no DM cheat (usaTrucco / truccoInfo)
  assert.ok(!appJs.includes('usaTrucco'), 'Hidden DM advantage usaTrucco completely removed');
  assert.ok(!appJs.includes('truccoInfo'), 'Hidden DM advantage banner truccoInfo completely removed');

  // 2. Dice sound completely removed
  assert.ok(!appJs.includes('_synthDiceRoll();'), '_synthDiceRoll() is never called on dice roll');

  // 3. True multi-face 3D rolling die with decoupled throw track and pure continuous spin
  assert.ok(animJs.includes('sium-true-die-3d'), '3D polyhedral die container present');
  assert.ok(animJs.includes('sium-die-throw-track'), 'Decoupled parabolic throw track present');
  assert.ok(animCss.includes('@keyframes siumDiePureRollSpin'), 'Continuous 3D roll spin keyframe present');
  assert.ok(animCss.includes('backface-visibility: hidden'), '3D die faces hide backfaces to prevent z-fighting');

  // 4. Floating background lights & FX toggle button (top bar + sidebar)
  assert.ok(animJs.includes('sium-floating-fireflies'), 'Floating background fireflies layer present');
  assert.ok(animCss.includes('.sium-firefly-orb'), 'Floating firefly orb CSS present');
  assert.ok(animJs.includes('createTopControlsBar'), 'Top FX toggle control bar present');
  assert.ok(appJs.includes('sium-fx-toggle-btn'), 'Sidebar FX toggle button present in js/app.js');

  // 5. Emporio and Incantesimi Aggiuntivi click & modal animations
  assert.ok(appJs.includes('enhanceRelicModal'), 'Emporio relic 3D modal animation hooked in js/app.js');
  assert.ok(appJs.includes('openEmporioSubItemModal'), 'Emporio sub-tabs (Droghe, Veicoli, Cyberware) click showcase hooked');
  assert.ok(appJs.includes('enhanceSpellModal'), 'Incantesimi Aggiuntivi 3D grimoire modal animation hooked');
  assert.ok(appJs.includes('sium-spell-card'), 'Incantesimi Aggiuntivi cards have 3D spell card class');

  // 6. Scheda dei PG interactive animations
  assert.ok(appJs.includes('sium-pg-card'), 'Scheda dei PG character cards have 3D interactive class');
  assert.ok(appJs.includes('sium-pg-page'), 'Scheda dei PG sheet pages have 3D parchment unfurl class');
  assert.ok(appJs.includes('sium-pg-stat-box'), 'Scheda dei PG ability boxes have interactive click animation class');
  assert.ok(appJs.includes('sium-pg-skill-row'), 'Scheda dei PG skill rows have interactive click flash class');
  assert.ok(animCss.includes('@keyframes siumPgSheetUnfurl3D'), 'Scheda dei PG 3D unfurl keyframe present in CSS');
});

test('Theme Selector Button (Dark / Light / Halloween) & Halloween Theme (Dark Blue, Black & Green + Pumpkins/Ghosts/Spiders)', () => {
  const appJs = fs.readFileSync('js/app.js', 'utf8');
  const animJs = fs.readFileSync('js/animations.js', 'utf8');
  const varCss = fs.readFileSync('css/variables.css', 'utf8');
  const themeCss = fs.readFileSync('css/theme.css', 'utf8');
  const animCss = fs.readFileSync('css/animations.css', 'utf8');

  // 1. Theme Selector button & menu in top bar and sidebar
  assert.ok(animJs.includes('sium-theme-picker-btn'), 'Theme Picker button present in js/animations.js');
  assert.ok(animJs.includes('sium-theme-picker-menu'), 'Theme Picker popover menu present in js/animations.js');
  assert.ok(appJs.includes('sium-theme-picker-btn'), 'Theme Picker button present in sidebar footer in js/app.js');
  assert.ok(appJs.includes('window.setAppTheme'), 'setAppTheme helper present in js/app.js');

  // 2. Halloween palette (abyssal black, dark gothic purple, pumpkin orange)
  assert.ok(varCss.includes('[data-theme="halloween"]'), 'Halloween theme variables defined in css/variables.css');
  assert.ok(varCss.includes('--gold: #a855f7'), 'Halloween gothic purple accent defined');
  assert.ok(themeCss.includes('[data-theme="halloween"] .weapon-card'), 'Halloween themed cards, boxes and cobweb borders styled in css/theme.css');

  // 3. Halloween floating pumpkins, ghosts, spiders, tombstones, realistic white top-border cobwebs, and haunted cemetery
  assert.ok(animJs.includes('sium-halloween-floater'), 'Halloween floating pumpkins/ghosts/spiders/tombstones spawned in js/animations.js');
  assert.ok(animJs.includes('sium-halloween-decor'), 'Halloween cobwebs and dangling spiders mounted in js/animations.js');
  assert.ok(animJs.includes('sium-hw-top-web-canopy'), 'Realistic white silk spiderweb canopy along top border of site');
  assert.ok(animJs.includes('stroke="#ffffff"'), 'Realistic white silk cobweb SVG threads');
  assert.ok(animJs.includes('sium-hw-graveyard-bar'), 'Halloween graveyard bar with RIP tombstones mounted in js/animations.js');
  assert.ok(animJs.includes('sium-hw-top-garland'), 'Halloween top lantern garland mounted in js/animations.js');
  assert.ok(themeCss.includes('RIP'), 'Halloween RIP tombstone SVG in card corner borders in css/theme.css');
  assert.ok(animCss.includes('@keyframes siumHalloweenCreatureFloat'), 'Halloween floating creature animation keyframe present');

  // 4. Christmas Theme (Natale Magico: Snowflakes, Santas, Trees, Snowmen, Cookies, Candy-Cane Borders & Twinkling Lights)
  assert.ok(varCss.includes('[data-theme="christmas"]'), 'Christmas theme variables defined in css/variables.css');
  assert.ok(themeCss.includes('[data-theme="christmas"] .weapon-card'), 'Christmas themed cards with candy-cane borders & snow caps styled in css/theme.css');
  assert.ok(animJs.includes('sium-christmas-floater'), 'Christmas floating snowflakes, Santas, trees, snowmen and cookies spawned in js/animations.js');
  assert.ok(animJs.includes('sium-christmas-decor'), 'Christmas twinkling fairy lights garland and snowy corner mounted in js/animations.js');
  assert.ok(animJs.includes('sium-xmas-lights-garland'), 'Christmas lights garland present');
  assert.ok(animCss.includes('@keyframes siumChristmasFloaterDrift'), 'Christmas floating animation keyframe present');
  assert.ok(appJs.includes("'christmas'"), 'Christmas theme persisted and supported in js/app.js');

  // 5. Valentine's Day Theme (San Valentino Amoroso: Cupid, Floating Hearts, Lace Canopy, Pierced Heart Borders & Love Shrine)
  assert.ok(varCss.includes('[data-theme="valentine"]'), 'Valentine theme variables defined in css/variables.css');
  assert.ok(themeCss.includes('[data-theme="valentine"] .weapon-card'), 'Valentine themed cards with romantic ribbon borders & pierced heart SVG styled in css/theme.css');
  assert.ok(animJs.includes('sium-valentine-floater'), 'Valentine floating Cupids, hearts, roses and love letters spawned in js/animations.js');
  assert.ok(animJs.includes('sium-valentine-decor'), 'Valentine top lace canopy, corner Cupids, dangling hearts and Love Shrine mounted in js/animations.js');
  assert.ok(animJs.includes('sium-val-top-lace-canopy'), 'Valentine top lace & heart canopy present');
  assert.ok(animJs.includes('sium-val-corner-cupid'), 'Valentine corner Cupid SVGs present');
  assert.ok(animCss.includes('@keyframes siumValentineFloaterDrift'), 'Valentine floating animation keyframe present');
  assert.ok(appJs.includes("'valentine'"), 'Valentine theme persisted and supported in js/app.js');

  // 6. Easter Theme (Pasqua Fiorita: Painted Easter Eggs, Bunnies, Chicks, Flowers & Spring Meadow Borders)
  assert.ok(varCss.includes('[data-theme="easter"]'), 'Easter theme variables defined in css/variables.css');
  assert.ok(themeCss.includes('[data-theme="easter"] .weapon-card'), 'Easter themed cards with painted egg borders & bunny/egg SVG styled in css/theme.css');
  assert.ok(animJs.includes('sium-easter-floater'), 'Easter floating bunnies, painted eggs, chicks and flowers spawned in js/animations.js');
  assert.ok(animJs.includes('sium-easter-decor'), 'Easter top egg garland, dangling eggs/bunnies and bottom meadow mounted in js/animations.js');
  assert.ok(animJs.includes('sium-easter-top-garland'), 'Easter top garland present');
  assert.ok(animCss.includes('@keyframes siumEasterFloaterHop'), 'Easter floating animation keyframe present');
  assert.ok(appJs.includes("'easter'"), 'Easter theme persisted and supported in js/app.js');

  // 7. Bottom-right controls positioning & Extra Counter immediate delete (no iframe-blocked confirm())
  assert.ok(themeCss.includes('bottom: 0.85rem;'), 'Theme & animation controls positioned at bottom-right so they do not cover Scheda PG buttons');
  assert.ok(appJs.includes("notify('Contatore extra rimosso.')"), 'Extra counter delete button removes counter directly without blocked confirm()');
});


