const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(options = {}) {
  const calls = [], listeners = {}, cleanups = [], channels = [];
  let enabled = options.enabled ?? true;
  let serviceEnabled = options.serviceEnabled ?? false;
  let inboxLoads = 0;
  const constants = { executionEnvironment: options.expoGo ? 'storeClient' : 'standalone', easConfig: { projectId: 'fixture-project' } };
  let permission = { granted: options.granted ?? true, canAskAgain: true, status: options.granted === false ? 'denied' : 'granted' };
  const api = {
    AndroidImportance: { HIGH: 4 }, AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
    setNotificationChannelAsync: async (id, config) => { calls.push('channel:' + id); channels.push({ id, ...config }); },
    getPermissionsAsync: async () => { calls.push('permission'); return permission; },
    requestPermissionsAsync: async () => { calls.push('ask'); return options.deny ? permission : { granted: true, status: 'granted' }; },
    getExpoPushTokenAsync: async ({ projectId }) => { calls.push('token'); assert.equal(projectId, 'fixture-project'); if (options.tokenFailure) throw new Error('secret native error'); if (options.tokenGate) await options.tokenGate; return { data: 'ExpoPushToken[fixture-not-real]' }; },
    setNotificationHandler: handler => { listeners.handler = handler; },
    addNotificationReceivedListener: callback => subscribe('received', callback),
    addNotificationResponseReceivedListener: callback => subscribe('response', callback),
    addPushTokenListener: callback => subscribe('token', callback),
    getLastNotificationResponse: () => options.last ?? null,
    clearLastNotificationResponse: () => { calls.push('clear-response'); },
    dismissAllNotificationsAsync: async () => { calls.push('dismiss'); },
    getPresentedNotificationsAsync: async () => options.presented ?? [],
    dismissNotificationAsync: async id => { calls.push(['dismiss-one', id]); },
  };
  function subscribe(name, callback) { listeners[name] = callback; return { remove() { delete listeners[name]; calls.push('remove-' + name); } }; }
  const modules = {
    'expo-constants': { __esModule: true, default: constants },
    'expo-device': { isDevice: !options.simulator },
    'expo-notifications': api,
    'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener: (name, cb) => subscribe('appstate', cb) } },
    react: { useRef: value => ({ current: value }), useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); } },
    './api': {
      loadRaffleInbox: async () => { inboxLoads++; return { presence: { push: { enabled, serviceEnabled } }, announcements: [] }; },
      syncRafflePresence: async (marketing, push) => {
        calls.push(['save', marketing, push]);
        const scope = push.scope ?? 'raffles';
        options.onSave?.(scope);
        if (options.saveFailures?.includes(scope)) throw new Error('Synthetic scope failure');
        if (scope === 'services') serviceEnabled = push.enabled && (!push.refreshOnly || serviceEnabled);
        else enabled = push.enabled && (!push.refreshOnly || enabled);
        return { push: { enabled, serviceEnabled } };
      },
      recordPushOpen: async id => { calls.push(['open', id]); },
    },
  };
  const source = fs.readFileSync(require.resolve('../src/push.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const context = { exports: {}, require: name => { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; } };
  vm.runInNewContext(compiled, context);
  return {
    push: context.exports, calls, listeners, channels,
    cleanup: () => cleanups.forEach(fn => fn()), constants,
    optOut: (scope = 'raffles') => { if (scope === 'services') serviceEnabled = false; else enabled = false; },
    isEnabled: (scope = 'raffles') => scope === 'services' ? serviceEnabled : enabled,
    inboxLoads: () => inboxLoads,
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('all Android channels exist before permission/token and service channels hide lock-screen content', async () => {
  const f = fixture();
  const result = await f.push.preparePushRegistration(false);
  assert.equal(result.enabled, true);
  assert.deepEqual(f.calls, ['channel:sorteios', 'channel:os', 'channel:agenda', 'permission', 'token']);
  assert.equal(f.channels.find(channel => channel.id === 'sorteios').lockscreenVisibility, 1);
  assert.equal(f.channels.find(channel => channel.id === 'os').lockscreenVisibility, 0);
  assert.equal(f.channels.find(channel => channel.id === 'agenda').lockscreenVisibility, 0);
});
test('denied permission never obtains token or enables push', async () => {
  const f = fixture({ granted: false, deny: true });
  const result = await f.push.preparePushRegistration(true);
  assert.equal(result.enabled, false); assert.equal(result.token, null);
  assert.deepEqual(f.calls, ['channel:sorteios', 'channel:os', 'channel:agenda', 'permission', 'ask']);
});
test('Expo Go and simulators do not import native push or request permission', async () => {
  for (const options of [{ expoGo: true }, { simulator: true }]) {
    const f = fixture(options);
    assert.equal(f.push.supportsRemotePush(), false);
    await assert.rejects(f.push.preparePushRegistration(true), /APK atualizado/);
    assert.equal(f.calls.length, 0);
  }
});
test('provider errors are safe and actionable, without exposing native details', async () => {
  const f = fixture({ tokenFailure: true });
  await assert.rejects(f.push.preparePushRegistration(false), error => /Firebase/.test(error.message) && !/secret/.test(error.message));
});
test('legacy raffle tap opens Sorteios, records once and cleans listeners on logout', async () => {
  const response = { notification: { request: { identifier: 'fixture-notification', content: { data: { type: 'raffle', deliveryId: 7 } } } } };
  const f = fixture({ last: response, enabled: false }); let opens = 0;
  f.push.useRafflePush(true, { onInbox() {}, onOpen(screen) { assert.equal(screen, 'sorteios'); opens++; } });
  await settle(); await settle();
  assert.equal(opens, 1);
  f.listeners.response(response);
  assert.equal(opens, 1);
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'open').length, 1);
  assert.equal(f.calls.includes('token'), false, 'No registration without opt-in');
  f.cleanup();
  assert.equal(f.listeners.response, undefined); assert.equal(f.listeners.appstate, undefined);
});
test('foreground revalidates opted-in token; no background polling', async () => {
  const f = fixture();
  f.push.useRafflePush(true, { onInbox() {}, onOpen() {} }); await settle(); await settle();
  const baseline = f.calls.filter(call => Array.isArray(call) && call[0] === 'save').length;
  assert.equal(baseline, 1);
  f.listeners.appstate('background'); await settle();
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'save').length, baseline);
  f.listeners.appstate('active'); await settle(); await settle();
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'save').length, baseline + 1);
  f.cleanup();
});
test('automatic token refresh cannot override an opt-out while token registration is pending', async () => {
  let release;
  const tokenGate = new Promise(resolve => { release = resolve; });
  const f = fixture({ tokenGate });
  let lastEnabled;
  f.push.useRafflePush(true, { onInbox(presence) { lastEnabled = presence.push.enabled; }, onOpen() {} });
  await settle();
  assert.ok(f.calls.includes('token'), 'Automatic refresh is waiting for the token');
  f.optOut();
  release();
  await settle(); await settle();
  const registration = f.calls.find(call => Array.isArray(call) && call[0] === 'save')[2];
  assert.equal(registration.refreshOnly, true, 'Server receives maintenance intent, not renewed consent');
  assert.equal(f.isEnabled(), false); assert.equal(lastEnabled, false);
  f.cleanup();
});
test('logged-out app does not subscribe or touch customer presence', async () => {
  const f = fixture(); f.push.useRafflePush(false, { onInbox() { throw Error(); }, onOpen() { throw Error(); } });
  await settle(); assert.equal(f.calls.length, 0); assert.equal(Object.keys(f.listeners).length, 0);
});

function response(type, identifier = String(type), deliveryId = 7) {
  return { notification: { request: { identifier, content: { data: { type, deliveryId, screen: 'conta', url: 'https://invalid.example/untrusted' } } } } };
}
test('notification types alone select allowlisted screens for cold and warm opens', async () => {
  for (const [type, screen] of [['raffle', 'sorteios'], ['service_order', 'os'], ['appointment', 'agenda']]) {
    const item = response(type), opened = [];
    const f = fixture({ enabled: false, last: item });
    f.push.useRafflePush(true, { onInbox() {}, onOpen: target => opened.push(target) });
    await settle(); await settle();
    assert.deepEqual(opened, [screen], 'Payload screen and URL cannot control navigation');
    f.listeners.response(item);
    assert.deepEqual(opened, [screen], 'The initial response is consumed once');
    f.listeners.response(response(type, 'second-' + type, 8));
    assert.deepEqual(opened, [screen, screen]);
    assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'open'), [['open', 7], ['open', 8]]);
    f.cleanup();
  }
});
test('unknown types are neither displayed nor routed nor refreshed; known types can appear in foreground', async () => {
  const f = fixture({ enabled: false }), opened = [];
  f.push.useRafflePush(true, { onInbox() {}, onOpen: target => opened.push(target) });
  await settle(); await settle();
  const baseline = f.inboxLoads();
  for (const type of ['unknown', '__proto__', 'constructor', 'https://invalid.example', null, {}, ['raffle']]) {
    const item = response(type);
    const behavior = await f.listeners.handler.handleNotification(item.notification);
    assert.equal(behavior.shouldShowBanner, false);
    assert.equal(behavior.shouldShowList, false);
    assert.equal(behavior.shouldPlaySound, false);
    f.listeners.response(item);
    f.listeners.received(item.notification);
  }
  assert.deepEqual(opened, []);
  assert.equal(f.inboxLoads(), baseline);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'open'), false);
  for (const type of ['raffle', 'service_order', 'appointment']) {
    const behavior = await f.listeners.handler.handleNotification(response(type).notification);
    assert.equal(behavior.shouldShowBanner, true);
    assert.equal(behavior.shouldShowList, true);
    assert.equal(behavior.shouldPlaySound, true);
    assert.equal(behavior.shouldSetBadge, false);
  }
  f.cleanup();
});
test('token maintenance refreshes exactly the opted-in scopes with one shared token and no permission prompt', async () => {
  for (const [enabled, serviceEnabled, scopes] of [[false, false, []], [true, false, ['raffles']], [false, true, ['services']], [true, true, ['raffles', 'services']]]) {
    const f = fixture({ enabled, serviceEnabled });
    f.push.useRafflePush(true, { onInbox() {}, onOpen() {} });
    await settle(); await settle();
    const saves = f.calls.filter(call => Array.isArray(call) && call[0] === 'save');
    assert.deepEqual(saves.map(call => call[2].scope), scopes);
    assert.ok(saves.every(call => call[1] === undefined && call[2].refreshOnly === true));
    assert.equal(f.calls.filter(call => call === 'token').length, scopes.length ? 1 : 0);
    assert.equal(f.calls.includes('ask'), false);
    assert.ok(saves.every(call => call[2].token === 'ExpoPushToken[fixture-not-real]'));
    f.cleanup();
  }
});
test('revoking either scope during token registration wins without changing the other scope', async () => {
  for (const revoked of ['raffles', 'services']) {
    let release;
    const tokenGate = new Promise(resolve => { release = resolve; });
    const f = fixture({ enabled: true, serviceEnabled: true, tokenGate });
    f.push.useRafflePush(true, { onInbox() {}, onOpen() {} });
    await settle();
    f.listeners.token();
    f.listeners.appstate('active');
    assert.equal(f.calls.filter(call => call === 'token').length, 1, 'Concurrent refresh requests do not obtain duplicate tokens');
    f.optOut(revoked);
    release();
    await settle(); await settle();
    assert.equal(f.isEnabled(revoked), false);
    assert.equal(f.isEnabled(revoked === 'raffles' ? 'services' : 'raffles'), true);
    assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'save').length, 2);
    f.cleanup();
  }
});
test('a revocation between scope saves wins, and a failed scope does not block the other', async () => {
  const options = { enabled: true, serviceEnabled: true };
  const f = fixture(options);
  options.onSave = scope => { if (scope === 'raffles') f.optOut('services'); };
  f.push.useRafflePush(true, { onInbox() {}, onOpen() {} });
  await settle(); await settle();
  assert.equal(f.isEnabled('raffles'), true);
  assert.equal(f.isEnabled('services'), false);
  f.cleanup();
  const failing = fixture({ enabled: true, serviceEnabled: true, saveFailures: ['raffles'] });
  failing.push.useRafflePush(true, { onInbox() {}, onOpen() {} });
  await settle(); await settle();
  assert.deepEqual(failing.calls.filter(call => Array.isArray(call) && call[0] === 'save').map(call => call[2].scope), ['raffles', 'services']);
  failing.cleanup();
});
test('revoked system permission disables opted-in scopes without obtaining a token or asking again', async () => {
  const f = fixture({ enabled: true, serviceEnabled: true, granted: false });
  f.push.useRafflePush(true, { onInbox() {}, onOpen() {} });
  await settle(); await settle();
  assert.equal(f.calls.includes('token'), false);
  assert.equal(f.calls.includes('ask'), false);
  assert.equal(f.isEnabled('raffles'), false);
  assert.equal(f.isEnabled('services'), false);
  f.cleanup();
});
test('logout during token registration prevents later saves, callbacks and foreground display', async () => {
  let release;
  const tokenGate = new Promise(resolve => { release = resolve; });
  const f = fixture({ enabled: true, serviceEnabled: true, tokenGate }), opened = [];
  f.push.useRafflePush(true, { onInbox() {}, onOpen: screen => opened.push(screen) });
  await settle();
  const lateResponse = f.listeners.response, handler = f.listeners.handler;
  f.cleanup(); release();
  await settle(); await settle();
  lateResponse(response('appointment'));
  assert.deepEqual(opened, []);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'save'), false);
  assert.equal((await handler.handleNotification(response('service_order').notification)).shouldShowBanner, false);
  assert.equal(f.listeners.token, undefined);
});
test('scope opt-out dismisses only its own presented notifications while logout clears all', async () => {
  const presented = ['raffle', 'service_order', 'appointment', 'unknown'].map(type => response(type).notification);
  for (const [scope, expected] of [['raffles', ['raffle']], ['services', ['service_order', 'appointment']]]) {
    const f = fixture({ presented, last: response('appointment') });
    await f.push.dismissRaffleNotifications(scope);
    assert.deepEqual(f.calls.filter(call => Array.isArray(call)).map(call => call[1]), expected);
    assert.equal(f.calls.includes('dismiss'), false);
    assert.equal(f.calls.includes('clear-response'), scope === 'services');
  }
  const f = fixture({ presented });
  await f.push.dismissRaffleNotifications();
  assert.deepEqual(f.calls, ['dismiss', 'clear-response']);
});

function sessionFixture(options = {}) {
  const calls = [], requests = [];
  const stored = new Map([
    ['lz_games_box_token', 'synthetic-box-token'], ['lz_games_core_token', 'synthetic-core-token'],
    ['lz_games_installation_id', 'synthetic-installation-identifier-32'],
  ]);
  const modules = {
    'expo-secure-store': {
      getItemAsync: async key => stored.get(key) ?? null,
      setItemAsync: async (key, value) => { stored.set(key, value); },
      deleteItemAsync: async key => { calls.push('delete:' + key); stored.delete(key); },
    },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: 'fixture' } } },
    'react-native': { Platform: { OS: 'android' } },
  };
  const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const context = {
    exports: {}, process: { env: {} },
    require: name => { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: async (url, init) => {
      const path = new URL(url).pathname;
      calls.push(path);
      assert.ok(['/api/app/device', '/api/app/device/unlink', '/api/mobile/v1/auth/logout'].includes(path), 'Unexpected network operation: ' + path);
      if (path === '/api/app/device') {
        requests.push(JSON.parse(init.body));
        if (options.deviceGate) await options.deviceGate;
        return { status: 200, ok: true, json: async () => ({ data: { linked: true, push: { enabled: false, serviceEnabled: true } } }) };
      }
      if (path === '/api/app/device/unlink' && options.offline) throw new Error('Synthetic network failure');
      const status = path === '/api/app/device/unlink' ? (options.status ?? 200) : 200;
      return { status, ok: status >= 200 && status < 300, json: async () => {
        if (options.invalidJson && path === '/api/app/device/unlink') throw new Error('Synthetic invalid JSON');
        return status === 200 ? { ok: true } : { error: 'Synthetic rejection' };
      } };
    },
  };
  vm.runInNewContext(compiled, context);
  return { api: context.exports, calls, stored, requests };
}

test('device API preserves services scope and maintenance intent while legacy raffle payloads stay compatible', async () => {
  const f = sessionFixture();
  const service = { scope: 'services', enabled: true, permission: 'granted', token: 'synthetic-shared-token', refreshOnly: true };
  const legacy = { enabled: false, permission: 'undetermined', token: null };
  const [presence] = await Promise.all([f.api.syncRafflePresence(undefined, service), f.api.syncRafflePresence(undefined, legacy)]);
  assert.equal(presence.push.serviceEnabled, true);
  assert.deepEqual(f.requests.map(request => request.push), [service, legacy]);
  assert.ok(f.requests.every(request => !('marketingOptIn' in request)));
  assert.ok(f.requests.every(request => request.installationId === 'synthetic-installation-identifier-32'));
  assert.equal(f.requests[1].push.scope, undefined, 'Omitted scope preserves the legacy raffles contract');
});
test('logout waits for a pending services update and rejects maintenance queued after revocation starts', async () => {
  let release;
  const deviceGate = new Promise(resolve => { release = resolve; });
  const f = sessionFixture({ deviceGate });
  const saving = f.api.syncRafflePresence(undefined, { scope: 'services', enabled: true, permission: 'granted', token: 'synthetic-token' });
  await settle();
  assert.equal(f.requests.length, 1);
  const leaving = f.api.logout();
  const late = f.api.syncRafflePresence(undefined, { scope: 'services', enabled: true, permission: 'granted', token: 'synthetic-token', refreshOnly: true });
  const rejected = assert.rejects(late, /Saindo da conta/);
  assert.equal(f.calls.includes('/api/app/device/unlink'), false);
  release();
  await saving; await leaving; await rejected;
  assert.equal(f.requests.length, 1, 'No registration request may recreate an unlinked installation');
  assert.equal(await f.api.hasSession(), false);
});

test('logout unlinks remotely before removing local credentials', async () => {
  const f = sessionFixture();
  const result = await f.api.logout();
  assert.equal(result.remoteUnlinked, true);
  assert.equal(await f.api.hasSession(), false);
  assert.equal(f.calls[0], '/api/app/device/unlink');
  assert.ok(f.stored.has('lz_games_installation_id'), 'Installation id persists between logins');
});
test('expired/revoked sessions can exit locally without falsely confirming remote unlink', async () => {
  for (const options of [{ status: 401 }, { status: 403 }, { status: 401, invalidJson: true }]) {
    const f = sessionFixture(options);
    const result = await f.api.logout();
    assert.equal(result.remoteUnlinked, false);
    assert.equal(await f.api.hasSession(), false);
  }
});
test('offline/server-failed logout retains credentials and can be retried', async () => {
  for (const options of [{ offline: true }, { status: 503 }]) {
    const f = sessionFixture(options);
    await assert.rejects(f.api.logout());
    assert.equal(await f.api.hasSession(), true);
    assert.equal(f.calls.some(call => call.startsWith('delete:')), false);
    options.offline = false; options.status = 200;
    const result = await f.api.logout();
    assert.equal(result.remoteUnlinked, true);
    assert.equal(await f.api.hasSession(), false);
  }
});
