import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. Unified User Management (js/users.js) exports all accounts, roles, and Arcane Portal ceremony", () => {
  const usersCode = fs.readFileSync("js/users.js", "utf8");
  assert.ok(usersCode.includes("window.UserManager"), "UserManager must be exposed on window");
  for (const name of ["Matteo", "Luca", "Michele", "Silvia", "Giada", "Enrico", "Chiliano"]) {
    assert.ok(usersCode.includes(name), `Default user ${name} must be preserved`);
  }
  assert.ok(usersCode.includes("sium-login-portal"), "Login must use Arcane Portal ceremony instead of whiteout burst");
});

test("2. Annoying Dice Sound is completely removed from js/app.js", () => {
  const appCode = fs.readFileSync("js/app.js", "utf8");
  const synthMatch = appCode.match(/function _synthDiceRoll\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(synthMatch, "_synthDiceRoll function should exist as a safe no-op");
  assert.ok(!synthMatch[1].includes("createBufferSource"), "_synthDiceRoll must not generate white noise");
  assert.ok(!appCode.includes("_synthDiceRoll();"), "_showRoll3D must not invoke _synthDiceRoll()");
});

test("3. 4D Dice Engine, Emporio Relic Showcase, and Grimoire Spell Modal animations exist", () => {
  const animCss = fs.readFileSync("css/animations.css", "utf8");
  const animJs = fs.readFileSync("js/animations.js", "utf8");
  const appJs = fs.readFileSync("js/app.js", "utf8");

  // 4D Dice trajectory, bounces, Tesseract core, and temporal echoes
  assert.ok(animCss.includes("@keyframes siumDie4DThrowAndRoll"), "4D throw and roll keyframes must exist");
  assert.ok(animCss.includes(".sium-die-4d-tesseract"), "4D inner Tesseract core class must exist");
  assert.ok(animCss.includes(".sium-die-4d-echo"), "4D temporal echo trail class must exist");
  assert.ok(animJs.includes("sium-die-4d-tesseract"), "build3DDieElement must build 4D Tesseract core");

  // Emporio Relic Modal & Sub-Item Modal
  assert.ok(animJs.includes("enhanceRelicModal"), "enhanceRelicModal must be defined");
  assert.ok(animJs.includes("openEmporioSubItemModal"), "openEmporioSubItemModal must be defined");
  assert.ok(appJs.includes("enhanceRelicModal(back, type, data)"), "openDetailModal must invoke enhanceRelicModal");

  // Incantesimi Aggiuntivi Grimoire Modal
  assert.ok(animJs.includes("enhanceSpellModal"), "enhanceSpellModal must be defined");
  assert.ok(animCss.includes("@keyframes siumGrimoireUnfold3D"), "Grimoire 3D unfold animation must exist");
  assert.ok(appJs.includes("enhanceSpellModal(overlay, panel, s)"), "_openIncantesimoDetail must invoke enhanceSpellModal");
});

test("4. Dice element identifiers use cryptographically secure randomness", () => {
  for (const path of ["js/animations.js", "public/js/animations.js"]) {
    const animJs = fs.readFileSync(path, "utf8");
    assert.ok(
      animJs.includes('window.crypto.getRandomValues(new Uint32Array(1))[0]'),
      `${path} must use crypto.getRandomValues for dice identifiers`,
    );
    assert.ok(
      !animJs.includes('var uid = "dg_" + faces + "_" + Math.floor(Math.random()'),
      `${path} must not use Math.random for dice identifiers`,
    );
  }
});

test("5. Scene image previews validate user-provided URLs", () => {
  for (const path of ["js/app.js", "public/js/app.js"]) {
    const appCode = fs.readFileSync(path, "utf8");
    assert.ok(appCode.includes("function getSafeSceneImageUrl(value)"), `${path} must validate scene image URLs`);
    assert.ok(appCode.includes("parsed.protocol === 'http:' || parsed.protocol === 'https:'"), `${path} must reject unsafe URL protocols`);
    assert.ok(appCode.includes("var safeUrl = getSafeSceneImageUrl(this.value)"), `${path} must sanitize URL input before previewing`);
    assert.ok(appCode.includes("var val = getSafeSceneImageUrl(urlInp.value)"), `${path} must sanitize URL input before saving`);
  }
});
