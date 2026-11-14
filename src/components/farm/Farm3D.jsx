import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useI18n } from "../../i18n.jsx";
import {
  CROP_ICON, FARM_H, FARMHOUSE, PLOT, SITE_W, STAGE_KEYS, TUBEWELL, activeCrop, fieldPos, ripeness,
} from "./farmUtils.js";

// The 3D farm: up to four fields, each growing its kharif crop and then its rabi crop.
// Plant height, density and colour come from the simulation for the chosen day, and
// the sky, rain, lightning, heat haze, cracked soil and flood water come from that
// day's weather. Plant shapes are stylised, not scientific models of each crop.
const V = 2.2; // vertical exaggeration so crops read at farm scale

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const at = (g, x, y, z) => { g.translate(x, y, z); return g; };
const stalk = (r0, r1, h = 1, y = 0.5) => at(new THREE.CylinderGeometry(r0, r1, h, 5), 0, y, 0);
const blob = (r, x, y, z, detail = 0) => at(new THREE.IcosahedronGeometry(r, detail), x, y, z);
function leaf(len, h, yaw, tilt = -0.45, w = 0.09) {
  const g = new THREE.BoxGeometry(len, 0.012, w);
  g.translate(len / 2, 0, 0);
  g.rotateZ(tilt);
  g.rotateY(yaw);
  g.translate(0, h, 0);
  return g;
}

// ---------- plant shapes (1 unit tall; instance scale sets real height) ----------
const SHAPES = {
  ear: () => {   // wheat: a clump of stalks with ears
    const p = [];
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2, r = k ? 0.16 : 0;
      p.push(at(new THREE.CylinderGeometry(0.022, 0.03, 0.82, 4), Math.cos(a) * r, 0.41, Math.sin(a) * r));
      p.push(at(new THREE.CylinderGeometry(0.05, 0.035, 0.2, 5), Math.cos(a) * r, 0.92, Math.sin(a) * r));
    }
    return p;
  },
  awn: () => {   // barley: ears with long bristles
    const p = SHAPES.ear();
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2, r = k ? 0.16 : 0;
      p.push(at(new THREE.ConeGeometry(0.012, 0.22, 3), Math.cos(a) * r, 1.12, Math.sin(a) * r));
    }
    return p;
  },
  panicle: () => {  // oats: stalks with loose drooping spikelets
    const p = [];
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2, r = k ? 0.15 : 0;
      p.push(at(new THREE.CylinderGeometry(0.02, 0.028, 0.85, 4), Math.cos(a) * r, 0.42, Math.sin(a) * r));
      for (let j = 0; j < 3; j += 1) p.push(blob(0.035, Math.cos(a) * r + 0.06 * (j - 1), 0.86 - j * 0.06, Math.sin(a) * r));
    }
    return p;
  },
  tuft: () => {  // rice
    const p = [];
    for (let k = 0; k < 7; k += 1) {
      const b = new THREE.ConeGeometry(0.035, 1, 3);
      b.translate(0, 0.5, 0); b.rotateZ(0.28); b.rotateY((k / 7) * Math.PI * 2);
      p.push(b);
    }
    return p;
  },
  maize: () => [stalk(0.045, 0.07), ...[0.32, 0.48, 0.62, 0.76].map((h, k) => leaf(0.55, h, k * 2.2)),
    at(new THREE.ConeGeometry(0.06, 0.16, 4), 0, 1.06, 0)],
  sorghum: () => [stalk(0.04, 0.065), ...[0.3, 0.46, 0.6, 0.72].map((h, k) => leaf(0.48, h, k * 2.3, -0.4, 0.1))],
  millet: () => [stalk(0.035, 0.05), ...[0.35, 0.55, 0.7].map((h, k) => leaf(0.42, h, k * 2.4, -0.5, 0.07))],
  bush: () => {   // cotton
    const b = new THREE.IcosahedronGeometry(0.42, 1); b.scale(1, 0.85, 1);
    return [at(b, 0, 0.58, 0), at(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 4), 0, 0.15, 0)];
  },
  smallbush: () => [blob(0.26, 0, 0.55, 0, 1), blob(0.2, 0.18, 0.4, 0.05), blob(0.2, -0.15, 0.42, -0.1),
    stalk(0.025, 0.03, 0.4, 0.2)],
  feathery: () => {  // chickpea and lentil: fine, open foliage
    const p = [stalk(0.02, 0.025, 0.8, 0.4)];
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      p.push(blob(0.11, Math.cos(a) * 0.18, 0.45 + (k % 3) * 0.17, Math.sin(a) * 0.18));
    }
    return p;
  },
  column: () => [stalk(0.03, 0.04), blob(0.2, 0, 0.35, 0), blob(0.18, 0.02, 0.6, 0), blob(0.14, -0.02, 0.85, 0)],
  sunflower: () => [stalk(0.04, 0.06), leaf(0.3, 0.35, 0, -0.3, 0.2), leaf(0.3, 0.55, 2.4, -0.3, 0.2), leaf(0.26, 0.75, 4.4, -0.3, 0.18)],
  mustard: () => {
    const p = [stalk(0.025, 0.04, 0.7, 0.35)];
    for (let k = 0; k < 3; k += 1) {
      const br = new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4);
      br.translate(0, 0.22, 0); br.rotateZ(0.35); br.rotateY(k * 2.1); br.translate(0, 0.55, 0);
      p.push(br);
    }
    p.push(blob(0.16, 0, 0.3, 0));
    return p;
  },
  shrub: () => {  // sesbania: tall thin stem, feathery top
    const p = [stalk(0.03, 0.05)];
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      p.push(blob(0.13, Math.cos(a) * 0.14, 0.8 + (k % 2) * 0.12, Math.sin(a) * 0.14));
    }
    return p;
  },
  clover: () => {  // berseem: low dense mound
    const p = [];
    for (let k = 0; k < 7; k += 1) {
      const a = (k / 7) * Math.PI * 2, r = k ? 0.22 : 0;
      p.push(blob(0.16, Math.cos(a) * r, 0.55 + (k % 2) * 0.12, Math.sin(a) * r));
    }
    return p;
  },
};

// ---------- crop looks: shape, colours, spacing, and optional flowers or fruit ----------
// Accent points are [angle, radius, height] in plant units.
const TOP = [[0, 0, 1.02]];
const LOOKS = {
  cotton: { shape: "bush", green: "#3e7d3a", ripe: "#7a8040", spacing: 1.9, width: 1.6,
    accent: { geo: () => new THREE.SphereGeometry(0.16, 6, 4), color: "#f6f4ee", when: "late",
      points: [[0, 0.36, 0.45], [2.1, 0.36, 0.63], [4.2, 0.36, 0.81]] } },
  rice: { shape: "tuft", green: "#4ea24a", ripe: "#cdb85c", spacing: 1.4, width: 1.6 },
  maize: { shape: "maize", green: "#3f8e3a", ripe: "#b9a262", spacing: 1.8, width: 1.25 },
  sorghum: { shape: "sorghum", green: "#4a8a3a", ripe: "#a8875a", spacing: 1.8, width: 1.25,
    accent: { geo: () => { const g = new THREE.SphereGeometry(0.11, 6, 5); g.scale(1, 1.7, 1); return g; },
      color: "#9c4a2a", when: "head", points: TOP } },
  pearl_millet: { shape: "millet", green: "#5a9a40", ripe: "#b8a66a", spacing: 1.7, width: 1.2,
    accent: { geo: () => new THREE.CylinderGeometry(0.05, 0.045, 0.34, 6), color: "#c9b77a", when: "head",
      points: [[0, 0, 1.12]] } },
  mung_bean: { shape: "smallbush", green: "#4f9a45", ripe: "#9a8a4a", spacing: 1.3, width: 1.5 },
  soybean: { shape: "smallbush", green: "#468f3f", ripe: "#b59a52", spacing: 1.4, width: 1.6 },
  guar: { shape: "column", green: "#5a9440", ripe: "#a59252", spacing: 1.4, width: 1.3 },
  sunflower: { shape: "sunflower", green: "#4c8c3c", ripe: "#8a7a42", spacing: 1.9, width: 1.2,
    accent: { geo: () => { const g = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12); g.rotateX(1.1); return g; },
      color: "#f2c12e", lateColor: "#7a5a2e", when: "flower", points: TOP } },
  sesbania: { shape: "shrub", green: "#56a248", ripe: "#6e8a3a", spacing: 1.6, width: 1.5 },
  wheat: { shape: "ear", green: "#5d9b3e", ripe: "#d9b64a", spacing: 1.25, width: 1.6 },
  barley: { shape: "awn", green: "#6aa246", ripe: "#d6bf6a", spacing: 1.25, width: 1.6 },
  oats: { shape: "panicle", green: "#5f9c4a", ripe: "#c9c07a", spacing: 1.25, width: 1.6 },
  mustard: { shape: "mustard", green: "#4f8d3d", ripe: "#9a8a45", spacing: 1.5, width: 1.4,
    accent: { geo: () => new THREE.IcosahedronGeometry(0.1, 0), color: "#f4d03f", when: "bloom",
      points: [[0, 0.15, 0.98], [1.3, 0.2, 0.92], [2.6, 0.12, 1.02], [3.9, 0.22, 0.88], [5.2, 0.1, 0.95]] } },
  chickpea: { shape: "feathery", green: "#5c9a4a", ripe: "#a89a5a", spacing: 1.2, width: 1.5 },
  lentil: { shape: "feathery", green: "#6aa452", ripe: "#b0a060", spacing: 1.1, width: 1.4 },
  berseem: { shape: "clover", green: "#3f9a46", ripe: "#5f8a3e", spacing: 1.2, width: 1.7,
    accent: { geo: () => new THREE.IcosahedronGeometry(0.07, 0), color: "#f3f1e6", when: "bloom",
      points: [[0, 0.1, 0.85], [2.5, 0.2, 0.75], [4.4, 0.15, 0.8]] } },
  potato: { shape: "smallbush", green: "#457f3a", ripe: "#8a8040", spacing: 1.5, width: 1.7,
    accent: { geo: () => new THREE.IcosahedronGeometry(0.06, 0), color: "#e9e1f2", when: "bloom",
      points: [[0, 0.1, 1.0], [2.1, 0.2, 0.9]] } },
};
const DEFAULT_LOOK = { shape: "smallbush", green: "#4f8f3f", ripe: "#a89a55", spacing: 1.5, width: 1.5 };

const STRESSED = new THREE.Color("#a9984a");
const STUBBLE = new THREE.Color("#cbb27c");
const SOIL_DRY = new THREE.Color("#c9a774");
const SOIL_WET = new THREE.Color("#6b4a2e");
const FALLOW = new THREE.Color("#c7ab80");
const SCORCHED = new THREE.Color("#b5733a");

function geometryFor(shape) {
  const parts = (SHAPES[shape] || SHAPES.smallbush)();
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  g.computeVertexNormals();
  return g;
}

// How large the flowers or fruit are (0..1) on a given day
function accentScale(when, st, rip) {
  if (when === "late") return st === 3 ? rip : 0;                         // cotton bolls open
  if (when === "head") return st === 2 ? 0.6 : st === 3 ? 1 : 0;          // grain heads
  if (when === "flower") return st === 2 ? 1 : st === 3 ? 1 : 0;           // sunflower heads
  if (when === "bloom") return st === 2 ? 1 : st === 3 ? Math.max(0, 1 - rip * 1.5) : 0; // short bloom
  return 0;
}

const SITE_H = FARM_H;
const toWorld = (x, y) => new THREE.Vector3(x - SITE_W / 2, 0, y - SITE_H / 2);
const fieldCentre = (i) => { const p = fieldPos(i); return toWorld(p.x + PLOT / 2, p.y + PLOT / 2); };

const SKY_DAY = new THREE.Color("#bcdcef");
const SKY_DAY_DARK = new THREE.Color("#1d2c34");
const SKY_STORM = new THREE.Color("#5f6b74");
const SKY_HEAT = new THREE.Color("#f2a35e");
const RAIN_N = 4000;

// Dry, cracked earth drawn once on a canvas
function crackTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#d2b07a";
  g.fillRect(0, 0, 256, 256);
  const r = rng(42);
  g.strokeStyle = "#7a5634";
  g.lineCap = "round";
  for (let k = 0; k < 46; k += 1) {
    let x = r() * 256, y = r() * 256;
    g.lineWidth = 1 + r() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (r() - 0.5) * 60; y += (r() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildScene(container, fields) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scene = new THREE.Scene();
  const skyBase = dark ? SKY_DAY_DARK : SKY_DAY;
  scene.background = skyBase.clone();
  scene.fog = new THREE.Fog(scene.background.clone(), 200, 480);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1500);
  camera.position.set(62, 70, 104);

  const phone = window.matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: !phone || window.devicePixelRatio < 2, powerPreference: "high-performance" });
  // Phones draw at a lower pixel density: looks the same, much less work.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // film-like light and colour
  renderer.toneMappingExposure = dark ? 0.95 : 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = "farm3d-labels";
  container.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 20;
  controls.maxDistance = 300;

  // Sky dome: deep blue overhead fading to a pale, hazy horizon
  const domeGeo = new THREE.SphereGeometry(900, 32, 16);
  const top = new THREE.Color(dark ? "#0f1f2c" : "#5d9ad0"), horizon = new THREE.Color(dark ? "#2b3c44" : "#e4eef0");
  const cols = [];
  const pa = domeGeo.attributes.position;
  for (let k = 0; k < pa.count; k += 1) {
    const h = Math.max(0, pa.getY(k) / 900);
    const c = horizon.clone().lerp(top, Math.pow(h, 0.55));
    cols.push(c.r, c.g, c.b);
  }
  domeGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, toneMapped: false }));
  scene.add(dome);
  scene.fog.color.copy(horizon);

  const hemi = new THREE.HemisphereLight(dark ? "#b9cbd6" : "#dfeeff", "#7a6040", dark ? 1.0 : 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffeccc", dark ? 1.7 : 2.9);
  sun.position.set(-70, 110, 55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 360 });
  scene.add(sun);

  // Ground textures, drawn once on small canvases (no image downloads)
  const tex = (draw, repeat) => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    draw(c.getContext("2d"), rng(11));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const speckle = (g, r, base, colors, n) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < n; k += 1) {
      g.fillStyle = colors[Math.floor(r() * colors.length)];
      g.globalAlpha = 0.25 + r() * 0.5;
      g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
    }
    g.globalAlpha = 1;
  };
  const grassTex = tex((g, r) => speckle(g, r, dark ? "#3c5733" : "#86a95f", ["#6f9450", "#9ab96a", "#5e8443", "#a9c47a", "#7d9c55"], 5200), 70);
  const yardTex = tex((g, r) => speckle(g, r, "#cdb68c", ["#bfa57a", "#d9c49c", "#b39468", "#e2d0ab"], 4200), 10);
  // Ploughed soil: light furrows the crop colour sits on (tinted per day by the soil colour)
  const furrowTex = tex((g, r) => {
    speckle(g, r, "#e9e2d6", ["#d8cfc0", "#f4efe6", "#cfc5b4"], 3000);
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = "rgba(90,70,45,.22)"; g.fillRect(0, y, 256, 3);
      g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(0, y + 3, 256, 1);
    }
  }, 4);

  const ground = (w, h, map, y = 0, color = "#ffffff") => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ color, map }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
  };
  ground(1600, 1600, grassTex, -0.05);
  ground(SITE_W + 16, SITE_H + 16, yardTex, 0);

  // Water with a sun glint (Phong highlight is cheap and looks wet)
  const waterMat = new THREE.MeshPhongMaterial({ color: "#3f7ea6", specular: "#ffffff", shininess: 90, transparent: true, opacity: 0.92 });
  const channel = new THREE.Mesh(new THREE.BoxGeometry(SITE_W + 16, 0.4, 3), waterMat);
  channel.position.set(0, -0.05, -SITE_H / 2 - 6);
  scene.add(channel);
  const mid = toWorld(PLOT + 4, 0);
  const between = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, FARM_H), waterMat);
  between.position.set(mid.x, -0.05, 0);
  scene.add(between);

  // Earth ridges (watt) around every field, as on Punjab farms
  const bundMat = new THREE.MeshLambertMaterial({ color: "#a98a5e" });
  const bundGeo = new THREE.BoxGeometry(1, 0.7, 1);
  const bunds = new THREE.InstancedMesh(bundGeo, bundMat, fields.length * 4);
  fields.forEach((_, idx) => {
    const c = fieldCentre(idx), h = PLOT / 2 + 0.4;
    [[0, -h, PLOT + 1.6, 1.1], [0, h, PLOT + 1.6, 1.1], [-h, 0, 1.1, PLOT + 1.6], [h, 0, 1.1, PLOT + 1.6]].forEach(([dx, dz, sx, sz], k) => {
      bunds.setMatrixAt(idx * 4 + k, new THREE.Matrix4().compose(new THREE.Vector3(c.x + dx, 0.3, c.z + dz), new THREE.Quaternion(), new THREE.Vector3(sx, 1, sz)));
    });
  });
  bunds.receiveShadow = true;
  scene.add(bunds);

  // Village house: flat mud-plaster roof with a low parapet, a door and a window
  const house = toWorld(FARMHOUSE.x + 9, FARMHOUSE.y + 12);
  const mud = new THREE.MeshLambertMaterial({ color: "#cfa97c" });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 10), mud);
  walls.position.set(house.x, 2.75, house.z); walls.castShadow = true; walls.receiveShadow = true; scene.add(walls);
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.5, 10.6), new THREE.MeshLambertMaterial({ color: "#b8926a" }));
  roofSlab.position.set(house.x, 5.75, house.z); roofSlab.castShadow = true; scene.add(roofSlab);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.9, 0.4), mud);
  parapet.position.set(house.x, 6.4, house.z + 5.1); scene.add(parapet);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.2), new THREE.MeshLambertMaterial({ color: "#5a3a24" }));
  door.position.set(house.x - 3, 1.7, house.z + 5.05); scene.add(door);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 0.2), new THREE.MeshLambertMaterial({ color: "#2f3d45" }));
  win.position.set(house.x + 3, 3, house.z + 5.05); scene.add(win);

  // Tube-well: a small brick room pouring into a pond
  const well = toWorld(TUBEWELL.x + 9, TUBEWELL.y + 14);
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.5, 32), waterMat);
  pond.position.set(well.x, 0.1, well.z + 2); scene.add(pond);
  const pondRim = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.5, 6, 32), new THREE.MeshLambertMaterial({ color: "#9b7b55" }));
  pondRim.rotation.x = Math.PI / 2; pondRim.position.set(well.x, 0.3, well.z + 2); scene.add(pondRim);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 4.5), new THREE.MeshLambertMaterial({ color: "#a65a3c" }));
  pump.position.set(well.x, 1.8, well.z - 8); pump.castShadow = true; scene.add(pump);
  const pumpRoof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 5.1), new THREE.MeshLambertMaterial({ color: "#8a8f95" }));
  pumpRoof.position.set(well.x, 3.8, well.z - 8); scene.add(pumpRoof);

  // Trees: near trees have three-lobed crowns in varied greens; a far tree line closes the horizon
  const treeRand = rng(7);
  const N = 54, FAR = 140;
  const trunkMat = new THREE.MeshLambertMaterial({ color: "#5e4430" });
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.55, 5, 6), trunkMat, N);
  const crownMat = new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 1), crownMat, N * 3);
  const farMat = new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true });
  const far = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(4, 0), farMat, FAR);
  const greens = dark ? ["#2f5530", "#3a6234", "#284a2a"] : ["#4f8040", "#5f9147", "#3f6f36", "#6b9a4c"];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2 + treeRand() * 0.08;
    const r = 95 + treeRand() * 50;
    const s = 0.9 + treeRand() * 0.8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    trunks.setMatrixAt(i, m.compose(v.set(x, 2.5 * s, z), q, sc.set(s, s, s)));
    for (let k = 0; k < 3; k += 1) {
      const ang = (k / 3) * Math.PI * 2 + treeRand();
      const off = k === 0 ? 0 : 1.4 * s;
      crowns.setMatrixAt(i * 3 + k, m.compose(v.set(x + Math.cos(ang) * off, (5.8 + (k === 0 ? 1.4 : 0)) * s, z + Math.sin(ang) * off),
        q.setFromEuler(new THREE.Euler(treeRand(), treeRand() * 3, 0)), sc.setScalar(s * (k === 0 ? 1.15 : 0.95))));
      crowns.setColorAt(i * 3 + k, new THREE.Color(greens[Math.floor(treeRand() * greens.length)]).multiplyScalar(0.9 + treeRand() * 0.2));
    }
  }
  q.identity();
  for (let i = 0; i < FAR; i += 1) {
    const a = (i / FAR) * Math.PI * 2 + treeRand() * 0.05;
    const r = 230 + treeRand() * 70;
    const s = 1 + treeRand() * 1.2;
    far.setMatrixAt(i, m.compose(v.set(Math.cos(a) * r, 3.5 * s, Math.sin(a) * r), q, sc.set(s * 1.3, s, s * 1.3)));
    far.setColorAt(i, new THREE.Color(greens[i % greens.length]).multiplyScalar(0.75));
  }
  crowns.castShadow = true; trunks.castShadow = true;
  scene.add(trunks, crowns, far);

  // Rain: short falling streaks over the whole farm
  const rainPos = new Float32Array(RAIN_N * 6);
  const rr = rng(9);
  for (let i = 0; i < RAIN_N; i += 1) {
    const x = (rr() - 0.5) * 220, y = rr() * 90, z = (rr() - 0.5) * 220;
    rainPos.set([x, y, z, x + 0.3, y - 2.4, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo,
    new THREE.LineBasicMaterial({ color: "#d6e6f2", transparent: true, opacity: 0.55 }));
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  const cracks = crackTexture();

  // One soil plane, flood water, outline and label per field; one plant mesh per crop
  const plots = fields.map((field, idx) => {
    const c = fieldCentre(idx);
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(PLOT, PLOT),
      new THREE.MeshLambertMaterial({ color: FALLOW.clone(), map: furrowTex }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(c.x, 0.03, c.z);
    soil.receiveShadow = true;
    soil.userData.field = idx;
    scene.add(soil);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(PLOT - 0.6, PLOT - 0.6),
      new THREE.MeshStandardMaterial({ color: "#5b97bd", transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(c.x, 0.12, c.z);
    water.visible = false;
    scene.add(water);

    const h = PLOT / 2;
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-h, 0, -h), new THREE.Vector3(h, 0, -h),
        new THREE.Vector3(h, 0, h), new THREE.Vector3(-h, 0, h),
      ]),
      new THREE.LineBasicMaterial({ color: "#f3d35a" }));
    outline.position.set(c.x, 0.25, c.z);
    outline.visible = false;
    scene.add(outline);

    const crops = {};
    [field.kharif, field.rabi].filter(Boolean).forEach((key, k) => {
      if (crops[key]) return;
      const look = LOOKS[key] || DEFAULT_LOOK;
      const step = look.spacing * 1.15;
      const n = Math.floor((PLOT - 1) / step);
      const rand = rng(100 + idx * 7 + k);
      const spots = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          spots.push({
            x: c.x - PLOT / 2 + 0.5 + (i + 0.5) * step + (rand() - 0.5) * step * 0.5,
            z: c.z - PLOT / 2 + 0.5 + (j + 0.5) * step + (rand() - 0.5) * step * 0.5,
            yaw: rand() * Math.PI * 2,
            size: 0.85 + rand() * 0.3,
            tint: 0.88 + rand() * 0.2,
          });
        }
      }
      const mesh = new THREE.InstancedMesh(geometryFor(look.shape),
        new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 0.85 }), spots.length);
      mesh.castShadow = true;
      mesh.visible = false;
      spots.forEach((s, i) => mesh.setColorAt(i, new THREE.Color(look.green).multiplyScalar(s.tint)));
      scene.add(mesh);
      let accent = null;
      if (look.accent) {
        accent = new THREE.InstancedMesh(look.accent.geo(),
          new THREE.MeshStandardMaterial({ color: look.accent.color, roughness: 0.8, flatShading: true }),
          spots.length * look.accent.points.length);
        accent.visible = false;
        scene.add(accent);
      }
      crops[key] = { look, mesh, accent, spots };
    });

    const div = document.createElement("div");
    div.className = "farm3d-label";
    const label = new CSS2DObject(div);
    label.position.set(c.x, 6, c.z);
    scene.add(label);

    return { soil, water, outline, crops, div, label };
  });

  return { scene, camera, renderer, labels, controls, plots, rain, sun, hemi, cracks, furrowTex, skyBase, crownMat, farMat, dome, dark };
}

// Total rain over the last `n` days up to `day`
const rainSum = (rain, day, n) => {
  let s = 0;
  for (let i = Math.max(0, day - n + 1); i <= day; i += 1) s += rain[i] || 0;
  return s;
};

export default function Farm3D({ fields, plots, weather, day, selected, onSelect }) {
  const { t, cropShort } = useI18n();
  const hostRef = useRef(null);
  const fxRef = useRef(null);
  const worldRef = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const sig = fields.map((f) => `${f.kharif || "-"}/${f.rabi || "-"}`).join(",");

  // Build the scene when the fields' crops change
  useEffect(() => {
    const host = hostRef.current;
    const world = buildScene(host, sig.split(",").map((s) => {
      const [kharif, rabi] = s.split("/");
      return { kharif: kharif === "-" ? null : kharif, rabi: rabi === "-" ? null : rabi };
    }));
    worldRef.current = world;
    const { scene, camera, renderer, labels, controls, rain } = world;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const pos = rain.geometry.attributes.position;
    const draw = () => {
      raf = 0;
      controls.update();
      if (rain.visible && !still) {
        // Let the rain fall; streaks that reach the ground start again at the top
        const a = pos.array, speed = world.rainSpeed || 1.6;
        for (let i = 0; i < a.length; i += 6) {
          a[i + 1] -= speed; a[i + 4] -= speed;
          if (a[i + 4] < 0) { a[i + 1] += 90; a[i + 4] += 90; }
        }
        pos.needsUpdate = true;
      }
      renderer.render(scene, camera);
      labels.render(scene, camera);
      if (rain.visible && !still) raf = requestAnimationFrame(draw);
    };
    const requestDraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
    world.requestDraw = requestDraw;
    controls.addEventListener("change", requestDraw);

    // Until the user moves the camera, back it off on narrow screens so the farm fits.
    let userMoved = false;
    controls.addEventListener("start", () => { userMoved = true; });
    const home = camera.position.clone();
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!userMoved) camera.position.copy(home).multiplyScalar(Math.max(1, 1.45 / camera.aspect));
      requestDraw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const ray = new THREE.Raycaster();
    let down = null;
    const onDown = (e) => { down = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(world.plots.map((p) => p.soil))[0];
      if (hit) selectRef.current(hit.object.userData.field);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      world.cracks.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      [...host.children].forEach((ch) => { if (ch !== fxRef.current) ch.remove(); });
      worldRef.current = null;
    };
  }, [sig]);

  // Update plants, soil, sky and weather whenever the day, results or selection change
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const byKey = Object.fromEntries(plots.map((p) => [p.crop, p]));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();

    // ---- weather of the day ----
    const rainToday = weather.rain[day] ?? 0;
    const tmax = weather.tmax[day] ?? 30;
    const wet = Math.min(1, rainToday / 30);
    const heat = Math.max(0, Math.min(1, (tmax - 38) / 8));
    const dry30 = rainSum(weather.rain, day, 30) < 4 && tmax >= 34;
    const sky = world.skyBase.clone().lerp(SKY_HEAT, heat * 0.75).lerp(SKY_STORM, wet * 0.85);
    world.scene.background.copy(sky);
    world.dome.material.color.set("#ffffff").lerp(new THREE.Color("#ffb37a"), heat * 0.6).lerp(new THREE.Color("#6f7b84"), wet * 0.8);
    world.scene.fog.color.copy(sky);
    world.scene.fog.near = 200 - 140 * Math.max(wet, heat * 0.6);
    world.sun.intensity = (world.dark ? 1.6 : 2.4) * (1 - wet * 0.65) * (1 + heat * 0.25);
    world.sun.color.set(heat > 0.2 ? "#ffd9a8" : "#fff4df");
    world.rain.visible = rainToday >= 2;
    world.rain.geometry.setDrawRange(0, Math.round(RAIN_N * 2 * Math.min(1, 0.15 + rainToday / 40)));
    world.rainSpeed = 1.2 + Math.min(2, rainToday / 25);
    world.crownMat.color.set("#ffffff").lerp(new THREE.Color("#c9b98a"), dry30 ? 0.45 : 0);
    world.farMat.color.copy(world.crownMat.color);

    // Screen effects: heat haze and lightning live in a CSS layer over the canvas
    const fx = fxRef.current;
    if (fx) {
      fx.classList.toggle("fx-heat", heat > 0.35);
      fx.classList.toggle("fx-storm", rainToday >= 40);
      fx.style.setProperty("--heat", heat.toFixed(2));
    }

    world.plots.forEach((w, idx) => {
      const field = fields[idx];
      if (!field) return;
      const act = activeCrop(field, byKey, day);
      w.outline.visible = selected === idx;

      Object.entries(w.crops).forEach(([key, c]) => {
        const p = byKey[key];
        const show = p && act.key === key;
        c.mesh.visible = !!show;
        if (c.accent) c.accent.visible = false;
        if (!show) return;
        const { look } = c;
        const s = p.scenario.series;
        const st = p.scenario.stage[day];
        const growing = st >= 0 && st <= 3;
        const ccMax = Math.max(...s.cc.filter((v) => v != null), 0.01);
        const h = st === 4 ? 0.07 : Math.max(0.05, s.height[day] ?? 0) * p.height_m * V;
        const spread = st === 4 ? 0.8 : 0.35 + 0.8 * ((s.cc[day] ?? 0) / ccMax);
        const rip = ripeness(p, day);
        const stress = growing ? 1 - (s.ks[day] ?? 1) : 0;
        const scorch = growing ? (s.heat[day] ?? 0) : 0;
        if (st === 4) col.copy(STUBBLE);
        else {
          col.set(look.green).lerp(new THREE.Color(look.ripe), rip).lerp(STRESSED, stress * 0.8)
            .lerp(SCORCHED, scorch * 0.6);
        }
        c.mesh.material.color.copy(col);
        // Water-stressed plants droop: shorter and narrower
        const droop = 1 - stress * 0.35;
        c.spots.forEach((sp, i) => {
          q.setFromAxisAngle(up, sp.yaw);
          const xz = look.width * spread * sp.size;
          m.compose(pos.set(sp.x, 0.03, sp.z), q, scl.set(xz, h * sp.size * droop, xz));
          c.mesh.setMatrixAt(i, m);
        });
        c.mesh.instanceMatrix.needsUpdate = true;

        if (c.accent) {
          const a = look.accent;
          const size = growing ? accentScale(a.when, st, rip) : 0;
          c.accent.visible = size > 0.05;
          if (a.lateColor) c.accent.material.color.set(a.color).lerp(new THREE.Color(a.lateColor), st === 3 ? rip : 0);
          if (c.accent.visible) {
            let k = 0;
            c.spots.forEach((sp) => {
              const xz = look.width * spread * sp.size;
              a.points.forEach(([ang, r, y]) => {
                const th = sp.yaw + ang;
                m.compose(pos.set(sp.x + Math.cos(th) * r * xz, y * h * sp.size * droop, sp.z + Math.sin(th) * r * xz),
                  q, scl.setScalar(size * sp.size * (0.7 + 0.3 * xz)));
                c.accent.setMatrixAt(k, m);
                k += 1;
              });
            });
            c.accent.instanceMatrix.needsUpdate = true;
          }
        }
      });

      // Soil: wet and dark after rain, cracked when dry, under water when flooded
      const p = act.key ? byKey[act.key] : null;
      const growing = act.growing && p;
      const soilWater = growing ? (p.scenario.series.soil_water[day] ?? 50) : (dry30 ? 5 : 40 + wet * 60);
      const cracked = soilWater < 22 && (dry30 || growing);
      const mat = w.soil.material;
      const wantMap = cracked ? world.cracks : world.furrowTex;
      if (mat.map !== wantMap) { mat.map = wantMap; mat.needsUpdate = true; }
      mat.color.copy(cracked ? new THREE.Color("#ffffff")
        : (act.key ? SOIL_DRY.clone().lerp(SOIL_WET, soilWater / 100) : FALLOW.clone().lerp(SOIL_WET, wet * 0.6)));
      const flooded = growing && ((p.flooded && soilWater >= 75) || p.scenario.waterlog[day] === 1);
      w.water.visible = flooded || rainToday >= 50;
      w.water.material.opacity = growing && p.flooded && !p.scenario.waterlog[day] ? 0.45 : 0.7;
      w.water.position.y = growing && p.scenario.waterlog[day] ? 0.12 + 0.6 : 0.12;

      // Label: field name, crop in the ground and its stage
      w.div.innerHTML = "";
      const name = document.createElement("strong");
      name.textContent = `${t("fieldN", { n: idx + 1 })} · ${act.key ? `${CROP_ICON[act.key] || ""} ${cropShort(act.key)}` : t("bareNow")}`;
      w.div.append(name);
      if (selected === idx && p) {
        const sub = document.createElement("span");
        const st = p.scenario.stage[day];
        sub.textContent = st === 4 ? t("harvested") : t(`stS_${STAGE_KEYS[st]}`);
        w.div.append(sub);
      }
      w.div.classList.toggle("is-selected", selected === idx);
      w.div.classList.toggle("is-stressed", !!growing && (p.scenario.series.ks[day] ?? 1) < 0.55);
      w.label.position.y = 4 + (p && act.growing ? p.height_m * V : 0);
    });
    world.requestDraw?.();
  }, [fields, plots, weather, day, selected, t, cropShort]);

  return (
    <div ref={hostRef} className="farm3d" role="img" aria-label={t("farm3dLabel")}>
      <div ref={fxRef} className="farm3d-fx" aria-hidden="true"><i className="fx-haze" /><i className="fx-flash" /></div>
    </div>
  );
}
