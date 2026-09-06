"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),Module=require('node:module');
const {spawnSync}=require('node:child_process');
test('real MariaDB and HTTP: publication, ownership, idempotency, moderation, concurrent limits and recovery',
 {skip:process.env.LZ_MARKETPLACE_SQL_FIXTURES!=='1',timeout:120000},async(t)=>{
  const runtime=process.env.LZ_MARKETPLACE_RUNTIME||'/home/lz-servidor/Documentos/lzgames/api';
  const runtimeRequire=Module.createRequire(path.join(runtime,'package.json'));
  const dotenv=runtimeRequire('dotenv');
  for(const file of ['/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'])Object.assign(process.env,dotenv.parse(fs.readFileSync(file)));
  const pick=(...keys)=>keys.map(k=>process.env[k]).find(Boolean);
  const raw=runtimeRequire('mysql2/promise').createPool({host:pick('DB5_HOST','DB_HOST','DB1_HOST'),user:pick('DB5_USER','DB_USER','DB1_USER'),password:pick('DB5_PASS','DB5_PASSWORD','DB_PASS','DB_PASSWORD','DB1_PASS','DB1_PASSWORD'),database:'u214656250_appgamesusados',port:Number(pick('DB5_PORT')||3306),connectionLimit:12,timezone:'Z',supportBigNumbers:true});
  // Every table reference is redirected to fresh fixture tables. Never query a real customer.
  const prefix='lzmk_fixture_'+crypto.randomBytes(6).toString('hex')+'_';
  const tables=['marketplace_profiles','products','product_media','purchase_requests','product_reports','marketplace_audit','marketplace_blocks','marketplace_notices','clientes'];
  const pattern=new RegExp('\\b('+tables.join('|')+')\\b','g');
  const rewrite=input=>{let sql=typeof input==='string'?input:input.sql;assert.match(sql,new RegExp('\\b('+tables.join('|')+')\\b'),'query must contain an allowlisted fixture table');sql=sql.replace(pattern,name=>prefix+name).replace(/\b(fk_[a-z_]+)\b/g,(_,name)=>prefix+name);return typeof input==='string'?sql:{...input,sql};};
  const wrap=c=>new Proxy(c,{get(obj,key){if(key==='query')return(sql,values)=>obj.query(rewrite(sql),values);return typeof obj[key]==='function'?obj[key].bind(obj):obj[key];}});
  const pool={query:(sql,values)=>raw.query(rewrite(sql),values),getConnection:async()=>wrap(await raw.getConnection())};
  const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'lz-market-production-'));
  process.env.MARKETPLACE_MEDIA_ROOT=path.join(temp,'media');process.env.MARKETPLACE_TMP_ROOT=path.join(temp,'uploads');
  let server;
  try{
    for(const name of ['schema.sql','migrate-production.sql']){
      const sql=fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/--[^\n]*/g,'');
      for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)){
        if(/^(CREATE DATABASE|USE )/i.test(statement))continue;
        await pool.query(statement);
      }
    }
    await pool.query('CREATE TABLE clientes(id BIGINT UNSIGNED PRIMARY KEY,nome VARCHAR(100),telefone VARCHAR(30),telefone2 VARCHAR(30),cpf VARCHAR(20)) ENGINE=InnoDB');
    for(const id of [101,102,103,201,202,203,204]){
      await pool.query('INSERT INTO clientes(id,nome,telefone) VALUES(?,?,?)',[id,'Fixture '+id,'8298700'+String(id).padStart(4,'0')]);
      await pool.query('INSERT INTO marketplace_profiles(customer_id,display_name) VALUES(?,?)',[id,'Fixture '+id]);
    }
    const express=runtimeRequire('express');
    const modulePath=path.join(__dirname,'../routes/marketplace.js'),loaded=new Module(modulePath,module);
    loaded.filename=modulePath;loaded.paths=Module._nodeModulePaths(runtime);
    const localRequire=Module.createRequire(modulePath);
    loaded.require=name=>{
      if(name==='../db')return {dbMain:pool,dbMarketplace:pool};
      if(name==='../middleware/referralAuth')return (req,res,next)=>{const match=/^Bearer fixture-(\d+)$/.exec(req.headers.authorization||'');if(!match)return res.status(401).json({ok:false});req.user={sub:match[1]};next();};
      if(name==='../lib/referralGuard')return {GuardError:class GuardError extends Error{},phone:value=>value?'55'+value:'',liveIdentity:async(db,id)=>{const [rows]=await db.query('SELECT * FROM clientes WHERE id=?',[id]);if(!rows.length)throw new Error('Missing fixture');return {id:String(id),name:rows[0].nome,primary:rows[0].telefone};}};
      if(name.startsWith('../lib/'))return localRequire(name);
      return runtimeRequire(name);
    };
    loaded._compile(fs.readFileSync(modulePath,'utf8'),modulePath);
    const app=express();app.use(express.json());app.use('/marketplace',loaded.exports);
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const base='http://127.0.0.1:'+server.address().port+'/marketplace';
    const api=async(user,url,method='GET',body)=>{const response=await fetch(base+url,{method,headers:{...(user?{Authorization:'Bearer fixture-'+user}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const data=await response.json();return{status:response.status,...data};};
    const source=path.join(temp,'source.png');assert.equal(spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=320x240:d=1','-frames:v','1',source]).status,0);
    const photo=fs.readFileSync(source);
    const fields={title:'Controle usado de teste',description:'Somente dados fictícios de teste isolado.',category:'controles',condition:'used_good',priceCents:19990,city:'Maceió',state:'AL'};
    const create=async(user,key='lz_'+crypto.randomBytes(22).toString('hex'),overrides={})=>{
      const form=new FormData();for(const [k,v] of Object.entries({...fields,requestKey:key,termsVersion:'2026-09-06',...overrides}))form.append(k,String(v));
      form.append('photos',new Blob([photo],{type:'image/png'}),'fixture.png');return api(user,'/products','POST',form);
    };
    let product;
    await t.test('requires authentication, rules, a valid UF and server-generated ownership',async()=>{
      assert.equal((await api(null,'/products')).status,401);
      const missingTerms=await create(101,undefined,{termsVersion:''});assert.equal(missingTerms.status,426,JSON.stringify(missingTerms));
      assert.equal((await create(101,undefined,{state:'ZZ'})).status,422);
      const r=await create(101);assert.equal(r.status,201,JSON.stringify(r));product=r.data;assert.equal(product.seller.id,'101');assert.equal(product.media.length,1);assert.ok(product.version);
      assert.doesNotMatch(JSON.stringify(product),/telefone|whatsapp|cpf|storage_name/);
    });
    await t.test('same upload key cannot create another listing after a lost response',async()=>{
      const key='lz_'+crypto.randomBytes(22).toString('hex');const a=await create(102,key),b=await create(102,key);assert.equal(a.status,201);assert.equal(b.status,200);assert.equal(a.data.id,b.data.id);assert.equal(b.replayed,true);
      assert.equal((await create(102,key,{priceCents:29990})).status,409);
      const [count]=await pool.query('SELECT COUNT(*) n FROM products WHERE seller_customer_id=? AND request_key=?',[102,key]);assert.equal(Number(count[0].n),1);
    });
    await t.test('edits enforce ownership, optimistic locking and cover ownership',async()=>{
      const update={...fields,version:product.version,coverId:product.media[0].id,title:'Título editado no teste'};
      assert.equal((await api(201,'/products/'+product.id,'PATCH',update)).status,404);
      assert.equal((await api(101,'/products/'+product.id,'PATCH',{...update,coverId:99999999})).status,422);
      assert.equal((await api(101,'/products/'+product.id,'PATCH',update)).status,200);
      assert.equal((await api(101,'/products/'+product.id,'PATCH',update)).status,409);
      product=(await api(101,'/products/'+product.id)).data;assert.equal(product.title,update.title);
    });
    await t.test('block, unblock, reports and catalogue respect the authenticated customer',async()=>{
      assert.equal((await api(201,'/products/'+product.id+'/report','POST',{reason:'fraude',details:'Teste fictício'})).status,201);
      assert.equal((await api(101,'/products/'+product.id+'/report','POST',{reason:'fraude'})).status,409);
      assert.equal((await api(201,'/blocks/101','POST',{})).status,200);
      assert.equal((await api(201,'/products')).data.some(p=>p.seller.id==='101'),false);
      assert.equal((await api(201,'/products/'+product.id+'/purchase','POST',{})).status,409);
      assert.equal((await api(201,'/products/'+product.id)).status,404);
      assert.equal((await api(202,'/me/blocks')).data.length,0);
      assert.equal((await api(201,'/blocks/101','DELETE',{})).status,200);
    });
    let order;
    await t.test('competing buyers produce one reservation; replay returns the same code',async()=>{
      const both=await Promise.all([201,202].map(i=>api(i,'/products/'+product.id+'/purchase','POST',{})));
      assert.equal(both.filter(r=>r.status===201).length,1,JSON.stringify(both));assert.equal(both.filter(r=>r.status===409).length,1);
      const index=both.findIndex(r=>r.status===201),buyer=[201,202][index];order={...both[index].data,buyer};
      const replay=await api(buyer,'/products/'+product.id+'/purchase','POST',{});assert.equal(replay.status,200);assert.equal(replay.data.publicCode,order.publicCode);
      assert.equal((await api(203,'/orders/'+order.publicCode,'PATCH',{action:'accept'})).status,404);
      assert.equal((await api(101,'/products/'+product.id,'PATCH',{...fields,version:product.version,coverId:product.media[0].id})).status,409);
      assert.ok((await api(101,'/me/notices')).data.some(n=>n.orderCode===order.publicCode));
    });
    await t.test('six simultaneous reservations on different products enforce the limit of five',async()=>{
      const products=[];for(let i=0;i<6;i++){const r=await create(103);assert.equal(r.status,201);products.push(r.data);}
      const results=await Promise.all(products.map(p=>api(204,'/products/'+p.id+'/purchase','POST',{})));
      assert.equal(results.filter(r=>r.status===201).length,5,JSON.stringify(results));assert.equal(results.filter(r=>r.status===429).length,1);
      const [rows]=await pool.query("SELECT COUNT(*) n FROM purchase_requests WHERE buyer_customer_id=204 AND status='requested'");assert.equal(Number(rows[0].n),5);
    });
    await t.test('expired orders cannot be accepted between sweep intervals',async()=>{
      await pool.query('UPDATE purchase_requests SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE public_code=?',[order.publicCode]);
      const r=await api(101,'/orders/'+order.publicCode,'PATCH',{action:'accept'});assert.equal(r.status,409);assert.equal(r.code,'RESERVATION_EXPIRED');
      assert.equal((await api(order.buyer,'/orders/'+order.publicCode,'PATCH',{action:'cancel'})).status,200);
      assert.equal((await api(order.buyer,'/orders/'+order.publicCode,'PATCH',{action:'cancel'})).replayed,true);
      const closed=(await api(order.buyer,'/me/orders')).data.find(o=>o.id===order.publicCode);assert.equal(closed.other,null);
    });
    await t.test('PHP admin uses the same isolated tables: withdraw, resolve, restore and audit',async()=>{
      const result=spawnSync('php',[path.join(__dirname,'admin-fixture.php'),prefix,product.id],{env:process.env,encoding:'utf8'});assert.equal(result.status,0,result.stderr+result.stdout);assert.match(result.stdout,/admin fixture passed/);
      await pool.query("UPDATE products SET moderation_status='hidden' WHERE public_id=?",[product.id]);
      assert.equal((await api(202,'/products')).data.some(p=>p.id===product.id),false);
      assert.equal((await api(202,'/products/'+product.id+'/purchase','POST',{})).status,409);
      assert.equal((await api(101,'/products/'+product.id+'/status','PATCH',{status:'active'})).status,409);
      const filename=product.media[0].url.split('/').pop();assert.equal((await api(null,'/media/'+product.id+'/'+filename)).status,404);
    });
    await t.test('notice read markers cannot modify another customer notices',async()=>{
      const before=(await api(101,'/me/notices')).data;assert.ok(before.length>0);const through=Math.max(...before.map(n=>Number(n.id)));
      await api(203,'/me/notices/read','POST',{through});assert.equal((await api(101,'/me/notices')).data.filter(n=>!n.readAt).length,before.filter(n=>!n.readAt).length);
      await api(101,'/me/notices/read','POST',{through});assert.equal((await api(101,'/me/notices')).data.filter(n=>!n.readAt).length,0);
      assert.deepEqual(await fsp.readdir(process.env.MARKETPLACE_TMP_ROOT),[]);
    });
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const table of [...tables].reverse())await raw.query('DROP TABLE IF EXISTS `'+prefix+table+'`');
    await raw.end();await fsp.rm(temp,{recursive:true,force:true});
  }
});
