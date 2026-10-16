import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();

export function resolveAssetUrl(path) {
  return new URL(path, document.baseURI).href;
}

export function loadGltf(path, onProgress) {
  const url = resolveAssetUrl(path);
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url, onProgress).catch((error) => {
      cache.delete(url);
      throw error;
    }));
  }
  return cache.get(url);
}

export function cloneSceneFromGltf(gltf) {
  return gltf.scene.clone(true);
}
