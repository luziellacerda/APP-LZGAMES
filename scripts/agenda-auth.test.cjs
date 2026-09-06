const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = source => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  },
}).outputText;
const input = {
  serviceId: 17, sectorId: 4, date: '2030-04-10', start: '10:00',
  document: '529.982.247-25', // Synthetic CPF fixture, never sent to a server.
};

function apiFixture(options = {}) {
  const stored = new Map();
  if (options.core) stored.set('lz_games_core_token', 'synthetic-core-token');
  if (options.box) stored.set('lz_games_box_token', 'synthetic-box-token');
  const requests = [];
  const modules = {
    'expo-secure-store': {
      getItemAsync: async key => stored.get(key) ?? null,
      setItemAsync: async (key, value) => { stored.set(key, value); },
      deleteItemAsync: async key => { stored.delete(key); },
    },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: 'synthetic' } } },
    'react-native': { Platform: { OS: 'android' } },
  };
  const context = {
    exports: {},
    process: { env: {
      EXPO_PUBLIC_API_URL: 'https://box.fixture.invalid/api/mobile/v1',
      EXPO_PUBLIC_CORE_API_URL: 'https://core.fixture.invalid/api',
    } },
    require(name) { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: async (url, init) => {
      requests.push({ url, ...init, body: init?.body ? JSON.parse(init.body) : undefined });
      if (options.gate) await options.gate;
      if (options.offline) throw new Error('Falha de conexão sintética.');
      const status = options.status ?? 200;
      return {
        status, ok: status >= 200 && status < 300,
        json: async () => {
          if (options.invalidJson) throw new Error('Synthetic invalid JSON');
          if (new URL(url).pathname === '/api/auth/register') {
            return { token: 'synthetic-core-issued', user: options.authUser ?? { id: 9, nome: 'Cliente sintético', cpf: input.document } };
          }
          if ('payload' in options) return options.payload;
          return status === 200 ? { ok: true, data: { ok: true, protocolo: 'SYNTHETIC-BOOKING-1', notificacao: 'enviado' } } : { error: { message: options.message ?? 'Não foi possível reservar o horário sintético.' } };
        },
      };
    },
  };
  vm.runInNewContext(compile(fs.readFileSync(require.resolve('../src/api.ts'), 'utf8')), context, { filename: 'api.ts' });
  return { api: context.exports, requests, stored };
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
  if (typeof tree === 'string') return tree;
  return tree && typeof tree === 'object' ? content(tree.props.children) : '';
}
function confirmButton(tree) {
  return nodes(tree).find(node => node.type === 'Pressable' && node.props.onPress?.name === 'confirm');
}

// Real AgendaBooking JSX and confirmation handler, with inert effects so service
// discovery and its 14-day availability scan cannot touch an actual backend.
function uiFixture(options = {}) {
  const filename = require.resolve('../src/AgendaBooking.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'AgendaBooking');
  assert.ok(component?.body);
  const stateNames = component.body.statements.flatMap(statement => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.flatMap(declaration => {
      if (!ts.isArrayBindingPattern(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer) || declaration.initializer.expression.getText(parsed) !== 'useState') return [];
      return [declaration.name.elements[0].name.getText(parsed)];
    });
  });
  const service = { id: 17, setor_id: 4, nome: 'Serviço sintético', duracao_min: 60, preco_brl: '0.00' };
  const slot = { inicio: '10:00', fim: '11:00', ocupado: false, profissionais_livres: 1 };
  const states = new Map(Object.entries({
    service, services: [service], slot, slots: [slot], date: input.date,
    ...options.states,
  }));
  const calls = [], refs = [];
  let cursor = 0, refCursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    Fragment: 'Fragment',
    useEffect() {},
    useMemo: compute => compute(),
    useRef: value => refs[refCursor++] ??= { current: value },
    useState(initial) {
      const name = stateNames[cursor++];
      assert.ok(name, 'State hooks must have AST-derived names');
      if (!states.has(name)) states.set(name, typeof initial === 'function' ? initial() : initial);
      return [states.get(name), value => states.set(name, typeof value === 'function' ? value(states.get(name)) : value)];
    },
  };
  const modules = {
    react,
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map(name => [name, name])),
      StyleSheet: { create: styles => styles },
    },
    './effects/Neon': { NeonCard: 'NeonCard' },
    './api': {
      loadAgendaServices: () => assert.fail('Unexpected service discovery'),
      loadAgendaSlots: () => assert.fail('Unexpected availability request'),
      bookAgenda: async value => {
        calls.push(['book', value]);
        if (options.bookingGate) await options.bookingGate;
        if (options.bookingError) throw options.bookingError;
        return options.bookingResult ?? { protocolo: 'SYNTHETIC-BOOKING-1', notificacao: 'enviado' };
      },
    },
  };
  const context = {
    exports: {}, Error,
    require(name) { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: () => assert.fail('Unexpected network request'),
    setTimeout: () => assert.fail('Unexpected timer'),
  };
  vm.runInNewContext(compile(source), context, { filename });
  return {
    calls, states,
    render() {
      cursor = 0; refCursor = 0;
      const tree = context.exports.AgendaBooking({
        document: options.document ?? input.document,
        onBooked: async appointment => {
          calls.push(['refresh', appointment]);
          if (options.refreshError) throw options.refreshError;
        },
      });
      assert.equal(cursor, stateNames.length);
      return tree;
    },
  };
}

test('BOX-only booking uses its authenticated endpoint once and preserves reservation fields', async () => {
  const f = apiFixture({ box: true });
  const result = await f.api.bookAgenda(input);
  assert.equal(result.protocolo, 'SYNTHETIC-BOOKING-1');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'https://box.fixture.invalid/api/mobile/v1/agenda/book');
  assert.equal(f.requests[0].method, 'POST');
  assert.equal(f.requests[0].headers.Authorization, 'Bearer synthetic-box-token');
  assert.equal(f.requests[0].headers['X-LZ-Identity-Provider'], 'box');
  assert.deepEqual(f.requests[0].body, input);
});

test('CORE-only customers can book through the same endpoint with an explicit CORE identity header', async () => {
  const f = apiFixture({ core: true });
  const result = await f.api.bookAgenda(input);
  assert.equal(result.protocolo, 'SYNTHETIC-BOOKING-1');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'https://box.fixture.invalid/api/mobile/v1/agenda/book');
  assert.equal(f.requests[0].method, 'POST');
  assert.equal(f.requests[0].headers.Authorization, 'Bearer synthetic-core-token');
  assert.equal(f.requests[0].headers['X-LZ-Identity-Provider'], 'core');
  assert.deepEqual(f.requests[0].body, input);
});

test('a customer with both sessions preserves the existing BOX preference and sends one reservation only', async () => {
  const f = apiFixture({ box: true, core: true });
  await f.api.bookAgenda(input);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].headers.Authorization, 'Bearer synthetic-box-token');
  assert.equal(f.requests[0].headers['X-LZ-Identity-Provider'], 'box');
  assert.deepEqual(f.requests[0].body, input);
});

test('booking without either session fails locally before any reservation request', async () => {
  const f = apiFixture();
  await assert.rejects(f.api.bookAgenda(input), /Sua sessão terminou\. Entre novamente para agendar\./);
  assert.equal(f.requests.length, 0);
});

test('failed booking never automatically retries or switches providers, including ambiguous responses', async () => {
  for (const session of [{ core: true }, { box: true }, { core: true, box: true }]) {
    for (const failure of [
      { offline: true }, { invalidJson: true }, { status: 401 },
      { status: 409 }, { status: 422, message: 'CPF inválido.' }, { status: 503 },
    ]) {
      const f = apiFixture({ ...session, ...failure });
      await assert.rejects(f.api.bookAgenda(input));
      assert.equal(f.requests.length, 1, 'A failed or ambiguous POST must not be repeated via the other provider');
      assert.equal(f.requests[0].headers['X-LZ-Identity-Provider'], session.box ? 'box' : 'core');
    }
  }
});

test('an incomplete success response asks the client to check their bookings without another POST', async () => {
  for (const payload of [undefined, { ok: true }, { ok: true, data: {} },
    { ok: false, data: { ok: true, protocolo: 'SYNTHETIC-BOOKING-1' } },
    { ok: true, data: { ok: false, protocolo: 'SYNTHETIC-BOOKING-1' } },
    { ok: true, data: { ok: true, protocolo: ' ' } }]) {
    const f = apiFixture({ core: true, box: true, payload });
    await assert.rejects(f.api.bookAgenda(input), /Confira seus agendamentos antes de tentar novamente/);
    assert.equal(f.requests.length, 1);
  }
});

test('a rejected reservation can be retried explicitly as one new request', async () => {
  const options = { box: true, status: 409, message: 'Horário indisponível.' };
  const f = apiFixture(options);
  await assert.rejects(f.api.bookAgenda(input), /Horário indisponível/);
  assert.equal(f.requests.length, 1);
  options.status = 200;
  const result = await f.api.bookAgenda({ ...input, start: '11:00' });
  assert.equal(result.protocolo, 'SYNTHETIC-BOOKING-1');
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].body.start, '11:00');
});

test('masked and unmasked CPF values remain unchanged in the mobile reservation body', async () => {
  for (const document of ['529.982.247-25', '52998224725']) {
    const f = apiFixture({ core: true });
    await f.api.bookAgenda({ ...input, document });
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].body.document, document);
  }
});

test('the CORE registration CPF is exposed as the document used to prefill Agenda', async () => {
  const f = apiFixture({ authUser: { id: 9, nome: 'Cliente sintético', cpf: input.document } });
  const user = await f.api.register({ name: 'Cliente sintético', phone: '82999990000', email: 'synthetic@example.invalid', cpf: input.document, password: 'synthetic-fixture-password' });
  assert.equal(user.document, input.document);
  assert.equal(f.stored.get('lz_games_core_token'), 'synthetic-core-issued');
  assert.equal(f.stored.has('lz_games_box_token'), false);
});

test('the selected reservation sends the entered CPF and clears the slot after a single successful booking', async () => {
  const f = uiFixture({ document: '' });
  let tree = f.render();
  const cpf = nodes(tree).find(node => node.type === 'TextInput' && node.props.placeholder === 'CPF para confirmar o agendamento');
  assert.equal(cpf.props.keyboardType, 'numeric');
  cpf.props.onChangeText(input.document);
  tree = f.render();
  await confirmButton(tree).props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'book').length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0][1])), input);
  assert.equal(f.calls.filter(call => call[0] === 'refresh').length, 1);
  assert.equal(f.states.get('slot'), null);
  assert.equal(confirmButton(f.render()), undefined);
  assert.match(content(f.render()), /Agendamento SYNTHETIC-BOOKING-1 confirmado/);
});

test('booking errors remain visible and a deliberate UI retry makes only one additional reservation request', async () => {
  const options = { bookingError: new Error('CPF inválido para a reserva sintética.') };
  const f = uiFixture(options);
  await confirmButton(f.render()).props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'book').length, 1);
  assert.equal(f.calls.some(call => call[0] === 'refresh'), false);
  assert.match(content(f.render()), /CPF inválido/);
  assert.equal(confirmButton(f.render()).props.disabled, false);
  options.bookingError = null;
  await confirmButton(f.render()).props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'book').length, 2);
  assert.equal(confirmButton(f.render()), undefined);
});

test('two immediate confirmation events make one booking and show a disabled button while pending', async () => {
  const gate = deferred(), f = uiFixture({ bookingGate: gate.promise });
  const button = confirmButton(f.render());
  const first = button.props.onPress(), second = button.props.onPress();
  try {
    assert.equal(f.calls.filter(call => call[0] === 'book').length, 1, 'The guard must work before React rerenders the disabled button');
    assert.equal(confirmButton(f.render()).props.disabled, true);
  } finally {
    gate.resolve();
    await Promise.all([first, second]);
  }
  assert.equal(f.calls.filter(call => call[0] === 'refresh').length, 1);
  assert.equal(f.states.get('busy'), false);
  assert.equal(confirmButton(f.render()), undefined);
});

test('refresh failure after an accepted reservation preserves the success and cannot trigger another booking', async () => {
  const f = uiFixture({ refreshError: new Error('Falha sintética ao atualizar a lista.') });
  await confirmButton(f.render()).props.onPress();
  assert.equal(f.calls.filter(call => call[0] === 'book').length, 1);
  assert.match(content(f.render()), /Agendamento SYNTHETIC-BOOKING-1 confirmado/);
  assert.equal(f.states.get('slot'), null);
  assert.equal(confirmButton(f.render()), undefined);
  assert.equal(f.states.get('busy'), false);
});

test('booking confirmation reports WhatsApp forwarding only when the server acknowledges sending', async () => {
  for (const notificacao of ['enviado', 'falha', undefined]) {
    const f = uiFixture({ bookingResult: { protocolo: 'SYNTHETIC-BOOKING-1', notificacao } });
    await confirmButton(f.render()).props.onPress();
    const message = content(f.render());
    assert.match(message, /Agendamento SYNTHETIC-BOOKING-1 confirmado/);
    if (notificacao === 'enviado') assert.match(message, /(?:enviad[ao]|encaminhad[ao]).*WhatsApp/i);
    else assert.doesNotMatch(message, /(?:confirmação|mensagem) foi (?:enviad[ao]|encaminhad[ao]).*WhatsApp/i);
    assert.equal(f.calls.filter(call => call[0] === 'book').length, 1);
    assert.equal(confirmButton(f.render()), undefined);
  }
});

test('an accepted reservation returns its exact server receipt for the tappable appointment card', async () => {
  const agendamento = { agendamento_id: 901, protocolo: 'LZ-2030-000901', data_d: input.date, hora_i: '10:00', hora_f: '11:00', profissional_nome: 'Profissional sintético', cliente_nome: 'Cliente sintético' };
  const data = { ok: true, protocolo: agendamento.protocolo, agendamento, notificacao: 'enviado' };
  const api = apiFixture({ core: true, payload: { ok: true, data } });
  const result = await api.api.bookAgenda(input);
  assert.equal(result.agendamento, agendamento);
  assert.equal(api.requests.length, 1);
  const f = uiFixture({ bookingResult: data, refreshError: new Error('Synthetic list refresh failure') });
  await confirmButton(f.render()).props.onPress();
  assert.equal(f.calls.find(call => call[0] === 'refresh')[1], agendamento);
  assert.match(content(f.render()), /Seu agendamento já está confirmado/);
  assert.equal(f.calls.filter(call => call[0] === 'book').length, 1);
});

test('store details reuse service discovery, accept only public fields and preserve the catalogue', async () => {
  const servicos = [{ id: 17, setor_id: 4, nome: 'Serviço sintético' }];
  const f = apiFixture({ payload: { servicos, setores: [], loja: { nome: 'Loja sintética', endereco: 'Endereço sintético', secret: 'MUST_NOT_COPY' } } });
  const result = await f.api.loadAgendaServices();
  assert.equal(result.servicos, servicos);
  assert.deepEqual(JSON.parse(JSON.stringify(result.loja)), { nome: 'Loja sintética', endereco: 'Endereço sintético' });
  assert.equal(f.requests.length, 1);
  assert.match(f.requests[0].url, /a=listServicos$/);
  assert.equal(f.requests[0].body, undefined);
  assert.equal((await apiFixture({ payload: { servicos, loja: { nome: 'Old server' } } }).api.loadAgendaServices()).loja, null);
});
