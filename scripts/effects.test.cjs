const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(name) {
  const filename = path.join(__dirname, "../src/effects", `${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    { exports, require: (name) => load(name.replace("./", "")) },
    { filename },
  );
  return exports;
}
const { iconAnimations, cruiserAnimation, laserAnimation } = load("animations");
const { spaceflightHtml } = load("spaceflightScene");
const { electricMenuHtml } = load("electricMenuScene");
const { trophyRainHtml } = load("trophyRainScene");
const { flightModelSource } = load("flightLayout");
const { cometOpacity, cometPerimeter } = load("cometAnimation");
const flightModel = {};
vm.runInNewContext(flightModelSource, flightModel);
const { flightLayout, createFlightSimulation } = flightModel;
function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  visit(value);
  Object.values(value).forEach((child) => walk(child, visit));
}

test("six local animated menu icons and the spacecraft have no external assets", () => {
  assert.equal(Object.keys(iconAnimations).length, 6);
  for (const item of [...Object.values(iconAnimations), cruiserAnimation]) {
    assert.equal(item.assets.length, 0);
    assert.equal(item.fr, 30);
    assert(item.op > item.ip && item.w > 0 && item.h > 0);
    assert(item.layers.every((layer) => layer.ty === 4));
    let animated = false;
    walk(item, (value) => {
      if (value.a === 1) animated = true;
      Object.values(value).forEach((n) => {
        if (typeof n === "number") assert(Number.isFinite(n));
      });
    });
    assert(animated, `${item.nm} must move`);
  }
  assert(
    JSON.stringify(iconAnimations).length < 120_000,
    "Keep the icon library small",
  );
});

test("laser completes one linear perimeter revolution at card and button sizes", () => {
  for (const [w, h, radius] of [
    [340, 112, 17],
    [54, 64, 12],
    [390, 1200, 20],
  ]) {
    const a = laserAnimation(w, h, radius, "#53f6a7");
    assert.equal(a.w, w);
    assert.equal(a.h, h);
    assert.equal(a.op / a.fr, 6);
    let trims = 0;
    walk(a, (shape) => {
      if (shape.ty !== "tm") return;
      trims++;
      assert.equal(shape.o.k[1].s[0] - shape.o.k[0].s[0], 360);
      assert.equal(shape.o.k[0].o.x, 0);
      assert.equal(shape.o.k[0].i.x, 1);
    });
    assert.equal(
      trims,
      4,
      "Only the shared continuous core/bloom paths, no repeated segments",
    );
  }
});

test("electric filaments stay at the rim, with valid named dash properties", () => {
  const w = 54,
    h = 64,
    a = laserAnimation(w, h, 12, "#72f5cf", true);
  let filaments = 0;
  walk(a, (shape) => {
    if (shape.ty === "st" && shape.d) {
      assert.equal(new Set(shape.d.map((d) => d.nm)).size, shape.d.length);
      assert(shape.d.every((d) => d.nm));
      assert(shape.d.some((d) => d.n === "o"));
    }
    if (shape.ty !== "sh") return;
    filaments++;
    for (const [x, y] of shape.ks.k.v) {
      assert(x >= 2 && x <= w - 2 && y >= 2 && y <= h - 2);
      assert(
        Math.min(x, w - x, y, h - y) < 9,
        "Electricity must not cover the label",
      );
    }
  });
  assert.equal(filaments, 1);
});

function scene(html = spaceflightHtml) {
  let id = 0,
    draws = 0,
    frames = 0;
  const created = [];
  const queue = new Map(),
    events = {},
    messages = [];
  const ctx = new Proxy(
    {
      drawImage: (source) => {
        draws++;
        if (source === created[0]) frames++;
      },
      clearRect: () => draws++,
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    { get: (target, prop) => (prop in target ? target[prop] : () => {}) },
  );
  const canvas = { getContext: () => ctx };
  const window = {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    ReactNativeWebView: { postMessage: (value) => messages.push(value) },
    addEventListener: (name, callback) => {
      events[name] = callback;
    },
  };
  const document = {
    hidden: false,
    getElementById: () => canvas,
    createElement: () => {
      const element = { getContext: () => ctx };
      created.push(element);
      return element;
    },
    addEventListener: (name, callback) => {
      events[name] = callback;
    },
  };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    window,
    document,
    requestAnimationFrame: (callback) => {
      queue.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (key) => queue.delete(key),
  });
  return {
    window,
    document,
    canvas,
    queue,
    events,
    messages,
    draws: () => draws,
    frames: () => frames,
    surfaces: () => created.length,
    step(now) {
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb(now));
    },
  };
}

test("spacefield is static by default and never starts duplicate animation loops", () => {
  const s = scene();
  assert.equal(s.queue.size, 0);
  assert.equal(s.canvas.width, 585, "Pixel ratio is capped at 1.5");
  s.window.setMotionEnabled(true);
  s.window.setMotionEnabled(true);
  assert.equal(s.queue.size, 1);
  const before = s.frames();
  for (let t = 1; t < 1100; t += 16.67) s.step(t);
  assert(s.frames() - before <= 33, "Canvas drawing stays near 30 fps");
  assert(s.frames() > before);
  assert.equal(
    s.surfaces(),
    4,
    "Only background and three cached vapor sprites",
  );
  s.window.setMotionEnabled(false);
  const paused = s.draws();
  s.step(1200);
  assert.equal(s.queue.size, 0);
  assert.equal(s.draws(), paused);
});

test("spacefield pauses when hidden, resumes once and redraws correctly on rotation", () => {
  const s = scene();
  s.window.setMotionEnabled(true);
  s.document.hidden = true;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 0);
  s.document.hidden = false;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 1);
  s.window.innerWidth = 844;
  s.window.innerHeight = 390;
  s.events.resize();
  assert.equal(s.canvas.width, 1266);
  assert.equal(s.canvas.height, 585);
  s.events.pagehide();
  assert.equal(s.queue.size, 0);
});

test("legacy trophy renderer remains available while only raffle switches to coin Lottie", () => {
  assert(!trophyRainHtml.includes("fillText"));
  assert(!trophyRainHtml.includes("http"));
  assert(trophyRainHtml.includes("trophySprite('#efb93b')"));
  assert(trophyRainHtml.includes("trophySprite('#fff1bd')"));
  assert(trophyRainHtml.includes("shadowColor='#ffc44d'"));
  assert(!trophyRainHtml.includes("#00ffb3"));
  assert(!trophyRainHtml.includes("#baffea"));
  assert(trophyRainHtml.includes("frameInterval=66"));
  const app = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
  assert(
    app.includes(
      'tab === "sorteios" ? <CoinRainBackground /> : <MatrixBackground />',
    ),
  );
  const matrix = fs.readFileSync(
    path.join(__dirname, "../src/MatrixRain.tsx"),
    "utf8",
  );
  assert(matrix.includes("ctx.fillText(ch,x,y)"));
  assert(matrix.includes("ｱｲｳｴｵ"));
});

test("trophy rain uses two cached sprites, one slow loop, and pauses/resizes safely", () => {
  const s = scene(trophyRainHtml);
  assert.equal(s.surfaces(), 2);
  assert.equal(s.canvas.width, 585);
  assert.equal(s.queue.size, 0);
  s.window.setMotionEnabled(true);
  s.window.setMotionEnabled(true);
  assert.equal(s.queue.size, 1);
  const before = s.draws();
  for (let t = 1; t < 1000; t += 16.67) s.step(t);
  assert(s.draws() > before);
  assert(s.draws() - before <= Math.ceil(390 / 24) * 2 * 15);
  assert.equal(s.surfaces(), 2, "Sprites are not regenerated while falling");
  s.window.setMotionEnabled(false);
  const paused = s.draws();
  s.step(1100);
  assert.equal(s.draws(), paused);
  assert.equal(s.queue.size, 0);
  s.window.setMotionEnabled(true);
  s.document.hidden = true;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 0);
  s.document.hidden = false;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 1);
  s.window.innerWidth = 844;
  s.window.innerHeight = 390;
  s.events.resize();
  assert.equal(s.canvas.width, 1266);
  assert.equal(s.canvas.height, 585);
  s.events.pagehide();
  assert.equal(s.queue.size, 0);
});

test("random flight keeps the approved camera, small ship scale and cruise speed", () => {
  for (const [w, h] of [
    [320, 640],
    [390, 844],
    [844, 390],
  ]) {
    const camera = flightLayout(w, h),
      sim = createFlightSimulation(() => 0.5);
    const first = sim.update(0);
    for (let i = 0; i < 300; i++) sim.update(1 / 30);
    const later = sim.update(0);
    assert.equal(camera.cx, w * 0.5);
    assert.equal(camera.cy, h * 0.31);
    assert(later.z > first.z);
    assert(
      Math.abs(later.x - first.x) > 30,
      "Lateral flight must be clearly visible",
    );
    const shipWidth = (camera.focal * 156) / (first.z - 56);
    assert(
      shipWidth < w * 0.3 && shipWidth > 0,
      "Ship must not occupy half the screen",
    );
    assert.equal(camera.cruiseSpeed, 95);
  }
  assert(
    !fs
      .readFileSync(path.join(__dirname, "../App.tsx"), "utf8")
      .includes("SpaceflightHero"),
  );
});

test("exhaust has world-space velocity, expanding particles, bounded lifetime and pool", () => {
  const sim = createFlightSimulation();
  let largest = 0;
  for (let i = 0; i < 3600; i++) {
    const s = sim.update(1 / 30);
    largest = Math.max(largest, s.particles.length);
    assert(s.alpha >= 0 && s.alpha <= 1);
    assert(Math.abs(s.bank) <= 0.2);
    assert(s.particles.length <= sim.maxParticles);
    for (const p of s.particles) {
      assert(p.vz < 0);
      assert(p.age < p.life);
      assert(p.z < s.z);
    }
  }
  assert(largest > 30 && largest <= 64);
  const s = sim.update(0),
    // Check a surviving particle, not the oldest one which may expire this step.
    p = s.particles.find(
      (particle) => particle.life - particle.age > 0.04 && particle.z > 110,
    ),
    before = { ...p };
  assert(p);
  sim.update(0.02);
  assert(p.z < before.z);
  assert(p.age > before.age);
  const count = s.particles.length,
    at = sim.update(0).time;
  assert.equal(sim.update(0).time, at);
  assert.equal(s.particles.length, count);
});

test("flight motion is time-based and does not serialize functions from Hermes bytecode", () => {
  const a = createFlightSimulation(() => 0.5),
    b = createFlightSimulation(() => 0.5);
  for (let i = 0; i < 300; i++) a.update(1 / 30);
  for (let i = 0; i < 600; i++) b.update(1 / 60);
  for (const axis of ["x", "y", "z"])
    assert(Math.abs(a.update(0)[axis] - b.update(0)[axis]) < 1);
  assert(!spaceflightHtml.includes(".toString()"));
  assert(
    spaceflightHtml.includes("drawTurbine(ship,side)"),
    "Rear turbine nozzles are drawn",
  );
});

function engineModel() {
  return scene(
    spaceflightHtml.replace(
      "var simulation=createFlightSimulation();",
      "window.engineModel={enginePulse,engineFlameSample,vaporEnvelope};var simulation=createFlightSimulation();",
    ),
  ).window.engineModel;
}

test("flame deforms and advects at a fixed ship position, without pressure strobing", () => {
  const { enginePulse, engineFlameSample } = engineModel();
  for (const side of [-30, 30]) {
    let previous = enginePulse(0, side),
      min = 1,
      max = 0;
    const samples = [];
    for (let i = 0; i <= 300; i++) {
      const time = i / 30,
        power = enginePulse(time, side);
      min = Math.min(min, power);
      max = Math.max(max, power);
      assert(power >= 0.735 && power <= 0.985);
      assert(
        Math.abs(power - previous) < 0.041,
        "Light changes smoothly at 30 fps",
      );
      previous = power;
      for (const u of [0, 0.3, 0.65, 1]) {
        const s = engineFlameSample(time, side, u);
        assert.equal(s.power, power);
        assert(s.point.every(Number.isFinite) && s.radius >= 0 && s.radius < 8);
        if (u === 0)
          assert.equal(JSON.stringify(s.point), JSON.stringify([side, 3, -54]));
        if (u === 1) assert.equal(s.radius, 0);
      }
      samples.push(engineFlameSample(time, side, 0.65).point[0]);
    }
    assert(max - min > 0.2);
    assert(
      Math.max(...samples) - Math.min(...samples) > 4,
      "Jet silhouette must actually bend",
    );
    assert.equal(
      JSON.stringify(engineFlameSample(2, side, 0.6)),
      JSON.stringify(engineFlameSample(2, side, 0.6)),
      "Paused time has no random flicker",
    );
  }
});

test("vapor grows and cools with a soft birth/death, bounded cached volume textures", () => {
  const { vaporEnvelope } = engineModel();
  const samples = [0, 0.2, 0.6, 1].map((age) =>
    vaporEnvelope({ age, life: 1, size: 4 }),
  );
  assert.equal(samples[0].opacity, 0);
  assert.equal(samples.at(-1).opacity, 0);
  assert(samples[1].opacity > samples[2].opacity && samples[2].opacity > 0);
  for (let i = 1; i < samples.length; i++) {
    assert(samples[i].radius > samples[i - 1].radius);
    assert(samples[i].heat < samples[i - 1].heat);
  }
  const sim = createFlightSimulation(() => 0.5);
  for (let i = 0; i < 60; i++) sim.update(1 / 30);
  for (const p of sim.update(0).particles) {
    assert([-30, 30].includes(p.side));
    assert(Number.isInteger(p.texture) && p.texture >= 0 && p.texture < 3);
    assert(Number.isFinite(p.spin));
  }
  assert(spaceflightHtml.includes("texture.width=texture.height=96"));
  assert(!spaceflightHtml.includes("ctx.filter"));
});

test("LED uses a continuous transparent-to-hot gradient, not round-ended repeated segments", () => {
  assert.equal(cometOpacity[1], 0);
  assert.equal(cometOpacity.at(-1), 1);
  for (let i = 2; i < cometOpacity.length; i += 2) {
    assert(cometOpacity[i] > cometOpacity[i - 2]);
    assert(cometOpacity[i + 1] > cometOpacity[i - 1]);
  }
  let wide = false,
    bevel = false,
    white = false,
    singleHead = 0;
  walk(laserAnimation(340, 112, 17, "#53f6a7"), (s) => {
    if (s.ty === "gs") bevel = true;
    if (s.ty === "gs" && s.w.k >= 20) wide = true;
    if (s.ty === "fl" && s.c.k.slice(0, 3).every((c) => c > 0.9)) white = true;
    if (s.nm === "Single light source") singleHead++;
    if (s.ty === "gs" && s.s.a === 1) {
      assert.equal(s.lc, 1);
      assert.equal(s.g.k.k.length, s.g.p * 4 + cometOpacity.length);
    }
  });
  assert(wide && bevel && white);
  assert.equal(singleHead, 1);
  assert(
    electricMenuHtml.includes("globalCompositeOperation='destination-out'"),
  );
  assert(electricMenuHtml.includes("Math.exp(-dt*3.2)"));
});

test("flight changes targets without jumps and leaves inertial exhaust behind", () => {
  let seed = 8123;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const sim = createFlightSimulation(random);
  let previous = sim.update(0),
    left = 0,
    right = 0,
    turns = 0,
    sign = 0;
  for (let i = 0; i < 1800; i++) {
    const s = sim.update(1 / 30);
    left = Math.min(left, s.x);
    right = Math.max(right, s.x);
    assert(Math.abs(s.x - previous.x) < 3);
    assert(Math.abs(s.y - previous.y) < 3);
    assert(Math.abs(s.z - previous.z) < 2);
    assert(
      s.x >= -160 &&
        s.x <= 160 &&
        s.y >= 60 &&
        s.y <= 260 &&
        s.z >= 490 &&
        s.z <= 650,
    );
    const next = Math.sign(s.vx);
    if (next && sign && next !== sign) turns++;
    if (next) sign = next;
    previous = s;
  }
  assert(left < -60 && right > 60);
  assert(turns >= 6);
  const paused = sim.update(0);
  sim.update(0);
  assert.equal(sim.update(0).time, paused.time);
});

test("continuous gradient and head follow the same rounded perimeter including wraparound", () => {
  for (const [w, h, r] of [
    [340, 112, 17],
    [54, 64, 12],
    [390, 1200, 20],
  ]) {
    const p = cometPerimeter(w, h, r);
    assert(p.tail > 0 && p.tail <= 0.2);
    assert(Math.hypot(...p.point(0).map((v, i) => v - p.point(1)[i])) < 0.001);
    for (let i = 0; i < 360; i++) {
      const q = p.point(i / 360);
      assert(
        q[0] >= 2.49 && q[0] <= w - 2.49 && q[1] >= 2.49 && q[1] <= h - 2.49,
      );
      assert(Math.min(q[0], w - q[0], q[1], h - q[1]) < r + 3);
    }
  }
});

test("ship hull uses local optical gradients for volume", () => {
  let gradients = 0;
  walk(cruiserAnimation, (shape) => {
    if (shape.ty !== "gf") return;
    gradients++;
    assert.equal(shape.g.k.k.length, shape.g.p * 4);
    assert(shape.g.p >= 3);
  });
  assert(gradients >= 6);
});

test("electric menu handles partial layouts, selection and reduction of motion without duplicate loops", () => {
  const s = scene(electricMenuHtml);
  assert(s.messages.includes("electric-ready"));
  assert.equal(s.queue.size, 0);
  const bounds = Array.from({ length: 6 }, (_, i) => ({
    x: i * 65 + 2,
    y: 5,
    width: 61,
    height: 65,
  }));
  s.window.configureElectricMenu({
    bounds: [null, bounds[1]],
    selected: 1,
    motion: false,
  });
  for (let selected = 0; selected < 6; selected++) {
    s.window.configureElectricMenu({ bounds, selected, motion: true });
    assert.equal(s.queue.size, 1);
    s.step(1);
    s.step(35);
  }
  s.window.configureElectricMenu({ bounds, selected: 2, motion: false });
  const before = s.draws();
  s.step(100);
  assert.equal(s.draws(), before);
  assert.equal(s.queue.size, 0);
  assert(!s.messages.includes("electric-error"));
});

test("electric renderer pauses on app visibility and restores the native fallback on a renderer error", () => {
  const s = scene(electricMenuHtml);
  s.window.configureElectricMenu({ bounds: [], selected: 0, motion: true });
  s.document.hidden = true;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 0);
  s.document.hidden = false;
  s.events.visibilitychange();
  assert.equal(s.queue.size, 1);
  s.events.error();
  assert.equal(s.queue.size, 0);
  assert(s.messages.includes("electric-error"));
});
