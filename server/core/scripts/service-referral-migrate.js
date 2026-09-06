"use strict";
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
for (const file of ["/etc/lzgames/db.env", "/etc/lzgames/db.systemd.env"]) Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
dotenv.config({ path: path.join(__dirname, "../.env") });
const oldLog = console.log; console.log = () => {};
const { dbMain, dbCashback } = require("../db"); console.log = oldLog;
async function main() {
  if (!dbMain || !dbCashback) throw new Error("databases_unavailable");
  // Creation only. No DROP/ALTER of legacy tables, no approval, credit or backfill.
  await dbMain.query(`CREATE TABLE IF NOT EXISTS lz_service_referral_policy (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 0,
    activated_at DATETIME(6) NULL, rule_version VARCHAR(64) NOT NULL,
    min_os_id INT NOT NULL DEFAULT 1, cutoff_set_at DATETIME(6) NULL) ENGINE=InnoDB`);
  // Only evolve this program's own new policy table; never ALTER legacy financial tables.
  const [columns] = await dbMain.query("SHOW COLUMNS FROM lz_service_referral_policy");
  if (!columns.some(column => column.Field === "min_os_id")) await dbMain.query("ALTER TABLE lz_service_referral_policy ADD COLUMN min_os_id INT NOT NULL DEFAULT 1");
  if (!columns.some(column => column.Field === "cutoff_set_at")) await dbMain.query("ALTER TABLE lz_service_referral_policy ADD COLUMN cutoff_set_at DATETIME(6) NULL");
  await dbMain.query(`INSERT IGNORE INTO lz_service_referral_policy(id,enabled,rule_version) VALUES (1,0,'service5_note_total_v1')`);
  await dbMain.query(`CREATE TABLE IF NOT EXISTS lz_service_referral_baseline (
    os_id INT NOT NULL PRIMARY KEY, recorded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB`);
  await dbMain.query(`CREATE TABLE IF NOT EXISTS lz_service_referral_outbox (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, os_id INT NOT NULL,
    indicated_id INT NOT NULL, actor_id INT NOT NULL, base_cents BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL, attempts INT NOT NULL DEFAULT 0, retry_at DATETIME NULL,
    outcome VARCHAR(64) NULL, KEY service_os (os_id), KEY pending_referral(processed_at,retry_at)
  ) ENGINE=InnoDB`);
  await dbCashback.query(`CREATE TABLE IF NOT EXISTS lz_service_referral_credits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, os_id INT NOT NULL,
    indicacao_id INT UNSIGNED NOT NULL, beneficiary_id INT UNSIGNED NOT NULL, indicated_id INT UNSIGNED NOT NULL,
    base_cents BIGINT NOT NULL, amount_cents BIGINT NOT NULL, rule_version VARCHAR(64) NOT NULL,
    source_event_id BIGINT UNSIGNED NOT NULL, completed_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_service_credit_os(os_id), UNIQUE KEY uq_service_credit_referral(indicacao_id),
    KEY beneficiary_rewards(beneficiary_id,created_at)
  ) ENGINE=InnoDB`);
  const cutoffArgument = process.argv.find(argument => argument.startsWith("--start-after-os="));
  if (process.argv.includes("--activate") || cutoffArgument) {
    const connection = await dbMain.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query("SELECT enabled,activated_at,min_os_id,cutoff_set_at FROM lz_service_referral_policy WHERE id=1 FOR UPDATE");
      const policy = rows[0];
      if (cutoffArgument) {
        const value = cutoffArgument.split("=")[1];
        if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)>=2147483647) throw new Error("invalid_cutoff");
        const minimum = Number(value)+1;
        if (Number(policy.enabled)!==0 || (policy.cutoff_set_at && Number(policy.min_os_id)!==minimum)) throw new Error("cutoff_requires_paused_unchanged_policy");
        const [last] = await connection.query("SELECT COALESCE(MAX(id),0) AS last_id FROM os");
        if (Number(value)>Number(last[0].last_id)) throw new Error("unknown_note_cutoff");
        await connection.query("INSERT IGNORE INTO lz_service_referral_baseline(os_id) SELECT id FROM os WHERE id<?",[minimum]);
        await connection.query("UPDATE lz_service_referral_policy SET min_os_id=?,cutoff_set_at=COALESCE(cutoff_set_at,NOW(6)) WHERE id=1",[minimum]);
        policy.min_os_id=minimum; policy.cutoff_set_at=true;
      }
      if (process.argv.includes("--activate") && !policy.cutoff_set_at) throw new Error("explicit_note_cutoff_required");
      if (process.argv.includes("--activate") && !policy.activated_at) {
        await connection.query("INSERT IGNORE INTO lz_service_referral_baseline(os_id) SELECT id FROM os WHERE status IN ('Finalizada','Entregue')");
        await connection.query("UPDATE lz_service_referral_policy SET enabled=1,activated_at=NOW(6) WHERE id=1");
      } else if (process.argv.includes("--activate")) await connection.query("UPDATE lz_service_referral_policy SET enabled=1 WHERE id=1");
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  const [rows] = await dbMain.query("SELECT enabled, rule_version, min_os_id FROM lz_service_referral_policy WHERE id=1");
  console.log(JSON.stringify({ migration: "service_referrals", policy: rows[0], noCreditsCreated: true }));
  await Promise.all([dbMain.end(), dbCashback.end()]);
}
main().catch(() => { console.error("service_referral_migration_failed: details_private"); process.exit(1); });
