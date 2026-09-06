"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const auth = require("../middleware/referralAuth");
const { dbMain, dbMarketplace } = require("../db");
const { liveIdentity, phone: canonicalPhone } = require("../lib/referralGuard");
const { MEDIA_ROOT, TMP_ROOT, ensureStorage, processUpload } = require("../lib/marketplaceMedia");

const router = express.Router();
const CATEGORIES = new Set(["consoles", "jogos", "controles", "acessorios", "computadores", "componentes", "colecionaveis", "outros"]);
const CONDITIONS = new Set(["used_like_new", "used_good", "used_fair"]);
const REPORT_REASONS = new Set(["fraude", "proibido", "duplicado", "informacao_incorreta", "outro"]);
const PUBLIC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MEDIA_NAME = /^[0-9a-f-]{36}(?:-poster)?\.(?:jpg|mp4)$/;
const MEDIA_BASE = (process.env.MARKETPLACE_MEDIA_BASE_URL || "https://app.lzgames.com.br/api/marketplace/media").replace(/\/$/, "");
const reads = new Map();
let activeUploads = 0;
let expirySweepAt = 0;
let expirySweepPromise = null;

class MarketplaceError extends Error {
  constructor(code, message, status = 422) { super(message); this.code = code; this.status = status; }
}

function safe(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function oneLine(value, max, label) {
  if (typeof value !== "string") throw new MarketplaceError("INVALID_FIELD", `${label} inválido.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new MarketplaceError("INVALID_FIELD", `${label} deve ter entre 1 e ${max} caracteres.`);
  return clean;
}

function paragraph(value, max) {
  if (typeof value !== "string") throw new MarketplaceError("INVALID_DESCRIPTION", "Descrição inválida.");
  const clean = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (clean.length < 10 || clean.length > max) throw new MarketplaceError("INVALID_DESCRIPTION", `A descrição deve ter entre 10 e ${max} caracteres.`);
  return clean;
}

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max) {
    throw new MarketplaceError("INVALID_FIELD", `${label} inválido.`);
  }
  return Number(value);
}

function publicId(value) {
  if (typeof value !== "string" || !PUBLIC_ID.test(value)) throw new MarketplaceError("INVALID_ID", "Anúncio inválido.", 400);
  return value;
}

function escapeLike(value) {
  return value.replace(/=/g, "==").replace(/%/g, "=%").replace(/_/g, "=_");
}

function mediaUrl(productPublicId, name) {
  return `${MEDIA_BASE}/${productPublicId}/${name}`;
}

function serializeMedia(row, productPublicId) {
  return {
    id: Number(row.id), kind: row.kind, position: Number(row.position),
    url: mediaUrl(productPublicId, row.storage_name),
    posterUrl: row.poster_name ? mediaUrl(productPublicId, row.poster_name) : null,
    width: row.width === null ? null : Number(row.width), height: row.height === null ? null : Number(row.height),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
  };
}

function serializeProduct(row, media = [], actorId = null) {
  return {
    id: row.public_id, title: row.title, description: row.description, category: row.category,
    condition: row.item_condition, priceCents: Number(row.price_cents), city: row.city, state: row.state,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
    seller: { id: String(row.seller_customer_id), name: row.display_name || "Cliente LZ-GAMES" },
    isMine: actorId !== null && String(row.seller_customer_id) === String(actorId),
    media: media.map(item => serializeMedia(item, row.public_id)),
  };
}

async function attachMedia(rows, actorId = null) {
  if (!rows.length) return [];
  const marks = rows.map(() => "?").join(",");
  const [media] = await dbMarketplace.query({sql:`SELECT pm.*,p.public_id FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE pm.product_id IN (${marks}) ORDER BY pm.product_id,pm.position`,timeout:5000}, rows.map(row => row.id));
  const grouped = new Map();
  for (const item of media) {
    const key = String(item.product_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return rows.map(row => serializeProduct(row, grouped.get(String(row.id)) || [], actorId));
}

async function actor(req, res, next) {
  try {
    if (!dbMain || !dbMarketplace) throw new MarketplaceError("MARKETPLACE_UNAVAILABLE", "A loja está temporariamente indisponível.", 503);
    const person = await liveIdentity(dbMain, req.user?.sub, req.user);
    req.marketplaceActor = { id: person.id, name: String(person.name || "Cliente LZ-GAMES").slice(0, 120), phone: person.primary };
    await dbMarketplace.query({sql:`INSERT INTO marketplace_profiles(customer_id,display_name) VALUES(?,?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)`,timeout:5000}, [person.id, req.marketplaceActor.name]);
    next();
  } catch (error) { next(error); }
}

function readRate(req, res, next) {
  const now = Date.now();
  const key = `${req.marketplaceActor.id}:${String(req.ip).slice(0, 80)}`;
  const current = reads.get(key);
  if (!current || current.until <= now) reads.set(key, { hits: 1, until: now + 60000 });
  else if (++current.hits > 180) return next(new MarketplaceError("RATE_LIMIT", "Muitas consultas. Aguarde um minuto.", 429));
  if (reads.size > 5000) for (const [entry, value] of reads) if (value.until <= now) reads.delete(entry);
  next();
}

async function contact(customerId) {
  const [rows] = await dbMain.query({sql:"SELECT id,nome,telefone,telefone2 FROM clientes WHERE id=? LIMIT 1",timeout:5000}, [customerId]);
  if (rows.length !== 1) return null;
  const whatsapp = canonicalPhone(rows[0].telefone) || canonicalPhone(rows[0].telefone2);
  return whatsapp ? { name: String(rows[0].nome || "Cliente LZ-GAMES"), whatsapp } : null;
}

async function audit(actorId, action, type, resourceId, metadata = null, connection = dbMarketplace) {
  await connection.query({sql:"INSERT INTO marketplace_audit(actor_customer_id,action,resource_type,resource_id,metadata_json) VALUES(?,?,?,?,?)",timeout:5000},
    [actorId, action, type, String(resourceId).slice(0, 64), metadata ? JSON.stringify(metadata) : null]);
}

async function releaseExpiredReservations() {
  const now=Date.now();
  if (now-expirySweepAt<60000) return;
  if (expirySweepPromise) return expirySweepPromise;
  expirySweepPromise=(async()=>{
    const connection=await dbMarketplace.getConnection();
    try{
      await connection.beginTransaction();
      const [rows]=await connection.query({sql:`SELECT pr.id,p.id product_id FROM purchase_requests pr JOIN products p ON p.id=pr.product_id
        WHERE pr.status='requested' AND pr.expires_at<=UTC_TIMESTAMP(6) AND p.status='reserved' ORDER BY pr.id LIMIT 100 FOR UPDATE`,timeout:5000});
      if(rows.length){
        const orderMarks=rows.map(()=>'?').join(','),productIds=[...new Set(rows.map(row=>row.product_id))],productMarks=productIds.map(()=>'?').join(',');
        await connection.query({sql:`UPDATE purchase_requests SET status='cancelled' WHERE id IN (${orderMarks}) AND status='requested'`,timeout:5000},rows.map(row=>row.id));
        await connection.query({sql:`UPDATE products SET status='active',version=version+1 WHERE id IN (${productMarks}) AND status='reserved'`,timeout:5000},productIds);
      }
      await connection.commit();expirySweepAt=Date.now();
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  })().finally(()=>{expirySweepPromise=null;});
  return expirySweepPromise;
}

function filesFrom(req) {
  const grouped = req.files || {};
  const photos = Array.isArray(grouped.photos) ? grouped.photos : [];
  const videos = Array.isArray(grouped.video) ? grouped.video : [];
  if (photos.length < 1 || photos.length > 5 || videos.length > 1) throw new MarketplaceError("MEDIA_REQUIRED", "Envie de uma a cinco fotos e, opcionalmente, um vídeo.");
  const all = [...photos, ...videos];
  const total = all.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (total > 45 * 1024 * 1024) throw new MarketplaceError("MEDIA_TOO_LARGE", "Fotos e vídeo juntos devem ter no máximo 45 MB.", 413);
  return { photos, video: videos[0] || null, all };
}

const upload = multer({
  dest: TMP_ROOT,
  limits: { files: 6, fileSize: 35 * 1024 * 1024, fields: 12, fieldSize: 8192, parts: 18 },
  fileFilter(req, file, callback) {
    const images = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
    const videos = new Set(["video/mp4", "video/quicktime", "video/webm", "video/3gpp"]);
    if (file.fieldname === "photos" && images.has(file.mimetype)) return callback(null, true);
    if (file.fieldname === "video" && videos.has(file.mimetype)) return callback(null, true);
    callback(new MarketplaceError("MEDIA_TYPE_INVALID", "Use fotos JPG, PNG, WEBP ou HEIC e vídeo MP4, MOV ou WEBM."));
  },
});

function multipart(req, res, next) {
  upload.fields([{name:"photos",maxCount:5},{name:"video",maxCount:1}])(req, res, async error => {
    if (!error) return next();
    await cleanupRaw(Object.values(req.files || {}).flat());
    if (error instanceof multer.MulterError && ["LIMIT_FILE_SIZE", "LIMIT_FILE_COUNT", "LIMIT_PART_COUNT"].includes(error.code)) {
      return next(new MarketplaceError("MEDIA_TOO_LARGE", "O envio ultrapassou o limite de seis arquivos e 45 MB.", 413));
    }
    if (error instanceof multer.MulterError) return next(new MarketplaceError("MEDIA_INVALID", "A seleção de fotos ou vídeo é inválida.", 400));
    next(error);
  });
}

async function cleanupRaw(files) {
  await Promise.all((files || []).map(file => fs.rm(file.path, {force:true}).catch(() => {})));
}

router.get("/media/:productId/:file", safe(async (req, res) => {
  if (!dbMarketplace) throw new MarketplaceError("MARKETPLACE_UNAVAILABLE", "Mídia indisponível.", 503);
  const id = publicId(req.params.productId);
  const file = req.params.file;
  if (!MEDIA_NAME.test(file)) throw new MarketplaceError("MEDIA_NOT_FOUND", "Mídia não encontrada.", 404);
  const [rows] = await dbMarketplace.query({sql:`SELECT pm.kind,pm.poster_name FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE p.public_id=? AND (pm.storage_name=? OR pm.poster_name=?) LIMIT 1`,timeout:5000}, [id,file,file]);
  if (!rows.length) throw new MarketplaceError("MEDIA_NOT_FOUND", "Mídia não encontrada.", 404);
  const full = path.join(MEDIA_ROOT, id, file);
  await fs.access(full);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.set("Cross-Origin-Resource-Policy", "same-site");
  res.type(file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
  await new Promise((resolve,reject)=>res.sendFile(full,error=>error?reject(error):resolve()));
}));

router.use(auth, actor, safe(async(req,res,next)=>{await releaseExpiredReservations();next();}), readRate);

router.get("/products", safe(async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const category = typeof req.query.category === "string" && CATEGORIES.has(req.query.category) ? req.query.category : "";
  const condition = typeof req.query.condition === "string" && CONDITIONS.has(req.query.condition) ? req.query.condition : "";
  const cursor = req.query.cursor ? positiveInteger(req.query.cursor, "Página") : null;
  const values = [];
  const where = ["p.status='active'", "p.deleted_at IS NULL"];
  if (query) { const like = `%${escapeLike(query)}%`; where.push("(p.title LIKE ? ESCAPE '=' OR p.description LIKE ? ESCAPE '=')"); values.push(like, like); }
  if (category) { where.push("p.category=?"); values.push(category); }
  if (condition) { where.push("p.item_condition=?"); values.push(condition); }
  if (cursor) { where.push("p.id<?"); values.push(cursor); }
  values.push(21);
  const [rows] = await dbMarketplace.query({sql:`SELECT p.*,mp.display_name FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE ${where.join(" AND ")} ORDER BY p.id DESC LIMIT ?`,timeout:7000}, values);
  const hasMore = rows.length > 20;
  const page = rows.slice(0, 20);
  res.set("Cache-Control", "private, no-store");
  res.json({ok:true,data:await attachMedia(page,req.marketplaceActor.id),nextCursor:hasMore ? String(page[page.length-1].id) : null});
}));

router.get("/products/:productId", safe(async (req, res) => {
  const id = publicId(req.params.productId);
  const [rows] = await dbMarketplace.query({sql:`SELECT p.*,mp.display_name FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id
    WHERE p.public_id=? AND p.deleted_at IS NULL AND (p.status='active' OR p.seller_customer_id=? OR EXISTS(SELECT 1 FROM purchase_requests pr WHERE pr.product_id=p.id AND pr.buyer_customer_id=?)) LIMIT 1`,timeout:5000}, [id,req.marketplaceActor.id,req.marketplaceActor.id]);
  if (!rows.length) throw new MarketplaceError("PRODUCT_NOT_FOUND", "Anúncio não encontrado.", 404);
  res.set("Cache-Control", "private, no-store");
  res.json({ok:true,data:(await attachMedia(rows,req.marketplaceActor.id))[0]});
}));

router.post("/products", safe(async (req,res,next)=>{ await ensureStorage(); next(); }), multipart, safe(async (req, res) => {
  let parsed;
  try { parsed = filesFrom(req); }
  catch (error) { await cleanupRaw(Object.values(req.files || {}).flat()); throw error; }
  const { photos, video, all } = parsed;
  let outputDir = null;
  let uploadSlot = false;
  try {
    if (activeUploads >= 2) throw new MarketplaceError("UPLOAD_BUSY", "Há outros vídeos sendo processados. Tente novamente em instantes.", 503);
    const [recent] = await dbMarketplace.query({sql:"SELECT COUNT(*) amount FROM products WHERE seller_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR)",timeout:5000}, [req.marketplaceActor.id]);
    if (Number(recent[0]?.amount) >= 15) throw new MarketplaceError("PRODUCT_DAILY_LIMIT", "Limite diário de anúncios atingido.", 429);
    const title = oneLine(req.body.title, 80, "Título");
    const description = paragraph(req.body.description, 2000);
    const category = CATEGORIES.has(req.body.category) ? req.body.category : (() => { throw new MarketplaceError("INVALID_CATEGORY", "Categoria inválida."); })();
    const condition = CONDITIONS.has(req.body.condition) ? req.body.condition : (() => { throw new MarketplaceError("INVALID_CONDITION", "Informe o estado de conservação."); })();
    const priceCents = positiveInteger(req.body.priceCents, "Preço", 100000000);
    const city = oneLine(req.body.city, 80, "Cidade");
    const state = oneLine(req.body.state, 2, "UF").toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw new MarketplaceError("INVALID_STATE", "Informe uma UF válida.");
    const id = crypto.randomUUID();
    activeUploads += 1;
    uploadSlot = true;
    const processed = await processUpload({photos,video}, id);
    outputDir = processed.outputDir;
    const connection = await dbMarketplace.getConnection();
    try {
      await connection.beginTransaction();
      const [created] = await connection.query({sql:`INSERT INTO products(public_id,seller_customer_id,title,description,category,item_condition,price_cents,city,state) VALUES(?,?,?,?,?,?,?,?,?)`,timeout:5000}, [id,req.marketplaceActor.id,title,description,category,condition,priceCents,city,state]);
      for (const media of processed.media) await connection.query({sql:`INSERT INTO product_media(product_id,kind,storage_name,poster_name,position,width,height,duration_ms,bytes) VALUES(?,?,?,?,?,?,?,?,?)`,timeout:5000}, [created.insertId,media.kind,media.storageName,media.posterName,media.position,media.width,media.height,media.durationMs,media.bytes]);
      await audit(req.marketplaceActor.id,"product_created","product",id,{media:processed.media.length},connection);
      await connection.commit();
      outputDir = null;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    const [rows] = await dbMarketplace.query({sql:"SELECT p.*,mp.display_name FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE p.public_id=?",timeout:5000}, [id]);
    res.status(201).json({ok:true,data:(await attachMedia(rows,req.marketplaceActor.id))[0]});
  } catch (error) {
    if (outputDir) await fs.rm(outputDir,{recursive:true,force:true}).catch(()=>{});
    if (String(error.message).startsWith("MEDIA_")) throw new MarketplaceError("MEDIA_INVALID", error.message === "MEDIA_VIDEO_DURATION_INVALID" ? "O vídeo deve ter no máximo 30 segundos." : "Uma das mídias não pôde ser validada. Escolha outro arquivo.");
    throw error;
  } finally { if (uploadSlot) activeUploads -= 1; await cleanupRaw(all); }
}));

router.get("/me/products", safe(async (req, res) => {
  const [rows] = await dbMarketplace.query({sql:`SELECT p.*,mp.display_name FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE p.seller_customer_id=? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 100`,timeout:7000}, [req.marketplaceActor.id]);
  res.set("Cache-Control", "private, no-store");
  res.json({ok:true,data:await attachMedia(rows,req.marketplaceActor.id)});
}));

router.patch("/products/:productId/status", safe(async (req, res) => {
  const id = publicId(req.params.productId);
  const desired = req.body?.status;
  if (!["active","paused","closed"].includes(desired)) throw new MarketplaceError("INVALID_STATUS", "Estado do anúncio inválido.");
  const connection = await dbMarketplace.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query({sql:"SELECT id,status FROM products WHERE public_id=? AND seller_customer_id=? AND deleted_at IS NULL FOR UPDATE",timeout:5000}, [id,req.marketplaceActor.id]);
    if (!rows.length) throw new MarketplaceError("PRODUCT_NOT_FOUND", "Anúncio não encontrado.",404);
    if (["reserved","sold"].includes(rows[0].status)) throw new MarketplaceError("PRODUCT_LOCKED", "Este anúncio possui uma negociação em andamento ou já foi vendido.",409);
    if (rows[0].status === "closed" && desired !== "closed") throw new MarketplaceError("PRODUCT_CLOSED", "Um anúncio encerrado não pode ser reativado.",409);
    await connection.query({sql:"UPDATE products SET status=?,version=version+1 WHERE id=?",timeout:5000}, [desired,rows[0].id]);
    await audit(req.marketplaceActor.id,"product_status_changed","product",id,{from:rows[0].status,to:desired},connection);
    await connection.commit();
    res.json({ok:true,data:{id,status:desired}});
  } catch(error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.post("/products/:productId/purchase", safe(async (req, res) => {
  const id = publicId(req.params.productId);
  const [recent] = await dbMarketplace.query({sql:"SELECT COUNT(*) amount FROM purchase_requests WHERE buyer_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR)",timeout:5000}, [req.marketplaceActor.id]);
  if (Number(recent[0]?.amount) >= 20) throw new MarketplaceError("PURCHASE_RATE_LIMIT", "Muitas solicitações de compra. Aguarde antes de tentar novamente.",429);
  const connection = await dbMarketplace.getConnection();
  let order;
  try {
    await connection.beginTransaction();
    const [products] = await connection.query({sql:"SELECT * FROM products WHERE public_id=? AND deleted_at IS NULL FOR UPDATE",timeout:5000}, [id]);
    const product = products[0];
    if (!product) throw new MarketplaceError("PRODUCT_NOT_FOUND","Anúncio não encontrado.",404);
    if (String(product.seller_customer_id) === req.marketplaceActor.id) throw new MarketplaceError("OWN_PRODUCT","Você não pode comprar seu próprio anúncio.",409);
    if (product.status !== "active") throw new MarketplaceError("PRODUCT_UNAVAILABLE","Este produto não está mais disponível.",409);
    const [open] = await connection.query({sql:"SELECT COUNT(*) amount FROM purchase_requests WHERE buyer_customer_id=? AND status='requested' AND expires_at>UTC_TIMESTAMP(6)",timeout:5000},[req.marketplaceActor.id]);
    if(Number(open[0]?.amount)>=5)throw new MarketplaceError("OPEN_PURCHASE_LIMIT","Você já possui cinco reservas abertas. Conclua ou cancele uma delas antes de reservar outro produto.",429);
    const publicCode = `LZ${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
    const expiresAt=new Date(Date.now()+24*60*60*1000);
    const [created] = await connection.query({sql:`INSERT INTO purchase_requests(public_code,product_id,buyer_customer_id,seller_customer_id,amount_cents,expires_at) VALUES(?,?,?,?,?,?)`,timeout:5000}, [publicCode,product.id,req.marketplaceActor.id,product.seller_customer_id,product.price_cents,expiresAt]);
    await connection.query({sql:"UPDATE products SET status='reserved',version=version+1 WHERE id=? AND status='active'",timeout:5000}, [product.id]);
    await audit(req.marketplaceActor.id,"purchase_requested","purchase",publicCode,{product:id},connection);
    await connection.commit();
    order={publicCode,status:"requested",sellerCustomerId:product.seller_customer_id,productTitle:product.title,amountCents:Number(product.price_cents),expiresAt:expiresAt.toISOString()};
  } catch(error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  res.status(201).json({ok:true,data:{...order,seller:await contact(order.sellerCustomerId)}});
}));

router.get("/me/orders", safe(async (req,res) => {
  const [rows] = await dbMarketplace.query({sql:`SELECT pr.*,p.public_id product_public_id,p.title,p.status product_status,
    seller.display_name seller_name,buyer.display_name buyer_name FROM purchase_requests pr JOIN products p ON p.id=pr.product_id
    JOIN marketplace_profiles seller ON seller.customer_id=pr.seller_customer_id JOIN marketplace_profiles buyer ON buyer.customer_id=pr.buyer_customer_id
    WHERE pr.buyer_customer_id=? OR pr.seller_customer_id=? ORDER BY pr.id DESC LIMIT 100`,timeout:7000}, [req.marketplaceActor.id,req.marketplaceActor.id]);
  const involved = [...new Set(rows.map(row => String(row.buyer_customer_id) === req.marketplaceActor.id ? row.seller_customer_id : row.buyer_customer_id))];
  const contacts = new Map();
  await Promise.all(involved.map(async customerId => contacts.set(String(customerId),await contact(customerId))));
  res.set("Cache-Control","private, no-store");
  res.json({ok:true,data:rows.map(row=>{
    const selling=String(row.seller_customer_id)===req.marketplaceActor.id;
    const otherId=selling?row.buyer_customer_id:row.seller_customer_id;
    return {id:row.public_code,productId:row.product_public_id,productTitle:row.title,amountCents:Number(row.amount_cents),status:row.status,productStatus:row.product_status,role:selling?"seller":"buyer",other:contacts.get(String(otherId)),expiresAt:row.expires_at,createdAt:row.created_at,updatedAt:row.updated_at};
  })});
}));

router.patch("/orders/:code", safe(async (req,res) => {
  const code=typeof req.params.code==="string"&&/^LZ[A-F0-9]{18}$/.test(req.params.code)?req.params.code:"";
  if(!code)throw new MarketplaceError("INVALID_ORDER","Negociação inválida.",400);
  const action=req.body?.action;
  if(!["accept","reject","cancel","complete"].includes(action))throw new MarketplaceError("INVALID_ACTION","Ação inválida.");
  const connection=await dbMarketplace.getConnection();
  try{
    await connection.beginTransaction();
    const [rows]=await connection.query({sql:`SELECT pr.*,p.status product_status FROM purchase_requests pr JOIN products p ON p.id=pr.product_id WHERE pr.public_code=? FOR UPDATE`,timeout:5000},[code]);
    const order=rows[0];
    if(!order)throw new MarketplaceError("ORDER_NOT_FOUND","Negociação não encontrada.",404);
    const seller=String(order.seller_customer_id)===req.marketplaceActor.id,buyer=String(order.buyer_customer_id)===req.marketplaceActor.id;
    let next,productStatus=null;
    if(action==="accept"&&seller&&order.status==="requested"&&order.product_status==="reserved"){next="accepted";productStatus="sold";}
    else if(action==="reject"&&seller&&order.status==="requested"){next="rejected";productStatus="active";}
    else if(action==="cancel"&&buyer&&order.status==="requested"){next="cancelled";productStatus="active";}
    else if(action==="complete"&&(buyer||seller)&&order.status==="accepted"){next="completed";}
    else throw new MarketplaceError("ORDER_ACTION_NOT_ALLOWED","Esta ação não está disponível para a negociação.",409);
    await connection.query({sql:"UPDATE purchase_requests SET status=? WHERE id=?",timeout:5000},[next,order.id]);
    if(productStatus)await connection.query({sql:"UPDATE products SET status=?,version=version+1 WHERE id=?",timeout:5000},[productStatus,order.product_id]);
    await audit(req.marketplaceActor.id,`purchase_${action}`,"purchase",code,null,connection);
    await connection.commit();
    res.json({ok:true,data:{id:code,status:next}});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));

router.post("/products/:productId/report", safe(async(req,res)=>{
  const id=publicId(req.params.productId),reason=req.body?.reason,details=typeof req.body?.details==="string"?req.body.details.trim().slice(0,500):"";
  if(!REPORT_REASONS.has(reason))throw new MarketplaceError("INVALID_REPORT","Motivo da denúncia inválido.");
  const [products]=await dbMarketplace.query({sql:"SELECT id,seller_customer_id FROM products WHERE public_id=? AND deleted_at IS NULL LIMIT 1",timeout:5000},[id]);
  if(!products.length)throw new MarketplaceError("PRODUCT_NOT_FOUND","Anúncio não encontrado.",404);
  if(String(products[0].seller_customer_id)===req.marketplaceActor.id)throw new MarketplaceError("OWN_PRODUCT","Você não pode denunciar seu próprio anúncio.",409);
  await dbMarketplace.query({sql:`INSERT INTO product_reports(product_id,reporter_customer_id,reason,details) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason),details=VALUES(details),created_at=CURRENT_TIMESTAMP(6)`,timeout:5000},[products[0].id,req.marketplaceActor.id,reason,details]);
  await audit(req.marketplaceActor.id,"product_reported","product",id,{reason});
  res.status(201).json({ok:true});
}));

router.use(async (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const safeError = error instanceof MarketplaceError ? error : null;
  if (!safeError) console.error("[marketplace]", error);
  const status = safeError?.status || 500;
  if (status === 429) res.set("Retry-After", "60");
  res.set("Cache-Control", "no-store");
  res.status(status).json({ok:false,code:safeError?.code || "MARKETPLACE_FAILURE",error:safeError?.message || "Não foi possível concluir a operação agora."});
});

ensureStorage().catch(error => console.error("[marketplace] storage unavailable", error));
module.exports = router;
