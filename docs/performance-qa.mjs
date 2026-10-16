// Requires the local server on 4173 and dedicated Chrome CDP on 9224.
const pages = await (await fetch('http://localhost:9224/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), held = [], errors = [], requests = [];
socket.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  } else if (m.method === 'Fetch.requestPaused') held.push(m.params.requestId);
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
  else if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const assert = (v, m) => { if (!v) throw new Error(m); };
async function until(expression) {
  for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await wait(250); }
  throw new Error('Timeout: ' + expression);
}
async function load() {
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  await until(`!!document.querySelector('.flow-launch')`);
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom})()`);
}
async function settle() {
  await until(`!qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null`);
}
try {
  await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*Building_*.gltf' }] });
  await load();
  assert(held.length === 3, 'Expected three deferred city requests');
  assert(await evaluate(`qaApp.controls.enabled && !qaApp.scene.getObjectByName('cityContext') && qaApp.renderer.getPixelRatio() === 1.5`), 'Rooftop blocked or DPR incorrect');
  await evaluate(`document.querySelector('.flow-launch').click()`); await settle();
  for (const requestId of held.splice(0)) await send('Fetch.continueRequest', { requestId });
  await until(`!!qaApp.scene.getObjectByName('cityContext')`);
  await send('Fetch.disable'); await wait(1000);
  assert(await evaluate(`(()=>{let casts=0;qaApp.scene.getObjectByName('cityContext').traverse(n=>{if(n.isMesh&&n.castShadow)casts++});return casts===0&&qaApp.systemFlow.active})()`), 'City shadow/focus integration failed');
  console.log('Ready before city; three deferred GLTF requests; DPR 1.5; no city shadow casters.');
  console.log('Preload requests:', requests.filter(u => u.endsWith('/200-water-building.opt.glb')).length);
  const samples = [];
  for (let cycle = 0; cycle < (process.argv.includes('--lifecycle') ? 0 : 3); cycle++) {
    for (const step of [0,1,2,3,4,5,4,3,2,1,0]) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`); await settle();
    }
    await evaluate(`document.querySelector('[data-flow="pause"]').click()`);
    assert(await evaluate('qaApp.systemFlow.state.paused'), 'Pause failed');
    await evaluate(`document.querySelector('[data-flow="pause"]').click();document.querySelector('[data-flow="restart"]').click()`); await settle();
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`); await settle();
    await send('HeapProfiler.collectGarbage');
    samples.push(await evaluate(`({heap:performance.memory?.usedJSHeapSize,geometries:qaApp.renderer.info.memory.geometries,textures:qaApp.renderer.info.memory.textures,programs:qaApp.renderer.info.programs.length,calls:qaApp.renderer.info.render.calls,triangles:qaApp.renderer.info.render.triangles})`));
    await evaluate(`document.querySelector('.flow-launch').click()`); await settle();
  }
  console.log('Repeated flow resource samples:', JSON.stringify(samples));
  await evaluate(`document.querySelector('[data-step="5"]').click()`); await settle();
  await evaluate(`document.querySelector('[data-step="0"]').click();window.qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>qaHidden});document.dispatchEvent(new Event('visibilitychange'));window.qaFrame=qaApp.renderer.info.render.frame;window.qaPosition=qaApp.camera.position.toArray()`);
  await wait(2000);
  assert(await evaluate(`qaApp.renderer.info.render.frame===qaFrame`), 'Hidden renderer still running');
  assert(await evaluate(`JSON.stringify(qaApp.camera.position.toArray())===JSON.stringify(qaPosition)`), 'Hidden camera advanced');
  await evaluate(`qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))`); await wait(250);
  assert(await evaluate(`qaApp.renderer.info.render.frame>qaFrame`), 'Renderer did not resume');
  assert(await evaluate(`qaApp.systemFlow.state.transitioning`), 'Hidden time jumped camera to its destination');
  await evaluate(`delete document.hidden`);
  await evaluate(`document.querySelector('[data-step="2"]').click();document.querySelector('[data-step="5"]').click();document.querySelector('[data-step="0"]').click()`); await settle();
  await send('Network.setBlockedURLs', { urls: ['*Building_*.gltf'] });
  await load();
  await evaluate(`document.querySelector('.flow-launch').click()`); await settle();
  assert(await evaluate(`qaApp.systemFlow.active && !qaApp.scene.getObjectByName('cityContext') && !document.querySelector('.showroom__status').textContent`), 'Optional city failure blocks rooftop');
  await send('Network.setBlockedURLs', { urls: [] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*Building_*.gltf' }] });
  await load();
  await evaluate(`qaApp.dispose();window.qaDisposedFrame=qaApp.renderer.info.render.frame`);
  for (const requestId of held.splice(0)) await send('Fetch.continueRequest', { requestId });
  await send('Fetch.disable'); await wait(3000);
  assert(await evaluate(`!qaApp.scene.getObjectByName('cityContext') && qaApp.renderer.info.render.frame===qaDisposedFrame && !document.querySelector('.flow-launch')`), 'Late city attached after disposal');
  assert(!errors.length, 'Runtime exceptions: ' + JSON.stringify(errors));
  console.log('Passed: progressive city, rapid switching, hidden camera pause/resume, city failure, late-load disposal.');
  if (samples.length) console.log('Passed: three forward/reverse flow cycles with pause/resume/restart/exit/reentry.');
} finally { socket.close(); }
