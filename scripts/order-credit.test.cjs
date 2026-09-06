'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function render(credit){
  const React={useState:()=>[true,()=>{}],createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):{type,props:{...props,children}}};
  const modules={react:React,'react-native':{Text:'Text',View:'View',Pressable:'Pressable',StyleSheet:{create:x=>x}},'./effects/Neon':{NeonCard:'NeonCard',AnimatedIcon:'AnimatedIcon'}};
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/ServiceOrderCard.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:n=>{assert.ok(n in modules);return modules[n];},Intl});
  const tree=exports.ServiceOrderCard({order:{os_id:10,cliente:'Cliente sintético',modelo:'Console sintético',laudo:'Laudo preservado',valor:'100.00',subtotal:'90.10',app_credit_centavos:credit}});
  const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):n==null?'':String(n);
  return text(tree);
}
test('OS details retain consumer/equipment/report and show exact app credit with net total',()=>{
  const text=render(990);assert.match(text,/Cliente sintético/);assert.match(text,/Console sintético/);assert.match(text,/Laudo preservado/);
  assert.match(text,/Crédito do app · serviços− R\$\s*9,90/);assert.match(text,/Total após créditoR\$\s*90,10/);
});
test('Older or unredeemed OS never invent an app debit',()=>{
  for(const value of [undefined,0,-1,'not-a-number',0.5])assert.doesNotMatch(render(value),/Crédito do app · serviços|Total após crédito/);
});
