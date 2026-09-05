import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ServiceOrder } from "./api";
import { AnimatedIcon, NeonCard } from "./effects/Neon";

const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Não informado" : String(value);

const date = (value: unknown) => {
  const raw = text(value);
  if (raw === "Não informado") return raw;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
};

const currency = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
    : text(value);
};

function Field({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  return (
    <View style={[s.field, wide && s.wide]}>
      <Text style={s.label}>{label}</Text>
      <Text selectable style={s.value}>{text(value)}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.grid}>{children}</View>
    </View>
  );
}

export function ServiceOrderCard({ order }: { order: ServiceOrder }) {
  const [open, setOpen] = useState(false);
  const id = order.os_id ?? order.id ?? "—";
  const equipment = order.equipamento ?? order.equipamento_nome ?? order.modelo ?? "Equipamento";

  return (
    <NeonCard style={s.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.summary}>
        <View style={s.icon}><AnimatedIcon name="tools" size={34} /></View>
        <View style={s.summaryBody}>
          <Text style={s.title}>OS #{String(id)}</Text>
          <Text style={s.equipment}>{text(equipment)}</Text>
          <Text style={s.status}>● {text(order.status).toUpperCase()}</Text>
        </View>
        <Text style={s.toggle}>{open ? "FECHAR ︿" : "VER TUDO ﹀"}</Text>
      </Pressable>

      {open ? (
        <View style={s.details}>
          <Section title="DADOS DA ORDEM">
            <Field label="Número da OS" value={id} />
            <Field label="Status" value={order.status} />
            <Field label="Entrada" value={date(order.data_entrada)} />
            <Field label="Entrega" value={date(order.data_entrega)} />
            <Field label="Validade" value={order.dias_validade ? `${order.dias_validade} dias` : null} />
            <Field label="Garantia" value={order.dias_garantia ? `${order.dias_garantia} dias` : null} />
          </Section>

          <Section title="CONSUMIDOR / NOTA">
            <Field label="Cliente" value={order.cliente} wide />
            <Field label="CPF" value={order.cpf} />
            <Field label="CPF na nota" value={order.cpf_nota} />
            <Field label="Telefone" value={order.telefone} wide />
          </Section>

          <Section title="EQUIPAMENTO">
            <Field label="Equipamento" value={order.equipamento} />
            <Field label="Marca" value={order.marca} />
            <Field label="Modelo" value={order.modelo} />
            <Field label="Número de série" value={order.numero_serie} />
            <Field label="Acessórios recebidos" value={order.acessorios} wide />
            <Field label="Condições de entrada" value={order.condicoes} wide />
            <Field label="Defeito informado" value={order.defeito} wide />
            <Field label="Laudo técnico" value={order.laudo} wide />
          </Section>

          <Section title="VALORES DA NOTA">
            <Field label="Produtos" value={currency(order.total_produtos)} />
            <Field label="Serviços" value={currency(order.total_servicos)} />
            <Field label="Mão de obra" value={currency(order.mao_obra)} />
            <Field label="Valor do serviço" value={currency(order.valor_servico)} />
            <Field label="Frete" value={currency(order.frete)} />
            <Field label="Subtotal" value={currency(order.subtotal)} />
            <Field label="Desconto" value={order.desconto ? `${order.desconto}${order.tipo_desconto === "%" ? "%" : ""}` : "Sem desconto"} />
            <Field label="Entrada paga" value={currency(order.entrada)} />
            <Field label="Total" value={currency(order.valor)} />
            <Field label="Pagamento" value={String(order.pago ?? "").toLowerCase() === "sim" ? "Pago" : text(order.pago)} />
          </Section>

          <Section title="ATENDIMENTO">
            <Field label="Técnico responsável" value={order.tecnico_nome} wide />
            <Field label="Código de rastreio" value={order.rastreio} wide />
            <Field label="Observações" value={order.obs} wide />
          </Section>
        </View>
      ) : null}
    </NeonCard>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#0b1914", borderWidth: 1, borderColor: "#193027", borderRadius: 17, overflow: "hidden" },
  summary: { minHeight: 82, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "#142a21", alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20 },
  summaryBody: { flex: 1 },
  title: { fontSize: 16, color: "#f4f7f5", fontWeight: "900" },
  equipment: { fontSize: 12, color: "#a5b5ae", marginTop: 2 },
  status: { fontSize: 9, color: "#53f6a7", fontWeight: "900", marginTop: 6 },
  toggle: { color: "#53f6a7", fontSize: 9, fontWeight: "900" },
  details: { borderTopWidth: 1, borderTopColor: "#193027", padding: 13, gap: 12, backgroundColor: "#07130f" },
  section: { borderWidth: 1, borderColor: "#183128", borderRadius: 13, overflow: "hidden" },
  sectionTitle: { paddingHorizontal: 12, paddingVertical: 9, color: "#53f6a7", backgroundColor: "#10251d", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 6 },
  field: { width: "50%", padding: 7 },
  wide: { width: "100%" },
  label: { color: "#71877d", fontSize: 9, fontWeight: "800", textTransform: "uppercase", marginBottom: 3 },
  value: { color: "#edf5f1", fontSize: 12, lineHeight: 17 },
});
