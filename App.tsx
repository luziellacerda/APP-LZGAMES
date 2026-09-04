import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  hasSession,
  HomeData,
  loadHome,
  login,
  logout,
  register,
  requestAccountDeletion,
} from "./src/api";
import { AgendaBooking } from "./src/AgendaBooking";
import { HyperspaceBackground } from "./src/HyperspaceBackground";
import { MatrixBackground } from "./src/MatrixRain";
import { RaffleDetails } from "./src/RaffleDetails";
import { ServiceOrderCard } from "./src/ServiceOrderCard";
import { TurboRamaDetails } from "./src/TurboRamaDetails";

type Tab = "inicio" | "os" | "agenda" | "turborama" | "sorteios" | "conta";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );

export default function App() {
  const [booting, setBooting] = useState(true),
    [signed, setSigned] = useState(false),
    [loading, setLoading] = useState(false);
  const [loginValue, setLoginValue] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [newName, setNewName] = useState(""),
    [newPhone, setNewPhone] = useState(""),
    [newEmail, setNewEmail] = useState(""),
    [newCpf, setNewCpf] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [data, setData] = useState<HomeData | null>(null),
    [tab, setTab] = useState<Tab>("inicio");
  const [deletePassword, setDeletePassword] = useState("");
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadHome());
      setSigned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setLoading(false);
      setBooting(false);
    }
  };
  useEffect(() => {
    hasSession().then((ok) => (ok ? refresh() : setBooting(false)));
  }, []);
  useEffect(() => {
    if (!signed || tab !== "sorteios") return;
    const timer = setInterval(
      () =>
        loadHome()
          .then(setData)
          .catch(() => {}),
      15000,
    );
    return () => clearInterval(timer);
  }, [signed, tab]);
  const enter = async () => {
    if (!loginValue.trim() || !password)
      return setError("Informe e-mail/WhatsApp e senha.");
    setLoading(true);
    setError("");
    try {
      await login(loginValue.trim(), password);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      setLoading(false);
    }
  };
  const createAccount = async () => {
    if (newPassword !== confirmPassword)
      return setError("As senhas não são iguais.");
    setLoading(true);
    setError("");
    try {
      await register({
        name: newName.trim(),
        phone: newPhone,
        email: newEmail.trim(),
        cpf: newCpf,
        password: newPassword,
      });
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível criar sua conta.",
      );
      setLoading(false);
    }
  };
  const exit = async () => {
    setLoading(true);
    await logout();
    setData(null);
    setSigned(false);
    setPassword("");
    setLoading(false);
  };
  const askAccountDeletion = () => {
    if (!deletePassword) return setError("Digite sua senha para confirmar a solicitação.");
    Alert.alert(
      "Solicitar exclusão da conta?",
      "Seu acesso será analisado para exclusão junto aos dados associados. Registros que precisem ser mantidos por obrigação legal serão preservados somente pelo prazo necessário.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Solicitar exclusão",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            setError("");
            try {
              const response = await requestAccountDeletion(deletePassword);
              setDeletePassword("");
              Alert.alert("Solicitação recebida", response?.message ?? "Enviaremos a confirmação para seus dados cadastrados.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Não foi possível enviar a solicitação.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  if (booting)
    return (
      <View style={s.loader}>
        <MatrixBackground />
        <Text style={s.logo}>
          LZ <Text style={s.logoAccent}>GAMES</Text>
        </Text>
        <ActivityIndicator color="#53f6a7" />
      </View>
    );
  if (!signed)
    return (
      <SafeAreaView style={s.safe}>
        <MatrixBackground />
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={s.loginWrap}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.loginHudTop}><Text style={s.hudCode}>LZ // PLAYER ACCESS</Text><View style={s.hudOnline}><View style={s.hudDot}/><Text style={s.hudOnlineText}>SERVIDOR ONLINE</Text></View></View>
          <View style={s.brandStage}><View style={s.brandGlow}/><View style={s.logoFrame}><Image source={require('./assets/icon.png')} style={s.loginLogo} resizeMode="contain"/></View><Text style={s.eyebrow}>{authMode === "login" ? "SUA CENTRAL GAMER" : "NOVO JOGADOR"}</Text><Text style={s.title}>LZ <Text style={s.logoAccent}>GAMES</Text></Text><Text style={s.subtitle}>{authMode === "login" ? "Seu universo de serviços, benefícios e tecnologia." : "Crie seu perfil e entre no ecossistema LZ Games."}</Text></View>
          <View style={s.authPanel}><View style={s.panelEdgeLeft}/><View style={s.panelEdgeRight}/>
          <View style={s.authTabs}>
            <Pressable
              style={[s.authTab, authMode === "login" && s.authTabActive]}
              onPress={() => {
                setAuthMode("login");
                setError("");
              }}
            >
              <Text
                style={[
                  s.authTabText,
                  authMode === "login" && s.authTabTextActive,
                ]}
              >
                ENTRAR
              </Text>
            </Pressable>
            <Pressable
              style={[s.authTab, authMode === "register" && s.authTabActive]}
              onPress={() => {
                setAuthMode("register");
                setError("");
              }}
            >
              <Text
                style={[
                  s.authTabText,
                  authMode === "register" && s.authTabTextActive,
                ]}
              >
                CRIAR CONTA
              </Text>
            </Pressable>
          </View>
          {authMode === "login" ? (
            <View style={s.form}>
              <Text style={s.inputLabel}>IDENTIFICAÇÃO DO JOGADOR</Text><View style={s.inputShell}><Text style={s.inputIcon}>◈</Text><TextInput
                style={s.inputInner}
                placeholder="E-mail ou WhatsApp"
                placeholderTextColor="#71817a"
                value={loginValue}
                onChangeText={setLoginValue}
                autoCapitalize="none"
              /></View>
              <Text style={s.inputLabel}>CHAVE DE ACESSO</Text><View style={s.inputShell}><Text style={s.inputIcon}>⌁</Text><TextInput
                style={s.inputInner}
                placeholder="Senha"
                placeholderTextColor="#71817a"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={enter}
              /></View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pressable style={s.primary} onPress={enter} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#06110d" />
                ) : (
                  <Text style={s.primaryText}>INICIAR SESSÃO  ▶</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={s.form}>
              <TextInput
                style={s.input}
                placeholder="Nome completo"
                placeholderTextColor="#71817a"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
              />
              <TextInput
                style={s.input}
                placeholder="WhatsApp com DDD"
                placeholderTextColor="#71817a"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={s.input}
                placeholder="E-mail"
                placeholderTextColor="#71817a"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={s.input}
                placeholder="CPF"
                placeholderTextColor="#71817a"
                value={newCpf}
                onChangeText={setNewCpf}
                keyboardType="number-pad"
              />
              <TextInput
                style={s.input}
                placeholder="Senha (mínimo 8 caracteres, letras e números)"
                placeholderTextColor="#71817a"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={s.input}
                placeholder="Confirmar senha"
                placeholderTextColor="#71817a"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Text style={s.consent}>
                Ao criar a conta, você aceita os Termos de Uso e a Política de
                Privacidade da LZ Games.
              </Text>
              <Pressable
                style={s.primary}
                onPress={createAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#06110d" />
                ) : (
                  <Text style={s.primaryText}>CRIAR MINHA CONTA</Text>
                )}
              </Pressable>
            </View>
          )}
          </View>
          <Text style={s.security}>
            ◉ CONEXÃO CRIPTOGRAFADA  •  LZ SECURE NETWORK
          </Text>
        </ScrollView>
      </SafeAreaView>
    );

  const firstName = data?.user.name.split(" ")[0] ?? "Cliente";
  const appointments = (data?.services.scheduling.appointments ?? []).filter(
    (a) => {
      const status = String(a.status ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return (
        ![
          "cancelado",
          "cancelada",
          "cancelled",
          "canceled",
          "apagado",
          "excluido",
          "deleted",
        ].includes(status) && !a.deleted_at
      );
    },
  );
  return (
    <SafeAreaView style={s.safe}>
      {tab === "agenda" ? <HyperspaceBackground /> : <MatrixBackground />}
      <StatusBar style="light" />
      <View style={s.header}>
        <View>
          <Text style={s.miniLogo}>
            LZ <Text style={s.logoAccent}>GAMES</Text>
          </Text>
          <Text style={s.greeting}>Olá, {firstName}</Text>
        </View>
        <View style={s.online}>
          <View style={s.dot} />
          <Text style={s.onlineText}>ONLINE</Text>
        </View>
      </View>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#53f6a7"
          />
        }
      >
        {error ? <Text style={s.error}>{error}</Text> : null}
        {tab === "inicio" && (
          <>
            <Text style={s.sectionTitle}>Sua central</Text>
            <Pressable style={[s.hero, s.green]} onPress={() => setTab("os")}>
              <Text style={s.cardEmoji}>🛠️</Text>
              <Text style={s.cardTag}>ASSISTÊNCIA TÉCNICA</Text>
              <Text style={s.cardTitle}>Minhas OS</Text>
              <Text style={s.cardText}>
                {data?.services.assistance.orders.length ?? 0} ordem(ns) de
                serviço
              </Text>
              <Text style={s.arrow}>ACOMPANHAR →</Text>
            </Pressable>
            <Pressable
              style={[s.hero, s.blue]}
              onPress={() => setTab("agenda")}
            >
              <Text style={s.cardEmoji}>📅</Text>
              <Text style={s.cardTag}>ATENDIMENTOS</Text>
              <Text style={s.cardTitle}>Agenda</Text>
              <Text style={s.cardText}>
                {appointments.length} agendamento(s)
              </Text>
              <Text style={s.arrow}>CONSULTAR →</Text>
            </Pressable>
            <Pressable
              style={[s.hero, s.purple]}
              onPress={() => setTab("turborama")}
            >
              <Text style={s.cardEmoji}>🚀</Text>
              <Text style={s.cardTag}>SUITE E LICENÇAS</Text>
              <Text style={s.cardTitle}>TurboRama</Text>
              <Text style={s.cardText}>
                {data?.services.turborama.licenses.length ?? 0} licença(s)
                vinculada(s)
              </Text>
              <Text style={s.arrow}>ABRIR →</Text>
            </Pressable>
            <Pressable
              style={[s.hero, s.raffle]}
              onPress={() => setTab("sorteios")}
            >
              <Text style={s.cardEmoji}>🏆</Text>
              <Text style={s.cardTag}>PRÊMIOS E CAMPANHAS</Text>
              <Text style={s.cardTitle}>Sorteios</Text>
              <Text style={s.cardText}>
                {data?.services.raffles.participantCount ?? 0} participante(s)
                na lista oficial
              </Text>
              <Text style={s.arrow}>VER SORTEIOS →</Text>
            </Pressable>
          </>
        )}
        {tab === "os" && (
          <>
            <Text style={s.sectionTitle}>Assistência</Text>
            <Text style={s.sectionSub}>
              Acompanhe suas ordens de serviço em tempo real.
            </Text>
            {data?.connections.assistance ? (
              data.services.assistance.orders.length ? (
                data.services.assistance.orders.map((o, i) => (
                  <ServiceOrderCard order={o} key={String(o.os_id ?? o.id ?? i)} />
                ))
              ) : (
                <Empty text="Nenhuma ordem de serviço encontrada para seu WhatsApp." />
              )
            ) : (
              <Empty text="Entre usando seu WhatsApp cadastrado na assistência para vincular suas OS." />
            )}
          </>
        )}
        {tab === "agenda" && (
          <>
            <Text style={s.sectionTitle}>Agendamentos</Text>
            <Text style={s.sectionSub}>
              Agende seu horário e receba a confirmação no WhatsApp.
            </Text>
            <AgendaBooking
              document={data?.user.document ?? ""}
              onBooked={refresh}
            />
            {appointments.length ? (
              appointments.map((a, i) => (
                <View
                  style={[s.item, s.agenda]}
                  key={String(a.agendamento_id ?? a.id ?? i)}
                >
                  <View style={s.itemIcon}>
                    <Text>📅</Text>
                  </View>
                  <View style={s.itemBody}>
                    <Text style={s.itemTitle}>
                      {String(a.servico_nome ?? "Atendimento")}
                    </Text>
                    <Text style={s.itemText}>
                      {String(
                        a.data_hora ?? `${a.data_d ?? ""} ${a.hora_i ?? ""}`,
                      )}
                    </Text>
                    <Text style={s.itemText}>
                      Profissional: {String(a.profissional_nome ?? "A definir")}
                    </Text>
                    <Text style={s.active}>
                      ● {String(a.status ?? "PENDENTE").toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Empty text="Nenhum agendamento encontrado para seu WhatsApp." />
            )}
          </>
        )}
        {tab === "turborama" && data && (
          <>
            <Text style={s.sectionTitle}>TurboRama</Text>
            <Text style={s.sectionSub}>
              Conta, pacotes, licenças e compras vinculadas.
            </Text>
            <TurboRamaDetails data={data} />
          </>
        )}
        {tab === "sorteios" && data && (
          <>
            <Text style={s.sectionTitle}>Sorteios</Text>
            <Text style={s.sectionSub}>
              Campanhas, participação e transmissões oficiais.
            </Text>
            <RaffleDetails data={data.services.raffles} user={data.user} />
          </>
        )}
        {tab === "conta" && (
          <>
            <Text style={s.sectionTitle}>Minha conta</Text>
            <View style={s.profile}>
              <Text style={s.avatar}>{firstName[0]?.toUpperCase()}</Text>
              <Text style={s.profileName}>{data?.user.name}</Text>
              <Text style={s.itemText}>{data?.user.email}</Text>
              <Text style={s.itemText}>
                {data?.user.phone || "WhatsApp não informado"}
              </Text>
            </View>
            <Pressable style={s.logout} onPress={exit}>
              <Text style={s.logoutText}>SAIR DA CONTA</Text>
            </Pressable>
            <View style={s.legalLinks}>
              <Pressable onPress={() => Linking.openURL("https://app.lzgames.com.br/privacidade/")}>
                <Text style={s.legalLink}>Política de Privacidade</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL("https://app.lzgames.com.br/excluir-conta/")}>
                <Text style={s.legalLink}>Informações sobre exclusão</Text>
              </Pressable>
            </View>
            <View style={s.deleteBox}>
              <Text style={s.deleteTitle}>Excluir minha conta</Text>
              <Text style={s.deleteText}>
                Para sua segurança, confirme sua senha. A solicitação será registrada e processada conforme nossa Política de Privacidade.
              </Text>
              <TextInput
                style={s.input}
                placeholder="Digite sua senha"
                placeholderTextColor="#71817a"
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
              />
              <Pressable style={s.deleteButton} onPress={askAccountDeletion} disabled={loading}>
                <Text style={s.deleteButtonText}>SOLICITAR EXCLUSÃO</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
      <View style={s.nav}>
        {(
          ["inicio", "os", "agenda", "turborama", "sorteios", "conta"] as Tab[]
        ).map((t, i) => (
          <Pressable key={t} style={s.navItem} onPress={() => setTab(t)}>
            <Text style={[s.navIcon, tab === t && s.navActive]}>
              {["⌂", "🔧", "▣", "⚡", "★", "●"][i]}
            </Text>
            <Text style={[s.navText, tab === t && s.navActive]}>
              {["Início", "OS", "Agenda", "Turbo", "Sorteios", "Conta"][i]}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyIcon}>◌</Text>
      <Text style={s.itemText}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#06100d" },
  loader: {
    flex: 1,
    backgroundColor: "#06100d",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  logo: { color: "#fff", fontSize: 35, fontWeight: "900", letterSpacing: 2 },
  logoAccent: { color: "#53f6a7" },
  loginWrap: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 28 },
  loginHudTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  hudCode: { color: "#5d7a6e", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  hudOnline: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#174d39", backgroundColor: "rgba(7,31,22,.86)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5 },
  hudDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#53f6a7", shadowColor: "#53f6a7", shadowOpacity: 1, shadowRadius: 6 },
  hudOnlineText: { color: "#53f6a7", fontSize: 7, fontWeight: "900", letterSpacing: .7 },
  brandStage: { alignItems: "center", marginBottom: 20 },
  brandGlow: { position: "absolute", top: 10, width: 190, height: 100, borderRadius: 95, backgroundColor: "rgba(35,255,145,.10)", shadowColor: "#53f6a7", shadowOpacity: .7, shadowRadius: 35 },
  logoFrame: { width: 88, height: 88, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: "rgba(83,246,167,.55)", backgroundColor: "rgba(5,18,13,.88)", transform: [{ rotate: "45deg" }], marginBottom: 20, shadowColor: "#53f6a7", shadowOpacity: .42, shadowRadius: 18 },
  loginLogo: { width: 70, height: 70, transform: [{ rotate: "-45deg" }] },
  eyebrow: {
    color: "#53f6a7",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3.4,
    marginBottom: 7,
  },
  title: { color: "#fff", fontSize: 39, fontWeight: "900", letterSpacing: 1.8, textShadowColor: "rgba(83,246,167,.45)", textShadowRadius: 14 },
  subtitle: { color: "#9fb1a9", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center", maxWidth: 320 },
  authPanel: { position: "relative", borderWidth: 1, borderColor: "rgba(83,246,167,.24)", backgroundColor: "rgba(4,15,11,.93)", borderRadius: 22, padding: 14, shadowColor: "#000", shadowOpacity: .7, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  panelEdgeLeft: { position: "absolute", left: -1, top: 28, bottom: 28, width: 2, backgroundColor: "#53f6a7", borderRadius: 2 },
  panelEdgeRight: { position: "absolute", right: -1, top: 55, bottom: 55, width: 1, backgroundColor: "#1d7150" },
  authTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(12,32,24,.9)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  authTab: {
    flex: 1,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  authTabActive: { backgroundColor: "#163b2c", borderWidth: 1, borderColor: "#2b7958" },
  authTabText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#71817a",
    letterSpacing: 1,
  },
  authTabTextActive: { color: "#53f6a7" },
  consent: { fontSize: 11, lineHeight: 16, color: "#84958d" },
  form: { gap: 11 },
  inputLabel: { color: "#648076", fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginLeft: 3, marginTop: 2 },
  inputShell: { height: 57, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#214739", backgroundColor: "rgba(7,24,18,.96)", borderRadius: 13, paddingHorizontal: 14 },
  inputIcon: { color: "#53f6a7", width: 27, fontSize: 17, textShadowColor: "#53f6a7", textShadowRadius: 8 },
  inputInner: { flex: 1, height: 55, color: "#fff", fontSize: 15, paddingVertical: 0 },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: "#1b3129",
    backgroundColor: "#0b1a15",
    borderRadius: 14,
    paddingHorizontal: 17,
    color: "#fff",
    fontSize: 16,
  },
  primary: {
    height: 58,
    borderRadius: 14,
    backgroundColor: "#53f6a7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#aaffd0",
    shadowColor: "#53f6a7",
    shadowOpacity: .48,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryText: {
    color: "#06110d",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  error: { color: "#ff7d7d", fontSize: 14, marginVertical: 4 },
  security: {
    color: "#597067",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: .8,
    textAlign: "center",
    marginTop: 26,
  },
  header: {
    height: 82,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#13251e",
    backgroundColor: "rgba(6,16,13,.84)",
  },
  miniLogo: {
    fontSize: 15,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 1,
  },
  greeting: { fontSize: 13, color: "#91a097", marginTop: 4 },
  online: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0d2119",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#53f6a7" },
  onlineText: { fontSize: 10, fontWeight: "800", color: "#53f6a7" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 30, gap: 10 },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    marginTop: 5,
    textShadowColor: "#000",
    textShadowRadius: 8,
  },
  sectionSub: {
    fontSize: 14,
    color: "#b7c8d7",
    marginTop: -5,
    marginBottom: 8,
    textShadowColor: "#000",
    textShadowRadius: 6,
  },
  hero: {
    height: 112,
    borderRadius: 17,
    padding: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  green: { backgroundColor: "#123c2d" },
  blue: { backgroundColor: "#123044" },
  purple: { backgroundColor: "#281e46" },
  raffle: { backgroundColor: "#432052" },
  cardEmoji: {
    position: "absolute",
    right: 16,
    top: 12,
    fontSize: 31,
    opacity: 0.95,
  },
  cardTag: {
    position: "absolute",
    top: 13,
    left: 16,
    color: "#b7c5bf",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  cardTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  cardText: { color: "#b8c5c0", fontSize: 11, marginTop: 2 },
  arrow: {
    position: "absolute",
    right: 15,
    bottom: 17,
    color: "#53f6a7",
    fontSize: 9,
    fontWeight: "900",
  },
  item: {
    backgroundColor: "#0b1914",
    borderWidth: 1,
    borderColor: "#193027",
    padding: 16,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  license: { borderColor: "#30265b" },
  agenda: { borderColor: "#2d78a5", backgroundColor: "rgba(6,18,30,.88)" },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: "#142a21",
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, color: "#f4f7f5", fontWeight: "800" },
  itemText: { fontSize: 12, color: "#84958d", marginTop: 3 },
  progress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1b3028",
    marginTop: 10,
  },
  progressValue: { height: 4, borderRadius: 2, backgroundColor: "#53f6a7" },
  smallTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#76867f",
    marginTop: 17,
  },
  purchase: {
    backgroundColor: "#0b1914",
    padding: 16,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { color: "#53f6a7", fontWeight: "800" },
  active: { fontSize: 10, color: "#53f6a7", fontWeight: "900", marginTop: 9 },
  empty: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "rgba(6,18,30,.88)",
    borderRadius: 18,
  },
  emptyIcon: { fontSize: 32, color: "#52635c", marginBottom: 8 },
  profile: {
    alignItems: "center",
    backgroundColor: "#0b1914",
    borderRadius: 20,
    padding: 28,
    gap: 3,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: "#53f6a7",
    color: "#06110d",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 9,
  },
  profileName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  logout: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#49302f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  logoutText: {
    color: "#ff8a83",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  legalLinks: { alignItems: "center", gap: 12, paddingVertical: 12 },
  legalLink: { color: "#9eb7ad", fontSize: 13, textDecorationLine: "underline" },
  deleteBox: { marginTop: 4, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: "#4d2928", backgroundColor: "#170f0e", gap: 12 },
  deleteTitle: { color: "#ffaca6", fontSize: 17, fontWeight: "800" },
  deleteText: { color: "#aa918e", fontSize: 12, lineHeight: 18 },
  deleteButton: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#7a3633", alignItems: "center", justifyContent: "center" },
  deleteButtonText: { color: "#ff8a83", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  nav: {
    height: 94,
    borderTopWidth: 1,
    borderTopColor: "#172921",
    backgroundColor: "rgba(8,20,15,.97)",
    flexDirection: "row",
    paddingTop: 5,
    paddingBottom: 23,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  navIcon: { color: "#65766e", fontSize: 16, fontWeight: "800" },
  navText: { color: "#65766e", fontSize: 8, fontWeight: "700" },
  navActive: { color: "#53f6a7" },
});
