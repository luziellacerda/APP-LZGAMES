"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const path = require("node:path");
const express = require("express");
const multer = require("multer");
const auth = require("../middleware/referralAuth");
const { dbMain, dbMarketplace } = require("../db");
const { liveIdentity, phone: canonicalPhone, GuardError } = require("../lib/referralGuard");
const { MEDIA_ROOT, TMP_ROOT, ensureStorage, processUpload } = require("../lib/marketplaceMedia");
const { MarketplaceError, TERMS_VERSION, STATES, assertVisible, orderTransition } = require("../lib/marketplacePolicy");

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

function safe(handler) {
  return (req, res, next) => (async()=>{
    for(let attempt=0;;attempt++){
      try{return await handler(req,res,next);}
      catch(error){
        // InnoDB can invalidate a locking read during contention. Transactions below
        // rollback before reaching here; retry only before any response or file upload.
        if(attempt<2&&!res.headersSent&&!req.files&&['ER_CHECKREAD','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)){
          await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));continue;
        }
        throw error;
      }
    }
  })().catch(next);
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
    status: row.status, version: Number(row.version), moderationStatus: row.moderation_status,
    moderationReason: actorId !== null && String(row.seller_customer_id) === String(actorId) ? row.moderation_reason : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
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
    const [profiles] = await dbMarketplace.query({sql:"SELECT suspended FROM marketplace_profiles WHERE customer_id=?",timeout:5000}, [person.id]);
    if (Number(profiles[0]?.suspended) && !["GET","HEAD"].includes(req.method)) {
      throw new MarketplaceError("MARKETPLACE_SUSPENDED", "Sua conta de vendas está suspensa. Entre em contato com a LZ-GAMES.", 403);
    }
    next();
  } catch (error) {
    if(error instanceof GuardError)return next(new MarketplaceError(error.code, error.status===401?"Seu cadastro foi alterado. Saia e entre novamente.":"Não foi possível validar sua conta de vendas. Confira o telefone e o CPF com a LZ-GAMES.",error.status));
    next(error);
  }
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

async function notice(connection, customerId, title, message, orderCode = null) {
  await connection.query({sql:"INSERT INTO marketplace_notices(customer_id,title,message,order_code) VALUES(?,?,?,?)",timeout:5000}, [customerId,title,message,orderCode]);
}

async function blocked(connection, first, second) {
  const [rows] = await connection.query({sql:"SELECT 1 FROM marketplace_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?) LIMIT 1",timeout:5000}, [first,second,second,first]);
  return rows.length > 0;
}

function productInput(body) {
  const title = oneLine(body.title,80,"Título"), description = paragraph(body.description,2000);
  if (!CATEGORIES.has(body.category)) throw new MarketplaceError("INVALID_CATEGORY","Categoria inválida.");
  if (!CONDITIONS.has(body.condition)) throw new MarketplaceError("INVALID_CONDITION","Informe o estado de conservação.");
  const priceCents = positiveInteger(body.priceCents,"Preço",100000000), city=oneLine(body.city,80,"Cidade"), state=oneLine(body.state,2,"UF").toUpperCase();
  if (!STATES.has(state)) throw new MarketplaceError("INVALID_STATE","Informe uma UF brasileira válida.");
  return {title,description,category:body.category,condition:body.condition,priceCents,city,state};
}

async function fingerprint(input, files) {
  const hash=crypto.createHash("sha256").update(JSON.stringify(input));
  for (const file of files) {
    const fileHash=crypto.createHash("sha256");
    for await (const chunk of createReadStream(file.path)) fileHash.update(chunk);
    hash.update(file.fieldname+":"+fileHash.digest("hex"));
  }
  return hash.digest("hex");
}

// Bound intake before multer writes to disk, including uploads that never reach ffmpeg.
function uploadSlot(req,res,next) {
  if (activeUploads >= 2) return next(new MarketplaceError("UPLOAD_BUSY","Há outros envios em processamento. Tente novamente em instantes.",503));
  activeUploads += 1;
  let released=false;
  req.releaseUpload=()=>{if(!released){released=true;activeUploads-=1;}};
  next();
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

const diskStorage=multer.diskStorage({destination:TMP_ROOT});
const boundedStorage={
  _handleFile(req,file,callback){
    file.stream.pause();
    file.stream.on('data',chunk=>{req.mediaBytes=(req.mediaBytes||0)+chunk.length;if(req.mediaBytes>45*1024*1024)file.stream.destroy(new MarketplaceError("MEDIA_TOO_LARGE","Fotos e vídeo juntos devem ter no máximo 45 MB.",413));});
    diskStorage._handleFile(req,file,callback);
  },
  _removeFile(req,file,callback){diskStorage._removeFile(req,file,callback);},
};
const upload = multer({
  storage: boundedStorage,
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
  const [rows] = await dbMarketplace.query({sql:`SELECT pm.kind,pm.poster_name FROM product_media pm JOIN products p ON p.id=pm.product_id JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE p.public_id=? AND p.deleted_at IS NULL AND p.moderation_status='visible' AND mp.suspended=0 AND (pm.storage_name=? OR pm.poster_name=?) LIMIT 1`,timeout:5000}, [id,file,file]);
  if (!rows.length) throw new MarketplaceError("MEDIA_NOT_FOUND", "Mídia não encontrada.", 404);
  const full = path.join(MEDIA_ROOT, id, file);
  await fs.access(full);
  res.set("Cache-Control", "no-store");
  res.set("Cross-Origin-Resource-Policy", "same-site");
  res.type(file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
  await new Promise((resolve,reject)=>res.sendFile(full,error=>error?reject(error):resolve()));
}));

router.use(auth, actor, safe(async(req,res,next)=>{await releaseExpiredReservations();next();}), readRate);
router.use((req,res,next)=>{res.set("Cache-Control","private, no-store");next();});

router.get("/products", safe(async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const category = typeof req.query.category === "string" && CATEGORIES.has(req.query.category) ? req.query.category : "";
  const condition = typeof req.query.condition === "string" && CONDITIONS.has(req.query.condition) ? req.query.condition : "";
  const cursor = req.query.cursor ? positiveInteger(req.query.cursor, "Página") : null;
  const values = [req.marketplaceActor.id,req.marketplaceActor.id];
  const where = ["p.status='active'", "p.deleted_at IS NULL", "p.moderation_status='visible'", "mp.suspended=0", "NOT EXISTS(SELECT 1 FROM marketplace_blocks b WHERE (b.blocker_id=? AND b.blocked_id=p.seller_customer_id) OR (b.blocked_id=? AND b.blocker_id=p.seller_customer_id))"];
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
  if (String(rows[0].seller_customer_id) !== String(req.marketplaceActor.id)) {
    const [seller]=await dbMarketplace.query({sql:"SELECT suspended FROM marketplace_profiles WHERE customer_id=?",timeout:5000},[rows[0].seller_customer_id]);
    assertVisible({...rows[0],seller_suspended:seller[0]?.suspended});
    if(await blocked(dbMarketplace,req.marketplaceActor.id,rows[0].seller_customer_id))throw new MarketplaceError("PRODUCT_NOT_FOUND","Anúncio não encontrado.",404);
  }
  res.set("Cache-Control", "private, no-store");
  res.json({ok:true,data:(await attachMedia(rows,req.marketplaceActor.id))[0]});
}));

router.post("/products", uploadSlot, safe(async (req,res,next)=>{ await ensureStorage(); next(); }), multipart, safe(async (req, res) => {
  let parsed;
  try { parsed = filesFrom(req); }
  catch (error) { await cleanupRaw(Object.values(req.files || {}).flat()); throw error; }
  const { photos, video, all } = parsed;
  let outputDir = null;
  try {
    if(req.body.termsVersion!==TERMS_VERSION)throw new MarketplaceError("TERMS_REQUIRED","Atualize o aplicativo e aceite as regras de publicação antes de anunciar.",426);
    const requestKey=req.body.requestKey;
    if(typeof requestKey!=="string"||!/^lz_[A-Za-z0-9_-]{24,76}$/.test(requestKey))throw new MarketplaceError("REQUEST_KEY_REQUIRED","Atualize o aplicativo para publicar com segurança.",426);
    const input=productInput(req.body);
    const requestHash=await fingerprint(input,all);
    const [existing]=await dbMarketplace.query({sql:"SELECT p.*,mp.display_name FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE p.seller_customer_id=? AND p.request_key=?",timeout:5000},[req.marketplaceActor.id,requestKey]);
    if(existing.length){
      if(existing[0].request_hash!==requestHash)throw new MarketplaceError("REQUEST_CONFLICT","Este envio já foi utilizado com outro conteúdo. Confira Meus anúncios.",409);
      return res.json({ok:true,replayed:true,data:(await attachMedia(existing,req.marketplaceActor.id))[0]});
    }
    const [recent] = await dbMarketplace.query({sql:"SELECT COUNT(*) amount FROM products WHERE seller_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR)",timeout:5000}, [req.marketplaceActor.id]);
    if (Number(recent[0]?.amount) >= 15) throw new MarketplaceError("PRODUCT_DAILY_LIMIT", "Limite diário de anúncios atingido.", 429);
    const {title,description,category,condition,priceCents,city,state}=input;
    const id = crypto.randomUUID();
    const processed = await processUpload({photos,video}, id);
    outputDir = processed.outputDir;
    const connection = await dbMarketplace.getConnection();
    try {
      await connection.beginTransaction();
      const [profile]=await connection.query({sql:"SELECT suspended FROM marketplace_profiles WHERE customer_id=? FOR UPDATE",timeout:5000},[req.marketplaceActor.id]);
      if(Number(profile[0]?.suspended))throw new MarketplaceError("MARKETPLACE_SUSPENDED","Conta de vendas suspensa.",403);
      const [duplicate]=await connection.query({sql:"SELECT request_hash FROM products WHERE seller_customer_id=? AND request_key=?",timeout:5000},[req.marketplaceActor.id,requestKey]);
      if(duplicate.length)throw new MarketplaceError("REQUEST_REPLAY","O anúncio já foi recebido. Atualize Meus anúncios ou reenvie para recuperar a confirmação.",409);
      const [daily]=await connection.query({sql:"SELECT COUNT(*) amount FROM products WHERE seller_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 24 HOUR)",timeout:5000},[req.marketplaceActor.id]);
      if(Number(daily[0]?.amount)>=15)throw new MarketplaceError("PRODUCT_DAILY_LIMIT","Limite diário de anúncios atingido.",429);
      const [created] = await connection.query({sql:`INSERT INTO products(public_id,seller_customer_id,title,description,category,item_condition,price_cents,city,state,request_key,request_hash,terms_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,timeout:5000}, [id,req.marketplaceActor.id,title,description,category,condition,priceCents,city,state,requestKey,requestHash,TERMS_VERSION]);
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
  } finally { req.releaseUpload?.(); await cleanupRaw(all); }
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
    const [rows] = await connection.query({sql:"SELECT id,status,moderation_status FROM products WHERE public_id=? AND seller_customer_id=? AND deleted_at IS NULL FOR UPDATE",timeout:5000}, [id,req.marketplaceActor.id]);
    if (!rows.length) throw new MarketplaceError("PRODUCT_NOT_FOUND", "Anúncio não encontrado.",404);
    if(desired==='active')assertVisible(rows[0]);
    if (["reserved","sold"].includes(rows[0].status)) throw new MarketplaceError("PRODUCT_LOCKED", "Este anúncio possui uma negociação em andamento ou já foi vendido.",409);
    if (rows[0].status === "closed" && desired !== "closed") throw new MarketplaceError("PRODUCT_CLOSED", "Um anúncio encerrado não pode ser reativado.",409);
    await connection.query({sql:"UPDATE products SET status=?,version=version+1 WHERE id=?",timeout:5000}, [desired,rows[0].id]);
    await audit(req.marketplaceActor.id,"product_status_changed","product",id,{from:rows[0].status,to:desired},connection);
    await connection.commit();
    res.json({ok:true,data:{id,status:desired}});
  } catch(error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}));

router.patch("/products/:productId", safe(async(req,res)=>{
  const id=publicId(req.params.productId), input=productInput(req.body||{}), version=positiveInteger(req.body?.version,"Versão");
  const coverId=positiveInteger(req.body?.coverId,"Foto de capa");
  const connection=await dbMarketplace.getConnection();
  try{
    await connection.beginTransaction();
    const [rows]=await connection.query({sql:"SELECT * FROM products WHERE public_id=? AND seller_customer_id=? AND deleted_at IS NULL FOR UPDATE",timeout:5000},[id,req.marketplaceActor.id]);
    const product=rows[0];
    if(!product)throw new MarketplaceError("PRODUCT_NOT_FOUND","Anúncio não encontrado.",404);
    assertVisible(product);
    if(!['active','paused'].includes(product.status))throw new MarketplaceError("PRODUCT_LOCKED","Uma negociação em andamento impede a edição do anúncio.",409);
    if(Number(product.version)!==version)throw new MarketplaceError("PRODUCT_CHANGED","O anúncio foi alterado. Reabra para carregar os dados atuais antes de editar.",409);
    const [media]=await connection.query({sql:"SELECT id,position,kind FROM product_media WHERE product_id=? ORDER BY position FOR UPDATE",timeout:5000},[product.id]);
    const cover=media.find(item=>Number(item.id)===coverId&&item.kind==='image');
    if(!cover)throw new MarketplaceError("INVALID_COVER","Escolha uma foto deste anúncio.");
    const ordered=[cover,...media.filter(item=>item!==cover)];
    // Two phases preserve the unique position constraint while swapping the cover.
    await connection.query({sql:"UPDATE product_media SET position=position+20 WHERE product_id=?",timeout:5000},[product.id]);
    for(let i=0;i<ordered.length;i++)await connection.query({sql:"UPDATE product_media SET position=? WHERE id=? AND product_id=?",timeout:5000},[i,ordered[i].id,product.id]);
    await connection.query({sql:"UPDATE products SET title=?,description=?,category=?,item_condition=?,price_cents=?,city=?,state=?,version=version+1 WHERE id=?",timeout:5000},[input.title,input.description,input.category,input.condition,input.priceCents,input.city,input.state,product.id]);
    await audit(req.marketplaceActor.id,"product_edited","product",id,{version:version+1},connection);
    await connection.commit();
    res.json({ok:true,data:{id,version:version+1}});
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}));

router.post("/products/:productId/purchase", safe(async (req, res) => {
  const id = publicId(req.params.productId);
  const [recent] = await dbMarketplace.query({sql:"SELECT COUNT(*) amount FROM purchase_requests WHERE buyer_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR)",timeout:5000}, [req.marketplaceActor.id]);
  if (Number(recent[0]?.amount) >= 20) throw new MarketplaceError("PURCHASE_RATE_LIMIT", "Muitas solicitações de compra. Aguarde antes de tentar novamente.",429);
  const connection = await dbMarketplace.getConnection();
  let order;
  try {
    await connection.beginTransaction();
    // Serialize this buyer across DIFFERENT products, not only competitors on one product.
    await connection.query({sql:"SELECT customer_id FROM marketplace_profiles WHERE customer_id=? FOR UPDATE",timeout:5000},[req.marketplaceActor.id]);
    const [recentLocked]=await connection.query({sql:"SELECT COUNT(*) amount FROM purchase_requests WHERE buyer_customer_id=? AND created_at>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR)",timeout:5000},[req.marketplaceActor.id]);
    if(Number(recentLocked[0]?.amount)>=20)throw new MarketplaceError("PURCHASE_RATE_LIMIT","Muitas solicitações. Aguarde antes de tentar novamente.",429);
    const [products] = await connection.query({sql:"SELECT p.*,mp.suspended seller_suspended FROM products p JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE p.public_id=? AND p.deleted_at IS NULL FOR UPDATE",timeout:5000}, [id]);
    const product = products[0];
    if (!product) throw new MarketplaceError("PRODUCT_NOT_FOUND","Anúncio não encontrado.",404);
    if (String(product.seller_customer_id) === req.marketplaceActor.id) throw new MarketplaceError("OWN_PRODUCT","Você não pode comprar seu próprio anúncio.",409);
    assertVisible(product);
    if(await blocked(connection,req.marketplaceActor.id,product.seller_customer_id))throw new MarketplaceError("USER_BLOCKED","Não é possível negociar com este usuário.",409);
    if(product.status==='reserved'){
      const [previous]=await connection.query({sql:"SELECT public_code,amount_cents,expires_at FROM purchase_requests WHERE product_id=? AND buyer_customer_id=? AND status='requested' AND expires_at>UTC_TIMESTAMP(6) LIMIT 1",timeout:5000},[product.id,req.marketplaceActor.id]);
      if(previous.length){
        await connection.commit();
        return res.json({ok:true,replayed:true,data:{publicCode:previous[0].public_code,status:'requested',productTitle:product.title,amountCents:Number(previous[0].amount_cents),expiresAt:previous[0].expires_at,seller:await contact(product.seller_customer_id)}});
      }
    }
    if (product.status !== "active") throw new MarketplaceError("PRODUCT_UNAVAILABLE","Este produto não está mais disponível.",409);
    const [open] = await connection.query({sql:"SELECT COUNT(*) amount FROM purchase_requests WHERE buyer_customer_id=? AND status='requested' AND expires_at>UTC_TIMESTAMP(6)",timeout:5000},[req.marketplaceActor.id]);
    if(Number(open[0]?.amount)>=5)throw new MarketplaceError("OPEN_PURCHASE_LIMIT","Você já possui cinco reservas abertas. Conclua ou cancele uma delas antes de reservar outro produto.",429);
    const publicCode = `LZ${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
    const expiresAt=new Date(Date.now()+24*60*60*1000);
    const [created] = await connection.query({sql:`INSERT INTO purchase_requests(public_code,product_id,buyer_customer_id,seller_customer_id,amount_cents,expires_at) VALUES(?,?,?,?,?,?)`,timeout:5000}, [publicCode,product.id,req.marketplaceActor.id,product.seller_customer_id,product.price_cents,expiresAt]);
    await connection.query({sql:"UPDATE products SET status='reserved',version=version+1 WHERE id=? AND status='active'",timeout:5000}, [product.id]);
    await audit(req.marketplaceActor.id,"purchase_requested","purchase",publicCode,{product:id},connection);
    await notice(connection,product.seller_customer_id,"Nova reserva",`Um cliente reservou ${product.title}. Responda em até 24 horas.`,publicCode);
    await notice(connection,req.marketplaceActor.id,"Reserva registrada",`Sua reserva de ${product.title} aguarda o vendedor. Reservar não é pagar.`,publicCode);
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
  const involved = [...new Set(rows.filter(row=>['requested','accepted'].includes(row.status)).map(row => String(row.buyer_customer_id) === req.marketplaceActor.id ? row.seller_customer_id : row.buyer_customer_id))];
  const contacts = new Map();
  // Sequential/bounded queries avoid consuming the entire shared customer database pool.
  for(const customerId of involved)if(!await blocked(dbMarketplace,req.marketplaceActor.id,customerId))contacts.set(String(customerId),await contact(customerId));
  res.set("Cache-Control","private, no-store");
  res.json({ok:true,data:rows.map(row=>{
    const selling=String(row.seller_customer_id)===req.marketplaceActor.id;
    const otherId=selling?row.buyer_customer_id:row.seller_customer_id;
    return {id:row.public_code,productId:row.product_public_id,productTitle:row.title,amountCents:Number(row.amount_cents),status:row.status,productStatus:row.product_status,role:selling?"seller":"buyer",other:['requested','accepted'].includes(row.status)?contacts.get(String(otherId))||null:null,expiresAt:row.expires_at,createdAt:row.created_at,updatedAt:row.updated_at};
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
    const [rows]=await connection.query({sql:`SELECT pr.*,p.status product_status,p.moderation_status,mp.suspended seller_suspended FROM purchase_requests pr JOIN products p ON p.id=pr.product_id JOIN marketplace_profiles mp ON mp.customer_id=p.seller_customer_id WHERE pr.public_code=? FOR UPDATE`,timeout:5000},[code]);
    const order=rows[0];
    if(!order)throw new MarketplaceError("ORDER_NOT_FOUND","Negociação não encontrada.",404);
    const {status:next,productStatus,replay}=orderTransition(order,req.marketplaceActor.id,action);
    if(replay){await connection.commit();return res.json({ok:true,replayed:true,data:{id:code,status:next}});}
    if(action==='accept'&&await blocked(connection,order.buyer_customer_id,order.seller_customer_id))throw new MarketplaceError("USER_BLOCKED","Esta negociação possui um bloqueio de usuário.",409);
    await connection.query({sql:"UPDATE purchase_requests SET status=? WHERE id=?",timeout:5000},[next,order.id]);
    if(productStatus)await connection.query({sql:"UPDATE products SET status=?,version=version+1 WHERE id=?",timeout:5000},[productStatus,order.product_id]);
    await audit(req.marketplaceActor.id,`purchase_${action}`,"purchase",code,null,connection);
    const messages={accepted:"O vendedor aceitou a reserva. Combine pagamento e entrega com cuidado.",rejected:"O vendedor recusou a reserva.",cancelled:"O comprador cancelou a reserva.",completed:"A negociação foi marcada como concluída. Isso não confirma pagamento pela LZ-GAMES."};
    await notice(connection,String(order.buyer_customer_id)===req.marketplaceActor.id?order.seller_customer_id:order.buyer_customer_id,"Negociação atualizada",messages[next],code);
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
  await dbMarketplace.query({sql:`INSERT INTO product_reports(product_id,reporter_customer_id,reason,details) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE reason=VALUES(reason),details=VALUES(details),created_at=CURRENT_TIMESTAMP(6),resolved_at=NULL,resolution=''`,timeout:5000},[products[0].id,req.marketplaceActor.id,reason,details]);
  await audit(req.marketplaceActor.id,"product_reported","product",id,{reason});
  res.status(201).json({ok:true});
}));

router.get("/me/blocks",safe(async(req,res)=>{
  const [rows]=await dbMarketplace.query({sql:"SELECT b.blocked_id id,mp.display_name name FROM marketplace_blocks b JOIN marketplace_profiles mp ON mp.customer_id=b.blocked_id WHERE b.blocker_id=? ORDER BY b.created_at DESC LIMIT 500",timeout:5000},[req.marketplaceActor.id]);
  res.json({ok:true,data:rows.map(row=>({id:String(row.id),name:row.name}))});
}));
router.post("/blocks/:customerId",safe(async(req,res)=>{
  const id=String(positiveInteger(req.params.customerId,"Usuário"));
  if(id===req.marketplaceActor.id)throw new MarketplaceError("OWN_ACCOUNT","Você não pode bloquear a própria conta.");
  const [users]=await dbMarketplace.query({sql:"SELECT customer_id FROM marketplace_profiles WHERE customer_id=?",timeout:5000},[id]);
  if(!users.length)throw new MarketplaceError("USER_NOT_FOUND","Usuário não encontrado.",404);
  await dbMarketplace.query({sql:"INSERT IGNORE INTO marketplace_blocks(blocker_id,blocked_id) VALUES(?,?)",timeout:5000},[req.marketplaceActor.id,id]);
  await audit(req.marketplaceActor.id,"user_blocked","profile",id);
  res.json({ok:true});
}));
router.delete("/blocks/:customerId",safe(async(req,res)=>{
  const id=String(positiveInteger(req.params.customerId,"Usuário"));
  await dbMarketplace.query({sql:"DELETE FROM marketplace_blocks WHERE blocker_id=? AND blocked_id=?",timeout:5000},[req.marketplaceActor.id,id]);
  await audit(req.marketplaceActor.id,"user_unblocked","profile",id);
  res.json({ok:true});
}));
router.get("/me/notices",safe(async(req,res)=>{
  const [rows]=await dbMarketplace.query({sql:"SELECT id,title,message,order_code orderCode,read_at readAt,created_at createdAt FROM marketplace_notices WHERE customer_id=? ORDER BY id DESC LIMIT 50",timeout:5000},[req.marketplaceActor.id]);
  res.json({ok:true,data:rows});
}));
router.post("/me/notices/read",safe(async(req,res)=>{
  const through=positiveInteger(req.body?.through,"Aviso");
  await dbMarketplace.query({sql:"UPDATE marketplace_notices SET read_at=UTC_TIMESTAMP(6) WHERE customer_id=? AND id<=? AND read_at IS NULL",timeout:5000},[req.marketplaceActor.id,through]);
  res.json({ok:true});
}));

router.use(async (error, req, res, next) => {
  req.releaseUpload?.();
  if (res.headersSent) return next(error);
  const safeError = error instanceof MarketplaceError ? error : null;
  if (!safeError) console.error("[marketplace]", {code:typeof error.code==='string'?error.code.slice(0,80):"INTERNAL"});
  const status = safeError?.status || 500;
  if (status === 429) res.set("Retry-After", "60");
  res.set("Cache-Control", "no-store");
  res.status(status).json({ok:false,code:safeError?.code || "MARKETPLACE_FAILURE",error:safeError?.message || "Não foi possível concluir a operação agora."});
});

ensureStorage().catch(error => console.error("[marketplace] storage unavailable", error));
module.exports = router;
