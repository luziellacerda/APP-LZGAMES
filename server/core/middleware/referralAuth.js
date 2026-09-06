"use strict";

// Scoped bridge for consumer referrals only. Never mint a CORE token or mutate either identity store.
const BOX_ME_URL = "https://turbobox.lzgames.com.br/api/mobile/v1/me";
const MAX_BODY_BYTES = 32768;
const MAX_AUTH_BYTES = 8192;

class ReferralIdentityError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const unavailable = () => new ReferralIdentityError(503, "REFERRAL_IDENTITY_UNAVAILABLE", "Não foi possível confirmar sua conta agora. Tente novamente em instantes.");
const invalidResponse = () => new ReferralIdentityError(502, "REFERRAL_IDENTITY_INVALID_RESPONSE", "O serviço de identificação retornou uma resposta inválida. Tente novamente.");
const notLinked = () => new ReferralIdentityError(422, "REFERRAL_ACCOUNT_NOT_LINKED", "Seu cadastro do TurboBox ainda não está vinculado a um cadastro de cliente LZ-GAMES. Peça à loja para conferir seu telefone.");

function fullBrazilPhone(value) {
  if (typeof value !== "string" || !value || value.length > 40 || /[^0-9+().\s-]/.test(value)) return "";
  let digits = value.replace(/\D/g, "");
  if ([12,13].includes(digits.length) && digits.startsWith("55")) digits = digits.slice(2);
  if (!/^[1-9][0-9](?:[2-9][0-9]{7}|9[0-9]{8})$/.test(digits)) return "";
  // Compatibility applies only to plausible historical mobile numbers, never short suffixes/landlines.
  if (digits.length === 10 && /^[1-9][0-9][6-9]/.test(digits)) digits = digits.slice(0,2) + "9" + digits.slice(2);
  return "55" + digits;
}

function phoneVariants(canonical) {
  if (!canonical || fullBrazilPhone(canonical) !== canonical) throw notLinked();
  const local = canonical.slice(2);
  const values = [canonical, local];
  if (local.length === 11 && local[2] === "9" && /^[6-9]$/.test(local[3])) {
    const legacy = local.slice(0,2) + local.slice(3);
    values.push("55" + legacy, legacy);
  }
  return [...new Set(values)];
}

function positiveId(value) {
  if (!["string", "number"].includes(typeof value) || !/^[1-9][0-9]{0,18}$/.test(String(value)) || !Number.isSafeInteger(Number(value))) return "";
  return String(value);
}

function singleHeader(req, name, limit) {
  const headers = req.headers || {};
  const value = headers[name];
  const raw = Array.isArray(req.rawHeaders) ? req.rawHeaders : [];
  let occurrences = 0;
  for (let i=0; i<raw.length; i+=2) if (String(raw[i]).toLowerCase() === name) occurrences++;
  if (occurrences > 1 || Array.isArray(value) || (value !== undefined && typeof value !== "string") || (typeof value === "string" && (Buffer.byteLength(value) > limit || /[\r\n\0]/.test(value)))) {
    throw new ReferralIdentityError(400, "REFERRAL_IDENTITY_HEADER_INVALID", "Cabeçalho de identificação inválido.");
  }
  return value || "";
}

async function limitedJson(response) {
  const contentType = response.headers?.get("content-type") || "";
  const length = response.headers?.get("content-length");
  if (!/^application\/json(?:\s*;|$)/i.test(contentType) || (length && (!/^[0-9]+$/.test(length) || Number(length) > MAX_BODY_BYTES))) throw invalidResponse();
  if (!response.body || typeof response.body.getReader !== "function") throw invalidResponse();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      let chunk;
      try { chunk = await reader.read(); }
      catch { throw unavailable(); }
      const {done,value} = chunk;
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw invalidResponse();
      chunks.push(Buffer.from(value));
    }
    const text = new TextDecoder("utf-8", {fatal:true}).decode(Buffer.concat(chunks));
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof ReferralIdentityError) throw error;
    throw invalidResponse();
  } finally {
    // Cancel without awaiting an untrusted/hung stream; the outer timeout also aborts the request.
    try { reader.cancel().catch(() => {}); } catch {}
    try { reader.releaseLock(); } catch {}
  }
}

async function fetchBoxUser(fetchImpl, token, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_,reject) => {
    timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, timeoutMs);
  });
  const request = async () => {
    let response;
    try {
      response = await fetchImpl(BOX_ME_URL, {
        method: "GET", redirect: "manual", signal: controller.signal,
        headers: {Accept: "application/json", Authorization: "Bearer " + token},
      });
    } catch { throw unavailable(); }
    if (response.status === 401 || response.status === 403) throw new ReferralIdentityError(401, "BOX_SESSION_EXPIRED", "Sua sessão do TurboBox expirou. Entre novamente.");
    if (response.status === 429 || response.status >= 500 || !response.status) throw unavailable();
    if (response.status !== 200 || response.redirected || (response.url && response.url !== BOX_ME_URL)) throw invalidResponse();
    const payload = await limitedJson(response);
    const user = payload?.data?.user;
    // The fixed /me endpoint itself enforces active customer role and token/auth-version validity.
    if (payload?.ok !== true || !user || typeof user !== "object" || Array.isArray(user) || !positiveId(user.id)) throw invalidResponse();
    const phone = fullBrazilPhone(user.phone);
    if (!phone) throw notLinked();
    return {id: positiveId(user.id), phone};
  };
  try { return await Promise.race([request(), timeout]); }
  finally { clearTimeout(timer); controller.abort(); }
}

async function resolveCoreCustomer(getMainDb, canonical, timeoutMs) {
  const variants = phoneVariants(canonical);
  const marks = variants.map(() => "?").join(",");
  const clean = column => ["+", " ", "(", ")", "-", "."].reduce((sql,character) => `REPLACE(${sql}, '${character}', '')`, `COALESCE(${column}, '')`);
  const sql = `SELECT id, nome, telefone, telefone2 FROM clientes
    WHERE ${clean("telefone")} IN (${marks}) OR ${clean("telefone2")} IN (${marks})
    ORDER BY id LIMIT 3`;
  let rows;
  let timer;
  // Cover connection acquisition/pool waiting as well as query execution, without changing the shared pool.
  // Promise.race installs handlers on both branches, including a query that resolves/rejects after the deadline.
  const query = Promise.resolve().then(getMainDb).then(mainDb => {
    if (!mainDb || typeof mainDb.query !== "function") throw unavailable();
    return mainDb.query({sql, timeout:timeoutMs}, [...variants, ...variants]);
  });
  const deadline = new Promise((_,reject) => { timer = setTimeout(() => reject(unavailable()), timeoutMs); });
  try { [rows] = await Promise.race([query, deadline]); }
  catch { throw unavailable(); }
  finally { clearTimeout(timer); }
  if (!Array.isArray(rows)) throw unavailable();
  if (!rows.length) throw notLinked();
  if (rows.length !== 1) throw new ReferralIdentityError(409, "REFERRAL_ACCOUNT_AMBIGUOUS", "Há mais de um cadastro associado ao seu telefone. Peça à loja para conferir antes de indicar.");
  const row = rows[0];
  const id = positiveId(row.id);
  if (!id || ![row.telefone,row.telefone2].some(phone => fullBrazilPhone(phone) === canonical)) throw notLinked();
  return {
    sub: id,
    nome: typeof row.nome === "string" && row.nome.trim() ? row.nome.trim().slice(0,150) : "Cliente LZ-GAMES",
    telefone: canonical,
    telefone_normalizado: canonical.slice(2),
  };
}

function createReferralAuth({coreAuth, getMainDb, fetchImpl = globalThis.fetch, timeoutMs = 5000, dbTimeoutMs = 3000}) {
  if (typeof coreAuth !== "function" || typeof getMainDb !== "function" || typeof fetchImpl !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000 || !Number.isInteger(dbTimeoutMs) || dbTimeoutMs < 1 || dbTimeoutMs > 15000) throw new TypeError("Invalid referral authentication dependencies.");
  return async function referralIdentity(req, res, next) {
    try {
      const header = singleHeader(req, "x-lz-identity-provider", 16).trim().toLowerCase();
      const authorization = singleHeader(req, "authorization", MAX_AUTH_BYTES);
      if (!header || header === "core") return coreAuth(req, res, next);
      if (header !== "box") throw new ReferralIdentityError(400, "REFERRAL_IDENTITY_PROVIDER_INVALID", "Provedor de identificação inválido.");
      const bearer = authorization.match(/^Bearer ([A-Za-z0-9._~+\/-]{16,4096}={0,2})$/i);
      if (!bearer) throw new ReferralIdentityError(401, "BOX_SESSION_EXPIRED", "Sua sessão do TurboBox expirou. Entre novamente.");
      const box = await fetchBoxUser(fetchImpl, bearer[1], timeoutMs);
      req.user = await resolveCoreCustomer(getMainDb, box.phone, dbTimeoutMs);
      return next();
    } catch (error) {
      const safe = error instanceof ReferralIdentityError ? error : unavailable();
      return res.status(safe.status).json({ok:false, code:safe.code, error:safe.message});
    }
  };
}

let defaultMiddleware;
function referralAuth(req, res, next) {
  if (!defaultMiddleware) defaultMiddleware = createReferralAuth({
    coreAuth: require("./auth"),
    getMainDb: () => require("../db").dbMain,
  });
  return defaultMiddleware(req, res, next);
}

module.exports = referralAuth;
module.exports.createReferralAuth = createReferralAuth;
module.exports.fullBrazilPhone = fullBrazilPhone;
module.exports.phoneVariants = phoneVariants;
module.exports.BOX_ME_URL = BOX_ME_URL;
