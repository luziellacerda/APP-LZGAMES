const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compiled(name) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/effects", name), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
}
const context = { exports: {} };
vm.runInNewContext(compiled("coinRainAnimation.ts"), context);
const { createCoinRainAnimation, COIN_COUNT, COIN_FRAMES, COIN_FPS } = context.exports;
const plain = value => JSON.parse(JSON.stringify(value));
function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  visit(value);
  Object.values(value).forEach(child => walk(child, visit));
}

test("one small native-vector rain uses twelve coins and three shared local designs", () => {
  const a = createCoinRainAnimation(390, 844);
  assert.equal(a.layers.length, COIN_COUNT);
  assert.equal(COIN_COUNT, 12);
  assert.equal(a.assets.length, 3);
  assert.equal(a.fr, COIN_FPS);
  assert.equal(a.fr, 24);
  assert.equal(a.op / a.fr, 18);
  const ids = new Set(a.assets.map(asset => asset.id));
  assert(a.layers.every(layer => layer.ty === 0 && ids.has(layer.refId)));
  assert(a.assets.every(asset => asset.layers.every(layer => layer.ty === 4)));
  assert(Buffer.byteLength(JSON.stringify(a)) < 80000, "Reuse templates instead of copying a detailed coin per layer");
  assert(!/https?:|data:image|expressions|\.png|\.webp/.test(JSON.stringify(a)), "Animation must stay offline and vector-only");
});

test("coins have metallic faces, milled rims, distinct engraved emblems and animated glints", () => {
  const a = createCoinRainAnimation(390, 844);
  const motifs = new Set();
  for (const asset of a.assets) {
    let metal = 0, rim = 0, emblem = 0, glint = 0;
    walk(asset, shape => {
      if (shape.nm === "Metal face") metal++;
      if (shape.nm?.startsWith("Milled rim ")) rim++;
      if (shape.nm === "Engraved game emblem") { emblem++; motifs.add(JSON.stringify(shape.it[0].ks.k.v)); }
      if (shape.nm === "Moving specular glint") { glint++; assert.equal(shape.ks.o.a, 1); }
    });
    assert.equal(metal, 1); assert.equal(rim, 8); assert.equal(emblem, 1); assert.equal(glint, 1);
  }
  assert.equal(motifs.size, 3);
});

test("all animated properties close their loops, remain finite and use ordered keyframes", () => {
  for (const [w, h] of [[320, 640], [390, 844], [844, 390], [1024, 1366]]) {
    const a = createCoinRainAnimation(w, h);
    assert.equal(a.w, w); assert.equal(a.h, h);
    walk(a, value => {
      for (const number of Object.values(value)) if (typeof number === "number") assert(Number.isFinite(number));
      if (value.a !== 1 || !Array.isArray(value.k)) return;
      const keys = value.k;
      assert.equal(keys[0].t, 0); assert.equal(keys.at(-1).t, COIN_FRAMES);
      assert.deepEqual(plain(keys[0].s), plain(keys.at(-1).s), "Loop has no frame-zero jump");
      keys.forEach((key, index) => { if (index) assert(key.t > keys[index - 1].t); });
    });
  }
});

test("falling wraps occur offscreen while hidden and spin changes perspective, not coin height", () => {
  const a = createCoinRainAnimation(390, 844);
  for (const layer of a.layers) {
    const movement = layer.ks.p.k;
    const resetFrame = movement[2].t;
    assert(movement[0].s[1] < movement[1].s[1]);
    assert(movement[1].s[1] > a.h + 40);
    assert(movement[2].s[1] < -40);
    assert(movement[2].s[1] < movement[3].s[1]);
    const hidden = layer.ks.o.k.filter(key => key.s[0] === 0);
    assert(hidden[0].t < resetFrame - 1 && hidden[1].t > resetFrame, "Teleport stays inside fully transparent interval");
    const scales = layer.ks.s.k.map(key => key.s);
    assert.equal(new Set(scales.map(scale => scale[1])).size, 1);
    assert(Math.min(...scales.map(scale => scale[0])) < Math.max(...scales.map(scale => scale[0])) / 4);
    assert(Math.max(...layer.ks.o.k.map(key => key.s[0])) <= 51, "Keep the backdrop below foreground content");
  }
});

function componentFixture() {
  const state = []; let cursor = 0, running = false;
  const react = {
    useMemo: factory => factory(),
    useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
  };
  const element = (type, props) => ({ type, props });
  const modules = {
    react: { __esModule: true, ...react, default: react },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-native": {
      View: "View", Text: "Text", StyleSheet: { absoluteFill: { position: "absolute" }, create: styles => styles },
      useWindowDimensions: () => ({ width: 390, height: 844 }),
    },
    "./Motion": { useMotionAllowed: () => running },
    "./Neon": { VectorMotion: "VectorMotion" },
    "./coinRainAnimation": { createCoinRainAnimation },
  };
  const ctx = { exports: {}, require: name => { assert(name in modules, "Unexpected dependency: " + name); return modules[name]; } };
  vm.runInNewContext(compiled("CoinRainBackground.tsx"), ctx);
  return { render: () => { cursor = 0; return ctx.exports.CoinRainBackground(); }, setRunning: value => { running = value; } };
}

test("background never intercepts taps and delegates pause/reduced motion to the existing native controller", () => {
  const f = componentFixture();
  let root = f.render();
  assert.equal(root.props.pointerEvents, "none");
  assert.equal(root.props.accessible, false);
  assert.equal(root.props.importantForAccessibility, "no-hide-descendants");
  assert.equal(root.props.children.type, "VectorMotion");
  assert.equal(root.props.children.props.running, false);
  f.setRunning(true); root = f.render(); assert.equal(root.props.children.props.running, true);
  f.setRunning(false); root = f.render(); assert.equal(root.props.children.props.running, false);
  root.props.onLayout({ nativeEvent: { layout: { width: 640, height: 320 } } });
  root = f.render(); assert.equal(root.props.children.props.source.w, 640); assert.equal(root.props.children.props.source.h, 320);
  root.props.children.props.onFailure(); root = f.render();
  assert.equal(root.props.children.type, "View", "Native failure uses a quiet static fallback without retry loops");
  assert.equal(root.props.children.props.children.length, 6);
  const source = fs.readFileSync(path.join(__dirname, "../src/effects/CoinRainBackground.tsx"), "utf8");
  assert(!/WebView|setInterval|requestAnimationFrame|fetch\(/.test(source));
});
