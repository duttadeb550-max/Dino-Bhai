import * as THREE from '../three.module.js';

/* ============================== constants ============================== */
const CHUNK = 16;
const HEIGHT = 96;
const WATER_LEVEL = 26;
const SNOW_LEVEL = 54;
const RENDER_DIST = 7;
const SEED = 20260922;

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5,
      LEAVES = 6, PLANKS = 7, BRICKS = 8, GLASS = 9, WATER = 10,
      SNOW = 11, BEDROCK = 12;

const NAMES = {
  [GRASS]: 'Grass', [DIRT]: 'Dirt', [STONE]: 'Stone', [SAND]: 'Sand',
  [LOG]: 'Oak Log', [LEAVES]: 'Leaves', [PLANKS]: 'Planks',
  [BRICKS]: 'Bricks', [GLASS]: 'Glass', [SNOW]: 'Snow'
};
const HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, BRICKS, GLASS];
const IS_TRANSPARENT = id => id === WATER || id === GLASS;

/* face order: 0 -x, 1 +x, 2 -y, 3 +y, 4 -z, 5 +z */
const FACES = [
  { dir: [-1, 0, 0], corners: [
    { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] },
    { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] } ] },
  { dir: [ 1, 0, 0], corners: [
    { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] },
    { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] } ] },
  { dir: [0, -1, 0], corners: [
    { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] },
    { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] } ] },
  { dir: [0,  1, 0], corners: [
    { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] },
    { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] } ] },
  { dir: [0, 0, -1], corners: [
    { pos: [1, 0, 0], uv: [0, 0] }, { pos: [0, 0, 0], uv: [1, 0] },
    { pos: [1, 1, 0], uv: [0, 1] }, { pos: [0, 1, 0], uv: [1, 1] } ] },
  { dir: [0, 0,  1], corners: [
    { pos: [0, 0, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [1, 0] },
    { pos: [0, 1, 1], uv: [0, 1] }, { pos: [1, 1, 1], uv: [1, 1] } ] },
];
const FACE_SHADE = [0.62, 0.62, 0.5, 1.0, 0.8, 0.8];
const AO_LEVELS = [0.55, 0.7, 0.85, 1.0];
const T = { GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4,
            LOG_SIDE: 5, LOG_TOP: 6, LEAVES: 7, PLANKS: 8, BRICKS: 9,
            GLASS: 10, WATER: 11, SNOW: 12, BEDROCK: 13 };

/* ============================== textures ============================== */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const atlas = document.createElement('canvas');
atlas.width = atlas.height = 128;

function drawAtlas() {
  const g = atlas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rnd = mulberry32(SEED);
  const TS = 32, COLS = 4;

  function tileStart(t) { return [(t % COLS) * TS, Math.floor(t / COLS) * TS]; }
  function noiseFill(t, base, spread) {
    const [ox, oy] = tileStart(t);
    g.fillStyle = base; g.fillRect(ox, oy, TS, TS);
    for (let i = 0; i < 260; i++) {
      const c = base;
      const n = Math.floor((rnd() - 0.5) * spread);
      g.fillStyle = `rgb(${
        Math.max(0, Math.min(255, parseInt(c.slice(1, 3), 16) + n))},${
        Math.max(0, Math.min(255, parseInt(c.slice(3, 5), 16) + n))},${
        Math.max(0, Math.min(255, parseInt(c.slice(5, 7), 16) + n))})`;
      g.fillRect(ox + ((rnd() * TS) | 0), oy + ((rnd() * TS) | 0), 2, 2);
    }
  }

  /* grass top */   noiseFill(T.GRASS_TOP, '#5aa83e', 60);
  /* dirt */        noiseFill(T.DIRT, '#7a5a3a', 50);
  /* stone */       noiseFill(T.STONE, '#8b8b8b', 40);
  /* sand */        noiseFill(T.SAND, '#dcd0a0', 30);
  /* leaves */      noiseFill(T.LEAVES, '#3f7a2c', 80);
  /* snow */        noiseFill(T.SNOW, '#f2f6ff', 18);
  /* bedrock */     noiseFill(T.BEDROCK, '#3a3a3a', 70);

  /* grass side = dirt + green cap */
  {
    const [ox, oy] = tileStart(T.GRASS_SIDE);
    g.drawImage(atlas, ...tileStart(T.DIRT), TS, TS, ox, oy, TS, TS);
    g.fillStyle = '#5aa83e'; g.fillRect(ox, oy, TS, 9);
    for (let x = 0; x < TS; x++) {
      const h = 6 + ((rnd() * 7) | 0);
      g.fillStyle = rnd() > 0.5 ? '#4f9a36' : '#63b747';
      g.fillRect(ox + x, oy, 1, h);
    }
  }

  /* log side */
  {
    const [ox, oy] = tileStart(T.LOG_SIDE);
    noiseFill(T.LOG_SIDE, '#6b4a2a', 30);
    for (let x = 0; x < TS; x += 5 + ((rnd() * 4) | 0)) {
      g.fillStyle = 'rgba(50,32,16,.55)';
      g.fillRect(ox + x, oy, 2, TS);
    }
  }

  /* log top = rings */
  {
    const [ox, oy] = tileStart(T.LOG_TOP);
    g.fillStyle = '#6b4a2a'; g.fillRect(ox, oy, TS, TS);
    for (let r = 14; r > 0; r -= 4) {
      g.fillStyle = r % 8 === 0 ? '#9a7345' : '#7d5730';
      g.fillRect(ox + 16 - r, oy + 16 - r, r * 2, r * 2);
    }
    g.fillStyle = '#5a3d20'; g.fillRect(ox + 15, oy + 15, 2, 2);
  }

  /* planks */
  {
    const [ox, oy] = tileStart(T.PLANKS);
    noiseFill(T.PLANKS, '#a3743f', 26);
    g.fillStyle = 'rgba(60,38,16,.8)';
    for (let y = 0; y < TS; y += 8) g.fillRect(ox, oy + y, TS, 1);
    g.fillRect(ox + 8 + ((rnd() * 8) | 0), oy, 1, 8);
    g.fillRect(ox + 18 + ((rnd() * 8) | 0), oy + 8, 1, 8);
    g.fillRect(ox + 4 + ((rnd() * 8) | 0), oy + 16, 1, 8);
    g.fillRect(ox + 22 + ((rnd() * 6) | 0), oy + 24, 1, 8);
  }

  /* bricks */
  {
    const [ox, oy] = tileStart(T.BRICKS);
    g.fillStyle = '#9c4a3a'; g.fillRect(ox, oy, TS, TS);
    g.fillStyle = '#c9c2b4';
    for (let y = 0; y < TS; y += 8) g.fillRect(ox, oy + y + 7, TS, 1);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : 8;
      for (let x = off; x < TS; x += 16) g.fillRect(ox + x, oy + row * 8, 1, 7);
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${rnd() > .5 ? '140,60,45' : '170,85,66'},.7)`;
      g.fillRect(ox + ((rnd() * TS) | 0), oy + ((rnd() * TS) | 0), 3, 2);
    }
  }

  /* glass */
  {
    const [ox, oy] = tileStart(T.GLASS);
    g.clearRect(ox, oy, TS, TS);
    g.fillStyle = 'rgba(210,236,250,.22)'; g.fillRect(ox + 2, oy + 2, TS - 4, TS - 4);
    g.fillStyle = 'rgba(235,248,255,.92)';
    g.fillRect(ox, oy, TS, 3); g.fillRect(ox, oy + TS - 3, TS, 3);
    g.fillRect(ox, oy, 3, TS); g.fillRect(ox + TS - 3, oy, 3, TS);
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.fillRect(ox + 6, oy + 6, 2, 10); g.fillRect(ox + 6, oy + 6, 8, 2);
    g.fillStyle = 'rgba(160,200,230,.5)';
    g.fillRect(ox + 20, oy + 18, 2, 8);
  }

  /* water */
  {
    const [ox, oy] = tileStart(T.WATER);
    g.fillStyle = 'rgba(52,102,215,.74)'; g.fillRect(ox, oy, TS, TS);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${rnd() > .5 ? '110,160,255' : '40,80,190'},.5)`;
      g.fillRect(ox + ((rnd() * TS) | 0), oy + ((rnd() * TS) | 0), 5, 2);
    }
  }
}
drawAtlas();

function tileFor(id, face) {
  switch (id) {
    case GRASS:  return face === 3 ? T.GRASS_TOP : face === 2 ? T.DIRT : T.GRASS_SIDE;
    case DIRT:   return T.DIRT;
    case STONE:  return T.STONE;
    case SAND:   return T.SAND;
    case LOG:    return (face === 3 || face === 2) ? T.LOG_TOP : T.LOG_SIDE;
    case LEAVES: return T.LEAVES;
    case PLANKS: return T.PLANKS;
    case BRICKS: return T.BRICKS;
    case GLASS:  return T.GLASS;
    case WATER:  return T.WATER;
    case SNOW:   return T.SNOW;
    case BEDROCK:return T.BEDROCK;
  }
  return T.STONE;
}

/* ============================== terrain ============================== */
function hash2(x, z, s = 0) {
  let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s + SEED, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let sum = 0, norm = 0, amp = 1, f = 1;
  for (let i = 0; i < 4; i++) { sum += amp * noise2(x * f, z * f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
function heightAt(x, z) {
  const n = fbm(x / 70, z / 70);
  const m = fbm(x / 17 + 100, z / 17 + 100);
  return Math.max(2, Math.min(HEIGHT - 10, Math.floor(16 + n * 40 + m * 10)));
}
function treeAt(x, z) {
  const h = heightAt(x, z);
  if (h <= WATER_LEVEL + 1 || h >= SNOW_LEVEL) return 0;
  return hash2(x, z, 7) < 0.012 ? 4 + Math.floor(hash2(x, z, 8) * 3) : 0;
}

const chunkData = new Map();  // "cx,cz" -> Uint8Array
const chunkMeshes = new Map();
const key = (cx, cz) => cx + ',' + cz;

function genChunk(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  const set = (lx, ly, lz, id) => {
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || ly < 0 || ly >= HEIGHT) return;
    data[(ly * CHUNK + lz) * CHUNK + lx] = id;
  };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;

  for (let lz = 0; lz < CHUNK; lz++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const h = heightAt(wx, wz);
      const beach = h <= WATER_LEVEL + 1;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = BEDROCK;
        else if (y === h) id = beach ? SAND : h >= SNOW_LEVEL ? SNOW : GRASS;
        else if (y > h - 4) id = beach ? SAND : DIRT;
        else id = STONE;
        set(lx, y, lz, id);
      }
      for (let y = h + 1; y <= WATER_LEVEL; y++) set(lx, y, lz, WATER);
    }
  }

  /* trees (scan with margin so trunks near borders spill correctly) */
  for (let lz = -3; lz < CHUNK + 3; lz++) {
    for (let lx = -3; lx < CHUNK + 3; lx++) {
      const wx = x0 + lx, wz = z0 + lz;
      const trunk = treeAt(wx, wz);
      if (!trunk) continue;
      const h = heightAt(wx, wz);
      const topY = h + trunk;
      for (let y = h + 1; y <= topY; y++) set(lx, y, lz, LOG);
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy >= 0 ? 1 : 2;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && hash2(wx + dx, wz + dz, dy + 30) < 0.5) continue;
            const y = topY + dy;
            if (getLocal(data, lx + dx, y, lz + dz) === AIR) set(lx + dx, y, lz + dz, LEAVES);
          }
        }
      }
    }
  }
  return data;
}
function getLocal(data, lx, ly, lz) {
  if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || ly < 0 || ly >= HEIGHT) return AIR;
  return data[(ly * CHUNK + lz) * CHUNK + lx];
}
function ensureData(cx, cz) {
  const k = key(cx, cz);
  let d = chunkData.get(k);
  if (!d) { d = genChunk(cx, cz); chunkData.set(k, d); }
  return d;
}
function getBlock(wx, wy, wz) {
  if (wy < 0 || wy >= HEIGHT) return AIR;
  const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
  const d = chunkData.get(key(cx, cz));
  if (!d) return AIR;
  return getLocal(d, wx - cx * CHUNK, wy, wz - cz * CHUNK);
}
function setBlock(wx, wy, wz, id) {
  if (wy < 1 || wy >= HEIGHT) return false;
  const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
  const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
  const d = ensureData(cx, cz);
  d[(wy * CHUNK + lz) * CHUNK + lx] = id;
  rebuild(cx, cz);
  if (lx === 0) rebuild(cx - 1, cz);
  if (lx === CHUNK - 1) rebuild(cx + 1, cz);
  if (lz === 0) rebuild(cx, cz - 1);
  if (lz === CHUNK - 1) rebuild(cx, cz + 1);
  return true;
}

/* ============================== meshing ============================== */
const SKY = 0x87b7e8;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, RENDER_DIST * CHUNK * 0.45, RENDER_DIST * CHUNK * 0.98);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 1200);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const tex = new THREE.CanvasTexture(atlas);
tex.magFilter = THREE.NearestFilter;
tex.minFilter = THREE.NearestFilter;
tex.generateMipmaps = false;
tex.colorSpace = THREE.SRGBColorSpace;

const matOpaque = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, fog: true });
const matTrans = new THREE.MeshBasicMaterial({
  map: tex, vertexColors: true, fog: true, transparent: true, depthWrite: true
});

function faceVisible(id, nid) {
  if (nid === AIR) return true;
  if (nid === id) return false;
  return IS_TRANSPARENT(nid);
}
function occludes(id) { return id !== AIR && id !== WATER; }
function axisOf(dir) { return dir[0] !== 0 ? 0 : dir[1] !== 0 ? 1 : 2; }

function vertexAO(wx, wy, wz, f, cpos) {
  const dir = FACES[f].dir, na = axisOf(dir);
  const a0 = na === 0 ? 1 : 0, a1 = na === 2 ? 1 : 2;
  const s0 = cpos[a0] >= 0.5 ? 1 : -1, s1 = cpos[a1] >= 0.5 ? 1 : -1;
  const ox = wx + dir[0], oy = wy + dir[1], oz = wz + dir[2];
  const p0 = [0, 0, 0]; p0[a0] = s0;
  const p1 = [0, 0, 0]; p1[a1] = s1;
  const n1 = occludes(getBlock(ox + p0[0], oy + p0[1], oz + p0[2])) ? 1 : 0;
  const n2 = occludes(getBlock(ox + p1[0], oy + p1[1], oz + p1[2])) ? 1 : 0;
  const nc = occludes(getBlock(ox + p0[0] + p1[0], oy + p0[1] + p1[1], oz + p0[2] + p1[2])) ? 1 : 0;
  return (n1 && n2) ? 0 : 3 - (n1 + n2 + nc);
}

function buildGeometry(cx, cz, wantWater) {
  const data = ensureData(cx, cz);
  const pos = [], uv = [], col = [], idx = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK;

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = data[(y * CHUNK + z) * CHUNK + x];
        if (id === AIR) continue;
        const isWater = id === WATER;
        if (isWater !== wantWater) continue;
        const wx = x0 + x, wz = z0 + z;

        for (let f = 0; f < 6; f++) {
          const d = FACES[f].dir;
          if (!faceVisible(id, getBlock(wx + d[0], y + d[1], wz + d[2]))) continue;
          const tile = tileFor(id, f), tc = tile % 4, tr = (tile / 4) | 0;
          const base = pos.length / 3;
          for (const c of FACES[f].corners) {
            pos.push(x + c.pos[0], y + c.pos[1], z + c.pos[2]);
            uv.push((tc + c.uv[0]) / 4, (3 - tr + c.uv[1]) / 4);
            const s = FACE_SHADE[f] * AO_LEVELS[vertexAO(wx, y, wz, f, c.pos)];
            col.push(s, s, s);
          }
          idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

function disposeMeshes(k) {
  const m = chunkMeshes.get(k);
  if (!m) return;
  scene.remove(m.opaque); m.opaque.geometry.dispose();
  if (m.trans) { scene.remove(m.trans); m.trans.geometry.dispose(); }
  chunkMeshes.delete(k);
}

function buildChunk(cx, cz) {
  ensureData(cx, cz);
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      ensureData(cx + dx, cz + dz);

  const k = key(cx, cz);
  disposeMeshes(k);

  const geo = buildGeometry(cx, cz, false);
  const opaque = new THREE.Mesh(geo, matOpaque);
  opaque.position.set(cx * CHUNK, 0, cz * CHUNK);
  scene.add(opaque);

  const wgeo = buildGeometry(cx, cz, true);
  let trans = null;
  if (wgeo.attributes.position.count > 0) {
    trans = new THREE.Mesh(wgeo, matTrans);
    trans.position.set(cx * CHUNK, 0, cz * CHUNK);
    trans.renderOrder = 1;
    scene.add(trans);
    wgeo.dispose();
  } else {
    wgeo.dispose();
  }
  chunkMeshes.set(k, { opaque, trans });
}
function rebuild(cx, cz) {
  if (chunkMeshes.has(key(cx, cz))) buildChunk(cx, cz);
}

/* streaming: queue chunks near player, build within a per-frame time budget */
function updateChunks(budgetMs) {
  const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
  const wanted = [];
  for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
    for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
      const dist = dx * dx + dz * dz;
      if (dist > RENDER_DIST * RENDER_DIST) continue;
      const cx = pcx + dx, cz = pcz + dz;
      if (!chunkMeshes.has(key(cx, cz))) wanted.push({ cx, cz, dist });
    }
  }
  wanted.sort((a, b) => a.dist - b.dist);

  const t0 = performance.now();
  for (const w of wanted) {
    buildChunk(w.cx, w.cz);
    if (performance.now() - t0 > budgetMs) break;
  }

  for (const [k, m] of chunkMeshes) {
    const [cx, cz] = k.split(',').map(Number);
    if (Math.abs(cx - pcx) > RENDER_DIST + 2 || Math.abs(cz - pcz) > RENDER_DIST + 2) {
      scene.remove(m.opaque); m.opaque.geometry.dispose();
      if (m.trans) { scene.remove(m.trans); m.trans.geometry.dispose(); }
      chunkMeshes.delete(k);
    }
  }
}

/* ============================== player ============================== */
const HALF_W = 0.3, P_HEIGHT = 1.8, EYE = 1.62;
const player = {
  pos: new THREE.Vector3(8, 60, 8),
  vel: new THREE.Vector3(),
  onGround: false, fly: false, inWater: false
};
let yaw = 0, pitch = 0;

function findSpawn() {
  for (let r = 0; r < 60; r++) {
    for (let a = 0; a < 8; a++) {
      const x = Math.round(8 + Math.cos(a) * r), z = Math.round(8 + Math.sin(a) * r);
      const h = heightAt(x, z);
      if (h > WATER_LEVEL + 1 && h < SNOW_LEVEL) { player.pos.set(x + 0.5, h + 1.2, z + 0.5); return; }
    }
  }
  player.pos.set(8.5, heightAt(8, 8) + 2, 8.5);
}
findSpawn();

function solidAt(x, y, z) {
  const id = getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  return id !== AIR && id !== WATER;
}
function collides(px, py, pz) {
  const x0 = Math.floor(px - HALF_W), x1 = Math.floor(px + HALF_W);
  const y0 = Math.floor(py), y1 = Math.floor(py + P_HEIGHT - 0.001);
  const z0 = Math.floor(pz - HALF_W), z1 = Math.floor(pz + HALF_W);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (solidAt(x + 0.5, y + 0.5, z + 0.5)) return true;
  return false;
}

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyF') {
    player.fly = !player.fly;
    player.vel.y = 0;
    toast(player.fly ? 'Fly mode ON' : 'Fly mode OFF');
  }
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= HOTBAR.length) selectSlot(n - 1);
  }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);

function physics(dt) {
  const p = player;
  /* which block is the body in */
  const feetId = getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.4), Math.floor(p.pos.z));
  const headId = getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + EYE), Math.floor(p.pos.z));
  p.inWater = feetId === WATER || headId === WATER;

  const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
  let speed = p.fly ? 14 : sprint ? 7.2 : 4.6;
  if (p.inWater && !p.fly) speed *= 0.55;

  const fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  const str = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const len = Math.hypot(fwd, str) || 1;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const vx = ((-sin * fwd + cos * str) / len) * speed;
  const vz = ((-cos * fwd - sin * str) / len) * speed;

  p.vel.x += (vx - p.vel.x) * Math.min(1, dt * 14);
  p.vel.z += (vz - p.vel.z) * Math.min(1, dt * 14);

  if (p.fly) {
    const up = (keys['Space'] ? 1 : 0) - (sprint ? 1 : 0);
    p.vel.y += (up * 11 - p.vel.y) * Math.min(1, dt * 12);
  } else if (p.inWater) {
    p.vel.y -= 9 * dt;
    if (keys['Space']) p.vel.y = 4.6;
    p.vel.y = Math.max(p.vel.y, -3.5);
  } else {
    p.vel.y -= 31 * dt;
    p.vel.y = Math.max(p.vel.y, -55);
    if (keys['Space'] && p.onGround) { p.vel.y = 8.9; p.onGround = false; }
  }

  /* move + collide, axis by axis */
  p.onGround = false;
  let nx = p.pos.x + p.vel.x * dt;
  if (collides(nx, p.pos.y, p.pos.z)) { p.vel.x = 0; } else p.pos.x = nx;

  let nz = p.pos.z + p.vel.z * dt;
  if (collides(p.pos.x, p.pos.y, nz)) { p.vel.z = 0; } else p.pos.z = nz;

  let ny = p.pos.y + p.vel.y * dt;
  if (collides(p.pos.x, ny, p.pos.z)) {
    if (p.vel.y < 0) p.onGround = true;
    p.vel.y = 0;
  } else p.pos.y = ny;

  /* safety net: fell out of the world */
  if (p.pos.y < -10) findSpawn();

  camera.position.set(p.pos.x, p.pos.y + EYE, p.pos.z);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

/* ============================== interaction ============================== */
function raycast(maxDist) {
  const origin = camera.position;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
  let tmx = dir.x !== 0 ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tdx : Infinity;
  let tmy = dir.y !== 0 ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tdy : Infinity;
  let tmz = dir.z !== 0 ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;

  while (t <= maxDist) {
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) return { x, y, z, nx, ny, nz, id };
    if (tmx < tmy && tmx < tmz) { x += stepX; t = tmx; tmx += tdx; nx = -stepX; ny = 0; nz = 0; }
    else if (tmy < tmz)         { y += stepY; t = tmy; tmy += tdy; nx = 0; ny = -stepY; nz = 0; }
    else                        { z += stepZ; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -stepZ; }
  }
  return null;
}

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 })
);
highlight.visible = false;
scene.add(highlight);

let slot = 0;
function selectSlot(i) {
  slot = i;
  document.querySelectorAll('.slot').forEach((el, j) => el.classList.toggle('active', j === i));
  const el = document.getElementById('itemName');
  el.textContent = NAMES[HOTBAR[i]];
  el.style.opacity = 1;
  clearTimeout(selectSlot._t);
  selectSlot._t = setTimeout(() => el.style.opacity = 0, 1300);
}

function breakBlock() {
  const hit = raycast(6);
  if (!hit || hit.id === BEDROCK) return;
  setBlock(hit.x, hit.y, hit.z, AIR);
  sfx('break');
}
function placeBlock() {
  const hit = raycast(6);
  if (!hit) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  const existing = getBlock(x, y, z);
  if (existing !== AIR && existing !== WATER) return;
  /* don't place inside the player */
  const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  if (x + 1 > px - HALF_W && x < px + HALF_W &&
      y + 1 > py && y < py + P_HEIGHT &&
      z + 1 > pz - HALF_W && z < pz + HALF_W) return;
  setBlock(x, y, z, HOTBAR[slot]);
  sfx('place');
}

/* mouse */
const held = { 0: false, 2: false };
let lastAct = 0;
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousedown', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  held[e.button] = true;
  doAction(e.button);
});
addEventListener('mouseup', e => held[e.button] = false);
function doAction(button) {
  lastAct = performance.now();
  if (button === 0) breakBlock(); else if (button === 2) placeBlock();
}

addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.553, Math.min(1.553, pitch));
});
addEventListener('wheel', e => {
  if (document.pointerLockElement !== renderer.domElement) return;
  selectSlot((slot + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length);
});

/* audio */
let actx = null;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const dur = kind === 'break' ? 0.14 : 0.08;
    const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = actx.createBufferSource(); src.buffer = buf;
    const flt = actx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = kind === 'break' ? 850 : 1700;
    const gain = actx.createGain();
    gain.gain.value = kind === 'break' ? 0.35 : 0.22;
    src.connect(flt).connect(gain).connect(actx.destination);
    src.start();
  } catch (e) { /* audio unavailable */ }
}

/* ============================== UI ============================== */
function buildHotbar() {
  const bar = document.getElementById('hotbar');
  HOTBAR.forEach((id, i) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'slot' + (i === 0 ? ' active' : '');
    const c = document.createElement('canvas');
    c.width = c.height = 34;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const tile = tileFor(id, 1);
    g.drawImage(atlas, (tile % 4) * 32, Math.floor(tile / 4) * 32, 32, 32, 0, 0, 34, 34);
    const img = new Image();
    img.src = c.toDataURL();
    const num = document.createElement('span');
    num.textContent = i + 1;
    slotEl.append(num, img);
    slotEl.addEventListener('click', () => selectSlot(i));
    bar.appendChild(slotEl);
  });
}
buildHotbar();
selectSlot(0);
document.getElementById('itemName').style.opacity = 0;

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.style.display = document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
});
renderer.domElement.addEventListener('click', () => {
  if (document.pointerLockElement !== renderer.domElement)
    renderer.domElement.requestPointerLock();
});

const statsEl = document.getElementById('stats');
const waterTint = document.getElementById('waterTint');

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ============================== loop ============================== */
let last = performance.now(), fps = 0, frames = 0, fpsTime = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;

  const playing = document.pointerLockElement === renderer.domElement;
  if (playing) {
    physics(dt);
    const since = now - lastAct;
    if ((held[0] || held[2]) && since > 220) doAction(held[0] ? 0 : 2);
  } else {
    /* menu: keep the camera at the spawn point so the world is visible
       behind the overlay (physics does this only while playing) */
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  updateChunks(10);

  /* block highlight */
  const hit = playing ? raycast(6) : null;
  highlight.visible = !!hit;
  if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

  waterTint.style.opacity = camera && getBlock(
    Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)
  ) === WATER ? 1 : 0;

  renderer.render(scene, camera);

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(frames / fpsTime); frames = 0; fpsTime = 0;
    statsEl.textContent =
      `FPS ${fps}\n` +
      `XYZ ${player.pos.x.toFixed(1)} / ${player.pos.y.toFixed(1)} / ${player.pos.z.toFixed(1)}\n` +
      `Chunks ${chunkMeshes.size}${player.fly ? '  [FLY]' : ''}`;
  }
}
requestAnimationFrame(loop);
