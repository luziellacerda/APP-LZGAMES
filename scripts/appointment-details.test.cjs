const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = name => ts.transpileModule(fs.readFileSync(require.resolve('../src/' + name), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const model = { exports: {}, require: name => assert.fail('Unexpected dependency: ' + name) };
vm.runInNewContext(compile('appointmentDetails.ts'), model);
const { appointmentDetails, appointmentDate, appointmentPhone } = model.exports;
const fixture = {
  agendamento_id: 901, data_d: '2030-04-10', data_hora: '2030-04-10T10:00:00.000Z', hora_i: '10:00:00', hora_f: '11:00:00',
  status: 'pendente', servico_nome: 'Orçamento sintético', profissional_nome: 'Profissional de teste',
  cliente_nome: 'Cliente sintético', telefone: '+5582999990000', atendimento: 'loja',
  cpf: 'SYNTHETIC_PRIVATE_DOCUMENT', cancel_code: 'SYNTHETIC_PRIVATE_CANCELLATION', obs_interna: 'SYNTHETIC_PRIVATE_NOTE', preco_brl: '999.99',
};
const store = { nome: 'Loja sintética', endereco: 'Endereço sintético, Maceió - AL' };

function ui() {
  let open = false;
  const modules = {
    react: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: () => [open, value => { open = typeof value === 'function' ? value(open) : value; }],
    },
    'react-native': { Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: value => value } },
    './appointmentDetails': model.exports,
    './effects/Neon': { AnimatedIcon: 'AnimatedIcon', NeonCard: 'NeonCard' },
  };
  const context = {
    exports: {}, require: name => { assert.ok(name in modules, 'Unexpected dependency: ' + name); return modules[name]; },
    fetch: () => assert.fail('Read-only details must not contact any server'),
    setInterval: () => assert.fail('Details must not add an animation or polling loop'),
  };
  vm.runInNewContext(compile('AppointmentCard.tsx'), context);
  function expand(tree) {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree || typeof tree !== 'object') return tree;
    if (typeof tree.type === 'function') return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  return { render(appointment = fixture, business = store) { return expand(context.exports.AppointmentCard({ appointment, store: business })); } };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : typeof tree === 'string' ? tree : tree && typeof tree === 'object' ? text(tree.props.children) : ''; }
const button = tree => nodes(tree).find(node => node.type === 'Pressable');

test('appointment protocol, civil day and hour range are preserved from the Agenda data', () => {
  const details = appointmentDetails(fixture, store);
  assert.equal(details.protocol, 'LZ-2030-000901');
  assert.equal(details.date, '10/04/2030');
  assert.equal(details.time, '10:00 – 11:00');
  assert.equal(details.status, 'Pendente de confirmação');
  assert.equal(details.customer, fixture.cliente_nome);
  assert.equal(details.phone, '(82) 99999-0000');
  assert.equal(details.attendance, 'Na loja');
  assert.equal(details.storeAddress, store.endereco);
  assert.equal(appointmentDetails({ ...fixture, protocolo: 'EXISTING-PROTOCOL' }).protocol, 'EXISTING-PROTOCOL');
});

test('SQL and ISO representations of civil dates do not move days with a device timezone', () => {
  for (const raw of ['2030-04-10', '2030-04-10 00:00:00', '2030-04-10T00:00:00.000Z', '2030-04-10T23:59:00-03:00']) assert.equal(appointmentDate(raw), '10/04/2030');
  assert.equal(appointmentDate(null), 'Não informada');
  assert.equal(appointmentDate({ token: 'do not render' }), 'Não informada');
});

test('both API variants expose equivalent details, including fallback appointment windows', () => {
  const details = appointmentDetails({ id: '901', data_hora: '2030-04-10 09:00:00', janela_inicio: '10:00:00', janela_fim: '11:00:00', usuario_nome: fixture.cliente_nome, loja: store });
  assert.equal(details.date, '10/04/2030');
  assert.equal(details.time, '10:00 – 11:00');
  assert.equal(details.protocol, 'LZ-2030-000901');
  assert.equal(details.customer, fixture.cliente_nome);
  assert.equal(details.storeName, store.nome);
});

test('missing fields never invent a professional, time, address or successful state', () => {
  const details = appointmentDetails({});
  assert.equal(details.professional, 'A definir');
  assert.equal(details.time, 'Não informado');
  assert.equal(details.status, 'Não informado');
  assert.equal(details.storeAddress, '');
  assert.equal(appointmentDetails({ data_hora: '2030-04-10 10:00:00' }).time, '10:00');
});

test('the whole appointment summary is an accessible toggle with readable compact details', () => {
  const f = ui(); let tree = f.render();
  assert.equal(button(tree).props.accessibilityRole, 'button');
  assert.equal(button(tree).props.accessibilityState.expanded, false);
  assert.match(text(tree), /VER DETALHES/);
  assert.doesNotMatch(text(tree), /Cliente sintético|Endereço sintético/);
  button(tree).props.onPress(); tree = f.render();
  assert.equal(button(tree).props.accessibilityState.expanded, true);
  for (const value of ['FECHAR DETALHES', 'LZ-2030-000901', '10/04/2030', '10:00 – 11:00', fixture.servico_nome, fixture.profissional_nome, fixture.cliente_nome, '(82) 99999-0000', store.endereco]) assert.ok(text(tree).includes(value));
  assert.doesNotMatch(text(tree), /SYNTHETIC_PRIVATE|999\.99|R\$/);
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.selectable), 'Customer can copy appointment details');
  button(tree).props.onPress(); tree = f.render();
  assert.equal(button(tree).props.accessibilityState.expanded, false);
  assert.doesNotMatch(text(tree), /Cliente sintético/);
});

test('an open appointment reflects refreshed status and professional instead of retaining stale details', () => {
  const f = ui(); button(f.render()).props.onPress();
  let tree = f.render({ ...fixture, status: 'booked' });
  assert.match(text(tree), /Confirmado/);
  tree = f.render({ ...fixture, status: 'done', profissional_nome: 'Profissional atualizado' });
  assert.match(text(tree), /Atendimento concluído/);
  assert.match(text(tree), /Profissional atualizado/);
  assert.equal(button(tree).props.accessibilityState.expanded, true);
});

test('Brazilian mobile/landline formatting does not confuse country code 55 with the DDD', () => {
  for (const value of ['82999990000', '+5582999990000', '+55 (82) 99999-0000']) assert.equal(appointmentPhone(value), '(82) 99999-0000');
  assert.equal(appointmentPhone('558233330000'), '(82) 3333-0000');
  assert.equal(appointmentPhone('55999990000'), '(55) 99999-0000');
});

test('the Agenda integration preserves canceled/deleted filtering, calendar search and no-price presentation', () => {
  const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  assert.match(app, /<AppointmentCard appointment=\{a\} store=\{agendaStore\}/);
  assert.match(app, /"cancelled"/); assert.match(app, /!a\.deleted_at/);
  const booking = fs.readFileSync(require.resolve('../src/AgendaBooking.tsx'), 'utf8');
  assert.match(booking, /PS5 não liga, HDMI, limpeza/);
  assert.match(booking, /await onBooked\(r\.agendamento\)/);
  assert.doesNotMatch(booking, /\.preco_brl|Linking\.openURL|wa\.me|msg_texto/);
});
