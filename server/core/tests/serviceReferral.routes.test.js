"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

function fixture(enabled=1,outcome="automated_only") {
  const handlers=new Map(),calls=[];
  const router={get(route,...callbacks){handlers.set("GET "+route,callbacks.at(-1));},post(route,...callbacks){handlers.set("POST "+route,callbacks.at(-1));}};
  const main={query:async(sql)=>{assert.match(sql,/SELECT enabled,min_os_id FROM lz_service_referral_policy/);return [[{enabled,min_os_id:480}]];}};
  const cashback={query:async(sql,params)=>{assert.match(sql,/FROM indicacoes/);assert.deepEqual(Array.from(params),[303]);return [[{total:4,pendentes:2,concluidas:1,canceladas:1,cashback_aprovado_centavos:1250}]];}};
  const modules={
    express:{Router:()=>router},crypto:require("node:crypto"),"../db":{dbMain:main,dbCashback:cashback},
    "../lib/phoneUtils":{normalizePhone:value=>value},"../middleware/referralAuth":()=>{},
    "../config/jwtConfig":{REFERRAL_SECRET:"synthetic-referral-secret",SERVICE_SECRET:"synthetic-service-secret"},
    "../lib/appInvite":require("../lib/appInvite"),
    "../lib/referralGuard":{rateLimit:async()=>{},issueInvite:async()=>{
      const crypto=require('node:crypto'),p=Buffer.from(JSON.stringify({id:303,v:2,n:crypto.randomBytes(32).toString('base64url')})).toString('base64url');
      return {code:'LZ'+p+'.'+crypto.createHmac('sha256','synthetic-referral-secret').update(p).digest().subarray(0,16).toString('base64url'),person:{id:303,name:'Synthetic'}};
    },errorResponse:require('../lib/referralGuard').errorResponse},
    "../lib/serviceReferral":{confirmLegacy:async(a,b,data)=>{assert.equal(a,main);assert.equal(b,cashback);calls.push(data);return {outcome,row:{id:7}};}},
    "../lib/appReferral":{appReferralSummary:async(pool,id)=>{assert.equal(pool,cashback);assert.equal(id,303);return {creditos_acumulados_centavos:1980,withdrawable:false};},insertTimedAppReferral:async()=>{throw new Error('Not a binding test');}},
  };
  const liveSource=path.join(__dirname,"../routes/referrals.js");
  const source=fs.existsSync(liveSource)?liveSource:path.join(__dirname,"../snapshots/referrals.js");
  vm.runInNewContext(fs.readFileSync(source,"utf8"),{
    require(name){assert.ok(name in modules,"Unexpected dependency "+name);return modules[name];},module:{exports:{}},
    process:{env:{}},Buffer,console:{error(){}},
  });
  return {handlers,calls};
}
const response=()=>({code:200,body:null,set(){return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test("active service program exposes fixed 5% and the full-note rule without recalculating historical approvals",async()=>{
  const f=fixture(),res=response();await f.handlers.get("GET /me/referrals/summary")({user:{sub:303}},res);
  assert.equal(res.code,200);const data=res.body.data;
  assert.equal(data.cashback_aprovado_centavos,1250);assert.equal(data.indicacoes_concluidas,1);
  assert.equal(data.app_referral_credit.creditos_acumulados_centavos,1980);
  assert.equal(data.app_referral_credit.withdrawable,false);
  assert.equal(data.referral_program.tiers.length,1);assert.equal(data.referral_program.current_tier.percent,5);
  assert.equal(data.referral_program.current_tier.threshold,0);
  assert.match(data.referral_program.current_tier.description,/total da nota/);
  assert.match(data.referral_program.current_tier.description,/finalizadas/);
  assert.match(data.referral_program.current_tier.description,/480/);
  assert.equal(data.referral_program.eligible_from_os_id,480);
  assert.equal(data.referral_program.based_on,"os_finalizada_total_nota");
});
test("disabled policy retains legacy display and does not change the historical sum",async()=>{
  const f=fixture(0),res=response();await f.handlers.get("GET /me/referrals/summary")({user:{sub:303}},res);
  assert.equal(res.body.data.cashback_aprovado_centavos,1250);
  assert.equal(res.body.data.referral_program.current_tier.percent,0);
  assert.equal(res.body.data.referral_program.tiers.length,5);
});
test("authenticated APK link generation reaches public download page and preserves the signed referral",async()=>{
  const f=fixture(),native=response(),web=response(),call=f.handlers.get("POST /me/referrals/link");
  await call({user:{sub:303,nome:"Synthetic"},headers:{"x-lz-identity-provider":"core"}},native);
  await call({user:{sub:303,nome:"Synthetic"},headers:{}},web);
  assert.equal(native.code,200);assert.equal(native.body.ok,true);
  assert.equal(new URL(native.body.data.link).pathname,"/convite/");
  assert.equal(new URL(web.body.data.link).pathname,"/login");
  assert.notEqual(native.body.data.codigo_ref,web.body.data.codigo_ref);
  assert.equal(require("../lib/appInvite").validAppInvite(native.body.data.codigo_ref,"synthetic-referral-secret"),true);
  assert.equal(f.calls.length,0);
});
test("confirmation rejects ordinary callers before database access",async()=>{
  const f=fixture(),res=response();await f.handlers.get("POST /referrals/confirm-from-os")({get:()=>"",body:{indicacao_id:7,os_id:101}},res);
  assert.equal(res.code,403);assert.equal(f.calls.length,0);
});
test("protected confirmation reports the automatic-panel-only conflict and cannot accept unsafe IDs",async()=>{
  const f=fixture();const call=f.handlers.get("POST /referrals/confirm-from-os");
  let res=response();await call({get:()=>"synthetic-service-secret",body:{indicacao_id:7,os_id:101,cashback_centavos:9999}},res);
  assert.equal(res.code,409);assert.equal(f.calls.length,1);assert.match(res.body.error,/finalizar a OS no painel/);
  for(const id of [-1,1.5,"9007199254740993"]){res=response();await call({get:()=>"synthetic-service-secret",body:{indicacao_id:id,os_id:101}},res);assert.equal(res.code,400);}
  assert.equal(f.calls.length,1);
});
