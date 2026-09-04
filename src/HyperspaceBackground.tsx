import React,{useEffect,useMemo,useRef} from 'react';
import {Animated,Easing,StyleSheet,Text,View,useWindowDimensions} from 'react-native';

const GLYPHS='01アイウエオカキクケコサシスセソZXCVBNM<>/{}';
const stream=(seed:number,length:number)=>Array.from({length},(_,i)=>GLYPHS[(seed*11+i*7+i*i)%GLYPHS.length]).join('\n');

export function HyperspaceBackground(){
  const {width,height}=useWindowDimensions();
  const columns=Math.max(12,Math.ceil(width/25));
  const rain=useMemo(()=>Array.from({length:columns},(_,i)=>({
    text:stream(i,18+(i%10)),left:i*(width/columns),duration:3000+(i%7)*620,delay:(i*487)%3600,opacity:.16+(i%4)*.055,fontSize:12+(i%3),
  })),[columns,width]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={s.black}/><View style={[s.glow,{left:width*.15,top:height*.2,width:width*.7,height:height*.55}]}/>{rain.map((column,i)=><MatrixColumn key={`${columns}-${i}`} {...column} screenHeight={height}/>)}</View>;
}

function MatrixColumn({text,left,duration,delay,opacity,fontSize,screenHeight}:{text:string;left:number;duration:number;delay:number;opacity:number;fontSize:number;screenHeight:number}){
  const fall=useRef(new Animated.Value(0)).current;
  useEffect(()=>{const animation=Animated.loop(Animated.sequence([Animated.delay(delay),Animated.timing(fall,{toValue:1,duration,easing:Easing.linear,useNativeDriver:true}),Animated.timing(fall,{toValue:0,duration:0,useNativeDriver:true})]));animation.start();return()=>animation.stop();},[delay,duration,fall]);
  return <Animated.View style={[s.column,{left,opacity,transform:[{translateY:fall.interpolate({inputRange:[0,1],outputRange:[-520,screenHeight+80]})}]}]}><Text style={[s.head,{fontSize}]}>●</Text><Text style={[s.code,{fontSize,lineHeight:fontSize+3}]}>{text}</Text></Animated.View>;
}

const s=StyleSheet.create({black:{...StyleSheet.absoluteFillObject,backgroundColor:'#010806'},glow:{position:'absolute',borderRadius:999,backgroundColor:'#075238',opacity:.2,shadowColor:'#36ff9c',shadowOpacity:.5,shadowRadius:70},column:{position:'absolute',top:0,width:24,alignItems:'center'},head:{color:'#e9fff5',fontWeight:'900',textShadowColor:'#9affca',textShadowRadius:8,height:13},code:{color:'#39ef91',fontFamily:'monospace',fontWeight:'700',textAlign:'center',textShadowColor:'#20c978',textShadowRadius:4}});
