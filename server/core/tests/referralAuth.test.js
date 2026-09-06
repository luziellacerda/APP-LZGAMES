"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {createReferralAuth, fullBrazilPhone, phoneVariants, BOX_ME_URL} = require("../middleware/referralAuth");

const token = "SYNTHETIC_OFFLINE_TOKEN_0123456789";
const phone = "5582998887777";
const row = {id:41, nome:"Cliente de teste", telefone:"(82) 99888-7777", telefone2:""};
const response = (body = {ok:true,data:{user:{id:7,phone}}}, status = 200, headers = {}) => new Response(JSON.stringify(body), {status,headers:{"content-type":"application/json",...headers}});

async function run(overrides = {}) {
  const calls = {core:0,fetch:[],queries:[],next:0};
  const req = {headers:{authorization:"Bearer " + token,"x-lz-identity-provider":"box"},body:{},query:{},...overrides.req};
  const res = {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  const middleware = createReferralAuth({
    coreAuth: overrides.coreAuth || ((request,reply,next) => {calls.core++;request.user={sub:99};return next();}),
    getMainDb: overrides.getMainDb || (() => ({query:async (options,parameters) => {calls.queries.push({sql:options.sql,parameters,timeout:options.timeout});if(overrides.dbError)throw new Error("SYNTHETIC_PRIVATE_DETAIL database failure");if(overrides.query)return overrides.query();return [overrides.rows ?? [row]];}})),
    fetchImpl: async (url, options) => {calls.fetch.push({url,options});return overrides.fetch ? overrides.fetch(url,options) : response();},
    timeoutMs: overrides.timeoutMs ?? 250,
    dbTimeoutMs: overrides.dbTimeoutMs ?? 250,
  });
  await middleware(req,res,() => {calls.next++;});
  return {req,res,calls};
}

function safeFailure(result, status, code) {
  assert.equal(result.calls.next,0);
  assert.equal(result.res.statusCode,status);
  if (code) assert.equal(result.res.body.code,code);
  const body = JSON.stringify(result.res.body);
  for (const forbidden of [token,phone,"SYNTHETIC_PRIVATE_DETAIL","Cliente de teste"]) assert.ok(!body.includes(forbidden));
}

test("full BR phone matching supports DDI/mobile ninth digit without suffixes or landline conflation", () => {
  for (const value of ["(82) 99888-7777","+55 (82) 99888-7777","8298887777"]) assert.equal(fullBrazilPhone(value),phone);
  assert.deepEqual(phoneVariants(phone),[phone,"82998887777","558298887777","8298887777"]);
  assert.equal(fullBrazilPhone("8233334444"),"558233334444");
  assert.deepEqual(phoneVariants("558233334444"),["558233334444","8233334444"]);
  for (const value of [null,12,"","998887777","5582998887777123","00000000000","+1 82998887777","82998887777 ext 2"]) assert.equal(fullBrazilPhone(value),"");
});

test("absent/core provider delegates exclusively to existing CORE authentication", async () => {
  for (const provider of [undefined,"core","CORE"]) {
    const headers={authorization:"Bearer synthetic-core-token"};
    if(provider)headers["x-lz-identity-provider"]=provider;
    const result = await run({req:{headers}});
    assert.equal(result.calls.core,1);
    assert.equal(result.calls.fetch.length,0);
    assert.equal(result.calls.queries.length,0);
    assert.equal(result.calls.next,1);
    assert.equal(result.req.user.sub,99);
  }
  const failed = await run({req:{headers:{}},coreAuth:(_req,res)=>res.status(401).json({ok:false,code:"SESSION_EXPIRED"})});
  assert.equal(failed.res.statusCode,401);
  assert.equal(failed.res.body.code,"SESSION_EXPIRED");
  assert.equal(failed.calls.fetch.length,0);
});

test("BOX uses fixed no-redirect endpoint then resolves current unique CORE identity", async () => {
  const result = await run({req:{body:{id:999,phone:"82991112222",sub:999},query:{provider:"core",id:999},user:{sub:999}}});
  assert.equal(result.calls.core,0);
  assert.equal(result.calls.next,1);
  assert.equal(result.calls.fetch.length,1);
  const {url,options}=result.calls.fetch[0];
  assert.equal(url,BOX_ME_URL);
  assert.equal(options.method,"GET");
  assert.equal(options.redirect,"manual");
  assert.equal(options.headers.Authorization,"Bearer " + token);
  assert.equal(options.headers["X-LZ-Identity-Provider"],undefined);
  assert.deepEqual(result.req.user,{sub:"41",nome:"Cliente de teste",telefone:phone,telefone_normalizado:"82998887777"});
  assert.equal(result.calls.queries.length,1);
  assert.equal(result.calls.queries[0].timeout,250);
  assert.match(result.calls.queries[0].sql,/^SELECT /);
  assert.ok(!/\b(?:LIKE|RIGHT|INSERT|UPDATE|DELETE|CALL)\b/i.test(result.calls.queries[0].sql));
  assert.match(result.calls.queries[0].sql,/LIMIT 3/);
  assert.deepEqual(result.calls.queries[0].parameters,[...phoneVariants(phone),...phoneVariants(phone)]);
});

test("current source phone is used instead of request body or an earlier contact", async () => {
  const current="5582991112222";
  const result=await run({fetch:()=>response({ok:true,data:{user:{id:7,phone:current}}}),rows:[{...row,telefone:current}],req:{headers:{authorization:"Bearer "+token,"x-lz-identity-provider":"box"},body:{phone}}});
  assert.equal(result.req.user.telefone,current);
  assert.ok(result.calls.queries[0].parameters.includes(current));
  assert.ok(!result.calls.queries[0].parameters.includes(phone));
});

test("unlinked, ambiguous and mismatched contacts fail closed without creating accounts", async () => {
  safeFailure(await run({rows:[]}),422,"REFERRAL_ACCOUNT_NOT_LINKED");
  safeFailure(await run({rows:[row,{...row,id:42}]}),409,"REFERRAL_ACCOUNT_AMBIGUOUS");
  safeFailure(await run({rows:[{...row,telefone:"82991112222"}]}),422,"REFERRAL_ACCOUNT_NOT_LINKED");
  safeFailure(await run({rows:[{...row,id:0}]}),422,"REFERRAL_ACCOUNT_NOT_LINKED");
  safeFailure(await run({rows:[{...row,id:"9007199254740993"}]}),422,"REFERRAL_ACCOUNT_NOT_LINKED");
  const secondary=await run({rows:[{...row,telefone:"82991112222",telefone2:phone}]});
  assert.equal(secondary.calls.next,1);
  assert.equal(secondary.req.user.telefone,phone);
});

test("BOX provider and authorization headers are bounded, singular and header-only", async () => {
  for(const headers of [
    {authorization:"Bearer "+token,"x-lz-identity-provider":"https://untrusted.invalid"},
    {authorization:"Bearer "+token,"x-lz-identity-provider":"other"},
    {authorization:["Bearer "+token],"x-lz-identity-provider":"box"},
    {authorization:"x".repeat(8193),"x-lz-identity-provider":"box"},
    {authorization:"Bearer "+token,"x-lz-identity-provider":["box"]},
    {authorization:"Bearer "+token+"\ninvalid","x-lz-identity-provider":"box"},
  ]) {
    const result=await run({req:{headers}});
    safeFailure(result,400);
    assert.equal(result.calls.fetch.length,0);
    assert.equal(result.calls.queries.length,0);
  }
  const duplicate=await run({req:{headers:{authorization:"Bearer "+token,"x-lz-identity-provider":"box"},rawHeaders:["Authorization","Bearer "+token,"Authorization","Bearer another"]}});
  safeFailure(duplicate,400);
  for (const authorization of [undefined,"",token,"Bearer short","Bearer "+token+" trailing"]) {
    const result=await run({req:{headers:{authorization,"x-lz-identity-provider":"box"},body:{token},query:{token}}});
    safeFailure(result,401,"BOX_SESSION_EXPIRED");
    assert.equal(result.calls.fetch.length,0);
  }
});

test("upstream 401/403 means expired session but 429/5xx/network errors are transient", async () => {
  for(const upstream of [401,403,429,500,502,503]) {
    const result=await run({fetch:()=>response({error:"SYNTHETIC_PRIVATE_DETAIL"},upstream)});
    safeFailure(result,[401,403].includes(upstream)?401:503);
    assert.equal(result.calls.queries.length,0);
    assert.equal(result.calls.core,0); // Never try a different identity after a failed BOX request.
  }
  safeFailure(await run({fetch:()=>{throw Error("SYNTHETIC_PRIVATE_DETAIL "+token);}}),503);
  const interrupted=()=>new Response(new ReadableStream({start(controller){controller.error(new Error("SYNTHETIC_PRIVATE_DETAIL "+token));}}),{status:200,headers:{"content-type":"application/json"}});
  safeFailure(await run({fetch:interrupted}),503,"REFERRAL_IDENTITY_UNAVAILABLE");
  safeFailure(await run({dbError:true}),503);
  safeFailure(await run({getMainDb:()=>null}),503);
});

test("redirects, invalid JSON/envelopes/content type, missing identity and oversized responses are rejected", async () => {
  const factories = [
    ()=>new Response("redirect",{status:302,headers:{Location:"https://untrusted.invalid/?secret=SYNTHETIC_PRIVATE_DETAIL"}}),
    ()=>new Response("SYNTHETIC_PRIVATE_DETAIL",{status:200,headers:{"content-type":"text/html"}}),
    ()=>new Response("invalid",{status:200,headers:{"content-type":"application/json"}}),
    ()=>response(null),
    ()=>response({ok:true,orders:[]}),
    ()=>response({ok:false,data:{user:{id:7,phone}}}),
    ()=>response({ok:true,data:{user:{id:Number.MAX_SAFE_INTEGER+1,phone}}}),
    ()=>response({ok:true,data:{user:{id:"9007199254740993",phone}}}),
    ()=>response(undefined,200,{"content-length":"99999999"}),
    ()=>response({ok:true,data:{user:{id:7,phone}},oversize:"x".repeat(33000)}),
  ];
  for(const fetch of factories) {
    const result=await run({fetch});
    safeFailure(result,502,"REFERRAL_IDENTITY_INVALID_RESPONSE");
    assert.equal(result.calls.queries.length,0);
  }
  safeFailure(await run({fetch:()=>response({ok:true,data:{user:{id:7,phone:""}}})}),422,"REFERRAL_ACCOUNT_NOT_LINKED");
});

test("hung provider requests are bounded without converting timeouts to logout", async () => {
  const started=Date.now();
  const result=await run({timeoutMs:10,fetch:()=>new Promise(()=>{})});
  safeFailure(result,503,"REFERRAL_IDENTITY_UNAVAILABLE");
  assert.ok(Date.now()-started<1000);
  assert.equal(result.calls.queries.length,0);
});

test("database/pool deadlines are local, transient and cannot advance a request after expiry", async () => {
  const stalled=await run({dbTimeoutMs:10,query:()=>new Promise(()=>{})});
  safeFailure(stalled,503,"REFERRAL_IDENTITY_UNAVAILABLE");
  safeFailure(await run({dbTimeoutMs:10,getMainDb:()=>new Promise(()=>{})}),503,"REFERRAL_IDENTITY_UNAVAILABLE");
  for (const outcome of ["resolve","reject"]) {
    let complete;
    const result=await run({dbTimeoutMs:10,query:()=>new Promise((resolve,reject)=>{complete=outcome==="resolve"?resolve:reject;})});
    safeFailure(result,503,"REFERRAL_IDENTITY_UNAVAILABLE");
    const failureBody=result.res.body;
    complete(outcome==="resolve"?[[row]]:new Error("SYNTHETIC_PRIVATE_DETAIL late query failure"));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(result.calls.next,0);
    assert.equal(result.req.user,undefined);
    assert.equal(result.res.body,failureBody);
  }
});

test("only referral consumer routes receive the bridge and CORS permits its explicit header", (context) => {
  const root=path.join(__dirname,"..");
  if (!fs.existsSync(path.join(root,"routes/referrals.js")) && fs.existsSync(path.join(root,"integration.patch"))) {
    context.skip("Audit archive: run this integration check in CORE after applying integration.patch.");
    return;
  }
  const routes=fs.readFileSync(path.join(root,"routes/referrals.js"),"utf8");
  assert.match(routes,/const auth = require\("\.\.\/middleware\/referralAuth"\)/);
  for(const route of ["/me/referrals/summary","/me/referrals/list","/me/referrals/link","/me/referrals/generate-link","/referrals/accept"]) assert.ok(routes.includes(`"${route}", auth,`));
  assert.ok(routes.includes('router.post("/referrals/confirm-from-os", async'));
  assert.match(fs.readFileSync(path.join(root,"app.js"),"utf8"),/allowedHeaders: \["Content-Type", "Authorization", "X-LZ-Identity-Provider"\]/);
  assert.match(fs.readFileSync(path.join(root,"routes/referralsAdmin.js"),"utf8"),/res\.status\(403\)/);
});
