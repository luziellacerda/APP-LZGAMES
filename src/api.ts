import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

declare const process:{env:Record<string,string|undefined>};

const BOX_API = process.env.EXPO_PUBLIC_API_URL ?? 'https://turbobox.lzgames.com.br/api/mobile/v1';
const CORE_API = process.env.EXPO_PUBLIC_CORE_API_URL ?? 'https://app.lzgames.com.br/api';
const AGENDA_API = 'https://app.lzgames.com.br/sistema/agenda/';
const RAFFLE_API = 'https://sorteios.lzgames.com.br/api';
const BOX_TOKEN = 'lz_games_box_token';
const CORE_TOKEN = 'lz_games_core_token';
const APP_INSTALLATION_ID = 'lz_games_installation_id';
let deviceQueue:Promise<unknown>=Promise.resolve();
let sessionClosing=false;

export type User = { id: number; name: string; email: string; phone: string; document: string };
export type Purchase = { id: number; amount_cents: number; status: string; purchased_at: string; expires_at: string | null; product_name: string; product_description: string };
export type Course = { id: number; name: string; description: string; total_lessons: number; completed_lessons: number };
export type License = { opaque_ref: string; license_id: string; state: string; financial_state: string; updated_at: string };
export type ServiceOrder = Record<string, unknown> & { os_id?: number|string; id?: number|string; status?: string; equipamento?: string; equipamento_nome?: string; marca?: string; modelo?: string; defeito?: string; data_entrada?: string };
export type Appointment = Record<string, unknown> & { agendamento_id?: number|string; id?: number|string; status?: string; data_hora?: string; data_d?: string; hora_i?: string; servico_nome?: string; profissional_nome?: string };
export type RaffleParticipant = { name:string; number:string; color_name?:string; color_hex?:string; arena_code?:string };
export type RafflePrize = { position:number; label:string; selectionMethod?:string; winner:string|null; winnerNumber:string|null; drawnAt:string|null };
export type RaffleGiveaway = { id:number; title:string; mode:string; status:string; createdAt:string; completed:number; total:number; prizes:RafflePrize[] };
export type RaffleData = { state:string; phase:string; scheduledAt:string|null; revealAt:string|null; serverTime:string|null; participantCount:number; participantLimit:number; giveaway:Record<string,unknown>|null; prizes:Record<string,unknown>[]; participants:RaffleParticipant[]; history:RaffleGiveaway[] };
export type PushRegistration = {enabled:boolean;permission:'granted'|'denied'|'undetermined'|'unavailable';token:string|null;refreshOnly?:boolean;scope?:'raffles'|'services'};
export type AppPresence = { linked:boolean; devices:number; marketingOptIn:boolean; lastSeenAt:string|null; push?:{enabled:boolean;serviceEnabled?:boolean;registered:boolean;permission:string;error:string|null} };
export type RaffleAnnouncement = { id:number; title:string; message:string; event_type?:string|null; resource_id?:number|string|null; published_at?:string|null; created_at?:string|null };
export type AgendaService = { id:number; setor_id:number; nome:string; duracao_min:number; preco_brl:string };
export type AgendaSector = { id:number; nome:string };
export type AgendaStore = { nome:string; endereco:string };
export type AgendaSlot = { inicio:string; fim:string; ocupado:boolean; profissionais_livres:number };
export type ReferralTier = {id:string;label:string;threshold:number;percent:number;description:string};
export type AppReferralCredit = {bonusCents:number;creditCents:number;rewardCount:number;redemptionEnabled:boolean;usedCents?:number;availableCents?:number};
export type ReferralSummary = {total:number;pending:number;completed:number;cancelled:number;valid:number;approvedCents:number;tiers:ReferralTier[];currentTier:ReferralTier;appCredit?:AppReferralCredit};
export type ReferralItem = {id:string;name:string;status:string;cashbackCents:number;createdAt:string;updatedAt:string};
export type ReferralRewardsData = {summary:ReferralSummary;items:ReferralItem[]};
export type HomeData = {
  user: User;
  connections: { assistance: boolean; scheduling: boolean; turborama: boolean };
  services: {
    assistance: { orders: ServiceOrder[] };
    scheduling: { appointments: Appointment[] };
    raffles: RaffleData;
    turbobox: { library: Course[]; purchases: Purchase[] };
    turborama: { licenses: License[] };
  };
};

class HttpError extends Error {
  constructor(message:string,readonly status:number){super(message);this.name='HttpError';}
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {...init, headers:{Accept:'application/json','Content-Type':'application/json',...init?.headers}});
  let payload: any;
  try { payload=await response.json(); } catch { throw new HttpError('O servidor retornou uma resposta inválida.',response.status); }
  if(!response.ok) throw new HttpError(payload?.error?.message ?? payload?.error ?? payload?.message ?? 'Não foi possível acessar o servidor.',response.status);
  return payload;
}

function createInstallationId(){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let value='lz_';
  for(let index=0;index<42;index+=1)value+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return value;
}

async function installationId(){
  const stored=await SecureStore.getItemAsync(APP_INSTALLATION_ID);
  if(stored&&/^[A-Za-z0-9_-]{24,160}$/.test(stored))return stored;
  const created=createInstallationId();
  await SecureStore.setItemAsync(APP_INSTALLATION_ID,created);
  return created;
}

async function raffleIdentity(){
  const [coreToken,boxToken]=await Promise.all([SecureStore.getItemAsync(CORE_TOKEN),SecureStore.getItemAsync(BOX_TOKEN)]);
  if(boxToken)return {provider:'box' as const,token:boxToken};
  if(coreToken)return {provider:'core' as const,token:coreToken};
  throw new Error('Entre novamente para vincular este aplicativo.');
}

async function raffleAuthFetch(path:string, init?:RequestInit){
  const identity=await raffleIdentity();
  return jsonFetch(`${RAFFLE_API}${path}`,{...init,headers:{
    Authorization:`Bearer ${identity.token}`,
    'X-LZ-Identity-Provider':identity.provider,
    ...init?.headers,
  }});
}

export function syncRafflePresence(marketingOptIn?:boolean,push?:PushRegistration):Promise<AppPresence>{
  const operation=deviceQueue.catch(()=>{}).then(async()=>{
    if(sessionClosing)throw new Error('Saindo da conta.');
    return saveRafflePresence(marketingOptIn,push);
  });
  deviceQueue=operation;
  return operation;
}

async function saveRafflePresence(marketingOptIn?:boolean,push?:PushRegistration):Promise<AppPresence>{
  const payload:any={installationId:await installationId(),platform:Platform.OS,appVersion:Constants.expoConfig?.version??'unknown'};
  if(marketingOptIn!==undefined)payload.marketingOptIn=marketingOptIn;
  if(push!==undefined)payload.push=push;
  const response=await raffleAuthFetch('/app/device',{method:'POST',body:JSON.stringify(payload)});
  return response?.data as AppPresence;
}

export async function loadRaffleInbox():Promise<{presence:AppPresence;announcements:RaffleAnnouncement[]}>{
  const response=await raffleAuthFetch(`/app/inbox?installationId=${encodeURIComponent(await installationId())}`);
  return {presence:response?.data?.presence as AppPresence,announcements:Array.isArray(response?.data?.announcements)?response.data.announcements:[]};
}

export async function recordPushOpen(deliveryId:number):Promise<void>{
  if(!Number.isSafeInteger(deliveryId)||deliveryId<1)return;
  await raffleAuthFetch('/app/push/opened',{method:'POST',body:JSON.stringify({deliveryId})});
}

export async function login(loginValue: string, password: string) {
  sessionClosing=false;
  const phone=loginValue.replace(/\D/g,'');
  const attempts=await Promise.allSettled([
    phone.length>=10 ? jsonFetch(`${CORE_API}/auth/login`,{method:'POST',body:JSON.stringify({telefone:phone,senha:password})}) : Promise.reject(new Error('Use o WhatsApp para acessar OS e agenda.')),
    jsonFetch(`${BOX_API}/auth/login`,{method:'POST',body:JSON.stringify({login:loginValue,password,deviceName:'LZ Games App'})}),
  ]);
  const core=attempts[0].status==='fulfilled'?attempts[0].value:null;
  const box=attempts[1].status==='fulfilled'?attempts[1].value?.data:null;
  if(!core?.token&&!box?.token){
    const message=attempts.map(a=>a.status==='rejected'&&a.reason instanceof Error?a.reason.message:'').find(Boolean);
    throw new Error(message||'Telefone/e-mail ou senha incorretos.');
  }
  if(core?.token) await SecureStore.setItemAsync(CORE_TOKEN,core.token); else await SecureStore.deleteItemAsync(CORE_TOKEN);
  if(box?.token) await SecureStore.setItemAsync(BOX_TOKEN,box.token); else await SecureStore.deleteItemAsync(BOX_TOKEN);
  return normalizeUser(core?.user??box?.user);
}

export async function register(input:{name:string;phone:string;email:string;cpf:string;password:string}) {
  sessionClosing=false;
  const payload=await jsonFetch(`${CORE_API}/auth/register`,{method:'POST',body:JSON.stringify({nome:input.name,telefone:input.phone,email:input.email,cpf:input.cpf,senha:input.password,consentimento:true})});
  if(!payload?.token) throw new Error('O cadastro não retornou uma sessão válida.');
  await SecureStore.setItemAsync(CORE_TOKEN,payload.token);
  await SecureStore.deleteItemAsync(BOX_TOKEN);
  return normalizeUser(payload.user);
}

export async function requestAccountDeletion(password:string) {
  const token=await SecureStore.getItemAsync(CORE_TOKEN);
  if(!token) throw new Error('Entre com seu WhatsApp para solicitar a exclusão.');
  return jsonFetch(`${CORE_API}/auth/delete-request`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`},
    body:JSON.stringify({password}),
  });
}

function normalizeUser(value:any):User {
  return {id:Number(value?.id??value?.sub??0),name:String(value?.name??value?.nome??'Cliente LZ Games'),email:String(value?.email??''),phone:String(value?.phone??value?.telefone??''),document:String(value?.document??value?.documento??value?.cpf??'')};
}

export async function loadHome():Promise<HomeData> {
  const [coreToken,boxToken]=await Promise.all([SecureStore.getItemAsync(CORE_TOKEN),SecureStore.getItemAsync(BOX_TOKEN)]);
  if(!coreToken&&!boxToken) throw new Error('Sua sessão terminou. Entre novamente.');
  const [ordersResult,agendaResult,boxResult,raffleResult,participantsResult,raffleHistoryResult]=await Promise.allSettled([
    coreToken?jsonFetch(`${CORE_API}/me/orders`,{headers:{Authorization:`Bearer ${coreToken}`}}):Promise.reject(new Error('Sem vínculo com assistência')),
    coreToken?jsonFetch(`${CORE_API}/me/agenda`,{headers:{Authorization:`Bearer ${coreToken}`}}):Promise.reject(new Error('Sem vínculo com agenda')),
    boxToken?jsonFetch(`${BOX_API}/home`,{headers:{Authorization:`Bearer ${boxToken}`}}):Promise.reject(new Error('Sem vínculo com TurboRama')),
    jsonFetch(`${RAFFLE_API}/live`),
    jsonFetch(`${RAFFLE_API}/participantes-publicos`),
    jsonFetch(`${RAFFLE_API}/resultados-publicos`),
  ]);
  const orders=ordersResult.status==='fulfilled'?ordersResult.value:null;
  const agenda=agendaResult.status==='fulfilled'?agendaResult.value:null;
  const box=boxResult.status==='fulfilled'?boxResult.value?.data:null;
  const raffle=raffleResult.status==='fulfilled'?raffleResult.value:null;
  const raffleParticipants=participantsResult.status==='fulfilled'&&Array.isArray(participantsResult.value?.participants)?participantsResult.value.participants:[];
  const raffleHistory=raffleHistoryResult.status==='fulfilled'&&Array.isArray(raffleHistoryResult.value?.giveaways)?raffleHistoryResult.value.giveaways:[];
  const user=normalizeUser(box?.user??agenda?.usuario??orders?.user??{});
  const boxOrders=box?.services?.assistance?.orders;
  const boxAppointments=box?.services?.scheduling?.appointments;
  return {user,connections:{assistance:!!coreToken||Array.isArray(boxOrders),scheduling:!!coreToken||Array.isArray(boxAppointments),turborama:!!boxToken},services:{
    assistance:{orders:Array.isArray(orders?.orders)?orders.orders:Array.isArray(boxOrders)?boxOrders:[]},
    scheduling:{appointments:Array.isArray(agenda?.agendamentos)?agenda.agendamentos:Array.isArray(boxAppointments)?boxAppointments:[]},
    raffles:{state:String(raffle?.state??'IDLE'),phase:String(raffle?.phase??'WAITING'),scheduledAt:raffle?.scheduledAt??null,revealAt:raffle?.revealAt??null,serverTime:raffle?.serverTime??null,participantCount:Number(raffle?.participantCount??raffleParticipants.length),participantLimit:Number(raffle?.participantLimit??50),giveaway:raffle?.giveaway&&typeof raffle.giveaway==='object'?raffle.giveaway:null,prizes:Array.isArray(raffle?.prizes)?raffle.prizes:[],participants:raffleParticipants,history:raffleHistory},
    turbobox:{library:Array.isArray(box?.services?.turbobox?.library)?box.services.turbobox.library:[],purchases:Array.isArray(box?.services?.turbobox?.purchases)?box.services.turbobox.purchases:[]},
    turborama:{licenses:Array.isArray(box?.services?.turborama?.licenses)?box.services.turborama.licenses:[]},
  }};
}

export const hasSession=async()=>Boolean((await SecureStore.getItemAsync(CORE_TOKEN))||(await SecureStore.getItemAsync(BOX_TOKEN)));
export async function logout(){
  // Revoke this installation before deleting the credentials needed to authenticate the revocation.
  // Network/server failures keep the session for retry. Invalid credentials must not lock the user in.
  sessionClosing=true;
  let remoteUnlinked=false;
  try {
    await deviceQueue.catch(()=>{});
    await raffleAuthFetch('/app/device/unlink',{method:'POST',body:JSON.stringify({installationId:await installationId()})});
    remoteUnlinked=true;
  } catch(e){
    if(!(e instanceof HttpError && (e.status===401||e.status===403))){sessionClosing=false;throw e;}
  }
  const boxToken=await SecureStore.getItemAsync(BOX_TOKEN);
  if(boxToken){try{await jsonFetch(`${BOX_API}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${boxToken}`},body:'{}'});}catch{}}
  await Promise.all([SecureStore.deleteItemAsync(BOX_TOKEN),SecureStore.deleteItemAsync(CORE_TOKEN)]);
  return {remoteUnlinked};
}

export async function loadAgendaServices():Promise<{setores:AgendaSector[];servicos:AgendaService[];loja:AgendaStore|null}>{
  const payload=await jsonFetch(`${AGENDA_API}?a=listServicos`);
  return {
    setores:Array.isArray(payload?.setores)?payload.setores:[],
    servicos:Array.isArray(payload?.servicos)?payload.servicos:[],
    loja:typeof payload?.loja?.nome==='string'&&typeof payload?.loja?.endereco==='string'?{nome:payload.loja.nome,endereco:payload.loja.endereco}:null,
  };
}
export async function loadAgendaSlots(date:string,serviceId:number):Promise<AgendaSlot[]>{
  const payload=await jsonFetch(`${AGENDA_API}?a=slots&data=${encodeURIComponent(date)}&servico_id=${serviceId}`);
  if(payload?.ok===false) return [];
  return Array.isArray(payload?.slots)?payload.slots:[];
}
export async function bookAgenda(input:{serviceId:number;sectorId:number;date:string;start:string;document:string}){
  const [boxToken,coreToken]=await Promise.all([SecureStore.getItemAsync(BOX_TOKEN),SecureStore.getItemAsync(CORE_TOKEN)]);
  // Preserve the existing TurboBox identity when present; new assistance registrations only have CORE.
  const token=boxToken||coreToken;
  if(!token) throw new Error('Sua sessão terminou. Entre novamente para agendar.');
  // Never retry a booking with another identity: the first request may already have created it.
  const payload=await jsonFetch(`${BOX_API}/agenda/book`,{
    method:'POST',body:JSON.stringify(input),
    headers:{Authorization:`Bearer ${token}`,'X-LZ-Identity-Provider':boxToken?'box':'core'},
  });
  if(payload?.ok!==true||payload?.data?.ok!==true||typeof payload.data.protocolo!=='string'||!payload.data.protocolo.trim()){
    throw new Error('Não foi possível confirmar a resposta da agenda. Confira seus agendamentos antes de tentar novamente.');
  }
  return payload.data;
}

async function referralHeaders(){
  const [boxToken,coreToken]=await Promise.all([SecureStore.getItemAsync(BOX_TOKEN),SecureStore.getItemAsync(CORE_TOKEN)]);
  if(sessionClosing||(!boxToken&&!coreToken))throw new Error('Sua sessão terminou. Entre novamente para consultar suas indicações.');
  return {Authorization:`Bearer ${boxToken||coreToken}`,'X-LZ-Identity-Provider':boxToken?'box':'core'};
}

function referralInteger(value:unknown):number{
  if(typeof value!=='number'&&!(typeof value==='string'&&/^\d+$/.test(value)))throw new Error('O programa de indicações retornou dados inválidos. Tente atualizar.');
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)throw new Error('O programa de indicações retornou dados inválidos. Tente atualizar.');
  return number;
}

function referralTier(value:any):ReferralTier{
  if(!value||typeof value.id!=='string'||!value.id||typeof value.label!=='string'||!value.label)throw new Error('Não foi possível confirmar as regras do programa. Tente atualizar.');
  const percent=referralInteger(value.percent);
  if(percent>100)throw new Error('Não foi possível confirmar as regras do programa. Tente atualizar.');
  return {id:value.id,label:value.label,threshold:referralInteger(value.threshold),percent,description:typeof value.description==='string'?value.description:''};
}

/** The approved amount is a historical total, not a withdrawable wallet balance. */
export async function loadReferralRewards():Promise<ReferralRewardsData>{
  const headers=await referralHeaders();
  const [summaryResponse,listResponse]=await Promise.all([
    jsonFetch(`${CORE_API}/me/referrals/summary`,{headers}),
    jsonFetch(`${CORE_API}/me/referrals/list?days=365`,{headers}),
  ]);
  const data=summaryResponse?.data;
  if(summaryResponse?.ok!==true||listResponse?.ok!==true||!data||!Array.isArray(listResponse.data)||!Array.isArray(data.referral_program?.tiers)||!data.referral_program.tiers.length){
    throw new Error('Não foi possível carregar suas indicações. Tente atualizar.');
  }
  const tiers:ReferralTier[]=data.referral_program.tiers.map(referralTier).sort((a:ReferralTier,b:ReferralTier)=>a.threshold-b.threshold);
  const currentTier=referralTier(data.referral_program.current_tier);
  if(!tiers.some(t=>t.id===currentTier.id&&t.threshold===currentTier.threshold&&t.percent===currentTier.percent))throw new Error('Não foi possível confirmar as regras do programa. Tente atualizar.');
  let appCredit:AppReferralCredit|undefined;
  if(data.app_referral_credit!==undefined){
    const credit=data.app_referral_credit;
    if(!credit||credit.rule_version!=='app_first_use_990_v1'||credit.usage_restriction!=='services_only'||credit.withdrawable!==false||credit.expires!==false||typeof credit.redemption_enabled!=='boolean')throw new Error('Não foi possível confirmar as regras do crédito para serviços. Tente atualizar.');
    const bonusCents=referralInteger(credit.bonus_centavos),creditCents=referralInteger(credit.creditos_acumulados_centavos),rewardCount=referralInteger(credit.indicacoes_premiadas);
    if(bonusCents!==990||creditCents!==rewardCount*bonusCents)throw new Error('O crédito para serviços retornou dados inconsistentes. Tente atualizar.');
    appCredit={bonusCents,creditCents,rewardCount,redemptionEnabled:credit.redemption_enabled};
    if(credit.redemption_enabled||credit.creditos_utilizados_centavos!==undefined||credit.saldo_disponivel_centavos!==undefined){
      const usedCents=referralInteger(credit.creditos_utilizados_centavos),availableCents=referralInteger(credit.saldo_disponivel_centavos);
      if(usedCents>creditCents||availableCents!==creditCents-usedCents)throw new Error('Não foi possível conferir o saldo após os abatimentos. Tente atualizar.');
      appCredit={...appCredit,usedCents,availableCents};
    }
  }
  const summary:ReferralSummary={
    total:referralInteger(data.indicacoes_total),pending:referralInteger(data.indicacoes_pendentes),
    completed:referralInteger(data.indicacoes_concluidas),cancelled:referralInteger(data.indicacoes_canceladas),
    valid:referralInteger(data.indicacoes_validas),approvedCents:referralInteger(data.cashback_aprovado_centavos),tiers,currentTier,...(appCredit?{appCredit}:{}),
  };
  const items:ReferralItem[]=listResponse.data.map((item:any)=>{
    if(!item||!['string','number'].includes(typeof item.id)||!/^\d+$/.test(String(item.id))||typeof item.status!=='string')throw new Error('O histórico de indicações retornou dados inválidos. Tente atualizar.');
    return {id:String(item.id),name:typeof item.nome_indicado==='string'&&item.nome_indicado.trim()?item.nome_indicado.trim():'Cliente indicado',
      status:item.status,cashbackCents:referralInteger(item.cashback_valor_centavos),
      createdAt:typeof item.created_at==='string'?item.created_at:'',updatedAt:typeof item.updated_at==='string'?item.updated_at:''};
  });
  return {summary,items};
}

const referralHosts=new Set(['app.lzgames.com.br','clientes.lzgames.com.br','clientes.lzgames.com']);
function referralCode(input:string):string{
  let code=input.trim();
  if(code.length>2048)throw new Error('Informe um código ou link de indicação válido.');
  if(/^https?:/i.test(code)){
    let url:URL;
    try{url=new URL(code);}catch{throw new Error('Informe um link de indicação válido.');}
    if(url.protocol!=='https:'||!referralHosts.has(url.hostname)||url.username||url.password||url.port)throw new Error('Use um link de indicação oficial da LZ-GAMES.');
    code=url.searchParams.get('ref')??'';
  }
  if(!/^LZ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code)||code.length>1024)throw new Error('Informe o código do convite ou o link de indicação completo.');
  return code;
}

/** Local validation only, before an explicit invitation-bearing login/signup submission. */
export const validateReferralInvite=(input:string):string=>referralCode(input);

export async function createReferralInvite():Promise<{code:string;link:string}>{
  const headers=await referralHeaders();
  const response=await jsonFetch(`${CORE_API}/me/referrals/link`,{method:'POST',headers,body:'{}'});
  const data=response?.data;
  if(response?.ok!==true||typeof data?.codigo_ref!=='string'||typeof data?.link!=='string'||!data.link.startsWith('https://'))throw new Error('Não foi possível gerar um convite válido. Tente novamente.');
  const code=referralCode(data.codigo_ref);
  if(referralCode(data.link)!==code)throw new Error('Não foi possível confirmar o link do convite. Tente novamente.');
  return {code,link:data.link};
}

export async function acceptReferralInvite(input:string):Promise<{alreadyRegistered:boolean;status:string}>{
  const code=referralCode(input);
  const headers=await referralHeaders();
  // This records the customer's explicit action only; never accept a referral during login/loading.
  const response=await jsonFetch(`${CORE_API}/referrals/accept`,{method:'POST',headers,body:JSON.stringify({codigo_ref:code})});
  if(response?.ok!==true||typeof response?.data?.status!=='string')throw new Error('Não foi possível confirmar o registro da indicação. Atualize antes de tentar novamente.');
  return {alreadyRegistered:response.already_registered===true,status:response.data.status};
}
