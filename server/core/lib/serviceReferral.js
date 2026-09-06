"use strict";

const RULE = "service5_note_total_v1";
const COMPLETE = new Set(["Finalizada", "Entregue"]);
const QUERY_TIMEOUT = 5000;
const {validGuard,liveIdentity,sha,GuardError} = require('./referralGuard');

class RewardError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function identifier(value) {
  if (!["number", "string"].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new RewardError("invalid_identity");
  return String(value);
}
function cents(value, nullable = false) {
  if (nullable && (value === null || value === "")) return 0;
  if (typeof value !== "string" || !/^-?[0-9]{1,9}(?:\.[0-9]{1,2})?$/.test(value)) throw new RewardError("invalid_amount");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) * (negative ? -1 : 1);
}
function noteTotal(row) {
  // subtotal is the saved amount remaining after entry payment. Restore the entry once.
  // Do NOT sum valor/mao_obra/vall/items again: those components already form the saved note.
  const remaining = cents(row.subtotal);
  const entry = cents(row.val_entrada, true);
  const total = remaining + entry;
  if (entry < 0 || total <= 0 || total > 200000000) throw new RewardError("invalid_note_total");
  return total;
}
function rewardCents(base) {
  if (!Number.isSafeInteger(base) || base <= 0 || base > 200000000) throw new RewardError("invalid_note_total");
  // Five percent, commercial half-up rounding to the nearest cent, using integers only.
  return Math.floor((base * 5 + 50) / 100);
}
function decide(event, current, referrals, baseline = false) {
  if (baseline) return { outcome: "historical_note" };
  if (!current || identifier(current.cliente) !== identifier(event.indicated_id)) return { outcome: "identity_changed" };
  if (!COMPLETE.has(current.status)) return { outcome: "note_not_completed" };
  if (noteTotal(current) !== Number(event.base_cents)) return { outcome: "note_amount_changed" };
  if (!Array.isArray(referrals) || referrals.length === 0) return { outcome: "no_referral" };
  if (referrals.length !== 1) return { outcome: "ambiguous_referral" };
  const referral = referrals[0];
  if (identifier(referral.indicado_cliente_id) !== identifier(event.indicated_id) || identifier(referral.indicador_cliente_id) === identifier(event.indicated_id)) return { outcome: "invalid_referral" };
  if (referral.status !== "pendente" || Number(referral.cashback_valor_centavos) !== 0 || referral.os_concluida_id !== null) return { outcome: "referral_already_settled" };
  const amount = rewardCents(Number(event.base_cents));
  if (!amount) return { outcome: "zero_reward" };
  return { outcome: "credit", referralId: identifier(referral.id), beneficiaryId: identifier(referral.indicador_cliente_id), amount };
}
const query = (connection, sql, values = []) => connection.query({ sql, timeout: QUERY_TIMEOUT }, values);

async function confirmLegacy(mainPool, cashbackPool, data) {
  const main = await mainPool.getConnection();
  let cashback;
  try {
    await main.beginTransaction();
    // Serialize the old integration against activation. After activation the panel event,
    // not an amount supplied by an HTTP caller, is the only source of new approvals.
    const [policies] = await query(main, "SELECT enabled FROM lz_service_referral_policy WHERE id=1 FOR UPDATE");
    if (policies.length !== 1 || ![0, 1].includes(Number(policies[0].enabled))) throw new RewardError("policy_unavailable");
    if (Number(policies[0]?.enabled) === 1) {
      await main.commit(); return { outcome: "automated_only" };
    }
    cashback = await cashbackPool.getConnection();
    await cashback.beginTransaction();
    const [referrals] = await query(cashback, "SELECT id FROM indicacoes WHERE id=? LIMIT 1 FOR UPDATE", [data.referralId]);
    if (!referrals.length) {
      await cashback.commit(); await main.commit(); return { outcome: "not_found" };
    }
    // Locking reads prevent an old caller from overwriting a concurrently committed award.
    const [credits] = await query(cashback, "SELECT id FROM lz_service_referral_credits WHERE indicacao_id=? OR os_id=? LIMIT 1 FOR UPDATE", [data.referralId, data.osId]);
    if (credits.length) {
      await cashback.commit(); await main.commit(); return { outcome: "managed_credit" };
    }
    await query(cashback, "UPDATE indicacoes SET status=?, cashback_valor_centavos=?, os_concluida_id=?, updated_at=NOW() WHERE id=?", [data.status, data.amount, data.osId, data.referralId]);
    const [rows] = await query(cashback, "SELECT * FROM indicacoes WHERE id=? LIMIT 1", [data.referralId]);
    await cashback.commit(); await main.commit();
    return { outcome: "updated", row: rows[0] || null };
  } catch (error) {
    if (cashback) { try { await cashback.rollback(); } catch {} }
    try { await main.rollback(); } catch {}
    throw error;
  } finally { cashback?.release(); main.release(); }
}

async function grant(cashback, event, current, baseline, clientsExist) {
  await cashback.beginTransaction();
  try {
    const [existing] = await query(cashback, "SELECT id FROM lz_service_referral_credits WHERE os_id=? LIMIT 1 FOR UPDATE", [event.os_id]);
    if (existing.length) { await cashback.commit(); return "already_credited"; }
    const [referrals] = await query(cashback, `SELECT id, indicador_cliente_id, indicado_cliente_id, status, cashback_valor_centavos, os_concluida_id
      FROM indicacoes WHERE indicado_cliente_id=? AND status<>'cancelada' AND created_at<=?
      ORDER BY id LIMIT 3 FOR UPDATE`, [event.indicated_id, event.occurred_at]);
    const decision = decide(event, current, referrals, baseline);
    if (decision.outcome !== "credit") { await cashback.commit(); return decision.outcome; }
    if (typeof clientsExist !== "function" || !await clientsExist(decision.beneficiaryId, identifier(event.indicated_id))) {
      await cashback.commit(); return "customer_removed";
    }
    if (!await validGuard(cashback,decision.referralId,event.indicated_id,decision.beneficiaryId)) {
      await cashback.commit(); return 'referral_guard_rejected';
    }
    await query(cashback, `INSERT INTO lz_service_referral_credits
      (os_id, indicacao_id, beneficiary_id, indicated_id, base_cents, amount_cents, rule_version, source_event_id, completed_at)
      VALUES (?,?,?,?,?,?,?,?,?)`, [event.os_id, decision.referralId, decision.beneficiaryId, event.indicated_id, event.base_cents, decision.amount, RULE, event.id, event.occurred_at]);
    const [updated] = await query(cashback, `UPDATE indicacoes SET status='concluida', cashback_valor_centavos=?, os_concluida_id=?, updated_at=NOW()
      WHERE id=? AND status='pendente' AND cashback_valor_centavos=0 AND os_concluida_id IS NULL`, [decision.amount, event.os_id, decision.referralId]);
    if (updated.affectedRows !== 1) throw new RewardError("referral_changed");
    await cashback.commit();
    return "credited";
  } catch (error) {
    await cashback.rollback();
    // A concurrent worker/process can reach the unique constraints after our first read.
    // Only consider it done if this exact OS now has a durable credit; never overwrite another award.
    if (error.code === "ER_DUP_ENTRY") {
      const [existing] = await query(cashback, "SELECT id FROM lz_service_referral_credits WHERE os_id=? LIMIT 1", [event.os_id]);
      if (existing.length) return "already_credited";
      return "referral_already_settled";
    }
    throw error;
  }
}

async function runBatch(mainPool, cashbackPool) {
  const main = await mainPool.getConnection();
  let cashback, locked = false;
  const report = { handled: 0, credited: 0, deferred: 0 };
  try {
    const [lock] = await query(main, "SELECT GET_LOCK('lz_service_referral_worker_v1',0) AS acquired");
    locked = Number(lock[0]?.acquired) === 1;
    if (!locked) return report;
    const [policies] = await query(main, "SELECT enabled,min_os_id,cutoff_set_at FROM lz_service_referral_policy WHERE id=1");
    if (Number(policies[0]?.enabled) !== 1) return report;
    const minimumOsId = Number(policies[0]?.min_os_id);
    if (!Number.isSafeInteger(minimumOsId) || minimumOsId<1 || !policies[0]?.cutoff_set_at) throw new RewardError("policy_cutoff_unavailable");
    cashback = await cashbackPool.getConnection();
    const [events] = await query(main, `SELECT id, os_id, indicated_id, actor_id, base_cents,
      DATE_FORMAT(occurred_at,'%Y-%m-%d %H:%i:%s.%f') AS occurred_at
      FROM lz_service_referral_outbox WHERE processed_at IS NULL AND (retry_at IS NULL OR retry_at<=NOW()) ORDER BY id LIMIT 25`);
    for (const event of events) {
      try {
        await main.beginTransaction();
        // Freeze source ownership/status/amount while committing the independent cashback transaction.
        const [rows] = await query(main, "SELECT id, cliente, status, subtotal, val_entrada FROM os WHERE id=? LIMIT 1 FOR UPDATE", [event.os_id]);
        const [old] = await query(main, "SELECT os_id FROM lz_service_referral_baseline WHERE os_id=? LIMIT 1", [event.os_id]);
        const current = rows[0];
        const clientsExist = async (beneficiary, indicated) => {
          try {
            const a=await liveIdentity(main,beneficiary), b=await liveIdentity(main,indicated);
            if(a.keys.some(key=>b.keys.includes(key))) return false;
            const [bindings]=await query(cashback,'SELECT phone_hash,cpf_hash FROM lz_referral_bindings WHERE indicated_id=? AND review_required=0',[indicated]);
            return bindings.length===1 && bindings[0].phone_hash===sha(b.primary)
              && (!bindings[0].cpf_hash || bindings[0].cpf_hash===sha(b.cpf));
          } catch(error) { if(error instanceof GuardError)return false;throw error; }
        };
        const outcome = current ? await grant(cashback, event, current, old.length > 0 || Number(event.os_id)<minimumOsId, clientsExist) : "note_removed";
        await query(main, "UPDATE lz_service_referral_outbox SET outcome=?, processed_at=NOW(6), attempts=attempts+1 WHERE id=? AND processed_at IS NULL", [outcome, event.id]);
        await main.commit();
        report.handled++;
        if (outcome === "credited") report.credited++;
      } catch (error) {
        await main.rollback();
        // Persist safe categories only; never log rows, phone numbers, credentials or SQL errors.
        const code = error instanceof RewardError ? error.code : "temporary_failure";
        await query(main, "UPDATE lz_service_referral_outbox SET outcome=?, attempts=attempts+1, retry_at=DATE_ADD(NOW(),INTERVAL 60 SECOND) WHERE id=? AND processed_at IS NULL", [code, event.id]);
        report.deferred++;
      }
    }
    return report;
  } finally {
    if (locked) { try { await query(main, "SELECT RELEASE_LOCK('lz_service_referral_worker_v1')"); } catch {} }
    cashback?.release(); main.release();
  }
}

module.exports = { RULE, COMPLETE, RewardError, identifier, cents, noteTotal, rewardCents, decide, confirmLegacy, grant, runBatch };
