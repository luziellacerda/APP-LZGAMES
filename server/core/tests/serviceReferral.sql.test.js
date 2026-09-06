"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { grant, runBatch, confirmLegacy } = require("../lib/serviceReferral");
const {schema}=require('../lib/referralGuardSchema');
const {sha}=require('../lib/referralGuard');

test("MySQL isolated temporary-table fixtures: durable credit, replay, ownership, totals and transactional rollback", {skip:process.env.LZ_REFERRAL_SQL_FIXTURES!=="1"}, async()=>{
  const dotenv=require("dotenv");
  for(const file of ["/etc/lzgames/db.env","/etc/lzgames/db.systemd.env"])Object.assign(process.env,dotenv.parse(fs.readFileSync(file)));
  const oldLog=console.log;console.log=()=>{};
  const db=require("../db");console.log=oldLog;
  const cb=await db.dbCashback.getConnection(),main=await db.dbMain.getConnection();
  try{
    // These TEMPORARY tables shadow any permanent table only on these exact two connections.
    // Abort immediately if ANY creation fails. No application pool is passed to the code under test.
    await cb.query(`CREATE TEMPORARY TABLE indicacoes (
      id INT PRIMARY KEY, indicador_cliente_id INT, indicado_cliente_id INT, status VARCHAR(20), cashback_valor_centavos INT,
      os_concluida_id INT NULL, created_at DATETIME, updated_at DATETIME, fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB`);
    await cb.query(`CREATE TEMPORARY TABLE lz_service_referral_credits (
      id INT AUTO_INCREMENT PRIMARY KEY, os_id INT UNIQUE, indicacao_id INT UNIQUE, beneficiary_id INT, indicated_id INT,
      base_cents BIGINT, amount_cents BIGINT, rule_version VARCHAR(64), source_event_id INT, completed_at DATETIME(6), fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB`);
    await main.query("CREATE TEMPORARY TABLE os (id INT PRIMARY KEY,cliente INT,status VARCHAR(20),subtotal DECIMAL(8,2),val_entrada DECIMAL(8,2), fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB");
    await main.query("CREATE TEMPORARY TABLE clientes (id INT PRIMARY KEY,nome VARCHAR(50),telefone VARCHAR(25),telefone2 VARCHAR(25),cpf VARCHAR(25),fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB");
    await schema(cb,true);
    for(const table of ['lz_referral_bindings','lz_referral_claims','lz_referral_limits','lz_referral_invites']){
      const [def]=await cb.query('SHOW CREATE TABLE '+table);assert.match(Object.values(def[0])[1],/CREATE TEMPORARY TABLE/);
    }
    const binding=async(referral,indicated)=>{
      const hash=sha('558298700'+String(indicated).padStart(4,'0'));
      await cb.query('INSERT INTO lz_referral_bindings(referral_id,indicated_id,indicator_id,phone_hash) VALUES(?,?,303,?)',[referral,indicated,hash]);
      for(const key of ['id:'+indicated,'phone:'+hash])await cb.query('INSERT INTO lz_referral_claims(identity_key,referral_id) VALUES(?,?)',[key,referral]);
    };
    await main.query("CREATE TEMPORARY TABLE lz_service_referral_policy (id INT PRIMARY KEY,enabled INT,min_os_id INT,cutoff_set_at DATETIME(6),fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB");
    await main.query("CREATE TEMPORARY TABLE lz_service_referral_baseline (os_id INT PRIMARY KEY,fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB");
    await main.query(`CREATE TEMPORARY TABLE lz_service_referral_outbox (
      id INT PRIMARY KEY,os_id INT,indicated_id INT,actor_id INT,base_cents INT,occurred_at DATETIME(6),processed_at DATETIME(6) NULL,
      retry_at DATETIME NULL,outcome VARCHAR(64),attempts INT DEFAULT 0,fixture_marker INT NOT NULL DEFAULT 1) ENGINE=InnoDB`);
    for(const [connection,tables] of [[cb,["indicacoes","lz_service_referral_credits"]],[main,["os","clientes","lz_service_referral_policy","lz_service_referral_baseline","lz_service_referral_outbox"]]])
      for(const table of tables)await connection.query("SELECT fixture_marker FROM "+table+" LIMIT 0");
    await cb.query("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,cashback_valor_centavos,created_at) VALUES (7,303,202,'pendente',0,'2026-09-01 10:00:00')");
    await main.query("INSERT INTO os(id,cliente,status,subtotal,val_entrada) VALUES (101,202,'Finalizada',73.45,50.00)");
    await main.query("INSERT INTO clientes(id) VALUES (303),(202)");
    await main.query("UPDATE clientes SET telefone=CONCAT('8298700',LPAD(id,4,'0')),nome='Synthetic'");
    await binding(7,202);
    await main.query("INSERT INTO lz_service_referral_policy(id,enabled,min_os_id,cutoff_set_at) VALUES(1,1,101,'2026-09-05 10:00:00')");
    await main.query("INSERT INTO lz_service_referral_outbox(id,os_id,indicated_id,actor_id,base_cents,occurred_at) VALUES(1,101,202,404,12345,'2026-09-05 20:00:00')");
    const mainProxy={getConnection:async()=>new Proxy(main,{get:(target,key)=>key==="release"?()=>{}:typeof target[key]==="function"?target[key].bind(target):target[key]})};
    const cbProxy={getConnection:async()=>new Proxy(cb,{get:(target,key)=>key==="release"?()=>{}:typeof target[key]==="function"?target[key].bind(target):target[key]})};
    assert.deepEqual(await runBatch(mainProxy,cbProxy),{handled:1,credited:1,deferred:0});
    let [rows]=await cb.query("SELECT * FROM lz_service_referral_credits");assert.equal(rows.length,1);assert.equal(rows[0].amount_cents,617);assert.equal(rows[0].beneficiary_id,303);
    [rows]=await cb.query("SELECT status,cashback_valor_centavos,os_concluida_id FROM indicacoes WHERE id=7");
    assert.deepEqual(rows[0],{status:"concluida",cashback_valor_centavos:617,os_concluida_id:101});
    // Simulate process failure after cashback commit but before acknowledging its source event.
    await main.query("UPDATE lz_service_referral_outbox SET processed_at=NULL WHERE id=1");
    assert.deepEqual(await runBatch(mainProxy,cbProxy),{handled:1,credited:0,deferred:0});
    [rows]=await cb.query("SELECT COUNT(*) AS n FROM lz_service_referral_credits");assert.equal(rows[0].n,1);
    // A different finalized OS cannot consume the same already-completed referral again.
    await main.query("INSERT INTO os(id,cliente,status,subtotal,val_entrada) VALUES(102,202,'Finalizada',100,0)");
    await main.query("INSERT INTO lz_service_referral_outbox(id,os_id,indicated_id,actor_id,base_cents,occurred_at) VALUES(2,102,202,404,10000,'2026-09-06 20:00:00')");
    assert.equal((await runBatch(mainProxy,cbProxy)).credited,0);
    // Older notes are ineligible even if they had been open and finish after activation.
    // Deliberately omit the baseline row: the explicit ID cutoff must also protect the worker.
    await cb.query("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,cashback_valor_centavos,created_at) VALUES(9,303,204,'pendente',0,'2026-09-01')");
    await main.query("INSERT INTO os(id,cliente,status,subtotal,val_entrada) VALUES(100,204,'Finalizada',100,0)");
    await main.query("INSERT INTO clientes(id) VALUES(204)");
    await main.query("INSERT INTO lz_service_referral_outbox(id,os_id,indicated_id,actor_id,base_cents,occurred_at) VALUES(4,100,204,404,10000,'2026-09-06 20:00:00')");
    assert.deepEqual(await runBatch(mainProxy,cbProxy),{handled:1,credited:0,deferred:0});
    [rows]=await cb.query("SELECT status,cashback_valor_centavos FROM indicacoes WHERE id=9");assert.deepEqual(rows[0],{status:"pendente",cashback_valor_centavos:0});
    [rows]=await main.query("SELECT outcome FROM lz_service_referral_outbox WHERE id=4");assert.equal(rows[0].outcome,"historical_note");
    // Force the second write in an award to fail: the ledger insert must disappear on rollback.
    await cb.query("INSERT INTO indicacoes(id,indicador_cliente_id,indicado_cliente_id,status,cashback_valor_centavos,created_at) VALUES(8,303,203,'pendente',0,'2026-09-01')");
    await binding(8,203);
    const failing=new Proxy(cb,{get(target,key){if(key==="query")return(options,values)=>{if(options.sql?.startsWith("UPDATE indicacoes"))throw new Error("fixture transaction failure");return target.query(options,values);};return typeof target[key]==="function"?target[key].bind(target):target[key];}});
    await assert.rejects(()=>grant(failing,{id:3,os_id:103,indicated_id:203,base_cents:10000,occurred_at:"2026-09-05 20:00:00"},{cliente:203,status:"Finalizada",subtotal:"100.00",val_entrada:"0.00"},false,async()=>true));
    [rows]=await cb.query("SELECT COUNT(*) AS n FROM lz_service_referral_credits WHERE os_id=103");assert.equal(rows[0].n,0);
    [rows]=await cb.query("SELECT status FROM indicacoes WHERE id=8");assert.equal(rows[0].status,"pendente");
    // Even a trusted legacy caller cannot supply its own amount once automation is enabled.
    const legacy={referralId:8,osId:103,status:"concluida",amount:999999};
    assert.equal((await confirmLegacy(mainProxy,cbProxy,legacy)).outcome,"automated_only");
    [rows]=await cb.query("SELECT status,cashback_valor_centavos FROM indicacoes WHERE id=8");
    assert.deepEqual(rows[0],{status:"pendente",cashback_valor_centavos:0});
    // Rollback/disable does not make an already audited credit mutable through the old route.
    await main.query("UPDATE lz_service_referral_policy SET enabled=0 WHERE id=1");
    assert.equal((await confirmLegacy(mainProxy,cbProxy,{...legacy,referralId:7,osId:101})).outcome,"managed_credit");
    [rows]=await cb.query("SELECT cashback_valor_centavos FROM indicacoes WHERE id=7");assert.equal(rows[0].cashback_valor_centavos,617);
    assert.equal((await confirmLegacy(mainProxy,cbProxy,{...legacy,referralId:999})).outcome,"not_found");
    // Only the disabled-policy, unmanaged case retains the legacy behavior.
    assert.equal((await confirmLegacy(mainProxy,cbProxy,{...legacy,amount:500})).outcome,"updated");
    [rows]=await cb.query("SELECT status,cashback_valor_centavos FROM indicacoes WHERE id=8");
    assert.deepEqual(rows[0],{status:"concluida",cashback_valor_centavos:500});
  }finally{
    // Closing destroys this session's TEMPORARY fixtures without DROP/DELETE on any real table.
    cb.destroy();main.destroy();
    await Promise.all(Object.values(db).filter(Boolean).map(pool=>pool.end()));
  }
});
