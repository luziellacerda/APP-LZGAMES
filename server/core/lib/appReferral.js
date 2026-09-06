"use strict";

async function appReferralSummary(db, beneficiaryId) {
  if (!/^[1-9][0-9]*$/.test(String(beneficiaryId))) throw new Error("Invalid beneficiary");
  const [rows] = await db.query({sql: `SELECT COUNT(*) AS rewards,COALESCE(SUM(amount_cents),0) AS cents,
    (SELECT COALESCE(SUM(amount_cents),0) FROM lz_app_referral_redemptions WHERE beneficiary_id=? AND state='active') AS used,
    (SELECT enabled FROM lz_app_referral_redemption_policy WHERE id=1) AS enabled
    FROM lz_app_referral_credits WHERE beneficiary_id=? AND usage_restriction='services_only'`,timeout:3000}, [beneficiaryId,beneficiaryId]);
  const count = Number(rows[0]?.rewards), cents = Number(rows[0]?.cents), used = Number(rows[0]?.used), enabled = Number(rows[0]?.enabled);
  if (['rewards','cents','used'].some(key => rows[0]?.[key] == null)) throw new Error("Missing app referral balance");
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(cents) || cents < 0 || cents !== count * 990 ||
      !Number.isSafeInteger(used) || used < 0 || used > cents || rows[0]?.enabled == null || ![0,1].includes(enabled)) throw new Error("Invalid app referral ledger");
  return { rule_version:"app_first_use_990_v1", bonus_centavos:990, creditos_acumulados_centavos:cents,
    creditos_utilizados_centavos:used, saldo_disponivel_centavos:cents-used,
    indicacoes_premiadas:count, usage_restriction:"services_only", withdrawable:false, redemption_enabled:enabled===1,
    trigger:"first_authenticated_native_app_use", expires:false };
}

/** Binding and precise server timestamp commit together; no credit happens in login/accept routes. */
async function insertTimedAppReferral(pool, values) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(`INSERT INTO indicacoes (
      indicador_cliente_id,indicado_cliente_id,nome_indicado,tel_indicado,cpf_indicado,codigo_ref,
      origem_canal,status,cashback_valor_centavos,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,'pendente',0,NOW(),NOW())`, values);
    await connection.query("INSERT INTO lz_app_referral_attributions(referral_id,bound_at_utc) VALUES(?,UTC_TIMESTAMP(6))",[result.insertId]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

module.exports = { appReferralSummary, insertTimedAppReferral };
