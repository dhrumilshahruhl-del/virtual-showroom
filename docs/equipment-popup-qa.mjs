import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const pages = await (await fetch('http://localhost:9224/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), errors = [], rows = [], cityRequests = [];
socket.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
  else if (m.method === 'Fetch.requestPaused') cityRequests.push(m.params.requestId);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const assert = (v, m) => { if (!v) throw new Error(m); };
async function settle() {
  for (let i = 0; i < 200; i++) {
    if (await evaluate(`window.qaApp && !qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null`)) { await wait(600); return; }
    await wait(100);
  }
  throw new Error('Flow did not settle');
}
async function capture(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(os.tmpdir(), `equipment-${name}.png`), Buffer.from(r.data, 'base64'));
}
try {
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  for (let i = 0; i < 160; i++) { if (await evaluate(`!!document.querySelector('.flow-launch')`)) break; await wait(500); }
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom})()`);
  await evaluate(`window.qaBuildingMaterials=[];qaApp.scene.getObjectByName('rooftopMarkers').parent.traverse(n=>{if(n.material)qaBuildingMaterials.push({node:n,material:n.material})});window.qaOriginalCamera=qaApp.camera.position.toArray()`);
  await evaluate(`document.querySelector('.flow-launch').click()`);
  await settle();
  // Warm every animation and allow optional city resources to finish uploading.
  for (let step = 0; step < 6; step++) {
    await evaluate(`document.querySelector('[data-step="${step}"]').click()`);
    await settle();
    await wait(400);
    assert(await evaluate(`(()=>{const expected=${step}===2?['exhaust-left','exhaust-right']:${step}===3?['fresh-left','fresh-right']:[];return JSON.stringify(qaApp.systemFlow.airflow.filter(p=>p.visible).map(p=>p.id))===JSON.stringify(expected)})()`), 'Smoke isolation at '+step);
    assert(await evaluate(`qaApp.scene.getObjectByName('heatPumpEnclosureWall').material.depthWrite === ${![1,4].includes(step)}`), 'Wall reveal at '+step);
    assert(await evaluate(`document.querySelector('.flow-impact').hidden === ${![0,1,2].includes(step)}`), 'Impact mapping at '+step);
  }
  await wait(3000);
  // Warm the restored default view too: city geometry can first upload there
  // after being culled in the guided cameras, without representing a leak.
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  await settle();
  await evaluate(`document.querySelector('.flow-launch').click()`);
  await settle();
  const memory = await evaluate(`({...qaApp.renderer.info.memory})`);
  const widthFlag = process.argv.find(arg => arg.startsWith('--width='));
  for (const width of process.argv.includes('--lifecycle-only') ? [] : widthFlag ? [Number(widthFlag.split('=')[1])] : [1440, 1280, 1024, 768, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await wait(600);
    const stepFlag = process.argv.find(arg => arg.startsWith('--step='));
    for (const step of stepFlag ? stepFlag.split('=')[1].split(',').map(Number) : [0,1,2,3,4,5]) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`);
      await settle();
      const state = await evaluate(`(()=>{const p=document.querySelector('.flow-equipment'),r=p.getBoundingClientRect();return {step:qaApp.systemFlow.state.step,hidden:p.hidden,equipment:p.dataset.equipment,anchor:p.dataset.anchor,compact:p.classList.contains('is-compact'),rect:{x:r.x,y:r.y,width:r.width,height:r.height},images:[...p.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),overlap:[...document.querySelectorAll('.flow-panel,.flow-impact,.showroom__toolbar')].filter(n=>!n.hidden).some(n=>{const b=n.getBoundingClientRect();return r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top})}})()`);
      rows.push({ width, ...state });
      assert(state.step === step && state.equipment === (step === 0 ? '' : step === 4 ? 'heat-pump' : 'ahu') && state.images, 'Wrong equipment/image');
      const connections = await evaluate(`(()=>{const r=document.querySelector('.flow-equipment').getBoundingClientRect();return [...document.querySelectorAll('.flow-equipment-leader')].filter(l=>!l.hidden).map(l=>{const m=new DOMMatrix(getComputedStyle(l).transform),w=parseFloat(l.style.width),x=parseFloat(l.style.left)+w*m.a,y=parseFloat(l.style.top)+w*m.b;return {anchor:l.dataset.anchor,reaches:x>=r.left-1&&x<=r.right+1&&y>=r.top-1&&y<=r.bottom+1}})})()`);
      const expectedAnchors = step === 0 ? [] : step === 4 ? ['central-structure','heat-pump-2'] : [1,2].includes(step) ? ['left-equipment','right-equipment'] : ['upper-unit-1','upper-unit-2'];
      assert(JSON.stringify(connections.map(c=>c.anchor))===JSON.stringify(expectedAnchors)&&connections.every(c=>c.reaches), 'Both markers must connect to the shared label: '+JSON.stringify(connections));
      assert(await evaluate(`document.querySelectorAll('.flow-equipment').length===1&&document.querySelectorAll('.flow-equipment figure').length===${step===0?0:1}`),'Wrong label count');
      await capture(`${width}-${step}`);
      assert(step===0 ? state.hidden : !state.hidden && !state.overlap, 'Incorrect popup visibility or overlapping UI: ' + JSON.stringify(rows.at(-1)));
    }
  }
  await evaluate(`document.querySelector('[data-step="1"]').click()`);
  await settle();
  await evaluate(`document.querySelector('[data-flow="pause"]').click()`);
  assert(await evaluate(`!document.querySelector('.flow-equipment').hidden`), 'Pause hid popup');
  await evaluate(`document.querySelector('[data-flow="pause"]').click(); document.querySelector('[data-flow="restart"]').click()`);
  await settle();
  await evaluate(`['next','next','previous','next','previous'].forEach(a=>document.querySelector('[data-flow="'+a+'"]').click())`);
  await settle();
  assert(await evaluate(`qaApp.systemFlow.state.step===1 && document.querySelectorAll('.flow-equipment').length===1 && document.querySelector('.flow-equipment').dataset.equipment==='ahu'`), 'Rapid navigation stale');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  assert(await evaluate(`document.querySelector('.flow-equipment').hidden`), 'Exit left popup');
  assert(await evaluate(`[...document.querySelectorAll('.flow-equipment-leader')].every(l=>l.hidden)`),'Exit left connector');
  await settle();
  assert(await evaluate(`qaBuildingMaterials.every(e=>e.node.material===e.material)&&qaApp.camera.position.distanceTo({x:qaOriginalCamera[0],y:qaOriginalCamera[1],z:qaOriginalCamera[2]})<0.00001&&qaApp.scene.getObjectByName('rooftopMarkers').visible`), 'Exit restoration');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate(`document.querySelector('.flow-launch').click()`);
  await settle();
  assert(await evaluate(`qaApp.systemFlow.state.step===0 && document.querySelector('.flow-equipment').hidden && [...document.querySelectorAll('.flow-equipment-leader')].every(l=>l.hidden)`), 'Reentry retained step 1 marking');
  const finalMemory = await evaluate(`({...qaApp.renderer.info.memory})`);
  assert(finalMemory.textures <= memory.textures && finalMemory.geometries <= memory.geometries, 'WebGL resource growth: ' + JSON.stringify({memory,finalMemory}));
  for (const mode of ['late', 'failure']) {
    cityRequests.length = 0;
    await send('Fetch.enable', {patterns:[{urlPattern:'*assets/city-context/*.gltf',requestStage:'Request'}]});
    await send('Page.navigate', {url:'http://localhost:4173/'});
    for(let i=0;i<160;i++) {if(await evaluate(`!!document.querySelector('.flow-launch')`))break;await wait(250);}
    await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom;document.querySelector('.flow-launch').click()})()`);
    await settle();
    assert(cityRequests.length===3 && await evaluate(`!qaApp.scene.getObjectByName('cityContext') && qaApp.systemFlow.active && document.querySelector('.flow-equipment').hidden`), 'Flow blocked by pending city');
    for(const requestId of cityRequests) await send(mode==='late'?'Fetch.continueRequest':'Fetch.failRequest', mode==='late'?{requestId}:{requestId,errorReason:'Failed'});
    await send('Fetch.disable');
    if(mode==='late') {
      for(let i=0;i<120;i++) {if(await evaluate(`!!qaApp.scene.getObjectByName('cityContext')`))break;await wait(250);}
      assert(await evaluate(`!!qaApp.scene.getObjectByName('cityContext')`),'Late city failed');
    }
    for(let step=0;step<6;step++) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`);await settle();
      assert(await evaluate(`document.querySelector('.flow-equipment').hidden===${step===0} && document.querySelector('.flow-equipment').dataset.equipment==='${step===0?'':step===4?'heat-pump':'ahu'}'`),mode+' city popup at '+step);
    }
    await evaluate(`document.querySelector('[data-flow="next"]').click()`);await settle();
    assert(await evaluate(`!qaApp.systemFlow.active&&document.querySelector('.flow-equipment').hidden&&document.querySelector('.flow-impact').hidden`),'Finish cleanup');
    console.log('City '+mode+': passed six steps and finish');
  }
  assert(errors.length === 0, 'Runtime errors');
  console.log(JSON.stringify({ rows, memory, finalMemory, errors }, null, 2));
  await fs.writeFile(path.join(os.tmpdir(), 'equipment-popup-qa.json'), JSON.stringify({rows,memory,finalMemory,errors},null,2));
} finally { console.log('Placement results:', JSON.stringify(rows)); socket.close(); }
