"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const g=require('../lib/referralGuard'),{schema}=require('../lib/referralGuardSchema');
test('isolated MariaDB: single-use, global identity claims, cancellation, deletion, rollback and simultaneous requests',
 {skip:process.env.LZ_GUARD_SQL_FIXTURES!=='1',timeout:90000},async()=>{
  const dotenv=require('dotenv');for(const f of ['/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'])Object.assign(process.env,dotenv.parse(fs.readFileSync(f)));
  const log=console.log;console.log=()=>{};const db=require('../db');console.log=log;
  // Fresh named fixture tables allow REAL independent concurrent connections. Every SQL table reference is rewritten;
  // no production customer, invitation, phone reservation or financial table is reachable through this proxy.
  const prefix='lzrg_fixture_'+crypto.randomBytes(6).toString('hex')+'_';
  const tables=['clientes','indicacoes','lz_app_referral_attributions','lz_referral_invites','lz_referral_bindings','lz_referral_claims','lz_referral_limits'];
  const names=Object.fromEntries(tables.map(t=>[t,prefix+t]));
  const pattern=new RegExp('\\b('+tables.join('|')+')\\b','g');
  function rewrite(options){let sql=typeof options==='string'?options:options.sql;
    assert.ok(tables.some(t=>new RegExp('\\b'+t+'\\b').test(sql))||/^SELECT (GET_LOCK|RELEASE_LOCK)\(/.test(sql),'Fixture SQL allowlist');
    sql=sql.replace(pattern,t=>names[t]).replaceAll('lz_referral_guard_v2',prefix+'mutex');
    return typeof options==='string'?sql:{...options,sql};}
  function wrap(c){return new Proxy(c,{get(t,k){if(k==='query')return (sql,args)=>t.query(rewrite(sql),args);return typeof t[k]==='function'?t[k].bind(t):t[k];}});}
  const pool={getConnection:async()=>wrap(await db.dbCashback.getConnection()),query:async(sql,args)=>db.dbCashback.query(rewrite(sql),args)};
  const secret='synthetic-guard-key-not-production';
  const sessions=new Map();
  const add=async(i,number=`8298700${String(i).padStart(4,'0')}`)=>{
    await pool.query('INSERT INTO clientes(id,nome,telefone,cpf) VALUES(?,?,?,NULL)',[i,'Synthetic fixture',number]);
    const s={sub:i,telefone:number};sessions.set(i,s);return s;};
  const issue=async i=>(await g.issueInvite(pool,pool,sessions.get(i),secret)).code;
  const accept=(i,code)=>g.acceptInvite(pool,pool,sessions.get(i),code,secret);
  let c;
  try{
    c=await pool.getConnection();await schema(c);
    await pool.query('CREATE TABLE clientes(id INT PRIMARY KEY,nome VARCHAR(50),telefone VARCHAR(25),telefone2 VARCHAR(25),cpf VARCHAR(25)) ENGINE=InnoDB');
    await pool.query(`CREATE TABLE indicacoes(id INT AUTO_INCREMENT PRIMARY KEY,indicador_cliente_id INT,indicado_cliente_id INT,
      nome_indicado VARCHAR(255),tel_indicado VARCHAR(32),cpf_indicado VARCHAR(32),codigo_ref VARCHAR(64) UNIQUE,
      origem_canal VARCHAR(20),status VARCHAR(20),cashback_valor_centavos INT,created_at DATETIME,updated_at DATETIME) ENGINE=InnoDB`);
    await pool.query('CREATE TABLE lz_app_referral_attributions(referral_id INT PRIMARY KEY,bound_at_utc DATETIME(6)) ENGINE=InnoDB');
    for(const i of [101,102,501,502,600,601,602,603,604])await add(i);
    const first=await issue(101), other=await issue(102);
    assert.notEqual(first,await issue(101));
    const bound=await accept(501,first);assert.equal(bound.already_registered,false);
    assert.equal((await accept(501,first)).already_registered,true);
    await assert.rejects(()=>accept(501,other),{code:'REFERRAL_ALREADY_INVITED'});
    await assert.rejects(()=>accept(502,first),{code:'REFERRAL_INVITE_USED'});
    await assert.rejects(()=>accept(101,first),{code:'SELF_REFERRAL_NOT_ALLOWED'});
    // Preserve all old phone keys while changing an existing account's contact.
    await pool.query('UPDATE clientes SET telefone=? WHERE id=501',['82987500501']);sessions.set(501,{sub:501,telefone:'82987500501'});
    await add(503,'+55 (82) 98700-0501');
    await assert.rejects(()=>accept(503,other),{code:'REFERRAL_ALREADY_INVITED'});
    await assert.rejects(()=>accept(501,other),{code:'REFERRAL_ALREADY_INVITED'});
    await pool.query("UPDATE indicacoes SET status='cancelada' WHERE id=?",[bound.data.id]);
    await assert.rejects(()=>accept(501,other),{code:'REFERRAL_ALREADY_INVITED'});
    await pool.query('DELETE FROM indicacoes WHERE id=?',[bound.data.id]);
    await assert.rejects(()=>accept(501,other),{code:'REFERRAL_ALREADY_INVITED'});
    // A new account/phone cannot reclaim the original CPF even after a profile change.
    await add(700);await pool.query('UPDATE clientes SET cpf=? WHERE id=700',['111.444.777-35']);
    await accept(700,await issue(101));
    await pool.query('UPDATE clientes SET cpf=? WHERE id=700',['52998224725']);
    await add(701);await pool.query('UPDATE clientes SET cpf=? WHERE id=701',['11144477735']);
    await assert.rejects(()=>accept(701,other),{code:'REFERRAL_ALREADY_INVITED'});
    // Current duplicate profiles and stale identity claims never silently choose an owner.
    await add(702);await add(703,'+55 (82) 98700-0702');
    await assert.rejects(()=>issue(702),{code:'REFERRAL_IDENTITY_AMBIGUOUS'});
    await assert.rejects(()=>g.issueInvite(pool,pool,{sub:604,telefone:'82987000701'},secret),{code:'REFERRAL_SESSION_CHANGED'});
    // A fresh unknown signed nonce must still have a durable issuance record.
    const unused=await issue(101);await pool.query('DELETE FROM lz_referral_invites WHERE token_hash=?',[g.sha(unused)]);
    await assert.rejects(()=>accept(502,unused),{code:'REFERRAL_INVITE_INVALID'});
    // Two referrers race for ONE recipient: exactly one durable winner across separate SQL sessions.
    const a=await issue(101),b=await issue(102);
    const race=await Promise.allSettled([accept(600,a),accept(600,b)]);
    assert.equal(race.filter(v=>v.status==='fulfilled').length,1);
    assert.equal(race.filter(v=>v.status==='rejected'&&v.reason.code==='REFERRAL_ALREADY_INVITED').length,1);
    const [count]=await pool.query('SELECT COUNT(*) AS n FROM indicacoes WHERE indicado_cliente_id=600');assert.equal(count[0].n,1);
    // Two people race for ONE invitation: only one can consume it.
    const single=await issue(101),race2=await Promise.allSettled([accept(601,single),accept(602,single)]);
    assert.equal(race2.filter(v=>v.status==='fulfilled').length,1);
    assert.equal(race2.filter(v=>v.status==='rejected'&&v.reason.code==='REFERRAL_INVITE_USED').length,1);
    // Transaction fails after referral INSERT; no half binding, no consumed nonce, no claims.
    const rollbackCode=await issue(101);
    const failing={...pool,getConnection:async()=>{const target=await pool.getConnection();return new Proxy(target,{get(t,k){if(k==='query')return (s,args)=>{if((s.sql||s).startsWith('INSERT INTO lz_referral_claims'))throw new Error('Synthetic write failure');return t.query(s,args);};return typeof t[k]==='function'?t[k].bind(t):t[k];}});}};
    await assert.rejects(()=>g.acceptInvite(pool,failing,sessions.get(603),rollbackCode,secret),/Synthetic/);
    const [absent]=await pool.query('SELECT COUNT(*) n FROM indicacoes WHERE indicado_cliente_id=603');assert.equal(absent[0].n,0);
    const retry=await accept(603,rollbackCode);assert.equal(retry.already_registered,false);
    // Circular referrals cannot turn account pairs into a credit loop.
    const inverse=await issue(603);await assert.rejects(()=>accept(101,inverse),{code:'REFERRAL_CYCLE'});
    // Every schema constraint works even without the application mutex.
    await assert.rejects(()=>pool.query('INSERT INTO lz_referral_claims(identity_key,referral_id) VALUES(?,?)',['id:603',9999]),{code:'ER_DUP_ENTRY'});
    for(let i=0;i<20;i++)await g.rateLimit(pool,'accept',604,'synthetic-ip');
    await assert.rejects(()=>g.rateLimit(pool,'accept',604,'synthetic-ip'),{code:'REFERRAL_RATE_LIMIT'});
    const [money]=await pool.query('SELECT SUM(cashback_valor_centavos) AS cents FROM indicacoes');assert.equal(Number(money[0].cents),0);
  }finally{
    c?.release();
    // Remove ONLY the fresh synthetic tables from this run (explicit validated allowlist). Never a live table.
    for(const name of Object.values(names).reverse()) {assert.match(name,/^lzrg_fixture_[a-f0-9]{12}_[a-z_]+$/);await db.dbCashback.query('DROP TABLE IF EXISTS `'+name+'`');}
    await Promise.all(Object.values(db).filter(Boolean).map(p=>p.end()));
  }
});
