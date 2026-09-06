const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(require.resolve('../src/marketplace/catalog.ts'),'utf8');
const context={exports:{},AbortController,Set,setTimeout,clearTimeout};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {createCatalogController,parseMarketplacePrice}=context.exports;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const filters=query=>({query,category:'',condition:''});
const page=(ids,cursor=null)=>({products:ids.map(id=>({id,title:id})),nextCursor:cursor});

test('late results cannot overwrite a newer search and the old request is aborted',async()=>{
  const calls=[];const c=createCatalogController(input=>{const d=deferred();calls.push({input,...d});return d.promise;});
  const first=c.search(filters('old')),next=c.search(filters('new'));
  assert.equal(calls[0].input.signal.aborted,true);
  calls[1].resolve(page(['new']));await next;calls[0].resolve(page(['old']));await first;
  assert.equal(c.getState().products[0].id,'new');c.dispose();
});
test('pagination preserves results, deduplicates IDs and blocks duplicate requests',async()=>{
  let calls=0;const pending=deferred();const c=createCatalogController(()=>++calls===1?Promise.resolve(page(['a','b'],'20')):pending.promise);
  await c.search(filters(''));const request=c.more();await c.more();assert.equal(calls,2);
  pending.resolve(page(['b','c']));await request;
  assert.equal(c.getState().products.map(p=>p.id).join(','),'a,b,c');assert.equal(c.getState().nextCursor,null);c.dispose();
});
test('search invalidates pending next-page results',async()=>{
  const late=deferred();let n=0;
  const c=createCatalogController(()=>{n++;return n===1?Promise.resolve(page(['a'],'2')):n===2?late.promise:Promise.resolve(page(['new']));});
  await c.search(filters(''));const more=c.more();await c.search(filters('new'));late.resolve(page(['old']));await more;
  assert.equal(c.getState().products.map(p=>p.id).join(','),'new');c.dispose();
});
test('failed pagination can be retried without losing products',async()=>{
  let n=0;const c=createCatalogController(()=>{n++;if(n===1)return Promise.resolve(page(['a'],'2'));if(n===2)return Promise.reject(new Error('offline'));return Promise.resolve(page(['b']));});
  await c.search(filters(''));await c.more();assert.equal(c.getState().products.length,1);assert.ok(c.getState().error);
  await c.more();assert.equal(c.getState().products.length,2);assert.equal(c.getState().error,'');c.dispose();
});
test('unmount aborts reads and prevents late UI notifications',async()=>{
  const d=deferred();let signal;const c=createCatalogController(input=>{signal=input.signal;return d.promise;});let emissions=0;c.subscribe(()=>emissions++);
  const request=c.search(filters(''));c.dispose();const before=emissions;d.resolve(page(['late']));await request;
  assert.equal(signal.aborted,true);assert.equal(emissions,before);
});
test('a repeated cursor stops pagination instead of creating a request loop',async()=>{
  let n=0;const c=createCatalogController(()=>Promise.resolve(page([String(n++)],'20')));
  await c.search(filters(''));await c.more();await c.more();assert.equal(n,2);assert.equal(c.getState().nextCursor,null);c.dispose();
});
test('typing invalidates a running search before the debounce delay expires',async()=>{
  const d=deferred();const c=createCatalogController(()=>d.promise);
  const request=c.search(filters('old'));c.invalidate();d.resolve(page(['old']));await request;
  assert.equal(c.getState().products.length,0);assert.equal(c.getState().loading,true);c.dispose();
});
test('BRL prices use exact cents and reject malformed or ambiguous input',()=>{
  for(const [input,expected] of [['1.899,90',189990],['1899,90',189990],[' R$ 1.000,01 ',100001],['99,9',9990],['1.000',100000]])assert.equal(parseMarketplacePrice(input),expected,input);
  for(const input of ['', '0','-2','1.99','1,999','1.23,45','1e3','Infinity','999999999999999999'])assert.equal(parseMarketplacePrice(input),0,input);
});
test('store navigation, media and actions have explicit consumer safety boundaries',()=>{
  const ui=fs.readFileSync(require.resolve('../src/Marketplace.tsx'),'utf8'),app=fs.readFileSync(require.resolve('../App.tsx'),'utf8');
  assert.match(ui,/FlatList\s+key=\{columns\}/);
  assert.match(ui,/minHeight:\s*48/);
  assert.match(ui,/Mantenha o aplicativo aberto/);
  assert.match(ui,/As informações ainda não publicadas serão descartadas/);
  assert.match(ui,/Não há cobrança no aplicativo/);
  assert.match(ui,/if\s*\(busyRef.current\)\s*return/);
  assert.match(ui,/current.muted\s*=\s*true/);
  assert.match(ui,/AppState.addEventListener/);
  assert.match(ui,/galleryWidth/);
  assert.doesNotMatch(ui,/width:328|NeonCard|setInterval/);
  assert.ok(app.indexOf('if (tab === "marketplace") return')<app.indexOf('<MotionScrollView'));
});
