// Requires the local showroom on 4173 and dedicated headless Chrome on 9224.
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
    const task = pending.get(message.id); pending.delete(message.id);
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
  for(let i=0;i<120;i++) {
    if(await evaluate(`!qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null && document.querySelector('.flow-impact').dataset.phase !== 'leave'`))return;
    await wait(100);
  }
  throw new Error('Flow did not settle');
}
async function step(index) {
  await evaluate(`document.querySelector('[data-step="${index}"]').click()`);await settle();await wait(1400);
}
async function capture(name) {
  const r=await send('Page.captureScreenshot',{format:'png'});
  const filename=path.join(os.tmpdir(),`rooftop-impact-${name}.png`);
  await fs.writeFile(filename,Buffer.from(r.data,'base64'));console.log('Screenshot:',filename);
}
async function checkLayout(wide) {
  const result=await evaluate(`(()=>{
    const impact=document.querySelector('.flow-impact'),flow=document.querySelector('.flow-panel'),i=impact.getBoundingClientRect(),f=flow.getBoundingClientRect();
    const controls=[...flow.querySelectorAll('.flow-panel__navigation button,.flow-panel__controls button')].map(b=>b.getBoundingClientRect());
    const p=qaApp.controls.target.clone().project(qaApp.camera), x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
    return {overflow:document.documentElement.scrollWidth>innerWidth,bounds:i.left>=0&&i.right<=innerWidth+1&&i.bottom<=innerHeight+1,
      controls:controls.every(b=>b.top>=0&&b.bottom<=innerHeight+1),
      focus:${wide}?(x>f.right+12&&x<i.left-12):(innerWidth>600?x>f.right:y<f.top-12),rect:{x,y,left:f.right,right:i.left,top:f.top}};
  })()`);
  assert(!result.overflow&&result.bounds&&result.controls&&result.focus,'Overlay framing failed: '+JSON.stringify(result));
}
try {
  await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Runtime.enable');await send('Runtime.discardConsoleEntries');errors.length=0;
  await send('Emulation.setEmulatedMedia',{features:[]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:4173/'});
  for(let i=0;i<100;i++) {
    if(await evaluate(`!!document.querySelector('.flow-launch')`))break;
    if(i===99)throw new Error('Showroom did not load');await wait(500);
  }
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom})()`);
  // Optional progressive city insertion is expected; count objects after it settles.
  for(let i=0;i<120;i++) {
    if(await evaluate(`!!qaApp.scene.getObjectByName('cityContext')`))break;
    if(i===119)throw new Error('City did not finish loading');await wait(250);
  }
  await evaluate(`window.qaSceneObjects=0;qaApp.scene.traverse(()=>qaSceneObjects++);document.querySelector('.flow-launch').click()`);
  await settle();
  for(let index=0;index<6;index++) {
    await step(index);
    const expected={1:'balance',2:'recovery',5:'final'}[index];
    assert(await evaluate(`document.querySelector('.flow-impact').hidden === ${!expected} && document.querySelectorAll('.flow-impact').length === 1`),'Mapping failed at '+index);
    if(expected) {
      assert(await evaluate(`document.querySelector('.flow-impact').dataset.type === '${expected}'`),'Wrong card');
      await checkLayout(true);await capture(`desktop-${index}`);
      assert(await evaluate(`document.querySelector('.flow-impact').getAnimations({subtree:true}).every(a=>a.playState==='finished')`),'Decorative animation did not stop');
    }
    assert(await evaluate(`document.querySelectorAll('canvas').length===1&&(()=>{let n=0;qaApp.scene.traverse(()=>n++);return n===qaSceneObjects;})()`),'Additional canvas or scene objects');
    if(index===1) {
      assert(await evaluate(`['74,780','21,480','53,300 CFM','284% negative','Balanced /','slight positive'].every(s=>document.querySelector('.flow-impact').textContent.includes(s))`),'Air balance values wrong');
      assert(await evaluate(`document.querySelector('.impact-band--after path').getBBox().width/document.querySelector('.impact-band--before path').getBBox().width<0.29`),'Air bands are not proportional');
    }
    if(index===2) assert(await evaluate(`document.querySelector('.flow-impact').textContent.includes('~72%')&&document.querySelector('.flow-impact').textContent.includes('ENERGY')&&document.querySelectorAll('.impact-recovery-diagram .impact-air-track').length===2`),'Recovery diagram wrong');
    if(index===5) {
      assert(await evaluate(`['26%','26% LESS','Energy use','11.9M','kBtu/yr','664','tCO₂e/yr','ventilation retrofit as a whole'].every(s=>document.querySelector('.flow-impact').textContent.includes(s))`),'Final data or scope wrong');
      assert(await evaluate(`(()=>{const panel=document.querySelector('.flow-impact');const copy=panel.textContent+' '+[...panel.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')).join(' ');return !/100%|74%|Normalized comparison|74% remaining/i.test(copy)&&[...copy.matchAll(/\\d+%/g)].every(m=>m[0]==='26%');})()`),'Unnecessary baseline percentage remains');
    }
  }
  await evaluate(`window.qaImpactMemory=JSON.stringify(qaApp.renderer.info.memory);window.qaImpactCount=document.querySelectorAll('*').length`);
  for(let pass=0;pass<3;pass++) {
    await evaluate(`for(const i of [1,2,5,0,1,3,5,2,5])document.querySelector('[data-step="'+i+'"]').click()`);await settle();await wait(1500);
    assert(await evaluate(`document.querySelectorAll('.flow-impact').length===1&&document.querySelector('.flow-impact').dataset.type==='final'&&document.querySelectorAll('*').length===qaImpactCount`),'DOM or animation state leaked');
    assert(await evaluate(`JSON.stringify(qaApp.renderer.info.memory)===qaImpactMemory`),'Renderer resources grew');
  }
  await step(2);
  await evaluate(`document.querySelector('[data-flow="pause"]').click();window.qaPausedCamera=JSON.stringify(qaApp.camera.position.toArray())`);
  await wait(200);assert(await evaluate(`qaApp.systemFlow.state.paused&&qaPausedCamera===JSON.stringify(qaApp.camera.position.toArray())`),'Pause changed');
  await evaluate(`document.querySelector('[data-flow="pause"]').click();document.querySelector('[data-flow="restart"]').click()`);await settle();
  assert(await evaluate(`qaApp.systemFlow.state.step===0&&document.querySelector('.flow-impact').hidden`),'Restart left impact');
  for(const [width,height] of [[1280,800],[1024,768],[768,1024],[390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    for(const index of [1,2,5]) {
      await step(index);await checkLayout(width>=1200);await capture(`${width}-${index}`);
      if(width<1200) {
        assert(await evaluate(`!document.querySelector('.flow-impact').open&&document.querySelector('.flow-impact').parentElement===document.querySelector('.flow-panel')`),'Narrow layout is not collapsed inline');
        await evaluate(`document.querySelector('.flow-impact summary').click()`);await settle();await wait(1400);await checkLayout(false);
        if(index===2)await capture(`${width}-expanded`);
      }
    }
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await step(1);await evaluate(`document.querySelector('.flow-impact summary').click()`);await wait(50);
  assert(await evaluate(`document.querySelector('.flow-impact').getAnimations({subtree:true}).length===0`),'Reduced motion failed');
  await evaluate(`document.querySelector('[data-flow="exit"]').click()`);await settle();
  assert(await evaluate(`!qaApp.systemFlow.active&&document.querySelector('.flow-impact').hidden&&document.querySelector('.flow-impact').children.length===0&&!document.querySelector('[data-flow-active]')`),'Exit did not clear impact');
  await evaluate(`document.querySelector('.flow-launch').click()`);await settle();assert(await evaluate(`document.querySelector('.flow-impact').hidden`),'Re-entry failed');
  await step(5);await evaluate(`document.querySelector('[data-flow="next"]').click()`);await settle();assert(await evaluate(`!qaApp.systemFlow.active&&document.querySelector('.flow-impact').hidden`),'Finish did not clear');
  await send('Emulation.setEmulatedMedia',{features:[]});
  assert(errors.length===0,JSON.stringify(errors));
  console.log('Passed: mapping, verified values, proportional airflow, finite animation, one DOM panel, one canvas, stable scene/resources, navigation/restart/pause/exit/re-entry, rapid changes, desktop/laptop/tablet/mobile layout and reduced motion.');
} finally {socket.close();}
