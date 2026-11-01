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
      if (req.url === '/mist-client') res.end(`<body style="margin:0"><div id="GameDiv" style="width:1136px;height:640px"><div id="Cocos2dGameContainer" style="transform:rotate(0deg);width:1136px;height:640px;margin:0;padding:0"><canvas id="GameCanvas" width="2130" height="1200" style="width:1136px;height:640px"></canvas></div></div><script>
        const canvas=document.getElementById('GameCanvas');
        // Reproduce the public TapEffect and desktop MouseHelper callbacks.
        window.cc={view:{getDesignResolutionSize:()=>({width:1136,height:640})}};
        const effect=document.createElement('div');effect.id='tap-ripple';effect.style.cssText='position:fixed;width:1px;height:1px;pointer-events:none';document.getElementById('GameDiv').appendChild(effect);
        const assignTap=()=>{window.gameTapHandler=function(event){const x=event.offsetX-568,y=320-event.offsetY;const rect=canvas.getBoundingClientRect();canvas.dataset.ripple=JSON.stringify([x,y]);effect.style.left=(rect.left+(x+568)/1136*rect.width)+'px';effect.style.top=(rect.top+(320-y)/640*rect.height)+'px';canvas.dataset.trusted=String(event.isTrusted);};canvas.onclick=window.gameTapHandler;};assignTap();
        canvas.onmousemove=event=>{canvas.dataset.mouse=JSON.stringify([event.offsetX-568,320-event.offsetY]);};
        canvas.addEventListener('click',event=>{canvas.dataset.rawOffset=JSON.stringify([event.offsetX,event.offsetY]);});
        canvas.addEventListener('pointerdown',event=>{const r=canvas.getBoundingClientRect();canvas.dataset.hit=JSON.stringify([(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height]);});
        addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='test-snapshot')return;if(event.data.action==='replace-click')assignTap();const c=document.getElementById('GameCanvas'),r=c.getBoundingClientRect(),root=document.getElementById('GameDiv').getBoundingClientRect();parent.postMessage({type:'test-snapshot-result',token:event.data.token,snapshot:{canvas:[r.x,r.y,r.width,r.height],root:[root.width,root.height],backing:[c.width,c.height],viewport:[innerWidth,innerHeight],hit:c.dataset.hit,ripple:c.dataset.ripple,mouse:c.dataset.mouse,rawOffset:c.dataset.rawOffset,trusted:c.dataset.trusted,effect:[effect.getBoundingClientRect().x,effect.getBoundingClientRect().y],restored:c.onclick===window.gameTapHandler}},'*');});
        </script><script>${script}</script>`);
      else if (req.url === '/mist-wrapper') res.end(`<body style="margin:10px;padding:10px"><iframe id="frm1" style="border:0" width="1252" height="740" scrolling="no" allowfullscreen="true" src="http://assets4.mist-train-girls.com:${server.address().port}/mist-client"></iframe><div id="mist-banner">BANNER BELOW FRM1</div><script>addEventListener('message',event=>{const child=document.getElementById('frm1');if(event.source===parent&&event.data?.type==='test-snapshot')child.contentWindow.postMessage(event.data,'*');if(event.source===child.contentWindow&&event.data?.type==='test-snapshot-result')parent.postMessage(event.data,'*');});</script><script>${script}</script>`);
      else if (req.url === '/mist') res.end(`<body style="margin:0"><iframe id="game_frame" src="/mist-wrapper" style="width:1280px;height:720px;border:0"></iframe><script>${script}</script>`);
      else if (req.url === '/child') res.end(`<body style="margin:20px;padding:15px;background:#567"><div id="GameDiv" style="width:640px;height:360px;margin:25px auto;border:4px solid red"><div id="Cocos2dGameContainer" style="width:640px;height:360px"><canvas id="GameCanvas" width="640" height="360" style="width:640px;height:360px"></canvas></div></div><div id="inner-banner">INNER BANNER</div><script>
        const canvas=document.getElementById('GameCanvas');
        canvas.addEventListener('pointerdown',event=>{const r=canvas.getBoundingClientRect();window.lastHit=[(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height]});
        </script><script>${script}</script>`);
      else res.end(`<body style="margin:0"><iframe id="game-iframe" src="/child" style="width:1280px;height:720px"></iframe><div id="banner">BANNER</div><script>${script}</script>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--window-size=1600,1000', '--disable-gpu', '--no-proxy-server', '--host-resolver-rules=MAP assets4.mist-train-girls.com 127.0.0.1', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => socket.addEventListener('open', r, { once: true }));
    let id = 0; const callbacks = new Map();
    socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (callbacks.has(message.id)) { const cb = callbacks.get(message.id); callbacks.delete(message.id); message.error ? cb.reject(message.error) : cb.resolve(message.result); } });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; callbacks.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async (expression, userGesture = false, contextId) => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture, contextId }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, screenWidth:1280, screenHeight:800, deviceScaleFactor: 1, mobile: false });
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
    // Reproduce Mist's extra frm1 layer and fixed 1136x640 CSS, with the game
    // served from another origin. Only postMessage crosses this boundary.
    // Keep the cross-process input test within the headless screen's native
    // interactive bounds; large display scales are covered by the unit test.
    await send('Emulation.setDeviceMetricsOverride',{width:640,height:400,screenWidth:640,screenHeight:400,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/mist`});
    for(let i=0;i<100&&!await evaluate('!!document.getElementById("dmm-fullscreen-control")');i++) await delay(50);
    await evaluate(`window.inspectMist=(action)=>new Promise((resolve,reject)=>{const frame=document.getElementById('game_frame'),token=Math.random();const handler=event=>{if(event.source!==frame.contentWindow||event.data?.type!=='test-snapshot-result'||event.data.token!==token)return;removeEventListener('message',handler);clearTimeout(timeout);resolve(event.data.snapshot);};const timeout=setTimeout(()=>{removeEventListener('message',handler);reject(new Error('Mist snapshot timed out'));},3000);addEventListener('message',handler);frame.contentWindow.postMessage({type:'test-snapshot',token,action},'*');});`);
    // Cross-origin inspection is relayed explicitly by the test fixtures, just
    // like the production layout protocol. No access to child DOM is granted.
    const snapshot=(action)=>evaluate(`window.inspectMist(${JSON.stringify(action)})`);
    const mistBefore=await snapshot();
    assert.deepEqual(mistBefore.root,[1136,640]);
    assert.equal(await evaluate(`document.getElementById('game_frame').contentDocument.getElementById('frm1').contentDocument===null`),true);
    await evaluate('document.getElementById("dmm-fullscreen-control").shadowRoot.querySelector("button").click()',true);
    let mistFull;
    for(let i=0;i<100;i++) { mistFull=await snapshot();if(mistFull.canvas[2]===640&&mistFull.canvas[3]===360) break;await delay(50); }
    assert.deepEqual(mistFull.canvas,[0,0,640,360]);assert.deepEqual(mistFull.root,[640,360]);
    assert.deepEqual(mistFull.backing,[2130,1200]);assert.deepEqual(mistFull.viewport,[640,360]);
    const middle=await evaluate(`(() => {const d=document.getElementById('game_frame').contentDocument,f=d.getElementById('frm1'),r=f.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],banner:getComputedStyle(d.getElementById('mist-banner')).display,controls:d.querySelectorAll('#dmm-fullscreen-control').length};})()`);
    assert.deepEqual(middle.rect,[0,0,640,360]);assert.equal(middle.banner,'none');assert.equal(middle.controls,0);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:160,y:110,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:160,y:110,button:'left',clickCount:1});
    assert.deepEqual(JSON.parse((await snapshot()).hit),[532.5,300]);
    const rippleChecks=[];
    for(const [fx,fy] of [[0.05,0.05],[0.25,0.25],[0.5,0.5],[0.9,0.9]]){
      const x=Math.round(fx*640),localY=Math.round(fy*360),y=localY+20;
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
      let shot;
      for(let i=0;i<50;i++){shot=await snapshot();if(shot.rawOffset===JSON.stringify([x,localY]))break;await delay(20);}
      assert.ok(Math.abs(shot.effect[0]-x)<0.05 && Math.abs(shot.effect[1]-localY)<0.05,JSON.stringify({shot,x,localY}));
      assert.deepEqual(JSON.parse(shot.rawOffset),[x,localY]);assert.equal(shot.trusted,'true');
      assert.deepEqual(JSON.parse(shot.mouse),JSON.parse(shot.ripple));
      rippleChecks.push({click:[x,localY],effect:shot.effect});
    }
    // Assignment after fullscreen entry must be adapted on its first click.
    await snapshot('replace-click');
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:320,y:200,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:320,y:200,button:'left',clickCount:1});
    assert.deepEqual((await snapshot()).effect,[320,180]);

    await evaluate('document.exitFullscreen()');
    let mistAfter;
    for(let i=0;i<100;i++){mistAfter=await snapshot();if(mistAfter.root[0]===1136&&mistAfter.root[1]===640&&mistAfter.viewport[0]===1252&&mistAfter.viewport[1]===740) break;await delay(50);}
    assert.deepEqual(mistAfter.viewport,mistBefore.viewport);assert.equal(mistAfter.restored,true);assert.deepEqual(mistAfter.canvas,mistBefore.canvas);assert.deepEqual(mistAfter.root,mistBefore.root);
    assert.equal(await evaluate(`getComputedStyle(document.getElementById('game_frame').contentDocument.getElementById('mist-banner')).display`),'block');
    console.log(JSON.stringify({mistBefore,mistFull,middle,rippleChecks,mistAfter}));

  } finally {
    socket?.close(); browser?.kill(); server?.close();
    await delay(500);
    const resolved = path.resolve(profile);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('dmm-fullscreen-test-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch {}
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
