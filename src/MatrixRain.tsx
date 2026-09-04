import React from 'react';
import {StyleSheet,View} from 'react-native';
import {WebView} from 'react-native-webview';

const MATRIX_HTML=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}html,body,canvas{width:100%;height:100%;overflow:hidden;background:#000}canvas{display:block}</style></head><body><canvas id="matrix"></canvas><script>
const canvas=document.getElementById('matrix'),ctx=canvas.getContext('2d');
const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
let font=17,columns=[],last=0;
function resize(){const d=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*d;canvas.height=innerHeight*d;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(d,0,0,d,0,0);columns=Array.from({length:Math.ceil(innerWidth/font)},(_,i)=>({x:i*font,y:-Math.random()*innerHeight/font,speed:.55+Math.random()*1.1,wait:Math.random()*100}));ctx.fillStyle='#000';ctx.fillRect(0,0,innerWidth,innerHeight)}
function draw(now){requestAnimationFrame(draw);if(now-last<38)return;last=now;ctx.fillStyle='rgba(0,0,0,.105)';ctx.fillRect(0,0,innerWidth,innerHeight);ctx.font='700 '+font+'px monospace';ctx.textAlign='center';columns.forEach((drop,i)=>{if(drop.wait>0){drop.wait--;return}const ch=chars[Math.floor(Math.random()*chars.length)];const py=drop.y*font;ctx.shadowBlur=7;ctx.shadowColor='#00ff70';ctx.fillStyle=i%7===0?'#69ff9f':'#00dc62';ctx.fillText(ch,drop.x,py);ctx.shadowBlur=13;ctx.shadowColor='#baffd2';ctx.fillStyle='#edfff3';ctx.fillText(ch,drop.x,py+font);drop.y+=drop.speed;if(py>innerHeight+260){drop.y=-Math.random()*35;drop.wait=Math.random()*65;drop.speed=.55+Math.random()*1.1}})}
addEventListener('resize',resize);resize();requestAnimationFrame(draw);
</script></body></html>`;

export function MatrixBackground(){return <View pointerEvents="none" style={StyleSheet.absoluteFill}><WebView source={{html:MATRIX_HTML}} style={s.web} scrollEnabled={false} javaScriptEnabled androidLayerType="hardware" overScrollMode="never"/></View>}
const s=StyleSheet.create({web:{...StyleSheet.absoluteFillObject,backgroundColor:'#000',opacity:.62}});
