import { readAppSource } from '../scripts/app-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = readAppSource();
const route = source.match(/function renderActiveSection\(\) \{[\s\S]*?\n\}/)[0];
const names = [
  'Dashboard',
  'Commerce',
  'Emporio',
  'Iniziativa',
  'Note',
  'Caos',
  'Generatore',
  'Dadi',
  'Mappa',
  'Bestiario',
  'IncantesimiAggiuntivi',
  'Worldbuilding',
  'Bacheca',
  'Storia',
  'Archivio',
  'SchedePG',
  'Libri',
  'Tavolo',
];
function context(dm) {
  const ctx = {
    state: {},
    isDM: () => dm,
    document: {
      createDocumentFragment: () => ({ kind: 'empty' }),
      createElement: () => ({ style: {} }),
    },
    _buildSchedaWithLavagna: () => ({ kind: 'sheet' }),
  };
  for (const name of names) ctx['render' + name] = () => ({ kind: name, style: {} });
  vm.createContext(ctx);
  vm.runInContext(route, ctx);
  return ctx;
}

test('players cannot render master sections; sheet view and shared sections retain their routes', () => {
  const player = context(false),
    dm = context(true);
  for (const section of ['dashboard', 'worldbuilding', 'storia', 'archivio', 'schedepg']) {
    player.state.section = section;
    assert.equal(player.renderActiveSection().kind, 'Dadi');
    dm.state.section = section;
    assert.notEqual(dm.renderActiveSection().kind, 'Dadi');
  }
  for (const [section, expected] of [
    ['emporio', 'Emporio'],
    ['libri', 'Libri'],
    ['scheda', 'sheet'],
    ['bestiario', 'Bestiario'],
  ]) {
    player.state.section = section;
    assert.equal(player.renderActiveSection().kind, expected);
  }
  dm.state = { section: 'schedepg', schedePGViewMode: true };
  assert.equal(dm.renderActiveSection().kind, 'sheet');
  player.state.section = 'tavolo';
  assert.equal(player.renderActiveSection().style.height, 'calc(100vh - 120px)');
});

test('story rendering errors become text while other failures remain visible to the caller', () => {
  const ctx = context(true);
  ctx.state.section = 'storia';
  ctx.renderStoria = () => {
    throw new Error('<img src=x onerror=alert(1)>');
  };
  const error = ctx.renderActiveSection();
  assert.match(error.textContent, /<img/);
  assert.equal(error.innerHTML, undefined);
  ctx.state.section = 'emporio';
  ctx.renderEmporio = () => {
    throw new Error('catalog failed');
  };
  assert.throws(() => ctx.renderActiveSection(), /catalog failed/);
});
