import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Appointment, AgendaStore } from './api';
import { appointmentDetails } from './appointmentDetails';
import { AnimatedIcon, NeonCard } from './effects/Neon';

export function AppointmentCard({ appointment, store }: { appointment: Appointment; store?: AgendaStore | null }) {
  const [open, setOpen] = useState(false);
  const info = appointmentDetails(appointment, store);
  return (
    <NeonCard color="#70d8ff" radius={16} style={s.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Fechar' : 'Ver'} detalhes do agendamento ${info.protocol}. ${info.service}. ${info.date}, ${info.time}. ${info.status}.`}
        onPress={() => setOpen(value => !value)} style={s.summary}>
        <View pointerEvents="none" style={s.icon}><AnimatedIcon name="calendar" size={32} /></View>
        <View style={s.body}>
          <Text style={s.title}>{info.service}</Text>
          <Text style={s.date}>{info.date} · {info.time}</Text>
          <Text style={s.status}>● {info.status}</Text>
          <Text style={s.toggle}>{open ? 'FECHAR DETALHES ︿' : 'VER DETALHES ﹀'}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={s.details}>
          <View style={s.grid}>
            <Field label="Protocolo" value={info.protocol} wide />
            <Field label="Data" value={info.date} />
            <Field label="Horário" value={info.time} />
            <Field label="Situação" value={info.status} wide />
            <Field label="Serviço" value={info.service} wide />
            <Field label="Profissional" value={info.professional} wide />
            <Field label="Cliente" value={info.customer} wide />
            <Field label="WhatsApp do cadastro" value={info.phone} wide />
            <Field label="Atendimento" value={info.attendance} wide />
            {info.storeName ? <Field label="Estabelecimento" value={info.storeName} wide /> : null}
            {info.storeAddress ? <Field label="Endereço da loja" value={info.storeAddress} wide /> : null}
          </View>
          <Text style={s.hint}>Os dados acompanham sua reserva. Puxe a tela para baixo para atualizar a situação.</Text>
        </View>
      ) : null}
    </NeonCard>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <View style={[s.field, wide && s.wide]}><Text style={s.label}>{label}</Text><Text selectable style={s.value}>{value}</Text></View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: 'rgba(5,17,29,.92)', borderWidth: 1, borderColor: '#245b75', borderRadius: 16, overflow: 'hidden' },
  summary: { padding: 13, minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 11 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { color: '#f4fbff', fontSize: 14, fontWeight: '800' },
  date: { color: '#c1dbea', fontSize: 12, marginTop: 4, lineHeight: 17 },
  status: { color: '#70d8ff', fontSize: 10, fontWeight: '700', marginTop: 4 },
  toggle: { color: '#9aedff', fontSize: 9, fontWeight: '900', marginTop: 8, letterSpacing: .6 },
  details: { padding: 8, borderTopWidth: 1, borderTopColor: '#245b75', backgroundColor: 'rgba(3,12,21,.9)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', padding: 7 },
  wide: { width: '100%' },
  label: { color: '#94b5c7', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginBottom: 3 },
  value: { color: '#f0f8ff', fontSize: 12, lineHeight: 18 },
  hint: { color: '#94b5c7', fontSize: 10, lineHeight: 16, padding: 7 },
});
