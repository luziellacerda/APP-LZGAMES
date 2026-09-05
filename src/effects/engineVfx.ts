/** Local Canvas exhaust only. Literal source also runs in release Hermes/WebView. */
export const engineVfxSource = `
  // One continuous pressure signal drives the flame, nozzle and vapor lighting.
  function enginePulse(time,side){
    var phase=side*.071;
    return .86+.08*Math.sin(time*7.1+phase)+.045*Math.sin(time*12.7+phase*2);
  }
  function engineFlameSample(time,side,u){
    var power=enginePulse(time,side),phase=u*13-time*16+side*.071;
    var curl=Math.sin(phase)+.42*Math.sin(u*23-time*21+side*.11);
    var taper=Math.pow(Math.max(0,1-u),.72);
    return {point:[side+curl*u*u*4.8,3+u*6+Math.cos(phase*.81)*u*u*2.8,-54-u*(96+power*24)],
      radius:(5.6+Math.sin(phase)*1.35+Math.sin(u*27-time*14)*.55)*taper,power:power};
  }
  function vaporEnvelope(p){
    var life=Math.min(1,p.age/p.life);
    return {radius:p.size+Math.pow(life,.8)*19,
      opacity:(1-Math.exp(-p.age*12))*Math.pow(1-life,1.6)*.5,
      heat:Math.exp(-p.age*3.6)};
  }
  // Three small cached, shaded billow textures. No per-frame noise textures/blur.
  var vaporTextures=[0,1,2].map(function(variant){
    var texture=document.createElement('canvas');texture.width=texture.height=96;
    var brush=texture.getContext('2d');
    function lobe(x,y,r,lit){
      var shade=brush.createRadialGradient(x-r*.24,y-r*.3,r*.03,x,y,r);
      shade.addColorStop(0,lit?'rgba(173,205,224,.7)':'rgba(33,49,72,.48)');
      shade.addColorStop(.3,lit?'rgba(117,157,184,.6)':'rgba(22,38,61,.42)');
      shade.addColorStop(.65,'rgba(57,83,112,.28)');shade.addColorStop(1,'rgba(28,51,80,0)');
      brush.fillStyle=shade;brush.fillRect(x-r,y-r,r*2,r*2);
    }
    lobe(49,53,39,false);
    for(var i=0;i<9;i++){
      var angle=i*2.399+variant*.8,distance=10+6*Math.sin(i*3+variant);
      lobe(48+Math.cos(angle)*distance,48+Math.sin(angle)*distance,18+(i%3)*4,i%3!==0);
    }
    return texture;
  });
  function smokeVolume(ship){
    // Far to near, with a shaded body underneath the hot additive scattering.
    var ordered=ship.particles.slice().sort(function(a,b){return b.z-a.z;});
    ordered.forEach(function(p){
      var at=project([p.x,p.y,p.z]),v=vaporEnvelope(p),radius=v.radius*at.k;
      var light=enginePulse(ship.time,p.side);
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=ship.alpha*v.opacity;
      ctx.translate(at.x,at.y);ctx.rotate(p.spin+p.age*.35);
      ctx.scale(1,1.24);ctx.drawImage(vaporTextures[p.texture],-radius,-radius,radius*2,radius*2);ctx.restore();
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=ship.alpha;
      bloom(at.x-radius*.13,at.y-radius*.22,radius*.94,radius*1.08,v.opacity*v.heat*light*.65);
    });
  }
  function flameRibbon(points,width,fill){
    var left=[],right=[];
    for(var i=0;i<points.length;i++){
      var at=points[i],next=points[Math.min(i+1,points.length-1)],previous=points[Math.max(0,i-1)];
      var dx=next.x-previous.x,dy=next.y-previous.y,length=Math.hypot(dx,dy)||1;
      var radius=at.radius*width;
      left.push({x:at.x-dy/length*radius,y:at.y+dx/length*radius});
      right.push({x:at.x+dy/length*radius,y:at.y-dx/length*radius});
    }
    var outline=left.concat(right.reverse());ctx.beginPath();
    ctx.moveTo((outline[0].x+outline[outline.length-1].x)*.5,(outline[0].y+outline[outline.length-1].y)*.5);
    for(var j=0;j<outline.length;j++){
      var q=outline[j],next=outline[(j+1)%outline.length];
      ctx.quadraticCurveTo(q.x,q.y,(q.x+next.x)*.5,(q.y+next.y)*.5);
    }
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  }
  function drawEngineExhaust(ship){
    ctx.save();smokeVolume(ship);ctx.globalAlpha=ship.alpha;ctx.globalCompositeOperation='lighter';
    [-30,30].forEach(function(side){
      var power=enginePulse(ship.time,side),points=[];
      for(var i=0;i<=18;i++){
        var sample=engineFlameSample(ship.time,side,i/18),at=project(world(sample.point,ship));
        points.push({x:at.x,y:at.y,radius:sample.radius*at.k});
      }
      var origin=points[0],tail=points[points.length-1];
      // Broad soft light follows the distorted jet, not a rigid quadrilateral.
      for(var j=1;j<points.length;j+=3){
        var at=points[j],falloff=(1-j/points.length)*power;
        bloom(at.x,at.y,at.radius*3.1,at.radius*3.1,falloff*.17);
      }
      [2.1,1.35,.78,.32].forEach(function(width,layer){
        var g=ctx.createLinearGradient(origin.x,origin.y,tail.x,tail.y);
        var colors=layer===3?['rgba(255,253,234,.94)','rgba(219,247,255,.83)','rgba(103,209,255,.24)']:
          layer===2?['rgba(207,247,255,.66)','rgba(102,218,255,.6)','rgba(48,134,255,.12)']:
          ['rgba(67,154,255,.14)','rgba(44,126,255,.12)','rgba(37,85,223,.03)'];
        g.addColorStop(0,colors[0]);g.addColorStop(.28,colors[1]);g.addColorStop(.7,colors[2]);g.addColorStop(1,'rgba(47,117,255,0)');
        flameRibbon(points,width,g);
      });
      // Moving compression knots dissolve downstream inside the flame.
      for(var knot=0;knot<3;knot++){
        var u=.17+knot*.2+.025*Math.sin(ship.time*8-knot+side*.07);
        var sample=engineFlameSample(ship.time,side,u),at=project(world(sample.point,ship));
        bloom(at.x,at.y,sample.radius*at.k*.8,sample.radius*at.k*1.35,(.55-knot*.13)*power);
      }
      bloom(origin.x,origin.y,23*project(world([side,3,-54],ship)).k,18*project(world([side,3,-54],ship)).k,.74*power);
    });ctx.restore();
  }
  function drawTurbine(ship,side){
    var power=enginePulse(ship.time,side);
    var housing=[[-9,-7,0],[9,-7,0],[10,6,-4],[-10,6,-4]].map(function(p){return project(world([side+p[0],3+p[1],-48+p[2]],ship));});
    var p=project(world([side,3,-54],ship)),r=6.3*p.k;
    var metal=ctx.createLinearGradient(p.x-r,p.y-r,p.x+r,p.y+r);
    metal.addColorStop(0,'#a9cedd');metal.addColorStop(.3,'#304b67');metal.addColorStop(.66,'#0b182b');metal.addColorStop(1,'#6c9fbf');
    polygon(housing,metal,'rgba(142,207,232,.75)',.65);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ship.bank);ctx.scale(1,.64);
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#031020';ctx.fill();ctx.strokeStyle='#9fd6ed';ctx.lineWidth=.85;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r*.77,0,Math.PI*2);ctx.strokeStyle='rgba(69,136,177,.75)';ctx.lineWidth=.75;ctx.stroke();
    for(var blade=0;blade<9;blade++){
      var angle=ship.time*4.3+blade*Math.PI*2/9;
      ctx.beginPath();ctx.moveTo(Math.cos(angle)*r*.4,Math.sin(angle)*r*.4);
      ctx.quadraticCurveTo(Math.cos(angle+.28)*r*.63,Math.sin(angle+.28)*r*.63,Math.cos(angle+.48)*r*.89,Math.sin(angle+.48)*r*.89);
      ctx.strokeStyle='rgba(111,191,227,'+(.42+.25*power)+')';ctx.lineWidth=.65;ctx.stroke();
    }
    ctx.globalCompositeOperation='lighter';
    bloom(0,0,r*2.8,r*2.8,.64*power);
    var heat=ctx.createRadialGradient(-r*.12,-r*.15,0,0,0,r*.7);
    heat.addColorStop(0,'#fffdeb');heat.addColorStop(.2,'#edfbff');heat.addColorStop(.52,'rgba(74,206,255,.88)');heat.addColorStop(1,'rgba(39,107,255,0)');
    ctx.beginPath();ctx.arc(0,0,r*(.65+.1*power),0,Math.PI*2);ctx.fillStyle=heat;ctx.fill();ctx.restore();
    var lip=project(world([side,0,-43],ship));
    ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba(141,228,255,'+(.4+.35*power)+')';ctx.lineWidth=.85;
    ctx.beginPath();ctx.moveTo(lip.x-r,lip.y);ctx.quadraticCurveTo(lip.x,lip.y-r*.25,lip.x+r,lip.y);ctx.stroke();ctx.globalCompositeOperation='source-over';
  }
`;
