"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const {validAppInvite, referralShareLink, publicAppInviteInfo} = require("../lib/appInvite");
const secret = "offline-synthetic-referral-key-only";
const signPayload = value => {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest().subarray(0,16).toString("base64url");
  return `LZ${payload}.${signature}`;
};
const code = signPayload({id:303});
const response = () => ({statusCode:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(v){this.statusCode=v;return this;},json(body){this.body=body;return this;}});

test("public check authenticates the existing signed format without database access", () => {
  assert.equal(validAppInvite(code,secret),true);
  assert.equal(validAppInvite(` ${code} `,secret),true);
  assert.equal(validAppInvite(code,"different-synthetic-key"),false);
  assert.equal(validAppInvite(code,""),false);
});
test("bounded canonical codes reject extra components, forgery and unsafe identities", () => {
  for (const value of [null,{},[code],"",code+".extra","x".repeat(1025),"<script>alert(1)</script>",code.slice(0,-2)+"__",...[
    {id:0},{id:-1},{id:1.5},{id:"303"},{id:Number.MAX_SAFE_INTEGER+1},{id:303,extra:true},[],null,
  ].map(signPayload)]) assert.equal(validAppInvite(value,secret),false);
});
test("APK 23 CORE/BOX requests receive the public invitation; web portal links remain unchanged", () => {
  for (const provider of ["core","box","CORE"]) {
    const link=referralShareLink({headers:{"x-lz-identity-provider":provider}},code,"https://app.lzgames.com.br/login");
    const url=new URL(link);assert.equal(url.pathname,"/convite/");assert.equal(url.searchParams.get("ref"),code);
    assert.equal(url.origin,"https://app.lzgames.com.br");
  }
  assert.equal(new URL(referralShareLink({},code,"https://app.lzgames.com.br/login")).pathname,"/login");
});
test("public information is read-only, uncached and never exposes an identity or claims a binding", () => {
  const handler=publicAppInviteInfo(secret);
  for(const query of [{},{ref:code}]) {
    const res=response();handler({query,body:{beneficiary:999}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.equal(res.body.data.has_invite,!!query.ref);
    assert.equal(res.headers["Cache-Control"],"no-store");assert.equal(res.headers["Referrer-Policy"],"no-referrer");
    const release=res.body.data.release;assert.equal(release.version_code,26);assert.equal(release.name,"LZ-GAMES");
    assert.equal(release.apk_url,"https://app.lzgames.com.br/convite/lz-games-26.apk");assert.match(release.sha256,/^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(res.body.data).sort(),["has_invite","release"]);
    assert.ok(!JSON.stringify(res.body).includes(code));assert.ok(!JSON.stringify(res.body).includes("303"));
  }
});
test("invalid and duplicate query values return generic errors with no echoed input", () => {
  for(const ref of ["",[code,code],{code},"private-fixture-text",code+".extra"]) {
    const res=response();publicAppInviteInfo(secret)({query:{ref}},res);
    assert.equal(res.statusCode,400);assert.equal(res.body.ok,false);assert.equal(res.body.data,undefined);
    assert.ok(!JSON.stringify(res.body).includes("private-fixture-text"));
  }
});
test("real Express GET works without cookies; forged query values and write methods cannot bind", async () => {
  const express=require("express"),app=express();app.get("/api/app/invite-info",publicAppInviteInfo(secret));
  const server=http.createServer(app);await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}/api/app/invite-info`;
    const result=await fetch(base+"?ref="+encodeURIComponent(code));assert.equal(result.status,200);
    assert.equal(result.headers.get("set-cookie"),null);assert.equal((await result.json()).data.has_invite,true);
    assert.equal((await fetch(base+"?ref="+code+"&ref="+code)).status,400);
    assert.equal((await fetch(base,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ref:code})})).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('public v2 checks durable unused issuance without consuming or exposing recipient information', async()=>{
  const v2=signPayload({id:303,v:2,n:Buffer.alloc(32,7).toString('base64url')});let calls=0;
  const database={query:async(options,values)=>{
    calls++;assert.equal(options.sql,'SELECT referral_id FROM lz_referral_invites WHERE token_hash=?');
    assert.equal(options.timeout,3000);assert.deepEqual(values,[crypto.createHash('sha256').update(v2).digest('hex')]);
    return [[{referral_id:null}]];
  }};
  for(let i=0;i<2;i++){
    const res=response();await publicAppInviteInfo(secret,database)({query:{ref:v2}},res);
    assert.equal(res.statusCode,200);assert.equal(res.body.data.has_invite,true);
    assert.deepEqual(Object.keys(res.body.data).sort(),['has_invite','release']);
    assert.equal(res.headers['Cache-Control'],'no-store');
  }
  assert.equal(calls,2);
});
test('public v2 rejects unissued, used and legacy invites and keeps upstream errors private',async()=>{
  const v2=signPayload({id:303,v:2,n:Buffer.alloc(32,8).toString('base64url')});
  for(const rows of [[],[{referral_id:123}]]){
    const res=response();await publicAppInviteInfo(secret,{query:async()=>[rows]})({query:{ref:v2}},res);
    assert.equal(res.statusCode,409);assert.equal(res.body.ok,false);assert.equal(res.body.data,undefined);
    assert.ok(!JSON.stringify(res.body).includes('123'));
  }
  const legacy=response();await publicAppInviteInfo(secret,{query:async()=>{throw Error('Must not query legacy');}})({query:{ref:code}},legacy);
  assert.equal(legacy.statusCode,400);assert.match(legacy.body.error,/antigo/);
  const error=response();await publicAppInviteInfo(secret,{query:async()=>{throw Error('SYNTHETIC_PRIVATE');}})({query:{ref:v2}},error);
  assert.equal(error.statusCode,503);assert.ok(!JSON.stringify(error.body).includes('SYNTHETIC_PRIVATE'));
  const generic=response();await publicAppInviteInfo(secret,{query:async()=>{throw Error('Generic download needs no referral query');}})({query:{}},generic);
  assert.equal(generic.statusCode,200);assert.equal(generic.body.data.has_invite,false);
});
