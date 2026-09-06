const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run AppContent's actual handlers and JSX with inert native components. Effects
// are intentionally skipped: this checks component contracts, not native layout,
// screen-reader announcements, touch dispatch, or authenticated backend behavior.
const filename = require.resolve('../App.tsx');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AppContent');
assert.ok(component?.body, 'AppContent must exist');
const stateNames = component.body.statements.flatMap(statement => {
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap(declaration => {
    if (!ts.isArrayBindingPattern(declaration.name) || !declaration.initializer ||
        !ts.isCallExpression(declaration.initializer) || declaration.initializer.expression.getText(parsed) !== 'useState') return [];
    return [declaration.name.elements[0].name.getText(parsed)];
  });
});
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
}).outputText + '\nexports.renderAppContent = AppContent;';
const entryModule={exports:{},Error};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/referralEntry.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,entryModule);

function flatten(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
function content(tree) {
  if (Array.isArray(tree)) return tree.map(content).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? content(tree.props.children) : '';
}
function find(tree, predicate) {
  const matches = nodes(tree).filter(predicate);
  assert.equal(matches.length, 1, 'Expected exactly one matching element');
  return matches[0];
}
function messaging(tree) {
  return find(tree, node => node.props.testID === 'raffle-messaging-toggle');
}
function pushControl(tree) {
  return find(tree, node => node.type === 'Pressable' && /notificações push$/.test(node.props.accessibilityLabel ?? ''));
}
function serviceControl(tree) {
  return find(tree, node => node.props.testID === 'service-push-toggle');
}
function parentOf(tree, child) {
  return find(tree, node => [node.props.children].flat(Infinity).includes(child));
}
function menu(tree) {
  return nodes(tree).filter(node => node.props.accessibilityRole === 'tab');
}
function menuSnapshot(tree) {
  return menu(tree).map(node => ({
    label: node.props.accessibilityLabel,
    selected: node.props.accessibilityState.selected,
    style: flatten(node.props.style),
    text: content(node),
  }));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}
function fixture(options = {}) {
  const presence = {
    linked: true, devices: 1, marketingOptIn: options.marketingOptIn ?? false,
    push: { enabled: options.pushEnabled ?? false, serviceEnabled: options.serviceEnabled ?? false },
  };
  const states = new Map(Object.entries({
    booting: false, signed: true, tab: 'conta', appPresence: presence,
    ...options.states,
  }));
  const calls = [], alerts = [];
  let cursor = 0, refCursor=0, nextSync, pushCallbacks;
  const refs=[];
  const unexpected = name => () => assert.fail('Unexpected side effect: ' + name);
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment',
    useState(initial) {
      const name = stateNames[cursor++];
      assert.ok(name, 'Every state hook must have an AST-derived name');
      if (!states.has(name)) states.set(name, typeof initial === 'function' ? initial() : initial);
      return [states.get(name), value => states.set(name, typeof value === 'function' ? value(states.get(name)) : value)];
    },
    useEffect() {},
    useRef(value) { return refs[refCursor++] ??= {current:value}; },
  };
  const native = Object.fromEntries([
    'ActivityIndicator', 'Pressable', 'RefreshControl', 'SafeAreaView',
    'ScrollView', 'Text', 'TextInput', 'View',
  ].map(name => [name, name]));
  Object.assign(native, {
    Alert: { alert: (...args) => { alerts.push(args); } },
    AppState: { currentState: 'active' },
    Linking: { openSettings: async () => { calls.push(['openSettings']); if (options.settingsFailure) throw new Error('Synthetic settings failure'); }, openURL: unexpected('open URL') },
    StyleSheet: { create: styles => styles },
  });
  const api = Object.fromEntries([
    'hasSession', 'loadHome', 'loadRaffleInbox', 'login', 'logout',
    'register', 'requestAccountDeletion',
  ].map(name => [name, unexpected(name)]));
  api.loadHome = async () => { calls.push(['loadHome']); if(options.homeError)throw options.homeError; return options.home ?? null; };
  if(options.auth){
    api.login=async()=>calls.push(['login']);
    api.register=async()=>calls.push(['register']);
    api.validateReferralInvite=value=>value;
    api.acceptReferralInvite=async()=>{calls.push(['bind']);if(options.bindFailure)throw new Error('Convite não confirmado.');};
    api.loadRaffleInbox=async()=>({presence,announcements:[]});
  }
  api.syncRafflePresence = async (...args) => {
    calls.push(['sync', ...args]);
    if (nextSync) {
      const response = nextSync;
      nextSync = undefined;
      return response;
    }
    const current = states.get('appPresence');
    const nextPush = { ...current?.push };
    if (args[1]) {
      const { scope = 'raffles', enabled, ...registration } = args[1];
      Object.assign(nextPush, registration);
      nextPush[scope === 'services' ? 'serviceEnabled' : 'enabled'] = enabled;
    }
    return {
      ...current,
      marketingOptIn: args[0] ?? current?.marketingOptIn ?? false,
      push: args[1] ? nextPush : current?.push,
    };
  };
  const modules = {
    react,
    'react-native': native,
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'lottie-react-native': { __esModule: true, default: 'LottieView' },
    './src/api': api,
    './src/referralEntry': entryModule.exports,
    './src/effects/Motion': { MotionProvider: 'MotionProvider', MotionScrollView: 'MotionScrollView' },
    './src/effects/Neon': { AnimatedIcon: 'AnimatedIcon', NeonCard: 'NeonCard' },
    './src/effects/CardLottie': { CardLottie: 'CardLottie' },
    './src/effects/ElectricMenu': { ElectricMenuEffects: 'ElectricMenuEffects' },
    './src/push': {
      useRafflePush(active, callbacks) { pushCallbacks = callbacks; },
      supportsRemotePush: () => options.supported ?? true,
      preparePushRegistration: async requested => {
        calls.push(['preparePush', requested]);
        if ('registrationError' in options) throw options.registrationError;
        if (options.registrationGate) await options.registrationGate;
        return options.registration ?? { enabled: true, permission: 'granted', token: 'synthetic-token' };
      },
      dismissRaffleNotifications: async scope => { calls.push(['dismissPush', scope]); },
    },
  };
  for (const [path, name] of [
    ['AgendaBooking', 'AgendaBooking'], ['AppointmentCard', 'AppointmentCard'], ['ReferralRewards', 'ReferralRewards'], ['HyperspaceBackground', 'HyperspaceBackground'],
    ['MatrixRain', 'MatrixBackground'], ['RaffleDetails', 'RaffleDetails'],
    ['ServiceOrderCard', 'ServiceOrderCard'], ['TurboRamaDetails', 'TurboRamaDetails'],
    ['effects/Spaceflight', 'SpaceflightBackground'], ['effects/CoinRainBackground', 'CoinRainBackground'],
    ['effects/TrophyLottie', 'TrophyLottie'],
    ['effects/PreviewRevision', 'PreviewRevision'],
  ]) modules['./src/' + path] = { [name]: name };
  const context = {
    exports: {}, Error,
    require(name) { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: unexpected('network request'),
    setInterval: unexpected('background timer'),
  };
  vm.runInNewContext(compiled, context, { filename });
  return {
    calls, alerts, states,
    respondWith(promise) { nextSync = promise; },
    openPush(screen) { pushCallbacks.onOpen(screen); },
    render() {
      cursor = 0;refCursor=0;
      const tree = context.exports.renderAppContent();
      assert.equal(cursor, stateNames.length);
      return tree;
    },
  };
}

test('Entry signup invitation is explicit and precedes presence; a failed binding retries the existing account',async()=>{
  const options={auth:true,bindFailure:true,states:{signed:false,authMode:'register',showEntryInvite:true,entryInvite:'LZfixture.signature',newPassword:'same',confirmPassword:'same'}};
  const f=fixture(options);let tree=f.render();
  assert.equal(find(tree,n=>n.props.testID==='entry-invite-input').props.value,'LZfixture.signature');
  await find(tree,n=>n.type==='Pressable'&&content(n)==='CRIAR MINHA CONTA').props.onPress();
  assert.deepEqual(f.calls,[['register'],['bind']]);assert.equal(f.states.get('signed'),false);
  tree=f.render();assert.match(content(tree),/não é necessário cadastrar novamente/);
  assert.equal(find(tree,n=>n.type==='TextInput'&&n.props.placeholder==='Nome completo').props.editable,false);
  options.bindFailure=false;
  await find(tree,n=>n.type==='Pressable'&&content(n)==='CONTINUAR').props.onPress();
  assert.deepEqual(f.calls,[['register'],['bind'],['bind'],['loadHome'],['sync']]);
  assert.equal(f.states.get('signed'),true);assert.equal(f.states.get('entryInvite'),'');
});

test('WhatsApp CTA has a vertical card, stretching touch target, wrapping label and pressed feedback', () => {
  const f = fixture();
  const tree = f.render(), button = messaging(tree);
  const card = parentOf(tree, button);
  assert.equal(card.type, 'NeonCard');
  assert.equal(flatten(card.props.style).flexDirection, 'column');
  assert.equal(flatten(card.props.style).alignItems, 'stretch');
  const idle = flatten(button.props.style({ pressed: false }));
  const pressed = flatten(button.props.style({ pressed: true }));
  assert.equal(idle.alignSelf, 'stretch');
  assert.ok(idle.minHeight >= 52);
  assert.equal(idle.height, undefined);
  assert.equal(idle.maxHeight, undefined);
  assert.equal(idle.width, undefined);
  assert.equal(idle.maxWidth, undefined);
  assert.equal(button.props.hitSlop, 6);
  assert.ok(pressed.opacity < (idle.opacity ?? 1), 'A held press must visibly respond');
  const label = find(button, node => node.type === 'Text');
  assert.ok(flatten(label.props.style).fontSize >= 13);
  assert.equal(flatten(label.props.style).flexShrink, 1);
  assert.equal(label.props.numberOfLines, undefined, 'Long/scaled labels may wrap');
  assert.notEqual(label.props.allowFontScaling, false);
  assert.equal(content(button), 'ATIVAR AVISOS NO WHATSAPP');
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityLabel, 'Ativar avisos de sorteios no WhatsApp');
  assert.equal(button.props.accessibilityState.disabled, false);
  assert.equal(button.props.accessibilityState.busy, false);
  assert.equal(f.calls.length, 0);
});

test('WhatsApp saves once while busy, announces success and can be turned off again', async () => {
  const f = fixture(), gate = deferred();
  const initialTree = f.render(), initialMenu = menuSnapshot(initialTree);
  const pushBefore = pushControl(initialTree);
  f.respondWith(gate.promise);
  const saving = messaging(initialTree).props.onPress();
  assert.deepEqual(f.calls, [['sync', true]], 'Only the WhatsApp marketing preference is submitted');
  let tree = f.render(), button = messaging(tree);
  assert.equal(content(button), 'SALVANDO…');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.accessibilityState.disabled, true);
  assert.equal(button.props.accessibilityState.busy, true);
  assert.ok(flatten(button.props.style({ pressed: false })).opacity < 1);
  assert.equal(nodes(button).filter(node => node.type === 'ActivityIndicator').length, 1);
  assert.equal(pushControl(tree).props.disabled, true);
  assert.deepEqual(menuSnapshot(tree), initialMenu);
  await button.props.onPress(); // Exercise the real handler's guard as well as disabled props.
  assert.equal(f.calls.length, 1);
  gate.resolve({ ...f.states.get('appPresence'), marketingOptIn: true });
  await saving;
  tree = f.render(); button = messaging(tree);
  assert.equal(content(button), 'DESATIVAR AVISOS');
  assert.equal(button.props.accessibilityLabel, 'Desativar avisos de sorteios no WhatsApp');
  assert.equal(button.props.disabled, false);
  assert.equal(button.props.accessibilityState.busy, false);
  assert.equal(nodes(button).filter(node => node.type === 'ActivityIndicator').length, 0);
  assert.equal(f.alerts.at(-1)[0], 'Avisos ativados');
  assert.deepEqual(flatten(pushControl(tree).props.style), flatten(pushBefore.props.style));
  assert.equal(content(pushControl(tree)), content(pushBefore));
  assert.deepEqual(menuSnapshot(tree), initialMenu);
  await button.props.onPress();
  assert.deepEqual(f.calls, [['sync', true], ['sync', false]]);
  assert.equal(content(messaging(f.render())), 'ATIVAR AVISOS NO WHATSAPP');
  assert.equal(f.alerts.at(-1)[0], 'Avisos desativados');
});

test('WhatsApp failures show an alert, preserve consent and unlock the button for retry', async () => {
  for (const initiallyEnabled of [false, true]) {
    const f = fixture({ marketingOptIn: initiallyEnabled }), gate = deferred();
    f.respondWith(gate.promise);
    const saving = messaging(f.render()).props.onPress();
    gate.reject(new Error('Falha sintética: tente novamente.'));
    await saving;
    const button = messaging(f.render());
    assert.deepEqual(f.alerts.at(-1), ['Avisos de sorteios', 'Falha sintética: tente novamente.']);
    assert.equal(f.states.get('appPresence').marketingOptIn, initiallyEnabled);
    assert.equal(button.props.disabled, false);
    assert.equal(button.props.accessibilityState.busy, false);
    assert.equal(content(button), initiallyEnabled ? 'DESATIVAR AVISOS' : 'ATIVAR AVISOS NO WHATSAPP');
    await button.props.onPress();
    assert.deepEqual(f.calls, [['sync', !initiallyEnabled], ['sync', !initiallyEnabled]]);
    assert.equal(f.states.get('appPresence').marketingOptIn, !initiallyEnabled);
    assert.equal(messaging(f.render()).props.disabled, false);
  }
});

test('a non-Error rejection shows the actionable fallback and releases saving state', async () => {
  const f = fixture(), gate = deferred();
  f.respondWith(gate.promise);
  const saving = messaging(f.render()).props.onPress();
  gate.reject(null);
  await saving;
  assert.deepEqual(f.alerts.at(-1), ['Avisos de sorteios', 'Não foi possível atualizar sua preferência. Tente novamente.']);
  assert.equal(messaging(f.render()).props.disabled, false);
  assert.equal(f.states.get('loading'), false);
  assert.equal(f.states.get('raffleMessagingBusy'), false);
});

test('refresh and push work block WhatsApp consent changes and expose their busy state', async () => {
  for (const state of ['loading', 'pushBusy']) {
    const f = fixture({ states: { [state]: true } });
    const button = messaging(f.render());
    assert.equal(content(button), 'AGUARDE…');
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityState.disabled, true);
    assert.equal(button.props.accessibilityState.busy, true);
    await button.props.onPress();
    assert.equal(f.calls.length, 0);
  }
});

test('the raffle push control keeps its compact layout and toggles without changing WhatsApp or services', async () => {
  const f = fixture({ marketingOptIn: true, serviceEnabled: true });
  let tree = f.render(), button = pushControl(tree);
  const card = parentOf(tree, button);
  assert.equal(flatten(card.props.style).flexDirection, 'row');
  assert.equal(flatten(button.props.style).height, 36);
  assert.equal(flatten(button.props.style).minWidth, 76);
  assert.equal(flatten(find(button, node => node.type === 'Text').props.style).fontSize, 9);
  assert.equal(content(button), 'ATIVAR');
  assert.equal(button.props.testID, undefined);
  assert.equal(button.props.hitSlop, undefined);
  await button.props.onPress();
  assert.equal(f.calls[0][0], 'preparePush');
  assert.equal(f.calls[0][1], true);
  assert.equal(f.calls[1][0], 'sync');
  assert.equal(f.calls[1][1], undefined, 'Push does not write the marketing argument');
  assert.equal(f.calls[1][2].enabled, true);
  tree = f.render(); button = pushControl(tree);
  assert.equal(content(button), 'DESATIVAR');
  assert.equal(button.props.accessibilityLabel, 'Desativar notificações push');
  assert.equal(f.states.get('appPresence').marketingOptIn, true);
  assert.equal(f.states.get('appPresence').push.serviceEnabled, true);
  assert.equal(content(messaging(tree)), 'DESATIVAR AVISOS');
  await button.props.onPress();
  assert.equal(f.calls[2][0], 'sync');
  assert.equal(f.calls[2][1], undefined);
  assert.equal(f.calls[2][2].enabled, false);
  assert.deepEqual(f.calls[3], ['dismissPush', 'raffles']);
  assert.equal(f.states.get('appPresence').marketingOptIn, true);
  assert.equal(f.states.get('appPresence').push.serviceEnabled, true);
  assert.equal(content(pushControl(f.render())), 'ATIVAR');
});

test('the compact services card explains reminder times and changes only its own opt-in', async () => {
  const f = fixture({ marketingOptIn: true, pushEnabled: true });
  let tree = f.render(), button = serviceControl(tree);
  const card = parentOf(tree, button);
  assert.equal(flatten(card.props.style).flexDirection, 'row');
  assert.equal(flatten(button.props.style).height, 36);
  assert.equal(flatten(button.props.style).minWidth, 76);
  assert.match(content(card), /OS e agendamentos/);
  assert.match(content(card), /3 dias sem alterações/);
  assert.match(content(card), /6, 3 e 1 hora antes/);
  assert.equal(button.props.accessibilityLabel, 'Ativar avisos de OS e agendamentos');
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityState.disabled, false);
  assert.equal(content(button), 'ATIVAR');
  await button.props.onPress();
  const registration = f.calls.find(call => call[0] === 'sync');
  assert.equal(registration[1], undefined);
  assert.equal(registration[2].scope, 'services');
  assert.equal(registration[2].enabled, true);
  assert.equal(registration[2].refreshOnly, undefined, 'A user opt-in is not token maintenance');
  assert.equal(f.states.get('appPresence').marketingOptIn, true);
  assert.equal(f.states.get('appPresence').push.enabled, true);
  assert.equal(f.states.get('appPresence').push.serviceEnabled, true);
  assert.equal(f.alerts.at(-1)[0], 'Avisos de OS e agendamentos ativados');
  tree = f.render(); button = serviceControl(tree);
  assert.equal(content(button), 'DESATIVAR');
  assert.equal(button.props.accessibilityLabel, 'Desativar avisos de OS e agendamentos');
  await button.props.onPress();
  const saves = f.calls.filter(call => call[0] === 'sync');
  assert.equal(saves.length, 2);
  assert.equal(saves[1][2].scope, 'services');
  assert.equal(saves[1][2].enabled, false);
  assert.deepEqual(f.calls.at(-1), ['dismissPush', 'services']);
  assert.equal(f.states.get('appPresence').push.enabled, true);
  assert.equal(f.states.get('appPresence').marketingOptIn, true);
  assert.equal(content(serviceControl(f.render())), 'ATIVAR');
});

test('service registration locks every notification control until it settles without duplicate operations', async () => {
  const gate = deferred(), f = fixture({ registrationGate: gate.promise });
  const saving = serviceControl(f.render()).props.onPress();
  const tree = f.render(), button = serviceControl(tree);
  assert.equal(content(button), 'AGUARDE');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.accessibilityState.busy, true);
  assert.equal(pushControl(tree).props.disabled, true);
  assert.equal(messaging(tree).props.disabled, true);
  await button.props.onPress();
  await pushControl(tree).props.onPress();
  await messaging(tree).props.onPress();
  assert.deepEqual(f.calls, [['preparePush', true]]);
  gate.resolve(); await saving;
  assert.equal(serviceControl(f.render()).props.disabled, false);
  assert.equal(serviceControl(f.render()).props.accessibilityState.busy, false);
  assert.equal(f.calls.filter(call => call[0] === 'sync').length, 1);
  for (const name of ['loading', 'pushBusy', 'raffleMessagingBusy']) {
    const busy = fixture({ states: { [name]: true } });
    await serviceControl(busy.render()).props.onPress();
    assert.equal(busy.calls.length, 0, 'The handler also rejects other pending operations');
  }
});

test('a failed service preference preserves both scopes, shows an alert and permits retry', async () => {
  for (const serviceEnabled of [false, true]) {
    const f = fixture({ serviceEnabled, pushEnabled: true, marketingOptIn: true }), gate = deferred();
    f.respondWith(gate.promise);
    const saving = serviceControl(f.render()).props.onPress();
    // Enabling first awaits native registration; attach the rejection after that step.
    await Promise.resolve();
    gate.reject(new Error('Falha sintética ao salvar os avisos.'));
    await saving;
    assert.deepEqual(f.alerts.at(-1), ['OS e agendamentos', 'Falha sintética ao salvar os avisos.']);
    assert.equal(f.states.get('appPresence').push.serviceEnabled, serviceEnabled);
    assert.equal(f.states.get('appPresence').push.enabled, true);
    assert.equal(f.states.get('appPresence').marketingOptIn, true);
    const retry = serviceControl(f.render());
    assert.equal(retry.props.disabled, false);
    await retry.props.onPress();
    assert.equal(f.states.get('appPresence').push.serviceEnabled, !serviceEnabled);
  }
});

test('denied service permission cannot enable services and exposes settings with a safe failure message', async () => {
  const f = fixture({ pushEnabled: true, registration: { enabled: false, permission: 'denied', token: null }, settingsFailure: true });
  await serviceControl(f.render()).props.onPress();
  assert.equal(f.states.get('appPresence').push.serviceEnabled, false);
  assert.equal(f.states.get('appPresence').push.enabled, true);
  const alert = f.alerts.at(-1);
  assert.equal(alert[0], 'Notificações não autorizadas');
  assert.equal(alert[2][0].style, 'cancel');
  alert[2][1].onPress();
  await Promise.resolve();
  assert.equal(f.alerts.at(-1)[0], 'Configurações');
  assert.equal(serviceControl(f.render()).props.disabled, false);
  const failed = fixture({ registrationError: null });
  await serviceControl(failed.render()).props.onPress();
  assert.deepEqual(failed.alerts.at(-1), ['OS e agendamentos', 'Não foi possível atualizar os avisos. Tente novamente.']);
  assert.equal(failed.calls.some(call => call[0] === 'sync'), false);
  assert.equal(serviceControl(failed.render()).props.disabled, false);
});

test('opening a routed push selects its matching tab and reloads home once', async () => {
  for (const screen of ['sorteios', 'os', 'agenda']) {
    const f = fixture();
    f.render();
    f.openPush(screen);
    await Promise.resolve();
    assert.equal(f.states.get('tab'), screen);
    assert.deepEqual(f.calls, [['loadHome']]);
    assert.equal(menu(f.render()).filter(node => node.props.accessibilityState.selected).length, 1);
  }
});

test('private home announcements use their event type for labels and navigation, ignoring arbitrary destinations', () => {
  for (const [event_type, screen, label] of [
    ['service_order', 'os', 'VER ORDEM DE SERVIÇO'],
    ['appointment', 'agenda', 'VER AGENDAMENTO'],
  ]) {
    const announcement = {
      id: 41, event_type, title: 'Aviso privado sintético', message: 'Atualização sintética.',
      resource_id: 'https://invalid.example/resource', screen: 'conta', url: 'https://invalid.example/path',
    };
    const f = fixture({ states: { tab: 'inicio', announcements: [announcement] } });
    const card = find(f.render(), node => node.props.testID === 'home-announcement-41');
    assert.match(content(card), new RegExp(label));
    assert.doesNotMatch(content(card), /SORTEIO|CAMPANHA/);
    card.props.onPress();
    assert.equal(f.states.get('tab'), screen);
    assert.equal(f.calls.length, 0, 'The card navigates locally without using payload URLs');
  }
});

test('legacy global announcements still open Sorteios while unknown event types remain readable without a route', () => {
  for (const event_type of [undefined, null, 'raffle']) {
    const f = fixture({ states: { tab: 'inicio', announcements: [{ id: 42, event_type, title: 'Aviso global', message: 'Mensagem sintética.' }] } });
    const card = find(f.render(), node => node.props.testID === 'home-announcement-42');
    assert.match(content(card), /AVISO DE SORTEIO/);
    assert.match(content(card), /VER CAMPANHA/);
    card.props.onPress();
    assert.equal(f.states.get('tab'), 'sorteios');
  }
  for (const event_type of ['unknown', '__proto__', 'constructor', 'https://invalid.example']) {
    const f = fixture({ states: { tab: 'inicio', announcements: [{ id: 43, event_type, title: 'Aviso recebido', message: 'Mensagem preservada.' }] } });
    const card = find(f.render(), node => node.props.testID === 'home-announcement-43');
    assert.match(content(card), /Mensagem preservada/);
    assert.equal(card.props.onPress, undefined);
    assert.doesNotMatch(content(card), /VER CAMPANHA|VER AGENDAMENTO|VER ORDEM/);
    assert.equal(f.states.get('tab'), 'inicio');
  }
});

test('account and Sorteios reuse one inbox and each entry opens its own allowed screen', () => {
  const announcements = [
    { id: 51, event_type: 'service_order', title: 'OS atualizada', message: 'Mensagem sintética A.' },
    { id: 52, event_type: 'appointment', title: 'Lembrete de agenda', message: 'Mensagem sintética B.' },
    { id: 53, event_type: null, title: 'Campanha global', message: 'Mensagem sintética C.' },
  ];
  const data = { user: { name: 'Cliente sintético' }, services: { scheduling: { appointments: [] }, raffles: {} } };
  for (const tab of ['conta', 'sorteios']) {
    const f = fixture({ states: { tab, data, announcements } });
    for (const [index, screen] of ['os', 'agenda', 'sorteios'].entries()) {
      f.states.set('tab', tab);
      const tree = f.render();
      assert.equal(nodes(tree).filter(node => /^inbox-announcement-/.test(node.props.testID ?? '')).length, 3);
      const item = find(tree, node => node.props.testID === 'inbox-announcement-' + announcements[index].id);
      assert.equal(item.props.accessibilityRole, 'button');
      assert.equal(item.props.disabled, false);
      item.props.onPress();
      assert.equal(f.states.get('tab'), screen);
    }
    assert.equal(f.states.get('announcements'), announcements, 'Routing reuses the received inbox without copying or fetching it');
    assert.equal(f.calls.length, 0);
  }
});

test('unknown inbox types never provide a navigation action', () => {
  const f = fixture({ states: { announcements: [{ id: 61, event_type: 'conta', title: 'Aviso sintético', message: 'Texto visível.' }] } });
  const item = find(f.render(), node => node.props.testID === 'inbox-announcement-61');
  assert.equal(item.props.disabled, true);
  assert.equal(item.props.accessibilityState.disabled, true);
  assert.equal(item.props.onPress, undefined);
  assert.equal(item.props.accessibilityRole, undefined);
  assert.match(content(item), /Texto visível/);
});

test('all six menu tabs retain their labels and navigate with their existing selection state', () => {
  const f = fixture();
  const labels = ['Início', 'Ordens de serviço', 'Agenda', 'TurboRama', 'Sorteios', 'Minha conta'];
  const destinations = ['inicio', 'os', 'agenda', 'turborama', 'sorteios', 'conta'];
  for (let index = 0; index < labels.length; index++) {
    let tree = f.render(), tabs = menu(tree);
    assert.deepEqual(tabs.map(node => node.props.accessibilityLabel), labels);
    assert.ok(tabs.every(node => flatten(node.props.style).flex === 1));
    tabs[index].props.onPress();
    tree = f.render(); tabs = menu(tree);
    assert.equal(f.states.get('tab'), destinations[index]);
    assert.equal(tabs[index].props.accessibilityState.selected, true);
    assert.equal(tabs.filter(node => node.props.accessibilityState.selected).length, 1);
    assert.equal(nodes(tree).filter(node => node.props.testID === 'raffle-messaging-toggle').length, index === 5 ? 1 : 0);
  }
  assert.equal(f.calls.length, 0);
});

test('referral shortcuts open an internal rewards screen without adding or replacing bottom tabs', () => {
  for (const [tab,entry] of [['inicio','home'],['conta','account']]) {
    const f=fixture({states:{tab}});
    let tree=f.render();
    const shortcut=find(tree,node=>node.props.testID===`referral-entry-${entry}`);
    assert.equal(nodes(shortcut).filter(node=>node.type==='CardLottie'&&node.props.kind==='entry').length,1);
    shortcut.props.onPress();
    assert.equal(f.states.get('tab'),'cashback');
    tree=f.render();
    assert.equal(nodes(tree).filter(node=>node.type==='ReferralRewards').length,1);
    assert.equal(menu(tree).length,6);
    assert.equal(menu(tree).find(node=>node.props.accessibilityState.selected).props.accessibilityLabel,'Minha conta');
    find(tree,node=>node.props.testID==='referral-back').props.onPress();
    assert.equal(f.states.get('tab'),'inicio');
    assert.equal(f.calls.length,0,'Opening the panel must not accept or share a referral');
  }
});

test('Agenda replaces display-only rows with detail cards and removes canceled/deleted reservations', () => {
  const saved={agendamento_id:901,status:'pendente',servico_nome:'Atendimento sintético'};
  const data={user:{name:'Cliente sintético'},services:{scheduling:{appointments:[saved,{id:902,status:'cancelled'},{id:903,status:'booked',deleted_at:'2030-04-10'}]}}};
  const f=fixture({states:{tab:'agenda',data}});
  let tree=f.render();
  let cards=nodes(tree).filter(node=>node.type==='AppointmentCard');
  assert.equal(cards.length,1);assert.equal(cards[0].props.appointment,saved);
  const store={nome:'Loja sintética',endereco:'Endereço sintético'};
  find(tree,node=>node.type==='AgendaBooking').props.onStore(store);
  tree=f.render();cards=nodes(tree).filter(node=>node.type==='AppointmentCard');
  assert.equal(cards[0].props.store,store);
  f.states.set('data',{...data,services:{scheduling:{appointments:[]}}});
  assert.equal(nodes(f.render()).filter(node=>node.type==='AppointmentCard').length,0,'A deleted appointment must not reappear from a cached receipt');
  assert.equal(f.calls.length,0,'Opening own details is read-only');
});

test('the committed receipt remains visible on failed refresh without duplicating or resending the reservation', async () => {
  const saved={agendamento_id:901,status:'pendente',servico_nome:'Atendimento sintético'};
  const data={user:{name:'Cliente sintético'},services:{scheduling:{appointments:[saved]}}};
  const f=fixture({states:{tab:'agenda',data},homeError:new Error('Synthetic offline refresh')});
  const receipt={...saved,protocolo:'LZ-2030-000901',profissional_nome:'Profissional sintético'};
  await assert.rejects(find(f.render(),node=>node.type==='AgendaBooking').props.onBooked(receipt),/atualizar os agendamentos/);
  const cards=nodes(f.render()).filter(node=>node.type==='AppointmentCard');
  assert.equal(cards.length,1);assert.equal(cards[0].props.appointment,receipt);
  assert.deepEqual(f.calls,[['loadHome']]);
});
