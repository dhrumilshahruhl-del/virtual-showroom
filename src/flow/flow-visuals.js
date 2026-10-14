import * as THREE from 'three';
import { buildPipeTopology } from './pipe-topology.js';

export function createFlowVisuals(building) {
  const topology = buildPipeTopology(building);
  const stepBit = { value: 1 };
  const equipmentZone = { value: 1 };
  const enabled = { value: 0 };
  const time = { value: 0 };
  const color = { value: new THREE.Color('#47aaff') };
  const resources = [];
  for (const { node, renderData } of topology.meshes) {
    const previousAttribute = node.geometry.getAttribute('flowSurface');
    node.geometry.setAttribute('flowSurface', new THREE.BufferAttribute(renderData, 4));
    const original = node.material;
    const materials = (Array.isArray(original) ? original : [original]).map((source) => {
      const material = source.clone();
      material.onBeforeCompile = (shader) => {
        shader.uniforms.flowBit = stepBit;
        shader.uniforms.flowZone = equipmentZone;
        shader.uniforms.flowEnabled = enabled;
        shader.uniforms.flowTime = time;
        shader.uniforms.flowColor = color;
        shader.vertexShader = 'attribute vec4 flowSurface;\nuniform float flowBit;\nuniform float flowZone;\nvarying vec4 vFlowSurface;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vFlowSurface = vec4(flowSurface.y, mod(floor(flowSurface.x / flowBit), 2.0),
            float(abs(flowSurface.z - flowZone) < 0.1), float(flowSurface.z > 0.5));`);
        shader.fragmentShader = 'uniform float flowEnabled;\nuniform float flowTime;\nuniform vec3 flowColor;\nvarying vec4 vFlowSurface;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          float membership = smoothstep(0.35, 0.8, vFlowSurface.y) * flowEnabled;
          // Geodesic distance on actual mesh edges, never a free-space spline.
          float wave = pow(0.5 + 0.5 * cos(vFlowSurface.x * 3.2 + flowTime * 3.0), 6.0);
          float signal = membership * (0.16 + 0.84 * wave);
          diffuseColor.rgb *= 1.0 - 0.16 * vFlowSurface.w * (1.0 - vFlowSurface.z) * flowEnabled;
          diffuseColor.rgb = mix(diffuseColor.rgb, flowColor, signal * 0.72);
          totalEmissiveRadiance += flowColor * signal * 0.65;
          totalEmissiveRadiance += vec3(0.02, 0.08, 0.10) * vFlowSurface.z * flowEnabled;`);
      };
      material.customProgramCacheKey = () => 'measured-surface-system-flow-v2';
      return material;
    });
    node.material = Array.isArray(original) ? materials : materials[0];
    resources.push({ node, original, materials, previousAttribute });
  }
  return {
    summary: topology.summary,
    setStep(step, index) {
      stepBit.value = 1 << index;
      equipmentZone.value = step.zone + 1;
      color.value.set(index === 1 || index === 5 ? '#ff9c4a' : index === 2 || index === 3 ? '#42ecff' : '#47aaff');
      time.value = 0;
    },
    setVisible(value) { enabled.value = value ? 1 : 0; },
    update(dt, reducedMotion) { if (!reducedMotion) time.value += dt; },
    dispose() {
      for (const resource of resources) {
        resource.node.material = resource.original;
        if (resource.previousAttribute) resource.node.geometry.setAttribute('flowSurface', resource.previousAttribute);
        else resource.node.geometry.deleteAttribute('flowSurface');
        resource.materials.forEach((material) => material.dispose());
      }
    },
  };
}
