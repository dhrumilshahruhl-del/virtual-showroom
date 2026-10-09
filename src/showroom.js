import * as THREE from 'three';
import { prepareMaterials } from './camera/rooftop-camera.js';
import { createShowroomControls } from './controls/showroom-controls.js';
import { applyStudioEnvironment } from './environment/studio-environment.js';
import { createCityContext } from './environment/city-context.js';
import { EnvironmentManager } from './environment/EnvironmentManager.js';
import { createStudioLights } from './lighting/studio-lights.js';
import { cloneSceneFromGltf, loadGltf } from './loaders/model-loader.js';
import { createShowroomUi } from './ui/showroom-ui.js';
import { createRooftopMarkers } from './hotspots/rooftop-markers.js';

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

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    await environment.load();
    const buildingGltf = await loadGltf(buildingModel);

    const building = cloneSceneFromGltf(buildingGltf);
    prepareMaterials(building);
    enhancePbrMaterials(building);
    applyTransform(building, DEFAULT_VIEW.building);
    buildingObject = building;

    modelRoot.add(building);

    applyDefaultCamera();
    const defaultTarget = vectorFromSnapshot(DEFAULT_VIEW.camera.target);
    cityContext = await createCityContext(new THREE.Box3().setFromObject(building));
    modelRoot.add(cityContext);
    rooftopMarkers = createRooftopMarkers(building);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    controls = createShowroomControls(camera, canvas, defaultTarget);
    controls.saveState();

    intro = null;
    ui.setStatus('');
  }

  function resetView() {
    if (!controls) return;
    controls.reset();
  }

  ui.buttons.reset?.addEventListener('click', resetView);
  ui.buttons.copyView?.addEventListener('click', copyCurrentView);

  window.addEventListener('resize', resize);
  resize();

  load().catch((error) => {
    console.error(error);
    ui.setStatus('Unable to load the rooftop showroom assets.', 'error');
  });

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
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
    controls?.update();
    rooftopMarkers?.update(camera, viewportHeight);
    renderer.render(scene, camera);
  });

  return {
    root,
    scene,
    camera,
    renderer,
    get controls() { return controls; },
    resetView,
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      controls?.dispose();
      rooftopMarkers?.dispose();
      cityContext?.userData?.dispose?.();
      environment.dispose();
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
