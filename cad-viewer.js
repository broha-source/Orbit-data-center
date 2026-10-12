import * as THREE from './assets/vendor/three/three.module.min.js';
import { GLTFLoader } from './assets/vendor/three/addons/loaders/GLTFLoader.js';

const host = document.querySelector('#cadViewer');
const loading = document.querySelector('#cadLoading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0xffffff, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const sdfCanvas = document.createElement('canvas');
sdfCanvas.className = 'cad-sdf-canvas';
sdfCanvas.width = 256;
sdfCanvas.height = 256;
host.appendChild(sdfCanvas);
const sdfContext = sdfCanvas.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10000);
camera.position.set(0, 0, 100);
camera.up.set(0, 1, 0);

const loader = new GLTFLoader();
const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xfafafa, side: THREE.DoubleSide, toneMapped: false });
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x6f7477, transparent: true, opacity: 0.96, toneMapped: false });
const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
const sdfTarget = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: true, stencilBuffer: false });
let model = null;
let requestId = 0;
let modelSpan = 1;
let representation = 'cad';

function updateRepresentation() {
  const sdf = representation === 'sdf';
  renderer.domElement.hidden = sdf;
  sdfCanvas.hidden = !sdf;
  if (sdf) renderSignedDistance();
}

function distanceTransform(feature) {
  const size = 256;
  const distance = new Float32Array(size * size);
  const diagonal = Math.SQRT2;
  for (let i = 0; i < distance.length; i += 1) distance[i] = feature[i] ? 0 : 1e6;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const i = y * size + x;
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1);
    if (y) distance[i] = Math.min(distance[i], distance[i - size] + 1);
    if (x && y) distance[i] = Math.min(distance[i], distance[i - size - 1] + diagonal);
    if (x < size - 1 && y) distance[i] = Math.min(distance[i], distance[i - size + 1] + diagonal);
  }
  for (let y = size - 1; y >= 0; y -= 1) for (let x = size - 1; x >= 0; x -= 1) {
    const i = y * size + x;
    if (x < size - 1) distance[i] = Math.min(distance[i], distance[i + 1] + 1);
    if (y < size - 1) distance[i] = Math.min(distance[i], distance[i + size] + 1);
    if (x < size - 1 && y < size - 1) distance[i] = Math.min(distance[i], distance[i + size + 1] + diagonal);
    if (x && y < size - 1) distance[i] = Math.min(distance[i], distance[i + size - 1] + diagonal);
  }
  return distance;
}

function renderSignedDistance() {
  if (!model || representation !== 'sdf') return;
  const pixels = new Uint8Array(256 * 256 * 4);
  const previousBackground = scene.background;
  const lines = [];
  model.traverse((child) => {
    if (child.isLineSegments) { lines.push(child); child.visible = false; }
    if (child.isMesh) child.material = maskMaterial;
  });
  scene.background = null;
  renderer.setRenderTarget(sdfTarget);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(sdfTarget, 0, 0, 256, 256, pixels);
  renderer.setRenderTarget(null);
  scene.background = previousBackground;
  model.traverse((child) => { if (child.isMesh) child.material = faceMaterial; });
  lines.forEach((line) => { line.visible = true; });

  const inside = new Uint8Array(256 * 256);
  for (let i = 0; i < inside.length; i += 1) inside[i] = pixels[i * 4] > 127 ? 1 : 0;
  const solidFeature = inside;
  const fluidFeature = new Uint8Array(inside.length);
  for (let i = 0; i < inside.length; i += 1) fluidFeature[i] = inside[i] ? 0 : 1;
  const toSolid = distanceTransform(solidFeature);
  const toFluid = distanceTransform(fluidFeature);
  const image = sdfContext.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) for (let x = 0; x < 256; x += 1) {
    const source = (255 - y) * 256 + x;
    const signed = inside[source] ? toFluid[source] : -toSolid[source];
    const normalized = Math.max(-1, Math.min(1, signed / 18));
    const edge = Math.exp(-Math.abs(signed) / 2.4);
    const i = (y * 256 + x) * 4;
    if (normalized >= 0) {
      image.data[i] = Math.round(18 + edge * 95);
      image.data[i + 1] = Math.round(61 + normalized * 92 + edge * 86);
      image.data[i + 2] = Math.round(78 + normalized * 120 + edge * 80);
    } else {
      const n = -normalized;
      image.data[i] = Math.round(18 + n * 52 + edge * 70);
      image.data[i + 1] = Math.round(24 + n * 18 + edge * 38);
      image.data[i + 2] = Math.round(32 + n * 20 + edge * 35);
    }
    image.data[i + 3] = 255;
  }
  sdfContext.putImageData(image, 0, 0);
}

function disposeModel() {
  if (!model) return;
  scene.remove(model);
  model.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material && child.material !== faceMaterial && child.material !== edgeMaterial) child.material.dispose?.();
  });
  model = null;
}

function updateFrustum() {
  const rect = host.getBoundingClientRect();
  const aspect = Math.max(rect.width / Math.max(rect.height, 1), 0.1);
  let viewWidth = modelSpan * 1.16;
  let viewHeight = modelSpan * 1.16;
  if (aspect >= 1) viewWidth *= aspect;
  else viewHeight /= aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  modelSpan = Math.max(size.x, size.y, 1);
  camera.near = 0.01;
  camera.far = Math.max(modelSpan * 20, 100);
  camera.position.set(0, 0, Math.max(modelSpan * 3, size.z * 4 + 10));
  camera.lookAt(0, 0, 0);
  updateFrustum();
}

function styleModel(object) {
  const meshes = [];
  object.traverse((child) => { if (child.isMesh) meshes.push(child); });
  meshes.forEach((mesh) => {
    mesh.material = faceMaterial;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 12), edgeMaterial);
    lines.renderOrder = 2;
    mesh.add(lines);
  });
}

function loadModel({ familyId = 'F0', file = 'F0_0001.glb', label = 'CAD 01 / 30' }) {
  const activeRequest = ++requestId;
  loading.hidden = false;
  loading.textContent = `LOADING ${familyId} · ${label}`;
  loader.load(`assets/cad/${familyId}/${file}`, (gltf) => {
    if (activeRequest !== requestId) return;
    disposeModel();
    model = gltf.scene;
    styleModel(model);
    scene.add(model);
    frameModel(model);
    renderSignedDistance();
    loading.hidden = true;
  }, undefined, () => {
    if (activeRequest !== requestId) return;
    loading.textContent = 'CAD MODEL COULD NOT BE LOADED';
  });
}

addEventListener('cad-model-change', (event) => loadModel(event.detail));
addEventListener('cad-view-change', (event) => {
  representation = event.detail.view;
  updateRepresentation();
});

function resize() {
  const rect = host.getBoundingClientRect();
  renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
  updateFrustum();
  renderSignedDistance();
}

new ResizeObserver(resize).observe(host);
resize();

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();
updateRepresentation();

loadModel({ familyId: 'F0', file: 'F0_0001.glb', label: 'CAD 01 / 30' });
dispatchEvent(new CustomEvent('cad-viewer-ready'));
