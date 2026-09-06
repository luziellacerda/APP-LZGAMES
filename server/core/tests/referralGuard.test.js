"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const guard=require('../lib/referralGuard');
const {parseAppInvite}=require('../lib/appInvite');
const secret='synthetic-test-secret-not-production';
function sign(payload){const p=Buffer.from(JSON.stringify(payload)).toString('base64url');return `LZ${p}.${crypto.createHmac('sha256',secret).update(p).digest().subarray(0,16).toString('base64url')}`;}
test('new invitation nonce and signature reject tampering, padding, suffixes, unsafe IDs and extra fields',()=>{
  const body={id:10,v:2,n:crypto.randomBytes(32).toString('base64url')},code=sign(body);
  assert.deepEqual(parseAppInvite(code,secret),body);
  for(const bad of [code+'.extra',code+'=',code.slice(0,-1)+'!',sign({...body,id:1.2}),sign({...body,id:'10'}),sign({...body,n:'a'}),sign({...body,beneficiary:11}),sign({...body,v:3})])assert.ok(!parseAppInvite(bad,secret));
  assert.ok(!parseAppInvite(code,'different-key'));
});
test('phone key joins DDI, punctuation, mobile ninth digit and rejects suffix/invalid DDD tricks',()=>{
  const value='5582993663513';
  for(const alias of ['82993663513','+55 (82) 99366-3513','8293663513','558293663513'])assert.equal(guard.phone(alias),value);
  for(const bad of ['93663513','00082993663513','008293663513','20 99366-3513','82999999999','+1 82 99366-3513',{},null])assert.equal(guard.phone(bad),'');
});
test('CPF check digits and canonical identity keys prevent formatting-based duplicates',()=>{
  assert.equal(guard.cpf('529.982.247-25'),'52998224725');
  for(const bad of ['52998224724','11111111111','12345678900','529982247250',null,{}])assert.equal(guard.cpf(bad),'');
  const a=guard.identity({id:1,telefone:'(82) 99366-3513',telefone2:'82993663513',cpf:'529.982.247-25'});
  assert.equal(a.keys.length,3);
});
test('old shared links cannot create new bindings; no database access for invalid input',async()=>{
  const pool={getConnection(){throw new Error('must not query');}};
  for(const code of [sign({id:10}),null,{},'bad'])await assert.rejects(()=>guard.acceptInvite(pool,pool,{sub:20},code,secret),{code:'REFERRAL_INVITE_INVALID'});
});
test('guard errors contain no phone/CPF, referrer identity, SQL detail or new credit claim',()=>{
  const res={set(){return this;},status(n){this.n=n;return this;},json(v){this.v=v;return this;}};
  guard.errorResponse(new Error('private SQL/password/phone'),res);
  assert.equal(res.n,503);assert.ok(!JSON.stringify(res.v).includes('password'));
});
