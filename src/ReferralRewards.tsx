import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import {
  acceptReferralInvite,
  createReferralInvite,
  loadReferralRewards,
  type ReferralRewardsData,
} from "./api";
import { NeonCard } from "./effects/Neon";
import { CardLottie } from "./effects/CardLottie";
import { currentHistoryMonth, filterReferralHistory, HISTORY_PAGE_SIZE, historyMonthLabel, historyMonths, historyStatusLabel, type ReferralHistoryStatus } from "./referralHistory";

type Action = { owner: number; submitted: boolean };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const failure = (error: unknown, fallback: string) => error instanceof Error && error.message.trim() ? error.message : fallback;
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/).map(part => part.replace(/[^\p{L}\p{M}'-]/gu, "")).filter(Boolean);
  if (!parts.length) return "Pessoa indicada";
  return `${parts[0]!.slice(0, 24)}${parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toLocaleUpperCase()}.` : ""}`;
};
const itemStatus = (value: string) => {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (["completed", "concluida", "concluido"].includes(key)) return "Concluída";
  if (["cancelled", "canceled", "cancelada", "cancelado"].includes(key)) return "Cancelada";
  if (["pending", "pendente"].includes(key)) return "Pendente";
  return "Em análise";
};
const dateLabel = (value: string) => {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "Data não informada" : date.toLocaleDateString("pt-BR");
};

export function ReferralRewards({ refreshKey }: { refreshKey?: unknown }) {
  const [data, setData] = useState<ReferralRewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [received, setReceived] = useState("");
  const [action, setAction] = useState<"share" | "confirm" | "accept" | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const [month, setMonth] = useState(currentHistoryMonth);
  const [status, setStatus] = useState<ReferralHistoryStatus>("completed");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const loadSequence = useRef(0);
  const inFlight = useRef<Action | null>(null);

  const current = (owner: number) => mounted.current && generation.current === owner;
  const reload = async () => {
    if (!mounted.current) return;
    const owner = generation.current, request = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      const result = await loadReferralRewards();
      if (!current(owner) || loadSequence.current !== request) return;
      setData(result); setVisibleCount(HISTORY_PAGE_SIZE);
    } catch (cause) {
      if (current(owner) && loadSequence.current === request) setError(failure(cause, "Não foi possível carregar suas indicações. Tente novamente."));
    } finally {
      if (current(owner) && loadSequence.current === request) setLoading(false);
    }
  };
  useEffect(() => {
    mounted.current = true; generation.current++;
    return () => {
      mounted.current = false; generation.current++; loadSequence.current++; inFlight.current = null;
    };
  }, []);
  useEffect(() => { void reload(); }, [refreshKey]);

  const finish = (operation: Action) => {
    if (inFlight.current !== operation) return;
    inFlight.current = null;
    if (current(operation.owner)) setAction(null);
  };
  const shareInvite = async () => {
    if (!mounted.current || inFlight.current) return;
    const operation = { owner: generation.current, submitted: true };
    inFlight.current = operation;
    setAction("share"); setActionError(""); setActionMessage("");
    try {
      // Every explicit share creates a separate, single-use invitation. Never reuse a cached recipient's code.
      const result = await createReferralInvite();
      if (!current(operation.owner) || inFlight.current !== operation) return;
      setInvite(result);
      await Share.share({ message: `🎮 Você recebeu um convite para o app LZ-GAMES!\n\n${result.link}\n\n📲 Abra o link, copie o convite e baixe o app para Android. Antes de entrar ou criar sua conta, cole o código em “Recebi um convite”.\n${data?.summary.appCredit ? '\nQuem indica recebe R$ 9,90 em crédito para serviços pelo primeiro acesso elegível, sem saque.\n' : ''}\nA aprovação do cashback depende da validação da loja.` });
    } catch (cause) {
      if (current(operation.owner)) setActionError(failure(cause, "Não foi possível compartilhar o convite. Tente novamente."));
    } finally { finish(operation); }
  };
  const askToAccept = () => {
    if (!mounted.current || inFlight.current) return;
    const value = received.trim();
    setActionError(""); setActionMessage("");
    if (!value) { setActionError("Informe o código ou link de indicação recebido."); return; }
    const operation = { owner: generation.current, submitted: false };
    inFlight.current = operation; setAction("confirm");
    Alert.alert("Vincular esta indicação?", "Confirme que deseja vincular o convite recebido à sua conta. A aprovação de cashback depende da validação da loja.", [
      { text: "Cancelar", style: "cancel", onPress: () => finish(operation) },
      { text: "Vincular", onPress: async () => {
        if (!current(operation.owner) || inFlight.current !== operation || operation.submitted) return;
        operation.submitted = true; setAction("accept");
        try {
          const result = await acceptReferralInvite(value);
          if (!current(operation.owner) || inFlight.current !== operation) return;
          setReceived("");
          setActionMessage(result.alreadyRegistered
            ? "Esta indicação já estava vinculada à sua conta."
            : "Indicação registrada. A aprovação e as condições do cashback serão validadas pela loja.");
          await reload();
        } catch (cause) {
          if (current(operation.owner)) setActionError(failure(cause, "Não foi possível vincular a indicação. Confira o convite e tente novamente."));
        } finally { finish(operation); }
      } },
    ], { cancelable: true, onDismiss: () => { if (!operation.submitted) finish(operation); } });
  };

  const summary = data?.summary;
  const nextTier = summary?.tiers.filter(tier => tier.threshold > summary.currentTier.threshold).sort((a, b) => a.threshold - b.threshold)[0];
  const progress = summary && nextTier ? Math.min(100, Math.max(0, summary.valid / nextTier.threshold * 100)) : 100;
  const history = filterReferralHistory(data?.items ?? [], month, status, search);
  const months = historyMonths();
  const monthIndex = months.indexOf(month);
  const changeMonth = (value: string) => { setMonth(value); setVisibleCount(HISTORY_PAGE_SIZE); };
  const changeStatus = (value: ReferralHistoryStatus) => { setStatus(value); setVisibleCount(HISTORY_PAGE_SIZE); };
  const resetFilters = () => { setMonth(currentHistoryMonth()); setStatus("completed"); setSearch(""); setVisibleCount(HISTORY_PAGE_SIZE); };
  const busy = action !== null;
  return <>
    {summary?.appCredit?<NeonCard color="#79edbc" radius={18} style={s.card}>
      <Text style={s.kicker}>INDICAÇÃO DO APP · CRÉDITO PARA SERVIÇOS</Text>
      <Text style={s.label}>{summary.appCredit.availableCents!==undefined?'DISPONÍVEL PARA SERVIÇOS':'CRÉDITO ACUMULADO'}</Text>
      <View testID="referrals-app-credit-value-row" style={s.valueRow}>
        <Text testID="referrals-app-credit" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.amount, s.valueText]}>{money(summary.appCredit.availableCents??summary.appCredit.creditCents)}</Text>
        <CardLottie kind="appCredit" width={78} height={63} />
      </View>
      {summary.appCredit.usedCents!==undefined?<Text testID="referrals-app-credit-usage" style={s.note}>Acumulado: {money(summary.appCredit.creditCents)} · Usado nas notas: {money(summary.appCredit.usedCents)}</Text>:null}
      <Text style={s.note}>{summary.appCredit.rewardCount} indicações premiadas · {money(summary.appCredit.bonusCents)} por primeiro acesso elegível.</Text>
      <Text style={s.note}>Crédito acumulável, sem prazo de validade e sem saque. Separado do cashback de 5% por serviço. A indicação precisa ser vinculada antes do primeiro acesso ao app; reinstalar ou entrar novamente não gera outro bônus.</Text>
      <Text style={s.note}>{summary.appCredit.redemptionEnabled?'Solicite à loja o abatimento na sua OS antes da conclusão ou pagamento. O crédito é limitado aos serviços da nota; produtos e frete não entram.':'O crédito permanece registrado. Novos abatimentos estão temporariamente indisponíveis.'}</Text>
      {loading||error?<Text style={s.note}>Exibindo a última consulta. Use “Tentar novamente” se houver falha.</Text>:null}
    </NeonCard>:null}
    <NeonCard color="#ffd66b" radius={20} style={s.summaryCard}>
      <Text style={s.kicker}>CASHBACK E INDICAÇÕES</Text>
      {loading ? <View style={s.inline}><ActivityIndicator size="small" color="#ffd66b" /><Text accessibilityLiveRegion="polite" style={s.note}>{data ? "Atualizando informações…" : "Carregando suas indicações…"}</Text></View> : null}
      {error ? <>
        <Text testID="referrals-load-error" accessibilityRole="alert" style={s.error}>{error}{data ? " Exibindo as últimas informações carregadas." : ""}</Text>
        <Pressable testID="referrals-retry" accessibilityRole="button" accessibilityLabel="Tentar carregar indicações novamente" disabled={loading} onPress={() => { void reload(); }} style={s.secondaryButton}><Text style={s.secondaryText}>TENTAR NOVAMENTE</Text></Pressable>
      </> : null}
      {summary ? <>
        <Text style={s.label}>CASHBACK APROVADO</Text>
        <View testID="referrals-approved-value-row" style={s.valueRow}>
          <Text testID="referrals-approved" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[s.amount, s.valueText]}>{money(summary.approvedCents)}</Text>
          <CardLottie kind="cashback" width={96} height={63} />
        </View>
        <Text style={s.note}>Total histórico aprovado. Este valor não informa crédito disponível para uso; consulte as condições e a validação da loja.</Text>
        <View style={s.counts}>
          <View style={s.count}><Text style={s.countValue}>{summary.pending}</Text><Text style={s.countLabel}>Pendentes</Text></View>
          <View style={s.count}><Text style={s.countValue}>{summary.completed}</Text><Text style={s.countLabel}>Concluídas</Text></View>
          <View style={s.count}><Text style={s.countValue}>{summary.cancelled}</Text><Text style={s.countLabel}>Canceladas</Text></View>
        </View>
        <Text style={s.note}>{summary.valid} válidas para o programa · {summary.total} indicações no total</Text>
        <View style={s.divider} />
        <Text testID="referrals-current-tier" style={s.title}>{summary.currentTier.label} · {summary.currentTier.percent}%</Text>
        {summary.currentTier.description ? <Text style={s.note}>{summary.currentTier.description}</Text> : null}
        {nextTier ? <>
          <View testID="referrals-progress" accessibilityRole="progressbar" accessibilityLabel={`Progresso para ${nextTier.label}`} accessibilityValue={{ min: 0, max: nextTier.threshold, now: Math.min(summary.valid, nextTier.threshold) }} style={s.progressTrack}><View style={[s.progressFill, { width: `${progress}%` }]} /></View>
          <Text style={s.note}>Próximo nível: {nextTier.label} · {nextTier.percent}%. Faltam {Math.max(0, nextTier.threshold - summary.valid)} indicações válidas para atingir {nextTier.threshold}.</Text>
        </> : <Text style={s.note}>Último nível informado pela loja.</Text>}
        <Pressable testID="referrals-tiers" accessibilityRole="button" accessibilityState={{ expanded: showTiers }} onPress={() => setShowTiers(value => !value)}><Text style={s.link}>{showTiers ? "Ocultar níveis" : "Ver níveis do programa"}</Text></Pressable>
        {showTiers ? summary.tiers.map(tier => <View key={tier.id} style={s.tier}><Text style={s.tierTitle}>{tier.label} · {tier.percent}% · {tier.threshold} válidas</Text>{tier.description ? <Text style={s.note}>{tier.description}</Text> : null}</View>) : null}
        <Text style={s.note}>Regras informadas pela loja. A aprovação de cada indicação e do cashback depende de validação.</Text>
      </> : null}
    </NeonCard>

    <NeonCard color="#70d8ff" radius={18} style={s.card}>
      <View testID="referrals-invite-heading" style={s.valueRow}>
        <View style={s.inviteHeadingText}><Text style={s.title}>Convide alguém</Text><Text style={s.note}>Cada compartilhamento gera um novo convite, válido para uma pessoa. Telefone e cliente já indicados não podem receber outra indicação, mesmo após cancelamento.</Text></View>
        <CardLottie kind="invite" width={76} height={54} />
      </View>
      <Pressable testID="referrals-share" accessibilityRole="button" accessibilityLabel="Compartilhar convite de indicação" accessibilityState={{ disabled: busy, busy: action === "share" }} disabled={busy} onPress={shareInvite} style={[s.button, busy && s.disabled]}>
        {action === "share" ? <ActivityIndicator size="small" color="#06151e" /> : <Text style={s.buttonText}>COMPARTILHAR CONVITE</Text>}
      </Pressable>
      {invite ? <View style={s.invite}>
        <Text style={s.label}>SEU CÓDIGO</Text><Text testID="referrals-invite-code" selectable style={s.selectable}>{invite.code}</Text>
        <Text style={s.label}>LINK DO CONVITE</Text><Text testID="referrals-invite-link" selectable style={s.selectable}>{invite.link}</Text>
      </View> : null}
      <View style={s.divider} />
      <Text style={s.title}>Recebeu uma indicação?</Text>
      {summary?.appCredit?<Text style={s.note}>Para o bônus de primeiro acesso, informe o convite na entrada/cadastro antes de abrir o app pela primeira vez. Vincular um convite aqui não gera esse bônus retroativamente.</Text>:null}
      <TextInput testID="referrals-code-input" accessibilityLabel="Código ou link de indicação recebido" placeholder="Cole o código ou link recebido" placeholderTextColor="#7693a0" value={received} onChangeText={setReceived} editable={!busy} autoCapitalize="none" autoCorrect={false} maxLength={2048} style={s.input} />
      <Pressable testID="referrals-accept" accessibilityRole="button" accessibilityLabel="Confirmar vinculação da indicação" accessibilityState={{ disabled: busy || !received.trim(), busy: action === "accept" }} disabled={busy || !received.trim()} onPress={askToAccept} style={[s.secondaryButton, (busy || !received.trim()) && s.disabled]}>
        {action === "accept" ? <ActivityIndicator size="small" color="#9ce7ff" /> : <Text style={s.secondaryText}>{action === "confirm" ? "AGUARDANDO CONFIRMAÇÃO" : "VINCULAR INDICAÇÃO"}</Text>}
      </Pressable>
      {actionError ? <Text testID="referrals-action-error" accessibilityRole="alert" style={s.error}>{actionError}</Text> : null}
      {actionMessage ? <Text testID="referrals-action-message" accessibilityLiveRegion="polite" style={s.success}>{actionMessage}</Text> : null}
    </NeonCard>

    {data ? <NeonCard color="#70d8ff" radius={18} style={s.card}>
      <View style={s.historyHeader}>
        <Text style={[s.title, s.historyHeading]}>Suas indicações</Text>
        <Pressable testID="referrals-filters" accessibilityRole="button" accessibilityLabel={showFilters ? "Ocultar filtros das indicações" : "Pesquisar indicações por mês, situação e nome"} accessibilityState={{ expanded: showFilters }} onPress={() => setShowFilters(value => !value)} style={s.filterToggle}><Text style={s.secondaryText}>{showFilters ? "FECHAR" : "PESQUISAR"}</Text></Pressable>
      </View>
      <Text testID="referrals-history-summary" accessibilityLiveRegion="polite" style={s.note}>{historyMonthLabel(month)} · {historyStatusLabel[status]} · {history.length} {history.length === 1 ? "registro" : "registros"}</Text>
      {showFilters ? <View style={s.filters}>
        <Text style={s.label}>MÊS DA INDICAÇÃO</Text>
        <View style={s.monthRow}>
          <Pressable testID="referrals-month-previous" accessibilityRole="button" accessibilityLabel="Consultar mês anterior" disabled={monthIndex < 0 || monthIndex >= months.length - 1} accessibilityState={{ disabled: monthIndex < 0 || monthIndex >= months.length - 1 }} onPress={() => { if (monthIndex >= 0 && monthIndex < months.length - 1) changeMonth(months[monthIndex + 1]!); }} style={[s.monthArrow, (monthIndex < 0 || monthIndex >= months.length - 1) && s.disabled]}><Text style={s.monthArrowText}>‹</Text></Pressable>
          <Text testID="referrals-month-label" style={s.monthLabel}>{historyMonthLabel(month)}</Text>
          <Pressable testID="referrals-month-next" accessibilityRole="button" accessibilityLabel="Consultar mês seguinte" disabled={monthIndex <= 0} accessibilityState={{ disabled: monthIndex <= 0 }} onPress={() => { if (monthIndex > 0) changeMonth(months[monthIndex - 1]!); }} style={[s.monthArrow, monthIndex <= 0 && s.disabled]}><Text style={s.monthArrowText}>›</Text></Pressable>
        </View>
        <Pressable testID="referrals-month-all" accessibilityRole="button" onPress={() => changeMonth(month ? "" : currentHistoryMonth())} style={s.textButton}><Text style={s.link}>{month ? "Pesquisar em todos os meses" : "Voltar ao mês atual"}</Text></Pressable>
        <View accessibilityRole="radiogroup" accessibilityLabel="Situação da indicação" style={s.statusFilters}>
          {(["completed", "pending", "cancelled", "review", "all"] as const).map(value => <Pressable key={value} testID={`referrals-status-${value}`} accessibilityRole="radio" accessibilityState={{ checked: status === value }} onPress={() => changeStatus(value)} style={[s.statusChip, status === value && s.statusSelected]}><Text style={[s.statusText, status === value && s.statusTextSelected]}>{historyStatusLabel[value]}</Text></Pressable>)}
        </View>
        <TextInput testID="referrals-search" accessibilityLabel="Pesquisar indicações por nome" placeholder="Pesquisar por nome" placeholderTextColor="#7693a0" value={search} onChangeText={value => { setSearch(value); setVisibleCount(HISTORY_PAGE_SIZE); }} maxLength={80} autoCorrect={false} returnKeyType="search" style={s.input} />
        <Pressable testID="referrals-reset-filters" accessibilityRole="button" accessibilityLabel="Limpar busca e voltar às concluídas do mês atual" onPress={resetFilters} style={s.textButton}><Text style={s.link}>Limpar filtros · concluídas deste mês</Text></Pressable>
        <Text style={s.note}>Consulta dos últimos 365 dias, limitada aos 200 registros mais recentes. O mês é o do cadastro da indicação. Nenhum registro é apagado pelos filtros.</Text>
      </View> : null}
      {history.length ? history.slice(0, visibleCount).map(item => <View testID={`referral-item-${item.id}`} key={item.id} style={s.historyItem}>
        <View style={s.historyMain}><Text numberOfLines={1} style={s.historyName}>{shortName(item.name)}</Text><Text style={s.note}>{dateLabel(item.createdAt)} · {itemStatus(item.status)}</Text></View>
        <View style={s.historyAmount}><Text style={s.historyValue}>{money(item.cashbackCents)}</Text><Text style={s.historyLabel}>Informado</Text></View>
      </View>) : <Text testID="referrals-empty" style={s.note}>Nenhuma indicação corresponde aos filtros. Use “Pesquisar” para consultar outros meses ou situações.</Text>}
      {visibleCount < history.length ? <Pressable testID="referrals-more" accessibilityRole="button" accessibilityLabel="Mostrar mais cinco indicações" onPress={() => setVisibleCount(count => Math.min(count + HISTORY_PAGE_SIZE, 200))} style={s.secondaryButton}><Text style={s.secondaryText}>MOSTRAR MAIS · {Math.min(visibleCount, history.length)} DE {history.length}</Text></Pressable> : null}
      {visibleCount > HISTORY_PAGE_SIZE ? <Pressable testID="referrals-less" accessibilityRole="button" accessibilityLabel="Mostrar apenas cinco indicações" onPress={() => setVisibleCount(HISTORY_PAGE_SIZE)} style={s.textButton}><Text style={s.link}>Mostrar menos</Text></Pressable> : null}
      <Text style={s.historyPrivacy}>Nomes abreviados · filtros não alteram os saldos acima.</Text>
    </NeonCard> : null}
  </>;
}

const s = StyleSheet.create({
  summaryCard: { padding: 17, gap: 10, backgroundColor: "rgba(34,27,10,.94)", borderColor: "#80651e" },
  card: { padding: 16, gap: 11, backgroundColor: "rgba(5,20,30,.94)", borderColor: "#28556d" },
  kicker: { color: "#ffdc83", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#f3f6ed", fontSize: 16, fontWeight: "800" },
  label: { color: "#ccb978", fontSize: 9, fontWeight: "800", letterSpacing: .8 },
  amount: { color: "#ffe39b", fontSize: 29, fontWeight: "900" },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  valueText: { flex: 1, minWidth: 0 },
  inviteHeadingText: { flex: 1, minWidth: 0, gap: 6 },
  note: { color: "#9eafa9", fontSize: 11, lineHeight: 16 },
  inline: { flexDirection: "row", alignItems: "center", gap: 9 },
  counts: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  count: { flex: 1, minWidth: 0, gap: 3 },
  countValue: { color: "#fff2c6", fontSize: 19, fontWeight: "900" },
  countLabel: { color: "#cabf9a", fontSize: 10 },
  divider: { height: 1, backgroundColor: "rgba(135,167,168,.18)", marginVertical: 2 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "#3c351f" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#ffdb7a" },
  tier: { borderTopWidth: 1, borderTopColor: "#443b25", paddingTop: 8, gap: 3 },
  tierTitle: { color: "#e5d7ac", fontSize: 11, fontWeight: "700" },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: "#79d8f5", padding: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#06151e", fontSize: 11, fontWeight: "900", textAlign: "center" },
  secondaryButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: "#40778b", padding: 10, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#a0e2f4", fontSize: 10, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: .55 },
  link: { color: "#87d8ed", fontSize: 11, fontWeight: "700", paddingVertical: 6 },
  invite: { gap: 6, paddingVertical: 5 },
  selectable: { color: "#d0ecf0", fontSize: 11, lineHeight: 17 },
  input: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: "#34576a", backgroundColor: "#061923", color: "#f0f5f5", paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 },
  error: { color: "#ffb9a8", fontSize: 12, lineHeight: 18 },
  success: { color: "#8ce4bd", fontSize: 12, lineHeight: 18 },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyHeading: { flex: 1, minWidth: 0 },
  filterToggle: { minHeight: 44, paddingHorizontal: 9, justifyContent: "center" },
  filters: { gap: 8, borderTopWidth: 1, borderTopColor: "#1e3944", paddingTop: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthArrow: { minWidth: 44, minHeight: 44, borderRadius: 10, backgroundColor: "#122c37", alignItems: "center", justifyContent: "center" },
  monthArrowText: { color: "#afe9f4", fontSize: 26 },
  monthLabel: { color: "#e2f1ed", fontSize: 12, textAlign: "center", textTransform: "capitalize", flex: 1, minWidth: 0, fontWeight: "700" },
  statusFilters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statusChip: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#294b58", justifyContent: "center" },
  statusSelected: { borderColor: "#77d5b2", backgroundColor: "#123a30" },
  statusText: { fontSize: 11, color: "#a5bdc5", fontWeight: "700" },
  statusTextSelected: { color: "#b0f1d8" },
  textButton: { minHeight: 44, justifyContent: "center" },
  historyPrivacy: { color: "#92a7ad", fontSize: 10, lineHeight: 15, paddingTop: 3 },
  historyItem: { flexDirection: "row", gap: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: "#1e3944", paddingTop: 10 },
  historyMain: { flex: 1, minWidth: 0, gap: 3 },
  historyName: { color: "#e4efed", fontSize: 12, fontWeight: "700" },
  historyAmount: { alignItems: "flex-end", gap: 3 },
  historyValue: { color: "#ddcf9b", fontSize: 12, fontWeight: "800" },
  historyLabel: { color: "#8c9a9c", fontSize: 8 },
});
