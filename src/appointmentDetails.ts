import type { Appointment, AgendaStore } from './api';

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

// The Agenda returns Brazilian civil dates/times. Do not shift them through the
// device timezone (new Date('YYYY-MM-DD') would move the day in Brazil).
export function appointmentDate(value: unknown): string {
  const raw = clean(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw || 'Não informada';
}

function time(value: unknown): string {
  const raw = clean(value);
  const match = raw.match(/^(?:\d{4}-\d{2}-\d{2}[T ])?([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function appointmentPhone(value: unknown): string {
  const raw = clean(value), digits = raw.replace(/\D/g, '');
  const national = /^(?:\d{10}|\d{11})$/.test(digits) ? digits : /^55\d{10,11}$/.test(digits) ? digits.slice(2) : '';
  return national ? national.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : raw || 'Não informado';
}

export function appointmentDetails(appointment: Appointment, store?: AgendaStore | null) {
  const id = clean(appointment.agendamento_id ?? appointment.id);
  const date = clean(appointment.data_d) || clean(appointment.data_hora);
  const year = date.match(/^(\d{4})-/)?.[1];
  const protocol = clean(appointment.protocolo) || (year && /^\d+$/.test(id) ? `LZ-${year}-${id.padStart(6, '0')}` : id ? `#${id}` : 'Não informado');
  const start = time(appointment.hora_i) || time(appointment.janela_inicio) || time(appointment.data_hora);
  const end = time(appointment.hora_f) || time(appointment.janela_fim);
  const status = clean(appointment.status).toLowerCase();
  const statuses: Record<string, string> = { pendente: 'Pendente de confirmação', pending: 'Pendente de confirmação', booked: 'Confirmado', confirmado: 'Confirmado', done: 'Atendimento concluído', concluido: 'Atendimento concluído', cancelled: 'Cancelado', cancelado: 'Cancelado', noshow: 'Não compareceu', no_show: 'Não compareceu' };
  const attendance = clean(appointment.atendimento);
  const place = appointment.loja && typeof appointment.loja === 'object' && !Array.isArray(appointment.loja) ? appointment.loja as AgendaStore : store;
  // Explicit allowlist: never display prices, internal notes, or cancellation keys.
  return {
    id, protocol, service: clean(appointment.servico_nome) || 'Atendimento',
    date: appointmentDate(date), time: start ? end ? `${start} – ${end}` : start : 'Não informado',
    status: statuses[status] || clean(appointment.status) || 'Não informado',
    professional: clean(appointment.profissional_nome) || 'A definir',
    customer: clean(appointment.cliente_nome) || clean(appointment.usuario_nome) || 'Não informado',
    phone: appointmentPhone(appointment.telefone),
    attendance: ({ loja: 'Na loja', domicilio: 'Domiciliar', remoto: 'Remoto' } as Record<string, string>)[attendance] || attendance || 'Não informado',
    storeName: clean(place?.nome), storeAddress: clean(place?.endereco),
  };
}
