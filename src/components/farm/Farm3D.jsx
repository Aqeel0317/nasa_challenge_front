import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useI18n } from "../../i18n.jsx";
import {
  FARM_H, FARM_W, FARMHOUSE, PLOT, ROAD_Y, STAGE_KEYS, TUBEWELL, plotPos, ripeness, stageOf,
} from "./farmUtils.js";

// The 3D farm. Plant height, density and colour come from the simulation for the
// chosen day; the plant shapes are stylised, not scientific models of each crop.

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

const toWorld = (x, y) => new THREE.Vector3(x - FARM_W / 2 + PLOT / 2, 0, y - FARM_H / 2 + PLOT / 2);

function buildScene(container, keys) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(dark ? "#1d2c34" : "#cfe2ec");
  scene.fog = new THREE.Fog(scene.background, 260, 620);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1500);
  camera.position.set(80, 80, 116);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = "farm3d-labels";
  container.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 25;
  controls.maxDistance = 380;

  scene.add(new THREE.HemisphereLight(dark ? "#b9cbd6" : "#eef6ff", "#6f5a3a", dark ? 1.1 : 1.6));
  const sun = new THREE.DirectionalLight("#fff4df", dark ? 1.6 : 2.4);
  sun.position.set(-90, 150, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  scene.add(sun);

  const flat = (w, h, color, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m;
  };
  flat(1400, 1400, dark ? "#3f5a37" : "#8db06a", -0.05);
  flat(FARM_W + 16, FARM_H + 16, "#d4c196", 0);
  const road = flat(FARM_W + 16, 9, "#bfa77b", 0.01);
  road.position.z = ROAD_Y - FARM_H / 2;

  const channel = new THREE.Mesh(new THREE.BoxGeometry(FARM_W + 16, 0.4, 3.2),
    new THREE.MeshStandardMaterial({ color: "#4f86a8", roughness: 0.2, metalness: 0.1 }));
  channel.position.set(0, -0.1, -FARM_H / 2 - 10);
  scene.add(channel);

  // Farmhouse and tube-well in the two spare cells of the rabi block
  const house = toWorld(FARMHOUSE.x, FARMHOUSE.y);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), new THREE.MeshStandardMaterial({ color: "#d8c7b0" }));
  walls.position.set(house.x, 3, house.z); walls.castShadow = true; scene.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10.5, 4, 4), new THREE.MeshStandardMaterial({ color: "#9b5b3c", flatShading: true }));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.75); roof.position.set(house.x, 8, house.z); roof.castShadow = true; scene.add(roof);
  const well = toWorld(TUBEWELL.x, TUBEWELL.y);
  const pond = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.5, 24), new THREE.MeshStandardMaterial({ color: "#5b97bd", roughness: 0.2 }));
  pond.position.set(well.x, 0.1, well.z + 2); scene.add(pond);
  const pump = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: "#8a8f95" }));
  pump.position.set(well.x, 1.5, well.z - 8); pump.castShadow = true; scene.add(pump);

  // Trees around the farm
  const treeRand = rng(7);
  const N = 64;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 5),
    new THREE.MeshStandardMaterial({ color: "#6b4f35" }), N);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.2, 0),
    new THREE.MeshStandardMaterial({ color: dark ? "#2f5530" : "#4c7d3f", flatShading: true }), N);
  const m = new THREE.Matrix4();
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2 + treeRand() * 0.08;
    const r = 120 + treeRand() * 60;
    const s = 0.9 + treeRand() * 0.8;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.85;
    m.compose(new THREE.Vector3(x, 2 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 5.6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.2, s));
    crowns.setMatrixAt(i, m);
  }
  crowns.castShadow = true;
  scene.add(trunks, crowns);

  // One soil plane, one instanced plant mesh, optional accents and a label per plot
  const plots = {};
  keys.forEach((key, idx) => {
    const look = LOOKS[key] || DEFAULT_LOOK;
    const pos = plotPos(key, idx);
    const c = toWorld(pos.x, pos.y);
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(PLOT, PLOT),
      new THREE.MeshStandardMaterial({ color: FALLOW.clone(), roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(c.x, 0.03, c.z);
    soil.receiveShadow = true;
    soil.userData.crop = key;
    scene.add(soil);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(PLOT - 0.6, PLOT - 0.6),
      new THREE.MeshStandardMaterial({ color: "#5b97bd", transparent: true, opacity: 0.55, roughness: 0.15 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(c.x, 0.12, c.z);
    water.visible = false;
    scene.add(water);

    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-PLOT / 2, 0, -PLOT / 2), new THREE.Vector3(PLOT / 2, 0, -PLOT / 2),
        new THREE.Vector3(PLOT / 2, 0, PLOT / 2), new THREE.Vector3(-PLOT / 2, 0, PLOT / 2),
      ]),
      new THREE.LineBasicMaterial({ color: "#f3d35a" }));
    outline.position.set(c.x, 0.25, c.z);
    outline.visible = false;
    scene.add(outline);

    const step = look.spacing;
    const n = Math.floor((PLOT - 1) / step);
    const rand = rng(100 + idx);
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

    const div = document.createElement("div");
    div.className = "farm3d-label";
    const label = new CSS2DObject(div);
    label.position.set(c.x, 6, c.z);
    scene.add(label);

    plots[key] = { look, soil, water, outline, mesh, accent, spots, div, label };
  });

  return { scene, camera, renderer, labels, controls, plots };
}

export default function Farm3D({ plots, day, selected, onSelect }) {
  const { t, cropShort } = useI18n();
  const hostRef = useRef(null);
  const worldRef = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const keysSig = plots.map((p) => p.crop).join(",");

  // Build the scene when the set of crops changes
  useEffect(() => {
    const host = hostRef.current;
    const world = buildScene(host, keysSig.split(","));
    worldRef.current = world;
    const { scene, camera, renderer, labels, controls } = world;

    let raf = 0;
    const draw = () => {
      raf = 0;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
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
      const hit = ray.intersectObjects(Object.values(world.plots).map((p) => p.soil))[0];
      if (hit) selectRef.current(hit.object.userData.crop);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      host.innerHTML = "";
      worldRef.current = null;
    };
  }, [keysSig]);

  // Update plants, soil and labels whenever the day, results or selection change
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();

    plots.forEach((p) => {
      const w = world.plots[p.crop];
      if (!w) return;
      const { look } = w;
      const s = p.scenario.series;
      const st = stageOf(p, day);
      const growing = st >= 0 && st <= 3;
      const ccMax = Math.max(...s.cc.filter((v) => v != null), 0.01);

      w.outline.visible = selected === p.crop;
      w.water.visible = (growing && p.flooded && s.soil_water[day] >= 75) || p.scenario.waterlog[day] === 1;
      w.water.material.opacity = p.flooded ? 0.55 : 0.35;
      w.soil.material.color.copy(growing ? SOIL_DRY.clone().lerp(SOIL_WET, (s.soil_water[day] ?? 50) / 100) : FALLOW);

      w.mesh.visible = st >= 0;
      const h = st === 4 ? 0.07 : Math.max(0.05, s.height[day] ?? 0) * p.height_m * V;
      const spread = st === 4 ? 0.8 : 0.35 + 0.8 * ((s.cc[day] ?? 0) / ccMax);
      const rip = ripeness(p, day);
      const stress = growing ? 1 - (s.ks[day] ?? 1) : 0;
      if (st === 4) col.copy(STUBBLE);
      else col.set(look.green).lerp(new THREE.Color(look.ripe), rip).lerp(STRESSED, stress * 0.7);
      w.mesh.material.color.copy(col);

      w.spots.forEach((sp, i) => {
        q.setFromAxisAngle(up, sp.yaw);
        const xz = look.width * spread * sp.size;
        m.compose(pos.set(sp.x, 0.03, sp.z), q, scl.set(xz, h * sp.size, xz));
        w.mesh.setMatrixAt(i, m);
      });
      w.mesh.instanceMatrix.needsUpdate = true;

      if (w.accent) {
        const a = look.accent;
        const size = st >= 0 && st <= 3 ? accentScale(a.when, st, rip) : 0;
        w.accent.visible = size > 0.05;
        if (a.lateColor) w.accent.material.color.set(a.color).lerp(new THREE.Color(a.lateColor), st === 3 ? rip : 0);
        if (w.accent.visible) {
          let k = 0;
          w.spots.forEach((sp) => {
            const xz = look.width * spread * sp.size;
            a.points.forEach(([ang, r, y]) => {
              const th = sp.yaw + ang;
              m.compose(pos.set(sp.x + Math.cos(th) * r * xz, y * h * sp.size, sp.z + Math.sin(th) * r * xz),
                q, scl.setScalar(size * sp.size * (0.7 + 0.3 * xz)));
              w.accent.setMatrixAt(k, m);
              k += 1;
            });
          });
          w.accent.instanceMatrix.needsUpdate = true;
        }
      }

      // Short labels everywhere; the selected plot also shows its growth stage
      w.div.innerHTML = "";
      const name = document.createElement("strong");
      name.textContent = cropShort(p.crop);
      w.div.append(name);
      if (selected === p.crop) {
        const sub = document.createElement("span");
        sub.textContent = st < 0 ? t("notSown") : st === 4 ? t("harvested") : t(`stS_${STAGE_KEYS[st]}`);
        w.div.append(sub);
      }
      w.div.classList.toggle("is-selected", selected === p.crop);
      w.label.position.y = 3 + h;
    });
    world.requestDraw?.();
  }, [plots, day, selected, t, cropShort]);

  return <div ref={hostRef} className="farm3d" role="img" aria-label={t("farm3dLabel")} />;
}
