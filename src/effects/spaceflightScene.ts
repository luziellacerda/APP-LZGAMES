import { flightModelSource } from "./flightLayout";
import { engineVfxSource } from "./engineVfx";

/** Perspective mesh + point-lit engines and bounded world-space exhaust. One 30 fps canvas. */
export const spaceflightHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#030a17}canvas{display:block;width:100%;height:100%}
</style></head><body><canvas aria-hidden="true" id="space"></canvas><script>
(function(){'use strict';
  var canvas=document.getElementById('space'),ctx=canvas.getContext('2d');if(!ctx)return;
  var w=0,h=0,camera,stars=[],background=document.createElement('canvas'),raf=0,last=0,enabled=false;
  ${flightModelSource}
  ${engineVfxSource}
  var simulation=createFlightSimulation();
  // Prewarm bounded exhaust so paused/reduced-motion still has visible engines.
  for(var warm=0;warm<24;warm++)simulation.update(.04);
  var DEPTH=1500,COUNT=100;
  function star(z){return{x:(Math.random()-.5)*w*3,y:(Math.random()-.5)*h*2.5,z:z,size:.45+Math.random()*.7};}
  function project(p){var k=camera.focal/Math.max(30,p[2]);return{x:camera.cx+p[0]*k,y:camera.cy+p[1]*k,k:k};}
  function resize(){
    w=window.innerWidth;h=window.innerHeight;camera=flightLayout(w,h);
    var dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    background.width=w;background.height=h;var bg=background.getContext('2d');bg.fillStyle='#030a17';bg.fillRect(0,0,w,h);
    var glow=bg.createRadialGradient(camera.cx,camera.cy,0,camera.cx,camera.cy,w*.9);
    glow.addColorStop(0,'#17334a');glow.addColorStop(.34,'#0a1c30');glow.addColorStop(1,'#030a17');bg.fillStyle=glow;bg.fillRect(0,0,w,h);
    stars=Array.from({length:COUNT},function(){return star(90+Math.random()*(DEPTH-90));});draw(0);
  }
  function polygon(points,fill,stroke,width){
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(var i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();
    ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||.5;ctx.stroke();}
  }
  function bloom(x,y,rx,ry,power){
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    var g=ctx.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba(234,253,255,'+power+')');g.addColorStop(.12,'rgba(110,228,255,'+power*.85+')');
    g.addColorStop(.38,'rgba(28,139,255,'+power*.28+')');g.addColorStop(1,'rgba(30,80,230,0)');
    ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  // Faceted hull seen from above/behind. Nose +Z, engines and exhaust -Z.
  var mesh=[
    {p:[[-16,5,-48],[16,5,-48],[10,3,30],[0,0,88],[-10,3,30]],c:[27,43,61]},
    {p:[[-16,5,-48],[-18,-4,-40],[-10,-6,25],[0,-2,88],[0,0,88],[-10,3,30]],c:[77,107,130]},
    {p:[[16,5,-48],[18,-4,-40],[10,-6,25],[0,-2,88],[0,0,88],[10,3,30]],c:[41,68,91]},
    {p:[[-18,-4,-40],[0,-13,-28],[0,-8,32],[0,-2,88],[-10,-6,25]],c:[168,195,212]},
    {p:[[18,-4,-40],[0,-13,-28],[0,-8,32],[0,-2,88],[10,-6,25]],c:[84,120,151]},
    {p:[[-15,0,27],[-78,3,-56],[-61,7,-61],[-17,7,-36]],c:[26,52,76]},
    {p:[[-15,0,27],[-78,3,-56],[-57,-4,-43],[-21,-5,8]],c:[150,182,198]},
    {p:[[-21,-5,8],[-57,-4,-43],[-16,-4,-37]],c:[79,117,146]},
    {p:[[15,0,27],[78,3,-56],[61,7,-61],[17,7,-36]],c:[23,42,66]},
    {p:[[15,0,27],[78,3,-56],[57,-4,-43],[21,-5,8]],c:[100,139,169]},
    {p:[[21,-5,8],[57,-4,-43],[16,-4,-37]],c:[39,76,109]},
    {p:[[-7,-9,32],[0,-16,16],[0,-17,-10],[-9,-8,-23]],c:[33,81,109],glass:true},
    {p:[[7,-9,32],[0,-16,16],[0,-17,-10],[9,-8,-23]],c:[12,34,61],glass:true},
    {p:[[-2,-9,-18],[-2,-31,-40],[-2,-3,-48]],c:[150,184,201]},
    {p:[[2,-9,-18],[2,-31,-40],[2,-3,-48]],c:[39,72,102]},
    {p:[[-18,-4,-40],[18,-4,-40],[16,5,-48],[-16,5,-48]],c:[17,33,49]}
  ];
  // Sort the immutable mesh once; shallow bank does not change Z ordering.
  mesh.sort(function(a,b){return b.p.reduce(function(n,p){return n+p[2];},0)/b.p.length-a.p.reduce(function(n,p){return n+p[2];},0)/a.p.length;});
  function world(p,ship){var c=Math.cos(ship.bank),s=Math.sin(ship.bank);return[p[0]*c-p[1]*s+ship.x,p[0]*s+p[1]*c+ship.y,p[2]+ship.z];}
  function surface(face,ship){
    var vertices=face.p.map(function(p){return world(p,ship);}),a=vertices[0],b=vertices[1],c=vertices[2];
    var u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    var n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],norm=Math.hypot(n[0],n[1],n[2])||1;
    var light=.38+.62*Math.abs((n[0]*-.4+n[1]*-.8+n[2]*-.45)/norm);
    var points=vertices.map(project),g=ctx.createLinearGradient(points[0].x,points[0].y,points[2].x+1,points[2].y+4);
    function shade(k){return 'rgb('+face.c.map(function(value){return Math.min(255,Math.round(value*k));}).join(',')+')';}
    g.addColorStop(0,shade(light*1.22));g.addColorStop(.45,shade(light));g.addColorStop(.63,shade(light*(face.glass?1.75:1.06)));g.addColorStop(1,shade(light*.48));
    polygon(points,g,face.glass?'rgba(130,218,255,.65)':'rgba(130,186,215,.24)',.55);
  }
  function exhaust(ship){
    drawEngineExhaust(ship);
  }
  function drawShip(ship){
    exhaust(ship);ctx.save();ctx.globalAlpha=ship.alpha;
    mesh.forEach(function(face){surface(face,ship);});
    [-30,30].forEach(function(side){drawTurbine(ship,side);});ctx.restore();
  }
  function draw(dt){
    ctx.globalCompositeOperation='source-over';ctx.drawImage(background,0,0,w,h);
    for(var i=0;i<stars.length;i++){
      var s=stars[i];s.z-=camera.cruiseSpeed*dt;if(s.z<55)s=stars[i]=star(DEPTH);
      var p=project([s.x,s.y,s.z]),x=p.x,y=p.y;
      if(x<-25||x>w+25||y<-25||y>h+25){stars[i]=star(DEPTH);continue;}
      var distance=Math.hypot(x-camera.cx,y-camera.cy)||1,length=Math.min(12,1.5+(DEPTH-s.z)/220),opacity=.25+.65*(1-s.z/DEPTH);
      ctx.lineWidth=Math.min(1.4,s.size*p.k+.35);ctx.strokeStyle='rgba(178,224,255,'+opacity+')';
      ctx.beginPath();ctx.moveTo(x-(x-camera.cx)/distance*length,y-(y-camera.cy)/distance*length);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle='rgba(237,249,255,'+opacity+')';ctx.fillRect(x-.5,y-.5,1,1);
    }
    drawShip(simulation.update(dt));
  }
  function frame(now){raf=0;if(!enabled||document.hidden)return;if(!last)last=now;
    if(now-last>=33){var dt=Math.min((now-last)/1000,.07);last=now;draw(dt);}raf=requestAnimationFrame(frame);}
  function sync(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(enabled&&!document.hidden)raf=requestAnimationFrame(frame);}
  window.setMotionEnabled=function(value){enabled=!!value;sync();};
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',function(){enabled=false;sync();});resize();
})();
</script></body></html>`;
