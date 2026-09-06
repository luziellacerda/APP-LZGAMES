import { StatusBar } from "expo-status-bar";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  AgendaStore,
  AppPresence,
  RaffleAnnouncement,
  loadHome,
  loadRaffleInbox,
  login,
  logout,
  register,
  requestAccountDeletion,
  syncRafflePresence,
  acceptReferralInvite,
  validateReferralInvite,
} from "./src/api";
import { completeReferralEntry } from "./src/referralEntry";
import { AgendaBooking } from "./src/AgendaBooking";
import { AppointmentCard } from "./src/AppointmentCard";
import { ReferralRewards } from "./src/ReferralRewards";
import { Marketplace } from "./src/Marketplace";
import { HyperspaceBackground } from "./src/HyperspaceBackground";
import { MatrixBackground } from "./src/MatrixRain";
import { RaffleDetails } from "./src/RaffleDetails";
import { ServiceOrderCard } from "./src/ServiceOrderCard";
import { TurboRamaDetails } from "./src/TurboRamaDetails";
import { MotionProvider, MotionScrollView } from "./src/effects/Motion";
import { AnimatedIcon, NeonCard } from "./src/effects/Neon";
import { CardLottie } from "./src/effects/CardLottie";
import { type AnimatedIconName } from "./src/effects/animations";
import { SpaceflightBackground } from "./src/effects/Spaceflight";
import { CoinRainBackground } from "./src/effects/CoinRainBackground";
import { TrophyLottie } from "./src/effects/TrophyLottie";
import { ElectricMenuEffects, type MenuBounds } from "./src/effects/ElectricMenu";
import { PreviewRevision } from "./src/effects/PreviewRevision";
import { dismissRaffleNotifications, preparePushRegistration, supportsRemotePush, useRafflePush } from "./src/push";

type Tab = "inicio" | "os" | "agenda" | "turborama" | "sorteios" | "conta" | "cashback" | "marketplace";
function announcementDestination(type:RaffleAnnouncement['event_type']):{screen:Tab;tag:string;action:string}|null{
  switch(type){
    case 'service_order':return {screen:'os',tag:'◉ AVISO DE OS',action:'VER ORDEM DE SERVIÇO →'};
    case 'appointment':return {screen:'agenda',tag:'◉ AVISO DE AGENDAMENTO',action:'VER AGENDAMENTO →'};
    case 'raffle':case null:case undefined:return {screen:'sorteios',tag:'◉ AVISO DE SORTEIO',action:'VER CAMPANHA →'};
    default:return null;
  }
}
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );

export default function App() {
  return <MotionProvider><AppContent /></MotionProvider>;
}

function AppContent() {
  const [menuBounds, setMenuBounds] = useState<MenuBounds[]>([]);
  const [menuEffectsReady, setMenuEffectsReady] = useState(false);
  const [booting, setBooting] = useState(true),
    [signed, setSigned] = useState(false),
    [loading, setLoading] = useState(false);
  const [loginValue, setLoginValue] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [entryInvite,setEntryInvite]=useState("");
  const [showEntryInvite,setShowEntryInvite]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const entryFlow=useRef({authenticated:false,busy:false});
  const [newName, setNewName] = useState(""),
    [newPhone, setNewPhone] = useState(""),
    [newEmail, setNewEmail] = useState(""),
    [newCpf, setNewCpf] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [data, setData] = useState<HomeData | null>(null),
    [tab, setTab] = useState<Tab>("inicio");
  const [deletePassword, setDeletePassword] = useState("");
  const [agendaStore, setAgendaStore] = useState<AgendaStore | null>(null);
  const [appPresence, setAppPresence] = useState<AppPresence | null>(null);
  const [announcements, setAnnouncements] = useState<RaffleAnnouncement[]>([]);
  const [pushBusy,setPushBusy]=useState(false);
  const [raffleMessagingBusy, setRaffleMessagingBusy] = useState(false);
  useRafflePush(signed,{
    onInbox:(presence,items)=>{setAppPresence(presence);setAnnouncements(items);},
    onOpen:(screen)=>{setTab(screen);void loadHome().then(setData).catch(()=>{});},
  });
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const home=await loadHome();
      setData(home);
      setSigned(true);
      const presence=await syncRafflePresence().catch(()=>null);
      if(presence)setAppPresence(presence);
      const inbox=await loadRaffleInbox().catch(()=>null);
      if(inbox){setAppPresence(inbox.presence);setAnnouncements(inbox.announcements);}
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
      return false;
    } finally {
      setLoading(false);
      setBooting(false);
    }
  };
  useEffect(() => {
    hasSession().then(async (ok) => { if(ok)await refresh();else setBooting(false); });
  }, []);
  useEffect(() => {
    if (!signed || tab !== "sorteios") return;
    const timer = setInterval(
      () => {
        if(AppState.currentState!=='active')return;
        void loadRaffleInbox().then(inbox=>{setAppPresence(inbox.presence);setAnnouncements(inbox.announcements);}).catch(()=>{});
        void loadHome()
          .then(setData)
          .catch(() => {});
      },
      15000,
    );
    return () => clearInterval(timer);
  }, [signed, tab]);
  const enter = async () => {
    if(loading||entryFlow.current.busy)return;
    if (!authReady && (!loginValue.trim() || !password))
      return setError("Informe e-mail/WhatsApp e senha.");
    setLoading(true);
    setError("");
    try {
      const done=await completeReferralEntry(entryFlow.current,entryInvite,{
        validate:validateReferralInvite,authenticate:()=>login(loginValue.trim(),password),
        onAuthenticated:()=>setAuthReady(true),bind:acceptReferralInvite,open:refresh,
      });
      if(done){setAuthReady(false);setEntryInvite("");setShowEntryInvite(false);}
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
      setLoading(false);
    }
  };
  const createAccount = async () => {
    if(loading||entryFlow.current.busy)return;
    if (!authReady && newPassword !== confirmPassword)
      return setError("As senhas não são iguais.");
    setLoading(true);
    setError("");
    try {
      const done=await completeReferralEntry(entryFlow.current,entryInvite,{
        validate:validateReferralInvite,authenticate:()=>register({
        name: newName.trim(),
        phone: newPhone,
        email: newEmail.trim(),
        cpf: newCpf,
        password: newPassword,
        }),onAuthenticated:()=>setAuthReady(true),bind:acceptReferralInvite,open:refresh,
      });
      if(done){setAuthReady(false);setEntryInvite("");setShowEntryInvite(false);}
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível criar sua conta.",
      );
      setLoading(false);
    }
  };
  const exit = async () => {
    if(loading||pushBusy)return;
    setLoading(true);
    let remoteUnlinked=false;
    try { ({remoteUnlinked}=await logout()); }
    catch { Alert.alert('Não foi possível sair','Conecte-se à internet e tente novamente para desvincular com segurança os avisos deste aparelho.');setLoading(false);return; }
    await dismissRaffleNotifications().catch(()=>{});
    setData(null);
    setAppPresence(null);
    setAnnouncements([]);
    setSigned(false);
    entryFlow.current.authenticated=false;
    setAuthReady(false);setAuthMode("login");setEntryInvite("");setShowEntryInvite(false);
    setPassword("");
    setLoading(false);
    if(!remoteUnlinked)Alert.alert('Sessão encerrada neste celular','Sua sessão estava expirada. Os dados de acesso locais foram removidos, mas não foi possível confirmar a desvinculação dos avisos no servidor. Você pode desativar as notificações do LZ-GAMES nas configurações do celular.');
  };
  const updatePush=async()=>{
    if(pushBusy||loading||raffleMessagingBusy)return;
    setPushBusy(true);
    try{
      if(appPresence?.push?.enabled){
        const presence=await syncRafflePresence(undefined,{enabled:false,permission:'undetermined',token:null});
        setAppPresence(presence);
        await dismissRaffleNotifications('raffles').catch(()=>{});
        return;
      }
      const registration=await preparePushRegistration(true);
      const presence=await syncRafflePresence(undefined,registration);
      setAppPresence(presence);
      if(!registration.enabled){
        Alert.alert('Notificações não autorizadas','Você continua usando o app normalmente. Para receber avisos, permita as notificações nas configurações do celular.',[
          {text:'Agora não',style:'cancel'},{text:'Abrir configurações',onPress:()=>{void Linking.openSettings();}},
        ]);
      }else Alert.alert('Notificações ativadas','Este celular está cadastrado para receber avisos de sorteios. Toque no aviso para abrir a aba Sorteios.');
    }catch(e){Alert.alert('Notificações',e instanceof Error?e.message:'Não foi possível atualizar as notificações.');}
    finally{setPushBusy(false);}
  };
  const updateServicePush=async()=>{
    if(pushBusy||loading||raffleMessagingBusy)return;
    setPushBusy(true);
    try{
      if(appPresence?.push?.serviceEnabled){
        const presence=await syncRafflePresence(undefined,{scope:'services',enabled:false,permission:'undetermined',token:null});
        setAppPresence(presence);
        await dismissRaffleNotifications('services').catch(()=>{});
        return;
      }
      const registration=await preparePushRegistration(true);
      const presence=await syncRafflePresence(undefined,{...registration,scope:'services'});
      setAppPresence(presence);
      if(!registration.enabled){
        Alert.alert('Notificações não autorizadas','Para receber avisos de OS e agendamentos, permita as notificações nas configurações do celular.',[
          {text:'Agora não',style:'cancel'},
          {text:'Abrir configurações',onPress:()=>{void Linking.openSettings().catch(()=>{Alert.alert('Configurações','Abra as configurações do celular e permita as notificações do LZ-GAMES.');});}},
        ]);
      }else Alert.alert('Avisos de OS e agendamentos ativados','Este celular receberá alterações de status das OS, lembretes de OS ativas há 3 dias sem alterações e avisos de agendamentos 6, 3 e 1 hora antes. Toque no aviso para abrir a tela correspondente.');
    }catch(e){Alert.alert('OS e agendamentos',e instanceof Error?e.message:'Não foi possível atualizar os avisos. Tente novamente.');}
    finally{setPushBusy(false);}
  };
  const updateRaffleMessaging = async (enabled:boolean) => {
    if (loading || pushBusy || raffleMessagingBusy) return;
    setRaffleMessagingBusy(true);
    setLoading(true);
    setError("");
    try {
      const presence=await syncRafflePresence(enabled);
      setAppPresence(presence);
      Alert.alert(enabled?"Avisos ativados":"Avisos desativados",enabled?"Você receberá comunicados de sorteios pelo WhatsApp cadastrado. Você pode desligar quando quiser.":"Você não receberá mais avisos promocionais de sorteios pelo WhatsApp.");
    } catch (e) {
      Alert.alert("Avisos de sorteios", e instanceof Error?e.message:"Não foi possível atualizar sua preferência. Tente novamente.");
    } finally {
      setRaffleMessagingBusy(false);
      setLoading(false);
    }
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
        <PreviewRevision />
        <ScrollView
          contentContainerStyle={s.loginWrap}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.loginHudTop}><Text style={s.hudCode}>LZ // PLAYER ACCESS</Text><View style={s.hudOnline}><View style={s.hudDot}/><Text style={s.hudOnlineText}>SERVIDOR ONLINE</Text></View></View>
          <View style={s.authPanel}>
          <View style={s.brandStage}><Text style={s.miniBrand}>LZ <Text style={s.logoAccent}>GAMES</Text></Text><Text style={s.title}>{authMode === "login" ? "PORTAL DO CLIENTE" : "CRIAR CONTA"}</Text><Text style={s.eyebrow}>{authMode === "login" ? "SERVIÇOS · BENEFÍCIOS · TECNOLOGIA" : "NOVO ACESSO · AMBIENTE SEGURO"}</Text><View style={s.brandDivider}><View style={s.dividerLight}/></View></View>
          <View style={s.authTabs}>
            <Pressable
              disabled={loading||authReady}
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
              disabled={loading||authReady}
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
          <Pressable testID="entry-invite-toggle" accessibilityRole="button" accessibilityState={{expanded:showEntryInvite}} disabled={loading} onPress={()=>setShowEntryInvite(value=>!value)}>
            <Text style={s.consent}>{showEntryInvite?"INDICAÇÃO (OPCIONAL)":"RECEBI UM CONVITE  +"}</Text>
          </Pressable>
          {showEntryInvite?<View style={s.form}>
            <TextInput testID="entry-invite-input" accessibilityLabel="Convite recebido antes do primeiro acesso" style={s.input} value={entryInvite} onChangeText={setEntryInvite} editable={!loading} autoCapitalize="none" autoCorrect={false} maxLength={2048} placeholder="Cole o código ou link do convite" placeholderTextColor="#71817a" />
            <Text style={s.consent}>Ao continuar com um convite preenchido, você autoriza vinculá-lo à sua conta. No primeiro acesso elegível ao app, quem indicou recebe R$ 9,90 em crédito para serviços, sem saque. Acessos anteriores não geram novo bônus.</Text>
          </View>:null}
          {authReady?<Text style={s.consent}>Sua conta já foi acessada. Confira o convite e continue; não é necessário cadastrar novamente. Para entrar sem indicação, apague o convite antes de continuar.</Text>:null}
          {authReady?<Pressable accessibilityRole="button" disabled={loading} onPress={exit}><Text style={s.consent}>SAIR DESTA CONTA</Text></Pressable>:null}
          {authMode === "login" ? (
            <View style={s.form}>
                <Text style={s.inputLabel}>IDENTIFICAÇÃO DO JOGADOR</Text><View style={s.inputShell}><Text style={s.inputIcon}>◈</Text><TextInput
                style={s.inputInner}
                placeholder="E-mail ou WhatsApp"
                placeholderTextColor="#71817a"
                value={loginValue}
                editable={!loading&&!authReady}
                onChangeText={setLoginValue}
                autoCapitalize="none"
              /></View>
              <Text style={s.inputLabel}>CHAVE DE ACESSO</Text><View style={s.inputShell}><Text style={s.inputIcon}>⌁</Text><TextInput
                style={s.inputInner}
                placeholder="Senha"
                placeholderTextColor="#71817a"
                value={password}
                editable={!loading&&!authReady}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={enter}
              /></View>
              {error ? <Text style={s.error}>{error}</Text> : null}
              <Pressable style={s.primary} onPress={enter} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#06110d" />
                ) : (
                  <Text style={s.primaryText}>{authReady?"CONTINUAR  ▶":"INICIAR SESSÃO  ▶"}</Text>
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
                editable={!loading&&!authReady}
                onChangeText={setNewName}
                autoCapitalize="words"
              />
              <TextInput
                style={s.input}
                placeholder="WhatsApp com DDD"
                placeholderTextColor="#71817a"
                value={newPhone}
                editable={!loading&&!authReady}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={s.input}
                placeholder="E-mail"
                placeholderTextColor="#71817a"
                value={newEmail}
                editable={!loading&&!authReady}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={s.input}
                placeholder="CPF"
                placeholderTextColor="#71817a"
                value={newCpf}
                editable={!loading&&!authReady}
                onChangeText={setNewCpf}
                keyboardType="number-pad"
              />
              <TextInput
                style={s.input}
                placeholder="Senha (mínimo 8 caracteres, letras e números)"
                placeholderTextColor="#71817a"
                value={newPassword}
                editable={!loading&&!authReady}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={s.input}
                placeholder="Confirmar senha"
                placeholderTextColor="#71817a"
                value={confirmPassword}
                editable={!loading&&!authReady}
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
                  <Text style={s.primaryText}>{authReady?"CONTINUAR":"CRIAR MINHA CONTA"}</Text>
                )}
              </Pressable>
            </View>
          )}
          <View pointerEvents="none" style={s.portalLottie}><LottieView source={{uri:'https://turbobox.lzgames.com.br/assets/lottie/login-original.json?v=20260826-8'}} autoPlay loop style={s.brandLottieFill}/><Text style={s.portalLottieLabel}>PORTAL LZ GAMES</Text></View>
          </View>
          <Text style={s.security}>
            ◉ CONEXÃO CRIPTOGRAFADA  •  LZ SECURE NETWORK
          </Text>
        </ScrollView>
      </SafeAreaView>
    );

  const firstName = data?.user.name.split(" ")[0] ?? "Cliente";
  const menuTab = tab === "cashback" ? "conta" : tab === "marketplace" ? "inicio" : tab;
  const cashbackEntry=(location:string)=>(
    <NeonCard testID={`referral-entry-${location}`} color="#ffd66b" radius={16} style={s.referralEntry}
      accessibilityRole="button" accessibilityLabel="Indique e ganhe cashback. Ver indicações e compartilhar convite."
      onPress={()=>setTab("cashback")}>
      <CardLottie kind="entry" width={52} height={44} />
      <View style={s.referralEntryBody}>
        <Text style={s.referralEntryTitle}>Indique e ganhe cashback</Text>
        <Text style={s.referralEntryText}>Seu convite, suas indicações e valores aprovados.</Text>
      </View>
      <Text style={s.referralEntryArrow}>↗</Text>
    </NeonCard>
  );
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
  const inboxCard=announcements.length ? (
    <NeonCard color="#ffd66b" style={[s.noticeCard,s.notice]}>
      <Text style={s.noticeTag}>CENTRAL DE AVISOS</Text>
      {announcements.slice(0,3).map(announcement=>{
        const destination=announcementDestination(announcement.event_type);
        return <Pressable key={announcement.id} testID={`inbox-announcement-${announcement.id}`} style={s.inboxItem}
          disabled={!destination} accessibilityRole={destination?'button':undefined}
          accessibilityState={{disabled:!destination}}
          accessibilityLabel={destination?`${announcement.title}. ${destination.action}`:undefined}
          onPress={destination?()=>setTab(destination.screen):undefined}>
          <Text style={s.inboxTitle}>{announcement.title}</Text>
          <Text style={s.inboxText}>{announcement.message}</Text>
          {destination?<Text style={s.noticeAction}>{destination.action}</Text>:null}
        </Pressable>;
      })}
    </NeonCard>
  ):null;
  return (
    <SafeAreaView style={s.safe}>
      {tab === "agenda" ? <HyperspaceBackground /> : tab === "turborama" ? <SpaceflightBackground /> : tab === "sorteios" ? <CoinRainBackground /> : <MatrixBackground />}
      <StatusBar style="light" />
      <PreviewRevision />
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
      <MotionScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
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
            {announcements.slice(0,1).map((announcement)=>{
              const destination=announcementDestination(announcement.event_type);
              return <NeonCard key={announcement.id} testID={`home-announcement-${announcement.id}`} color="#ffd66b" style={[s.noticeCard, s.notice]}
                accessibilityLabel={destination?`${announcement.title}. ${destination.action}`:undefined}
                onPress={destination?()=>setTab(destination.screen):undefined}>
                <Text style={s.noticeTag}>{destination?.tag??'◉ AVISO'}</Text>
                <Text style={s.noticeTitle}>{announcement.title}</Text>
                <Text numberOfLines={2} style={s.noticeText}>{announcement.message}</Text>
                {destination?<Text style={s.noticeAction}>{destination.action}</Text>:null}
              </NeonCard>;
            })}
            {cashbackEntry("home")}
            <NeonCard color="#70d8ff" style={[s.hero, s.marketplace]} onPress={() => setTab("marketplace")}
              accessibilityRole="button" accessibilityLabel="Games Usados. Comprar e vender produtos entre clientes cadastrados.">
              <View style={s.cardEmoji}><Text style={s.marketplaceEmoji}>🎮</Text></View>
              <Text style={s.cardTag}>COMPRA E VENDA ENTRE CLIENTES</Text>
              <Text style={s.cardTitle}>Games Usados</Text>
              <Text style={s.cardText}>Publique, encontre e reserve produtos.</Text>
              <Text style={s.arrow}>ABRIR LOJA →</Text>
            </NeonCard>
            <NeonCard style={[s.hero, s.green]} onPress={() => setTab("os")}>
              <View style={s.cardEmoji}><AnimatedIcon name="tools" size={54} /></View>
              <Text style={s.cardTag}>ASSISTÊNCIA TÉCNICA</Text>
              <Text style={s.cardTitle}>Minhas OS</Text>
              <Text style={s.cardText}>
                {data?.services.assistance.orders.length ?? 0} ordem(ns) de
                serviço
              </Text>
              <Text style={s.arrow}>ACOMPANHAR →</Text>
            </NeonCard>
            <NeonCard color="#70d8ff"
              style={[s.hero, s.blue]}
              onPress={() => setTab("agenda")}
            >
              <View style={s.cardEmoji}><AnimatedIcon name="calendar" size={54} /></View>
              <Text style={s.cardTag}>ATENDIMENTOS</Text>
              <Text style={s.cardTitle}>Agenda</Text>
              <Text style={s.cardText}>
                {appointments.length} agendamento(s)
              </Text>
              <Text style={s.arrow}>CONSULTAR →</Text>
            </NeonCard>
            <NeonCard color="#b29aff"
              style={[s.hero, s.purple]}
              onPress={() => setTab("turborama")}
            >
              <View style={s.cardEmoji}><CardLottie kind="suite" width={70.2} height={70.2} /></View>
              <Text style={s.cardTag}>SUITE E LICENÇAS</Text>
              <Text style={s.cardTitle}>TurboRama</Text>
              <Text style={s.cardText}>
                {data?.services.turborama.licenses.length ?? 0} licença(s)
                vinculada(s)
              </Text>
              <Text style={s.arrow}>ABRIR →</Text>
            </NeonCard>
            <NeonCard color="#eeb3ff"
              style={[s.hero, s.raffle]}
              onPress={() => setTab("sorteios")}
            >
              <View style={s.raffleTrophy}><TrophyLottie size={86} /></View>
              <Text style={s.cardTag}>PRÊMIOS E CAMPANHAS</Text>
              <Text style={s.cardTitle}>Sorteios</Text>
              <Text style={s.cardText}>
                {data?.services.raffles.participantCount ?? 0} participante(s)
                na lista oficial
              </Text>
              <Text style={s.arrow}>VER SORTEIOS →</Text>
            </NeonCard>
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
              onStore={setAgendaStore}
              onBooked={async(appointment)=>{
                // Display the committed receipt even if the next network refresh fails.
                if(appointment?.agendamento_id)setData(current=>current?{
                  ...current,services:{...current.services,scheduling:{appointments:[appointment,...current.services.scheduling.appointments.filter(item=>String(item.agendamento_id??item.id)!==String(appointment.agendamento_id))]}},
                }:current);
                if(!await refresh())throw new Error('Não foi possível atualizar os agendamentos.');
              }}
            />
            {appointments.length ? <Text style={s.sectionSub}>Toque em um agendamento para ver todos os detalhes.</Text> : null}
            {appointments.length ? (
              appointments.map((a, i) => (
                <AppointmentCard appointment={a} store={agendaStore} key={String(a.agendamento_id ?? a.id ?? i)} />
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
            {inboxCard}
            <RaffleDetails data={data.services.raffles} user={data.user} />
          </>
        )}
        {tab === "cashback" && (
          <>
            <Pressable testID="referral-back" accessibilityRole="button" accessibilityLabel="Voltar para o início"
              onPress={()=>setTab("inicio")} style={s.referralBack}>
              <Text style={s.referralBackText}>← VOLTAR PARA O INÍCIO</Text>
            </Pressable>
            <ReferralRewards refreshKey={data} />
          </>
        )}
        {tab === "marketplace" && (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar para o início" onPress={()=>setTab("inicio")} style={s.referralBack}>
              <Text style={s.marketplaceBackText}>← VOLTAR PARA O INÍCIO</Text>
            </Pressable>
            <Marketplace />
          </>
        )}
        {tab === "conta" && (
          <>
            <Text style={s.sectionTitle}>Minha conta</Text>
            <NeonCard radius={20} style={s.profile}>
              <AnimatedIcon name="user" size={60} />
              <Text style={s.profileName}>{data?.user.name}</Text>
              <Text style={s.itemText}>{data?.user.email}</Text>
              <Text style={s.itemText}>
                {data?.user.phone || "WhatsApp não informado"}
              </Text>
            </NeonCard>
            {cashbackEntry("account")}
            {inboxCard}
            <NeonCard color="#ffd66b" radius={20} style={[s.notificationBox, s.raffleMessagingBox]}>
              <View style={s.raffleMessagingCopy}>
                <Text style={s.notificationTitle}>Avisos de sorteios</Text>
                <Text style={s.notificationText}>Receba no WhatsApp cadastrado convites e lembretes das campanhas LZ Games. Esta autorização é opcional e pode ser cancelada aqui.</Text>
                {appPresence?.linked?<Text style={s.notificationMeta}>● APP VINCULADO · {appPresence.devices} dispositivo(s)</Text>:<Text style={s.notificationMeta}>○ VINCULAÇÃO EM VALIDAÇÃO</Text>}
              </View>
              <Pressable
                testID="raffle-messaging-toggle"
                accessibilityRole="button"
                accessibilityLabel={appPresence?.marketingOptIn ? "Desativar avisos de sorteios no WhatsApp" : "Ativar avisos de sorteios no WhatsApp"}
                accessibilityState={{ disabled: loading || pushBusy || raffleMessagingBusy, busy: loading || pushBusy || raffleMessagingBusy }}
                disabled={loading || pushBusy || raffleMessagingBusy}
                hitSlop={6}
                onPress={() => updateRaffleMessaging(!appPresence?.marketingOptIn)}
                style={({ pressed }) => [
                  s.raffleMessagingButton,
                  appPresence?.marketingOptIn && s.notificationToggleOn,
                  (loading || pushBusy || raffleMessagingBusy) && s.raffleMessagingButtonDisabled,
                  pressed && s.raffleMessagingButtonPressed,
                ]}
              >
                {(loading || pushBusy || raffleMessagingBusy) && <ActivityIndicator size="small" color={appPresence?.marketingOptIn ? "#221b08" : "#ffe394"} />}
                <Text style={[s.raffleMessagingButtonText, appPresence?.marketingOptIn && s.notificationToggleTextOn]}>
                  {raffleMessagingBusy ? "SALVANDO…" : (loading || pushBusy) ? "AGUARDE…" : appPresence?.marketingOptIn ? "DESATIVAR AVISOS" : "ATIVAR AVISOS NO WHATSAPP"}
                </Text>
              </Pressable>
            </NeonCard>
            <NeonCard color="#ffd66b" radius={20} style={s.notificationBox}>
              <View style={s.notificationCopy}>
                <Text style={s.notificationTitle}>Notificações no celular</Text>
                <Text style={s.notificationText}>Receba avisos de novos sorteios, mesmo com o app fechado. Ao tocar, você abre Sorteios. A permissão é opcional e independente do WhatsApp.</Text>
                <Text style={s.notificationMeta}>{!supportsRemotePush()?'DISPONÍVEL NO APK OFICIAL':appPresence?.push?.enabled?'● ATIVADAS NESTE CELULAR':'○ DESATIVADAS NESTE CELULAR'}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={appPresence?.push?.enabled?'Desativar notificações push':'Ativar notificações push'} disabled={pushBusy||loading} onPress={updatePush} style={[s.notificationToggle,appPresence?.push?.enabled&&s.notificationToggleOn]}>
                <Text style={[s.notificationToggleText,appPresence?.push?.enabled&&s.notificationToggleTextOn]}>{pushBusy?'AGUARDE':appPresence?.push?.enabled?'DESATIVAR':'ATIVAR'}</Text>
              </Pressable>
            </NeonCard>
            <NeonCard color="#ffd66b" radius={20} style={s.notificationBox}>
              <View style={s.notificationCopy}>
                <Text style={s.notificationTitle}>OS e agendamentos</Text>
                <Text style={s.notificationText}>Receba alterações de status das OS, lembretes de OS ativas há 3 dias sem alterações e avisos de agendamentos 6, 3 e 1 hora antes. Esta opção é independente dos sorteios e do WhatsApp.</Text>
                <Text style={s.notificationMeta}>{!supportsRemotePush()?'DISPONÍVEL NO APK OFICIAL':appPresence?.push?.serviceEnabled?'● ATIVADOS NESTE CELULAR':'○ DESATIVADOS NESTE CELULAR'}</Text>
              </View>
              <Pressable testID="service-push-toggle" accessibilityRole="button" accessibilityLabel={appPresence?.push?.serviceEnabled?'Desativar avisos de OS e agendamentos':'Ativar avisos de OS e agendamentos'} accessibilityState={{disabled:pushBusy||loading,busy:pushBusy||loading}} disabled={pushBusy||loading} onPress={updateServicePush} style={[s.notificationToggle,appPresence?.push?.serviceEnabled&&s.notificationToggleOn]}>
                <Text style={[s.notificationToggleText,appPresence?.push?.serviceEnabled&&s.notificationToggleTextOn]}>{pushBusy?'AGUARDE':appPresence?.push?.serviceEnabled?'DESATIVAR':'ATIVAR'}</Text>
              </Pressable>
            </NeonCard>
            <Pressable style={s.logout} onPress={exit} disabled={loading||pushBusy}>
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
      </MotionScrollView>
      <View style={s.nav}>
        {(
          ["inicio", "os", "agenda", "turborama", "sorteios", "conta"] as Tab[]
        ).map((t, i) => (
          <NeonCard key={t} electric animate={menuTab === t} radius={12}
            decoration={!menuEffectsReady}
            onLayout={event => {
              const {x,y,width,height} = event.nativeEvent.layout;
              setMenuBounds(current => {
                const old = current[i];
                if (old?.x === x && old?.y === y && old?.width === width && old?.height === height) return current;
                const next = [...current]; next[i] = {x,y,width,height}; return next;
              });
            }}
            color={menuTab === t ? "#72f5cf" : "#344e49"}
            style={[s.navItem, menuTab === t && s.navSelected]}
            accessibilityRole="tab" accessibilityState={{ selected: menuTab === t }}
            accessibilityLabel={["Início", "Ordens de serviço", "Agenda", "TurboRama", "Sorteios", "Minha conta"][i]}
            onPress={() => setTab(t)}>
            <AnimatedIcon name={(["home", "tools", "calendar", "rocket", "trophy", "user"] as AnimatedIconName[])[i]!} size={28} active={menuTab === t} />
            <Text style={[s.navText, menuTab === t && s.navActive]}>
              {["Início", "OS", "Agenda", "Turbo", "Sorteios", "Conta"][i]}
            </Text>
          </NeonCard>
        ))}
        <ElectricMenuEffects bounds={menuBounds}
          selected={(["inicio", "os", "agenda", "turborama", "sorteios", "conta"] as Tab[]).indexOf(menuTab)}
          onReady={() => setMenuEffectsReady(true)} onFailure={() => setMenuEffectsReady(false)} />
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
  brandStage: { alignItems: "center", marginTop: 8, marginBottom: 18 },
  brandLottieFill: { width: "100%", height: "100%" },
  portalLottie: { position: "relative", alignSelf: "center", width: 290, height: 195, marginTop: 8, marginBottom: -14 },
  portalLottieLabel: { position: "absolute", left: 0, right: 0, bottom: 10, color: "rgba(110,231,183,.7)", fontSize: 7, fontWeight: "900", letterSpacing: 2.1, textAlign: "center" },
  miniBrand: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 3.2, marginBottom: 11 },
  brandDivider: { width: "100%", height: 1, marginTop: 11, backgroundColor: "rgba(83,246,167,.2)", alignItems: "center" },
  dividerLight: { width: "42%", height: 2, top: -1, borderRadius: 2, backgroundColor: "#53f6a7", shadowColor: "#53f6a7", shadowOpacity: 1, shadowRadius: 12 },
  eyebrow: {
    color: "#53f6a7",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 3.4,
    marginTop: 7,
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 3.2, textAlign: "center", textShadowColor: "rgba(83,246,167,.55)", textShadowRadius: 18 },
  subtitle: { color: "#9fb1a9", fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: "center", maxWidth: 320 },
  authPanel: { position: "relative", borderWidth: 1, borderColor: "rgba(83,246,167,.38)", backgroundColor: "rgba(4,15,11,.94)", borderRadius: 22, padding: 14, shadowColor: "#53f6a7", shadowOpacity: .18, shadowRadius: 28, shadowOffset: { width: 0, height: 8 } },
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
  authTabActive: { backgroundColor: "#163b2c", borderWidth: 1, borderColor: "#2b7958", shadowColor: "#53f6a7", shadowOpacity: .3, shadowRadius: 8 },
  authTabText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#71817a",
    letterSpacing: 1,
  },
  authTabTextActive: { color: "#53f6a7" },
  consent: { fontSize: 11, lineHeight: 16, color: "#84958d" },
  form: { gap: 8 },
  inputLabel: { color: "#648076", fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginLeft: 3, marginTop: 2 },
  inputShell: { height: 44, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#285c47", backgroundColor: "rgba(7,24,18,.96)", borderRadius: 9, paddingHorizontal: 12, shadowColor: "#53f6a7", shadowOpacity: .10, shadowRadius: 8 },
  inputIcon: { color: "#53f6a7", width: 27, fontSize: 17, textShadowColor: "#53f6a7", textShadowRadius: 8 },
  inputInner: { flex: 1, height: 42, color: "#fff", fontSize: 13, paddingVertical: 0 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1b3129",
    backgroundColor: "#0b1a15",
    borderRadius: 9,
    paddingHorizontal: 13,
    color: "#fff",
    fontSize: 13,
  },
  primary: {
    height: 44,
    borderRadius: 9,
    backgroundColor: "#53f6a7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#aaffd0",
    shadowColor: "#53f6a7",
    shadowOpacity: .48,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryText: {
    color: "#06110d",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.25,
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
  referralEntry: { paddingHorizontal: 15, paddingVertical: 14, backgroundColor: "rgba(38,30,10,.92)", flexDirection: "row", alignItems: "center", gap: 12 },
  referralEntryBody: { flex: 1 },
  referralEntryTitle: { color: "#fff1b8", fontSize: 14, fontWeight: "900" },
  referralEntryText: { color: "#bdb08b", fontSize: 11, lineHeight: 16, marginTop: 4 },
  referralEntryArrow: { color: "#ffd66b", fontSize: 26 },
  referralBack: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  referralBackText: { color: "#ffd66b", fontSize: 11, fontWeight: "800" },
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
  marketplace: { backgroundColor: "#0b3040" },
  marketplaceEmoji: { fontSize: 47 },
  marketplaceBackText: { color: "#70d8ff", fontSize: 11, fontWeight: "800" },
  raffle: { backgroundColor: "#432052", paddingRight: 110 },
  raffleTrophy: { position: "absolute", right: 14, top: 0 },
  noticeCard: { padding: 15, borderRadius: 17, overflow: "hidden" },
  notice: { backgroundColor: "rgba(56,42,13,.96)", borderColor: "#8a6d22" },
  noticeTag: { color: "#ffe394", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  noticeTitle: { color: "#fff4cf", fontSize: 16, fontWeight: "900", marginTop: 6 },
  noticeText: { color: "#d7c997", fontSize: 12, lineHeight: 17, marginTop: 4 },
  noticeAction: { color: "#ffe394", fontSize: 9, fontWeight: "900", letterSpacing: .7, marginTop: 9 },
  inboxItem: { borderTopWidth: 1, borderTopColor: "rgba(255,226,128,.18)", marginTop: 10, paddingTop: 10 },
  inboxTitle: { color: "#fff4cf", fontSize: 14, fontWeight: "900" },
  inboxText: { color: "#d7c997", fontSize: 12, lineHeight: 17, marginTop: 3 },
  cardEmoji: {
    position: "absolute",
    right: 16,
    top: 12,
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
  notificationBox: { backgroundColor: "rgba(44,34,10,.96)", borderColor: "#80651e", padding: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: "#fff2bf", fontSize: 16, fontWeight: "900" },
  notificationText: { color: "#d6c998", fontSize: 11, lineHeight: 16, marginTop: 4 },
  notificationMeta: { color: "#ffe394", fontSize: 8, fontWeight: "900", letterSpacing: .7, marginTop: 8 },
  notificationToggle: { minWidth: 76, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#8e7528", alignItems: "center", justifyContent: "center", backgroundColor: "#2a220d" },
  notificationToggleOn: { borderColor: "#fff0a4", backgroundColor: "#f9d35d" },
  notificationToggleText: { color: "#ffe394", fontSize: 9, fontWeight: "900", letterSpacing: .6 },
  notificationToggleTextOn: { color: "#221b08" },
  raffleMessagingBox: { flexDirection: "column", alignItems: "stretch" },
  raffleMessagingCopy: { flexShrink: 1 },
  raffleMessagingButton: { alignSelf: "stretch", minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#c8a749", backgroundColor: "#362b10" },
  raffleMessagingButtonText: { color: "#ffe394", fontSize: 13, fontWeight: "900", letterSpacing: .3, textAlign: "center", flexShrink: 1 },
  raffleMessagingButtonPressed: { opacity: .72 },
  raffleMessagingButtonDisabled: { opacity: .65 },
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
    // Android devices with three-button navigation can draw controls over the app edge.
    // Reserve a fixed, visible buffer so the lower menu stays touchable above them.
    marginBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#172921",
    backgroundColor: "rgba(8,20,15,.97)",
    flexDirection: "row",
    paddingTop: 5,
    paddingBottom: 23,
  },
  navItem: { position: "relative", flex: 1, alignItems: "center", justifyContent: "center", gap: 2, marginHorizontal: 2 },
  navSelected: { backgroundColor: "#102c24" },
  navIcon: { color: "#65766e", fontSize: 16, fontWeight: "800" },
  navText: { color: "#65766e", fontSize: 8, fontWeight: "700" },
  navActive: { color: "#53f6a7" },
});
