const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../dmm-games-fullscreen.user.js'), 'utf8');
function setup({ href = 'https://play.games.dmm.co.jp/game/MistTrainGirlsX', embedded = false, enabled = true } = {}) {
  const nodes = new Map(), events = {}, pending = [];
  let mutation, mounts = 0;
  const element = (tagName = 'DIV', id = '') => {
    const listeners = {}, attributes = {}, priorities = {};
    return { tagName, id, children: [], listeners, isConnected: true,
      contains(node) { return node === this || this.children.some((child) => child.contains(node)); },
      style: { setProperty(k, v, p = '') { this[k] = v; priorities[k] = p; }, getPropertyValue(k) { return this[k] || ''; }, getPropertyPriority(k) { return priorities[k] || ''; }, removeProperty(k) { delete this[k]; delete priorities[k]; } },
      getAttribute: (k) => attributes[k] || null, setAttribute(k, v) { attributes[k] = v; },
      getBoundingClientRect: () => ({ left: 20, top: 80, right: 1300, bottom: 800, width: 1280, height: 720 }),
      addEventListener: (name, cb) => { listeners[name] = cb; }, matches: () => false, blur() {},
      appendChild(node) { this.children.push(node); node.parentElement = this; nodes.set(node.id, node); if (node.id === 'dmm-fullscreen-control') mounts++; },
      attachShadow() { const button = element('BUTTON'), status = element(); return this.shadow = { innerHTML: '', querySelector: (q) => q === 'button' ? button : status }; }
    };
  };
  const body = element('BODY');
  const document = { fullscreenEnabled: enabled, documentElement: { clientWidth: 1400, appendChild(node) { nodes.set(node.id, node); if (node.id === 'dmm-fullscreen-control') mounts++; } }, body,
    getElementById: (id) => nodes.get(id), querySelectorAll: () => [...nodes.values()].filter((node) => node.tagName === 'IFRAME'),
    addEventListener: (name, cb) => { events[name] = cb; }, createElement: (tag) => element(tag.toUpperCase()) };
  const window = { innerWidth: 1280, innerHeight: 800, scrollX: 0, scrollY: 0, parent: { postMessage() {} }, addEventListener: (name, cb) => { events[name] = cb; } };
  window.top = embedded ? {} : window;
  const context = vm.createContext({ document, window, location: { href }, URL,
    requestAnimationFrame: (cb) => { pending.push(cb); return pending.length; }, cancelAnimationFrame() {},
    MutationObserver: class { constructor(cb) { mutation = cb; } observe() {} disconnect() {} } });
  vm.runInContext(source, context);
  const flush = () => { while (pending.length) pending.shift()(); };
  const add = (id, tag = 'IFRAME', parent = body) => { const node = element(tag, id); parent.appendChild(node); return node; };
  const click = async () => { await nodes.get('dmm-fullscreen-control').shadow.querySelector('button').listeners.click(); flush(); };
  const enter = (stage = body) => { stage.requestFullscreen = async () => { document.fullscreenElement = stage; events.fullscreenchange(); }; };
  return { document, nodes, events, window, element, body, flush, add, click, enter, mutate: () => mutation(), mounts: () => mounts };
}
test('small control prefers outside space, stays in viewport and never occupies normal flow', () => {
  const app = setup(); app.flush(); assert.equal(app.mounts(), 0);
  const game = app.add('game_frame'); app.mutate(); app.flush();
  const host = app.nodes.get('dmm-fullscreen-control');
  assert.match(host.style.cssText, /position:fixed/); assert.match(host.style.cssText, /width:19px/);
  assert.equal(host.style.left, '1304px'); assert.equal(host.style.top, '80px');
  assert.equal(game.style.width, undefined);
  app.mutate(); app.flush(); assert.equal(app.mounts(), 1);
  app.document.documentElement.clientWidth = 1300; app.events.resize(); app.flush();
  assert.equal(host.style.top, '57px');
});
test('Mist gets a real 16:9 iframe viewport on a 16:10 screen; banner and original styles restore', async () => {
  const app = setup(); const game = app.add('game_frame'); const banner = app.add('banner', 'DIV');
  game.style.setProperty('width', '960px', 'important'); banner.style.setProperty('display', 'flex', 'important');
  app.enter(); app.flush(); await app.click();
  assert.equal(app.document.fullscreenElement, app.body);
  assert.equal(game.style.width, '1280px'); assert.equal(game.style.height, '720px');
  assert.equal(game.style.top, '40px'); assert.equal(banner.style.display, 'none');
  assert.equal(game.parentElement, app.body); // iframe was never reparented/reloaded
  app.window.innerWidth = 1920; app.window.innerHeight = 1200; app.events.resize(); app.flush();
  assert.equal(game.style.height, '1080px'); assert.equal(game.style.top, '60px');
  app.document.fullscreenElement = null; app.events.fullscreenchange(); app.flush();
  assert.equal(game.style.width, '960px'); assert.equal(game.style.getPropertyPriority('width'), 'important');
  assert.equal(game.style.height, undefined); assert.equal(banner.style.display, 'flex');
  assert.equal(banner.style.getPropertyPriority('display'), 'important');
});
test('Deep One only intermediate game-iframe owns a button; renderer and outer banner page do not', async () => {
  const outer = setup({ href: 'https://play.games.dmm.co.jp/game/deeponer' });
  outer.add('game_frame'); outer.flush(); assert.equal(outer.mounts(), 0);
  const renderer = setup({ href: 'https://www.deepone-online.com/', embedded: true });
  const canvas = renderer.add('GameCanvas', 'CANVAS'); renderer.add('GameDiv', 'DIV'); renderer.flush();
  assert.equal(renderer.mounts(), 0); assert.equal(canvas.width, undefined); assert.equal(canvas.style.height, undefined);
  const middle = setup({ href: 'https://www.dmm.co.jp/game/deeponer', embedded: true });
  middle.add('game-iframe'); middle.enter(); middle.flush(); assert.equal(middle.mounts(), 1);
  await middle.click(); assert.equal(middle.document.fullscreenElement, middle.body);
});
test('denied permission offers no unusable control; rejected fullscreen leaves layout untouched', async () => {
  const denied = setup({ enabled: false }); denied.add('game-iframe'); denied.flush(); assert.equal(denied.mounts(), 0);
  const app = setup(); const game = app.add('game_frame'); app.body.requestFullscreen = async () => { throw new Error('Denied'); };
  app.flush(); await app.click(); assert.equal(game.style.width, undefined); assert.equal(app.body.style.width, undefined);
  assert.match(app.nodes.get('dmm-fullscreen-control').shadow.querySelector('.status').textContent, /Denied/);
});
test('child ownership suppresses ancestor button and ignores messages from unknown windows', () => {
  const app = setup(); const child = app.add('game_frame'); child.contentWindow = { postMessage() {} };
  app.flush(); const host = app.nodes.get('dmm-fullscreen-control');
  app.events.message({ data: { type: 'dmm-fullscreen-owner-v1', owns: true }, source: {} }); app.flush();
  assert.equal(host.style.display, 'block');
  app.events.message({ data: { type: 'dmm-fullscreen-owner-v1', owns: true }, source: child.contentWindow }); app.flush();
  assert.equal(host.style.display, 'none');
});


test('embedded edge-to-edge game keeps trigger inside iframe viewport', () => {
  const app = setup({ href: 'https://www.dmm.co.jp/game/deeponer', embedded: true });
  app.document.documentElement.clientWidth = 1280;
  const game = app.add('game-iframe');
  game.getBoundingClientRect = () => ({left:0,top:0,right:1280,bottom:800,width:1280,height:800});
  app.flush(); const host = app.nodes.get('dmm-fullscreen-control');
  assert.equal(host.style.left, '1257px'); assert.equal(host.style.top, '4px');
  assert.equal(host.getAttribute('popover'), 'manual');
  app.window.scrollY = 1000; app.events.scroll(); app.flush();
  assert.equal(host.style.top, '4px');
});

test('parent fullscreen layout resizes Cocos through its view API and restores it on exit', () => {
  const app = setup({href:'https://www.deepone-online.com/',embedded:true});
  const root=app.add('GameDiv','DIV'); const canvas=app.add('GameCanvas','CANVAS',root);
  const banner=app.add('banner','DIV'); root.style.setProperty('width','640px');
  const calls=[];
  app.window.cc={view:{getFrameSize:()=>({width:640,height:360}),setFrameSize:(w,h)=>calls.push([w,h])}};
  app.events.message({source:{},data:{type:'dmm-fullscreen-layout-v1',active:true}});app.flush();
  assert.equal(root.style.width,'640px'); assert.equal(calls.length,0);
  app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active:true}});app.flush();
  assert.equal(root.style.width,'1280px');assert.equal(root.style.height,'720px');assert.equal(root.style.top,'40px');
  assert.equal(banner.style.display,'none');assert.equal(canvas.style.width,'100%');assert.deepEqual(calls,[[1280,720]]);
  app.events.resize();app.flush();assert.equal(calls.length,1);
  app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active:false}});app.flush();
  assert.deepEqual(calls,[[1280,720],[640,360]]);assert.equal(root.style.width,'640px');assert.equal(canvas.style.width,undefined);assert.equal(banner.style.display,undefined);
});

test('Mist intermediate frm1 relays layout and late readiness without a second button', () => {
  const app=setup({href:'https://www.dmm.co.jp/game/MistTrainGirlsX',embedded:true});
  const child=app.add('frm1');const messages=[];
  child.contentWindow={postMessage:(data)=>messages.push(data)};
  child.setAttribute('src','https://assets4.mist-train-girls.com/production-client-web/307/index.html?platform=dmm');
  app.flush();assert.equal(app.mounts(),0);assert.equal(child.allowFullscreen,true);
  app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active:true}});app.flush();
  assert.equal(child.style.width,'1280px');assert.equal(child.style.height,'720px');
  assert.ok(messages.some(m=>m.type==='dmm-fullscreen-layout-v1'&&m.active));
  messages.length=0;
  app.events.message({source:child.contentWindow,data:{type:'dmm-fullscreen-ready-v1'}});
  assert.equal(messages.length,1);assert.equal(messages[0].type,'dmm-fullscreen-layout-v1');assert.equal(messages[0].active,true);
  app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active:false}});app.flush();
  assert.equal(child.style.width,undefined);
  assert.ok(messages.some(m=>m.type==='dmm-fullscreen-layout-v1'&&!m.active));
});
