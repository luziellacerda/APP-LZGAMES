import React from 'react';
import {Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {RaffleData,User} from './api';

const clean=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const dateTime=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'}):'Data ainda não definida';
const text=(value:unknown,fallback='—')=>value===null||value===undefined||value===''?fallback:String(value);

export function RaffleDetails({data,user}:{data:RaffleData;user:User}){
  const mine=data.participants.filter(p=>clean(p.name)===clean(user.name));
  const live=data.state.toUpperCase()==='LIVE';
  return <>
    <View style={s.hero}>
      <Text style={[s.state,live&&s.live]}>{live?'● SORTEIO AO VIVO':data.scheduledAt?'PRÓXIMO SORTEIO':'SORTEIOS LZ GAMES'}</Text>
      <Text style={s.title}>{text(data.giveaway?.title,'Novidades e premiações')}</Text>
      <Text style={s.date}>{dateTime(data.scheduledAt)}</Text>
      <View style={s.capacity}><View style={[s.capacityFill,{width:`${Math.min(100,data.participantLimit?data.participantCount/data.participantLimit*100:0)}%`}]}/></View>
      <Text style={s.meta}>{data.participantCount} de {data.participantLimit} participantes</Text>
    </View>
    <Text style={s.section}>MINHA PARTICIPAÇÃO</Text>
    {mine.length?mine.map(p=><View key={`${p.number}-${p.arena_code}`} style={s.ticket}><View><Text style={s.ticketLabel}>NÚMERO DA SORTE</Text><Text style={s.number}>{p.number}</Text></View><View style={s.ticketRight}><Text style={s.ticketLabel}>COMETA</Text><Text style={s.comet}>{p.arena_code??p.number}</Text><Text style={s.color}>{p.color_name??'Cor registrada'}</Text></View></View>):<View style={s.info}><Text style={s.infoTitle}>Nenhuma participação vinculada ao seu nome</Text><Text style={s.infoText}>Quando sua inscrição estiver na lista oficial, o número da sorte e o cometa aparecerão aqui.</Text></View>}
    {data.prizes.length?<><Text style={s.section}>PRÊMIOS</Text>{data.prizes.map((p,i)=><View style={s.prize} key={String(p.id??i)}><Text style={s.medal}>{i===0?'🏆':'🎁'}</Text><View style={s.prizeBody}><Text style={s.prizeTitle}>{text(p.label??p.title??p.name,`Prêmio ${i+1}`)}</Text><Text style={s.infoText}>{text(p.description,'Premiação oficial LZ Games')}</Text></View></View>)}</>:null}
    <Pressable style={s.button} onPress={()=>Linking.openURL('https://sorteios.lzgames.com.br/')}><Text style={s.buttonText}>{live?'ACOMPANHAR AO VIVO':'ABRIR CENTRAL DE SORTEIOS'}</Text></Pressable>
    <Text style={s.updated}>Atualização direta do servidor oficial{data.serverTime?` • ${new Date(data.serverTime).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`:''}</Text>
  </>;
}

const s=StyleSheet.create({hero:{backgroundColor:'rgba(31,16,58,.92)',borderWidth:1,borderColor:'#6944a8',borderRadius:22,padding:20},state:{color:'#c6a7ff',fontSize:10,fontWeight:'900',letterSpacing:1.4},live:{color:'#ff6c88'},title:{color:'#fff',fontSize:23,fontWeight:'900',marginTop:9},date:{color:'#c8bdd7',fontSize:12,marginTop:5},capacity:{height:5,borderRadius:3,backgroundColor:'#261b35',marginTop:18,overflow:'hidden'},capacityFill:{height:5,backgroundColor:'#9e6cff'},meta:{color:'#9e91ad',fontSize:10,marginTop:7},section:{color:'#a898bb',fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:8},ticket:{backgroundColor:'rgba(8,23,21,.94)',borderWidth:1,borderColor:'#2f765d',borderRadius:18,padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},ticketLabel:{color:'#7c9a8e',fontSize:9,fontWeight:'900',letterSpacing:1},number:{color:'#53f6a7',fontSize:30,fontWeight:'900',letterSpacing:2,marginTop:3},ticketRight:{alignItems:'flex-end',maxWidth:'55%'},comet:{color:'#fff',fontSize:17,fontWeight:'900',marginTop:2},color:{color:'#96aaa2',fontSize:9,marginTop:2,textAlign:'right'},info:{backgroundColor:'rgba(9,22,28,.9)',borderRadius:17,padding:17,borderWidth:1,borderColor:'#243b45'},infoTitle:{color:'#edf5f1',fontSize:13,fontWeight:'800'},infoText:{color:'#879a91',fontSize:11,lineHeight:17,marginTop:3},prize:{backgroundColor:'rgba(20,16,34,.92)',borderRadius:16,padding:15,flexDirection:'row',alignItems:'center',gap:12},medal:{fontSize:25},prizeBody:{flex:1},prizeTitle:{color:'#fff',fontSize:13,fontWeight:'800'},button:{height:52,borderRadius:14,backgroundColor:'#9e6cff',alignItems:'center',justifyContent:'center'},buttonText:{color:'#10091b',fontSize:11,fontWeight:'900',letterSpacing:1},updated:{color:'#62736b',fontSize:9,textAlign:'center'}});
