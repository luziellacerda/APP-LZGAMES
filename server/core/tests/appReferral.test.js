"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {appReferralSummary,insertTimedAppReferral}=require('../lib/appReferral');
test('Services-only app credits are returned separately, scoped to authenticated referrer',async()=>{
  const db={query:async(sql,args)=>{assert.match(sql.sql,/beneficiary_id=\?/);assert.match(sql.sql,/services_only/);assert.match(sql.sql,/state='active'/);assert.deepEqual(args,[303,303]);return [[{rewards:2,cents:1980,used:990,enabled:1}]];}};
  const result=await appReferralSummary(db,303);
  assert.equal(result.creditos_acumulados_centavos,1980);assert.equal(result.bonus_centavos,990);
  assert.equal(result.withdrawable,false);assert.equal(result.redemption_enabled,true);assert.equal(result.expires,false);
  assert.equal(result.creditos_utilizados_centavos,990);assert.equal(result.saldo_disponivel_centavos,990);
  assert.equal(result.cashback_aprovado_centavos,undefined);
});
test('Invalid IDs, mismatched financial data and outages do not turn into a zero balance',async()=>{
  for(const id of ['','1 OR 1=1',0,-1])await assert.rejects(()=>appReferralSummary({query(){throw new Error('unexpected DB');}},id));
  for(const row of [{},{rewards:2,cents:990},{rewards:1,cents:-990},{rewards:0,cents:'not-a-number'},{rewards:1,cents:990,used:991,enabled:1},{rewards:1,cents:990,used:0,enabled:null},{rewards:1,cents:990,used:-1,enabled:1}])
    await assert.rejects(()=>appReferralSummary({query:async()=>[[row]]},303));
  await assert.rejects(()=>appReferralSummary({query:async()=>{throw new Error('offline');}},303));
});
test('Referral binding and UTC microsecond evidence commit atomically; failed evidence rolls back',async()=>{
  for(const failing of [false,true]) {
    const calls=[];const c={beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),
      query:async(sql,values)=>{calls.push(sql.includes('UTC_TIMESTAMP(6)')?'time':'referral');if(sql.includes('UTC_TIMESTAMP(6)')){assert.deepEqual(values,[7]);if(failing)throw new Error('synthetic evidence failure');}else assert.deepEqual(values,[303,202,'synthetic',null,null,'synthetic-code','link']);return [{insertId:7}];}};
    const action=()=>insertTimedAppReferral({getConnection:async()=>c},[303,202,'synthetic',null,null,'synthetic-code','link']);
    if(failing)await assert.rejects(action);else assert.equal((await action()).insertId,7);
    assert.deepEqual(calls,['begin','referral','time',failing?'rollback':'commit','release']);
  }
});
