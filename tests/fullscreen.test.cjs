const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../dmm-games-fullscreen.user.js'), 'utf8');
function setup(href = 'https://games.dmm.com/example') {
  const nodes = new Map();
  const events = {};
  const pending = [];
  let mutation;
  let mounts = 0;
  const element = () => ({ style: { setProperty(k, v) { this[k] = v; }, getPropertyValue(k) { return this[k] || ''; }, getPropertyPriority() { return ''; }, removeProperty(k) { delete this[k]; } }, isConnected: true, addEventListener() {} });
  const document = {
    documentElement: {}, body: { appendChild(node) { nodes.set(node.id, node); mounts++; } },
    getElementById: (id) => nodes.get(id), addEventListener: (name, cb) => { events[name] = cb; },
    createElement() { const node = element(); node.attachShadow = () => ({ innerHTML: '', querySelector: () => element() }); return node; }
  };
  const window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2, addEventListener: (name, cb) => { events[name] = cb; } };
  const context = vm.createContext({ document, window, location: { href }, URL, requestAnimationFrame: (cb) => { pending.push(cb); return pending.length; }, cancelAnimationFrame() {}, MutationObserver: class { constructor(cb) { mutation = cb; } observe() {} disconnect() {} } });
  vm.runInContext(source, context);
  const flush = () => { while (pending.length) pending.shift()(); };
  return { document, nodes, events, window, element, flush, mutate: () => mutation(), mounts: () => mounts };
}
test('late game discovery mounts once and height-only resize works', () => {
  const app = setup(); app.flush(); assert.equal(app.mounts(), 0);
  const canvas = app.element(); app.nodes.set('unity-canvas', canvas);
  app.mutate(); app.flush(); assert.equal(app.mounts(), 1);
  assert.equal(canvas.style.height, '720px');
  app.window.innerHeight = 600; app.events.resize(); app.flush();
  assert.equal(canvas.style.height, '600px');
  app.mutate(); app.flush(); assert.equal(app.mounts(), 1);
});
test('partial Cocos DOM is safe; unchanged Deep One buffer is not rewritten', () => {
  const app = setup('https://www.deepone-online.com/');
  app.nodes.set('GameDiv', app.element()); app.nodes.set('Cocos2dGameContainer', app.element());
  app.flush();
  const canvas = app.element(); let writes = 0; let width; let height;
  Object.defineProperties(canvas, { width: { get: () => width, set: (v) => { width = v; writes++; } }, height: { get: () => height, set: (v) => { height = v; writes++; } } });
  app.nodes.set('GameCanvas', canvas); app.mutate(); app.flush();
  assert.equal(width, 2560); assert.equal(height, 1440); assert.equal(writes, 2);
  app.events.resize(); app.flush(); assert.equal(writes, 2);
});
test('iframe fullscreen styles are restored on exit', () => {
  const app = setup(); const target = app.element(); target.style.width = '960px';
  app.nodes.set('game_frame', target); app.flush();
  app.document.fullscreenElement = target; app.events.fullscreenchange(); app.flush();
  assert.equal(target.style.width, '100vw');
  app.document.fullscreenElement = null; app.events.fullscreenchange(); app.flush();
  assert.equal(target.style.width, '960px');
  assert.equal(target.style.height, undefined);
});

