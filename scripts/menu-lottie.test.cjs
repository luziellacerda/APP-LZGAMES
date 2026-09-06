const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const effects = path.resolve(__dirname, '../src/effects');
const assets = {
  rocket: ['rocket-flight.json', 'rocket-license.json', '🚀'],
  calendar: ['referral-calendar.json', 'referral-calendar-license.json', '📅'],
  tools: ['wrench-service.json', 'wrench-license.json', '🔧'],
};
const json = filename => JSON.parse(fs.readFileSync(path.join(effects, 'assets', filename), 'utf8'));
const compile = filename => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  },
}).outputText;
const moduleCache = new Map();
function model(name) {
  assert.ok(['menuLotties', 'animations', 'cometAnimation'].includes(name), 'Unexpected model dependency: ' + name);
  if (moduleCache.has(name)) return moduleCache.get(name);
  const context = {
    exports: {},
    require(request) {
      if (/^\.\/assets\/[a-z0-9-]+\.json$/.test(request)) return json(path.basename(request));
      assert.ok(request.startsWith('./'), 'No external model imports');
      return model(request.slice(2));
    },
  };
  vm.runInNewContext(compile(path.join(effects, name + '.ts')), context, { filename: name + '.ts' });
  moduleCache.set(name, context.exports);
  return context.exports;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
function textContent(tree) {
  if (Array.isArray(tree)) return tree.map(textContent).join('');
  if (typeof tree === 'string') return tree;
  return tree && typeof tree === 'object' ? textContent(tree.props.children) : '';
}
function walk(value, visit) {
  visit(value);
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'meta') walk(child, visit); // Attribution URLs are data, not playback dependencies.
    }
  }
}

// Render both real component functions with separate hook stores and a mock
// native ref. No effects provider, authenticated API, network or timers run.
// This verifies JSX/effect contracts, not native pixels, FPS or physical touch.
function fixture(initial = {}) {
  const state = { name: 'rocket', visible: true, allowed: true, active: true, ...initial };
  const calls = [], pending = [], stores = { icon: [], vector: [] };
  const surface = { Provider: 'SurfaceMotion.Provider' };
  const native = Object.fromEntries(['pause', 'resume', 'play'].map(name => [name, () => calls.push(name)]));
  let current, cursor = 0;
  const react = {
    memo: component => component,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext(context) { assert.equal(context, surface); return state.visible; },
    useRef(value) { return current[cursor++] ??= { current: value }; },
    useState(value) {
      const store = current, index = cursor++;
      store[index] ??= { value };
      return [store[index].value, next => { store[index].value = typeof next === 'function' ? next(store[index].value) : next; }];
    },
    useEffect(callback, deps) {
      const store = current, index = cursor++, old = store[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        pending.push(() => { old?.cleanup?.(); store[index] = { deps, cleanup: callback() }; });
      }
    },
    useMemo: callback => callback(),
  };
  const absoluteFill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };
  const modules = {
    react,
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable',
      StyleSheet: { create: styles => styles, absoluteFill },
    },
    'lottie-react-native': { __esModule: true, default: 'LottieView' },
    './animations': model('animations'),
    './menuLotties': model('menuLotties'),
    './Motion': {
      SurfaceMotion: surface,
      useMotionAllowed: () => state.allowed,
      useSurfaceVisibility: () => assert.fail('This fixture must not mount unrelated cards'),
    },
  };
  const context = {
    exports: {},
    require(name) { assert.ok(name in modules, 'Unexpected component dependency: ' + name); return modules[name]; },
    fetch: () => assert.fail('Unexpected network request'),
    setInterval: () => assert.fail('Unexpected background timer'),
    setTimeout: () => assert.fail('Unexpected background timer'),
  };
  vm.runInNewContext(compile(path.join(effects, 'Neon.tsx')), context, { filename: 'Neon.tsx' });
  return {
    calls, absoluteFill,
    render(next = {}) {
      Object.assign(state, next);
      current = stores.icon; cursor = 0;
      const tree = context.exports.AnimatedIcon({ name: state.name, size: state.size, active: state.active });
      const vectors = nodes(tree).filter(node => node.type === context.exports.VectorMotion);
      assert.ok(vectors.length <= 1);
      let lottie;
      if (vectors.length) {
        current = stores.vector; cursor = 0;
        lottie = context.exports.VectorMotion(vectors[0].props);
        assert.equal(lottie.type, 'LottieView');
        lottie.props.ref.current = native;
      } else {
        for (const hook of stores.vector) {
          hook?.cleanup?.();
          if (hook && 'current' in hook) hook.current = null;
        }
        stores.vector.length = 0;
      }
      pending.splice(0).forEach(effect => effect());
      return { tree, vector: vectors[0], lottie };
    },
  };
}

test('exactly rocket, calendar and tools use the corresponding local artwork with bundled attribution', () => {
  const { menuLotties } = model('menuLotties');
  assert.deepEqual(Object.keys(menuLotties).sort(), Object.keys(assets).sort());
  for (const [name, [animationFile, licenseFile]] of Object.entries(assets)) {
    const original = json(animationFile), license = json(licenseFile), config = menuLotties[name];
    assert.deepEqual(config.source.layers, original.layers);
    assert.deepEqual(config.source.assets, original.assets);
    assert.deepEqual(config.source.meta.credit, license);
    for (const key of ['author', 'title', 'source', 'licenseName', 'licenseUrl', 'licenseText']) {
      assert.equal(typeof license[key], 'string', name + ' must ship ' + key);
      assert.ok(license[key].trim().length > 0);
    }
    assert.ok(license.licenseText.length > 300, 'Ship license terms, not just their URL');
    assert.ok(Number.isFinite(config.scale) && config.scale > 0);
    assert.ok(Number.isFinite(config.speed) && config.speed > 0);
    assert.ok(Number.isFinite(config.stillProgress) && config.stillProgress >= 0 && config.stillProgress <= 1);
  }
});

test('downloaded playback files contain vector motion and resolve every precomposition locally', () => {
  for (const [name, [animationFile]] of Object.entries(assets)) {
    const animation = json(animationFile);
    assert.ok(animation.w > 0 && animation.h > 0 && animation.fr > 0);
    assert.ok(animation.op > animation.ip);
    assert.equal(animation.fonts?.list?.length ?? 0, 0);
    assert.equal(animation.chars?.length ?? 0, 0);
    const internal = new Map((animation.assets ?? []).map(asset => [asset.id, asset]));
    assert.equal(internal.size, animation.assets?.length ?? 0);
    for (const asset of internal.values()) {
      assert.ok(Array.isArray(asset.layers), name + ': only internal precomposition assets');
      assert.equal(asset.p, undefined);
      assert.equal(asset.u, undefined);
    }
    function validate(layers, parents = []) {
      for (const layer of layers) {
        assert.ok([0, 1, 3, 4].includes(layer.ty), name + ': no image, text, audio or external footage layers');
        if (layer.ty === 0) {
          assert.ok(internal.has(layer.refId), 'The referenced composition is bundled');
          assert.ok(!parents.includes(layer.refId), 'No circular composition references');
          validate(internal.get(layer.refId).layers, [...parents, layer.refId]);
        }
      }
    }
    validate(animation.layers);
    for (const asset of internal.values()) validate(asset.layers, [asset.id]);
    let animated = false;
    walk(animation, value => {
      if (typeof value === 'string') assert.ok(!/(?:https?:|data:|file:|ftp:|\/\/)/i.test(value), name + ': no playback URL');
      if (typeof value === 'number') assert.ok(Number.isFinite(value));
      if (!value || typeof value !== 'object') return;
      assert.notEqual(typeof value.x, 'string', 'No Lottie expressions');
      assert.equal(value.expression, undefined);
      assert.equal(value.expr, undefined);
      if (value.a === 1 && Array.isArray(value.k) && value.k.length > 1) {
        const poses = value.k.map(key => JSON.stringify(key.s)).filter(Boolean);
        if (new Set(poses).size > 1) animated = true;
      }
    });
    assert.ok(animated, name + ': retain changing keyframed properties');
  }
});

test('downloaded icons keep each requested slot size and center their configurable canvas without intercepting input', () => {
  const { menuLotties } = model('menuLotties');
  for (const name of Object.keys(assets)) {
    for (const size of [28, 32, 42, 54]) {
      const config = menuLotties[name], { tree, lottie } = fixture({ name, size }).render();
      assert.equal(tree.props.style.width, size);
      assert.equal(tree.props.style.height, size);
      assert.equal(tree.props.style.overflow, 'hidden');
      assert.equal(tree.props.pointerEvents, 'none');
      assert.equal(tree.props.accessible, false);
      assert.equal(tree.props.accessibilityElementsHidden, true);
      assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
      assert.equal(lottie.props.source, config.source);
      assert.equal(lottie.props.speed, config.speed);
      assert.equal(lottie.props.style.position, 'absolute');
      assert.equal(lottie.props.style.width, size * config.scale);
      assert.equal(lottie.props.style.height, size * config.scale);
      assert.equal(lottie.props.style.left, (size - size * config.scale) / 2);
      assert.equal(lottie.props.style.top, (size - size * config.scale) / 2);
      assert.equal(lottie.props.resizeMode, 'contain');
      assert.equal(lottie.props.loop, true);
      assert.equal(lottie.props.useNativeLooping, true);
    }
  }
  assert.equal(fixture().render().tree.props.style.width, 42);
});

test('all three motion gates stop downloaded icons on their configured static frame and resume when reopened', () => {
  const { menuLotties } = model('menuLotties');
  for (const name of Object.keys(assets)) {
    for (const gate of ['active', 'visible', 'allowed']) {
      const f = fixture({ name });
      let { lottie } = f.render();
      assert.equal(lottie.props.autoPlay, true);
      assert.equal(lottie.props.progress, undefined);
      assert.deepEqual(f.calls, ['resume']);
      lottie.props.onAnimationLoaded();
      assert.deepEqual(f.calls, ['resume', 'play']);
      f.render();
      assert.equal(f.calls.length, 2, 'Unchanged dependencies do not restart playback');
      ({ lottie } = f.render({ [gate]: false }));
      assert.equal(lottie.props.autoPlay, false);
      assert.equal(lottie.props.progress, menuLotties[name].stillProgress);
      assert.equal(f.calls.at(-1), 'pause');
      lottie.props.onAnimationLoaded();
      assert.equal(f.calls.at(-1), 'pause', 'A late asset load respects inactive/reduced/hidden state');
      ({ lottie } = f.render({ [gate]: true }));
      assert.equal(lottie.props.autoPlay, true);
      assert.equal(lottie.props.progress, undefined);
      assert.equal(f.calls.at(-1), 'resume');
    }
  }
});

test('icons initially inactive, hidden or reduced-motion never begin playback', () => {
  const { menuLotties } = model('menuLotties');
  for (const name of Object.keys(assets)) {
    for (const gate of ['active', 'visible', 'allowed']) {
      const f = fixture({ name, [gate]: false });
      const { lottie } = f.render();
      assert.equal(lottie.props.autoPlay, false);
      assert.equal(lottie.props.progress, menuLotties[name].stillProgress);
      lottie.props.onAnimationLoaded();
      assert.deepEqual(f.calls, ['pause', 'pause']);
    }
  }
});

test('failed downloaded players use their existing fallback glyph inside the unchanged noninteractive slot', () => {
  for (const [name, [, , glyph]] of Object.entries(assets)) {
    const f = fixture({ name, size: 28 });
    f.render().lottie.props.onAnimationFailure('synthetic player failure');
    const failed = f.render();
    assert.equal(failed.vector, undefined);
    assert.equal(failed.lottie, undefined);
    assert.equal(textContent(failed.tree), glyph);
    assert.equal(failed.tree.props.style.width, 28);
    assert.equal(failed.tree.props.style.height, 28);
    assert.equal(failed.tree.props.pointerEvents, 'none');
    assert.equal(f.render({ allowed: false }).lottie, undefined);
  }
});

test('home, trophy and account icons retain the existing generated source and VectorMotion defaults', () => {
  const { iconAnimations } = model('animations');
  for (const name of ['home', 'trophy', 'user']) {
    const f = fixture({ name, size: 28 });
    let { tree, lottie } = f.render();
    assert.equal(tree.props.style.width, 28);
    assert.equal(lottie.props.source, iconAnimations[name]);
    assert.equal(lottie.props.style, f.absoluteFill);
    assert.equal(lottie.props.speed, 1);
    assert.equal(lottie.props.progress, undefined);
    ({ lottie } = f.render({ allowed: false }));
    assert.equal(lottie.props.autoPlay, false);
    assert.equal(lottie.props.progress, undefined, 'Existing generated effects keep their former pause behavior');
    assert.equal(f.calls.at(-1), 'pause');
  }
});
