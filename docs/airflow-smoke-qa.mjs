import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const pages = await (await fetch('http://localhost:9224/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', ({data}) => {
  const message = JSON.parse(data);
  if (message.id) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown' ||
    message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params);
});
const send = (method, params = {}) => new Promise((resolve,reject) => {
  pending.set(++id,{resolve,reject}); socket.send(JSON.stringify({id,method,params}));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
async function settle() {
  for (let i=0;i<100;i++) {
    if (await evaluate(`!qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null`)) return;
    await wait(100);
  }
  throw new Error('Flow transition did not settle');
}
async function sample() {
  return evaluate(`new Promise(resolve=>{const times=[];let last=performance.now();function tick(now){times.push(now-last);last=now;if(times.length<80)requestAnimationFrame(tick);else{times.sort((a,b)=>a-b);resolve({median:times[40],p90:times[72],calls:qaApp.renderer.info.render.calls,memory:{...qaApp.renderer.info.memory}});}}requestAnimationFrame(tick);})`);
}
try {
  await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Runtime.enable'); await send('Runtime.discardConsoleEntries'); errors.length=0;
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:4173/'});
  for(let i=0;i<100;i++) {
    if(await evaluate(`!!document.querySelector('.flow-launch')`))break;
    if(i===99)throw new Error('Showroom did not load');
    await wait(500);
  }
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom;document.querySelector('.flow-launch').click();})()`);
  await settle();
  if (process.argv.includes('--baseline')) {
    const baseline = {};
    for (const step of [0,5]) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`); await settle();
      baseline[step] = await sample();
    }
    const filename = path.join(os.tmpdir(),'rooftop-airflow-baseline.json');
    await fs.writeFile(filename,JSON.stringify(baseline,null,2));
    console.log('Baseline:',filename,baseline);
  } else {
    const results={};
    for(let step=0;step<6;step++) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`); await settle(); await wait(800);
      const state=await evaluate(`qaApp.systemFlow.airflow`);
      const expected=step===0?['fresh-left','fresh-right']:step===5?['exhaust-left','exhaust-right']:[];
      assert(JSON.stringify(state.filter(p=>p.visible).map(p=>p.id))===JSON.stringify(expected),'Wrong plumes at step '+step);
      assert(state.every(p=>p.smoke===22&&p.particles===8),'Particle budget changed');
      assert(await evaluate(`(()=>{const g=qaApp.scene.getObjectByName('airflowSmoke');return g.children.length===8&&g.children.every(n=>n.material.depthTest===true&&n.material.depthWrite===false)&&g.children.filter(n=>n.name.endsWith('-vapor')).every(n=>n.geometry.instanceCount===30);})()`),'Depth safety or pool size failed');
      const capture=await send('Page.captureScreenshot',{format:'png'});
      const filename=path.join(os.tmpdir(),`rooftop-airflow-step-${step+1}.png`);
      await fs.writeFile(filename,Buffer.from(capture.data,'base64')); console.log('Screenshot:',filename);
      await evaluate(`document.querySelector('[data-flow="pause"]').click();window.qaAirPaused=JSON.stringify(qaApp.systemFlow.airflow)`);
      await wait(250);
      assert(await evaluate(`qaAirPaused===JSON.stringify(qaApp.systemFlow.airflow)`),'Pause did not freeze vapor/ribbon at '+step);
      await evaluate(`document.querySelector('[data-flow="pause"]').click()`);
      if(step===0||step===5) {
        // Same camera, scene and shading: only the airflow pool is disabled.
        await evaluate(`qaApp.scene.getObjectByName('airflowSmoke').visible=false`);
        const without=await sample();
        await evaluate(`qaApp.scene.getObjectByName('airflowSmoke').visible=true`);
        const withSmoke=await sample();
        results[step]={without,withSmoke};
        assert(withSmoke.calls-without.calls===4,'Expected four batched airflow draws');
        assert(withSmoke.median<Math.max(16.7,without.median*1.35),'Meaningful frame-time regression');
      }
    }
    await evaluate(`window.qaAirMemory=JSON.stringify(qaApp.renderer.info.memory);window.qaAirObjects=0;qaApp.scene.traverse(()=>qaAirObjects++)`);
    for(let pass=0;pass<3;pass++) {
      for(const step of [0,5,1,2,3,4,0,5]) await evaluate(`document.querySelector('[data-step="${step}"]').click()`);
      await settle();await wait(800);
      assert(await evaluate(`JSON.stringify(qaApp.renderer.info.memory)===qaAirMemory`),'GPU resources grew');
      assert(await evaluate(`(()=>{let count=0;qaApp.scene.traverse(()=>count++);return count===qaAirObjects;})()`),'Scene objects grew');
    }
    await evaluate(`document.querySelector('[data-flow="restart"]').click()`);await settle();await wait(700);
    assert(await evaluate(`qaApp.systemFlow.state.step===0&&qaApp.systemFlow.airflow.filter(p=>p.visible).every(p=>p.step===0)`),'Restart failed');
    await evaluate(`document.querySelector('[data-flow="next"]').click()`);await settle();await wait(800);
    assert(await evaluate(`qaApp.systemFlow.airflow.every(p=>!p.visible)`),'Outgoing smoke remained');
    const stopped=await evaluate(`JSON.stringify(qaApp.systemFlow.airflow)`);await wait(200);
    assert(stopped===await evaluate(`JSON.stringify(qaApp.systemFlow.airflow)`),'Inactive plumes continued updating');
    await evaluate(`document.querySelector('[data-flow="previous"]').click()`);await settle();
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`);await settle();
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate(`document.querySelector('.flow-launch').click()`);await settle();await wait(200);
    const reduced=await evaluate(`JSON.stringify(qaApp.systemFlow.airflow)`);await wait(200);
    assert(reduced===await evaluate(`JSON.stringify(qaApp.systemFlow.airflow)`),'Reduced motion did not stop vapor');
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`);await settle();
    await send('Emulation.setEmulatedMedia',{features:[]});
    assert(await evaluate(`!qaApp.systemFlow.active&&qaApp.systemFlow.airflow.every(p=>!p.visible&&p.fade===0&&p.time===0)`),'Exit left airflow residue');
    await evaluate(`document.querySelector('.flow-launch').click()`);await settle();await wait(700);
    assert(await evaluate(`qaApp.systemFlow.airflow.filter(p=>p.visible).length===2`),'Re-entry failed');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const step of [0,5]) {
      await evaluate(`document.querySelector('[data-step="${step}"]').click()`);await settle();await wait(500);
      const capture=await send('Page.captureScreenshot',{format:'png'});
      await fs.writeFile(path.join(os.tmpdir(),`rooftop-airflow-mobile-${step}.png`),Buffer.from(capture.data,'base64'));
    }
    await evaluate(`document.querySelector('[data-flow="exit"]').click()`);await settle();
    assert(errors.length===0,JSON.stringify(errors));
    console.log('Paired performance comparison (milliseconds):',JSON.stringify(results,null,2));
    console.log('Passed: six-step isolation, pooled resources, pause/resume, restart, previous/next, rapid changes, inactive sleep, exit/re-entry, depth settings, desktop/mobile captures, and browser errors.');
  }
} finally { socket.close(); }
