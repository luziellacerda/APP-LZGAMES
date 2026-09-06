const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = require.resolve('../src/effects/TrophyLottie.tsx');
const assetFilename = require.resolve('../src/effects/assets/trophy-spin.json');
const assetBytes = fs.readFileSync(assetFilename);
const original = JSON.parse(assetBytes);
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  },
}).outputText;

function walk(value, visit) {
  visit(value);
  if (value && typeof value === 'object') Object.values(value).forEach(child => walk(child, visit));
}
function flatten(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
function player(tree) {
  const matches = nodes(tree).filter(node => node.type === 'LottieView');
  assert.equal(matches.length, 1);
  return matches[0];
}

// This fixture exercises the real component's JSX and effects after attaching a
// synthetic native ref. It does not render pixels or measure native performance,
// hit testing, accessibility announcements, or motion on a physical device.
function fixture(initial = {}) {
  const gates = { visible: true, allowed: true, ...initial };
  const calls = [], hooks = [], pendingEffects = [];
  const surface = Symbol('SurfaceMotion');
  const nativePlayer = Object.fromEntries(['resume', 'pause', 'play'].map(method => [method, () => calls.push(method)]));
  let cursor = 0;
  const react = {
    memo: component => component,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext(context) { assert.equal(context, surface); return gates.visible; },
    useRef(value) { return hooks[cursor++] ??= { current: value }; },
    useState(initialValue) {
      const index = cursor++;
      hooks[index] ??= { value: initialValue };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++, old = hooks[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pendingEffects.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const modules = {
    react,
    'react-native': { View: 'View', StyleSheet: { create: styles => styles } },
    'lottie-react-native': { __esModule: true, default: 'LottieView' },
    './Neon': { AnimatedIcon: 'AnimatedIcon' },
    './Motion': { SurfaceMotion: surface, useMotionAllowed: () => gates.allowed },
  };
  const context = {
    exports: {},
    require(name) {
      if (/^\.\/assets\/[a-z0-9-]+\.json$/.test(name)) {
        // Local asset/attribution JSON only; no runtime native or network imports.
        return JSON.parse(fs.readFileSync(path.resolve(path.dirname(filename), name), 'utf8'));
      }
      assert.ok(name in modules, 'Unexpected dependency: ' + name);
      return modules[name];
    },
    fetch: () => assert.fail('Unexpected network request'),
    setInterval: () => assert.fail('Unexpected background timer'),
    setTimeout: () => assert.fail('Unexpected background timer'),
  };
  vm.runInNewContext(compiled, context, { filename });
  return {
    calls,
    render(next = {}) {
      Object.assign(gates, next);
      cursor = 0;
      const tree = context.exports.TrophyLottie({ size: gates.size });
      const lottie = nodes(tree).find(node => node.type === 'LottieView');
      for (const hook of hooks) if (hook && 'current' in hook) hook.current = null;
      if (lottie?.props.ref) lottie.props.ref.current = nativePlayer;
      pendingEffects.splice(0).forEach(effect => effect());
      return tree;
    },
  };
}

test('bundled trophy stays below 150 KB and uses only vector layers and internal precompositions', () => {
  assert.ok(assetBytes.length <= 150_000);
  assert.equal(original.w, 500);
  assert.equal(original.h, 500);
  assert.equal(original.fr, 30);
  assert.equal(original.ip, 0, 'The original playback range is preserved on disk');
  assert.equal(original.op, 71);
  assert.equal(original.fonts, undefined);
  assert.equal(original.chars, undefined);
  const assets = new Map(original.assets.map(asset => [asset.id, asset]));
  assert.equal(assets.size, original.assets.length, 'Internal asset IDs are unique');
  for (const asset of assets.values()) {
    assert.ok(Array.isArray(asset.layers), 'Every asset must be a local precomposition');
    for (const key of ['p', 'u', 'e']) assert.equal(asset[key], undefined, 'No image or external asset reference');
  }
  function validateLayers(layers, ancestors = []) {
    for (const layer of layers) {
      assert.ok([0, 4].includes(layer.ty), 'Only precomposition and shape layers are allowed');
      if (layer.ty === 0) {
        assert.ok(assets.has(layer.refId), 'Every precomposition resolves locally');
        assert.ok(!ancestors.includes(layer.refId), 'No circular precomposition references');
        validateLayers(assets.get(layer.refId).layers, [...ancestors, layer.refId]);
      } else {
        assert.ok(Array.isArray(layer.shapes));
      }
    }
  }
  validateLayers(original.layers);
  for (const asset of assets.values()) validateLayers(asset.layers, [asset.id]);
  walk(original, value => {
    if (typeof value === 'string') assert.ok(!/(?:https?:|data:|file:|ftp:|\/\/)/i.test(value), 'No embedded URL or data payload');
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    if (!value || typeof value !== 'object') return;
    assert.notEqual(typeof value.x, 'string', 'No executable Lottie expression');
    assert.equal(value.expression, undefined);
    assert.equal(value.expr, undefined);
  });
});

test('the selected frames retain changing vector paths rather than only transform or sparkle animation', () => {
  const changingPaths = [];
  for (const layer of original.layers) {
    if (layer.ty !== 4 || layer.ip >= 51 || layer.op <= 24) continue;
    walk(layer.shapes, shape => {
      if (shape?.ty !== 'sh' || shape.ks?.a !== 1) return;
      const keys = shape.ks.k;
      const activeChanges = keys.slice(0, -1).filter((key, index) => {
        const next = keys[index + 1];
        const start = Math.max(24, layer.ip, key.t);
        const end = Math.min(51, layer.op, next.t);
        return end > start && key.s?.[0]?.v && next.s?.[0]?.v &&
          JSON.stringify(key.s[0].v) !== JSON.stringify(next.s[0].v);
      });
      if (activeChanges.length) changingPaths.push({ layer: layer.nm, changes: activeChanges.length });
    });
  }
  assert.ok(changingPaths.length >= 2, 'At least two visible shape paths must morph in the repeated segment');
  assert.ok(changingPaths.some(item => item.changes >= 10), 'The segment retains a sequence of distinct drawn poses');
  // Shape keyframes establish changing outlines, not a claim about native pixels
  // or physically simulated 3D rotation.
});

test('playback adapts the range in memory and centers the cropped canvas within both UI slot sizes', () => {
  for (const size of [86, 88]) {
    const f = fixture({ size }), tree = f.render(), lottie = player(tree);
    const slot = flatten(tree.props.style), canvas = flatten(lottie.props.style);
    assert.equal(slot.width, size);
    assert.equal(slot.height, size);
    assert.equal(slot.overflow, 'hidden');
    assert.equal(canvas.width, size * 1.5);
    assert.equal(canvas.height, size * 1.5);
    assert.equal(canvas.position, 'absolute');
    assert.equal(canvas.left, (size - canvas.width) / 2);
    assert.equal(canvas.top, (size - canvas.height) / 2);
    assert.equal(lottie.props.source.ip, 24);
    assert.equal(lottie.props.source.op, 51);
    assert.deepEqual(lottie.props.source.layers, original.layers);
    assert.deepEqual(lottie.props.source.assets, original.assets);
    assert.equal(lottie.props.speed, 0.45);
    assert.equal(lottie.props.loop, true);
    assert.equal(lottie.props.useNativeLooping, true);
    assert.equal(lottie.props.resizeMode, 'contain');
    assert.equal(tree.props.pointerEvents, 'none');
    assert.equal(tree.props.accessible, false);
    assert.equal(tree.props.accessibilityElementsHidden, true);
    assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
  }
  assert.equal(flatten(fixture().render().props.style).width, 86);
  assert.deepEqual(fs.readFileSync(assetFilename), assetBytes);
});

test('a visible allowed trophy resumes, plays on load, and pauses when either motion gate closes', () => {
  const f = fixture();
  let tree = f.render();
  assert.equal(player(tree).props.autoPlay, true);
  assert.equal(player(tree).props.progress, undefined);
  assert.deepEqual(f.calls, ['resume']);
  player(tree).props.onAnimationLoaded();
  assert.deepEqual(f.calls, ['resume', 'play']);
  f.render();
  assert.equal(f.calls.length, 2, 'Unchanged dependencies do not replay the effect');
  tree = f.render({ visible: false });
  assert.equal(player(tree).props.autoPlay, false);
  assert.equal(player(tree).props.progress, 0);
  assert.equal(f.calls.at(-1), 'pause');
  tree = f.render({ visible: true });
  assert.equal(player(tree).props.autoPlay, true);
  assert.equal(player(tree).props.progress, undefined);
  assert.equal(f.calls.at(-1), 'resume');
  tree = f.render({ allowed: false });
  assert.equal(player(tree).props.autoPlay, false);
  assert.equal(player(tree).props.progress, 0);
  assert.equal(f.calls.at(-1), 'pause');
  player(tree).props.onAnimationLoaded();
  assert.equal(f.calls.at(-1), 'pause', 'A late asset load does not restart disallowed motion');
  tree = f.render({ allowed: true });
  assert.equal(player(tree).props.autoPlay, true);
  assert.equal(f.calls.at(-1), 'resume');
});

test('initially hidden or reduced-motion trophies show the first selected frame without starting playback', () => {
  for (const gates of [{ visible: false }, { allowed: false }, { visible: false, allowed: false }]) {
    const f = fixture(gates), lottie = player(f.render());
    assert.equal(lottie.props.autoPlay, false);
    assert.equal(lottie.props.progress, 0);
    assert.equal(lottie.props.source.ip, 24);
    lottie.props.onAnimationLoaded();
    assert.deepEqual(f.calls, ['pause', 'pause']);
  }
});

test('animation failure replaces the player with the existing trophy fallback at the same slot size', () => {
  for (const allowed of [true, false]) {
    const f = fixture({ size: 88, allowed });
    player(f.render()).props.onAnimationFailure('synthetic native failure');
    let tree = f.render();
    assert.equal(nodes(tree).filter(node => node.type === 'LottieView').length, 0);
    const fallback = nodes(tree).filter(node => node.type === 'AnimatedIcon');
    assert.equal(fallback.length, 1);
    assert.equal(fallback[0].props.name, 'trophy');
    assert.equal(fallback[0].props.size, 88);
    assert.equal(tree.props.pointerEvents, 'none');
    assert.equal(flatten(tree.props.style).width, 88);
    tree = f.render({ allowed: !allowed });
    assert.equal(nodes(tree).filter(node => node.type === 'LottieView').length, 0, 'Motion changes do not retry a failed native player');
  }
});

test('the main card and raffle details declare their respective 86 and 88 point trophy slots', () => {
  for (const [file, expected] of [['../App.tsx', 86], ['../src/RaffleDetails.tsx', 88]]) {
    const source = fs.readFileSync(require.resolve(file), 'utf8');
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const slots = [];
    function visit(node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(parsed) === 'TrophyLottie') {
        const size = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.text === 'size');
        assert.ok(size && ts.isJsxExpression(size.initializer) && ts.isNumericLiteral(size.initializer.expression));
        slots.push(Number(size.initializer.expression.text));
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.deepEqual(slots, [expected]);
  }
});
