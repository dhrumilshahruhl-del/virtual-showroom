import * as THREE from 'three';
import { FLOW_STEPS } from './system-flow-data.js';
import { createFlowVisuals } from './flow-visuals.js';

const CAMERA_DURATION = 1.5;
const ease = (t) => t * t * (3 - 2 * t);

export function createSystemFlow({ root, building, camera, controls, wall, markers, modal }) {
  const visuals = createFlowVisuals(building);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'flow-launch';
  launch.innerHTML = '<span aria-hidden="true">▶</span> Explore System Flow';
  launch.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'flow-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Guided system flow');
  panel.innerHTML = `
    <div class="flow-panel__top"><span class="flow-panel__eyebrow">System Flow</span><span class="flow-panel__count"></span></div>
    <nav class="flow-panel__steps" aria-label="System flow steps">${FLOW_STEPS.map((step, i) =>
      `<button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${step.title}" title="${step.title}">${i + 1}</button>`).join('')}</nav>
    <div class="flow-panel__copy" aria-live="polite" aria-atomic="true"><h2></h2><p></p></div>
    <div class="flow-panel__legend"><span data-kind="fresh">Fresh air</span><span data-kind="exhaust">Exhaust air</span><span data-kind="energy">Energy only</span></div>
    <p class="flow-panel__principle">Air stays separate. Only energy is recovered.</p>
    <p class="flow-panel__detail"></p>
    <div class="flow-panel__navigation"><button type="button" data-flow="previous">Previous</button><button type="button" data-flow="next">Next step</button></div>
    <div class="flow-panel__controls"><button type="button" data-flow="pause">Pause</button><button type="button" data-flow="restart">Restart</button><button type="button" data-flow="exit">Exit Flow</button></div>`;
  root.append(launch, panel);
  const heading = panel.querySelector('h2');
  const description = panel.querySelector('.flow-panel__copy p');
  const count = panel.querySelector('.flow-panel__count');
  const pauseButton = panel.querySelector('[data-flow="pause"]');
  const detail = panel.querySelector('.flow-panel__detail');
  const previousButton = panel.querySelector('[data-flow="previous"]');
  const nextButton = panel.querySelector('[data-flow="next"]');
  const stepButtons = [...panel.querySelectorAll('[data-step]')];
  const reset = root.querySelector('[data-action="reset"]');
  let mode = 'idle';
  let paused = false;
  let stepIndex = 0;
  let transition = null;
  let snapshot = null;
  let pendingStep = null;
  const visitedSteps = new Set();
  const projected = new THREE.Vector3();
  const cameraLocal = new THREE.Vector3();
  const target = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const direction = new THREE.Vector3(1, 1.25, 1).normalize();
  const cameraMove = { from: new THREE.Vector3(), to: new THREE.Vector3(), targetFrom: new THREE.Vector3(),
    targetTo: new THREE.Vector3(), elapsed: 0, duration: CAMERA_DURATION };
  const framing = { x: 0, y: 0 };

  function frameBesidePanel(dt) {
    const bounds = root.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    let x = 0, y = 0;
    if (mode === 'playing') {
      if (root.clientWidth <= 600) y = (root.clientHeight - (rect.top - bounds.top - 16)) / 2;
      else x = -(rect.right - bounds.left + 24) / 2;
    }
    const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 8);
    framing.x = THREE.MathUtils.lerp(framing.x, x, amount);
    framing.y = THREE.MathUtils.lerp(framing.y, y, amount);
    camera.setViewOffset(root.clientWidth, root.clientHeight, framing.x, framing.y, root.clientWidth, root.clientHeight);
  }

  function moveCamera(position, lookAt, duration) {
    cameraMove.from.copy(camera.position);
    cameraMove.to.copy(position);
    cameraMove.targetFrom.copy(controls.target);
    cameraMove.targetTo.copy(lookAt);
    cameraMove.elapsed = 0;
    cameraMove.duration = reducedMotion.matches ? 0 : duration;
    transition = cameraMove;
  }

  function frameStep(step) {
    target.fromArray(step.focus);
    building.localToWorld(target);
    // Fit both active units even on portrait screens; camera remains outside
    // the room and views its interior through the translucent front wall.
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const scale = building.getWorldScale(projected).x;
    const distance = step.span * scale * 0.6 / Math.tan(halfFov) / Math.min(1, camera.aspect);
    direction.fromArray(step.viewDirection || [1, 1.25, 1]).normalize();
    destination.copy(direction);
    destination.transformDirection(building.matrixWorld).multiplyScalar(distance);
    destination.add(target);
    moveCamera(destination, target, CAMERA_DURATION);
  }

  function showStep(index) {
    stepIndex = index;
    visitedSteps.add(index);
    pendingStep = null;
    const step = FLOW_STEPS[index];
    wall.setTranslucent(index === 3);
    visuals.setStep(step, index);
    frameStep(step);
    heading.textContent = step.title;
    description.textContent = step.description;
    detail.textContent = step.detail;
    previousButton.disabled = index === 0;
    nextButton.textContent = index === FLOW_STEPS.length - 1 ? 'Finish' : 'Next step';
    count.textContent = `${index + 1} / 6`;
    pauseButton.disabled = false;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    stepButtons.forEach((button, i) => {
      button.dataset.state = i === index ? 'active' : visitedSteps.has(i) ? 'done' : 'upcoming';
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function goTo(index) {
    if (mode !== 'playing' || index < 0 || index >= FLOW_STEPS.length) return;
    // Finish closing the room before proceeding from the heat pump step.
    if (stepIndex === 3 && index !== 3 && !wall.settled) {
      wall.setTranslucent(false);
      pendingStep = index;
    } else if (stepIndex === 3 && index !== 3 && wall.translucent) {
      wall.setTranslucent(false);
      pendingStep = index;
    } else showStep(index);
  }

  function start() {
    if (mode !== 'idle') return;
    snapshot = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov,
      controlsEnabled: controls.enabled, wallTranslucent: wall.translucent,
      view: camera.view?.enabled ? { ...camera.view } : null };
    // Drain any remaining orbit damping before taking over the camera.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    controls.enabled = false;
    modal.close();
    markers.setEnabled(false);
    wall.setGuided(true);
    if (reset) reset.disabled = true;
    root.dataset.flowActive = 'true';
    mode = 'playing';
    paused = false;
    visitedSteps.clear();
    visuals.setVisible(true);
    launch.hidden = true;
    panel.hidden = false;
    showStep(0);
    pauseButton.focus({ preventScroll: true });
  }

  function exit() {
    if (mode !== 'playing') return;
    mode = 'returning';
    paused = false;
    pendingStep = null;
    visuals.setVisible(false);
    wall.setTranslucent(snapshot.wallTranslucent);
    moveCamera(snapshot.position, snapshot.target, 1.2);
    panel.hidden = true;
  }

  launch.addEventListener('click', start);
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.step !== undefined) {
      paused = false;
      pauseButton.textContent = 'Pause';
      goTo(Number(button.dataset.step));
    }
    else if (button.dataset.flow === 'previous' || button.dataset.flow === 'next') {
      paused = false;
      const requested = pendingStep ?? stepIndex;
      if (button.dataset.flow === 'next' && requested === FLOW_STEPS.length - 1) exit();
      else goTo(requested + (button.dataset.flow === 'next' ? 1 : -1));
    }
    else if (button.dataset.flow === 'pause') {
      paused = !paused;
      pauseButton.textContent = paused ? 'Resume' : 'Pause';
    } else if (button.dataset.flow === 'restart') {
      paused = false;
      visitedSteps.clear();
      goTo(0);
    } else if (button.dataset.flow === 'exit') exit();
  });
  function onKey(event) { if (event.key === 'Escape' && mode === 'playing') exit(); }
  window.addEventListener('keydown', onKey);

  return {
    get active() { return mode !== 'idle'; },
    get state() { return { mode, paused, step: stepIndex, pendingStep, transitioning: Boolean(transition) }; },
    get topology() { return visuals.summary; },
    update(dt) {
      if (mode === 'idle') {
        projected.set(5.5, 11.5, -35);
        building.localToWorld(projected).project(camera);
        cameraLocal.copy(camera.position);
        building.worldToLocal(cameraLocal);
        launch.hidden = cameraLocal.y < 14 || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95;
        return;
      }
      if (paused) return;
      frameBesidePanel(dt);
      if (transition) {
        transition.elapsed += dt;
        const t = transition.duration ? Math.min(1, transition.elapsed / transition.duration) : 1;
        const eased = ease(t);
        camera.position.lerpVectors(transition.from, transition.to, eased);
        // Lift the middle of the move slightly to pass above roof details.
        if (!reducedMotion.matches && mode !== 'returning') camera.position.y += Math.sin(Math.PI * t) * 0.22;
        controls.target.lerpVectors(transition.targetFrom, transition.targetTo, eased);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
        if (t === 1) {
          transition = null;
          if (mode === 'returning') {
            camera.fov = snapshot.fov;
            if (snapshot.view) {
              const v = snapshot.view;
              camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
            } else camera.clearViewOffset();
            framing.x = framing.y = 0;
            camera.updateProjectionMatrix();
            controls.enabled = snapshot.controlsEnabled;
            markers.setEnabled(true);
            wall.setGuided(false);
            if (reset) reset.disabled = false;
            delete root.dataset.flowActive;
            mode = 'idle';
            launch.hidden = false;
            launch.focus({ preventScroll: true });
            return;
          }
        }
      }
      if (mode !== 'playing') return;
      visuals.update(dt, reducedMotion.matches);
      if (pendingStep !== null) {
        if (wall.settled) showStep(pendingStep);
        return;
      }
    },
    wallDelta(dt) { return mode === 'playing' && paused ? 0 : dt; },
    dispose() {
      window.removeEventListener('keydown', onKey);
      launch.remove();
      panel.remove();
      visuals.dispose();
      if (snapshot && mode !== 'idle') {
        controls.enabled = snapshot.controlsEnabled;
        wall.setTranslucent(snapshot.wallTranslucent);
        wall.setGuided(false);
        markers.setEnabled(true);
        if (reset) reset.disabled = false;
        delete root.dataset.flowActive;
      }
    },
  };
}
