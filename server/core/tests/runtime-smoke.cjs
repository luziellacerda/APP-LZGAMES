"use strict";
// No real customer, database or outgoing integration is used by this fixture.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

test("shared API runtime compatibility without real customers or integrations", {
  skip: !process.env.LZ_API_RUNTIME_FIXTURE,
  timeout: 30000,
}, async (t) => {
  const source = process.env.LZ_API_SOURCE || "/home/lz-servidor/Documentos/lzgames/api";
  const runtime = path.resolve(process.env.LZ_API_RUNTIME_FIXTURE);
  const runtimeRequire = Module.createRequire(path.join(runtime, "package.json"));
  const secret = "local-runtime-fixture-only-not-a-production-secret";
  let databaseCalls = 0;
  const pool = {
    query() { databaseCalls++; throw new Error("Database use forbidden in runtime smoke fixture"); },
    execute() { databaseCalls++; throw new Error("Database use forbidden in runtime smoke fixture"); },
    getConnection() { databaseCalls++; throw new Error("Database use forbidden in runtime smoke fixture"); },
  };
  const databases = new Proxy({}, {get() { return pool; }});
  const originalLoad = Module._load;
  Module._load = function(name, parent, isMain) {
    if (parent?.filename?.startsWith(source + path.sep) && !parent.filename.includes(path.sep + "node_modules" + path.sep) && parent.filename !== path.join(runtime, "package.json")) {
      if (/^(\.\.\/|\.\/)(db|dbCashback)(\.js)?$/.test(name)) return databases;
      if (name.endsWith("config/jwtConfig")) return {JWT_SECRET: secret, JWT_EXPIRES_IN: "1h", REFERRAL_SECRET: secret, SERVICE_SECRET: secret};
      if (!name.startsWith(".") && !path.isAbsolute(name) && !Module.isBuiltin(name)) return runtimeRequire(name);
    }
    return originalLoad.call(this, name, parent, isMain);
  };
  let server;
  try {
    const app = require(path.join(source, "app.js"));
    const auth = require(path.join(source, "middleware/authMiddleware.js"));
    app.get("/__runtime/identity", auth, (req, res) => res.json({sub: req.user.sub}));
    app.get("/__runtime/query", (req, res) => res.json(req.query));
    app.get("/__runtime/redirect", (req, res) => res.redirect("/__runtime/query?status=ok"));
    app.post("/__runtime/echo", (req, res) => res.json(req.body));
    app.use((error, req, res, next) => res.status(error.status || 500).json({ok: false}));
    server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const base = "http://127.0.0.1:" + server.address().port;
    await t.test("all mounted consumer modules keep anonymous requests rejected", async () => {
      for (const endpoint of ["/api/auth/me", "/api/me/orders", "/api/me/agenda", "/api/me/benefits-overview", "/api/me/gamification-tree", "/api/ranking/top-3", "/api/me/referrals/summary", "/api/marketplace/products", "/api/shipping/track/fixture"]) {
        const response = await fetch(base + endpoint);
        assert.equal(response.status, 401, endpoint);
      }
      assert.equal(databaseCalls, 0);
    });
    await t.test("health, headers and CORS preflight retain their contract", async () => {
      const response = await fetch(base + "/api/health");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-powered-by"), null);
      const options = await fetch(base + "/api/marketplace/products", {method: "OPTIONS", headers: {Origin: "https://app.lzgames.com.br", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"}});
      assert.equal(options.status, 204);
      assert.equal(options.headers.get("access-control-allow-origin"), "https://app.lzgames.com.br");
      const denied = await fetch(base + "/api/health", {headers: {Origin: "https://invalid-fixture.example"}});
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
    });
    await t.test("existing JWT format is accepted only with a valid unexpired signature", async () => {
      const jwt = runtimeRequire("jsonwebtoken");
      const token = jwt.sign({sub: "fixture-101"}, secret, {expiresIn: "1h"});
      const response = await fetch(base + "/__runtime/identity", {headers: {Authorization: "Bearer " + token}});
      assert.deepEqual(await response.json(), {sub: "fixture-101"});
      for (const invalid of [jwt.sign({sub: "fixture-101"}, "wrong-fixture-secret"), jwt.sign({sub: "fixture-101"}, secret, {expiresIn: -60})]) {
        assert.equal((await fetch(base + "/__runtime/identity", {headers: {Authorization: "Bearer " + invalid}})).status, 401);
      }
    });
    await t.test("both password libraries retain hash verification compatibility", async () => {
      for (const name of ["bcrypt", "bcryptjs"]) {
        const bcrypt = runtimeRequire(name);
        const hash = await bcrypt.hash("local-fixture-password", 4);
        assert.equal(await bcrypt.compare("local-fixture-password", hash), true);
        assert.equal(await bcrypt.compare("incorrect", hash), false);
      }
    });
    await t.test("query strings and JSON parsing remain bounded and compatible", async () => {
      const query = await (await fetch(base + "/__runtime/query?search=controle&status=active&page=2&category[]=games&category[]=consoles")).json();
      assert.deepEqual(query, {search: "controle", status: "active", page: "2", category: ["games", "consoles"]});
      const valid = await fetch(base + "/__runtime/echo", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ok: true})});
      assert.deepEqual(await valid.json(), {ok: true});
      const invalid = await fetch(base + "/__runtime/echo", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{"});
      assert.equal(invalid.status, 400);
      const oversized = await fetch(base + "/__runtime/echo", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({value: "x".repeat(110000)})});
      assert.equal(oversized.status, 413);
      const qs = runtimeRequire("qs");
      assert.doesNotThrow(() => qs.stringify(qs.parse("value[constructor][isBuffer]=not-callable", {plainObjects: true})));
    });
    await t.test("axios local redirects and mysql2 imports are operational", async () => {
      const result = await runtimeRequire("axios").get(base + "/__runtime/redirect", {timeout: 3000, proxy: false});
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, {status: "ok"});
      assert.equal(typeof runtimeRequire("mysql2/promise").createPool, "function");
      assert.equal(databaseCalls, 0);
    });
  } finally {
    Module._load = originalLoad;
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
