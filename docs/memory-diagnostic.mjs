// Diagnostic only. Requires the local server on 4173 and Chrome CDP on 9226.
// It does not import production code or change production behavior.
const pages = await (await fetch('http://localhost:9226/json')).json();
const page = pages.find(p => p.type === 'page');
if (!page) throw new Error('No diagnostic browser page found on CDP port 9226.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id) return;
  const task = pending.get(message.id);
  pending.delete(message.id);
  message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (expression, label) => {
  for (let i = 0; i < 160; i++) {
    if (await evaluate(expression)) return;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

async function snapshot(label) {
  return evaluate(`(() => {
    const app = qaApp;
    const textureRefs = new Map();
    const geometryRefs = new Map();
    const materialRefs = new Map();
    const categories = object => {
      let current = object;
      while (current) {
        if (current.name === 'cityContext') return 'CITY';
        if (current.name === 'airflowSmoke') return 'FLOW';
        current = current.parent;
      }
      return 'ROOFTOP';
    };
    const addTexture = (texture, category, owner) => {
      if (!texture?.isTexture) return;
      const current = textureRefs.get(texture.uuid) || { texture, refs: 0, categories: new Set(), owners: new Set() };
      current.refs++;
      current.categories.add(category);
      if (owner) current.owners.add(owner);
      textureRefs.set(texture.uuid, current);
    };
    const addMaterial = (material, category) => {
      if (!material) return;
      materialRefs.set(material.uuid, (materialRefs.get(material.uuid) || 0) + 1);
      for (const key of Object.keys(material)) {
        const value = material[key];
        if (value?.isTexture) addTexture(value, category, material.name || material.uuid);
      }
    };
    const addGeometry = (geometry, category) => {
      if (!geometry) return;
      const current = geometryRefs.get(geometry.uuid) || { geometry, categories: new Set() };
      current.categories.add(category); geometryRefs.set(geometry.uuid, current);
    };
    const categoryBytes = { ROOFTOP: 0, CITY: 0, PROCEDURAL_CITY: 0, FLOW: 0, OTHER: 0 };
    const geometryRows = [];
    app.scene.traverse(node => {
      if (!node.isMesh && !node.isLine && !node.isPoints) return;
      const category = categories(node);
      if (node.geometry) addGeometry(node.geometry, category);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => addMaterial(material, category));
    });
    addTexture(app.scene.background, 'HDRI / ENVIRONMENT', 'scene.background');
    addTexture(app.scene.environment, 'PMREM GENERATED', 'scene.environment');
    for (const entry of geometryRefs.values()) {
      let bytes = 0;
      for (const attribute of Object.values(entry.geometry.attributes || {})) bytes += attribute.array?.byteLength || 0;
      bytes += entry.geometry.index?.array?.byteLength || 0;
      const category = [...entry.categories][0] || 'OTHER';
      categoryBytes[category] = (categoryBytes[category] || 0) + bytes;
      geometryRows.push({ uuid: entry.geometry.uuid, categories: [...entry.categories], bytes });
    }
    const textures = [...textureRefs.values()].map(entry => {
      const t = entry.texture;
      const image = t.image || t.source?.data;
      const width = image?.width || image?.videoWidth || 0;
      const height = image?.height || image?.videoHeight || 0;
      const bpp = t.isCompressedTexture ? null : t.type === 1015 ? 8 : 4;
      const baseBytes = bpp ? width * height * bpp : null;
      const mipFactor = t.generateMipmaps ? 4 / 3 : 1;
      return {
        uuid: t.uuid, refs: entry.refs, categories: [...entry.categories], owners: [...entry.owners].slice(0, 6),
        source: image?.src || image?.currentSrc || t.userData?.source || null,
        imageType: image?.constructor?.name || null,
        sourceUuid: t.source?.uuid || null,
        width, height, format: t.isCompressedTexture ? 'compressed/unknown' : t.format,
        type: t.type, colorSpace: t.colorSpace, generateMipmaps: t.generateMipmaps,
        minFilter: t.minFilter, magFilter: t.magFilter, anisotropy: t.anisotropy,
        wrapS: t.wrapS, wrapT: t.wrapT, compressed: Boolean(t.isCompressedTexture),
        estimatedBytes: baseBytes === null ? null : Math.round(baseBytes * mipFactor),
      };
    }).sort((a, b) => (b.estimatedBytes || 0) - (a.estimatedBytes || 0));
    const background = app.scene.background;
    const environment = app.scene.environment;
    const dimensions = { x: app.renderer.domElement.width, y: app.renderer.domElement.height };
    const shadowMaps = [];
    app.scene.traverse(node => { if (node.isLight && node.shadow?.map) shadowMaps.push({ name: node.name, width: node.shadow.map.width, height: node.shadow.map.height }); });
    return {
      label: ${JSON.stringify(label)}, now: new Date().toISOString(), viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, rendererPixelRatio: app.renderer.getPixelRatio(), drawingBufferWidth: dimensions.x, drawingBufferHeight: dimensions.y },
      rendererInfo: { memory: { ...app.renderer.info.memory }, render: { ...app.renderer.info.render }, programs: app.renderer.info.programs?.length ?? null },
      jsHeap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize, limit: performance.memory.jsHeapSizeLimit } : null,
      domElements: document.querySelectorAll('*').length,
      cityContexts: app.scene.children.filter(n => n.name === 'cityContext').length,
      smokePools: app.scene.getObjectsByProperty('name', 'airflowSmoke').length,
      textures, geometryRows, geometryBytes: categoryBytes,
      materials: { unique: materialRefs.size, refs: [...materialRefs.values()].reduce((a, b) => a + b, 0) },
      environment: {
        background: background ? { uuid: background.uuid, width: background.image?.width || 0, height: background.image?.height || 0, type: background.type, format: background.format, colorSpace: background.colorSpace } : null,
        environment: environment ? { uuid: environment.uuid, image: environment.image ? { width: environment.image.width || 0, height: environment.image.height || 0, depth: environment.image.depth || 0 } : null, type: environment.type, format: environment.format, colorSpace: environment.colorSpace } : null,
        sameTexture: background === environment,
      },
      shadows: { enabled: app.renderer.shadowMap.enabled, type: app.renderer.shadowMap.type, maps: shadowMaps },
      canvas: { antialias: true, alpha: false },
    };
  })()`);
}

async function flowStep(index) {
  await evaluate(`document.querySelector('[data-step="${index}"]').click()`);
  await until(`!qaApp.systemFlow.state.transitioning && qaApp.systemFlow.state.pendingStep === null`, `flow step ${index}`);
  await wait(250);
}

try {
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setEmulatedMedia', { features: [] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  await until(`!!document.querySelector('.flow-launch')`, 'essential rooftop readiness');
  console.error('essential-ready');
  await evaluate(`(async()=>{window.qaApp=await(await import('/src/main.js')).showroom})()`);
  const beforeCity = await snapshot('B essential rooftop before city');
  console.error('before-city');
  await until(`!!qaApp.scene.getObjectByName('cityContext')`, 'progressive city');
  const afterCity = await snapshot('A fully loaded city');
  console.error('after-city');
  console.log(JSON.stringify({ beforeCity, afterCity }, null, 2));
} finally { socket.close(); }
