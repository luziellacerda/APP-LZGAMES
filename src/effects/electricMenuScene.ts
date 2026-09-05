/** Procedural branching plasma + optical bevel; only the rim is painted.
 * Refraction is a stylized rim-light simulation, not sampling native labels.
 * Canvas compositing: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
 */
export const electricMenuHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}
</style></head><body><canvas id="electric" aria-hidden="true"></canvas><script>
(function(){'use strict';
  var canvas=document.getElementById('electric'),ctx=canvas.getContext('2d',{alpha:true});
  function notify(value){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(value);}
  if(!ctx){notify('electric-error');return;}
  var boxes=[],selected=0,enabled=false,raf=0,last=0,time=1.5,w=0,h=0;
  var history=document.createElement('canvas'),historyCtx=history.getContext('2d',{alpha:true});
  if(!historyCtx){notify('electric-error');return;}
  var layoutKey='';
  function noise(x){var i=Math.floor(x),f=x-i;f=f*f*(3-2*f);function hash(v){return(Math.sin(v*127.1+311.7)*43758.5453)%1;}return hash(i)*(1-f)+hash(i+1)*f;}
  function rounded(x,y,bw,bh,r){
    r=Math.max(0,Math.min(r,bw/2,bh/2));
    ctx.moveTo(x+r,y);ctx.lineTo(x+bw-r,y);ctx.quadraticCurveTo(x+bw,y,x+bw,y+r);
    ctx.lineTo(x+bw,y+bh-r);ctx.quadraticCurveTo(x+bw,y+bh,x+bw-r,y+bh);
    ctx.lineTo(x+r,y+bh);ctx.quadraticCurveTo(x,y+bh,x,y+bh-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }
  function borderClip(b,inset,spill){
    spill=spill||0;
    ctx.beginPath();rounded(b.x-spill,b.y-spill,b.width+spill*2,b.height+spill*2,12+spill);
    rounded(b.x+inset,b.y+inset,b.width-inset*2,b.height-inset*2,Math.max(2,12-inset));ctx.clip('evenodd');
  }
  function point(b,unit){
    var inset=3.7,r=Math.min(8,(b.width-8)/2,(b.height-8)/2),x=b.x+inset,y=b.y+inset;
    var bw=b.width-inset*2,bh=b.height-inset*2,a=bw-r*2,c=bh-r*2,q=Math.PI*r/2;
    var length=2*a+2*c+4*q,d=((unit%1)+1)%1*length;
    if(d<a)return{x:x+r+d,y:y,nx:0,ny:-1};d-=a;
    function corner(cx,cy,angle){var an=angle+d/r;return{x:cx+Math.cos(an)*r,y:cy+Math.sin(an)*r,nx:Math.cos(an),ny:Math.sin(an)};}
    if(d<q)return corner(x+bw-r,y+r,-Math.PI/2);d-=q;
    if(d<c)return{x:x+bw,y:y+r+d,nx:1,ny:0};d-=c;
    if(d<q)return corner(x+bw-r,y+bh-r,0);d-=q;
    if(d<a)return{x:x+bw-r-d,y:y+bh,nx:0,ny:1};d-=a;
    if(d<q)return corner(x+r,y+bh-r,Math.PI/2);d-=q;
    if(d<c)return{x:x,y:y+bh-r-d,nx:-1,ny:0};d-=c;
    return corner(x+r,y+r,Math.PI);
  }
  function poly(points,width,color){
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(var i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  }
  function glow(points,power){
    ctx.globalCompositeOperation='lighter';
    poly(points,17,'rgba(27,163,162,'+(.08*power)+')');
    poly(points,10,'rgba(27,213,182,'+(.16*power)+')');
    poly(points,5,'rgba(45,240,209,'+(.30*power)+')');
    poly(points,2.1,'rgba(98,242,255,'+(.72*power)+')');
    poly(points,.85,'rgba(243,255,253,'+(.98*power)+')');
  }
  function plasma(b,head,seed,power){
    var points=[],samples=42;
    for(var i=0;i<=samples;i++){
      var u=i/samples,p=point(b,head-u*.48);
      var jag=(noise(u*32+seed+time*1.3)*1.6+noise(u*71+seed*3-time*.65)*.75)*Math.sin(Math.PI*u);
      points.push({x:p.x+p.nx*jag,y:p.y+p.ny*jag,nx:p.nx,ny:p.ny});
    }
    // Energy falls behind the head rather than a uniformly bright moving stripe.
    for(var section=0;section<samples;section+=6){
      glow(points.slice(section,Math.min(samples+1,section+7)),power*Math.exp(-section/samples*3.2));
    }
    for(var k=7;k<samples-4;k+=9){
      var p=points[k],energy=.35+.35*(1+Math.sin(time*1.7+k)),reach=3+energy*2.6;
      var branch=[p,{x:p.x+p.nx*reach*.42-p.ny*1.8,y:p.y+p.ny*reach*.42+p.nx*1.8},
        {x:p.x+p.nx*reach+p.ny*1.1,y:p.y+p.ny*reach-p.nx*1.1}];
      glow(branch,power*energy*.65*Math.exp(-k/samples*2.8));
      poly([branch[1],{x:branch[1].x-p.ny*2.8,y:branch[1].y+p.nx*2.8}],.55,'rgba(210,255,255,.65)');
    }
    var tip=points[0],light=ctx.createRadialGradient(tip.x,tip.y,0,tip.x,tip.y,8);
    light.addColorStop(0,'rgba(244,255,255,'+(.85*power)+')');light.addColorStop(.16,'rgba(107,247,230,'+(.6*power)+')');light.addColorStop(1,'rgba(20,216,181,0)');
    ctx.fillStyle=light;ctx.fillRect(tip.x-8,tip.y-8,16,16);
  }
  function glass(b,active){
    ctx.save();borderClip(b,5.2);
    ctx.globalCompositeOperation='source-over';
    var sway=active?Math.sin(time*.6)*b.width*.22:0;
    var refraction=ctx.createLinearGradient(b.x+sway,b.y,b.x+b.width-sway,b.y+b.height);
    refraction.addColorStop(0,active?'rgba(190,255,237,.29)':'rgba(160,214,202,.12)');
    refraction.addColorStop(.22,'rgba(52,151,129,.09)');refraction.addColorStop(.48,'rgba(0,8,12,.52)');
    refraction.addColorStop(.71,active?'rgba(107,196,239,.19)':'rgba(55,100,108,.07)');refraction.addColorStop(1,'rgba(0,5,10,.6)');
    ctx.fillStyle=refraction;ctx.fillRect(b.x,b.y,b.width,b.height);
    ctx.beginPath();rounded(b.x+1,b.y+1,b.width-2,b.height-2,11);
    ctx.lineWidth=.65;ctx.strokeStyle=active?'rgba(198,255,237,.40)':'rgba(126,183,166,.16)';ctx.stroke();
    ctx.beginPath();rounded(b.x+4.7,b.y+4.7,b.width-9.4,b.height-9.4,7.3);
    ctx.lineWidth=.6;ctx.strokeStyle='rgba(0,5,13,.55)';ctx.stroke();
    ctx.restore();
  }
  function draw(dt){
    ctx.clearRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';
    // Temporal afterimages in a small bounded buffer; exponential time-based decay.
    // Not a never-cleared full-screen canvas, and not six separate WebViews.
    if(dt>0){
      historyCtx.save();historyCtx.globalCompositeOperation='destination-out';
      historyCtx.fillStyle='rgba(0,0,0,'+(1-Math.exp(-dt*3.2))+')';historyCtx.fillRect(0,0,w,h);historyCtx.restore();
      var main=ctx;ctx=historyCtx;
      var activeBox=boxes[selected];
      if(activeBox&&activeBox.width>=20&&activeBox.height>=20){
        ctx.save();ctx.lineCap='round';ctx.lineJoin='round';borderClip(activeBox,9,3);
        plasma(activeBox,time/8,7,(1-Math.exp(-dt*8))*.55);ctx.restore();
      }
      ctx=main;
    }
    for(var i=0;i<boxes.length;i++){
      var b=boxes[i];if(!b||b.width<20||b.height<20)continue;
      glass(b,i===selected);
      if(i!==selected)continue;
      ctx.save();borderClip(b,9,3);
      ctx.globalCompositeOperation='lighter';ctx.drawImage(history,0,0,w,h);
      plasma(b,time/8,7,1.05+.10*Math.sin(time*1.9));
      plasma(b,.56-time/11,43,.46);
      ctx.restore();
    }
  }
  function resize(){
    w=window.innerWidth;h=window.innerHeight;
    var dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    history.width=canvas.width;history.height=canvas.height;historyCtx.setTransform(dpr,0,0,dpr,0,0);draw(0);
  }
  function frame(now){
    raf=0;if(!enabled||document.hidden)return;
    if(!last)last=now;
    if(now-last>=33){var dt=Math.min((now-last)/1000,.07);time+=dt;last=now;draw(dt);}
    raf=requestAnimationFrame(frame);
  }
  function sync(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(enabled&&!document.hidden)raf=requestAnimationFrame(frame);}
  window.configureElectricMenu=function(config){
    var nextBoxes=Array.isArray(config.bounds)?config.bounds:[],nextSelected=Number(config.selected)||0,key=JSON.stringify(nextBoxes);
    if(nextSelected!==selected||key!==layoutKey)historyCtx.clearRect(0,0,w,h);
    layoutKey=key;boxes=nextBoxes;selected=nextSelected;enabled=!!config.motion;draw(0);sync();
  };
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',function(){enabled=false;sync();});
  window.addEventListener('error',function(){enabled=false;sync();notify('electric-error');});
  try{resize();notify('electric-ready');}catch(error){notify('electric-error');}
})();
</script></body></html>`;
