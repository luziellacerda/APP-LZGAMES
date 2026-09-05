/** Raffle-only Matrix rain: cached vector cups, no letters/fonts/remote assets. */
export const trophyRainHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#060502}body:after{content:'';position:fixed;inset:0;background:radial-gradient(circle at center,transparent 55%,#000 96%);pointer-events:none}canvas{display:block;width:100%;height:100%;opacity:.8}
</style></head><body><canvas aria-hidden="true" id="trophy-rain"></canvas><script>
(function(){'use strict';
  var canvas=document.getElementById('trophy-rain'),ctx=canvas.getContext('2d');if(!ctx)return;
  var width=0,height=0,heads=[],raf=0,lastFrame=0,enabled=false;
  // Same 18 px fall / 66 ms and fading trail; raffle trophies are now gold.
  var columnWidth=24,rowHeight=18,frameInterval=66;
  function trophySprite(color){
    var sprite=document.createElement('canvas');sprite.width=sprite.height=64;
    var g=sprite.getContext('2d');g.scale(2,2);g.translate(7,6);
    g.fillStyle=color;g.strokeStyle=color;g.lineWidth=1.15;g.lineCap='round';g.lineJoin='round';
    g.shadowColor='#ffc44d';g.shadowBlur=5;
    // Handles, bowl, stem and plinth remain legible at a 16 px symbol size.
    g.beginPath();g.moveTo(4,4);g.lineTo(1,4);g.bezierCurveTo(1,8,2,9,5,9);
    g.moveTo(14,4);g.lineTo(17,4);g.bezierCurveTo(17,8,16,9,13,9);g.stroke();
    g.beginPath();g.moveTo(4,2);g.lineTo(14,2);g.lineTo(13,8);
    g.quadraticCurveTo(12,11,9,11);g.quadraticCurveTo(6,11,5,8);g.closePath();g.fill();
    g.fillRect(8,11,2,3);g.fillRect(5,14,8,2);
    // A cut-in highlight distinguishes the cup from a plain falling square.
    g.shadowBlur=0;g.strokeStyle='rgba(55,30,3,.6)';g.lineWidth=.85;
    g.beginPath();g.moveTo(6,4);g.lineTo(6.6,7);g.quadraticCurveTo(7,8.5,8,9);g.stroke();
    return sprite;
  }
  var trail=trophySprite('#efb93b'),tip=trophySprite('#fff1bd');
  function glyph(sprite,x,y){ctx.drawImage(sprite,x-7,y-23,32,32);}
  function resize(){
    width=window.innerWidth;height=window.innerHeight;
    var dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    heads=Array.from({length:Math.ceil(width/columnWidth)},function(){return Math.floor(Math.random()*height/rowHeight)*rowHeight;});
    ctx.fillStyle='#060502';ctx.fillRect(0,0,width,height);
    // A quiet static preview also works with system Reduce Motion enabled.
    heads.forEach(function(y,col){
      for(var row=9;row>=1;row--){ctx.globalAlpha=Math.pow(.82,row);glyph(trail,col*columnWidth+3,y-row*rowHeight);}
      ctx.globalAlpha=1;glyph(tip,col*columnWidth+3,y);
    });
  }
  function draw(){
    ctx.globalAlpha=1;ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(0,0,width,height);
    heads.forEach(function(y,col){
      glyph(trail,col*columnWidth+3,y);glyph(tip,col*columnWidth+3,y-rowHeight*.8);
      heads[col]=y>height&&Math.random()>.975?-Math.floor(Math.random()*8)*rowHeight:y+rowHeight;
    });
  }
  function frame(now){
    raf=0;if(!enabled||document.hidden)return;
    if(!lastFrame)lastFrame=now;
    if(now-lastFrame>=frameInterval){lastFrame=now;draw();}
    raf=requestAnimationFrame(frame);
  }
  function sync(){if(raf)cancelAnimationFrame(raf);raf=0;lastFrame=0;if(enabled&&!document.hidden)raf=requestAnimationFrame(frame);}
  window.setMotionEnabled=function(value){enabled=!!value;sync();};
  window.addEventListener('resize',resize);document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',function(){enabled=false;sync();});resize();
})();
</script></body></html>`;
