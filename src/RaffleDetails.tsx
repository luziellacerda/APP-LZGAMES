import React,{useEffect,useMemo,useState} from 'react';
import {Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {RaffleData,User} from './api';
import {AnimatedIcon,NeonCard} from './effects/Neon';
import {TrophyLottie} from './effects/TrophyLottie';

const clean=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLowerCase();
const dateTime=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR',{dateStyle:'long',timeStyle:'short'}):'Aguardando programação oficial';
const pad=(value:number)=>String(Math.max(0,value)).padStart(2,'0');
const countdown=(target:string|null,now:number)=>{if(!target)return null;const seconds=Math.max(0,Math.ceil((new Date(target).getTime()-now)/1000));return{days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};};

export function RaffleDetails({data,user}:{data:RaffleData;user:User}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const mine=data.participants.filter(p=>clean(p.name)===clean(user.name));
  const live=data.state.toUpperCase()==='LIVE';
  const target=live&&data.phase==='DRAWING'?data.revealAt:data.scheduledAt;
  const clock=countdown(target,now);
  const current=data.history.find(item=>item.id===Number(data.giveaway?.id))??data.history[0];
  const winners=useMemo(()=>data.history.flatMap(game=>game.prizes.filter(prize=>prize.winner).map(prize=>({...prize,giveawayId:game.id,giveawayTitle:game.title}))).sort((a,b)=>new Date(b.drawnAt??0).getTime()-new Date(a.drawnAt??0).getTime()),[data.history]);
  return <>
    <NeonCard color="#c6a7ff" radius={22} style={s.hero}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{flex:1,minWidth:0}}>
          <Text style={[s.state,live&&s.live]}>{live?'● SORTEIO AO VIVO':data.scheduledAt?'PRÓXIMO SORTEIO':'SORTEIOS LZ GAMES'}</Text>
          <Text style={s.title}>{String(data.giveaway?.title??current?.title??'Novidades e premiações')}</Text>
          <Text style={s.date}>{dateTime(target)}</Text>
        </View>
        <TrophyLottie size={88}/>
      </View>
      {clock?<View style={s.clock}>{[['DIAS',clock.days],['HORAS',clock.hours],['MIN',clock.minutes],['SEG',clock.seconds]].map(([label,value])=><View key={String(label)} style={s.clockUnit}><Text style={s.clockNumber}>{pad(Number(value))}</Text><Text style={s.clockLabel}>{label}</Text></View>)}</View>:<View style={s.noSchedule}><Text style={s.noScheduleText}>A próxima data será divulgada pelo servidor oficial.</Text></View>}
      <View style={s.capacity}><View style={[s.capacityFill,{width:`${Math.min(100,data.participantLimit?data.participantCount/data.participantLimit*100:0)}%`}]}/></View>
      <Text style={s.meta}>{data.participantCount} de {data.participantLimit} participantes</Text>
    </NeonCard>
    <Text style={s.section}>MINHA PARTICIPAÇÃO</Text>
    {mine.length?mine.map(p=><NeonCard radius={18} key={`${p.number}-${p.arena_code}`} style={s.ticket}><View><Text style={s.ticketLabel}>NÚMERO DA SORTE</Text><Text style={s.number}>{p.number}</Text></View><View style={s.ticketRight}><Text style={s.ticketLabel}>COMETA</Text><Text style={s.comet}>{p.arena_code??p.number}</Text><Text style={s.color}>{p.color_name??'Cor registrada'}</Text></View></NeonCard>):<View style={s.info}><Text style={s.infoTitle}>Nenhuma participação vinculada ao seu nome</Text><Text style={s.infoText}>Quando sua inscrição estiver na lista oficial, seu número e cometa aparecerão aqui.</Text></View>}
    {current?<><Text style={s.section}>PRÓXIMO SORTEIO E PRÊMIOS</Text><View style={s.summary}><View><Text style={s.summaryTitle}>{current.title}</Text><Text style={s.infoText}>{current.status==='CLOSED'?'Sorteio encerrado':'Sorteio em andamento'}</Text></View><Text style={s.resultCount}>{current.completed}/{current.total}</Text></View>{current.prizes.map(prize=><NeonCard color="#c6a7ff" radius={16} style={s.prize} key={`${current.id}-${prize.position}`}><Text style={s.position}>{pad(prize.position)}º</Text><View style={s.prizeBody}><Text style={s.prizeTitle}>{prize.label}</Text>{prize.winner?<><View style={{flexDirection:'row',alignItems:'center',gap:4}}><AnimatedIcon name="trophy" size={24}/><Text style={[s.winner,{flex:1}]}>{prize.winner}</Text></View><Text style={s.winnerMeta}>Número {prize.winnerNumber} · {dateTime(prize.drawnAt)}</Text></>:<Text style={s.pending}>Aguardando resultado</Text>}</View></NeonCard>)}</>:null}
    <Text style={s.section}>GANHADORES</Text>
    {winners.length?winners.slice(0,20).map((winner,index)=><NeonCard color="#89d9c1" radius={16} style={s.winnerCard} key={`${winner.giveawayId}-${winner.position}-${index}`}><View style={s.medal}><Text style={s.medalText}>{winner.position}º</Text></View><View style={s.prizeBody}><Text style={s.winnerName}>{winner.winner}</Text><Text style={s.prizeTitle}>{winner.label} · {winner.giveawayTitle}</Text><Text style={s.winnerMeta}>Número {winner.winnerNumber} · {dateTime(winner.drawnAt)}</Text></View></NeonCard>):<View style={s.info}><Text style={s.infoTitle}>Nenhum resultado publicado</Text><Text style={s.infoText}>Os ganhadores aparecerão automaticamente após a confirmação oficial.</Text></View>}
    <Pressable style={s.button} onPress={()=>Linking.openURL('https://sorteios.lzgames.com.br/')}><Text style={s.buttonText}>{live?'ACOMPANHAR AO VIVO':'ABRIR CENTRAL DE SORTEIOS'}</Text></Pressable>
    <Text style={s.updated}>Dados e resultados consumidos diretamente do servidor oficial.</Text>
  </>;
}

const s=StyleSheet.create({hero:{backgroundColor:'rgba(31,16,58,.94)',borderWidth:1,borderColor:'#6944a8',borderRadius:22,padding:20},state:{color:'#c6a7ff',fontSize:10,fontWeight:'900',letterSpacing:1.4},live:{color:'#ff6c88'},title:{color:'#fff',fontSize:23,fontWeight:'900',marginTop:9},date:{color:'#c8bdd7',fontSize:12,marginTop:5},clock:{flexDirection:'row',gap:7,marginTop:18},clockUnit:{flex:1,backgroundColor:'#130c20',borderWidth:1,borderColor:'#513878',borderRadius:12,paddingVertical:10,alignItems:'center'},clockNumber:{color:'#fff',fontSize:20,fontWeight:'900',fontVariant:['tabular-nums']},clockLabel:{color:'#9c85ba',fontSize:7,fontWeight:'900',marginTop:2},noSchedule:{backgroundColor:'#160e23',borderRadius:11,padding:11,marginTop:16},noScheduleText:{color:'#ad9abd',fontSize:10,textAlign:'center'},capacity:{height:5,borderRadius:3,backgroundColor:'#261b35',marginTop:16,overflow:'hidden'},capacityFill:{height:5,backgroundColor:'#9e6cff'},meta:{color:'#9e91ad',fontSize:10,marginTop:7},section:{color:'#a898bb',fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:8},ticket:{backgroundColor:'rgba(8,23,21,.94)',borderWidth:1,borderColor:'#2f765d',borderRadius:18,padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},ticketLabel:{color:'#7c9a8e',fontSize:9,fontWeight:'900',letterSpacing:1},number:{color:'#53f6a7',fontSize:25,fontWeight:'900',letterSpacing:1,marginTop:3},ticketRight:{alignItems:'flex-end',maxWidth:'42%'},comet:{color:'#fff',fontSize:17,fontWeight:'900',marginTop:2},color:{color:'#96aaa2',fontSize:9,marginTop:2,textAlign:'right'},info:{backgroundColor:'rgba(9,22,28,.9)',borderRadius:17,padding:17,borderWidth:1,borderColor:'#243b45'},infoTitle:{color:'#edf5f1',fontSize:13,fontWeight:'800'},infoText:{color:'#879a91',fontSize:11,lineHeight:17,marginTop:3},summary:{backgroundColor:'#161022',borderRadius:15,padding:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},summaryTitle:{color:'#fff',fontSize:15,fontWeight:'900'},resultCount:{color:'#b58aff',fontSize:20,fontWeight:'900'},prize:{backgroundColor:'rgba(20,16,34,.94)',borderRadius:16,padding:15,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#33264b'},position:{color:'#9e6cff',fontSize:18,fontWeight:'900',width:42},prizeBody:{flex:1},prizeTitle:{color:'#b9aeca',fontSize:11,fontWeight:'800'},winner:{color:'#fff',fontSize:14,fontWeight:'900',marginTop:4},pending:{color:'#776c85',fontSize:12,fontWeight:'700',marginTop:5},winnerMeta:{color:'#81758d',fontSize:9,marginTop:4},winnerCard:{backgroundColor:'rgba(9,22,28,.94)',borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#284238'},medal:{width:43,height:43,borderRadius:22,backgroundColor:'#213b31',alignItems:'center',justifyContent:'center'},medalText:{color:'#53f6a7',fontWeight:'900',fontSize:11},winnerName:{color:'#fff',fontWeight:'900',fontSize:13},button:{height:52,borderRadius:14,backgroundColor:'#9e6cff',alignItems:'center',justifyContent:'center'},buttonText:{color:'#10091b',fontSize:11,fontWeight:'900',letterSpacing:1},updated:{color:'#62736b',fontSize:9,textAlign:'center'}});
