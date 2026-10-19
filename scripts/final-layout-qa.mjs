import { writeFile } from 'node:fs/promises';
const page=(await(await fetch('http://localhost:9224/json')).json()).find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const jobs=new Map();
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const j=jobs.get(m.id);m.error?j.reject(m.error):j.resolve(m.result);jobs.delete(m.id);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{jobs.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));const samples=[];
for(const mode of ['zoom','narrow']){
 await send('Page.navigate',{url:'chrome://settings/'});await wait(500);await ev(`new Promise(r=>chrome.settingsPrivate.setDefaultZoom(${mode==='zoom'?2:1},r))`);
 if(mode==='narrow')await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:4175/'});await wait(10000);
 await ev(`document.querySelector('.flow-launch').click()`);await wait(1700);
 for(const selector of ['[data-flow="previous"]','[data-flow="next"]','[data-flow="pause"]','[data-flow="restart"]','[data-flow="exit"]','.showroom__legal-link']){
  const result=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {selector:${JSON.stringify(selector)},visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&(hit===e||e.contains(hit)),outline:getComputedStyle(e).outlineStyle}})()`);samples.push({mode,...result});
 }
 const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(`docs/${mode}-final-layout.png`,Buffer.from(s.data,'base64'));
}
await send('Emulation.clearDeviceMetricsOverride');await writeFile('docs/final-layout-evidence.json',JSON.stringify(samples,null,2));console.log(JSON.stringify(samples));ws.close();if(samples.some(s=>!s.visible))process.exitCode=1;
