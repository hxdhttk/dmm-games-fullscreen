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
      addEventListener: (name, cb) => { listeners[name] = cb; }, removeEventListener: (name) => { delete listeners[name]; }, matches: () => false, blur() {},
      appendChild(node) { this.children.push(node); node.parentElement = this; nodes.set(node.id, node); if (node.id === 'dmm-fullscreen-control') mounts++; },
      attachShadow() { const button = element('BUTTON'), status = element(); return this.shadow = { innerHTML: '', querySelector: (q) => q === 'button' ? button : status }; }
    };
  };
  const body = element('BODY');
  const document = { fullscreenEnabled: enabled, documentElement: { clientWidth: 1400, appendChild(node) { nodes.set(node.id, node); if (node.id === 'dmm-fullscreen-control') mounts++; } }, body,
    getElementById: (id) => nodes.get(id), querySelectorAll: () => [...nodes.values()].filter((node) => node.tagName === 'IFRAME'),
    addEventListener: (name, cb) => { events[name] = cb; }, createElement: (tag) => element(tag.toUpperCase()) };
  const window = { innerWidth: 1280, innerHeight: 800, scrollX: 0, scrollY: 0, parent: { postMessage() {} }, addEventListener: (name, cb) => { events[name] = cb; }, removeEventListener() {} };
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

test('Mist Cocos mouse/touch mapping matches rendering at multiple points, DPI values and viewport offsets', () => {
  for (const dpr of [1,1.25,1.875,2]) {
    const app=setup({href:'https://assets4.mist-train-girls.com/production-client-web/307/index.html?platform=dmm',embedded:true});
    app.window.innerWidth=2560;app.window.innerHeight=1600;
    const root=app.add('GameDiv','DIV'),canvas=app.add('GameCanvas','CANVAS',root);
    canvas.width=2130;canvas.height=1200;
    const rect={left:30,top:50,width:2560,height:1440};
    canvas.getBoundingClientRect=()=>rect;
    const position={left:0,top:0,width:1136,height:640};
    const manager={_updateCanvasBoundingRect:()=>Object.assign(position,rect)};
    // These are the formulas in Mist's public Cocos 2.3.2 client, not the
    // browser fixture's already-correct canvas.width / rect.width handler.
    const view={_devicePixelRatio:dpr,_viewportRect:{x:20,y:40},_scaleX:1.5,_scaleY:2,
      getFrameSize:()=>({width:1136,height:640}),setFrameSize(){},getDevicePixelRatio(){return this._devicePixelRatio;},
      convertToLocationInView(x,y,p,out={}){const left=p.adjustedLeft?p.adjustedLeft:p.left,top=p.adjustedTop?p.adjustedTop:p.top;out.x=this._devicePixelRatio*(x-left);out.y=this._devicePixelRatio*(top+p.height-y);return out;},
      _convertMouseToLocationInView(point,p){point.x=(this._devicePixelRatio*(point.x-p.left)-this._viewportRect.x)/this._scaleX;point.y=(this._devicePixelRatio*(p.top+p.height-point.y)-this._viewportRect.y)/this._scaleY;}
    };
    const originalMouse=view._convertMouseToLocationInView,originalTouch=view.convertToLocationInView;
    app.window.cc={game:{canvas},view,internal:{inputManager:manager}};
    const message=active=>{app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active}});app.flush();};
    manager._updateCanvasBoundingRect();
    const oldPoint={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    originalMouse.call(view,oldPoint,position);
    const oldRenderedX=rect.left+(oldPoint.x*view._scaleX+view._viewportRect.x)/canvas.width*rect.width;
    assert.ok(Math.abs(oldRenderedX-(rect.left+rect.width/2))>1,'fixture must reproduce a scale error before correction');
    message(true);
    for(const [fx,fy] of [[0,0],[0.1,0.1],[0.5,0.5],[0.9,0.9],[1,1]]){
      const x=rect.left+fx*rect.width,y=rect.top+fy*rect.height;
      const mouse={x,y};view._convertMouseToLocationInView(mouse,position);
      const renderedX=rect.left+(mouse.x*view._scaleX+view._viewportRect.x)/canvas.width*rect.width;
      const renderedY=rect.top+rect.height-(mouse.y*view._scaleY+view._viewportRect.y)/canvas.height*rect.height;
      assert.ok(Math.abs(renderedX-x)<1e-8);assert.ok(Math.abs(renderedY-y)<1e-8);
      const out={};assert.equal(view.convertToLocationInView(x,y,position,out),out);
      assert.ok(Math.abs(out.x-fx*canvas.width)<1e-8);assert.ok(Math.abs(out.y-(1-fy)*canvas.height)<1e-8);
    }
    app.window.scrollX=100;app.window.scrollY=200;
    position.adjustedLeft=30;position.adjustedTop=50;
    const touch=view.convertToLocationInView(1310,770,position);
    assert.equal(touch.x,1065);assert.equal(touch.y,600);
    message(false);
    assert.equal(view._convertMouseToLocationInView,originalMouse);assert.equal(view.convertToLocationInView,originalTouch);
  }
});

test('Mist DOM TapEffect and MouseHelper offsets map CSS pixels to game units without changing other events', () => {
  const app=setup({href:'https://assets4.mist-train-girls.com/production-client-web/307/index.html',embedded:true});
  const root=app.add('GameDiv','DIV'),canvas=app.add('GameCanvas','CANVAS',root);
  canvas.width=2130;canvas.height=1200;
  canvas.getBoundingClientRect=()=>({left:20,top:30,width:2560,height:1440});
  app.window.cc={view:{getDesignResolutionSize:()=>({width:1136,height:640}),getViewportRect:()=>({x:0,y:0}),getScaleX:()=>2130/1136,getScaleY:()=>1200/640}};
  let ripple,mouse;const tap=function(e){assert.equal(this,canvas);ripple=[e.offsetX-568,320-e.offsetY];e.preventDefault();return false;};
  const move=e=>{mouse=[e.offsetX-568,320-e.offsetY];};
  canvas.onclick=tap;canvas.onmousemove=move;
  const message=active=>{app.events.message({source:app.window.parent,data:{type:'dmm-fullscreen-layout-v1',active}});app.flush();};
  message(true);
  for(const [fx,fy] of [[0,0],[0.25,0.25],[0.5,0.5],[0.9,0.9],[1,1]]){
    const event={clientX:20+fx*2560,clientY:30+fy*1440,offsetX:fx*2560,offsetY:fy*1440,preventDefault(){assert.equal(this,event);}};
    canvas.listeners.click();assert.equal(canvas.onclick(event),false);
    assert.ok(Math.abs(ripple[0]-(fx*1136-568))<1e-8);assert.ok(Math.abs(ripple[1]-(320-fy*640))<1e-8);
    assert.equal(event.offsetX,fx*2560);assert.equal(event.offsetY,fy*1440);
    canvas.listeners.mousemove();canvas.onmousemove(event);assert.deepEqual(mouse,ripple);
  }
  // A scene can replace onclick after the fullscreen session has started.
  const replacement=e=>{ripple=[e.offsetX,e.offsetY];};canvas.onclick=replacement;
  canvas.listeners.click();canvas.onclick({clientX:1300,clientY:750,offsetX:1280,offsetY:720});
  assert.deepEqual(ripple,[568,320]);
  message(false);assert.equal(canvas.onclick,replacement);assert.equal(canvas.onmousemove,move);
});
