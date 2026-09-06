const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('marketplace is isolated and reachable from the consumer app',()=>{
  const app=read('App.tsx'),api=read('src/api.ts'),schema=read('server/marketplace/schema.sql');
  assert.match(app,/type Tab = [^;]+"marketplace"/);
  assert.match(app,/<Marketplace \/>/);
  assert.match(app,/Games Usados/);
  assert.match(api,/\/marketplace\/products/);
  assert.match(schema,/USE `u214656250_appgamesusados`/);
  assert.doesNotMatch(schema,/u214656250_(?:Lzgamesonline|LZagenda2025|LzCashBack|LzgameMenu6)/);
});

test('upload and transaction guards stay enabled',()=>{
  const route=read('server/marketplace/routes/marketplace.js');
  assert.match(route,/\{name:"photos",maxCount:5\}/);
  assert.match(route,/\{name:"video",maxCount:1\}/);
  assert.match(route,/total > 45 \* 1024 \* 1024/);
  assert.match(route,/FOR UPDATE/);
  assert.match(route,/product\.status !== "active"/);
  assert.match(route,/status='reserved'/);
  assert.match(route,/expiresAt=new Date\(Date\.now\(\)\+24\*60\*60\*1000\)/);
  assert.match(route,/>=5/);
  assert.match(route,/seller: \{ id:[^}]+name:/);
  const serializer=route.slice(route.indexOf('function serializeProduct'),route.indexOf('async function attachMedia'));
  assert.doesNotMatch(serializer,/whatsapp|telefone|phone/);
});

test('media is decoded, resized and stripped of metadata',()=>{
  const media=read('server/marketplace/lib/marketplaceMedia.js');
  assert.match(media,/ffprobe/);
  assert.match(media,/libx264/);
  assert.match(media,/\+faststart/);
  assert.match(media,/-map_metadata", "-1/);
  assert.match(media,/duration > 30\.75/);
  assert.match(media,/crypto\.randomUUID\(\)/);
});
