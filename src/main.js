import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";
import { buildMockWorldState, TYPE_PARAMS, WORLD_SIZE } from "./worldState.js";

const app = document.querySelector("#app");

app.innerHTML = `
<div class="app">
  <div class="toolbar">
    <div>
      <div class="title">MAPPO 三维战场态势可视化</div>
      <div class="subtitle">2-D RL environment · 3-D rendering layer</div>
    </div>
    <div class="spacer"></div>
    <span class="badge">contested · mock world state</span>
  </div>

  <div class="layout">
    <aside class="panel side">
      <div class="section-title">显示控制</div>
      <label class="toggle"><input id="showTrails" type="checkbox" checked> 轨迹</label>
      <label class="toggle"><input id="showComm" type="checkbox" checked> 通信链路</label>
      <label class="toggle"><input id="showThreats" type="checkbox" checked> 威胁区域</label>
      <label class="toggle"><input id="showJammers" type="checkbox" checked> 干扰区域</label>
      <label class="toggle"><input id="showRanges" type="checkbox" checked> 选中 UAV 范围</label>

      <div class="divider"></div>

      <div class="row">
        <strong>无人机</strong>
        <span class="muted">8 / 8</span>
      </div>
      <div id="uavList" class="agent-list"></div>

      <div class="divider"></div>

      <div class="section-title">选中无人机</div>
      <div class="kv-grid">
        <div><div class="key">编号</div><div id="vId" class="value">—</div></div>
        <div><div class="key">类型</div><div id="vType" class="value">—</div></div>
        <div><div class="key">X</div><div id="vX" class="value">—</div></div>
        <div><div class="key">Y</div><div id="vY" class="value">—</div></div>
        <div><div class="key">航向</div><div id="vYaw" class="value">—</div></div>
        <div><div class="key">速度</div><div id="vSpeed" class="value">—</div></div>
        <div><div class="key">通信质量</div><div id="vComm" class="value">—</div></div>
        <div><div class="key">侦察质量</div><div id="vRecon" class="value">—</div></div>
      </div>

      <div class="note">
        Three.js 中的高度仅用于显示。强化学习环境仍然只使用二维 (x, y) 状态。
      </div>
    </aside>

    <main>
      <section class="panel">
        <div class="stage-head">
          <div>
            <div class="stage-title">4 km × 4 km Contested Battlefield</div>
            <div class="stage-desc">8 UAV · 4 targets · 3 threats · 2 dynamic jammers</div>
          </div>
          <div class="stage-actions">
            <button id="topView" class="btn">俯视</button>
            <button id="resetView" class="btn">复位视角</button>
          </div>
        </div>

        <div id="viewport" class="viewport">
          <div class="hud">
            <span id="hudTime" class="chip">T+00:00</span>
            <span class="chip">World: 4000 × 4000 m</span>
            <span class="chip">RL: 2-D</span>
            <span class="chip">Render: 3-D</span>
          </div>
        </div>
      </section>

      <section class="panel timeline-panel">
        <div class="timeline-controls">
          <button id="playBtn" class="btn primary">⏸ 暂停</button>
          <button id="resetBtn" class="btn">↺ 重播</button>
          <select id="rate" class="btn">
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
          <span id="timeLabel" class="time">00:00</span>
        </div>
        <input id="timeline" type="range" min="0" max="90" step="0.1" value="0" />
      </section>
    </main>
  </div>
</div>
`;

const $ = (s) => app.querySelector(s);
const viewport = $("#viewport");
const uavList = $("#uavList");
const hudTime = $("#hudTime");
const timeline = $("#timeline");
const timeLabel = $("#timeLabel");
const playBtn = $("#playBtn");
const rateSelect = $("#rate");

const values = {
  id: $("#vId"),
  type: $("#vType"),
  x: $("#vX"),
  y: $("#vY"),
  yaw: $("#vYaw"),
  speed: $("#vSpeed"),
  comm: $("#vComm"),
  recon: $("#vRecon"),
};

const overlay = {
  trails: $("#showTrails"),
  comm: $("#showComm"),
  threats: $("#showThreats"),
  jammers: $("#showJammers"),
  ranges: $("#showRanges"),
};

const COLORS = {
  bg: 0x06101c,
  ground: 0x13253a,
  grid: 0x31506f,
  target: 0xffaa33,
  threat: 0xff5964,
  jammer: 0xad7cff,
  comm: 0x62d4ff,
  stk: 0xff6f61,
  rec: 0x45d483,
  com: 0x5aa7ff,
  white: 0xeaf4ff,
};

const VISUAL_SIZE = 320;
const HALF = VISUAL_SIZE / 2;

function worldToScene(x, y, altitude = 0) {
  return new THREE.Vector3(
    (x / WORLD_SIZE - 0.5) * VISUAL_SIZE,
    altitude,
    (0.5 - y / WORLD_SIZE) * VISUAL_SIZE,
  );
}

function metersToScene(m) {
  return (m / WORLD_SIZE) * VISUAL_SIZE;
}

function colorForType(type) {
  if (type === "Stk") return COLORS.stk;
  if (type === "Rec") return COLORS.rec;
  return COLORS.com;
}

function fmtTime(v) {
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.Fog(COLORS.bg, 230, 560);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 40;
controls.maxDistance = 520;

scene.add(new THREE.HemisphereLight(0xddeeff, 0x243344, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(90, 180, 85);
sun.castShadow = true;
scene.add(sun);

const groundGroup = new THREE.Group();
const entityGroup = new THREE.Group();
const overlayGroup = new THREE.Group();
const rangeGroup = new THREE.Group();
scene.add(groundGroup, entityGroup, overlayGroup, rangeGroup);

const uavMeshes = new Map();
const targetMeshes = new Map();
const threatMeshes = new Map();
const jammerMeshes = new Map();
const trailLines = new Map();
const trailPoints = new Map();

let selectedUav = 0;
let playing = true;
let t = 0;
let playbackRate = 1;
let lastFrame = performance.now();

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.05,
    ...options,
  });
}

function addGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(VISUAL_SIZE, VISUAL_SIZE),
    material(COLORS.ground),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  groundGroup.add(ground);

  const grid = new THREE.GridHelper(VISUAL_SIZE, 40, COLORS.grid, COLORS.grid);
  grid.position.y = 0.06;
  grid.material.transparent = true;
  grid.material.opacity = 0.34;
  groundGroup.add(grid);

  const borderGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-HALF, 0.15, -HALF),
    new THREE.Vector3(HALF, 0.15, -HALF),
    new THREE.Vector3(HALF, 0.15, HALF),
    new THREE.Vector3(-HALF, 0.15, HALF),
    new THREE.Vector3(-HALF, 0.15, -HALF),
  ]);
  groundGroup.add(new THREE.Line(
    borderGeo,
    new THREE.LineBasicMaterial({ color: 0x5c9fd6 }),
  ));
}

function droneModel(type) {
  const group = new THREE.Group();
  const c = colorForType(type);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 1.5, 3.0),
    material(c),
  );
  body.castShadow = true;
  group.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 2.2, 8),
    material(0xffc35a),
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 3.6;
  group.add(nose);

  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 0.28, 0.28),
      material(COLORS.white),
    );
    arm.rotation.y = sx * sz * Math.PI / 4;
    arm.position.set(sx * 2.4, 0, sz * 1.8);
    group.add(arm);

    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.06, 20),
      new THREE.MeshStandardMaterial({
        color: 0xc8e7ff,
        transparent: true,
        opacity: 0.28,
      }),
    );
    rotor.position.set(sx * 3.7, 0.65, sz * 3.0);
    group.add(rotor);
  });

  group.scale.setScalar(0.72);
  return group;
}

function makeTarget() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 2.0, 16),
    material(COLORS.target, { emissive: COLORS.target, emissiveIntensity: 0.12 }),
  );
  core.position.y = 1;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.24, 8, 32),
    new THREE.MeshBasicMaterial({ color: COLORS.target }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(core, ring);
  return group;
}

function makeThreat(radius) {
  const r = metersToScene(radius);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 7, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: COLORS.threat,
      transparent: true,
      opacity: 0.18,
      emissive: COLORS.threat,
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.position.y = 3.5;
  return mesh;
}

function makeJammer(radius) {
  const r = metersToScene(radius);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 16, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: COLORS.jammer,
      transparent: true,
      opacity: 0.10,
      emissive: COLORS.jammer,
      emissiveIntensity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.position.y = 8;
  return mesh;
}

function makeRangeDisc(radius, color, opacity) {
  const r = metersToScene(radius);
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(r, 64),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function makeRangeRing(radius, color) {
  const r = metersToScene(radius);
  const pts = [];
  for (let i = 0; i <= 80; i += 1) {
    const a = (i / 80) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }),
  );
}

function initEntities(state) {
  state.uavs.forEach((u) => {
    const mesh = droneModel(u.type);
    mesh.userData.uavId = u.id;
    entityGroup.add(mesh);
    uavMeshes.set(u.id, mesh);

    const geo = new THREE.BufferGeometry().setFromPoints([
      worldToScene(u.x, u.y, u.visualAltitude * 0.08),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: colorForType(u.type),
        transparent: true,
        opacity: 0.62,
      }),
    );
    overlayGroup.add(line);
    trailLines.set(u.id, line);
    trailPoints.set(u.id, []);
  });

  state.targets.forEach((target) => {
    const mesh = makeTarget();
    entityGroup.add(mesh);
    targetMeshes.set(target.id, mesh);
  });

  state.threats.forEach((threat) => {
    const mesh = makeThreat(threat.radius);
    entityGroup.add(mesh);
    threatMeshes.set(threat.id, mesh);
  });

  state.jammers.forEach((jammer) => {
    const mesh = makeJammer(jammer.radius);
    entityGroup.add(mesh);
    jammerMeshes.set(jammer.id, mesh);
  });
}

function updateTrails(state) {
  state.uavs.forEach((u) => {
    const points = trailPoints.get(u.id);
    const p = worldToScene(u.x, u.y, u.visualAltitude * 0.08);
    if (!points.length || points[points.length - 1].distanceToSquared(p) > 0.25) {
      points.push(p.clone());
      if (points.length > 180) points.shift();
      trailLines.get(u.id).geometry.dispose();
      trailLines.get(u.id).geometry = new THREE.BufferGeometry().setFromPoints(points);
    }
    trailLines.get(u.id).visible = overlay.trails.checked;
  });
}

function updateCommLinks(state) {
  const old = overlayGroup.children.filter((obj) => obj.userData.commLink);
  old.forEach((obj) => {
    overlayGroup.remove(obj);
    obj.geometry.dispose();
    obj.material.dispose();
  });

  if (!overlay.comm.checked) return;

  state.commLinks.forEach((link) => {
    const a = state.uavs[link.a];
    const b = state.uavs[link.b];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        worldToScene(a.x, a.y, a.visualAltitude * 0.08),
        worldToScene(b.x, b.y, b.visualAltitude * 0.08),
      ]),
      new THREE.LineBasicMaterial({
        color: COLORS.comm,
        transparent: true,
        opacity: 0.18 + 0.55 * link.quality,
      }),
    );
    line.userData.commLink = true;
    overlayGroup.add(line);
  });
}

function clearRangeGroup() {
  while (rangeGroup.children.length) {
    const obj = rangeGroup.children.pop();
    obj.geometry?.dispose?.();
    obj.material?.dispose?.();
  }
}

function updateSelectedRanges(state) {
  clearRangeGroup();
  if (!overlay.ranges.checked) return;

  const u = state.uavs.find((item) => item.id === selectedUav);
  if (!u) return;
  const base = worldToScene(u.x, u.y, 0);

  const strike = makeRangeDisc(u.strikeRange, 0xff6670, 0.08);
  strike.position.set(base.x, 0.18, base.z);
  rangeGroup.add(strike);

  const recon = makeRangeRing(u.reconRange * u.reconQuality, 0x45d483);
  recon.position.set(base.x, 0.24, base.z);
  rangeGroup.add(recon);

  const comm = makeRangeRing(u.commRange * u.commQuality, 0x5aa7ff);
  comm.position.set(base.x, 0.28, base.z);
  rangeGroup.add(comm);
}

function updateScene(state) {
  state.uavs.forEach((u) => {
    const mesh = uavMeshes.get(u.id);
    const p = worldToScene(u.x, u.y, u.visualAltitude * 0.08);
    mesh.position.copy(p);
    mesh.rotation.y = -u.yaw;
    mesh.visible = u.alive;
  });

  state.targets.forEach((target) => {
    const mesh = targetMeshes.get(target.id);
    const p = worldToScene(target.x, target.y, 0);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = -target.yaw;
    mesh.visible = target.alive;
  });

  state.threats.forEach((threat) => {
    const mesh = threatMeshes.get(threat.id);
    const p = worldToScene(threat.x, threat.y, 0);
    mesh.position.x = p.x;
    mesh.position.z = p.z;
    mesh.visible = overlay.threats.checked;
  });

  state.jammers.forEach((jammer) => {
    const mesh = jammerMeshes.get(jammer.id);
    const p = worldToScene(jammer.x, jammer.y, 0);
    mesh.position.x = p.x;
    mesh.position.z = p.z;
    mesh.material.opacity = 0.05 + 0.13 * jammer.intensity;
    mesh.visible = overlay.jammers.checked;
  });

  updateTrails(state);
  updateCommLinks(state);
  updateSelectedRanges(state);
  updatePanel(state);
}

function updatePanel(state) {
  const u = state.uavs.find((item) => item.id === selectedUav);
  if (!u) return;

  values.id.textContent = `UAV-${String(u.id + 1).padStart(2, "0")}`;
  values.type.textContent = u.type;
  values.x.textContent = `${u.x.toFixed(0)} m`;
  values.y.textContent = `${u.y.toFixed(0)} m`;
  values.yaw.textContent = `${THREE.MathUtils.radToDeg(u.yaw).toFixed(0)}°`;
  values.speed.textContent = `${u.speed.toFixed(1)} m/s`;
  values.comm.textContent = u.commQuality.toFixed(2);
  values.recon.textContent = u.reconQuality.toFixed(2);

  uavList.querySelectorAll(".agent").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.id) === selectedUav);
  });
}

function buildUavList(state) {
  uavList.innerHTML = "";
  state.uavs.forEach((u) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "agent";
    button.dataset.id = String(u.id);
    button.innerHTML = `
      <span><span class="dot" style="background:#${colorForType(u.type).toString(16).padStart(6, "0")}"></span>UAV-${String(u.id + 1).padStart(2, "0")}</span>
      <span class="muted">${u.type}</span>
    `;
    button.addEventListener("click", () => {
      selectedUav = u.id;
      updateScene(buildMockWorldState(t));
    });
    uavList.appendChild(button);
  });
}

function resetCamera() {
  camera.position.set(230, 190, 235);
  controls.target.set(0, 10, 0);
  controls.update();
}

function topView() {
  camera.position.set(0, 360, 0.01);
  controls.target.set(0, 0, 0);
  controls.update();
}

function resize() {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}

addGround();
const initialState = buildMockWorldState(0);
initEntities(initialState);
buildUavList(initialState);
resetCamera();
resize();
updateScene(initialState);

$("#resetView").addEventListener("click", resetCamera);
$("#topView").addEventListener("click", topView);

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.textContent = playing ? "⏸ 暂停" : "▶ 播放";
});

$("#resetBtn").addEventListener("click", () => {
  t = 0;
  trailPoints.forEach((points) => points.splice(0, points.length));
  timeline.value = "0";
  playing = true;
  playBtn.textContent = "⏸ 暂停";
  updateScene(buildMockWorldState(t));
});

rateSelect.addEventListener("change", () => {
  playbackRate = Number(rateSelect.value) || 1;
});

timeline.addEventListener("input", () => {
  t = Number(timeline.value);
  playing = false;
  playBtn.textContent = "▶ 播放";
  updateScene(buildMockWorldState(t));
});

Object.values(overlay).forEach((input) => {
  input.addEventListener("change", () => updateScene(buildMockWorldState(t)));
});

window.addEventListener("resize", resize);

function animate(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  if (playing) {
    t += dt * playbackRate;
    if (t > 90) t = 0;
    timeline.value = String(t);
  }

  const state = buildMockWorldState(t);
  updateScene(state);

  hudTime.textContent = `T+${fmtTime(t)}`;
  timeLabel.textContent = `${fmtTime(t)} / 01:30`;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
