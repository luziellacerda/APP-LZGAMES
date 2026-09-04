import React from 'react';
import {StyleSheet,View} from 'react-native';
import {WebView} from 'react-native-webview';

const HYPERSPACE_HTML=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#01040c}canvas{display:block;width:100%;height:100%}
body:after{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 50% 48%,transparent 0 34%,rgba(1,4,12,.18) 62%,rgba(0,0,5,.86) 100%);pointer-events:none}
</style></head><body><canvas id="space"></canvas><script>
const canvas=document.getElementById('space'),ctx=canvas.getContext('2d');
let w=0,h=0,cx=0,cy=0,dpr=1,last=performance.now(),elapsed=0;
const STAR_COUNT=420,DEPTH=1500,stars=[];
function seed(star,randomZ=true){star.x=(Math.random()-.5)*w*2.8;star.y=(Math.random()-.5)*h*2.8;star.z=randomZ?Math.random()*DEPTH+1:DEPTH;star.pz=star.z;star.tint=Math.random()>.82?'100,205,255':Math.random()>.91?'124,255,205':'235,244,255';star.size=.35+Math.random()*1.35}
function resize(){dpr=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);cx=w*.5;cy=h*.46;if(!stars.length)for(let i=0;i<STAR_COUNT;i++){const s={};seed(s,true);stars.push(s)}}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/16.667,2.2);last=now;elapsed+=dt;
  ctx.fillStyle='rgba(1,4,12,.38)';ctx.fillRect(0,0,w,h);
  const cycle=(elapsed%520),warp=cycle>185&&cycle<405;
  const ramp=warp?Math.min(1,(cycle-185)/65, (405-cycle)/45):0;
  const speed=(warp?23+70*ramp:7)*dt;
  const focal=Math.max(w,h)*.82;
  ctx.globalCompositeOperation='lighter';
  for(const s of stars){s.pz=s.z;s.z-=speed;if(s.z<2){seed(s,false);continue}
    const x=cx+s.x/s.z*focal,y=cy+s.y/s.z*focal;
    const px=cx+s.x/s.pz*focal,py=cy+s.y/s.pz*focal;
    if(x<-80||x>w+80||y<-80||y>h+80){seed(s,false);continue}
    const near=1-s.z/DEPTH,alpha=Math.min(.96,.2+near*.9),length=warp?1+16*ramp:1;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x+(x-cx)*near*.018*length,y+(y-cy)*near*.018*length);
    ctx.strokeStyle='rgba('+s.tint+','+alpha+')';ctx.lineWidth=s.size+near*(warp?2.6:1.1);ctx.shadowColor='rgba('+s.tint+',.9)';ctx.shadowBlur=warp?8:3;ctx.stroke();
  }
  if(warp&&ramp>.05){const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.45);glow.addColorStop(0,'rgba(145,225,255,'+(.12*ramp)+')');glow.addColorStop(.18,'rgba(45,125,255,'+(.06*ramp)+')');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h)}
  ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
}
addEventListener('resize',resize);resize();requestAnimationFrame(frame);
</script></body></html>`;

export function HyperspaceBackground(){
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <WebView source={{html:HYPERSPACE_HTML}} style={s.web} scrollEnabled={false} javaScriptEnabled androidLayerType="hardware" overScrollMode="never"/>
  </View>;
}

const s=StyleSheet.create({web:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#01040c'}});
