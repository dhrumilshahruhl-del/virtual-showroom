const pages = await (await fetch('http://localhost:9223/json')).json();
const socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  if (!response.id) return;
  const handlers = pending.get(response.id);
  pending.delete(response.id);
  response.error ? handlers.reject(new Error(JSON.stringify(response.error))) : handlers.resolve(response.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const ready = await send('Runtime.evaluate', { expression: `document.querySelector('.showroom__status')?.textContent === ''`, returnByValue: true });
    if (ready.result.value) break;
    if (attempt === 59) throw new Error('Showroom did not load');
  }
  const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const THREE = await import('three');
    const app = await (await import('/src/main.js')).showroom;
    const building = app.scene.getObjectByName('cityContext').parent.children[0];
    building.updateMatrixWorld(true);
    app.camera.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    const inverse = building.matrixWorld.clone().invert();
    return [['left-equipment', 165, 345], ['upper-unit-1', 690, 253],
      ['upper-unit-2', 837, 253], ['right-equipment', 984, 353], ['central-structure', 763, 409]]
      .map(([id, x, y]) => {
        raycaster.setFromCamera(new THREE.Vector2(x / 1440 * 2 - 1, 1 - y / 1000 * 2), app.camera);
        const hit = raycaster.intersectObject(building, true)[0];
        if (!hit) throw new Error('No building surface at ' + id);
        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(inverse);
        return { id, position: building.worldToLocal(hit.point.clone()).toArray(), normal: normal.toArray() };
      });
  })()` });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  console.log(JSON.stringify(result.result.value, null, 2));
} finally {
  await send('Browser.close');
  socket.close();
}
