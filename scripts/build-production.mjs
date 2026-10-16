import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, 'dist');
if (output !== path.join(root, 'dist')) throw new Error('Refusing to write outside the project dist folder.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const copy = async (from, to = from) => {
  const destination = path.join(output, to);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, from), destination, { recursive: true });
};
const runtimeFiles = [
  copy('index.html'),
  copy('LICENSE'),
  copy('THIRD-PARTY-NOTICES.txt'),
  copy('assets/canary_wharf_4k.hdr'),
  copy('assets/models/200-water-building.opt.glb'),
  copy('assets/equipments/ahu.png'),
  copy('assets/equipments/ahu-popup.webp'),
  copy('assets/equipments/heat_pump.png'),
  copy('assets/equipments/heat_pump-popup.webp'),
  ...[
    'src/config.js', 'src/main.js', 'src/showroom.js',
    'src/camera/rooftop-camera.js', 'src/controls/showroom-controls.js',
    'src/environment/EnvironmentManager.js', 'src/environment/city-context.js',
    'src/environment/city-facades.js', 'src/environment/city-infill.js',
    'src/environment/city-site.js', 'src/environment/heat-pump-wall.js',
    'src/environment/site-landscaping.js', 'src/environment/studio-environment.js',
    'src/flow/airflow-smoke.js', 'src/flow/flow-focus.js', 'src/flow/flow-visuals.js',
    'src/flow/pipe-topology.js', 'src/flow/system-flow-data.js', 'src/flow/system-flow.js',
    'src/hotspots/rooftop-markers.js', 'src/lighting/studio-lights.js',
    'src/loaders/city-assets.js', 'src/loaders/model-loader.js',
    'src/ui/equipment-modal.js', 'src/ui/flow-equipment.js', 'src/ui/flow-impact.js',
    'src/ui/showroom-ui.js', 'src/ui/showroom.css',
    'src/vendor/three/LICENSE', 'src/vendor/three/build/three.module.js',
    'src/vendor/three/examples/jsm/controls/OrbitControls.js',
    'src/vendor/three/examples/jsm/libs/meshopt_decoder.module.js',
    'src/vendor/three/examples/jsm/loaders/GLTFLoader.js',
    'src/vendor/three/examples/jsm/loaders/RGBELoader.js',
    'src/vendor/three/examples/jsm/utils/BufferGeometryUtils.js',
  ].map(file => copy(file)),
  ...[
    'T_Concrete_Asphalt_BaseColor.png', 'T_Concrete_BaseColor.png', 'T_Concrete_Normal.png', 'T_Concrete_ORM.png',
    'T_dark_interior.png', 'T_lit_interior_1.png', 'T_lit_interior_2.png',
    'T_MarbleFloor_BaseColor.png', 'T_MarbleFloor_Normal.png', 'T_MarbleFloor_ORM.png',
    'T_MetalConcrete_BaseColor.png', 'T_MetalConcrete_Normal.png', 'T_MetalConcrete_ORM.png',
    'T_RedBrick_BaseColor.png', 'T_RedBrick_Normal.png', 'T_RedBrick_ORM.png',
    'T_Trim_BaseColor.png', 'T_Trim_Normal.png', 'T_Trim_ORM.png',
  ].map(file => copy(`assets/city-context/textures/${file}`)),
];
await Promise.all(runtimeFiles);

const cityOutput = path.join(output, 'assets/city-context');
await mkdir(cityOutput, { recursive: true });
for (const name of ['Building_Large_2.gltf', 'Building_Medium_2_001.gltf', 'Building_Small_1.gltf']) {
  const source = JSON.parse(await readFile(path.join(root, 'assets/city-context', name), 'utf8'));
  for (const buffer of source.buffers || []) {
    if (!buffer.uri) continue;
    const sourceBuffer = path.resolve(root, 'assets/city-context', buffer.uri);
    const allowedSourceRoot = path.resolve(root, 'assets/models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)');
    if (!sourceBuffer.startsWith(allowedSourceRoot + path.sep)) throw new Error(`Unexpected city buffer path: ${buffer.uri}`);
    const basename = path.basename(buffer.uri);
    await cp(sourceBuffer, path.join(cityOutput, basename));
    buffer.uri = basename;
  }
  await writeFile(path.join(cityOutput, name), `${JSON.stringify(source)}\n`);
}

const publicFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else publicFiles.push(path.relative(output, absolute).replaceAll(path.sep, '/'));
  }
}
await walk(output);
publicFiles.sort();
if (publicFiles.some(file => /(^|\/)(docs|scripts|node_modules|\.git)(\/|$)|\.map$/i.test(file))) {
  throw new Error('Production output contains a development or source-map path.');
}
publicFiles.push('production-files.json');
publicFiles.sort();
await writeFile(path.join(output, 'production-files.json'), `${JSON.stringify(publicFiles, null, 2)}\n`);
console.log(`Production output: ${publicFiles.length} runtime files in dist/`);
