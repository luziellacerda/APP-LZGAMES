"use strict";
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
// Reuse existing server-owned configuration, never embed/copy a database password.
for (const file of ["/etc/lzgames/db.env", "/etc/lzgames/db.systemd.env"]) Object.assign(process.env, dotenv.parse(fs.readFileSync(file)));
dotenv.config({ path: path.join(__dirname, "../.env") });
const previousLog = console.log; console.log = () => {};
const { dbMain, dbCashback } = require("../db");
console.log = previousLog;
const { runBatch } = require("../lib/serviceReferral");
if (!dbMain || !dbCashback) throw new Error("Referral databases unavailable.");
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; });
async function main() {
  do {
    try {
      const result = await runBatch(dbMain, dbCashback);
      if (result.handled || result.deferred || process.argv.includes("--once")) console.log(JSON.stringify({ event: "service_referrals", ...result }));
    } catch { console.error("service_referrals: temporary_failure"); }
    if (process.argv.includes("--once") || stopping) break;
    await new Promise(resolve => setTimeout(resolve, 15000));
  } while (!stopping);
  await Promise.all([dbMain.end(), dbCashback.end()]);
}
main().catch(() => { console.error("service_referrals: stopped"); process.exitCode = 1; });
