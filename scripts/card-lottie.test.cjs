const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../src/effects');
const compile=name=>ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const modelContext={exports:{},require(name){assert.match(name,/^\.\/assets\/[\w-]+\.json$/);return require(path.join(root,name))}};
vm.runInNewContext(compile('cardLotties.ts'),modelContext);const {cardLotties}=modelContext.exports;
const expected={cashback:['cashback-money','9Rs7JUzu1D'],appCredit:['app-credit-coin','0N5eblUHrK'],invite:['invite-payment','cUEV8IuLNE'],entry:['referral-entry-money','JAEyxMYTN2'],suite:['suite-rocket','kQtY3BH2g7']};
const clone=v=>JSON.parse(JSON.stringify(v));
function walk(v,fn){fn(v);if(v&&typeof v==='object')Object.entries(v).forEach(([k,c])=>{if(k!=='meta')walk(c,fn)})}
function fixture(initial={}){
 const state={kind:'cashback',visible:true,allowed:true,width:64,height:42,...initial},slots=[];let cursor=0;const surface={};
 const React={memo:c=>c,createElement:(type,props,...children)=>({type,props:{...props,children}}),useContext:c=>{assert.equal(c,surface);return state.visible},useState:v=>{const i=cursor++;slots[i]??={value:v};return [slots[i].value,n=>{slots[i].value=n}]}};
 const modules={react:React,'react-native':{View:'View',Text:'Text',StyleSheet:{create:s=>s}},'./Motion':{SurfaceMotion:surface,useMotionAllowed:()=>state.allowed},'./Neon':{VectorMotion:'VectorMotion'},'./cardLotties':{cardLotties}};
 const ctx={exports:{},require:n=>{assert.ok(n in modules);return modules[n]},fetch:()=>assert.fail('No network'),setTimeout:()=>assert.fail('No timers')};vm.runInNewContext(compile('CardLottie.tsx'),ctx);
 return {render(next={}){Object.assign(state,next);cursor=0;return ctx.exports.CardLottie(state)}};
}
const player=tree=>tree.props.children[0],style=s=>Object.assign({},...[s].flat().filter(Boolean));
test('each requested card uses its exact public asset and carries the complete license locally',()=>{
 assert.deepEqual(Object.keys(cardLotties).sort(),Object.keys(expected).sort());
 for(const [key,[name,hash]] of Object.entries(expected)){
  const a=cardLotties[key],original=require(path.join(root,'assets',name+'.json'));
  assert.deepEqual(clone(a.source.layers),original.layers);
  assert.ok(a.source.meta.credit.source.endsWith(hash));assert.match(a.source.meta.credit.licenseText,/Permission is hereby granted/);
  assert.ok(a.speed>0&&a.speed<=1);assert.ok(a.stillProgress>=0&&a.stillProgress<=1);
  assert.ok(fs.statSync(path.join(root,'assets',name+'.json')).size<250000,'bounded bundled artwork');
  let animated=0;walk(a.source,v=>{
   if(typeof v==='string')assert.ok(!/https?:|data:|file:|ftp:/i.test(v),'no runtime asset URLs');
   if(typeof v==='number')assert.ok(Number.isFinite(v));
   if(!v||typeof v!=='object')return;
   assert.notEqual(typeof v.x,'string','no executable Lottie expression');assert.equal(v.expr,undefined);assert.equal(v.expression,undefined);
   if(Array.isArray(v.k) && (v.a===1 || v.k.some(key=>key&&typeof key==='object'&&typeof key.t==='number')))animated++;
  });assert.ok(animated>0);
 }
});
test('small decorative slots never intercept taps, expand their card, or advertise payment status',()=>{
 for(const kind of Object.keys(expected))for(const [width,height] of [[52,44],[78,63],[96,63],[76,54],[70.2,70.2]]){
  const t=fixture({kind,width,height}).render(),v=player(t),s=style(t.props.style),canvas=style(v.props.style);
  assert.equal(s.width,width);assert.equal(s.height,height);assert.equal(s.flexShrink,0);assert.equal(s.overflow,'hidden');
  assert.equal(t.props.pointerEvents,'none');assert.equal(t.props.accessible,false);assert.equal(t.props.importantForAccessibility,'no-hide-descendants');
  assert.equal(v.type,'VectorMotion');assert.equal(canvas.left,(width-canvas.width)/2);assert.equal(canvas.top,(height-canvas.height)/2);
  assert.equal(v.props.source,cardLotties[kind].source);
 }
});
test('all card animations pause offscreen/in background/reduced motion through the existing native controller',()=>{
 for(const kind of Object.keys(expected)){
  const f=fixture({kind});assert.equal(player(f.render()).props.running,true);
  assert.equal(player(f.render({visible:false})).props.running,false);
  assert.equal(player(f.render({visible:true,allowed:false})).props.running,false);
  assert.equal(player(f.render({allowed:true})).props.running,true);
  assert.equal(player(f.render({allowed:false})).props.stillProgress,cardLotties[kind].stillProgress);
 }
 const source=fs.readFileSync(path.join(root,'CardLottie.tsx'),'utf8');assert.doesNotMatch(source,/WebView|fetch\(|setInterval|requestAnimationFrame|setTimeout/);
});
test('native failure uses a static glyph in the same slot, without a retry loop',()=>{
 const f=fixture(),tree=f.render();player(tree).props.onFailure();const t=f.render();
 assert.equal(player(t).type,'Text');assert.equal(style(t.props.style).width,64);assert.equal(style(t.props.style).height,42);
 assert.equal(player(f.render({kind:'appCredit'})).type,'VectorMotion');
});
test('new calendar retains equivalent numeric rotation instead of executing the After Effects expression',()=>{
 const a=require(path.join(root,'assets/referral-calendar.json'));
 assert.equal(a.w,638);assert.equal(a.h,524);assert.equal(a.op,181);
 assert.deepEqual(a.layers.find(l=>l.nm==='Capa 15 contornos - Grupo 8').ks.r,a.layers.find(l=>l.nm==='Capa 15 contornos - Grupo 134').ks.r);
 assert.equal(a.layers[1].ks.r.a,1);
 const credit=require(path.join(root,'assets/referral-calendar-license.json'));assert.ok(credit.source.endsWith('jxFJ2FUhZx'));
});
test('only the requested decorations are replaced; the independent spaceflight remains present',()=>{
 const app=fs.readFileSync(path.join(root,'../../App.tsx'),'utf8'),rewards=fs.readFileSync(path.join(root,'../ReferralRewards.tsx'),'utf8');
 assert.match(app,/CardLottie kind="entry" width=\{52\} height=\{44\}/);
 assert.match(app,/CardLottie kind="suite" width=\{70\.2\} height=\{70\.2\}/);
 assert.match(rewards,/CardLottie kind="appCredit" width=\{78\} height=\{63\}/);
 assert.match(rewards,/CardLottie kind="cashback" width=\{96\} height=\{63\}/);
 assert.ok(app.includes('SpaceflightBackground'));assert.match(app,/TrophyLottie size=\{86\}/);
 for(const kind of ['appCredit','cashback','invite'])assert.match(rewards,new RegExp('CardLottie kind="'+kind+'"'));
 assert.doesNotMatch(rewards,/Linking\.openURL|WebView/);
});
