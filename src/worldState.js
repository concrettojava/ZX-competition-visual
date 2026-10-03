export const WORLD_SIZE = 4000;

export const TYPE_PARAMS = {
  Stk: { strikeRange: 280, reconRange: 320, commRange: 550, speed: 40 },
  Rec: { strikeRange: 150, reconRange: 850, commRange: 550, speed: 36 },
  Com: { strikeRange: 180, reconRange: 300, commRange: 1200, speed: 38 },
};

const INITIAL_UAVS = [
  [0, 1700, 200, "Stk"],
  [1, 1900, 200, "Stk"],
  [2, 2100, 200, "Stk"],
  [3, 2300, 200, "Stk"],
  [4, 1800, 300, "Rec"],
  [5, 2200, 300, "Rec"],
  [6, 1800, 100, "Com"],
  [7, 2200, 100, "Com"],
];

const TARGETS = [
  [0, 820, 2920, 0.35],
  [1, 1560, 3370, 2.20],
  [2, 2720, 2750, -1.10],
  [3, 3310, 3420, -2.40],
];

const THREATS = [
  [0, 980, 2120, 170],
  [1, 2290, 2350, 145],
  [2, 3150, 1700, 195],
];

const JAMMERS = [
  [0, 1450, 2500, 850, 0.68],
  [1, 2940, 2920, 760, 0.61],
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function jammerIntensity(x, y, time) {
  let survival = 1;
  JAMMERS.forEach(([idx, jx, jy, radius, strength]) => {
    const dx = x - jx;
    const dy = y - jy;
    const spatial = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
    const temporal = 0.65 + 0.35 * Math.sin((2 * Math.PI * time) / (58 + idx * 17) + idx * 1.3);
    const local = clamp(strength * spatial * temporal, 0, 0.95);
    survival *= 1 - local;
  });
  return clamp(1 - survival, 0, 0.95);
}

function uavState(base, time) {
  const [idx, x0, y0, type] = base;
  const p = TYPE_PARAMS[type];
  const missionT = Math.min(time, 90);
  const phase = idx * 0.73;
  const forward = missionT * p.speed * 0.72;
  const lateral = Math.sin(time * 0.055 + phase) * (110 + idx * 7);

  let x = x0 + Math.sin(0.18 + phase) * forward + lateral * 0.35;
  let y = y0 + Math.cos(0.18 + phase) * forward + 180 + lateral;
  x = clamp(x, 120, WORLD_SIZE - 120);
  y = clamp(y, 120, WORLD_SIZE - 120);

  const dx = Math.sin(0.18 + phase) * p.speed * 0.72 + Math.cos(time * 0.055 + phase) * 6.5;
  const dy = Math.cos(0.18 + phase) * p.speed * 0.72 + Math.cos(time * 0.055 + phase) * (6 + idx * 0.35);
  const yaw = Math.atan2(dy, dx);

  const interference = jammerIntensity(x, y, time);
  const commQuality = Math.max(0.30, 1 - interference);
  const reconQuality = Math.max(0.55, 1 - 0.60 * interference);

  return {
    id: idx,
    type,
    x,
    y,
    yaw,
    alive: true,
    speed: p.speed,
    commQuality,
    reconQuality,
    strikeRange: p.strikeRange,
    reconRange: p.reconRange,
    commRange: p.commRange,
    // Display-only altitude. It is not part of the 2-D RL state.
    visualAltitude: type === "Rec" ? 78 : type === "Com" ? 66 : 58,
  };
}

function targetState(base, time) {
  const [id, x0, y0, heading] = base;
  const speed = 8;
  const wobble = Math.sin(time * 0.035 + id) * 0.55;
  const yaw = heading + wobble;
  return {
    id,
    x: clamp(x0 + Math.cos(yaw) * speed * time, 100, WORLD_SIZE - 100),
    y: clamp(y0 + Math.sin(yaw) * speed * time, 100, WORLD_SIZE - 100),
    yaw,
    alive: true,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildMockWorldState(timeSeconds = 0) {
  const uavs = INITIAL_UAVS.map((base) => uavState(base, timeSeconds));
  const targets = TARGETS.map((base) => targetState(base, timeSeconds));
  const threats = THREATS.map(([id, x, y, radius]) => ({ id, x, y, radius }));
  const jammers = JAMMERS.map(([id, x, y, radius, strength]) => ({
    id,
    x,
    y,
    radius,
    strength,
    intensity: 0.65 + 0.35 * Math.sin((2 * Math.PI * timeSeconds) / (58 + id * 17) + id * 1.3),
  }));

  const commLinks = [];
  for (let i = 0; i < uavs.length; i += 1) {
    for (let j = i + 1; j < uavs.length; j += 1) {
      const a = uavs[i];
      const b = uavs[j];
      const quality = Math.min(a.commQuality, b.commQuality);
      const range = Math.min(a.commRange, b.commRange) * quality;
      if (distance(a, b) <= range) {
        commLinks.push({ a: a.id, b: b.id, quality });
      }
    }
  }

  return {
    time: timeSeconds,
    worldSize: WORLD_SIZE,
    scenario: "contested",
    coordinateModel: "2D-RL / 3D-render",
    uavs,
    targets,
    threats,
    jammers,
    commLinks,
  };
}
