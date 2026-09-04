import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Easing,StyleSheet,Text,View,useWindowDimensions} from 'react-native';

const GLYPHS='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
const glyph=(column:number,row:number,frame:number)=>GLYPHS[(column*31+row*17+frame*(row%4+1))%GLYPHS.length];

export function HyperspaceBackground(){
  const {width,height}=useWindowDimensions();
  const [frame,setFrame]=useState(0);
  const count=Math.max(15,Math.ceil(width/20));
  const columns=useMemo(()=>Array.from({length:count},(_,i)=>({left:i*(width/count),length:12+(i*7)%20,duration:2600+(i*613)%4200,delay:(i*887)%5000,fontSize:12+(i%3),brightness:.55+(i%4)*.13})),[count,width]);
  useEffect(()=>{const timer=setInterval(()=>setFrame(v=>(v+1)%10000),190);return()=>clearInterval(timer);},[]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><View style={s.black}/>{columns.map((column,i)=><MatrixColumn key={`${count}-${i}`} column={i} frame={frame} screenHeight={height} {...column}/>)}</View>;
}

function MatrixColumn({column,frame,left,length,duration,delay,fontSize,brightness,screenHeight}:{column:number;frame:number;left:number;length:number;duration:number;delay:number;fontSize:number;brightness:number;screenHeight:number}){
  const fall=useRef(new Animated.Value(0)).current;
  useEffect(()=>{const animation=Animated.loop(Animated.sequence([Animated.delay(delay),Animated.timing(fall,{toValue:1,duration,easing:Easing.linear,useNativeDriver:true}),Animated.timing(fall,{toValue:0,duration:0,useNativeDriver:true})]));animation.start();return()=>animation.stop();},[delay,duration,fall]);
  const rows=Array.from({length},(_,row)=>({char:(column+row+frame)%19===0?'':glyph(column,row,frame),opacity:Math.max(.04,(row/length)*brightness)}));
  return <Animated.View style={[s.column,{left,width:fontSize+4,transform:[{translateY:fall.interpolate({inputRange:[0,1],outputRange:[-(length*(fontSize+2))-80,screenHeight+40]})}]}]}>
    {rows.map((row,i)=><Text key={i} style={[s.code,{fontSize,lineHeight:fontSize+2,opacity:row.opacity}]}>{row.char||' '}</Text>)}
    <Text style={[s.leader,{fontSize,lineHeight:fontSize+2}]}>ｱ</Text>
  </Animated.View>;
}

const s=StyleSheet.create({black:{...StyleSheet.absoluteFillObject,backgroundColor:'#000'},column:{position:'absolute',top:0,alignItems:'center'},code:{height:16,color:'#00f26d',fontFamily:'monospace',fontWeight:'700',textAlign:'center',textShadowColor:'#00c957',textShadowRadius:5},leader:{height:16,color:'#effff5',fontFamily:'monospace',fontWeight:'900',textAlign:'center',textShadowColor:'#8affbb',textShadowRadius:10}});
