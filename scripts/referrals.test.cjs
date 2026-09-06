const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = filename => ts.transpileModule(fs.readFileSync(require.resolve(filename), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const apiCode = compile('../src/api.ts');
const uiCode = compile('../src/ReferralRewards.tsx');
class HistoryDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-09-05T15:00:00Z'])); }
  static now() { return new Date('2026-09-05T15:00:00Z').getTime(); }
}
const historyContext = { exports: {}, Date: HistoryDate, Intl };
vm.runInNewContext(compile('../src/referralHistory.ts'), historyContext);
const historyModel = historyContext.exports;
const entryContext={exports:{},Error};
vm.runInNewContext(compile('../src/referralEntry.ts'),entryContext);
const {completeReferralEntry}=entryContext.exports;
const code = 'LZsynthetic_fixture.signature_fixture';
const link = 'https://app.lzgames.com.br/?ref=' + code;
const tiers = [
  { id: 'base', label: 'Inicial', threshold: 0, percent: 0, description: 'Regras iniciais da loja.' },
  { id: 'partner', label: 'Parceiro', threshold: 7, percent: 4, description: 'Benefício sujeito à aprovação da loja.' },
  { id: 'gold', label: 'Especial', threshold: 12, percent: 9, description: 'Condições informadas pela loja.' },
];
const clone = value => JSON.parse(JSON.stringify(value));
function wireData() {
  return {
    summary: { ok: true, data: {
      indicacoes_total: '4', indicacoes_pendentes: 2, indicacoes_concluidas: 1, indicacoes_canceladas: 1,
      indicacoes_validas: '3', cashback_aprovado_centavos: '1250',
      referral_program: { tiers: clone(tiers).reverse(), current_tier: clone(tiers[0]) },
    } },
    list: { ok: true, data: [{
      id: 17, nome_indicado: 'Ana Pereira Silva', status: 'pendente', cashback_valor_centavos: '1250',
      created_at: '2026-09-05 12:00:00', updated_at: '2026-09-05 12:00:00',
      telefone: '82999990000', cpf: '52998224725',
    }] },
  };
}
function apiFixture(options = {}) {
  const stored = new Map(), requests = [], storageWrites = [];
  if (options.box) stored.set('lz_games_box_token', 'synthetic-box-token');
  if (options.core) stored.set('lz_games_core_token', 'synthetic-core-token');
  const data = options.data ?? wireData();
  const payloads = {
    '/api/me/referrals/summary': data.summary,
    '/api/me/referrals/list': data.list,
    '/api/me/referrals/link': { ok: true, data: { codigo_ref: code, link } },
    '/api/referrals/accept': { ok: true, already_registered: options.alreadyRegistered ?? false, data: { status: 'pendente' } },
    ...options.payloads,
  };
  const modules = {
    'expo-secure-store': {
      getItemAsync: async key => stored.get(key) ?? null,
      setItemAsync: async (key, value) => { storageWrites.push(['set', key]); stored.set(key, value); },
      deleteItemAsync: async key => { storageWrites.push(['delete', key]); stored.delete(key); },
    },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: 'synthetic' } } },
    'react-native': { Platform: { OS: 'android' } },
  };
  const context = {
    exports: {}, URL,
    process: { env: { EXPO_PUBLIC_CORE_API_URL: 'https://core.fixture.invalid/api', EXPO_PUBLIC_API_URL: 'https://box.fixture.invalid/api/mobile/v1' } },
    require(name) { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: async (url, init) => {
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://core.fixture.invalid', 'Every referral request uses the defined CORE API');
      assert.ok(parsed.pathname in payloads, 'Unexpected route: ' + parsed.pathname);
      requests.push({ url, ...init, body: init.body ? JSON.parse(init.body) : undefined });
      if (options.offline) throw new Error('Falha de conexão sintética.');
      const status = options.status ?? 200;
      return { status, ok: status >= 200 && status < 300, json: async () => {
        if (options.invalidJson) throw new Error('Synthetic malformed JSON');
        return status === 200 ? payloads[parsed.pathname] : { error: { message: 'Falha sintética no programa.' } };
      } };
    },
  };
  vm.runInNewContext(apiCode, context, { filename: 'api.ts' });
  return { api: context.exports, requests, storageWrites, stored };
}

test('APK client accepts server-controlled single-tier 5% without deriving a rate from referral count', async () => {
  const data=wireData();
  const tier={id:'service5_note_total_v1',threshold:0,label:'Indicação de serviço',percent:5,description:'5% do valor total da nota. Crédito quando a OS for Finalizada.'};
  data.summary.data.indicacoes_validas=0;
  data.summary.data.referral_program={tiers:[tier],current_tier:tier,based_on:'os_finalizada_total_nota'};
  const f=apiFixture({core:true,data});
  const result=await f.api.loadReferralRewards();
  assert.equal(result.summary.currentTier.percent,5);
  assert.equal(result.summary.tiers.length,1);
  assert.equal(result.summary.valid,0);
  assert.equal(result.summary.approvedCents,1250);
});

test('App credit is strictly services-only and never mixed with approved service cashback',async()=>{
  const data=wireData();
  const credit={rule_version:'app_first_use_990_v1',bonus_centavos:990,creditos_acumulados_centavos:1980,indicacoes_premiadas:2,usage_restriction:'services_only',withdrawable:false,redemption_enabled:false,expires:false};
  data.summary.data.app_referral_credit=credit;
  const f=apiFixture({core:true,data}),result=await f.api.loadReferralRewards();
  assert.equal(result.summary.approvedCents,1250);assert.equal(result.summary.appCredit.creditCents,1980);
  assert.equal(result.summary.appCredit.redemptionEnabled,false);
  data.summary.data.app_referral_credit={...credit,redemption_enabled:true,creditos_utilizados_centavos:990,saldo_disponivel_centavos:990};
  const redeemed=await apiFixture({core:true,data}).api.loadReferralRewards();
  assert.equal(redeemed.summary.appCredit.availableCents,990);assert.equal(redeemed.summary.appCredit.usedCents,990);
  for(const bad of [{withdrawable:true},{creditos_acumulados_centavos:999},{usage_restriction:'cash'},{bonus_centavos:1000},{expires:true},
    {redemption_enabled:true},{creditos_utilizados_centavos:990,saldo_disponivel_centavos:1980},{creditos_utilizados_centavos:1990,saldo_disponivel_centavos:0}]){
    data.summary.data.app_referral_credit={...credit,...bad};
    await assert.rejects(()=>apiFixture({core:true,data}).api.loadReferralRewards());
  }
});

test('Separate credit UI states no withdrawal and no retroactive bonus; it does not invent a redemption action',async()=>{
  const data=rewardsData();data.summary.appCredit={bonusCents:990,creditCents:1980,rewardCount:2,redemptionEnabled:false};
  const f=uiFixture({data});f.render();await settle();const tree=f.render();
  assert.match(content(byId(tree,'referrals-app-credit')),/19,80/);
  assert.match(content(byId(tree,'referrals-approved')),/12,50/);
  assert.match(content(tree),/sem saque/);assert.match(content(tree),/temporariamente indisponíveis/);
  assert.match(content(tree),/não gera esse bônus retroativamente/);
  assert.equal(nodes(tree).some(n=>n.type==='Pressable'&&/sacar|resgatar/i.test(content(n))),false);
});

test('After redemption the app shows available, earned and used amounts separately, without a cash withdrawal button',async()=>{
  const data=rewardsData();data.summary.appCredit={bonusCents:990,creditCents:1980,rewardCount:2,redemptionEnabled:true,usedCents:990,availableCents:990};
  const f=uiFixture({data});f.render();await settle();const tree=f.render();
  assert.match(content(byId(tree,'referrals-app-credit')),/9,90/);
  assert.match(content(byId(tree,'referrals-app-credit-usage')),/Acumulado:.*19,80.*Usado nas notas:.*9,90/);
  assert.match(content(tree),/antes da conclusão ou pagamento/);assert.match(content(tree),/produtos e frete não entram/);
  assert.match(content(byId(tree,'referrals-approved')),/12,50/);
  const players=nodes(tree).filter(node=>node.type==='CardLottie');
  assert.deepEqual(players.map(node=>node.props.kind),['appCredit','cashback','invite']);
  assert.ok(nodes(byId(tree,'referrals-approved-value-row')).some(node=>node.props.kind==='cashback'));
  assert.ok(nodes(byId(tree,'referrals-app-credit-value-row')).some(node=>node.props.kind==='appCredit'));
  assert.ok(nodes(byId(tree,'referrals-invite-heading')).some(node=>node.props.kind==='invite'));
});

test('Explicit entry binds the invitation BEFORE opening home/push and retries without creating the account twice',async()=>{
  const state={authenticated:false,busy:false},calls=[];let failing=true;
  const actions={validate:v=>{calls.push('validate');return v;},authenticate:async()=>calls.push('register'),onAuthenticated:()=>calls.push('ready'),
    bind:async()=>{calls.push('bind');if(failing)throw new Error('network fixture');},open:async()=>{calls.push('home/presence');return true;}};
  await assert.rejects(()=>completeReferralEntry(state,code,actions));
  assert.equal(state.authenticated,true);assert.equal(state.busy,false);assert.equal(calls.includes('home/presence'),false);
  failing=false;assert.equal(await completeReferralEntry(state,code,actions),true);
  assert.deepEqual(calls,['validate','register','ready','bind','validate','bind','home/presence']);
  assert.equal(state.authenticated,false);
});

test('Entry invalid invitations, double taps and home failures do not create duplicate users or consume first use early',async()=>{
  const state={authenticated:false,busy:false},calls=[],gate=deferred();
  const actions={validate:v=>{if(v==='invalid')throw new Error('bad code');return v;},authenticate:async()=>{calls.push('login');await gate.promise;},onAuthenticated:()=>{},
    bind:async()=>calls.push('bind'),open:async()=>{calls.push('home');return false;}};
  await assert.rejects(()=>completeReferralEntry(state,'invalid',actions));assert.equal(calls.length,0);
  const pending=completeReferralEntry(state,code,actions);
  assert.equal(await completeReferralEntry(state,code,actions),false);
  gate.resolve();await assert.rejects(()=>pending);assert.equal(state.authenticated,true);
  actions.open=async()=>true;assert.equal(await completeReferralEntry(state,'',actions),true);
  assert.deepEqual(calls,['login','bind','home']);
  const f=apiFixture();assert.equal(f.api.validateReferralInvite(link),code);assert.equal(f.requests.length,0);
});
function rewardsData(count = 1) {
  return {
    summary: { total: 4, pending: 2, completed: 1, cancelled: 1, valid: 3, approvedCents: 1250, tiers: clone(tiers), currentTier: clone(tiers[0]) },
    items: Array.from({ length: count }, (_, index) => ({
      id: String(index + 1), name: 'Ana Pereira Silva', status: 'pendente', cashbackCents: 1250,
      createdAt: '2026-09-05 12:00:00', updatedAt: '2026-09-05 12:00:00',
    })),
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
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
function byId(tree, id) {
  return nodes(tree).find(node => node.props.testID === id);
}
const settle = () => new Promise(resolve => setImmediate(resolve));

// Real effects/handlers and JSX with persistent hook slots. All transports,
// native sharing and alerts are inert fixtures; this is not a native UI test.
function uiFixture(options = {}) {
  const hooks = [], pending = [], calls = [], alerts = [];
  let cursor = 0, unmounted = false, updatesAfterUnmount = 0, refreshKey;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef(value) { return hooks[cursor++] ??= { current: value }; },
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, value => {
        if (unmounted) updatesAfterUnmount++;
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
      }];
    },
    useEffect(callback, deps) {
      const index = cursor++, previous = hooks[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        pending.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const modules = {
    react,
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View'].map(name => [name, name])),
      StyleSheet: { create: styles => styles },
      Alert: { alert: (...args) => { alerts.push(args); } },
      Share: { dismissedAction: 'dismissedAction', sharedAction: 'sharedAction', share: async value => {
        calls.push(['share', value]);
        if (options.shareError) throw options.shareError;
        if (options.shareGate) await options.shareGate;
        return { action: options.shareAction ?? 'sharedAction' };
      } },
    },
    './effects/Neon': { NeonCard: 'NeonCard' },
    './effects/CardLottie': { CardLottie: 'CardLottie' },
    './referralHistory': historyModel,
    './api': {
      loadReferralRewards: async () => {
        calls.push(['load']);
        if (options.load) return options.load();
        if (options.loadError) throw options.loadError;
        return options.data ?? rewardsData();
      },
      createReferralInvite: async () => {
        calls.push(['create']);
        if (options.createGate) await options.createGate;
        if (options.createError) throw options.createError;
        return { code, link };
      },
      acceptReferralInvite: async value => {
        calls.push(['accept', value]);
        if (options.acceptGate) await options.acceptGate;
        if (options.acceptError) throw options.acceptError;
        return { alreadyRegistered: options.alreadyRegistered ?? false, status: 'pendente' };
      },
    },
  };
  const context = {
    exports: {}, Error,
    require(name) { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: () => assert.fail('Unexpected network request'),
    setTimeout: () => assert.fail('Unexpected timer'),
  };
  vm.runInNewContext(uiCode, context, { filename: 'ReferralRewards.tsx' });
  return {
    calls, alerts,
    render(nextKey = refreshKey) {
      refreshKey = nextKey; cursor = 0;
      const tree = context.exports.ReferralRewards({ refreshKey });
      pending.splice(0).forEach(effect => effect());
      return tree;
    },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); unmounted = true; },
    updatesAfterUnmount: () => updatesAfterUnmount,
  };
}

test('CORE-only, BOX-only and dual sessions load the canonical program with the correct identity', async () => {
  for (const session of [{ core: true }, { box: true }, { core: true, box: true }]) {
    const f = apiFixture(session), result = await f.api.loadReferralRewards();
    assert.equal(f.requests.length, 2);
    assert.ok(f.requests.some(request => request.url.endsWith('/me/referrals/list?days=365')));
    assert.ok(f.requests.every(request => (request.method ?? 'GET') === 'GET'));
    assert.ok(f.requests.every(request => request.headers['X-LZ-Identity-Provider'] === (session.box ? 'box' : 'core')));
    assert.ok(f.requests.every(request => request.headers.Authorization === (session.box ? 'Bearer synthetic-box-token' : 'Bearer synthetic-core-token')));
    assert.equal(result.summary.approvedCents, 1250);
    assert.equal(result.summary.valid, 3);
    assert.deepEqual(Array.from(result.summary.tiers, tier => tier.threshold), [0, 7, 12]);
    assert.equal(result.items[0].id, '17');
    assert.equal(result.items[0].name, 'Ana Pereira Silva');
    assert.equal(result.items[0].cashbackCents, 1250);
    assert.equal(result.items[0].telefone, undefined);
    assert.equal(result.items[0].cpf, undefined);
    assert.deepEqual(f.storageWrites, []);
  }
});

test('missing sessions never load, generate or accept invitations', async () => {
  const f = apiFixture();
  for (const operation of [() => f.api.loadReferralRewards(), () => f.api.createReferralInvite(), () => f.api.acceptReferralInvite(code)]) {
    await assert.rejects(operation(), /sessão terminou/);
  }
  assert.equal(f.requests.length, 0);
  assert.deepEqual(f.storageWrites, []);
});

test('HTTP, connectivity and malformed JSON errors never switch providers or alter the session', async () => {
  for (const failure of [{ status: 401 }, { status: 503 }, { offline: true }, { invalidJson: true }]) {
    for (const method of ['loadReferralRewards', 'createReferralInvite', 'acceptReferralInvite']) {
      const f = apiFixture({ core: true, box: true, ...failure });
      await assert.rejects(f.api[method](code));
      assert.equal(f.requests.length, method === 'loadReferralRewards' ? 2 : 1);
      assert.ok(f.requests.every(request => request.headers['X-LZ-Identity-Provider'] === 'box'));
      assert.deepEqual(f.storageWrites, []);
    }
  }
});

test('invalid counts, rules and history fail explicitly instead of producing zero totals', async () => {
  const mutations = [
    data => { data.summary.data.cashback_aprovado_centavos = null; },
    data => { data.summary.data.indicacoes_validas = -1; },
    data => { data.summary.data.indicacoes_total = 'four'; },
    data => { data.summary.data.referral_program.tiers = []; },
    data => { data.summary.data.referral_program.current_tier.percent = 101; },
    data => { data.summary.data.referral_program.current_tier.id = 'unknown'; },
    data => { data.list.data[0].id = 'arbitrary-resource'; },
    data => { data.list.data[0].cashback_valor_centavos = -2; },
    data => { data.list.data[0].status = null; },
  ];
  for (const mutate of mutations) {
    const data = wireData(); mutate(data);
    const f = apiFixture({ core: true, data });
    await assert.rejects(f.api.loadReferralRewards());
  }
  const empty = wireData(); empty.list.data = [];
  assert.equal((await apiFixture({ core: true, data: empty }).api.loadReferralRewards()).items.length, 0);
});

test('official referral links and raw codes submit only the validated code after explicit acceptance', async () => {
  for (const input of [code, ' ' + code + ' ', ...['app.lzgames.com.br', 'clientes.lzgames.com.br', 'clientes.lzgames.com'].map(host => 'https://' + host + '/?ref=' + code)]) {
    const f = apiFixture({ core: true, alreadyRegistered: true });
    const result = await f.api.acceptReferralInvite(input);
    assert.equal(result.alreadyRegistered, true);
    assert.equal(result.status, 'pendente');
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].method, 'POST');
    assert.deepEqual(f.requests[0].body, { codigo_ref: code });
  }
});

test('foreign URLs, credentials, ports and malformed codes never generate acceptance requests', async () => {
  for (const input of ['', 'plain-code', 'LZpayload', 'javascript:alert(1)', '//app.lzgames.com.br/?ref=' + code,
    'http://app.lzgames.com.br/?ref=' + code, 'https://app.lzgames.com.br.evil.invalid/?ref=' + code,
    'https://evil.invalid/?ref=' + code, 'https://user:password@app.lzgames.com.br/?ref=' + code,
    'https://app.lzgames.com.br:8443/?ref=' + code, 'https://app.lzgames.com.br/?other=' + code, 'x'.repeat(2049)]) {
    const f = apiFixture({ core: true });
    await assert.rejects(f.api.acceptReferralInvite(input));
    assert.equal(f.requests.length, 0);
  }
});

test('generated invitations must contain an official HTTPS link matching the supplied code', async () => {
  const valid = apiFixture({ box: true });
  const result = await valid.api.createReferralInvite();
  assert.equal(result.code, code); assert.equal(result.link, link);
  assert.equal(valid.requests.length, 1);
  assert.equal(valid.requests[0].method, 'POST');
  assert.deepEqual(valid.requests[0].body, {});
  for (const badLink of ['https://evil.invalid/?ref=' + code, 'https://app.lzgames.com.br/?ref=LZother.other', 'http://app.lzgames.com.br/?ref=' + code]) {
    const f = apiFixture({ core: true, payloads: { '/api/me/referrals/link': { ok: true, data: { codigo_ref: code, link: badLink } } } });
    await assert.rejects(f.api.createReferralInvite());
    assert.equal(f.requests.length, 1);
  }
});

test('initial loading and errors never display fabricated zero rewards, and retry loads the real values', async () => {
  const options = { loadError: new Error('Falha sintética de consulta.') }, f = uiFixture(options);
  assert.equal(byId(f.render(), 'referrals-approved'), undefined);
  await settle();
  let tree = f.render();
  assert.equal(byId(tree, 'referrals-approved'), undefined);
  assert.match(content(byId(tree, 'referrals-load-error')), /Falha sintética/);
  assert.deepEqual(f.calls, [['load']]);
  options.loadError = null;
  byId(tree, 'referrals-retry').props.onPress();
  await settle(); tree = f.render();
  assert.match(content(byId(tree, 'referrals-approved')), /12,50/);
  assert.match(content(tree), /Total histórico aprovado/);
  assert.equal(f.calls.some(call => ['create', 'share', 'accept'].includes(call[0])), false);
});

test('progress uses canonical valid referrals and dynamic server tiers instead of completed totals or fixed percentages', async () => {
  const f = uiFixture(); f.render(); await settle();
  const tree = f.render(), progress = byId(tree, 'referrals-progress');
  assert.equal(progress.props.accessibilityValue.now, 3);
  assert.equal(progress.props.accessibilityValue.max, 7);
  assert.match(content(tree), /Parceiro · 4%/);
  assert.match(content(tree), /Faltam 4 indicações válidas/);
  byId(tree, 'referrals-tiers').props.onPress();
  assert.match(content(f.render()), /Especial · 9% · 12 válidas/);
});

test('history starts with five completed entries, expands to at most 200 and abbreviates private names', async () => {
  const data = rewardsData(205); data.items.forEach(item => { item.status = 'concluida'; }); data.items[1].name = '82999990000';
  const f = uiFixture({ data }); f.render(); await settle();
  let tree = f.render();
  const entries = value => nodes(value).filter(node => /^referral-item-/.test(node.props.testID ?? ''));
  assert.equal(entries(tree).length, 5);
  assert.match(content(tree), /Ana S\./);
  assert.doesNotMatch(content(tree), /Pereira|82999990000/);
  for (let index = 0; index < 39; index++) { byId(tree, 'referrals-more').props.onPress(); tree = f.render(); }
  assert.equal(entries(tree).length, 200);
  assert.equal(byId(tree, 'referrals-more'), undefined);
  byId(tree, 'referrals-less').props.onPress();
  assert.equal(entries(f.render()).length, 5);
});

test('month defaults to Maceió and supports local SQL and timezone-aware API dates', () => {
  assert.equal(historyModel.currentHistoryMonth(new Date('2026-10-01T01:00:00Z')), '2026-09');
  assert.equal(historyModel.historyMonth('2026-09-05 12:00:00'), '2026-09');
  assert.equal(historyModel.historyMonth('2026-10-01T01:00:00Z'), '2026-09');
  assert.equal(historyModel.historyMonth('2026-13-01 12:00:00'), '');
  assert.equal(historyModel.historyMonth('invalid'), '');
  assert.equal(historyModel.historyMonth('2026-01-01T00:00:00+03:00'), '2025-12');
  assert.equal(historyModel.historyMonths().length, 13);
  assert.equal(historyModel.historyMonths()[0], '2026-09');
  assert.equal(historyModel.historyMonths().at(-1), '2025-09');
});

test('compact history hides pending/cancelled/previous months by default and searches without mutating records or balances', async () => {
  const data = rewardsData(5);
  data.items[0].status = 'concluída';
  data.items[1].status = 'cancelada';
  data.items[2].status = 'concluida'; data.items[2].createdAt = '2026-08-12 15:00:00'; data.items[2].name = 'João Costa';
  data.items[3].status = 'concluida'; data.items[3].createdAt = '2025-12-01 15:00:00';
  const before = JSON.stringify(data), f = uiFixture({data}); f.render(); await settle();
  let tree = f.render();
  const ids = t => nodes(t).map(n => n.props.testID).filter(id => /^referral-item-/.test(id ?? ''));
  assert.deepEqual(ids(tree), ['referral-item-1']);
  assert.equal(byId(tree, 'referrals-search'), undefined);
  assert.match(content(byId(tree, 'referrals-history-summary')), /setembro de 2026 · Concluídas · 1 registro/);
  byId(tree, 'referrals-filters').props.onPress(); tree = f.render();
  assert.equal(byId(tree, 'referrals-month-next').props.disabled, true);
  byId(tree, 'referrals-status-cancelled').props.onPress(); tree = f.render();
  assert.deepEqual(ids(tree), ['referral-item-2']);
  byId(tree, 'referrals-status-pending').props.onPress(); tree = f.render();
  assert.deepEqual(ids(tree), ['referral-item-5']);
  byId(tree, 'referrals-status-completed').props.onPress(); tree = f.render();
  byId(tree, 'referrals-month-previous').props.onPress(); tree = f.render();
  assert.deepEqual(ids(tree), ['referral-item-3']);
  byId(tree, 'referrals-search').props.onChangeText('  JOAO  '); tree = f.render();
  assert.deepEqual(ids(tree), ['referral-item-3']);
  byId(tree, 'referrals-search').props.onChangeText('nome inexistente'); tree = f.render();
  assert.ok(byId(tree, 'referrals-empty')); assert.equal(byId(tree, 'referrals-more'), undefined);
  byId(tree, 'referrals-search').props.onChangeText(''); tree = f.render();
  byId(tree, 'referrals-month-all').props.onPress(); tree = f.render();
  byId(tree, 'referrals-status-all').props.onPress(); tree = f.render();
  assert.equal(ids(tree).length, 5);
  assert.equal(byId(tree, 'referrals-month-previous').props.disabled, true);
  assert.equal(byId(tree, 'referrals-month-next').props.disabled, true);
  byId(tree, 'referrals-reset-filters').props.onPress(); tree = f.render();
  assert.deepEqual(ids(tree), ['referral-item-1']);
  assert.match(content(byId(tree, 'referrals-approved')), /12,50/);
  assert.equal(JSON.stringify(data), before); assert.deepEqual(f.calls, [['load']]);
});

test('changing filters resets pagination and preserves no-matches feedback, review and year navigation', async () => {
  const data = rewardsData(14); data.items.forEach(item => { item.status = 'completed'; });
  data.items[12].status = 'investigating'; data.items[13].createdAt = '2025-12-15T12:00:00Z';
  const f = uiFixture({data}); f.render(); await settle(); let tree = f.render();
  byId(tree, 'referrals-more').props.onPress(); tree = f.render(); assert.ok(byId(tree, 'referrals-less'));
  byId(tree, 'referrals-filters').props.onPress(); tree = f.render();
  byId(tree, 'referrals-status-review').props.onPress(); tree = f.render();
  assert.ok(byId(tree, 'referral-item-13')); assert.equal(byId(tree, 'referrals-less'), undefined);
  byId(tree, 'referrals-status-completed').props.onPress(); tree = f.render();
  for(let i = 0; i < 9; i++) { byId(tree, 'referrals-month-previous').props.onPress(); tree = f.render(); }
  assert.match(content(byId(tree, 'referrals-month-label')), /dezembro de 2025/); assert.ok(byId(tree, 'referral-item-14'));
  for(let i = 0; i < 3; i++) { byId(tree, 'referrals-month-previous').props.onPress(); tree = f.render(); }
  assert.equal(byId(tree, 'referrals-month-previous').props.disabled, true);
  byId(tree, 'referrals-month-previous').props.onPress(); tree = f.render(); assert.match(content(byId(tree, 'referrals-month-label')), /setembro de 2025/);
  byId(tree, 'referrals-month-next').props.onPress(); tree = f.render(); assert.match(content(byId(tree, 'referrals-month-label')), /outubro de 2025/);
});

test('APK invite validation accepts the new public download landing URL with the exact signed code', async () => {
  const publicLink = 'https://app.lzgames.com.br/convite/?ref=' + code;
  const f = apiFixture({core:true, payloads:{'/api/me/referrals/link':{ok:true,data:{codigo_ref:code,link:publicLink}}}});
  assert.equal(f.api.validateReferralInvite(publicLink), code);
  assert.equal((await f.api.createReferralInvite()).link, publicLink);
});

test('only a share tap generates an invite; duplicate taps and native cancellation do not send or accept anything', async () => {
  const gate = deferred(), f = uiFixture({ createGate: gate.promise, shareAction: 'dismissedAction' });
  f.render(); await settle();
  let tree = f.render();
  assert.deepEqual(f.calls, [['load']]);
  const button = byId(tree, 'referrals-share');
  const first = button.props.onPress(), duplicate = button.props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 1);
  assert.equal(byId(f.render(), 'referrals-accept').props.disabled, true);
  gate.resolve(); await first; await duplicate;
  tree = f.render();
  assert.equal(f.calls.filter(call => call[0] === 'share').length, 1);
  assert.equal(f.calls.some(call => call[0] === 'accept'), false);
  const shared = f.calls.find(call => call[0] === 'share')[1];
  assert.match(shared.message, /aprovação.*validação da loja/);
  assert.ok(shared.message.includes(link));
  assert.equal(byId(tree, 'referrals-invite-code').props.selectable, true);
  assert.equal(byId(tree, 'referrals-invite-link').props.selectable, true);
  assert.equal(byId(tree, 'referrals-action-error'), undefined);
  assert.equal(byId(tree, 'referrals-share').props.disabled, false);
  await byId(tree, 'referrals-share').props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 2, 'Every explicit new share requests a new single-use invitation');
});

test('a failed native share preserves the selectable invitation and a deliberate retry requests a fresh single-use code', async () => {
  const options = { shareError: new Error('Falha sintética ao compartilhar.') }, f = uiFixture(options);
  f.render(); await settle();
  await byId(f.render(), 'referrals-share').props.onPress();
  assert.match(content(byId(f.render(), 'referrals-action-error')), /Falha sintética/);
  assert.ok(byId(f.render(), 'referrals-invite-code'));
  options.shareError = null;
  await byId(f.render(), 'referrals-share').props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'create').length, 2);
  assert.equal(f.calls.filter(call => call[0] === 'share').length, 2);
});

test('acceptance requires confirmation; cancellation and dismissal never register an indication', async () => {
  const f = uiFixture(); f.render(); await settle();
  byId(f.render(), 'referrals-code-input').props.onChangeText(code);
  byId(f.render(), 'referrals-accept').props.onPress();
  assert.equal(f.alerts.length, 1);
  assert.equal(f.calls.some(call => call[0] === 'accept'), false);
  f.alerts[0][2][0].onPress();
  assert.equal(byId(f.render(), 'referrals-share').props.disabled, false);
  byId(f.render(), 'referrals-accept').props.onPress();
  f.alerts[1][3].onDismiss();
  assert.equal(f.calls.some(call => call[0] === 'accept'), false);
});

test('confirmed acceptance submits once, supports alreadyRegistered, and keeps success when refresh fails', async () => {
  const gate = deferred(), options = { acceptGate: gate.promise, alreadyRegistered: true }, f = uiFixture(options);
  f.render(); await settle();
  byId(f.render(), 'referrals-code-input').props.onChangeText(' ' + code + ' ');
  const button = byId(f.render(), 'referrals-accept'); button.props.onPress(); button.props.onPress();
  assert.equal(f.alerts.length, 1);
  const confirm = f.alerts[0][2][1].onPress;
  const first = confirm(), duplicate = confirm();
  assert.equal(f.calls.filter(call => call[0] === 'accept').length, 1);
  assert.equal(f.calls.find(call => call[0] === 'accept')[1], code);
  options.loadError = new Error('Falha sintética ao atualizar.');
  gate.resolve(); await first; await duplicate;
  const tree = f.render();
  assert.match(content(byId(tree, 'referrals-action-message')), /já estava vinculada/);
  assert.match(content(byId(tree, 'referrals-load-error')), /últimas informações/);
  assert.equal(byId(tree, 'referrals-code-input').props.value, '');
  assert.equal(byId(tree, 'referrals-share').props.disabled, false);
});

test('an acceptance error preserves the input and requires another explicit confirmation to retry', async () => {
  const options = { acceptError: new Error('Convite sintético inválido.') }, f = uiFixture(options);
  f.render(); await settle();
  byId(f.render(), 'referrals-code-input').props.onChangeText(code);
  byId(f.render(), 'referrals-accept').props.onPress();
  await f.alerts[0][2][1].onPress();
  assert.match(content(byId(f.render(), 'referrals-action-error')), /Convite sintético inválido/);
  assert.equal(byId(f.render(), 'referrals-code-input').props.value, code);
  options.acceptError = null;
  byId(f.render(), 'referrals-accept').props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'accept').length, 1);
  await f.alerts[1][2][1].onPress();
  assert.equal(f.calls.filter(call => call[0] === 'accept').length, 2);
  assert.match(content(byId(f.render(), 'referrals-action-message')), /Indicação registrada/);
});

test('refreshKey starts a new read and stale responses cannot replace the latest dashboard', async () => {
  const older = deferred(), newer = deferred(); let reads = 0;
  const f = uiFixture({ load: () => (++reads === 1 ? older.promise : newer.promise) });
  f.render({ id: 'first' });
  f.render({ id: 'second' });
  const newData = rewardsData(); newData.summary.approvedCents = 8700;
  newer.resolve(newData); await settle();
  assert.match(content(byId(f.render(), 'referrals-approved')), /87,00/);
  older.resolve(rewardsData()); await settle();
  assert.match(content(byId(f.render(), 'referrals-approved')), /87,00/);
  assert.equal(reads, 2);
});

test('unmount cancels UI callbacks and late load/share/accept responses cannot update or start native sharing', async () => {
  const loadGate = deferred(), loadFixture = uiFixture({ load: () => loadGate.promise });
  loadFixture.render(); loadFixture.unmount(); loadGate.resolve(rewardsData()); await settle();
  assert.equal(loadFixture.updatesAfterUnmount(), 0);

  const createGate = deferred(), shareFixture = uiFixture({ createGate: createGate.promise });
  shareFixture.render(); await settle();
  const sharing = byId(shareFixture.render(), 'referrals-share').props.onPress();
  shareFixture.unmount(); createGate.resolve(); await sharing;
  assert.equal(shareFixture.calls.some(call => call[0] === 'share'), false);
  assert.equal(shareFixture.updatesAfterUnmount(), 0);

  const acceptGate = deferred(), acceptFixture = uiFixture({ acceptGate: acceptGate.promise });
  acceptFixture.render(); await settle();
  byId(acceptFixture.render(), 'referrals-code-input').props.onChangeText(code);
  byId(acceptFixture.render(), 'referrals-accept').props.onPress();
  const accepting = acceptFixture.alerts[0][2][1].onPress();
  acceptFixture.unmount(); acceptGate.resolve(); await accepting;
  assert.equal(acceptFixture.calls.filter(call => call[0] === 'load').length, 1);
  assert.equal(acceptFixture.updatesAfterUnmount(), 0);

  const dismissed = uiFixture(); dismissed.render(); await settle();
  byId(dismissed.render(), 'referrals-code-input').props.onChangeText(code);
  byId(dismissed.render(), 'referrals-accept').props.onPress(); dismissed.unmount();
  await dismissed.alerts[0][2][1].onPress();
  assert.equal(dismissed.calls.some(call => call[0] === 'accept'), false);
});
