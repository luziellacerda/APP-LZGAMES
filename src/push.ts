import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { loadRaffleInbox, recordPushOpen, syncRafflePresence, type AppPresence, type PushRegistration, type RaffleAnnouncement } from './api';

type NotificationsModule = typeof import('expo-notifications');
export type PushScreen = 'sorteios'|'os'|'agenda';
type PushCallbacks = { onInbox:(presence:AppPresence,announcements:RaffleAnnouncement[])=>void; onOpen:(screen:PushScreen)=>void };
export const supportsRemotePush = () => Device.isDevice && Platform.OS !== 'web' && Constants.executionEnvironment !== 'storeClient';

function notificationScreen(type:unknown):PushScreen|null{
  switch(type){
    case 'raffle':return 'sorteios';
    case 'service_order':return 'os';
    case 'appointment':return 'agenda';
    default:return null;
  }
}

let notificationsPromise:Promise<NotificationsModule>|null=null;
async function notifications():Promise<NotificationsModule>{
  if(!supportsRemotePush())throw new Error('Notificações push precisam do APK atualizado em um celular. Não estão disponíveis no Expo Go.');
  if(!notificationsPromise)notificationsPromise=import('expo-notifications');
  return notificationsPromise;
}

export async function preparePushRegistration(requestPermission:boolean):Promise<PushRegistration>{
  const api=await notifications();
  // The Android channel must exist before requesting permission or a token.
  if(Platform.OS==='android'){
    await api.setNotificationChannelAsync('sorteios',{
      name:'Sorteios LZ-GAMES',description:'Novos sorteios e programação oficial',
      importance:api.AndroidImportance.HIGH,sound:'default',vibrationPattern:[0,200,120,200],
      lightColor:'#FFD66B',lockscreenVisibility:api.AndroidNotificationVisibility.PUBLIC,
    });
    for(const [id,name,description] of [
      ['os','Ordens de serviço LZ-GAMES','Alterações e acompanhamento das suas ordens de serviço'],
      ['agenda','Agendamentos LZ-GAMES','Lembretes dos seus agendamentos'],
    ] as const)await api.setNotificationChannelAsync(id,{
      name,description,
      importance:api.AndroidImportance.HIGH,sound:'default',vibrationPattern:[0,200,120,200],
      lockscreenVisibility:api.AndroidNotificationVisibility.PRIVATE,
    });
  }
  let permission=await api.getPermissionsAsync();
  if(requestPermission&&!permission.granted&&permission.canAskAgain){
    permission=await api.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:true,allowSound:true}});
  }
  const granted=permission.granted||permission.ios?.status===api.IosAuthorizationStatus.PROVISIONAL;
  if(!granted)return {enabled:false,permission:permission.status==='denied'?'denied':'undetermined',token:null};
  const projectId=Constants.easConfig?.projectId??Constants.expoConfig?.extra?.eas?.projectId;
  if(!projectId)throw new Error('Esta versão não tem a configuração de notificações. Instale a versão oficial atualizada.');
  try {
    const result=await api.getExpoPushTokenAsync({projectId});
    return {enabled:true,permission:'granted',token:result.data};
  } catch {
    throw new Error('Não foi possível registrar as notificações. Verifique a conexão e tente novamente. Se persistir, esta versão precisa da configuração Firebase de produção.');
  }
}

export async function dismissRaffleNotifications(scope?:PushRegistration['scope']):Promise<void>{
  if(!supportsRemotePush())return;
  const api=await notifications();
  if(!scope){
    await api.dismissAllNotificationsAsync();
    api.clearLastNotificationResponse();
    return;
  }
  const matches=(type:unknown)=>scope==='raffles'?type==='raffle':type==='service_order'||type==='appointment';
  const presented=await api.getPresentedNotificationsAsync();
  for(const notification of presented){
    if(matches(notification.request.content.data?.type))await api.dismissNotificationAsync(notification.request.identifier);
  }
  if(matches(api.getLastNotificationResponse()?.notification.request.content.data?.type))api.clearLastNotificationResponse();
}

/** No background polling. The OS displays remote notifications while the app is closed. */
export function useRafflePush(active:boolean,callbacks:PushCallbacks){
  const latest=useRef(callbacks);latest.current=callbacks;
  useEffect(()=>{
    if(!active)return;
    let disposed=false,refreshing=false;
    const subscriptions:{remove:()=>void}[]=[];
    const update=async(syncToken=false)=>{
      if(disposed||refreshing)return;
      refreshing=true;
      try{
        const inbox=await loadRaffleInbox();
        if(disposed)return;
        latest.current.onInbox(inbox.presence,inbox.announcements);
        const scopes:NonNullable<PushRegistration['scope']>[]=[];
        if(inbox.presence.push?.enabled)scopes.push('raffles');
        if(inbox.presence.push?.serviceEnabled)scopes.push('services');
        if(syncToken&&scopes.length&&supportsRemotePush()){
          const registration=await preparePushRegistration(false);
          if(disposed)return;
          for(const scope of scopes){
            if(disposed)return;
            try{
              // Each preference is independent. Maintenance cannot renew consent
              // revoked while token registration or another scope was pending.
              const presence=await syncRafflePresence(undefined,{...registration,scope,refreshOnly:true});
              if(!disposed)latest.current.onInbox(presence,inbox.announcements);
            }catch{/* A failed scope does not prevent maintenance of the other. */}
          }
        }
      }catch{/* Preserve the last successful state offline; retry on the next foreground transition. */}
      finally{refreshing=false;}
    };
    void update(true);
    subscriptions.push(AppState.addEventListener('change',state=>{if(state==='active')void update(true);}));
    if(supportsRemotePush())void notifications().then(async api=>{
      if(disposed)return;
      api.setNotificationHandler({handleNotification:async notification=>{
        const show=!disposed&&notificationScreen(notification.request.content.data?.type)!==null;
        return {shouldShowBanner:show,shouldShowList:show,shouldPlaySound:show,shouldSetBadge:false};
      }});
      const consumed=new Set<string>();
      const open=(response:import('expo-notifications').NotificationResponse)=>{
        const {identifier,content}=response.notification.request;
        const screen=notificationScreen(content.data?.type);
        if(disposed||!screen||consumed.has(identifier))return;
        consumed.add(identifier);
        latest.current.onOpen(screen);
        void update();
        const deliveryId=Number(content.data?.deliveryId);
        if(Number.isSafeInteger(deliveryId)&&deliveryId>0)void recordPushOpen(deliveryId).catch(()=>{});
        api.clearLastNotificationResponse();
      };
      subscriptions.push(api.addNotificationReceivedListener(notification=>{
        if(notificationScreen(notification.request.content.data?.type))void update();
      }));
      subscriptions.push(api.addNotificationResponseReceivedListener(open));
      subscriptions.push(api.addPushTokenListener(()=>void update(true)));
      const last=api.getLastNotificationResponse();
      if(last)open(last);
    }).catch(()=>{});
    return ()=>{disposed=true;subscriptions.forEach(s=>s.remove());};
  },[active]);
}
