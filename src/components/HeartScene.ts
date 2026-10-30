import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const TAU = Math.PI * 2;

// Classic parametric heart, normalised to roughly x∈[-1,1], y∈[-0.9,0.9].
function heartPoint(t: number): [number, number] {
  const s = Math.sin(t);
  const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
  return [s * s * s, y + 0.165];
}

// The parametric form bunches points up near x=0, so sample the outline by arc length instead.
const OUTLINE = (() => {
  const n = 220;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push(heartPoint((i / n) * TAU));
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i % n];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { pts, cum, total: cum[n] };
})();

function outlineAt(u: number): [number, number] {
  const { pts, cum, total } = OUTLINE;
  const target = u * total;
  let lo = 0;
  let hi = pts.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const f = (target - cum[lo]) / (cum[lo + 1] - cum[lo]);
  const [ax, ay] = pts[lo];
  const [bx, by] = pts[(lo + 1) % pts.length];
  return [ax + (bx - ax) * f, ay + (by - ay) * f];
}

function insideHeart(x: number, y: number) {
  const { pts } = OUTLINE;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Distance to the outline and the unit direction pointing at it.
function nearestEdge(x: number, y: number) {
  const { pts } = OUTLINE;
  let best = Infinity;
  let bx = 0;
  let by = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [cx, cy] = pts[(i + 1) % pts.length];
    const dx = cx - ax;
    const dy = cy - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < best) {
      best = d;
      bx = px;
      by = py;
    }
  }
  const d = Math.sqrt(best);
  return { d, ox: (bx - x) / (d || 1), oy: (by - y) / (d || 1) };
}

// Random jagged crack from the top notch down to the tip.
function makeCrack() {
  const top = 0.475;
  const bottom = -0.9;
  const segs = 9;
  const xs: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const amp = i === 0 || i === segs ? 0 : 0.04 + Math.random() * 0.07;
    xs.push((i % 2 ? 1 : -1) * amp);
  }
  return (y: number) => {
    if (y >= top || y <= bottom) return 0;
    const t = ((top - y) / (top - bottom)) * segs;
    const i = Math.floor(t);
    const f = t - i;
    return xs[i] * (1 - f) + xs[i + 1] * f;
  };
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// Pillow-shaped heart: particles on the rim, on a rounded front/back surface, and a few inside.
// Lighting is baked per particle so it reads as a solid glossy shape when it turns.
function makeHeartGeometry(count: number) {
  const THICK = 0.36;
  const INSET = 0.45; // distance from rim where the pillow reaches full thickness
  const light = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
  const half = new THREE.Vector3(0, 0, 1).add(light).normalize();
  const n = new THREE.Vector3();
  const crackX = makeCrack();

  const pos = new Float32Array(count * 3);
  const side = new Float32Array(count);
  const edge = new Float32Array(count);
  const rnd = new Float32Array(count * 3);
  const shade = new Float32Array(count * 2);

  let i = 0;
  while (i < count) {
    const kind = Math.random();
    let x: number;
    let y: number;
    let z: number;
    let diffuse: number;
    let spec = 0;

    if (kind < 0.18) {
      [x, y] = outlineAt(Math.random());
      x += gauss() * 0.008;
      y += gauss() * 0.008;
      z = gauss() * 0.02;
      diffuse = 0.85;
    } else {
      x = (Math.random() * 2 - 1) * 1.02;
      y = (Math.random() * 2 - 1) * 0.95;
      if (!insideHeart(x, y)) continue;
      const { d, ox, oy } = nearestEdge(x, y);
      const q = Math.min(d / INSET, 1);
      const h = THICK * Math.sqrt(1 - (1 - q) * (1 - q));

      if (kind < 0.78) {
        const front = Math.random() < 0.62 ? 1 : -1;
        z = front * h + gauss() * 0.01;
        const slope = Math.min((THICK * (1 - q)) / (INSET * Math.sqrt(Math.max(1e-4, 1 - (1 - q) * (1 - q)))), 6);
        n.set(ox * slope, oy * slope, front).normalize();
        diffuse = Math.max(0, n.dot(light));
        spec = Math.pow(Math.max(0, n.dot(half)), 36);
      } else {
        z = (Math.random() * 2 - 1) * h * 0.9;
        diffuse = 0.45;
      }
    }

    pos.set([x, y, z], i * 3);
    const dc = x - crackX(y);
    side[i] = dc < 0 ? -1 : 1;
    edge[i] = Math.exp(-Math.abs(dc) * 30);
    rnd.set([Math.random(), Math.random(), Math.random()], i * 3);
    shade.set([diffuse, spec], i * 2);
    i++;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aEdge", new THREE.BufferAttribute(edge, 1));
  g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 3));
  g.setAttribute("aShade", new THREE.BufferAttribute(shade, 2));
  return g;
}

// Heart-shaped shockwave fired when she says yes.
function makeBurstGeometry(count: number) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const [hx, hy] = outlineAt(Math.random());
    const ring = i % 3;
    const speed = 1.1 + Math.random() * 1.3 + ring * 0.45;
    pos.set([hx * 0.95, hy * 0.95, (Math.random() - 0.5) * 0.2], i * 3);
    vel.set([hx * speed, (hy - 0.05) * speed, (Math.random() - 0.5) * 1.2], i * 3);
    rnd.set([ring * 0.28 + Math.random() * 0.06, Math.random(), Math.random()], i * 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aVel", new THREE.BufferAttribute(vel, 3));
  g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 3));
  return g;
}

function makeCloud(count: number, place: (i: number) => [number, number, number]) {
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set(place(i), i * 3);
    rnd.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 3));
  return g;
}

const softPointFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.8);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const heartVert = /* glsl */ `
  uniform float uTime;
  uniform float uSplit;
  uniform float uSpread;
  uniform float uWarmth;
  uniform float uFlash;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aSide;
  attribute float aEdge;
  attribute vec3 aRand;
  attribute vec2 aShade;
  varying vec3 vColor;
  varying float vAlpha;

  const float PERIOD = 1.15;

  vec3 rotZ(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
  }

  // lub-dub
  float beat(float t) {
    float m = mod(t, PERIOD);
    return exp(-pow(m * 10.0, 2.0)) + 0.6 * exp(-pow((m - 0.24) * 10.0, 2.0));
  }

  void main() {
    vec3 p = position;
    float k = mix(0.4, 1.0, uWarmth);
    p *= 1.0 + beat(uTime) * 0.05 * k;

    // a ring of light travels outward on every beat
    float phase = fract(uTime / PERIOD);
    float r = length(position.xy);
    float ripple = exp(-pow((r - phase * 1.8) * 7.0, 2.0)) * (1.0 - phase) * k;
    p.xy += normalize(position.xy + 1e-4) * ripple * 0.03;
    p += (aRand - 0.5) * 0.02 * sin(uTime * 0.9 + aRand.x * 6.2831);

    // halves tilt apart around the bottom tip
    vec3 pivot = vec3(0.0, -0.9, 0.0);
    p = rotZ(p - pivot, -aSide * uSplit * uSpread * 0.2) + pivot;
    p.x += aSide * uSplit * uSpread * 0.32;
    p.y -= uSplit * 0.06;

    // loose fragments drift off the crack while it's broken
    float drift = 0.5 + 0.5 * sin(uTime * 0.6 + aRand.x * 12.0);
    p += aEdge * uSplit * drift * vec3(aSide * aRand.x * 0.35, -aRand.y * 0.5, (aRand.z - 0.5) * 0.5);

    float glitter = step(0.9, aRand.z) * pow(0.5 + 0.5 * sin(uTime * 2.5 + aRand.x * 40.0), 10.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.55 + aRand.z * 0.8) * (1.0 + glitter) * uPixelRatio / -mv.z;

    float tone = aShade.x * 0.8 + aRand.y * 0.2;
    vec3 cold = mix(vec3(0.2, 0.3, 0.95), vec3(0.72, 0.8, 1.0), tone);
    vec3 warm = mix(vec3(0.85, 0.07, 0.27), vec3(1.0, 0.58, 0.7), tone);
    vColor = mix(cold, warm, uWarmth) * (0.35 + 0.85 * aShade.x);
    vColor += aShade.y * vec3(1.0, 0.92, 0.96) * 1.4;
    vColor += ripple * vec3(1.0, 0.6, 0.75) * 0.8;
    vColor += aEdge * uSplit * vec3(0.2, 0.3, 0.6);
    vColor += uFlash * vec3(1.0, 0.85, 0.9);
    vAlpha = (0.09 + 0.22 * aRand.x) * (1.0 + 0.6 * aEdge * uSplit) * (1.0 + 4.0 * glitter) * (1.0 + 0.35 * uWarmth);
  }
`;

const burstVert = /* glsl */ `
  uniform float uBurst;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aVel;
  attribute vec3 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float t = uBurst - aRand.x;
    float live = step(0.0, t) * step(t, 3.0);
    float e = 1.0 - exp(-t * 1.6);
    vec3 p = position + aVel * e * 1.6 + vec3(0.0, -0.12 * t * t, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = live * uSize * (0.8 + aRand.z * 1.6) * (1.0 - t / 5.0) * uPixelRatio / -mv.z;
    vColor = mix(vec3(1.0, 0.35, 0.55), vec3(1.0, 0.85, 0.6), aRand.y * aRand.y);
    vAlpha = live * pow(clamp(1.0 - t / 3.0, 0.0, 1.0), 1.5);
  }
`;

// Faint sparkle ring that orbits the heart once it's whole.
const orbitVert = /* glsl */ `
  uniform float uTime;
  uniform float uWarmth;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float a = aRand.x * 6.2831 + uTime * (0.12 + aRand.y * 0.18);
    float R = 1.3 + aRand.z * 0.45;
    vec3 p = vec3(cos(a) * R, (aRand.y - 0.5) * 0.1, sin(a) * R);
    float c = cos(0.38), s = sin(0.38);
    p = vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.35 + aRand.z * 0.7) * uPixelRatio / -mv.z;
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aRand.x * 30.0);
    vColor = mix(vec3(1.0, 0.6, 0.75), vec3(1.0, 0.9, 0.8), aRand.y);
    vAlpha = uWarmth * uWarmth * (0.12 + 0.4 * twinkle) * (0.55 + 0.45 * sin(a));
  }
`;

const starsVert = /* glsl */ `
  uniform float uTime;
  uniform float uWarmth;
  uniform float uPixelRatio;
  attribute vec3 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 + aRand.x * 2.4) * 26.0 * uPixelRatio / -mv.z;
    vAlpha = 0.2 + 0.8 * (0.5 + 0.5 * sin(uTime * (0.5 + aRand.y * 1.8) + aRand.z * 6.2831));
    vColor = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.8, 0.88), uWarmth * aRand.y);
  }
`;

const embersVert = /* glsl */ `
  uniform float uTime;
  uniform float uWarmth;
  uniform float uPixelRatio;
  attribute vec3 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.y = mod(position.y + uTime * (0.12 + aRand.x * 0.3) + 5.0, 10.0) - 5.0;
    p.x += sin(uTime * 0.5 + aRand.y * 6.2831) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (14.0 + aRand.z * 26.0) * uPixelRatio / -mv.z;
    vAlpha = smoothstep(-5.0, -3.0, p.y) * smoothstep(5.0, 3.0, p.y) * (0.2 + 0.45 * aRand.y);
    vColor = mix(vec3(0.5, 0.6, 1.0), vec3(1.0, 0.45, 0.6), uWarmth);
  }
`;

const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFrag = /* glsl */ `
  uniform float uWarmth;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) * (0.14 + 0.08 * uWarmth);
    vec3 c = mix(vec3(0.25, 0.35, 0.95), vec3(1.0, 0.25, 0.45), uWarmth);
    gl_FragColor = vec4(c, a);
  }
`;

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

export class HeartScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private group = new THREE.Group();
  private stars: THREE.Points;
  private disposables: { dispose(): void }[] = [];

  private time = 0;
  private last = performance.now();
  private raf = 0;
  private split = 1;
  private warmth = 0;
  private target = { split: 1, warmth: 0 };
  private mendRate = 1.4;
  private burstStart = -100;
  private flash = 0;
  private pointer = new THREE.Vector2();
  private look = new THREE.Vector2();

  private shared = {
    uTime: { value: 0 },
    uWarmth: { value: 0 },
    uPixelRatio: { value: 1 },
  };
  private heartU = { uSplit: { value: 1 }, uSpread: { value: 1 }, uFlash: { value: 0 }, uSize: { value: 30 } };
  private burstU = { uBurst: { value: -100 }, uSize: { value: 40 } };

  constructor(canvas: HTMLCanvasElement) {
    const mobile = window.matchMedia("(pointer: coarse)").matches;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.75 : 2));
    this.renderer.setClearColor(0x05040a, 1);
    // shader colours are authored as display colours — don't re-encode them
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.camera.position.set(0, 0, 6);
    this.scene.add(this.group);

    // soft halo behind the heart
    const glowGeo = new THREE.PlaneGeometry(7, 7);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      uniforms: { uWarmth: this.shared.uWarmth },
      ...additive,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = -1.5;
    this.group.add(glow);

    const heartGeo = makeHeartGeometry(mobile ? 10000 : 16000);
    const heartMat = new THREE.ShaderMaterial({
      vertexShader: heartVert,
      fragmentShader: softPointFrag,
      uniforms: { ...this.shared, ...this.heartU },
      ...additive,
    });
    this.group.add(new THREE.Points(heartGeo, heartMat));

    const orbitGeo = makeCloud(mobile ? 300 : 500, () => [0, 0, 0]);
    const orbitMat = new THREE.ShaderMaterial({
      vertexShader: orbitVert,
      fragmentShader: softPointFrag,
      uniforms: { ...this.shared, uSize: this.heartU.uSize },
      ...additive,
    });
    const orbit = new THREE.Points(orbitGeo, orbitMat);
    orbit.frustumCulled = false;
    this.group.add(orbit);

    const burstGeo = makeBurstGeometry(mobile ? 1800 : 2800);
    const burstMat = new THREE.ShaderMaterial({
      vertexShader: burstVert,
      fragmentShader: softPointFrag,
      uniforms: { ...this.shared, ...this.burstU },
      ...additive,
    });
    const burst = new THREE.Points(burstGeo, burstMat);
    burst.frustumCulled = false;
    this.group.add(burst);

    const starsGeo = makeCloud(1400, () => {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(20 + Math.random() * 25);
      return [v.x, v.y, v.z];
    });
    const starsMat = new THREE.ShaderMaterial({
      vertexShader: starsVert,
      fragmentShader: softPointFrag,
      uniforms: this.shared,
      ...additive,
    });
    this.stars = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.stars);

    const embersGeo = makeCloud(mobile ? 160 : 280, () => [
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 10,
      -4 + Math.random() * 6,
    ]);
    const embersMat = new THREE.ShaderMaterial({
      vertexShader: embersVert,
      fragmentShader: softPointFrag,
      uniforms: this.shared,
      ...additive,
    });
    const embers = new THREE.Points(embersGeo, embersMat);
    embers.frustumCulled = false;
    this.scene.add(embers);

    this.disposables.push(
      glowGeo, glowMat, heartGeo, heartMat, orbitGeo, orbitMat,
      burstGeo, burstMat, starsGeo, starsMat, embersGeo, embersMat,
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 0.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("pointermove", this.onPointer);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Ease the heart toward a broken (split=1) / whole (split=0) and cold/warm state. */
  setTarget(split: number, warmth: number) {
    this.target = { split, warmth };
    this.mendRate = 1.4;
  }

  /** She said yes. */
  celebrate() {
    this.target = { split: 0, warmth: 1 };
    this.mendRate = 3.2;
    this.flash = 0.9;
    this.burstStart = this.time + 0.35;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("pointermove", this.onPointer);
    this.disposables.forEach((d) => d.dispose());
    this.composer.dispose();
    this.renderer.dispose();
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };

  private resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Fit the heart (incl. its broken, spread-apart state) into the upper part of the screen,
    // leaving the bottom for the text.
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const vw = vh * this.camera.aspect;
    const portrait = this.camera.aspect < 1;
    // On phones the halves can't drift as far apart without leaving the screen.
    const spread = portrait ? 0.55 : 1;
    const brokenWidth = 2 + 1.3 * spread;
    const s = Math.min((0.38 * vh) / 1.8, (0.84 * vw) / brokenWidth);
    this.group.scale.setScalar(s);
    this.group.position.y = vh * (0.5 - 0.32);
    this.heartU.uSpread.value = spread;

    this.shared.uPixelRatio.value = this.renderer.getPixelRatio();
    this.heartU.uSize.value = 26 * s;
    this.burstU.uSize.value = 40 * s;
  };

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.time += dt;

    const k = 1 - Math.exp(-dt * this.mendRate);
    this.split += (this.target.split - this.split) * k;
    this.warmth += (this.target.warmth - this.warmth) * k;
    this.flash *= Math.exp(-dt * 2.2);

    this.shared.uTime.value = this.time;
    this.shared.uWarmth.value = this.warmth;
    this.heartU.uSplit.value = this.split;
    this.heartU.uFlash.value = this.flash;
    this.burstU.uBurst.value = this.time - this.burstStart;

    this.look.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    this.group.rotation.y = Math.sin(this.time * 0.35) * 0.28 + this.look.x * 0.5;
    this.group.rotation.x = -this.look.y * 0.22;
    this.stars.rotation.y += dt * 0.012;

    this.bloom.strength = 0.45 + this.warmth * 0.25 + this.flash * 0.6;
    this.composer.render();
  };
}
