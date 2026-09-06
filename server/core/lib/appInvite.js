"use strict";

// Public invitation information only. Read-only issuance check; no identity disclosure or reward writes.
const crypto = require("node:crypto");
const release = Object.freeze(require("../config/appRelease.json"));
const APP_INVITE_BASE = "https://app.lzgames.com.br/convite/";

function parseAppInvite(value, secret) {
  if (typeof value !== "string" || value.length > 1024 || typeof secret !== "string" || !secret) return false;
  const code = value.trim();
  const match = /^LZ([A-Za-z0-9_-]{1,700})\.([A-Za-z0-9_-]{22})$/.exec(code);
  if (!match) return false;
  const [, payload, signature] = match;
  try {
    const received = Buffer.from(signature, "base64url");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest().subarray(0, 16);
    if (received.length !== 16 || received.toString("base64url") !== signature || !crypto.timingSafeEqual(received, expected)) return false;
    const decoded = Buffer.from(payload, "base64url");
    if (decoded.toString("base64url") !== payload) return false;
    const data = JSON.parse(decoded.toString("utf8"));
    if (data === null || typeof data !== 'object' || Array.isArray(data) || !Number.isSafeInteger(data.id) || data.id<=0) return null;
    if (Object.keys(data).length===1) return data; // Legacy signature recognized, never accepted as a new binding.
    return Object.keys(data).length===3 && data.v===2 && typeof data.n==='string'
      && /^[A-Za-z0-9_-]{43}$/.test(data.n) && Buffer.from(data.n,'base64url').toString('base64url')===data.n ? data : null;
  } catch { return false; }
}
function validAppInvite(value,secret) { return Boolean(parseAppInvite(value,secret)); }

function referralShareLink(request, code, legacyBase) {
  const provider = request.headers?.["x-lz-identity-provider"];
  const native = typeof provider === "string" && ["core", "box"].includes(provider.toLowerCase());
  return `${native ? APP_INVITE_BASE : legacyBase}?ref=${encodeURIComponent(code)}`;
}

function publicAppInviteInfo(secret, cashback=null) {
  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.set("Referrer-Policy", "no-referrer");
    const code = req.query?.ref;
    if (code !== undefined && !validAppInvite(code, secret)) {
      return res.status(400).json({ok:false, error:"Este convite não é válido. Peça um novo link a quem indicou você."});
    }
    if(code!==undefined && cashback) {
      try {
        if(parseAppInvite(code,secret)?.v!==2) return res.status(400).json({ok:false,error:'Este é um convite antigo. Peça um novo convite à pessoa que indicou você.'});
        const hash=crypto.createHash('sha256').update(code.trim()).digest('hex');
        const [rows]=await cashback.query({sql:'SELECT referral_id FROM lz_referral_invites WHERE token_hash=?',timeout:3000},[hash]);
        if(rows.length!==1 || rows[0].referral_id!==null) return res.status(409).json({ok:false,error:'Este convite já foi utilizado ou não está disponível. Peça um novo convite.'});
      } catch { return res.status(503).json({ok:false,error:'Não foi possível conferir o convite agora. Tente novamente.'}); }
    }
    // A valid signature is NOT registration, eligibility or reward confirmation.
    return res.json({ok:true, data:{has_invite:code !== undefined, release}});
  };
}

module.exports = {APP_INVITE_BASE, parseAppInvite, validAppInvite, referralShareLink, publicAppInviteInfo};
