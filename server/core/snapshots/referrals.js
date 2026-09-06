// api/routes/referrals.js
"use strict";

const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const db = require("../db");
const auth = require("../middleware/referralAuth");
const { confirmLegacy } = require("../lib/serviceReferral");
const { appReferralSummary } = require("../lib/appReferral");
const guard = require("../lib/referralGuard");
const { REFERRAL_SECRET, SERVICE_SECRET } = require("../config/jwtConfig");
const { referralShareLink, publicAppInviteInfo } = require("../lib/appInvite");
// -----------------------------------------------------------------------------
// Configurações
// -----------------------------------------------------------------------------
const REFERRAL_BASE_URL =
  process.env.REFERRAL_LINK_BASE ||
  process.env.REFERRAL_BASE_URL ||
  "https://app.lzgames.com.br/login";

// Public, read-only download/invitation information. Never binds or grants credit.
router.get("/app/invite-info", publicAppInviteInfo(REFERRAL_SECRET, db.dbCashback || db.db4));

const REFERRAL_TIERS = Object.freeze([
  { id: "starter", threshold: 0, label: "Iniciante", percent: 0, description: "Comece a indicar para gerar cashback." },
  { id: "tier5", threshold: 5, label: "Influencer 5%", percent: 5, description: "A partir de 5 indicações válidas, você recebe 5% de cashback." },
  { id: "tier10", threshold: 10, label: "Influencer 10%", percent: 10, description: "Com 10 indicações válidas, seu cashback sobe para 10%." },
  { id: "tier20", threshold: 20, label: "Influencer 20%", percent: 20, description: "Com 20 indicações válidas, você atinge 20% de cashback." },
  { id: "tier30", threshold: 30, label: "Influencer 30%", percent: 30, description: "Com 30 indicações válidas, você atinge o nível máximo de 30%." },
]);

function getReferralTier(validReferrals) {
  let current = REFERRAL_TIERS[0];
  for (const tier of REFERRAL_TIERS) {
    if (validReferrals >= tier.threshold) current = tier;
    else break;
  }
  return current;
}

// -----------------------------------------------------------------------------
// Helpers de banco
// -----------------------------------------------------------------------------
function ensureDbOr503(res) {
  const cashbackDb = db.dbCashback || db.db4;
  const mainDb = db.dbMain || db.db1;
  if (!cashbackDb) {
    res.status(503).json({ ok: false, error: "DB de cashback/indicações não configurado." });
    return null;
  }
  if (!mainDb) {
    res.status(503).json({ ok: false, error: "DB principal de clientes não configurado." });
    return null;
  }
  return { cashbackDb, mainDb };
}




// -----------------------------------------------------------------------------
// Helpers de código de indicação (base64-url sobre { id })
// -----------------------------------------------------------------------------
// Invitation parsing, issuance and permanent identity reservations live in referralGuard.

// -----------------------------------------------------------------------------
// GET /api/me/referrals/summary
// Resumo das indicações do cliente logado (cards da tela do portal)
// -----------------------------------------------------------------------------
router.get("/me/referrals/summary", auth, async (req, res) => {
  const dbs = ensureDbOr503(res);
  if (!dbs) return;
  const { cashbackDb, mainDb } = dbs;
  try {
    const indicadorId = req.user.sub;
    if (!indicadorId) {
      return res
        .status(400)
        .json({ ok: false, error: "Usuário não identificado no token." });
    }

    const [rows] = await cashbackDb.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pendente'  THEN 1 ELSE 0 END) AS pendentes,
        SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) AS concluidas,
        SUM(CASE WHEN status = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
        COALESCE(
          SUM(
            CASE WHEN status = 'concluida'
                 THEN cashback_valor_centavos
                 ELSE 0
            END
          ),
          0
        ) AS cashback_aprovado_centavos
      FROM indicacoes
      WHERE indicador_cliente_id = ?
      `,
      [indicadorId]
    );

    const row = rows && rows[0] ? rows[0] : {};

    // Fixed 5% rule applies to future authenticated OS completions after explicit activation.
    // Historical approvals remain unchanged; no tier percentage is used to recalculate them.
    const [policyRows] = await mainDb.query("SELECT enabled,min_os_id FROM lz_service_referral_policy WHERE id=1");
    const completionProgram = Number(policyRows[0]?.enabled) === 1;
    const completionTier = { id: "service5_note_total_v1", threshold: 0, label: "Indicação de serviço", percent: 5,
      description: `5% do valor total da nota, incluindo serviços e peças, após descontos e antes de abater a entrada. Somente notas nº ${Number(policyRows[0]?.min_os_id)} em diante, finalizadas após a ativação. Crédito ao indicador; uma aprovação por indicação.` };

    const summary = {
      indicacoes_total: Number(row.total || 0),
      indicacoes_pendentes: Number(row.pendentes || 0),
      indicacoes_concluidas: Number(row.concluidas || 0),
      indicacoes_canceladas: Number(row.canceladas || 0),
      cashback_aprovado_centavos: Number(row.cashback_aprovado_centavos || 0),
      app_referral_credit: await appReferralSummary(cashbackDb, indicadorId),
      indicacoes_validas: Number(row.concluidas || 0),
      referral_program: {
        tiers: completionProgram ? [completionTier] : REFERRAL_TIERS,
        current_tier: completionProgram ? completionTier : getReferralTier(Number(row.concluidas || 0)),
        based_on: completionProgram ? "os_finalizada_total_nota" : "concluidas",
        ...(completionProgram ? { eligible_from_os_id: Number(policyRows[0]?.min_os_id) } : {}),
      },
    };

    return res.json({ ok: true, data: summary });
  } catch (err) {
    console.error("[referrals] erro em GET /me/referrals/summary:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao carregar resumo de indicações.",
    });
  }
});

// -----------------------------------------------------------------------------
// GET /api/me/referrals/list?days=365
// Lista das indicações do cliente logado (histórico detalhado)
// -----------------------------------------------------------------------------
router.get("/me/referrals/list", auth, async (req, res) => {
  const dbs = ensureDbOr503(res);
  if (!dbs) return;
  const { cashbackDb, mainDb } = dbs;
  try {
    const indicadorId = req.user.sub;
    if (!indicadorId) {
      return res
        .status(400)
        .json({ ok: false, error: "Usuário não identificado no token." });
    }

    let { days } = req.query || {};
    let dias = parseInt(days, 10);
    if (!Number.isFinite(dias) || dias <= 0) dias = 365;
    if (dias > 365) dias = 365;

    const [rows] = await cashbackDb.query(
      `
      SELECT
        id,
        indicador_cliente_id,
        indicado_cliente_id,
        indicado_cashback_usuario_id,
        nome_indicado,
        tel_indicado,
        cpf_indicado,
        codigo_ref,
        origem_canal,
        status,
        cashback_valor_centavos,
        cashback_versao_id,
        os_concluida_id,
        created_at,
        updated_at
      FROM indicacoes
      WHERE indicador_cliente_id = ?
        AND created_at >= (NOW() - INTERVAL ? DAY)
      ORDER BY created_at DESC, id DESC
      LIMIT 200
      `,
      [indicadorId, dias]
    );

    const list = (rows || []).map((row) => ({
      id: row.id,
      codigo_ref: row.codigo_ref,
      status: row.status,
      origem_canal: row.origem_canal,
      cashback_valor_centavos: Number(row.cashback_valor_centavos || 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
      nome_indicado: row.nome_indicado,
      tel_indicado: row.tel_indicado,
      os_concluida_id: row.os_concluida_id,
    }));

    return res.json({ ok: true, data: list });
  } catch (err) {
    console.error("[referrals] erro em GET /me/referrals/list:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao listar suas indicações.",
    });
  }
});

// -----------------------------------------------------------------------------
// Handler para geração de link de indicação (usado em 2 rotas)
// -----------------------------------------------------------------------------
async function handleGenerateReferralLink(req, res) {
  const dbs = ensureDbOr503(res);
  if (!dbs) return;
  try {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: "Sessão inválida. Faça login novamente.",
      });
    }

    await guard.rateLimit(dbs.cashbackDb,'issue',req.user.sub,req.ip);
    const {code:codigoRef,person}=await guard.issueInvite(dbs.mainDb,dbs.cashbackDb,req.user,REFERRAL_SECRET);
    const indicadorId=person.id,indicadorNome=person.name;

    const link = referralShareLink(req, codigoRef, REFERRAL_BASE_URL);

    return res.json({
      ok: true,
      data: {
        codigo_ref: codigoRef,
        link,
        indicador_id: indicadorId,
        indicador_nome: indicadorNome,
      },
    });
  } catch (err) {
    return guard.errorResponse(err,res);
  }
}

// POST /api/me/referrals/link  (endpoint usado pelo portal)
router.post("/me/referrals/link", auth, handleGenerateReferralLink);

// POST /api/me/referrals/generate-link  (alias para compatibilidade)
router.post("/me/referrals/generate-link", auth, handleGenerateReferralLink);

// -----------------------------------------------------------------------------
// POST /api/referrals/accept
// Quando o amigo acessa o link com ?ref=XXX e finaliza o login/cadastro
// -----------------------------------------------------------------------------
router.post("/referrals/accept", auth, async (req, res) => {
  const dbs = ensureDbOr503(res);
  if (!dbs) return;
  const { cashbackDb, mainDb } = dbs;
  try {
    await guard.rateLimit(cashbackDb,'accept',req.user.sub,req.ip);
    const result=await guard.acceptInvite(mainDb,cashbackDb,req.user,req.body?.codigo_ref,REFERRAL_SECRET);
    res.set('Cache-Control','no-store');
    return res.json(result);
  } catch (err) {
    return guard.errorResponse(err,res);
  }
});

// -----------------------------------------------------------------------------
// POST /api/referrals/confirm-from-os
// Atualiza uma indicação a partir de uma OS concluída
// -----------------------------------------------------------------------------
router.post("/referrals/confirm-from-os", async (req, res) => {
  const suppliedSecret = String(req.get("X-LZ-Service-Key") || "");
  const suppliedBuffer = Buffer.from(suppliedSecret);
  const expectedBuffer = Buffer.from(SERVICE_SECRET);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return res.status(403).json({
      ok: false,
      error: "Integração de confirmação por OS não autorizada.",
    });
  }

  const dbs = ensureDbOr503(res);
  if (!dbs) return;
  const { cashbackDb, mainDb } = dbs;
  try {
    const { indicacao_id, os_id, cashback_centavos, status } = req.body || {};

    if (!indicacao_id || !os_id) {
      return res.status(400).json({
        ok: false,
        error: "ID da indicação e ID da OS são obrigatórios.",
      });
    }

    const newStatus = status || "concluida";
    const cashbackVal = Number(cashback_centavos || 0);
    if (!["concluida", "cancelada"].includes(newStatus)) {
      return res.status(400).json({
        ok: false,
        error: "Status de indicação inválido.",
      });
    }
    if (
      !Number.isSafeInteger(Number(indicacao_id)) || Number(indicacao_id) < 1 ||
      !Number.isSafeInteger(Number(os_id)) || Number(os_id) < 1 ||
      !Number.isInteger(cashbackVal) ||
      cashbackVal < 0 ||
      cashbackVal > 100000000
    ) {
      return res.status(400).json({
        ok: false,
        error: "Dados numéricos da confirmação são inválidos.",
      });
    }

    const result = await confirmLegacy(mainDb, cashbackDb, {
      referralId: Number(indicacao_id), osId: Number(os_id), status: newStatus, amount: cashbackVal,
    });
    if (["automated_only", "managed_credit"].includes(result.outcome)) return res.status(409).json({
      ok: false, error: "A aprovação é automática ao finalizar a OS no painel. Esta integração não pode atribuir ou sobrescrever o valor."
    });
    if (result.outcome === "not_found") {
      return res.status(404).json({
        ok: false,
        error: "Indicação não encontrada.",
      });
    }

    return res.json({
      ok: true,
      data: result.row,
    });
  } catch (err) {
    console.error("[referrals] confirmação por OS não concluída; verifique a integração.");
    return res.status(500).json({
      ok: false,
      error: "Erro interno ao atualizar indicação.",
    });
  }
});

module.exports = router;
