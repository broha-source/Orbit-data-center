import * as THREE from './assets/vendor/three/three.module.min.js';
import { OrbitControls } from './assets/vendor/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from './assets/vendor/three/addons/loaders/GLTFLoader.js';

const host = document.querySelector('#cadViewer');
const loading = document.querySelector('#cadLoading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x050708, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 10000);
camera.position.set(0, -80, 100);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 5000;

scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x101214, 1.8));
scene.add(new THREE.AmbientLight(0xffffff, 1.55));
const key = new THREE.DirectionalLight(0xffffff, 4.2);
key.position.set(-4, -3, 7);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7cdcff, 2.6);
rim.position.set(6, 3, 3);
scene.add(rim);

const floor = new THREE.GridHelper(220, 22, 0x26323a, 0x151b1f);
floor.material.transparent = true;
floor.material.opacity = 0.28;
floor.rotation.x = Math.PI / 2;
floor.position.z = -18;
scene.add(floor);

const loader = new GLTFLoader();
const material = new THREE.MeshBasicMaterial({
  color: 0x91a7af,
  side: THREE.DoubleSide,
  toneMapped: false
});
const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0x8ee8ff,
  wireframe: true,
  transparent: true,
  opacity: 0.9,
  toneMapped: false
});

let model = null;
let requestId = 0;
let wireframe = false;

function disposeModel() {
  if (!model) return;
  scene.remove(model);
  model.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
  });
  model = null;
}

function frameModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  const span = Math.max(size.x, size.y, size.z, 1);
  const depth = Math.max(size.z, span * 0.08);
  camera.near = Math.max(span / 1000, 0.01);
  camera.far = span * 30;
  camera.position.set(span * 0.08, -span * 0.84, span * 1.35 + depth);
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.minDistance = span * 0.45;
  controls.maxDistance = span * 4;
  controls.update();
  floor.scale.setScalar(span / 120);
  floor.position.z = -Math.max(size.z * 0.62, span * 0.05);
}

function setMaterials() {
  if (!model) return;
  model.traverse((child) => {
    if (child.isMesh) child.material = wireframe ? wireMaterial : material;
  });
}

function loadModel({ familyId = 'F0', file = 'F0_0001.glb', label = 'CAD 01 / 30' }) {
  const activeRequest = ++requestId;
  loading.hidden = false;
  loading.textContent = `LOADING ${familyId} · ${label}`;
  loader.load(
    `assets/cad/${familyId}/${file}`,
    (gltf) => {
      if (activeRequest !== requestId) return;
      disposeModel();
      model = gltf.scene;
      setMaterials();
      scene.add(model);
      frameModel(model);
      loading.hidden = true;
    },
    undefined,
    () => {
      if (activeRequest !== requestId) return;
      loading.textContent = 'CAD MODEL COULD NOT BE LOADED';
    }
  );
}

addEventListener('cad-model-change', (event) => loadModel(event.detail));
addEventListener('cad-view-change', (event) => {
  wireframe = event.detail.view === 'wireframe';
  setMaterials();
});

function resize() {
  const rect = host.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(host);
resize();

function render() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

loadModel({ familyId: 'F0', file: 'F0_0001.glb', label: 'CAD 01 / 30' });
dispatchEvent(new CustomEvent('cad-viewer-ready'));
