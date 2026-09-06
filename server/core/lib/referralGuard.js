"use strict";

const crypto = require('node:crypto');
const {fullBrazilPhone,phoneVariants} = require('../middleware/referralAuth');
const {parseAppInvite} = require('./appInvite');
const DDD = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const query = (db,sql,values=[]) => db.query({sql,timeout:5000},values);
class GuardError extends Error {
  constructor(code,message,status=409) { super(message); this.code=code; this.status=status; }
}
const blocked = () => new GuardError('REFERRAL_ALREADY_INVITED','Este cliente ou telefone já possui uma indicação. Não é permitido indicar a mesma pessoa novamente, mesmo após cancelamento.');
function id(value) {
  if (!['string','number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new GuardError('REFERRAL_IDENTITY_INVALID','Não foi possível confirmar o cadastro.',422);
  return String(value);
}
function phone(value) {
  const result=fullBrazilPhone(value);
  return result && DDD.has(result.slice(2,4)) && !/^(\d)\1+$/.test(result.slice(5)) ? result : '';
}
function cpf(value) {
  if (typeof value!=='string' || value.length>20 || /[^0-9.\s-]/.test(value)) return '';
  const n=value.replace(/\D/g,'');
  if (!/^\d{11}$/.test(n) || /^(\d)\1{10}$/.test(n)) return '';
  for (let size=9;size<=10;size++) {
    let sum=0; for(let j=0;j<size;j++) sum+=Number(n[j])*(size+1-j);
    const digit=(sum*10)%11; if (Number(n[size])!==(digit===10?0:digit)) return '';
  }
  return n;
}
function identity(row) {
  const primary=phone(row?.telefone), document=cpf(row?.cpf);
  const phones=[...new Set([primary,phone(row?.telefone2)].filter(Boolean))];
  return {id:id(row?.id),name:row.nome,primary,phones,cpf:document,
    keys:[`id:${id(row.id)}`,...phones.map(p=>`phone:${sha(p)}`),...(document?[`cpf:${sha(document)}`]:[])].sort()};
}
const clean = column => ['+',' ','(',')','-','.','\t','\r','\n'].reduce((s,c)=>`REPLACE(${s}, '${c}', '')`,`COALESCE(${column}, '')`);
async function liveIdentity(connection,customerId,session=null) {
  const [rows]=await query(connection,'SELECT id,nome,telefone,telefone2,cpf FROM clientes WHERE id=? FOR UPDATE',[id(customerId)]);
  if (rows.length!==1) throw new GuardError('REFERRAL_CUSTOMER_UNAVAILABLE','Cadastro não encontrado. Entre novamente.',422);
  const person=identity(rows[0]);
  if (!person.primary) throw new GuardError('REFERRAL_PHONE_INVALID','Atualize seu WhatsApp com DDD no cadastro antes de usar indicações.',422);
  if (session) {
    const tokenPhone=phone(session.telefone_normalizado)||phone(session.telefone);
    if (!tokenPhone || !person.phones.includes(tokenPhone)) throw new GuardError('REFERRAL_SESSION_CHANGED','Seu cadastro foi alterado. Saia e entre novamente antes de indicar.',401);
  }
  const variants=[...new Set(person.phones.flatMap(phoneVariants))];
  const marks=variants.map(()=>'?').join(',');
  const [others]=await query(connection,`SELECT id FROM clientes WHERE id<>? AND
    (${clean('telefone')} IN (${marks}) OR ${clean('telefone2')} IN (${marks})${person.cpf?` OR ${clean('cpf')}=?`:''}) LIMIT 1`,
    [person.id,...variants,...variants,...(person.cpf?[person.cpf]:[])]);
  if (others.length) throw new GuardError('REFERRAL_IDENTITY_AMBIGUOUS','Há cadastros com o mesmo telefone ou CPF. Solicite a conferência à loja antes de indicar.',409);
  return person;
}
async function lock(connection) {
  const [rows]=await query(connection,"SELECT GET_LOCK('lz_referral_guard_v2',3) AS acquired");
  if(Number(rows[0]?.acquired)!==1) throw new GuardError('REFERRAL_BUSY','Há outra indicação sendo processada. Tente novamente em instantes.',503);
}
async function unlock(connection) { try { await query(connection,"SELECT RELEASE_LOCK('lz_referral_guard_v2')"); } catch {} }
async function rateLimit(pool,action,customerId,ip) {
  for(const [key,seconds,limit] of [[`${action}:user:${id(customerId)}`,action==='issue'?3600:900,action==='issue'?30:20],[`${action}:ip:${String(ip).slice(0,128)}`,3600,240]]) {
    const hash=sha(key);
    await query(pool,`INSERT INTO lz_referral_limits(bucket,hits,reset_at) VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND))
      ON DUPLICATE KEY UPDATE hits=IF(reset_at<=UTC_TIMESTAMP(),1,hits+1),
      reset_at=IF(reset_at<=UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),reset_at)`,[hash,seconds,seconds]);
    const [rows]=await query(pool,'SELECT hits FROM lz_referral_limits WHERE bucket=?',[hash]);
    if(Number(rows[0]?.hits)>limit) throw new GuardError('REFERRAL_RATE_LIMIT','Muitas tentativas de indicação. Aguarde antes de tentar novamente.',429);
  }
}
async function issueInvite(mainPool,cashbackPool,session,secret) {
  const main=await mainPool.getConnection();
  try {
    await main.beginTransaction();
    const person=await liveIdentity(main,session.sub,session);
    const payload=Buffer.from(JSON.stringify({id:Number(person.id),v:2,n:crypto.randomBytes(32).toString('base64url')})).toString('base64url');
    const code=`LZ${payload}.${crypto.createHmac('sha256',secret).update(payload).digest().subarray(0,16).toString('base64url')}`;
    await query(cashbackPool,'INSERT INTO lz_referral_invites(token_hash,indicator_id) VALUES(?,?)',[sha(code),person.id]);
    await main.commit();
    return {code,person};
  } catch(error) { await main.rollback(); throw error; } finally { main.release(); }
}
async function noCycle(connection,indicator,indicated) {
  let current=indicator;
  const seen=new Set();
  for(let depth=0;depth<100;depth++) {
    if(current===indicated || seen.has(current)) throw new GuardError('REFERRAL_CYCLE','Não é permitida indicação circular ou entre contas da mesma pessoa.');
    seen.add(current);
    const [rows]=await query(connection,`SELECT b.indicator_id FROM lz_referral_claims c
      JOIN lz_referral_bindings b ON b.referral_id=c.referral_id WHERE c.identity_key=?`,[`id:${current}`]);
    if(!rows.length) return;
    current=String(rows[0].indicator_id);
  }
  throw new GuardError('REFERRAL_REVIEW','Esta indicação precisa de conferência da loja.');
}
async function validGuard(connection,referralId,indicated,beneficiary,canonicalPhone=null) {
  const [rows]=await query(connection,`SELECT b.* FROM lz_referral_bindings b
    JOIN lz_referral_claims c ON c.identity_key=CONCAT('id:',b.indicated_id) AND c.referral_id=b.referral_id
    JOIN lz_referral_claims p ON p.identity_key=CONCAT('phone:',b.phone_hash) AND p.referral_id=b.referral_id
    WHERE b.referral_id=? AND b.indicated_id=? AND b.indicator_id=? AND b.review_required=0`,[referralId,indicated,beneficiary]);
  return rows.length===1 && (!canonicalPhone || rows[0].phone_hash===sha(canonicalPhone)) ? rows[0] : null;
}
async function acceptInvite(mainPool,cashbackPool,session,code,secret) {
  const parsed=parseAppInvite(code,secret);
  if(!parsed || parsed.v!==2) throw new GuardError('REFERRAL_INVITE_INVALID','Convite inválido ou antigo. Peça à pessoa que gere um novo convite.',400);
  const indicated=id(session.sub),indicator=id(parsed.id);
  if(indicated===indicator) throw new GuardError('SELF_REFERRAL_NOT_ALLOWED','Não é permitido indicar a própria conta.');
  const cb=await cashbackPool.getConnection(); let main,locked=false;
  try {
    await lock(cb);locked=true;
    main=await mainPool.getConnection(); await main.beginTransaction();
    // Consistent lock order also covers inverse invitations in simultaneous requests.
    const people={};
    for(const key of [indicated,indicator].sort((a,b)=>Number(a)-Number(b))) people[key]=await liveIdentity(main,key,key===indicated?session:null);
    const person=people[indicated],referrer=people[indicator];
    if(person.keys.some(k=>referrer.keys.includes(k))) throw new GuardError('SELF_REFERRAL_NOT_ALLOWED','Não é permitido indicar a própria conta, telefone ou CPF.');
    await cb.beginTransaction();
    const hash=sha(code.trim());
    const [invites]=await query(cb,'SELECT * FROM lz_referral_invites WHERE token_hash=? FOR UPDATE',[hash]);
    const invite=invites[0];
    if(!invite || String(invite.indicator_id)!==indicator) throw new GuardError('REFERRAL_INVITE_INVALID','Convite não encontrado. Peça um novo convite.',400);
    if(invite.referral_id!==null) {
      const [rows]=await query(cb,'SELECT id,codigo_ref,status FROM indicacoes WHERE id=? AND indicado_cliente_id=? AND indicador_cliente_id=?',[invite.referral_id,indicated,indicator]);
      if(rows.length===1 && invite.phone_hash===sha(person.primary) && rows[0].status!=='cancelada' && await validGuard(cb,rows[0].id,indicated,indicator,person.primary)) {
        await cb.commit();await main.commit();return {ok:true,already_registered:true,data:rows[0]};
      }
      throw new GuardError('REFERRAL_INVITE_USED','Este convite já foi utilizado. Cada convite serve para apenas uma pessoa.');
    }
    const [claims]=await query(cb,`SELECT identity_key FROM lz_referral_claims WHERE identity_key IN (${person.keys.map(()=>'?').join(',')})`,person.keys);
    // Include cancelled/deleted-history reservations; a new code or edited number never resets an account.
    const [legacy]=await query(cb,'SELECT id FROM indicacoes WHERE indicado_cliente_id=? LIMIT 1',[indicated]);
    if(claims.length || legacy.length) throw blocked();
    await noCycle(cb,indicator,indicated);
    const record='LZR'+crypto.randomBytes(24).toString('base64url');
    const [created]=await query(cb,`INSERT INTO indicacoes(indicador_cliente_id,indicado_cliente_id,nome_indicado,tel_indicado,cpf_indicado,codigo_ref,
      origem_canal,status,cashback_valor_centavos,created_at,updated_at) VALUES(?,?,?,?,?,?,'link','pendente',0,NOW(),NOW())`,
      [indicator,indicated,person.name,person.primary,person.cpf||null,record]);
    const referral=created.insertId;
    await query(cb,'INSERT INTO lz_app_referral_attributions(referral_id,bound_at_utc) VALUES(?,UTC_TIMESTAMP(6))',[referral]);
    await query(cb,'INSERT INTO lz_referral_bindings(referral_id,indicator_id,indicated_id,phone_hash,cpf_hash) VALUES(?,?,?,?,?)',
      [referral,indicator,indicated,sha(person.primary),person.cpf?sha(person.cpf):null]);
    for(const key of person.keys) await query(cb,'INSERT INTO lz_referral_claims(identity_key,referral_id) VALUES(?,?)',[key,referral]);
    const [used]=await query(cb,'UPDATE lz_referral_invites SET referral_id=?,phone_hash=?,consumed_at=UTC_TIMESTAMP(6) WHERE token_hash=? AND referral_id IS NULL',[referral,sha(person.primary),hash]);
    if(used.affectedRows!==1) throw blocked();
    await cb.commit();await main.commit();
    return {ok:true,already_registered:false,data:{id:referral,indicador_cliente_id:indicator,indicado_cliente_id:indicated,codigo_ref:record,status:'pendente'}};
  } catch(error) {
    try{await cb.rollback();}catch{} try{await main?.rollback();}catch{}
    if(error.code==='ER_DUP_ENTRY') throw blocked();
    throw error;
  } finally { main?.release();if(locked)await unlock(cb);cb.release(); }
}
function errorResponse(error,res) {
  const safe=error instanceof GuardError?error:new GuardError('REFERRAL_TEMPORARY_FAILURE','Não foi possível validar a indicação agora. Nenhum crédito foi concedido por esta solicitação.',503);
  if(safe.status===429) res.set('Retry-After','900');
  res.set('Cache-Control','no-store');
  return res.status(safe.status).json({ok:false,code:safe.code,error:safe.message});
}
module.exports={GuardError,id,phone,cpf,sha,identity,liveIdentity,lock,unlock,query,rateLimit,issueInvite,acceptInvite,validGuard,errorResponse};
