import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
<div class="app">
  <div class="toolbar">
    <button class="btn scene active" data-scene="1">科目一 · 侦察识别</button>
    <button class="btn scene" data-scene="2">科目二 · 协同投送</button>
    <button class="btn scene" data-scene="3">科目三 · 林区穿越</button>
    <div class="spacer"></div>
    <span class="badge">3D SIMULATION · MOCK DATA</span>
  </div>

  <div class="layout">
    <aside class="panel side">
      <div class="section-title">仿真控制</div>
      <div class="controls">
        <button id="sceneInit" class="btn">① 场景初始化</button>
        <button id="agentInit" class="btn" disabled>② Agent 初始化</button>
        <button id="startRun" class="btn primary" disabled>③ 开始运行</button>
      </div>

      <div class="divider"></div>

      <div class="row">
        <strong>Agent</strong>
        <span id="agentCount" class="muted">0 / 6</span>
      </div>
      <div id="agentList" class="agent-list">
        <div class="muted">等待连接</div>
      </div>

      <div class="divider"></div>

      <div class="section-title">选中无人机</div>
      <div class="kv-grid">
        <div><div class="key">编号</div><div id="vId" class="value">—</div></div>
        <div><div class="key">状态</div><div id="vStatus" class="value">—</div></div>
        <div><div class="key">速度</div><div id="vSpeed" class="value">—</div></div>
        <div><div class="key">高度</div><div id="vAlt" class="value">—</div></div>
        <div><div class="key">Yaw</div><div id="vYaw" class="value">—</div></div>
        <div><div class="key">Pitch</div><div id="vPitch" class="value">—</div></div>
      </div>
    </aside>

    <main>
      <section class="panel">
        <div class="stage-head">
          <div>
            <div id="sceneTitle" class="stage-title">科目一 · 环境感知与目标识别</div>
            <div id="sceneDesc" class="stage-desc">等待场景初始化</div>
          </div>
          <div>
            <button id="topView" class="btn" disabled>俯视</button>
            <button id="resetView" class="btn" disabled>复位视角</button>
          </div>
        </div>
        <div id="viewport" class="viewport">
          <div class="hud">
            <span id="hudMode" class="chip">IDLE</span>
            <span id="hudTime" class="chip">T+00:00</span>
            <span id="hudEvent" class="chip">等待初始化</span>
          </div>
          <div id="hint" class="hint">
            <strong>三维场景尚未建立</strong>
            <div class="muted" style="margin-top:6px">点击左侧“场景初始化”生成仿真环境</div>
          </div>
        </div>
      </section>

      <section class="panel timeline-panel">
        <div class="timeline-controls">
          <button id="playBtn" class="btn" disabled>▶ 播放</button>
          <button id="replayBtn" class="btn" disabled>↺ 重播</button>
          <select id="rate" class="btn" disabled>
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
          <span id="timeLabel" class="time">00:00 / 01:30</span>
        </div>
        <input id="timeline" type="range" min="0" max="90" step="0.1" value="0" disabled />
      </section>
    </main>
  </div>
</div>`;

const $ = (s) => app.querySelector(s);
const viewport = $("#viewport");
const hint = $("#hint");
const sceneInitBtn = $("#sceneInit");
const agentInitBtn = $("#agentInit");
const startBtn = $("#startRun");
const playBtn = $("#playBtn");
const replayBtn = $("#replayBtn");
const timeline = $("#timeline");
const rate = $("#rate");
const agentList = $("#agentList");
const agentCount = $("#agentCount");
const sceneTitle = $("#sceneTitle");
const sceneDesc = $("#sceneDesc");
const hudMode = $("#hudMode");
const hudTime = $("#hudTime");
const hudEvent = $("#hudEvent");
const timeLabel = $("#timeLabel");
const topViewBtn = $("#topView");
const resetViewBtn = $("#resetView");
const values = {
  id: $("#vId"),
  status: $("#vStatus"),
  speed: $("#vSpeed"),
  alt: $("#vAlt"),
  yaw: $("#vYaw"),
  pitch: $("#vPitch"),
};

const colors = {
  bg: 0x06101c,
  ground: 0x142234,
  grid: 0x29405a,
  cyan: 0x28a9ff,
  blue: 0x377dff,
  green: 0x38d67a,
  orange: 0xffaa33,
  red: 0xff5c62,
  gray: 0x75889a,
  white: 0xe9f4ff,
  water: 0x174d72,
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(colors.bg);
scene.fog = new THREE.Fog(colors.bg, 180, 500);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 35;
controls.maxDistance = 430;

scene.add(new THREE.HemisphereLight(0xe5f4ff, 0x233446, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(90, 160, 70);
sun.castShadow = true;
scene.add(sun);

const world = new THREE.Group();
const dynamic = new THREE.Group();
scene.add(world, dynamic);

let sceneId = 1;
let sceneReady = false;
let agentsReady = false;
let playing = false;
let t = 0;
let last = performance.now();
let selected = 0;
const duration = 90;

let drones = [];
let trails = [];
let markers = [];

const titles = {
  1: "科目一 · 环境感知与目标识别",
  2: "科目二 · 任务指挥与蜂群协作",
  3: "科目三 · 自主导航与障碍穿越",
};

const descriptions = {
  1: "大范围侦察场景 · 目标由检测结果动态生成",
  2: "与科目一共用场地 · 增加目标锁定与投送状态",
  3: "低空林区穿越 · 树林为抽象环境，障碍物按感知信息动态生成",
};

function material(color, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

function box(w, h, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function clearGroup(group) {
  while (group.children.length) {
    const obj = group.children.pop();
    obj.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
      else node.material?.dispose?.();
    });
  }
}

function addGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 240),
    material(colors.ground)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  const grid = new THREE.GridHelper(320, 32, colors.grid, colors.grid);
  grid.position.y = 0.04;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  world.add(grid);

  const launch = box(50, 0.7, 34, 0x174f78);
  launch.position.set(-108, 0.35, 76);
  world.add(launch);
}

function addBoundary() {
  const points = [
    [-150, -100], [137, -100], [152, 52], [95, 112],
    [-122, 108], [-153, 32], [-150, -100],
  ].map(([x, z]) => new THREE.Vector3(x, 0.4, z));

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  world.add(new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color: colors.cyan })
  ));
}

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.1, 7 * scale, 7),
    material(0x5d4631)
  );
  trunk.position.y = 3.5 * scale;

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(4.2 * scale, 11 * scale, 8),
    material(0x285d45)
  );
  crown.position.y = 10 * scale;
  trunk.castShadow = true;
  crown.castShadow = true;
  tree.add(trunk, crown);
  tree.position.set(x, 0, z);
  world.add(tree);
}

function seeded(i) {
  const n = Math.sin(i * 9283.31) * 43758.5453;
  return n - Math.floor(n);
}

function addCommonScene() {
  addGround();
  addBoundary();

  const road = box(235, 0.18, 11, 0x2d3b49);
  road.position.set(4, 0.14, -10);
  road.rotation.y = 0.13;
  world.add(road);

  const buildingData = [
    [8, 26, 24, 13],
    [42, 17, 18, 20],
    [72, 28, 24, 15],
  ];
  buildingData.forEach(([x, z, w, h]) => {
    const b = box(w, h, w * 0.78, 0x566373);
    b.position.set(x, h / 2, z);
    world.add(b);
  });

  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(29, 40),
    new THREE.MeshStandardMaterial({
      color: colors.water,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
    })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(82, 0.15, -60);
  world.add(pond);

  for (let i = 0; i < 18; i++) {
    addTree(-60 + (i % 6) * 15, -68 + Math.floor(i / 6) * 17, 0.7);
  }
}

function buildScene() {
  clearGroup(world);
  clearGroup(dynamic);
  drones = [];
  trails = [];
  markers = [];

  if (sceneId === 1) {
    addCommonScene();
  } else if (sceneId === 2) {
    addCommonScene();
    [[65, -12], [-14, -58], [98, 41]].forEach(([x, z]) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(7, 0.7, 8, 30),
        new THREE.MeshStandardMaterial({ color: colors.orange })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.8, z);
      world.add(ring);
    });
  } else {
    addGround();
    addBoundary();

    for (let i = 0; i < 78; i++) {
      const x = -58 + seeded(i * 2) * 170;
      const z = -86 + seeded(i * 2 + 1) * 170;
      if (x < -72 && z > 50) continue;
      addTree(x, z, 0.72 + seeded(i + 150) * 0.5);
    }

    const supply = box(37, 0.5, 90, 0x183853);
    supply.position.set(124, 0.25, 14);
    world.add(supply);

    [colors.red, colors.orange, colors.blue].forEach((c, i) => {
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8, 0.55, 32),
        material(c)
      );
      pad.position.set(124, 0.55, -19 + i * 32);
      world.add(pad);
    });
  }
}

function resetCamera() {
  if (sceneId === 3) {
    camera.position.set(185, 110, 195);
    controls.target.set(8, 12, 0);
  } else {
    camera.position.set(210, 185, 225);
    controls.target.set(0, 18, 0);
  }
  controls.update();
}

function droneModel(i) {
  const group = new THREE.Group();
  group.userData.agent = i;

  const body = box(8, 2.4, 4.3, colors.cyan);
  group.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 3, 8),
    material(colors.orange)
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(5.5, 0, 0);
  group.add(nose);

  const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  corners.forEach(([sx, sz]) => {
    const arm = box(7.2, 0.55, 0.55, colors.white);
    arm.rotation.y = sx * sz * Math.PI / 4;
    arm.position.set(sx * 4.0, 0.1, sz * 3.0);
    group.add(arm);

    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 1.1, 12),
      material(0x9fb0c0)
    );
    motor.position.set(sx * 6.3, 0.15, sz * 5.3);
    group.add(motor);

    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 0.08, 24),
      new THREE.MeshStandardMaterial({
        color: 0xaed8ff,
        transparent: true,
        opacity: 0.28,
      })
    );
    rotor.position.set(sx * 6.3, 0.8, sz * 5.3);
    rotor.userData.rotor = true;
    group.add(rotor);
  });

  group.scale.setScalar(0.72);
  return group;
}

function startPosition(i) {
  return new THREE.Vector3(
    -116 + (i % 3) * 14,
    1.6,
    66 + Math.floor(i / 3) * 14
  );
}

function stateAt(i, time) {
  const start = startPosition(i);
  if (time < 2) {
    return { p: start, alt: 0, speed: 0, yaw: 0, pitch: 0, status: "READY" };
  }

  const progress = Math.min(time / 72, 1);
  let x, z, alt, speed;

  if (sceneId === 3) {
    x = start.x + progress * 218 + Math.sin(time * 0.14 + i * 1.7) * 12;
    z = start.z - progress * 82 + Math.sin(time * 0.21 + i) * 23;
    alt = 2.8 + Math.sin(time * 0.17 + i) * 0.7;
    speed = 3.3 + Math.sin(time * 0.24 + i) * 0.7;
  } else {
    x = start.x + progress * (208 + i * 4) + Math.sin(time * 0.11 + i) * 26;
    z = start.z - progress * (108 + (i % 3) * 21) + Math.cos(time * 0.15 + i) * 26;
    alt = 46 + Math.sin(time * 0.12 + i) * 11;
    speed = 8.8 + Math.sin(time * 0.15 + i) * 1.8;
  }

  if (time > 72) {
    const q = Math.min((time - 72) / 18, 1);
    x = THREE.MathUtils.lerp(x, start.x, q);
    z = THREE.MathUtils.lerp(z, start.z, q);
    alt = THREE.MathUtils.lerp(alt, 1.6, q);
    speed *= 1 - q;
  }

  return {
    p: new THREE.Vector3(x, alt, z),
    alt,
    speed,
    yaw: (time * 9 + i * 37) % 360,
    pitch: Math.sin(time * 0.2 + i) * 7,
    status: time > 72 ? "RETURN" : "MISSION",
  };
}

function makeTrail(i) {
  const positions = [];
  for (let s = 0; s <= duration; s += 0.5) {
    const p = stateAt(i, s).p;
    positions.push(p.x, p.y, p.z);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setDrawRange(0, 1);

  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      color: i % 2 ? colors.green : colors.cyan,
      transparent: true,
      opacity: 0.65,
    })
  );
  dynamic.add(line);
  trails.push(line);
}

function makeMarker(type, x, z) {
  const group = new THREE.Group();

  if (type === "target") {
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 5, 14),
      new THREE.MeshStandardMaterial({
        color: colors.orange,
        emissive: colors.orange,
        emissiveIntensity: 0.18,
      })
    );
    beacon.position.y = 2.5;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7, 0.45, 8, 30),
      new THREE.MeshBasicMaterial({ color: colors.orange })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.5;
    group.add(beacon, ring);
  } else {
    const obstacle = new THREE.Mesh(
      new THREE.SphereGeometry(6, 18, 14),
      new THREE.MeshStandardMaterial({
        color: colors.red,
        transparent: true,
        opacity: 0.38,
        emissive: colors.red,
        emissiveIntensity: 0.12,
      })
    );
    obstacle.position.y = 5;
    group.add(obstacle);
  }

  group.position.set(x, 0, z);
  group.visible = false;
  dynamic.add(group);
  markers.push(group);
}

function prepareMarkers() {
  markers.forEach((m) => dynamic.remove(m));
  markers = [];

  if (sceneId === 1) {
    makeMarker("target", 48, -18);
    makeMarker("target", 98, -62);
    makeMarker("target", -8, -74);
  } else if (sceneId === 2) {
    makeMarker("target", 65, -12);
    makeMarker("target", -14, -58);
    makeMarker("target", 98, 41);
  } else {
    makeMarker("obstacle", -4, -22);
    makeMarker("obstacle", 48, -48);
    makeMarker("obstacle", 80, 16);
  }
}

function updateMarkers() {
  if (!markers.length) prepareMarkers();

  if (sceneId === 1) {
    markers[0].visible = t > 15;
    markers[1].visible = t > 34;
    markers[2].visible = t > 52;
    hudEvent.textContent = t > 72 ? "返航" : t > 34 ? "目标持续更新" : t > 15 ? "发现目标" : "区域侦察";
  } else if (sceneId === 2) {
    markers[0].visible = t > 17;
    markers[1].visible = t > 34;
    markers[2].visible = t > 51;
    hudEvent.textContent = t > 72 ? "返航" : t > 17 ? "锁定 / 投送" : "搜索目标";
  } else {
    markers[0].visible = t > 14;
    markers[1].visible = t > 33;
    markers[2].visible = t > 52;
    hudEvent.textContent = t > 72 ? "返航" : t > 14 ? "感知障碍 / 避障" : "低空穿越";
  }
}

function formatTime(v) {
  const m = Math.floor(v / 60);
  const s = Math.floor(v % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateInfo(state, i = selected) {
  if (!state) {
    Object.values(values).forEach((node) => node.textContent = "—");
    return;
  }
  values.id.textContent = `UAV-0${i + 1}`;
  values.status.textContent = state.status;
  values.speed.textContent = `${state.speed.toFixed(1)} m/s`;
  values.alt.textContent = `${state.alt.toFixed(1)} m`;
  values.yaw.textContent = `${state.yaw.toFixed(0)}°`;
  values.pitch.textContent = `${state.pitch.toFixed(1)}°`;
}

function selectAgent(i) {
  selected = i;
  agentList.querySelectorAll(".agent").forEach((button, index) => {
    button.classList.toggle("selected", index === i);
  });
  updateInfo(stateAt(i, t), i);
}

function initScene() {
  sceneReady = true;
  agentsReady = false;
  playing = false;
  t = 0;

  buildScene();
  resetCamera();
  hint.style.display = "none";

  sceneDesc.textContent = descriptions[sceneId];
  hudMode.textContent = "SCENE READY";
  hudEvent.textContent = "等待 Agent";

  agentInitBtn.disabled = false;
  startBtn.disabled = true;
  playBtn.disabled = true;
  replayBtn.disabled = true;
  timeline.disabled = true;
  rate.disabled = true;
  topViewBtn.disabled = false;
  resetViewBtn.disabled = false;

  agentCount.textContent = "0 / 6";
  agentList.innerHTML = '<div class="muted">等待 Agent 初始化</div>';
  updateInfo(null);
}

function initAgents() {
  if (!sceneReady) return;

  agentsReady = true;
  drones = [];
  trails = [];
  agentList.innerHTML = "";
  agentCount.textContent = "0 / 6";

  for (let i = 0; i < 6; i++) {
    const drone = droneModel(i);
    drone.position.copy(startPosition(i));
    dynamic.add(drone);
    drones.push(drone);
    makeTrail(i);

    const button = document.createElement("button");
    button.className = `agent${i === 0 ? " selected" : ""}`;
    button.innerHTML = `
      <span><span class="dot"></span>UAV-0${i + 1}</span>
      <span class="muted">连接中</span>
    `;
    button.addEventListener("click", () => selectAgent(i));
    agentList.appendChild(button);

    setTimeout(() => {
      button.querySelector(".dot").classList.add("online");
      button.lastElementChild.textContent = "READY";
      agentCount.textContent = `${i + 1} / 6`;

      if (i === 5) {
        startBtn.disabled = false;
        playBtn.disabled = false;
        replayBtn.disabled = false;
        timeline.disabled = false;
        rate.disabled = false;
        hudMode.textContent = "6 / 6 READY";
        hudEvent.textContent = "连接建立";
      }
    }, 120 + i * 160);
  }

  selected = 0;
  updateAgents();
}

function updateAgents() {
  if (!agentsReady) return;

  drones.forEach((drone, i) => {
    const state = stateAt(i, t);
    drone.position.copy(state.p);
    drone.rotation.order = "YXZ";
    drone.rotation.y = THREE.MathUtils.degToRad(-state.yaw);
    drone.rotation.x = THREE.MathUtils.degToRad(state.pitch);

    drone.traverse((node) => {
      if (node.userData.rotor && playing) node.rotation.y += 0.45;
    });

    const count = Math.max(1, Math.floor(t / 0.5) + 1);
    trails[i].geometry.setDrawRange(0, Math.min(count, 181));
  });

  updateMarkers();
  updateInfo(stateAt(selected, t), selected);
  hudTime.textContent = `T+${formatTime(t)}`;
  hudMode.textContent = t < 2 ? "READY" : t > 72 ? "RETURN" : "MISSION";
  timeline.value = String(t);
  timeLabel.textContent = `${formatTime(t)} / 01:30`;
}

function startRun() {
  if (!agentsReady) return;
  t = 0;
  prepareMarkers();
  playing = true;
  playBtn.textContent = "⏸ 暂停";
}

function setScene(id) {
  sceneId = id;
  document.querySelectorAll(".scene").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.scene) === id);
  });

  sceneTitle.textContent = titles[id];
  sceneDesc.textContent = "等待场景初始化";

  sceneReady = false;
  agentsReady = false;
  playing = false;
  t = 0;

  clearGroup(world);
  clearGroup(dynamic);
  drones = [];
  trails = [];
  markers = [];

  hint.style.display = "block";
  hint.innerHTML = `
    <strong>${titles[id]}</strong>
    <div class="muted" style="margin-top:6px">点击“场景初始化”建立三维环境</div>
  `;

  agentInitBtn.disabled = true;
  startBtn.disabled = true;
  playBtn.disabled = true;
  replayBtn.disabled = true;
  timeline.disabled = true;
  rate.disabled = true;
  topViewBtn.disabled = true;
  resetViewBtn.disabled = true;

  agentCount.textContent = "0 / 6";
  agentList.innerHTML = '<div class="muted">等待连接</div>';
  updateInfo(null);

  hudMode.textContent = "IDLE";
  hudTime.textContent = "T+00:00";
  hudEvent.textContent = "等待初始化";
}

document.querySelectorAll(".scene").forEach((button) => {
  button.addEventListener("click", () => setScene(Number(button.dataset.scene)));
});

sceneInitBtn.addEventListener("click", initScene);
agentInitBtn.addEventListener("click", initAgents);
startBtn.addEventListener("click", startRun);

playBtn.addEventListener("click", () => {
  if (!agentsReady) return;
  playing = !playing;
  playBtn.textContent = playing ? "⏸ 暂停" : "▶ 播放";
});

replayBtn.addEventListener("click", () => {
  if (!agentsReady) return;
  t = 0;
  playing = false;
  playBtn.textContent = "▶ 播放";
  prepareMarkers();
  updateAgents();
});

timeline.addEventListener("input", () => {
  t = Number(timeline.value) || 0;
  playing = false;
  playBtn.textContent = "▶ 播放";
  updateAgents();
});

topViewBtn.addEventListener("click", () => {
  camera.position.set(0, 315, 0.1);
  controls.target.set(0, 0, 0);
  controls.update();
});

resetViewBtn.addEventListener("click", resetCamera);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!agentsReady) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(drones, true);
  if (!hits.length) return;

  let node = hits[0].object;
  while (node.parent && !Number.isInteger(node.userData.agent)) node = node.parent;
  if (Number.isInteger(node.userData.agent)) selectAgent(node.userData.agent);
});

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (playing) {
    t += dt * (Number(rate.value) || 1);
    if (t >= duration) {
      t = duration;
      playing = false;
      playBtn.textContent = "▶ 播放";
      hudEvent.textContent = "任务结束";
    }
    updateAgents();
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

resetCamera();
resize();
requestAnimationFrame(loop);
