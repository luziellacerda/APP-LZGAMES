import * as SecureStore from 'expo-secure-store';

const BOX_API = process.env.EXPO_PUBLIC_API_URL ?? 'https://turbobox.lzgames.com.br/api/mobile/v1';
const CORE_API = process.env.EXPO_PUBLIC_CORE_API_URL ?? 'https://app.lzgames.com.br/api';
const BOX_TOKEN = 'lz_games_box_token';
const CORE_TOKEN = 'lz_games_core_token';

export type User = { id: number; name: string; email: string; phone: string; document: string };
export type Purchase = { id: number; amount_cents: number; status: string; purchased_at: string; expires_at: string | null; product_name: string; product_description: string };
export type Course = { id: number; name: string; description: string; total_lessons: number; completed_lessons: number };
export type License = { opaque_ref: string; license_id: string; state: string; financial_state: string; updated_at: string };
export type ServiceOrder = Record<string, unknown> & { os_id?: number|string; id?: number|string; status?: string; equipamento?: string; equipamento_nome?: string; marca?: string; modelo?: string; defeito?: string; data_entrada?: string };
export type Appointment = Record<string, unknown> & { agendamento_id?: number|string; id?: number|string; status?: string; data_hora?: string; data_d?: string; hora_i?: string; servico_nome?: string; profissional_nome?: string };
export type HomeData = {
  user: User;
  connections: { assistance: boolean; scheduling: boolean; turborama: boolean };
  services: {
    assistance: { orders: ServiceOrder[] };
    scheduling: { appointments: Appointment[] };
    turbobox: { library: Course[]; purchases: Purchase[] };
    turborama: { licenses: License[] };
  };
};

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {...init, headers:{Accept:'application/json','Content-Type':'application/json',...init?.headers}});
  let payload: any;
  try { payload=await response.json(); } catch { throw new Error('O servidor retornou uma resposta inválida.'); }
  if(!response.ok) throw new Error(payload?.error?.message ?? payload?.error ?? payload?.message ?? 'Não foi possível acessar o servidor.');
  return payload;
}

export async function login(loginValue: string, password: string) {
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

function normalizeUser(value:any):User {
  return {id:Number(value?.id??value?.sub??0),name:String(value?.name??value?.nome??'Cliente LZ Games'),email:String(value?.email??''),phone:String(value?.phone??value?.telefone??''),document:String(value?.document??value?.documento??'')};
}

export async function loadHome():Promise<HomeData> {
  const [coreToken,boxToken]=await Promise.all([SecureStore.getItemAsync(CORE_TOKEN),SecureStore.getItemAsync(BOX_TOKEN)]);
  if(!coreToken&&!boxToken) throw new Error('Sua sessão terminou. Entre novamente.');
  const [ordersResult,agendaResult,boxResult]=await Promise.allSettled([
    coreToken?jsonFetch(`${CORE_API}/me/orders`,{headers:{Authorization:`Bearer ${coreToken}`}}):Promise.reject(new Error('Sem vínculo com assistência')),
    coreToken?jsonFetch(`${CORE_API}/me/agenda`,{headers:{Authorization:`Bearer ${coreToken}`}}):Promise.reject(new Error('Sem vínculo com agenda')),
    boxToken?jsonFetch(`${BOX_API}/home`,{headers:{Authorization:`Bearer ${boxToken}`}}):Promise.reject(new Error('Sem vínculo com TurboRama')),
  ]);
  const orders=ordersResult.status==='fulfilled'?ordersResult.value:null;
  const agenda=agendaResult.status==='fulfilled'?agendaResult.value:null;
  const box=boxResult.status==='fulfilled'?boxResult.value?.data:null;
  const user=normalizeUser(box?.user??agenda?.usuario??orders?.user??{});
  return {user,connections:{assistance:!!coreToken,scheduling:!!coreToken,turborama:!!boxToken},services:{
    assistance:{orders:Array.isArray(orders?.orders)?orders.orders:[]},
    scheduling:{appointments:Array.isArray(agenda?.agendamentos)?agenda.agendamentos:[]},
    turbobox:{library:Array.isArray(box?.services?.turbobox?.library)?box.services.turbobox.library:[],purchases:Array.isArray(box?.services?.turbobox?.purchases)?box.services.turbobox.purchases:[]},
    turborama:{licenses:Array.isArray(box?.services?.turborama?.licenses)?box.services.turborama.licenses:[]},
  }};
}

export const hasSession=async()=>Boolean((await SecureStore.getItemAsync(CORE_TOKEN))||(await SecureStore.getItemAsync(BOX_TOKEN)));
export async function logout(){
  const boxToken=await SecureStore.getItemAsync(BOX_TOKEN);
  if(boxToken){try{await jsonFetch(`${BOX_API}/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${boxToken}`},body:'{}'});}catch{}}
  await Promise.all([SecureStore.deleteItemAsync(BOX_TOKEN),SecureStore.deleteItemAsync(CORE_TOKEN)]);
}
