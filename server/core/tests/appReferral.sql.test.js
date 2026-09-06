"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {appReferralSummary,insertTimedAppReferral}=require('../lib/appReferral');
test('MySQL temporary fixtures: actual timed binding, private summary and rollback', {skip:process.env.LZ_APP_REFERRAL_SQL_FIXTURES!=='1'},async()=>{
  const dotenv=require('dotenv');
  for(const f of ['/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'])Object.assign(process.env,dotenv.parse(fs.readFileSync(f)));
  const log=console.log;console.log=()=>{};const db=require('../db');console.log=log;
  const c=await db.dbCashback.getConnection();
  try{
    // Stop on the first failed TEMPORARY creation; never pass the live pool into functions under test.
    await c.query(`CREATE TEMPORARY TABLE indicacoes(id INT AUTO_INCREMENT PRIMARY KEY,indicador_cliente_id INT,indicado_cliente_id INT,
      nome_indicado VARCHAR(100),tel_indicado VARCHAR(30),cpf_indicado VARCHAR(30),codigo_ref VARCHAR(200) UNIQUE,
      origem_canal VARCHAR(20),status VARCHAR(20),cashback_valor_centavos INT,created_at DATETIME,updated_at DATETIME,fixture_marker INT DEFAULT 1) ENGINE=InnoDB`);
    await c.query('CREATE TEMPORARY TABLE lz_app_referral_attributions(referral_id INT PRIMARY KEY,bound_at_utc DATETIME(6),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    await c.query('CREATE TEMPORARY TABLE lz_app_referral_credits(beneficiary_id INT,amount_cents INT,usage_restriction VARCHAR(24),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    await c.query('CREATE TEMPORARY TABLE lz_app_referral_redemptions(beneficiary_id INT,amount_cents INT,state VARCHAR(12),fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    await c.query('CREATE TEMPORARY TABLE lz_app_referral_redemption_policy(id INT PRIMARY KEY,enabled INT,fixture_marker INT DEFAULT 1) ENGINE=InnoDB');
    for(const table of ['indicacoes','lz_app_referral_attributions','lz_app_referral_credits','lz_app_referral_redemptions','lz_app_referral_redemption_policy'])await c.query('SELECT fixture_marker FROM '+table+' LIMIT 0');
    await c.query('INSERT INTO lz_app_referral_redemption_policy(id,enabled) VALUES(1,1)');
    const connection=new Proxy(c,{get:(t,k)=>k==='release'?()=>{}:typeof t[k]==='function'?t[k].bind(t):t[k]});
    const pool={getConnection:async()=>connection};
    const result=await insertTimedAppReferral(pool,[303,202,'Synthetic',null,null,'LZR-fixture','link']);
    const [rows]=await c.query('SELECT TIMESTAMPDIFF(SECOND,bound_at_utc,UTC_TIMESTAMP(6)) AS age FROM lz_app_referral_attributions WHERE referral_id=?',[result.insertId]);
    assert.equal(rows.length,1);assert.ok(rows[0].age>=0&&rows[0].age<60);
    await c.query("INSERT INTO lz_app_referral_credits(beneficiary_id,amount_cents,usage_restriction) VALUES(303,990,'services_only'),(303,990,'services_only'),(404,990,'services_only')");
    assert.equal((await appReferralSummary(c,303)).creditos_acumulados_centavos,1980);
    await c.query("INSERT INTO lz_app_referral_redemptions(beneficiary_id,amount_cents,state) VALUES(303,500,'active'),(303,990,'reversed'),(404,990,'active')");
    const balance=await appReferralSummary(c,303);
    assert.equal(balance.creditos_utilizados_centavos,500);assert.equal(balance.saldo_disponivel_centavos,1480);
    const failing=new Proxy(connection,{get:(t,k)=>k==='query'?async(sql,args)=>{if(sql.includes('UTC_TIMESTAMP(6)'))throw new Error('synthetic clock evidence failure');return t.query(sql,args);}:t[k]});
    await assert.rejects(()=>insertTimedAppReferral({getConnection:async()=>failing},[303,203,'Synthetic',null,null,'LZR-fixture-rollback','link']));
    const [after]=await c.query('SELECT COUNT(*) AS n FROM indicacoes');assert.equal(after[0].n,1);
  }finally{c.destroy();await Promise.all(Object.values(db).filter(Boolean).map(p=>p.end()));}
});
