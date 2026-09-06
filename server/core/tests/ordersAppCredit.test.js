'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Existing authenticated OS query adds only its own credit and preserves all note fields',async()=>{
  const handlers=new Map();const row={os_id:10,cliente:'Synthetic',subtotal:'90.10',valor:'100.00',app_credit_centavos:990};let queries=0;
  const modules={express:{Router:()=>({get:(url,...f)=>handlers.set(url,f.at(-1))})},
    '../db':{dbMain:{query:async(sql,args)=>{queries++;assert.match(sql,/SELECT v\.\*, COALESCE\(ac.amount_cents,0\) AS app_credit_centavos/);assert.match(sql,/ac.os_id=v.os_id/);assert.match(sql,/WHERE \(/);assert.match(sql,/ORDER BY v.data_entrada DESC, v.os_id DESC/);assert.deepEqual(Array.from(args),['%synthetic-key']);return [[row]];}}},
    '../middleware/auth':()=>{},'../lib/phoneUtils':{normalizePhoneKey:x=>x,buildPhoneVariants:x=>[x]},
    '../lib/userLinkService':{getLinkedUserFromRequestUser:async()=>null}};
  const live=path.join(__dirname,'../routes/orders.js'),snapshot=path.join(__dirname,'../snapshots/orders.js');
  vm.runInNewContext(fs.readFileSync(fs.existsSync(live)?live:snapshot,'utf8'),{require:n=>{assert.ok(n in modules);return modules[n];},module:{exports:{}},console:{error(){}}});
  let body;const res={json:v=>{body=v;},status:()=>res};
  await handlers.get('/me/orders')({user:{telefone_normalizado:'synthetic-key'}},res);
  assert.equal(queries,1);assert.equal(body.orders[0],row);assert.equal(body.orders[0].subtotal,'90.10');assert.equal(body.orders[0].app_credit_centavos,990);
});
