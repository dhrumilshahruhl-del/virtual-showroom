import fs from 'node:fs/promises';

const pages = await (await fetch('http://localhost:9223/json')).json();
const page = pages.find((entry) => entry.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(JSON.stringify(message.error)));
    else handlers.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params);
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
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(new URL(name, import.meta.url), Buffer.from(result.data, 'base64'));
}
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await evaluate(`document.querySelector('.showroom__status')?.textContent === ''`)) break;
    if (attempt === 89) throw new Error('Scene failed to become ready');
  }
  await evaluate(`import('/src/main.js').then(async m => { window.qaApp = await m.showroom; })`);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 500, deltaX: 0, deltaY: 1200 });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await evaluate(`(() => {
    const app = window.qaApp;
    if (app.camera.position.distanceTo(app.controls.target) > app.controls.maxDistance + 0.00001) {
      throw new Error('Wheel zoom exceeded the default distance');
    }
    app.controls.reset();
  })()`);
  await screenshot('environment-desktop.png');
  const stats = await evaluate(`(() => {
    const app = window.qaApp;
    const site = app.scene.getObjectByName('cityContext').userData.siteLayout;
    const markers = app.scene.getObjectByName('rooftopMarkers');
    if (!markers || markers.children.length !== 5) throw new Error('Missing rooftop markers');
    if (markers.parent !== app.scene.getObjectByName('cityContext').parent.children[0]) throw new Error('Markers are not attached to building');
    const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
    const roadOverlaps = [...site.buildings, ...site.parking].filter(rect => site.roads.some(road => overlaps(rect, road))).length;
    if (roadOverlaps) throw new Error('Building or parking footprint overlaps a road');
    if (site.parking.length !== 4 || site.trees.length === 0) throw new Error('Missing parking or trees');
    if (site.infillCount < 10) throw new Error('Missing surrounding infill buildings');
    for (let i = 0; i < site.buildings.length; i++) {
      if (site.buildings.slice(i + 1).some(other => overlaps(site.buildings[i], other))) {
        throw new Error('Building footprints overlap');
      }
    }
    app.renderer.render(app.scene, app.camera);
    const gl = app.renderer.getContext();
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4000) colors.add(pixels.slice(i, i + 3).join(','));
    return { roadOverlaps, infillBuildings: site.infillCount,
      maxZoomDistance: app.controls.maxDistance,
      parkingLots: site.parking.length, trees: site.trees.length,
      camera: app.camera.position.toArray(), target: app.controls.target.toArray(),
      sampledCanvasColors: colors.size, calls: app.renderer.info.render.calls, triangles: app.renderer.info.render.triangles,
      textures: app.renderer.info.memory.textures, cityBuildings: app.scene.getObjectByName('cityContext').children.filter(n => n.name.startsWith('cityContextBuilding_')).length };
  })()`);
  for (const [name, angle, factor] of [['environment-orbit.png', Math.PI, 1], ['environment-rooftop.png', Math.PI / 2, 0.6]]) {
    await evaluate(`(() => {
      const app = window.qaApp;
      app.controls.reset();
      app.controls.update();
      const offset = app.camera.position.clone().sub(app.controls.target);
      offset.applyAxisAngle(app.camera.up, ${angle}).multiplyScalar(${factor});
      app.camera.position.copy(app.controls.target).add(offset);
      app.controls.update();
    })()`);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await screenshot(name);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.reload', { ignoreCache: true });
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await evaluate(`document.querySelector('.showroom__status')?.textContent === ''`)) break;
    if (attempt === 89) throw new Error('Mobile scene failed to become ready');
  }
  await screenshot('environment-mobile.png');
  const report = { stats, errors };
  await fs.writeFile(new URL('environment-validation.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await send('Browser.close');
  socket.close();
}
