import React,{useEffect,useMemo,useRef} from 'react';
import {Animated,StyleSheet,View} from 'react-native';

export function HyperspaceBackground(){
  const flight=useRef(new Animated.Value(0)).current;
  const stars=useMemo(()=>Array.from({length:46},(_,i)=>({
    left:8+((i*47)%85),top:7+((i*71)%86),size:i%7===0?2.2:1.2,delay:(i%9)/12,
  })),[]);
  useEffect(()=>{const animation=Animated.loop(Animated.timing(flight,{toValue:1,duration:2200,useNativeDriver:true}));animation.start();return()=>animation.stop();},[flight]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={s.glow}/>
    {stars.map((star,i)=><Animated.View key={i} style={[s.star,{left:`${star.left}%`,top:`${star.top}%`,width:star.size,height:star.size*7,opacity:flight.interpolate({inputRange:[0,star.delay,.72,1],outputRange:[.1,.22,.7,.08]}),transform:[{rotate:`${Math.atan2(star.top-50,star.left-50)*180/Math.PI+90}deg`},{scaleY:flight.interpolate({inputRange:[0,1],outputRange:[.25,2.8]})}]}]}/>) }
    <Animated.View style={[s.pulse,{opacity:flight.interpolate({inputRange:[0,.45,1],outputRange:[.08,.32,.06]}),transform:[{scale:flight.interpolate({inputRange:[0,1],outputRange:[.2,3.5]})}]}]}/>
  </View>;
}
const s=StyleSheet.create({glow:{position:'absolute',left:'22%',top:'30%',width:'56%',height:'38%',borderRadius:999,backgroundColor:'#0b382b',opacity:.45},star:{position:'absolute',borderRadius:2,backgroundColor:'#8dffd0',shadowColor:'#53f6a7',shadowOpacity:.8,shadowRadius:3},pulse:{position:'absolute',left:'43%',top:'43%',width:'14%',height:'14%',borderRadius:999,borderWidth:1,borderColor:'#53f6a7'}});
