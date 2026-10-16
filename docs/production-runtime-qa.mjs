// Practical production-build QA. Requires dist/ served on 4174 and Chrome CDP on 9224.
const pages = await (await fetch('http://localhost:9224/json')).json();
const page = pages.find(candidate => candidate.type === 'page');
if (!page) throw new Error('No Chrome page is available on port 9224.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(message.error);
    else request.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const press = async (key, code = key) => {
  const codes = { Enter: 13, Tab: 9, Escape: 27 };
  const params = { key, code, windowsVirtualKeyCode: codes[key] || 0, nativeVirtualKeyCode: codes[key] || 0,
    modifiers: key === 'Shift+Tab' ? 8 : 0 };
  if (key === 'Shift+Tab') { params.key = 'Tab'; params.code = 'Tab'; }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...params });
  if (key === 'Enter') await send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
};
try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:4174/' });
  for (let attempt = 0; attempt < 180; attempt++) {
    if (await evaluate('!!document.querySelector(".flow-launch")')) break;
    await wait(500);
  }
  assert(await evaluate('!!document.querySelector(".flow-launch")'), 'Showroom failed to load');
  await evaluate('window.__qaKeys=[];document.addEventListener("keydown",e=>window.__qaKeys.push({key:e.key,target:e.target.className}))');
  const appReady = await evaluate('import("/src/main.js").then(m => m.showroom).then(app => !!app?.renderer)');
  assert(appReady, 'Showroom module/renderer unavailable');
  await wait(6000); // Let optional progressive city loading complete.
  const basics = await evaluate(`import("/src/main.js").then(async m=>{const a=await m.showroom;const c=document.querySelector('canvas'); const impact=document.querySelector('.flow-impact'); return {
    canvasTabIndex:c.tabIndex, canvasName:c.getAttribute('aria-label'), keyboardHelp:!!document.getElementById(c.getAttribute('aria-describedby')),
    progressHidden:document.querySelector('.showroom__status').hidden, impactHidden:impact?.hidden ?? true,
    legalHref:document.querySelector('.showroom__legal-link')?.getAttribute('href'),
    cityLoaded:!!a.scene.getObjectByName('cityContext'),
  }; })`);
  assert(basics.canvasTabIndex === 0 && basics.canvasName && basics.keyboardHelp, 'Canvas keyboard name/instructions missing');
  assert(basics.progressHidden && basics.impactHidden, 'Loading/impact hidden state incorrect');
  assert(basics.cityLoaded, 'Progressive city context did not load');
  assert(basics.legalHref === './THIRD-PARTY-NOTICES.txt', 'Notice link missing');

  const markerPoint = await evaluate(`import("/src/main.js").then(async m=>{const a=await m.showroom;const marker=a.scene.getObjectByName('central-structure');
    const p=marker.getWorldPosition(marker.position.clone()).project(a.camera);const r=document.querySelector('canvas').getBoundingClientRect();
    return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,z:p.z,visible:Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>=-1&&p.z<=1}})`);
  assert(markerPoint.visible, 'Heat pump hotspot is not in the initial visible frame');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: markerPoint.x, y: markerPoint.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: markerPoint.x, y: markerPoint.y, button: 'left', clickCount: 1 });
  const modalState = await evaluate('({open:document.querySelector(".equipment-modal")?.open,title:document.querySelector(".equipment-modal h2")?.textContent,alt:document.querySelector(".equipment-modal img")?.alt})');
  assert(modalState.open && modalState.title === 'Heat Pump' && modalState.alt === 'Heat Pump', 'Equipment modal content did not open accessibly');
  await evaluate('document.querySelector(".equipment-modal__close").focus()');
  await press('Enter');
  assert(await evaluate('!document.querySelector(".equipment-modal").open'), 'Equipment modal keyboard close failed');

  const cameraBefore = await evaluate('import("/src/main.js").then(m=>m.showroom).then(p=>p).then(async p=>{const a=await p;return a.camera.position.toArray()})');
  // Focus and dispatch through the DOM so this checks the actual canvas handler.
  await evaluate('document.querySelector("canvas").focus()');
  await evaluate('document.querySelector("canvas").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true,cancelable:true}))');
  const cameraRotated = await evaluate('import("/src/main.js").then(async m=>(await m.showroom).camera.position.toArray())');
  assert(cameraBefore.some((v, i) => Math.abs(v - cameraRotated[i]) > 1e-5), 'Arrow key did not rotate camera');
  await evaluate('document.querySelector("canvas").dispatchEvent(new KeyboardEvent("keydown",{key:"+",bubbles:true,cancelable:true}))');
  const cameraZoomed = await evaluate('import("/src/main.js").then(async m=>(await m.showroom).camera.position.toArray())');
  assert(cameraZoomed.some((v, i) => Math.abs(v - cameraRotated[i]) > 1e-5), 'Plus key did not zoom camera');
  await evaluate('document.querySelector("canvas").dispatchEvent(new KeyboardEvent("keydown",{key:"r",bubbles:true,cancelable:true}))');

  const cycleSamples = [];
  const stepTitles = [];
  const smokeChecks = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    if (cycle === 0) {
      await evaluate('document.querySelector("canvas").focus()');
      await press('Tab');
      await press('Tab');
      assert(await evaluate('document.activeElement.classList.contains("flow-launch")'), 'Tab order did not reach Explore System Flow');
      await press('Enter');
    } else await evaluate('document.querySelector(".flow-launch").click()');
    await wait(1700);
    if (cycle === 0) {
      await press('Enter');
      const pauseAfterKey = await evaluate('({focus:document.activeElement?.outerHTML.slice(0,140),text:document.querySelector("[data-flow=pause]")?.textContent})');
      const keyEvents = await evaluate('window.__qaKeys');
      assert(pauseAfterKey.text === 'Resume', `Pause key did not toggle; state=${JSON.stringify({ pauseAfterKey, keyEvents })}`);
      await press('Enter');
      await wait(1600);
      await press('Shift+Tab');
      const nextFocus = await evaluate('({element:document.activeElement?.outerHTML.slice(0,160), flow:document.activeElement?.dataset.flow})');
      assert(nextFocus.flow === 'next', `Keyboard focus did not reach Next step: ${JSON.stringify(nextFocus)}`);
      await press('Enter');
      await wait(1600);
      await press('Shift+Tab');
      assert(await evaluate('document.activeElement.dataset.flow === "previous"'), 'Keyboard focus did not reach Previous');
      await press('Enter');
      await wait(1600);
      await press('Tab');
      await press('Tab');
      await press('Tab');
      assert(await evaluate('document.activeElement.dataset.flow === "restart"'), 'Keyboard focus did not reach Restart');
      await press('Enter');
      await wait(1600);
      await press('Shift+Tab');
      await press('Shift+Tab');
      assert(await evaluate('document.activeElement.dataset.flow === "next"'), 'Keyboard focus did not return to Next');
    }
    const titles = [];
    for (let step = 0; step < 6; step++) {
      titles.push(await evaluate('document.querySelector(".flow-panel h2").textContent'));
      if (cycle === 0 && step === 1) {
        const popup = await evaluate('({ count:document.querySelectorAll(".flow-equipment").length, labels:[...document.querySelectorAll(".flow-equipment figcaption")].map(e=>e.textContent), lines:document.querySelectorAll(".flow-equipment-leader:not([hidden])").length, impact:document.querySelector(".flow-impact")?.hidden ?? true })');
        assert(popup.count === 1 && popup.labels.includes('AHU') && popup.impact, 'Equipment label or impact state incorrect');
      }
      if (cycle === 0 && step === 2) {
        const exhaustSmoke = await evaluate('import("/src/main.js").then(async m=>(await m.showroom).systemFlow.airflow.filter(plume=>plume.step===5))');
        assert(exhaustSmoke.length > 0 && exhaustSmoke.some(plume=>plume.visible && plume.target > 0), 'Exhaust smoke/vapor did not reveal');
        smokeChecks.push({step:'Exhaust',visiblePlumes:exhaustSmoke.filter(plume=>plume.visible).length});
      }
      if (step < 5) {
        if (cycle === 0) await press('Enter');
        else await evaluate('document.querySelector("[data-flow=next]").click()');
        await wait(1650);
      } else {
        if (cycle === 0) await press('Enter');
        else await evaluate('document.querySelector("[data-flow=next]").click()');
        await wait(1350);
      }
    }
    stepTitles.push(titles);
    const sample = await evaluate(`import("/src/main.js").then(async m=>{const a=await m.showroom;const i=a.renderer.info;return {
      geometries:i.memory.geometries,textures:i.memory.textures,programs:i.programs?.length ?? null,
      calls:i.render.calls,triangles:i.render.triangles,heap:performance.memory?.usedJSHeapSize ?? null,
      flowLaunches:document.querySelectorAll('.flow-launch').length,flowPanels:document.querySelectorAll('.flow-panel').length,
      popups:document.querySelectorAll('.flow-equipment').length,leaders:document.querySelectorAll('.flow-equipment-leader').length,
      impactPanels:document.querySelectorAll('.flow-impact').length,
    }})`);
    cycleSamples.push(sample);
  }
  await evaluate('document.querySelector(".flow-launch").click()');
  await wait(1700);
  await press('Escape');
  await wait(1400);
  assert(await evaluate('!document.querySelector("[data-flow-active]")'), 'Escape did not exit System Flow');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await evaluate('document.querySelector(".flow-launch").click()');
  await wait(150);
  assert(!(await evaluate('import("/src/main.js").then(async m=>(await m.showroom).systemFlow.state.transitioning)')),
    'Reduced-motion preference did not remove the guided camera transition');
  await evaluate('document.querySelector("[data-flow=exit]").click()');
  await wait(1400);
  await send('Emulation.setEmulatedMedia', { features: [] });
  const renderFrame = () => evaluate('import("/src/main.js").then(async m=>(await m.showroom).renderer.info.render.frame)');
  const backgroundTarget = await send('Target.createTarget', { url: 'about:blank' });
  await send('Target.activateTarget', { targetId: backgroundTarget.targetId });
  await wait(350);
  const hidden = await evaluate('document.hidden');
  const hiddenFrame = await renderFrame();
  await wait(350);
  const hiddenFrameAfter = await renderFrame();
  await send('Target.activateTarget', { targetId: page.id });
  await wait(350);
  const resumedFrame = await renderFrame();
  await send('Target.closeTarget', { targetId: backgroundTarget.targetId });
  assert(hidden && hiddenFrameAfter === hiddenFrame && resumedFrame > hiddenFrameAfter,
    'Rendering did not pause/resume when switching tabs');
  const responsive = [];
  for (const width of [390, 768, 1024, 1440, 720]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await wait(250);
    responsive.push(await evaluate(`({width:${width},viewport:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,canvasWidth:document.querySelector('canvas').clientWidth})`));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  assert(stepTitles.every(items => items.join('|') === 'Return Air|Energy Recovery|Exhaust|Fresh Outdoor Air|Heat Pump|Supply Air'), 'Unexpected six-step sequence');
  assert(responsive.every(item => item.scrollWidth <= item.viewport), 'Horizontal overflow at responsive width');
  assert(errors.length === 0, `Console/runtime errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ basics, stepTitles, smokeChecks, cycleSamples, responsive, errors }, null, 2));
} finally { socket.close(); }
