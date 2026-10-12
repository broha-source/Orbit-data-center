import * as THREE from './assets/vendor/three/three.module.min.js';
import { GLTFLoader } from './assets/vendor/three/addons/loaders/GLTFLoader.js';

const host = document.querySelector('#cadViewer');
const loading = document.querySelector('#cadLoading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0xffffff, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10000);
camera.position.set(0, 0, 100);
camera.up.set(0, 1, 0);

const loader = new GLTFLoader();
const faceMaterial = new THREE.MeshBasicMaterial({ color: 0xfafafa, side: THREE.DoubleSide, toneMapped: false });
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x6f7477, transparent: true, opacity: 0.96, toneMapped: false });
let model = null;
let endpointGroup = null;
let requestId = 0;
let modelSpan = 1;

function disposeModel() {
  if (!model) return;
  scene.remove(model);
  if (endpointGroup) {
    scene.remove(endpointGroup);
    endpointGroup.traverse((child) => child.geometry?.dispose());
    endpointGroup = null;
  }
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
  endpointGroup = new THREE.Group();
  const markerGeometry = new THREE.PlaneGeometry(modelSpan * 0.012, modelSpan * 0.045);
  const inlet = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: 0x2768d7, toneMapped: false }));
  const outlet = new THREE.Mesh(markerGeometry.clone(), new THREE.MeshBasicMaterial({ color: 0xb52e31, toneMapped: false }));
  const markerZ = size.z * 0.5 + modelSpan * 0.015;
  inlet.position.set(-size.x * 0.5, -size.y * 0.5, markerZ);
  outlet.position.set(size.x * 0.5, size.y * 0.5, markerZ);
  endpointGroup.add(inlet, outlet);
  scene.add(endpointGroup);
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
    loading.hidden = true;
  }, undefined, () => {
    if (activeRequest !== requestId) return;
    loading.textContent = 'CAD MODEL COULD NOT BE LOADED';
  });
}

addEventListener('cad-model-change', (event) => loadModel(event.detail));

function resize() {
  const rect = host.getBoundingClientRect();
  renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
  updateFrustum();
}

new ResizeObserver(resize).observe(host);
resize();

function render() {
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

loadModel({ familyId: 'F0', file: 'F0_0001.glb', label: 'CAD 01 / 30' });
dispatchEvent(new CustomEvent('cad-viewer-ready'));
