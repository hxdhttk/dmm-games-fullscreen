const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const script = fs.readFileSync(path.join(__dirname, '../dmm-games-fullscreen.user.js'), 'utf8');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dmm-fullscreen-test-'));
  let browser, socket, server;
  try {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (req.url === '/child') res.end(`<body style="margin:20px;padding:15px;background:#567"><div id="GameDiv" style="width:640px;height:360px;margin:25px auto;border:4px solid red"><div id="Cocos2dGameContainer" style="width:640px;height:360px"><canvas id="GameCanvas" width="640" height="360" style="width:640px;height:360px"></canvas></div></div><div id="inner-banner">INNER BANNER</div><script>
        const canvas=document.getElementById('GameCanvas');
        canvas.addEventListener('pointerdown',event=>{const r=canvas.getBoundingClientRect();window.lastHit=[(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height]});
        </script><script>${script}</script>`);
      else res.end(`<body style="margin:0"><iframe id="game-iframe" src="/child" style="width:1280px;height:720px"></iframe><div id="banner">BANNER</div><script>${script}</script>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener('open', r, { once: true }));
    let id = 0; const callbacks = new Map();
    socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (callbacks.has(message.id)) { const cb = callbacks.get(message.id); callbacks.delete(message.id); message.error ? cb.reject(message.error) : cb.resolve(message.result); } });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; callbacks.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async (expression, userGesture = false) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    for (let i = 0; i < 50 && !await evaluate('!!document.getElementById("dmm-fullscreen-control")'); i++) await delay(100);
    const trigger = await evaluate(`(() => {
      const cover = document.createElement('div');
      cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:transparent';
      document.body.appendChild(cover);
      const host = document.getElementById('dmm-fullscreen-control');
      const r = host.getBoundingClientRect();
      const result = {topLayer:host.matches(':popover-open'),hit:document.elementFromPoint(r.x+9,r.y+9)===host,x:r.x,y:r.y,width:r.width,height:r.height};
      cover.remove(); return result;
    })()`);
    assert.equal(trigger.topLayer, true); assert.equal(trigger.hit, true);
    assert.equal(trigger.width, 19); assert.equal(trigger.height, 19);
    assert.ok(trigger.x>=0 && trigger.x+19<=1280 && trigger.y>=0 && trigger.y+19<=800);
    const before = await evaluate(`(() => {const f=document.getElementById('game-iframe'),c=f.contentDocument.getElementById('GameCanvas').getBoundingClientRect();return {top:f.getBoundingClientRect().top,height:f.getBoundingClientRect().height,canvas:[c.x,c.y,c.width,c.height]};})()`);
    await evaluate('document.getElementById("dmm-fullscreen-control").shadowRoot.querySelector("button").click()', true);
    await delay(500);
    const full = await evaluate(`(() => { const r=document.getElementById('game-iframe').getBoundingClientRect(); return {full:!!document.fullscreenElement,width:r.width,height:r.height,top:r.top,viewport:[innerWidth,innerHeight],banner:getComputedStyle(document.getElementById('banner')).display,child:[document.getElementById('game-iframe').contentWindow.innerWidth,document.getElementById('game-iframe').contentWindow.innerHeight]}; })()`);
    const inner = await evaluate(`(() => {const f=document.getElementById('game-iframe'),d=f.contentDocument,c=d.getElementById('GameCanvas').getBoundingClientRect();return {canvas:[c.x,c.y,c.width,c.height],banner:getComputedStyle(d.getElementById('inner-banner')).display,backing:[d.getElementById('GameCanvas').width,d.getElementById('GameCanvas').height],scroll:[d.documentElement.scrollWidth,d.documentElement.scrollHeight]};})()`);
    assert.deepEqual(inner.canvas,[0,0,1280,720]); assert.equal(inner.banner,'none'); assert.deepEqual(inner.backing,[640,360]);
    // A real pointer event, routed through the resized iframe and canvas.
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:320,y:220,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:320,y:220,button:'left',clickCount:1});
    const hit=await evaluate(`document.getElementById('game-iframe').contentWindow.lastHit`);
    assert.deepEqual(hit,[160,90]);
    assert.equal(full.full, true); assert.ok(Math.abs(full.width / full.height - 16/9) < 0.001); assert.equal(full.banner, 'none'); assert.ok(Math.abs(full.child[0]/full.child[1]-16/9)<0.001);
    await evaluate('document.exitFullscreen()'); await delay(200);
    const after = await evaluate(`(() => {const f=document.getElementById('game-iframe'),d=f.contentDocument,c=d.getElementById('GameCanvas').getBoundingClientRect();return {top:f.getBoundingClientRect().top,height:f.getBoundingClientRect().height,banner:getComputedStyle(document.getElementById('banner')).display,innerBanner:getComputedStyle(d.getElementById('inner-banner')).display,canvas:[c.x,c.y,c.width,c.height]};})()`);
    assert.deepEqual(before.canvas,after.canvas); assert.notEqual(after.innerBanner,'none');
    assert.equal(before.top, after.top); assert.equal(before.height, after.height); assert.notEqual(after.banner, 'none');
    console.log(JSON.stringify({ trigger, before, fullscreen: full, inner, hit, after }));
  } finally {
    socket?.close(); browser?.kill(); server?.close();
    await delay(500);
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('dmm-fullscreen-test-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
