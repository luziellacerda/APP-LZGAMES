"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cents, noteTotal, rewardCents, decide, grant, identifier } = require("../lib/serviceReferral");
const event = { id: 1, os_id: 101, indicated_id: 202, base_cents: 12345, occurred_at: "2026-09-05 20:00:00.000000" };
const note = { cliente: 202, status: "Finalizada", subtotal: "73.45", val_entrada: "50.00", pago: "Não" };
const referral = { id: 7, indicador_cliente_id: 303, indicado_cliente_id: 202, status: "pendente", cashback_valor_centavos: 0, os_concluida_id: null };

test("saved note total restores entry once and includes all saved charges, without recomputing components", () => {
  assert.equal(noteTotal(note),12345);
  assert.equal(noteTotal({...note,valor:"99999.00",mao_obra:"99999.00",vall:"99999.00",total_produtos:"99999.00",desconto:99,frete:"99999.00"}),12345);
  assert.equal(noteTotal({subtotal:"123.45",val_entrada:null}),12345);
  assert.equal(noteTotal({subtotal:"-10.00",val_entrada:"110.00"}),10000);
});
test("all money arithmetic uses integer cents and half-up rounding", () => {
  assert.equal(cents("0.01"),1);assert.equal(cents("25.5"),2550);assert.equal(cents("-1.25"),-125);
  assert.equal(rewardCents(12345),617);assert.equal(rewardCents(19990),1000);
  assert.equal(rewardCents(10),1);assert.equal(rewardCents(9),0);assert.equal(rewardCents(10000),500);
});
test("malformed, fractional-cent, negative or nonpositive totals cannot grant credit", () => {
  for(const value of [null,undefined,"",1.2,Infinity,"NaN","12,34","1e6","1.001"," 1.00 ","99999999999.00"])assert.throws(()=>cents(value));
  for(const data of [{subtotal:"0.00",val_entrada:null},{subtotal:"1.00",val_entrada:"-2.00"},{subtotal:"999999999.00",val_entrada:null}])assert.throws(()=>noteTotal(data));
  for(const value of [-1,0,1.5,Infinity,200000001])assert.throws(()=>rewardCents(value));
});
test("identifiers reject unsafe numbers, body-like objects and noncanonical IDs", () => {
  for(const value of [0,-1,1.2,{},null,"001","1e3","9007199254740993"])assert.throws(()=>identifier(value));
  assert.equal(identifier(202),"202");
});
test("Finalizada grants to the referrer, even when the note is unpaid; Entregue preserves a queued completion", () => {
  assert.deepEqual(decide(event,note,[referral]),{outcome:"credit",referralId:"7",beneficiaryId:"303",amount:617});
  assert.equal(decide(event,{...note,status:"Entregue"},[referral]).outcome,"credit");
});
test("payment alone, historical completion, ownership or amount changes never qualify", () => {
  for(const status of ["Aberta","Iniciada","Sem Reparo","Cancelada","Não Aprovada"])assert.equal(decide(event,{...note,pago:"Sim",status},[referral]).outcome,"note_not_completed");
  assert.equal(decide(event,note,[referral],true).outcome,"historical_note");
  assert.equal(decide(event,{...note,cliente:999},[referral]).outcome,"identity_changed");
  assert.equal(decide(event,{...note,subtotal:"74.45"},[referral]).outcome,"note_amount_changed");
});
test("no referral, ambiguity, self referral and settled referrals never create a new reward", () => {
  assert.equal(decide(event,note,[]).outcome,"no_referral");
  assert.equal(decide(event,note,[referral,{...referral,id:8}]).outcome,"ambiguous_referral");
  assert.equal(decide(event,note,[{...referral,indicador_cliente_id:202}]).outcome,"invalid_referral");
  for(const change of [{status:"concluida"},{status:"cancelada"},{cashback_valor_centavos:100},{os_concluida_id:77}])assert.equal(decide(event,note,[{...referral,...change}]).outcome,"referral_already_settled");
});

function database({rows=[referral],existing=false,failUpdate=false,affectedRows=1,duplicate=false,guardValid=true}={}){
  const state={calls:[],begins:0,commits:0,rollbacks:0};
  return Object.assign(state,{
    async beginTransaction(){state.begins++;},async commit(){state.commits++;},async rollback(){state.rollbacks++;},
    async query(options,values){const sql=options.sql;state.calls.push({sql,values});
      if(sql.startsWith("SELECT id FROM lz_service"))return [existing?[{id:1}]:[]];
      if(sql.includes("FROM indicacoes WHERE"))return [rows];
      if(sql.includes('FROM lz_referral_bindings b'))return [guardValid?[{referral_id:7}]:[]];
      if(sql.startsWith("INSERT")){if(duplicate){const error=new Error("duplicate");error.code="ER_DUP_ENTRY";throw error;}return [{insertId:1}];}
      if(sql.startsWith("UPDATE indicacoes")){if(failUpdate)throw new Error("db unavailable");return [{affectedRows}];}
      throw new Error("Unexpected SQL");
    }
  });
}
test("approval and audit credit commit together with explicit referrer identity and fixed rule", async()=>{
  const db=database();assert.equal(await grant(db,event,note,false,async(a,b)=>a==="303"&&b==="202"),"credited");
  assert.equal(db.begins,1);assert.equal(db.commits,1);assert.equal(db.rollbacks,0);
  const insert=db.calls.find(c=>c.sql.startsWith("INSERT"));
  assert.deepEqual(insert.values,[101,"7","303",202,12345,617,"service5_note_total_v1",1,event.occurred_at]);
  const lookup=db.calls.find(c=>c.sql.includes("FROM indicacoes WHERE"));assert.deepEqual(lookup.values,[202,event.occurred_at]);
});
test("source event replay does not credit or overwrite a previously approved note", async()=>{
  const db=database({existing:true});assert.equal(await grant(db,event,note,false,async()=>true),"already_credited");
  assert.equal(db.calls.length,1);assert.equal(db.commits,1);
});
test("missing current customer records fail closed before ledger or balance writes", async()=>{
  for(const resolver of [undefined,async()=>false]){const db=database();assert.equal(await grant(db,event,note,false,resolver),"customer_removed");assert.equal(db.calls.some(c=>/^(INSERT|UPDATE)/.test(c.sql)),false);}
});
test('unaudited/manual/reassigned referral cannot bypass permanent identity guards',async()=>{
  const db=database({guardValid:false});assert.equal(await grant(db,event,note,false,async()=>true),'referral_guard_rejected');
  assert.equal(db.calls.some(c=>/^(INSERT|UPDATE)/.test(c.sql)),false);
});
test("an approval failure rolls the ledger back instead of recording half a reward", async()=>{
  for(const options of [{failUpdate:true},{affectedRows:0}]){const db=database(options);await assert.rejects(()=>grant(db,event,note,false,async()=>true));assert.equal(db.rollbacks,1);assert.equal(db.commits,0);}
});
test("a uniqueness race cannot assign the referral to another note", async()=>{
  const db=database({duplicate:true});assert.equal(await grant(db,event,note,false,async()=>true),"referral_already_settled");
  assert.equal(db.rollbacks,1);assert.equal(db.calls.some(c=>c.sql.startsWith("UPDATE")),false);
});
