import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { HomeData } from "./api";
import { NeonCard } from "./effects/Neon";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(cents || 0) / 100,
  );
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Não expira";
const status = (value: string) =>
  (
    ({ PROVISIONED: "ATIVA", paid: "PAGO", active: "ATIVO" })[value] ?? value
  ).toUpperCase();

export function TurboRamaDetails({ data }: { data: HomeData }) {
  const { licenses } = data.services.turborama,
    { purchases, library } = data.services.turbobox;
  return (
    <>
      <NeonCard color="#85ceff" radius={18} style={[s.access, s.spaceSurface]}>
        <Text style={s.kicker}>DADOS DE ACESSO</Text>
        <Text style={s.title}>{data.user.name}</Text>
        <Row
          label="Login"
          value={data.user.email || data.user.phone || "Não informado"}
        />
        <Row label="WhatsApp" value={data.user.phone || "Não informado"} />
        <Text style={s.note}>
          A senha permanece protegida e nunca é exibida.
        </Text>
      </NeonCard>
      <Text style={s.heading}>PACOTES ATIVOS</Text>
      {library.length ? (
        library.map((course) => (
          <NeonCard
            color="#85ceff"
            style={[s.card, s.spaceSurface]}
            key={course.id}
          >
            <Text style={s.badge}>● ATIVO • ACESSO VITALÍCIO</Text>
            <Text style={s.title}>{course.name}</Text>
            <Text style={s.description}>
              {course.description ||
                "Pacote TurboRama liberado para sua conta."}
            </Text>
            <Row
              label="Conteúdo"
              value={`${course.completed_lessons}/${course.total_lessons} concluídos`}
            />
            <Row label="Validade" value="Não expira" />
          </NeonCard>
        ))
      ) : (
        <Empty text="Nenhum pacote ativo." />
      )}
      <Text style={s.heading}>LICENÇAS</Text>
      {licenses.length ? (
        licenses.map((item) => (
          <NeonCard
            color="#b29aff"
            style={[s.card, s.spaceSurface]}
            key={item.opaque_ref}
          >
            <Text style={s.badge}>● {status(item.state)}</Text>
            <Text style={s.title}>TurboRama Suite</Text>
            <Row label="Licença" value={item.license_id} />
            <Row label="Referência" value={item.opaque_ref} />
            <Row
              label="Situação financeira"
              value={status(item.financial_state)}
            />
            <Row label="Última atualização" value={date(item.updated_at)} />
            <Row label="Validade" value="Vitalícia • não expira" />
          </NeonCard>
        ))
      ) : (
        <Empty text="Nenhuma licença vinculada." />
      )}
      <Text style={s.heading}>HISTÓRICO DE COMPRAS</Text>
      {purchases.length ? (
        purchases.map((item) => (
          <NeonCard
            color="#85ceff"
            style={[s.card, s.spaceSurface]}
            key={item.id}
          >
            <Text style={s.badge}>● {status(item.status)}</Text>
            <Text style={s.title}>{item.product_name}</Text>
            <Text style={s.description}>{item.product_description}</Text>
            <Row label="Pedido" value={`#${item.id}`} />
            <Row label="Valor" value={money(item.amount_cents)} />
            <Row label="Compra" value={date(item.purchased_at)} />
            <Row
              label="Validade"
              value={
                item.expires_at
                  ? date(item.expires_at)
                  : "Vitalícia • não expira"
              }
            />
          </NeonCard>
        ))
      ) : (
        <Empty text="Nenhuma compra localizada." />
      )}
    </>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text selectable style={s.value}>
        {value}
      </Text>
    </View>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.description}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  spaceSurface: { backgroundColor: "rgba(7,18,35,.76)", borderColor: "#294962" },
  access: {
    backgroundColor: "rgba(7,25,18,.94)",
    borderWidth: 1,
    borderColor: "#2e7458",
    borderRadius: 18,
    padding: 17,
    gap: 7,
  },
  card: {
    backgroundColor: "rgba(9,20,16,.95)",
    borderWidth: 1,
    borderColor: "#30265b",
    borderRadius: 17,
    padding: 16,
    gap: 7,
  },
  kicker: {
    color: "#53f6a7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  heading: {
    color: "#8a9b93",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginTop: 10,
  },
  title: { color: "#fff", fontSize: 17, fontWeight: "900" },
  description: { color: "#8b9a94", fontSize: 12, lineHeight: 17 },
  badge: { color: "#53f6a7", fontSize: 10, fontWeight: "900" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: "#172b23",
    paddingTop: 7,
  },
  label: { color: "#74867e", fontSize: 11 },
  value: {
    color: "#dbe6e1",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  note: { color: "#71837a", fontSize: 10, marginTop: 5 },
  empty: {
    backgroundColor: "rgba(7,18,35,.70)",
    borderRadius: 15,
    padding: 24,
    alignItems: "center",
  },
});
