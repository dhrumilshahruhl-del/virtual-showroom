// Integration QA: run against the local server with a dedicated headless
// Chrome session on port 9224. Screenshots go to the OS temporary directory.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const pages = await (await fetch('http://localhost:9224/json')).json();
const socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  if (response.id) {
    const handlers = pending.get(response.id);
    pending.delete(response.id);
    response.error ? handlers.reject(new Error(JSON.stringify(response.error))) : handlers.resolve(response.result);
  } else if (response.method === 'Runtime.exceptionThrown') errors.push(response.params.exceptionDetails);
  else if (response.method === 'Runtime.consoleAPICalled' && response.params.type === 'error') errors.push(response.params.args);
  else if (response.method === 'Log.entryAdded' && response.params.entry.level === 'error' && !response.params.entry.url?.endsWith('/favicon.ico')) errors.push(response.params.entry);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
async function screenshot(name) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`!qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null`)) break;
    if (i === 59) throw new Error('Camera did not settle for ' + name);
    await wait(100);
  }
  await wait(120);
  const result = await send('Page.captureScreenshot', { format: 'png' });
  const filename = path.join(os.tmpdir(), `rooftop-flow-${name}.png`);
  await fs.writeFile(filename, Buffer.from(result.data, 'base64'));
  console.log('Screenshot:', filename);
}
try {
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Runtime.discardConsoleEntries');
  await send('Log.clear');
  errors.length = 0;
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(`document.querySelector('.flow-launch') !== null`)) break;
    if (attempt === 59) throw new Error('Showroom failed to load: ' + JSON.stringify(errors));
    await wait(500);
  }
  await evaluate(`(async () => { window.qaApp = await (await import('/src/main.js')).showroom; })()`);
  await wait(300);
  console.log('Measured surface networks:', await evaluate(`qaApp.systemFlow.topology`));
  assert(await evaluate(`qaApp.systemFlow.topology.length >= 14 && !qaApp.scene.getObjectByName('guidedSystemFlow')`), 'Missing measured networks or floating overlay remains');
  assert(await evaluate(`(() => { let valid=true, selected=0; qaApp.scene.traverse(n=>{const a=n.geometry?.attributes.flowSurface; if(!a)return; for(let i=0;i<a.count;i++){if(a.getX(i)){selected++; if(!Number.isFinite(a.getY(i)))valid=false;}}}); return valid && selected>10000; })()`), 'Invalid topology distances');
  assert(await evaluate(`(() => { let valid=true; qaApp.scene.traverse(n=>{ const a=n.geometry?.attributes.flowSurface, uv=n.geometry?.attributes.uv; if(!a||!uv)return; for(let i=0;i<a.count;i++){const palette=Math.round((uv.getX(i)-0.015625)*32),mask=a.getX(i); if([2,13,14,15,16,17,18].includes(palette)&&(mask&(1|2|16|32)))valid=false; if([9,10,12].includes(palette)&&(mask&(4|8)))valid=false; }}); return valid; })()`), 'Air and energy networks mixed');
  assert(await evaluate(`!document.querySelector('.flow-launch').hidden`), 'Launch button not visible on rooftop');
  await evaluate(`window.qaOriginalMaterials = []; qaApp.scene.traverse(node => {
    if (!node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    qaOriginalMaterials.push({node, reference: node.material, visible: node.visible, order: node.renderOrder,
      values: materials.map(m => JSON.stringify({color:m.color?.toArray(), emissive:m.emissive?.toArray(),
        intensity:m.emissiveIntensity, opacity:m.opacity, transparent:m.transparent, depthWrite:m.depthWrite}))});
  }); window.qaRestored = () => qaOriginalMaterials.every(e => e.node.material === e.reference &&
    e.node.visible === e.visible && e.node.renderOrder === e.order &&
    (Array.isArray(e.node.material) ? e.node.material : [e.node.material]).every((m,i) =>
      e.values[i] === JSON.stringify({color:m.color?.toArray(), emissive:m.emissive?.toArray(),
        intensity:m.emissiveIntensity, opacity:m.opacity, transparent:m.transparent, depthWrite:m.depthWrite})));`);
  await evaluate(`window.qaSnapshot = { position: qaApp.camera.position.toArray(), target: qaApp.controls.target.toArray() }; document.querySelector('.flow-launch').click()`);
  await wait(6500);
  assert(await evaluate(`qaApp.systemFlow.state.step === 0 && !document.querySelector('.flow-panel__timeline')`), 'Automatic timing remains');
  assert(await evaluate(`qaApp.systemFlow.active && !qaApp.controls.enabled && !qaApp.scene.getObjectByName('rooftopMarkers').visible`), 'Flow must disable camera and hotspots');
  await screenshot('fresh');
  await evaluate(`(() => { const m=qaApp.scene.getObjectByName('empty_1077').material; const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <emissivemap_fragment>'}; m.onBeforeCompile(shader); window.qaFlowTime=shader.uniforms.flowTime; document.querySelector('[data-flow="pause"]').click(); window.qaPaused = { position: qaApp.camera.position.toArray(), time: qaFlowTime.value }; })()`);
  await wait(600);
  assert(await evaluate(`JSON.stringify(qaPaused.position) === JSON.stringify(qaApp.camera.position.toArray()) && qaPaused.time === qaFlowTime.value`), 'Pause did not freeze camera and flow');
  await evaluate(`document.querySelector('[data-flow="next"]').click()`);
  await wait(1800);
  assert(await evaluate(`qaApp.systemFlow.state.step === 1`), 'Next did not advance');
  await screenshot('used-air');
  await evaluate(`document.querySelector('[data-flow="previous"]').click()`);
  await wait(100);
  assert(await evaluate(`qaApp.systemFlow.state.step === 0`), 'Previous did not return');
  await evaluate(`document.querySelector('[data-step="2"]').click()`);
  await wait(1800);
  await screenshot('recovery');
  assert(await evaluate(`qaApp.systemFlow.state.step === 2`), 'Direct step jump failed');
  await evaluate(`document.querySelector('[data-step="3"]').click()`);
  await wait(6500);
  await screenshot('heat-pump');
  assert(await evaluate(`qaApp.systemFlow.state.step === 3 && qaApp.scene.getObjectByName('heatPumpEnclosureWall').material.depthWrite === false && qaApp.scene.getObjectByName('heatPumpEnclosureWall').castShadow`), 'Heat pump reveal or retained shadows failed');
  await evaluate(`document.querySelector('[data-flow="next"]').click()`);
  await wait(2200);
  assert(await evaluate(`qaApp.systemFlow.state.step === 4 && qaApp.scene.getObjectByName('heatPumpEnclosureWall').material.depthWrite`), 'Wall must be solid before continuing');
  await screenshot('supply');
  await evaluate(`document.querySelector('[data-flow="next"]').click()`);
  await wait(1800);
  await screenshot('exhaust');
  assert(await evaluate(`(async()=>{ const T=await import('three'); const building=qaApp.scene.getObjectByName('rooftopMarkers').parent; return [[-17.29753,5.33822,-13.98721],[13.42586,5.33822,-44.07659]].every(p=>{const v=building.localToWorld(new T.Vector3(...p)).project(qaApp.camera); return Math.abs(v.x)<0.9 && Math.abs(v.y)<0.9;});})()`), 'Extract units outside final frame');
  assert(await evaluate(`qaApp.systemFlow.state.step === 5 && document.querySelector('[data-flow="next"]').textContent === 'Finish'`), 'Finish control missing');
  await evaluate(`document.querySelector('[data-flow="restart"]').click()`);
  await wait(1800);
  assert(await evaluate(`qaApp.systemFlow.state.step === 0 && !qaApp.systemFlow.state.paused`), 'Restart failed');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  await wait(1500);
  assert(await evaluate(`!qaApp.systemFlow.active && qaApp.controls.enabled && qaApp.scene.getObjectByName('rooftopMarkers').visible && qaApp.camera.position.distanceTo({ x: qaSnapshot.position[0], y: qaSnapshot.position[1], z: qaSnapshot.position[2] }) < 0.00001`), 'Exit did not restore showroom state');
  assert(await evaluate(`qaRestored()`), 'Original material references or values changed after exit');
  // Reverse traversal, restart/pause at every step, exit each step, and re-enter.
  await evaluate(`document.querySelector('.flow-launch').click()`);
  for (const i of [0,1,2,3,4,5,4,3,2,1,0]) {
    await evaluate(`document.querySelector('[data-step="${i}"]').click()`);
    await wait(i === 3 || i === 4 || i === 2 ? 2400 : 1800);
    assert(await evaluate(`qaApp.systemFlow.state.step === ${i}`), 'Traversal failed at ' + i);
  }
  for (let i=0; i<6; i++) {
    await evaluate(`document.querySelector('[data-step="${i}"]').click()`);
    await wait(2400);
    await evaluate(`document.querySelector('[data-flow="pause"]').click(); window.qaFrozen=qaFlowTime.value`);
    await wait(150);
    assert(await evaluate(`qaFlowTime.value === qaFrozen`), 'Paused pulses moved at ' + i);
    await evaluate(`document.querySelector('[data-flow="pause"]').click(); document.querySelector('[data-flow="restart"]').click()`);
    await wait(2400);
    assert(await evaluate(`qaApp.systemFlow.state.step === 0`), 'Restart failed from ' + i);
    await evaluate(`document.querySelector('[data-step="${i}"]').click()`);
    await wait(1800);
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
    await wait(1600);
    assert(await evaluate(`!qaApp.systemFlow.active && qaRestored()`), 'Exit material restoration failed at ' + i);
    await evaluate(`document.querySelector('.flow-launch').click()`);
  }
  await evaluate(`for (const i of [3,1,5,2,3,0,4,1]) document.querySelector('[data-step="'+i+'"]').click()`);
  await wait(2600);
  assert(await evaluate(`qaApp.systemFlow.state.step === 1 && qaApp.systemFlow.state.pendingStep === null`), 'Rapid navigation did not settle on latest step');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  await wait(1600);
  assert(await evaluate(`qaRestored()`), 'Rapid navigation left material residue');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(300);
  await evaluate(`document.querySelector('.flow-launch').click()`);
  await wait(1800);
  await screenshot('mobile');
  assert(await evaluate(`(() => { const r = document.querySelector('.flow-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })()`), 'Mobile controls overflow viewport');
  assert(await evaluate(`(() => { const p=qaApp.controls.target.clone().project(qaApp.camera); const y=(1-p.y)*innerHeight/2; return y < document.querySelector('.flow-panel').getBoundingClientRect().top-16; })()`), 'Mobile equipment hidden beneath controls');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  await wait(1500);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate(`document.querySelector('.flow-launch').click(); document.querySelector('[data-step="3"]').click()`);
  await wait(200);
  assert(await evaluate(`qaApp.systemFlow.state.step === 3`), 'Reduced motion step jump failed');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);
  await wait(100);
  assert(await evaluate(`!qaApp.systemFlow.active`), 'Reduced motion exit failed');
  // Repeated navigation must reuse the source geometry and surface attributes.
  await evaluate(`document.querySelector('.flow-launch').click()`);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < 6; i++) {
      await evaluate(`document.querySelector('[data-step="${i}"]').click()`);
      await wait(120);
    }
    const memory = await evaluate(`qaApp.renderer.info.memory`);
    if (pass === 0) await evaluate(`window.qaMemory = ${JSON.stringify(memory)}`);
    else assert(await evaluate(`JSON.stringify(qaMemory) === JSON.stringify(qaApp.renderer.info.memory)`), 'GPU resources grew during repeated navigation');
  }
  await evaluate(`document.querySelector('[data-flow="next"]').click()`);
  await wait(100);
  assert(await evaluate(`!qaApp.systemFlow.active`), 'Finish did not restore showroom');
  console.log('Renderer resources:', await evaluate(`qaApp.renderer.info.memory`));
  assert(errors.length === 0, 'Browser errors: ' + JSON.stringify(errors));
  console.log('Passed: measured surface topology, no floating overlays, manual step hold, Previous/Next, pause/resume, step jumps, persistent wall reveal, wall restoration, restart, Exit/Finish, desktop/mobile equipment framing, reduced motion, resource reuse, and browser error checks.');
} finally {
  socket.close();
}
