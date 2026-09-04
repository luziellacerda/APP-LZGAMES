import React from 'react';
import {StyleSheet,View} from 'react-native';
import {WebView} from 'react-native-webview';

const MATRIX_HTML=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#020604}body:after{content:'';position:fixed;inset:0;background:radial-gradient(circle at center,transparent 55%,#000 96%);pointer-events:none}canvas{display:block;width:100%;height:100%;opacity:.8}</style></head><body><canvas id="matrix"></canvas><script>
const canvas=document.getElementById('matrix'),ctx=canvas.getContext('2d');
const chars='ｱｲｳｴｵｶｷｸｹｺﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let width,height,columns,yPositions=[],lastFrame=0;const fontSize=16,columnWidth=14,frameInterval=66;
function resize(){width=canvas.width=innerWidth;height=canvas.height=innerHeight;columns=Math.floor(width/columnWidth);yPositions=Array(columns).fill(0)}
function step(now){requestAnimationFrame(step);if(now-lastFrame<frameInterval)return;lastFrame=now;ctx.fillStyle='rgba(0, 0, 0, 0.12)';ctx.fillRect(0,0,width,height);ctx.font=fontSize+'px Consolas, Menlo, monospace';ctx.shadowColor='#00ffb3';ctx.shadowBlur=8;for(let col=0;col<columns;col++){const ch=chars[Math.floor(Math.random()*chars.length)],x=col*columnWidth,y=yPositions[col]*(fontSize+2);ctx.fillStyle='#00ffb3';ctx.fillText(ch,x,y);ctx.fillStyle='#baffea';ctx.fillText(ch,x,y-fontSize*.9);if(y>height&&Math.random()>.975)yPositions[col]=0;else yPositions[col]++}ctx.shadowBlur=0;ctx.fillStyle='rgba(0,255,179,0.05)';for(let s=0;s<8;s++)ctx.fillRect(Math.random()*width,Math.random()*height,2,2)}
addEventListener('resize',resize);resize();requestAnimationFrame(step);
</script></body></html>`;

export function MatrixBackground(){return <View pointerEvents="none" style={StyleSheet.absoluteFill}><WebView source={{html:MATRIX_HTML}} style={s.web} scrollEnabled={false} javaScriptEnabled androidLayerType="hardware" overScrollMode="never"/></View>}
const s=StyleSheet.create({web:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#020604'}});
