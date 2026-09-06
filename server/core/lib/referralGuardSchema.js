"use strict";
const {query,identity,phone,cpf,sha,lock,unlock}=require('./referralGuard');
async function schema(db,temporary=false) {
  const create=temporary?'CREATE TEMPORARY TABLE':'CREATE TABLE IF NOT EXISTS';
  for(const sql of [
    `lz_referral_invites(token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      indicator_id BIGINT UNSIGNED NOT NULL,referral_id BIGINT UNSIGNED NULL UNIQUE,phone_hash CHAR(64) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),consumed_at DATETIME(6) NULL,INDEX issuer(indicator_id))`,
    `lz_referral_bindings(referral_id BIGINT UNSIGNED PRIMARY KEY,indicator_id BIGINT UNSIGNED NOT NULL,
      indicated_id BIGINT UNSIGNED NOT NULL,phone_hash CHAR(64) NULL,cpf_hash CHAR(64) NULL,
      review_required TINYINT NOT NULL DEFAULT 0,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),INDEX recipient(indicated_id))`,
    `lz_referral_claims(identity_key VARCHAR(90) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
      referral_id BIGINT UNSIGNED NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),INDEX referral(referral_id))`,
    `lz_referral_limits(bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,hits INT UNSIGNED NOT NULL,
      reset_at DATETIME NOT NULL,INDEX expiry(reset_at))`
  ]) await query(db,`${create} ${sql} ENGINE=InnoDB`);
}
// Additive, never deletes, settles, transfers, reopens or awards a historical referral.
// Import every status. The earliest record reserves identity forever; conflicting old records require review.
async function seed(main,cb) {
  await lock(cb);
  try {
    await cb.beginTransaction();
    const [refs]=await query(cb,'SELECT id,indicador_cliente_id,indicado_cliente_id,tel_indicado,cpf_indicado FROM indicacoes ORDER BY created_at,id FOR UPDATE');
    let added=0,review=0;
    for(const ref of refs) {
      const [already]=await query(cb,'SELECT referral_id FROM lz_referral_bindings WHERE referral_id=?',[ref.id]);
      if(already.length) continue;
      const keys=new Set();
      let primary=phone(ref.tel_indicado),document=cpf(ref.cpf_indicado);
      if(ref.indicado_cliente_id) {
        keys.add(`id:${ref.indicado_cliente_id}`);
        const [clients]=await query(main,'SELECT id,nome,telefone,telefone2,cpf FROM clientes WHERE id=?',[ref.indicado_cliente_id]);
        if(clients.length===1) {
          const current=identity(clients[0]);current.keys.forEach(k=>keys.add(k));
          primary=primary||current.primary;document=document||current.cpf;
        }
      }
      if(primary) keys.add(`phone:${sha(primary)}`);if(document)keys.add(`cpf:${sha(document)}`);
      let flagged=!primary||!ref.indicado_cliente_id||ref.indicado_cliente_id===ref.indicador_cliente_id;
      await query(cb,'INSERT INTO lz_referral_bindings(referral_id,indicator_id,indicated_id,phone_hash,cpf_hash,review_required) VALUES(?,?,?,?,?,?)',
        [ref.id,ref.indicador_cliente_id,ref.indicado_cliente_id||0,primary?sha(primary):null,document?sha(document):null,Number(flagged)]);
      for(const key of [...keys].sort()) {
        const [claimed]=await query(cb,'SELECT referral_id FROM lz_referral_claims WHERE identity_key=?',[key]);
        if(claimed.length) { flagged=true; await query(cb,'UPDATE lz_referral_bindings SET review_required=1 WHERE referral_id=?',[claimed[0].referral_id]); }
        else await query(cb,'INSERT INTO lz_referral_claims(identity_key,referral_id) VALUES(?,?)',[key,ref.id]);
      }
      if(flagged){review++;await query(cb,'UPDATE lz_referral_bindings SET review_required=1 WHERE referral_id=?',[ref.id]);}
      added++;
    }
    await cb.commit();return {historicalRows:refs.length,added,review,financialChanges:0};
  }catch(e){await cb.rollback();throw e;}finally{await unlock(cb);}
}
module.exports={schema,seed};
