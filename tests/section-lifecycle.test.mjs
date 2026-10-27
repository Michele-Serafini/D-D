import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function context() {
  const frames = [];
  const ctx = {
    _sectionCleanup: null,
    _tavoloRef: null,
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/ui/shell.js', 'utf8'), ctx);
  return { ctx, frames };
}

test('leaving a section releases its document handlers; an early close also releases them', () => {
  const { ctx } = context();
  const target = new EventTarget();
  let calls = 0;
  ctx.listenInSection(target, 'move', () => calls++);
  target.dispatchEvent(new Event('move'));
  ctx.cleanupActiveSection();
  target.dispatchEvent(new Event('move'));
  assert.equal(calls, 1);
  assert.equal(ctx._sectionDisposers.length, 0);
  const close = ctx.listenInSection(target, 'move', () => calls++);
  close();
  target.dispatchEvent(new Event('move'));
  assert.equal(calls, 1);
  assert.equal(ctx._sectionDisposers.length, 0);
});

test('a burst of realtime updates requests one render per frame', () => {
  const { ctx, frames } = context();
  let renders = 0;
  ctx.renderMain = () => renders++;
  ctx.scheduleRenderMain();
  ctx.scheduleRenderMain();
  ctx.scheduleRenderMain();
  assert.equal(frames.length, 1);
  frames[0]();
  assert.equal(renders, 1);
  ctx.scheduleRenderMain();
  assert.equal(frames.length, 2);
});
