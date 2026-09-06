// api/routes/orders.js
const express = require("express");
const { dbMain } = require("../db");
const auth = require("../middleware/auth");
const { normalizePhoneKey, buildPhoneVariants } = require("../lib/phoneUtils");
const { getLinkedUserFromRequestUser } = require("../lib/userLinkService");

const router = express.Router();

function defaultGamificacao() {
  return {
    pontos_total: 0,
    pontos_disponiveis: 0,
    nivel: 1,
    nivel_label: "bronze",
    xp_percent: 0,
  };
}

function defaultStats() {
  return {
    agendamentos_total: 0,
    agendamentos_proximos: 0,
    cupons_total: 0,
    numeros_sorte: 0,
    indicacoes: 0,
    cashback_aprovado: 0,
  };
}

const CLEAN_PHONE_SQL = (colSql) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${colSql}, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')`;

async function loadOrdersByPhoneKey(telefoneKey) {
  if (!dbMain) return [];
  if (!telefoneKey) return [];

  const variants = buildPhoneVariants(telefoneKey);
  const patterns = variants.map((v) => `%${v}`);

  const colTelefone = CLEAN_PHONE_SQL("telefone");

  const whereParts = [];
  const params = [];

  for (const p of patterns) {
    whereParts.push(`${colTelefone} LIKE ?`);
    params.push(p);
  }

  const sql = `
    SELECT v.*, COALESCE(ac.amount_cents,0) AS app_credit_centavos
    FROM vw_os_portal_cliente v
    LEFT JOIN lz_app_credit_os ac ON ac.os_id=v.os_id
    WHERE (${whereParts.join(" OR ")})
    ORDER BY v.data_entrada DESC, v.os_id DESC
    LIMIT 500
  `;

  const [rows] = await dbMain.query(sql, params);
  return rows || [];
}

async function loadGamificacaoFromReqUser(reqUser) {
  let gamificacao = defaultGamificacao();
  let stats = defaultStats();

  if (!reqUser) return { gamificacao, stats };

  try {
    const linked = await getLinkedUserFromRequestUser(reqUser);

    if (linked && linked.gamificacao) {
      gamificacao = { ...gamificacao, ...linked.gamificacao };
    } else if (reqUser.gamificacao) {
      gamificacao = { ...gamificacao, ...reqUser.gamificacao };
    }

    if (linked && linked.stats) {
      stats = { ...stats, ...linked.stats };
    }

    return { gamificacao, stats };
  } catch (error) {
    console.error("[orders] Erro ao carregar overview de gamificação/cashback:", error);
    return { gamificacao, stats };
  }
}

router.get("/me/orders", auth, async (req, res) => {
  try {
    const telefoneKey = normalizePhoneKey(req.user.telefone_normalizado || req.user.telefone);

    const [orders, overview] = await Promise.all([
      loadOrdersByPhoneKey(telefoneKey),
      loadGamificacaoFromReqUser(req.user),
    ]);

    return res.json({
      ok: true,
      orders,
      gamificacao: overview.gamificacao,
      stats: overview.stats,
    });
  } catch (err) {
    console.error("[orders] erro em /me/orders:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro interno ao carregar ordens de serviço.",
      error: err.message || String(err),
    });
  }
});

router.get("/orders", auth, async (req, res) => {
  try {
    const telefoneParam = req.query.telefone || req.query.phone;
    const telefoneKey = normalizePhoneKey(telefoneParam);

    if (!telefoneKey) return res.json([]);

    const orders = await loadOrdersByPhoneKey(telefoneKey);
    return res.json(orders);
  } catch (err) {
    console.error("[orders] erro em /orders:", err);
    return res.status(500).json({
      ok: false,
      message: "Erro interno ao carregar ordens de serviço.",
      error: err.message || String(err),
    });
  }
});

module.exports = router;
