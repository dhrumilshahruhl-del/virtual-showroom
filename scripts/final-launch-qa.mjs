import { readFile, writeFile } from 'node:fs/promises';
const pages = await (await fetch('http://localhost:9224/json')).json();
const page = pages.find(p=>p.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0; const pending=new Map(); const errors=[],requests=[],failures=[],trees=[],scans=[],cycles=[],checks=[];
ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else{
 if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
 if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args);
 if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);
 if(m.method==='Network.loadingFailed')failures.push(m.params);
 if(m.method==='Network.responseReceived'&&m.params.response.status>=400)failures.push(m.params.response);
}});
const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{checks.push({check:m,pass:!!v});if(!v)throw Error(m);};
const key=async(k,modifiers=0)=>{const vk={Tab:9,Enter:13,Escape:27,ArrowLeft:37,ArrowRight:39,ArrowUp:38,ArrowDown:40,r:82,'+':187,'-':189}[k]||0;await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:k,code:k,windowsVirtualKeyCode:vk,modifiers});if(k==='Enter')await send('Input.dispatchKeyEvent',{type:'char',text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k,windowsVirtualKeyCode:vk,modifiers});};
const focus=async selector=>{for(let i=0;i<45;i++){if(await ev(`document.activeElement.matches(${JSON.stringify(selector)})`))return;await key('Tab');}throw Error('Tab could not reach '+selector);};
const activate=async selector=>{await focus(selector);await key('Enter');await wait(1750);};
const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});await writeFile('docs/'+name+'.png',Buffer.from(s.data,'base64'));};
const axe=await readFile('docs/axe-qa.tmp.js','utf8');
const snapshot=async state=>{const t=await send('Accessibility.getFullAXTree');trees.push({state,nodes:t.nodes});await ev(axe);const s=await ev(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>({violations:r.violations,incomplete:r.incomplete.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)})),passes:r.passes.length}))`);scans.push({state,...s});};
let zoom, mobile, privacy, hidden, artifact;
try {
 await send('Runtime.discardConsoleEntries');await send('Runtime.enable');await send('Page.enable');await send('Accessibility.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 // Chrome's settings API changes actual browser zoom, not page scale or viewport.
 await send('Page.navigate',{url:'chrome://settings/'});await wait(1000);
 zoom=await ev(`({api:typeof chrome.settingsPrivate?.setDefaultZoom})`);
 if(zoom.api==='function')await ev(`new Promise(r=>chrome.settingsPrivate.setDefaultZoom(1,r))`);
 await send('Page.navigate',{url:'http://127.0.0.1:4175/'});
 for(let i=0;i<180;i++){if(await ev(`!!document.querySelector('.flow-launch')`))break;await wait(500);}
 await wait(8000);
 assert(await ev(`!!document.querySelector('.flow-launch')`),'Production loads');
 await snapshot('initial');
 const integrity=await ev(`(()=>{const all=[...document.querySelectorAll('*')];const ids=all.filter(e=>e.id).map(e=>e.id);return {duplicates:ids.filter((x,i)=>ids.indexOf(x)!==i),broken:all.flatMap(e=>['aria-labelledby','aria-describedby'].flatMap(a=>(e.getAttribute(a)||'').split(/\\s+/).filter(id=>id&&!document.getElementById(id)))),hiddenFocusable:all.filter(e=>e.closest('[aria-hidden="true"]')&&e.tabIndex>=0).map(e=>e.outerHTML)}})()`);
 assert(!integrity.duplicates.length&&!integrity.broken.length&&!integrity.hiddenFocusable.length,'ARIA references, IDs and hidden focus integrity');
 await ev(`document.querySelector('canvas').focus()`);
 const cam=()=>ev(`import('/src/main.js').then(async m=>(await m.showroom).camera.position.toArray())`);
 const c1=await cam();await key('ArrowLeft');const c2=await cam();await key('+');const c3=await cam();await key('r');
 assert(JSON.stringify(c1)!==JSON.stringify(c2)&&JSON.stringify(c2)!==JSON.stringify(c3),'Canvas keyboard rotate zoom reset');
 await activate('.equipment-menu summary');await activate('[data-equipment="heat-pump"]');
 assert(await ev(`document.querySelector('.equipment-modal:not(.legal-modal)').open&&document.activeElement.closest('dialog')!==null`),'Dialog opens by keyboard and receives focus');
 await snapshot('modal');for(let i=0;i<5;i++){await key('Tab');assert(await ev(`document.activeElement===document.body||!!document.activeElement.closest('dialog')`),'Modal excludes background tab targets');}await focus('.equipment-modal__close');
 await key('Escape');assert(await ev(`document.activeElement.matches('[data-equipment="heat-pump"]')`),'Dialog Escape restores opener');
 await activate('.equipment-menu summary');
 for(let cycle=0;cycle<3;cycle++){
  await activate('.flow-launch');assert(await ev(`document.activeElement.matches('[data-flow="pause"]')`),'Flow receives focus');
  if(!cycle){await snapshot('flow-open');await key('Enter');await snapshot('paused');assert(await ev(`document.activeElement.textContent==='Resume'`),'Pause');await key('Enter');assert(await ev(`document.activeElement.textContent==='Pause'`),'Resume');await key('Tab',8);assert(await ev(`document.activeElement.dataset.flow==='next'`),'Shift Tab order');await key('Enter');await wait(1750);await activate('[data-flow="previous"]');await activate('[data-flow="restart"]');}
  const titles=[];
  for(let i=0;i<6;i++){
   titles.push(await ev(`document.querySelector('.flow-panel h2').textContent`));
   assert(await ev(`document.querySelector('[aria-current="step"]').dataset.step==='${i}'`),'Active step '+i);
   if(!cycle)await snapshot(titles.at(-1));
   await activate('[data-flow="next"]');
  }
  assert(titles.join('|')==='Return Air|Energy Recovery|Exhaust|Fresh Outdoor Air|Heat Pump|Supply Air','Six-step keyboard completion');
  assert(await ev(`document.activeElement.matches('.flow-launch')`),'Flow exit restores opener');
  cycles.push(await ev(`import('/src/main.js').then(async m=>{const a=await m.showroom;return {geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures,programs:a.renderer.info.programs.length,panels:document.querySelectorAll('.flow-panel').length,popups:document.querySelectorAll('.flow-equipment').length,cityLoaded:!!a.scene.getObjectByName('cityContext')}})`));
 }
 await snapshot('flow-exited');
 await activate('.flow-launch');await activate('[data-flow="exit"]');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await activate('.flow-launch');assert(await ev(`import('/src/main.js').then(async m=>!(await m.showroom).systemFlow.state.transitioning)`),'Reduced motion functional');await key('Escape');await wait(1400);await send('Emulation.setEmulatedMedia',{features:[]});
 // Change the browser preference in a separate settings tab, preserving app state.
 await send('Page.navigate',{url:'chrome://settings/'});await wait(800);
 await ev(`new Promise(r=>chrome.settingsPrivate.setDefaultZoom(2,r))`);
 await send('Page.navigate',{url:'http://127.0.0.1:4175/'});await wait(10000);
 zoom=await ev(`({dpr:devicePixelRatio,width:innerWidth,height:innerHeight,outerWidth,visualScale:visualViewport.scale})`);
 assert(zoom.dpr===2&&zoom.width<800&&zoom.visualScale===1,'Actual browser zoom 200 percent');
 await activate('.equipment-menu summary');await activate('[data-equipment="heat-pump"]');await shot('zoom-200-dialog');await snapshot('200-percent-dialog');await key('Escape');await activate('.equipment-menu summary');
 await activate('.flow-launch');
 await activate('[data-flow="pause"]');await key('Enter');await activate('[data-flow="restart"]');await shot('zoom-200-flow');await snapshot('200-percent-flow');
 if(await ev(`!!document.querySelector('.flow-panel .flow-impact:not([hidden]) summary')`)){await activate('.flow-impact summary');await shot('zoom-200-impact');await snapshot('200-percent-impact');}
 for(let i=0;i<6;i++){await focus('[data-flow="next"]');const box=await ev(`(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()`);assert(box.left>=0&&box.right<=box.w&&box.top>=0&&box.bottom<=box.h&&!box.overflow,'Zoom next reachable '+i);await key('Enter');await wait(1750);}
 await snapshot('200-percent-exited');
 await send('Page.navigate',{url:'chrome://settings/'});await wait(500);await ev(`new Promise(r=>chrome.settingsPrivate.setDefaultZoom(1,r))`);await send('Page.navigate',{url:'http://127.0.0.1:4175/'});await wait(8000);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(500);await activate('.flow-launch');
 await shot('narrow-flow');await snapshot('narrow-flow');for(let i=0;i<6;i++)await activate('[data-flow="next"]');
 mobile=await ev(`({width:innerWidth,scroll:document.documentElement.scrollWidth})`);assert(mobile.width===mobile.scroll,'Narrow flow no horizontal overflow');
 await send('Emulation.clearDeviceMetricsOverride');
 const frame=()=>ev(`import('/src/main.js').then(async m=>(await m.showroom).renderer.info.render.frame)`);
 const other=await send('Target.createTarget',{url:'about:blank'});await send('Target.activateTarget',{targetId:other.targetId});await wait(500);const f1=await frame();await wait(400);const f2=await frame();hidden=await ev('document.hidden');await send('Target.activateTarget',{targetId:page.id});await wait(500);const f3=await frame();await send('Target.closeTarget',{targetId:other.targetId});checks.push({check:'Hidden-tab render suspension',pass:hidden&&f1===f2&&f3>f2});
 privacy=await ev(`({cookie:document.cookie,localStorage:localStorage.length,sessionStorage:sessionStorage.length})`);
 const excluded=['/docs/launch-legal-audit.md','/scripts/build-production.mjs','/README.md','/.git/config','/.env','/src/main.js.map','/migration-plan.md','/assets/models/unused.glb','/_headers'];
 artifact=await Promise.all(excluded.map(async p=>({path:p,status:(await fetch('http://127.0.0.1:4175'+p)).status})));
 assert(artifact.every(x=>x.status===404),'Excluded artifacts return 404');
 assert(scans.every(s=>!s.violations.length),'Axe all scanned states');
 assert(errors.length===0&&failures.length===0,'No console or network errors');
} catch(e){errors.push({qaFailure:e.message||e});}
finally{const result={date:'2026-10-19',checks,zoom,mobile,privacy,hidden,cycles,scans,errors,failures,hosts:[...new Set(requests.filter(u=>/^https?:/.test(u)).map(u=>new URL(u).host))],runtimeRequests:requests.filter(u=>u.startsWith('http://127.0.0.1:4175')),artifact};await writeFile('docs/final-launch-evidence.json',JSON.stringify(result,null,2));await writeFile('docs/accessibility-trees.json',JSON.stringify(trees,null,2));console.log(JSON.stringify({...result,scans:scans.map(s=>({state:s.state,violations:s.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))})),runtimeRequests:result.runtimeRequests.length},null,2));ws.close();}
