import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {AgendaService,AgendaSlot,bookAgenda,loadAgendaServices,loadAgendaSlots} from './api';

const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const label=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'});

export function AgendaBooking({document,onBooked}:{document:string;onBooked:()=>Promise<void>}){
  const dates=useMemo(()=>Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return iso(d);}),[]);
  const [services,setServices]=useState<AgendaService[]>([]),[service,setService]=useState<AgendaService|null>(null);
  const [date,setDate]=useState(dates[0]!),[slots,setSlots]=useState<AgendaSlot[]>([]),[slot,setSlot]=useState<AgendaSlot|null>(null);
  const [cpf,setCpf]=useState(document),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{loadAgendaServices().then(v=>setServices(v.servicos)).catch(e=>setMessage(e.message));},[]);
  useEffect(()=>{if(!service)return;setBusy(true);setSlot(null);setMessage('');loadAgendaSlots(date,service.id).then(setSlots).catch(e=>{setSlots([]);setMessage(e.message)}).finally(()=>setBusy(false));},[date,service]);
  const confirm=async()=>{if(!service||!slot)return;setBusy(true);setMessage('');try{const r=await bookAgenda({serviceId:service.id,sectorId:service.setor_id,date,start:slot.inicio,document:cpf});setMessage(`✅ Agendamento ${r.protocolo} confirmado. A confirmação foi enviada ao seu WhatsApp.`);setSlot(null);await onBooked();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível agendar.');}finally{setBusy(false)}};
  return <View style={s.box}><Text style={s.title}>Agendar horário para orçamento</Text><Text style={s.help}>Escolha o serviço, a data e o horário. O profissional disponível será confirmado automaticamente.</Text>
    <Text style={s.label}>1. SERVIÇO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{services.map(v=><Pressable key={v.id} style={[s.chip,service?.id===v.id&&s.selected]} onPress={()=>setService(v)}><Text style={[s.chipText,service?.id===v.id&&s.selectedText]}>{v.nome}</Text></Pressable>)}</ScrollView>
    {service?<><Text style={s.label}>2. DATA</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{dates.map(v=><Pressable key={v} style={[s.chip,date===v&&s.selected]} onPress={()=>setDate(v)}><Text style={[s.chipText,date===v&&s.selectedText]}>{label(v)}</Text></Pressable>)}</ScrollView></>:null}
    {service?<><Text style={s.label}>3. HORÁRIO</Text>{busy?<ActivityIndicator color="#53f6a7"/>:<View style={s.wrap}>{slots.filter(v=>!v.ocupado).map(v=><Pressable key={v.inicio} style={[s.time,slot?.inicio===v.inicio&&s.selected]} onPress={()=>setSlot(v)}><Text style={[s.chipText,slot?.inicio===v.inicio&&s.selectedText]}>{v.inicio}</Text></Pressable>)}</View>}</>:null}
    {slot?<><Text style={s.label}>4. CPF DO CLIENTE</Text><TextInput style={s.input} value={cpf} onChangeText={setCpf} keyboardType="numeric" placeholder="CPF para confirmar o agendamento" placeholderTextColor="#687a72"/><Pressable style={s.button} disabled={busy} onPress={confirm}>{busy?<ActivityIndicator color="#06110d"/>:<Text style={s.buttonText}>CONFIRMAR E RECEBER NO WHATSAPP</Text>}</Pressable></>:null}
    {message?<Text style={s.message}>{message}</Text>:null}
  </View>;
}
const s=StyleSheet.create({box:{backgroundColor:'#0b1914',borderWidth:1,borderColor:'#183c52',borderRadius:20,padding:17,gap:12},title:{color:'#fff',fontSize:19,fontWeight:'900'},help:{color:'#8c9c95',fontSize:12,lineHeight:18},label:{color:'#53f6a7',fontSize:10,fontWeight:'900',letterSpacing:1.3,marginTop:5},row:{gap:8},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderWidth:1,borderColor:'#284039',borderRadius:12,paddingHorizontal:12,paddingVertical:9,maxWidth:230},time:{borderWidth:1,borderColor:'#284039',borderRadius:10,paddingHorizontal:14,paddingVertical:9},selected:{backgroundColor:'#53f6a7',borderColor:'#53f6a7'},chipText:{color:'#b6c3bd',fontSize:12,fontWeight:'700'},selectedText:{color:'#06110d'},input:{height:50,borderWidth:1,borderColor:'#284039',borderRadius:12,paddingHorizontal:14,color:'#fff'},button:{height:52,backgroundColor:'#53f6a7',borderRadius:13,alignItems:'center',justifyContent:'center'},buttonText:{color:'#06110d',fontSize:11,fontWeight:'900',letterSpacing:.7},message:{color:'#dce7e2',fontSize:12,lineHeight:18}});
