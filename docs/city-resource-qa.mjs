// Explicit city ownership, failure and reinitialization checks on dedicated CDP 9226.
const pages=await(await fetch('http://localhost:9226/json')).json();
const socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
socket.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}});
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const assert=(v,m)=>{if(!v)throw new Error(m)};
try{
  const shared=await evaluate(`(async()=>{
    window.qaCityLoader=await import('/src/loaders/city-assets.js');window.qaCityModule=await import('/src/environment/city-context.js');
    window.qaCityBox=new qaThree.Box3().setFromObject(qaApp.scene.getObjectByName('rooftopMarkers').parent);
    const textures=root=>{const set=new Set();root.traverse(n=>{for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[])for(const t of Object.values(m))if(t?.isTexture&&t.userData.citySource)set.add(t)});return set};
    window.qaSharedTextures=textures(qaApp.scene.getObjectByName('cityContext'));window.qaDisposals=new Map();for(const t of qaSharedTextures){qaDisposals.set(t.uuid,0);t.addEventListener('dispose',()=>qaDisposals.set(t.uuid,qaDisposals.get(t.uuid)+1))}
    const second=await qaCityModule.createCityContext(qaCityBox);const secondTextures=textures(second);const during=qaCityLoader.getCityAssetStats();
    const same=[...secondTextures].every(t=>qaSharedTextures.has(t));second.userData.dispose();second.userData.dispose();
    return {during,after:qaCityLoader.getCityAssetStats(),same,disposed:[...qaDisposals.values()].reduce((a,b)=>a+b,0),shared:secondTextures.size};
  })()`);
  assert(shared.same&&shared.shared===19&&shared.during.consumers===2&&shared.after.consumers===1&&shared.disposed===0,'Shared resources invalidated: '+JSON.stringify(shared));
  console.log('Concurrent contexts:',JSON.stringify(shared));
  const final=await evaluate(`(()=>{qaApp.dispose();return {stats:qaCityLoader.getCityAssetStats(),disposals:[...qaDisposals.values()]}})()`);
  assert(final.stats.consumers===0&&final.stats.textures===0&&final.disposals.length===19&&final.disposals.every(n=>n===1),'Final disposal incorrect');
  const reinit=await evaluate(`(async()=>{const city=await qaCityModule.createCityContext(qaCityBox);const during=qaCityLoader.getCityAssetStats();city.userData.dispose();return {during,after:qaCityLoader.getCityAssetStats()}})()`);
  assert(reinit.during.images===19&&reinit.during.canonicalTextures===19&&reinit.after.consumers===0,'Reinitialization multiplied registry');
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Network.setBlockedURLs',{urls:['*city-context/textures/T_RedBrick_Normal.png']});
  const failure=await evaluate(`(async()=>{let failed=false;try{await qaCityModule.createCityContext(qaCityBox)}catch{failed=true}return {failed,stats:qaCityLoader.getCityAssetStats()}})()`);
  await send('Network.setBlockedURLs',{urls:[]});
  assert(failure.failed&&failure.stats.consumers===0&&failure.stats.textures===0,'Partial failure leaked: '+JSON.stringify(failure));
  console.log('Passed: concurrent sharing, idempotent disposal, exactly-once texture disposal at last owner, empty registry after teardown, clean reinitialization, partial texture failure cleanup.');
}finally{socket.close()}
