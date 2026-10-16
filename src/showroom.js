import * as THREE from 'three';
import { prepareMaterials } from './camera/rooftop-camera.js';
import { createShowroomControls } from './controls/showroom-controls.js';
import { applyStudioEnvironment } from './environment/studio-environment.js';
import { createCityContext } from './environment/city-context.js';
import { EnvironmentManager } from './environment/EnvironmentManager.js';
import { createStudioLights } from './lighting/studio-lights.js';
import { cloneSceneFromGltf, loadGltf } from './loaders/model-loader.js';
import { createShowroomUi } from './ui/showroom-ui.js';
import { makeHeatPumpWallTranslucent } from './environment/heat-pump-wall.js';
import { createEquipmentModal } from './ui/equipment-modal.js';
import { createRooftopMarkers } from './hotspots/rooftop-markers.js';
import { createSystemFlow } from './flow/system-flow.js';

const DEFAULTS = {
  root: '#rooftop-showroom',
  buildingModel: './assets/models/200-water-building.opt.glb',
  hdri: './assets/canary_wharf_4k.hdr',
};

const DEFAULT_VIEW = {
  camera: {
    position: { x: -4.04481, y: 8.44405, z: 3.45996 },
    target: { x: -0.079, y: 3.4, z: 3.82373 },
    fov: 30,
  },
  building: {
    position: { x: -0.95273, y: 3.39428, z: 1.97859 },
    rotation: { x: 0, y: 3.83266, z: 0 },
    scale: { x: 0.06535, y: 0.06535, z: 0.06535 },
  },
};

export async function launchShowroom(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const root = typeof config.root === 'string' ? document.querySelector(config.root) : config.root;
  if (!root) throw new Error('Rooftop showroom root was not found.');

  const canvas = root.querySelector('canvas');
  const state = {};
  const ui = createShowroomUi(root, state);
  const equipmentModal = createEquipmentModal(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 500);
  const environment = new EnvironmentManager(renderer, scene, { hdriPath: config.hdri });
  scene.add(createStudioLights());
  applyStudioEnvironment(scene, 12);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  let controls = null;
  let buildingObject = null;
  let cityContext = null;
  let rooftopMarkers = null;
  let heatPumpWall = null;
  let systemFlow = null;
  let viewportHeight = 1;
  let intro = null;
  let disposed = false;
  const clock = new THREE.Clock();

  function resize() {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    viewportHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function enhancePbrMaterials(object) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!material) return;
        material.envMapIntensity = material.transparent || material.opacity < 0.86 ? 1.35 : 0.9;
        material.roughness = Math.max(material.roughness ?? 0.48, 0.28);
        material.metalness = material.metalness ?? 0.04;
        if (material.name?.toLowerCase().includes('glass') || material.transparent) {
          material.transparent = true;
          material.opacity = Math.min(material.opacity ?? 0.72, 0.74);
          material.roughness = 0.08;
          material.metalness = 0;
          material.envMapIntensity = 1.75;
        }
        material.needsUpdate = true;
      });
    });
  }

  function applyTransform(object, transform) {
    object.position.set(transform.position.x, transform.position.y, transform.position.z);
    object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    object.updateMatrixWorld(true);
  }

  function vectorFromSnapshot(snapshot) {
    return new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z);
  }

  function applyDefaultCamera() {
    camera.fov = DEFAULT_VIEW.camera.fov;
    camera.position.copy(vectorFromSnapshot(DEFAULT_VIEW.camera.position));
    camera.lookAt(vectorFromSnapshot(DEFAULT_VIEW.camera.target));
    camera.updateProjectionMatrix();
  }

  function roundNumber(value) {
    return Number(value.toFixed(5));
  }

  function vectorSnapshot(vector) {
    return {
      x: roundNumber(vector.x),
      y: roundNumber(vector.y),
      z: roundNumber(vector.z),
    };
  }

  function rotationSnapshot(object) {
    return {
      x: roundNumber(object.rotation.x),
      y: roundNumber(object.rotation.y),
      z: roundNumber(object.rotation.z),
    };
  }

  function scaleSnapshot(object) {
    return {
      x: roundNumber(object.scale.x),
      y: roundNumber(object.scale.y),
      z: roundNumber(object.scale.z),
    };
  }

  async function copyCurrentView() {
    if (!controls || !buildingObject) return;
    const snapshot = {
      camera: {
        position: vectorSnapshot(camera.position),
        target: vectorSnapshot(controls.target),
        fov: roundNumber(camera.fov),
      },
      building: {
        position: vectorSnapshot(buildingObject.position),
        rotation: rotationSnapshot(buildingObject),
        scale: scaleSnapshot(buildingObject),
      },
    };
    const text = JSON.stringify(snapshot, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      ui.setStatus('View coordinates copied. Paste them here and I will set them as the default.', 'info');
      window.setTimeout(() => ui.setStatus(''), 2600);
    } catch {
      console.log('SHOWROOM_VIEW_COORDINATES', snapshot);
      ui.setStatus('Clipboard blocked. Coordinates were printed in the browser console.', 'info');
      window.setTimeout(() => ui.setStatus(''), 3600);
    }
  }

  async function load() {
    const buildingModel = root.dataset.buildingModel || config.buildingModel;
    const [, buildingGltf] = await Promise.all([environment.load(), loadGltf(buildingModel)]);
    if (disposed) return;

    const building = cloneSceneFromGltf(buildingGltf);
    prepareMaterials(building);
    enhancePbrMaterials(building);
    applyTransform(building, DEFAULT_VIEW.building);
    heatPumpWall = makeHeatPumpWallTranslucent(building, root);
    buildingObject = building;

    modelRoot.add(building);

    applyDefaultCamera();
    const defaultTarget = vectorFromSnapshot(DEFAULT_VIEW.camera.target);
    rooftopMarkers = createRooftopMarkers(building);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    controls = createShowroomControls(camera, canvas, defaultTarget);
    controls.saveState();
    systemFlow = createSystemFlow({ root, building, city: cityContext, camera, controls,
      wall: heatPumpWall, markers: rooftopMarkers, modal: equipmentModal });

    intro = null;
    ui.setStatus('');
    // Optional context must never hold up controls or guided flow.
    void loadProgressiveCityContext(new THREE.Box3().setFromObject(building));
  }

  async function loadProgressiveCityContext(bounds) {
    try {
      const city = await createCityContext(bounds);
      if (disposed) { city.userData.dispose(); return; }
      cityContext = city;
      systemFlow.addCity(city);
      modelRoot.add(city);
      renderer.shadowMap.needsUpdate = true;
    } catch (error) {
      console.warn('Optional city context could not be loaded; rooftop remains available.', error);
    }
  }

  function resetView() {
    if (!controls || systemFlow?.active) return;
    controls.reset();
  }

  let pointerStart = null;
  function onPointerDown(event) {
    if (systemFlow?.active) return;
    pointerStart = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  }
  function onPointerUp(event) {
    const start = pointerStart;
    pointerStart = null;
    if (systemFlow?.active) return;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    const id = rooftopMarkers?.pick(camera,
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1);
    if (id) equipmentModal.open(id);
  }
  function onPointerMove(event) {
    if (systemFlow?.active) { canvas.style.cursor = 'default'; return; }
    if (event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    const hovered = rooftopMarkers?.pick(camera,
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1);
    canvas.style.cursor = event.buttons ? 'grabbing' : hovered ? 'pointer' : '';
  }
  function onPointerLeave() { canvas.style.cursor = ''; }
  function onPointerCancel() { pointerStart = null; onPointerLeave(); }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  ui.buttons.reset?.addEventListener('click', resetView);
  ui.buttons.copyView?.addEventListener('click', copyCurrentView);

  window.addEventListener('resize', resize);
  resize();

  load().catch((error) => {
    if (disposed) return;
    console.error(error);
    ui.setStatus('Unable to load the rooftop showroom assets.', 'error');
  });

  function renderFrame() {
    if (disposed || document.hidden) return;
    const frameDelta = Math.min(clock.getDelta(), 0.25);
    const dt = Math.min(frameDelta, 0.05);
    if (intro) {
      intro.elapsed += dt;
      const t = Math.min(intro.elapsed / intro.duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(intro.from, intro.to, eased);
      controls?.target.lerpVectors(intro.targetFrom, intro.targetTo, eased);
      camera.fov = THREE.MathUtils.lerp(intro.fovFrom, intro.fovTo, eased);
      camera.updateProjectionMatrix();
      camera.lookAt(controls?.target || intro.targetTo);
      if (t >= 1) {
        controls.enabled = true;
        intro = null;
      }
    }
    if (!systemFlow?.active) controls?.update();
    systemFlow?.update(frameDelta);
    rooftopMarkers?.update(camera, viewportHeight);
    if (heatPumpWall?.update(camera, systemFlow?.wallDelta(frameDelta) ?? dt)) renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function handleVisibilityChange() {
    clock.stop();
    if (document.hidden || disposed) renderer.setAnimationLoop(null);
    else {
      clock.start();
      renderer.setAnimationLoop(renderFrame);
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  handleVisibilityChange();

  return {
    root,
    scene,
    camera,
    renderer,
    get controls() { return controls; },
    get systemFlow() { return systemFlow; },
    resetView,
    dispose() {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      renderer.setAnimationLoop(null);
      controls?.dispose();
      systemFlow?.dispose();
      rooftopMarkers?.dispose();
      equipmentModal.dispose();
      heatPumpWall?.dispose();
      canvas.style.cursor = '';
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      cityContext?.userData?.dispose?.();
      environment.dispose();
      ui.buttons.reset?.removeEventListener('click', resetView);
      ui.buttons.copyView?.removeEventListener('click', copyCurrentView);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
