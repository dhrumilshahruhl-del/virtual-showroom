// Dedicated CDP browser on 9226, showroom server on 4173. No production imports.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const baseline = process.argv.includes('--baseline');
const pages = await (await fetch('http://localhost:9226/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map(), held = [], errors = [];
socket.addEventListener('message', ({ data }) => {
  const m = JSON.parse(data);
  if (m.id) {
    const task = pending.get(m.id); pending.delete(m.id);
    m.error ? task.reject(new Error(JSON.stringify(m.error))) : task.resolve(m.result);
  } else if (m.method === 'Fetch.requestPaused') held.push(m.params.requestId);
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params);
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
async function until(expression) {
  for (let i = 0; i < 240; i++) { if (await evaluate(expression)) return; await wait(250); }
  throw new Error('Timeout: ' + expression);
}
async function metrics() {
  await send('HeapProfiler.collectGarbage');
  const heap = await send('Runtime.getHeapUsage');
  const r = await evaluate(`(()=>{
    const city=qaApp.scene.getObjectByName('cityContext'), textures=new Map(),materials=new Set(),geometries=new Map();let meshes=0;
    city?.traverse(n=>{if(!n.isMesh)return;meshes++;geometries.set(n.geometry.uuid,n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m.uuid);for(const [slot,t] of Object.entries(m)){if(!t?.isTexture)continue;let e=textures.get(t.uuid);if(!e){const image=t.image;let levels=0,w=image.width,h=image.height;do{levels+=w*h*4;if(!t.generateMipmaps)break;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}while(w>1||h>1);if(t.generateMipmaps)levels+=4;e={uuid:t.uuid,source:t.userData.citySource||t.name||null,width:image.width,height:image.height,bytes:levels,refs:0,slots:[],colorSpace:t.colorSpace,type:t.type,flipY:t.flipY,wrapS:t.wrapS,wrapT:t.wrapT,repeat:t.repeat.toArray(),offset:t.offset.toArray(),rotation:t.rotation,channel:t.channel,minFilter:t.minFilter,magFilter:t.magFilter,mipmaps:t.generateMipmaps,anisotropy:t.anisotropy,uploaded:!!qaApp.renderer.properties.get(t).__webglTexture};textures.set(t.uuid,e);}e.refs++;if(!e.slots.includes(slot))e.slots.push(slot);}}});
    const rows=[...textures.values()];const buffers=new Set();let geometryBytes=0;for(const g of geometries.values())for(const a of [...Object.values(g.attributes),g.index].filter(Boolean)){const b=a.isInterleavedBufferAttribute?a.data.array:a.array;if(!buffers.has(b)){buffers.add(b);geometryBytes+=b.byteLength;}}
    return {geometries:qaApp.renderer.info.memory.geometries,textures:qaApp.renderer.info.memory.textures,programs:qaApp.renderer.info.programs.length,calls:qaApp.renderer.info.render.calls,triangles:qaApp.renderer.info.render.triangles,cityContexts:qaApp.scene.getObjectsByProperty('name','cityContext').length,smokePools:qaApp.scene.getObjectsByProperty('name','airflowSmoke').length,city:{meshes,materials:materials.size,geometryBytes,textureObjects:rows.length,textureBytes:rows.reduce((a,t)=>a+t.bytes,0),rows},viewport:{width:innerWidth,height:innerHeight,dpr:qaApp.renderer.getPixelRatio()},environment:{background:qaApp.scene.background.uuid,environment:qaApp.scene.environment.uuid}};
  })()`);
  return { ...r, heap };
}
async function capture(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const target = path.join(os.tmpdir(), `city-${baseline ? 'before' : 'after'}-${name}.png`);
  await fs.writeFile(target, Buffer.from(r.data, 'base64')); console.log('Screenshot:', target);
}
async function settle() { await until(`!qaApp.systemFlow.state.transitioning&&qaApp.systemFlow.state.pendingStep===null`); }
try {
  await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*Building_*.gltf' }] });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  await until(`!!document.querySelector('.flow-launch')`);
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom;window.qaThree=await import('three')})()`);
  const beforeCity = await metrics();
  if (beforeCity.cityContexts || !await evaluate('qaApp.controls.enabled')) throw new Error('City blocked interaction');
  for (const requestId of held.splice(0)) await send('Fetch.continueRequest', { requestId });
  await send('Fetch.disable');
  await until(`!!qaApp.scene.getObjectByName('cityContext')`); await wait(2000);
  const fullyLoaded = await metrics();
  await capture('overview');
  // Use the same diagnostic-only camera poses for reproducible comparisons.
  await evaluate(`window.qaPose={p:qaApp.camera.position.clone(),t:qaApp.controls.target.clone()};qaApp.controls.enabled=false;qaApp.controls.enableDamping=false;qaApp.camera.position.set(-8,11,14);qaApp.controls.target.set(0,2,0);qaApp.controls.update()`);
  await wait(300); await capture('skyline-streets');
  await evaluate(`qaApp.camera.position.set(-2.8,6.2,5.7);qaApp.controls.target.set(-0.079,3.4,3.82373);qaApp.controls.update()`);
  await wait(300); await capture('edge');
  await evaluate(`qaApp.camera.position.copy(qaPose.p);qaApp.controls.target.copy(qaPose.t);qaApp.controls.update();qaApp.controls.enableDamping=true;qaApp.controls.enabled=true;window.qaBaseline=[];qaApp.scene.traverse(n=>{if(n.material)qaBaseline.push({n,m:n.material,values:(Array.isArray(n.material)?n.material:[n.material]).map(m=>JSON.stringify({c:m.color?.toArray(),e:m.emissive?.toArray(),r:m.roughness,metal:m.metalness,o:m.opacity,n:m.normalScale?.toArray(),d:m.depthWrite}))})});window.qaRestoredCity=()=>qaBaseline.every(e=>e.n.material===e.m&&e.values.every((v,i)=>v===JSON.stringify((m=>({c:m.color?.toArray(),e:m.emissive?.toArray(),r:m.roughness,metal:m.metalness,o:m.opacity,n:m.normalScale?.toArray(),d:m.depthWrite}))((Array.isArray(e.n.material)?e.n.material:[e.n.material])[i]))))`);
  const cycles = [];
  for (let cycle = 0; cycle < (baseline ? 1 : 3); cycle++) {
    await evaluate(`document.querySelector('.flow-launch').click()`); await settle();
    if (!cycle) await capture('active');
    for (const step of [1,2,3,4,5]) { await evaluate(`document.querySelector('[data-step="${step}"]').click()`); await settle(); }
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`); await settle();
    if (!await evaluate('qaRestoredCity()')) throw new Error('Baseline material restoration failed');
    cycles.push(await metrics());
    console.log('Cycle:', cycle + 1, JSON.stringify({ ...cycles.at(-1),city:undefined }));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(400); await capture('mobile');
  if (errors.length) throw new Error('Runtime exceptions: ' + JSON.stringify(errors));
  const filename = `docs/city-context-${baseline ? 'baseline' : 'results'}.json`;
  await fs.writeFile(filename, JSON.stringify({ beforeCity, fullyLoaded, cycles, errors }, null, 2) + '\n');
  console.log('Saved:',filename,'city objects:',fullyLoaded.city.textureObjects,'estimated MiB:',fullyLoaded.city.textureBytes/1048576);
} finally { socket.close(); }
