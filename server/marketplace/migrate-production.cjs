"use strict";
// Local operation only: additive migration, fixed marketplace DB, private backup first.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),{createRequire}=require('node:module');
async function main(){
  if(process.argv[2]!=='--apply')throw new Error('Use --apply to back up and migrate the isolated marketplace database.');
  const runtime=process.env.LZ_MARKETPLACE_RUNTIME||'/home/lz-servidor/Documentos/lzgames/api';
  const req=createRequire(path.join(runtime,'package.json')),dotenv=req('dotenv');
  for(const file of ['/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'])Object.assign(process.env,dotenv.parse(fs.readFileSync(file)));
  const pick=(...keys)=>keys.map(k=>process.env[k]).find(Boolean);
  const config={host:pick('DB5_HOST','DB_HOST','DB1_HOST'),user:pick('DB5_USER','DB_USER','DB1_USER'),password:pick('DB5_PASS','DB5_PASSWORD','DB_PASS','DB_PASSWORD','DB1_PASS','DB1_PASSWORD'),database:'u214656250_appgamesusados',port:Number(pick('DB5_PORT')||3306)};
  const connection=await req('mysql2/promise').createConnection(config);
  try{
    const [before]=await connection.query('SELECT COUNT(*) products FROM products');
    const backup=await fsp.mkdtemp('/home/lz-servidor/.config/lzgames/backups/marketplace-production-');await fsp.chmod(backup,0o700);
    const file=path.join(backup,'marketplace-before.sql'),fd=fs.openSync(file,'wx',0o600);
    try{await new Promise((resolve,reject)=>{const child=spawn('/usr/bin/mariadb-dump',['--single-transaction','--skip-lock-tables','--no-tablespaces','--host='+config.host,'--port='+config.port,'--user='+config.user,config.database],{env:{...process.env,MYSQL_PWD:config.password},stdio:['ignore',fd,'pipe']});let error='';child.stderr.on('data',chunk=>{error+=chunk;});child.on('error',()=>reject(new Error('Database backup process failed.')));child.on('close',code=>code===0?resolve():reject(new Error('Database backup failed; migration not applied.')));});}finally{fs.closeSync(fd);}
    const files=[['api-route.js',path.join(runtime,'routes/marketplace.js')],['api-media.js',path.join(runtime,'lib/marketplaceMedia.js')],['raffles-index.php','/home/lz-servidor/apps/lzgames-sorteios/public/index.php'],['raffles-navigation.js','/home/lz-servidor/apps/lzgames-sorteios/public/app-timer15.js']];
    for(const [name,source]of files){await fsp.copyFile(source,path.join(backup,name));await fsp.chmod(path.join(backup,name),0o600);}
    const statements=fs.readFileSync(path.join(__dirname,'migrate-production.sql'),'utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
    for(const sql of statements)await connection.query(sql);
    const [after]=await connection.query('SELECT COUNT(*) products FROM products');
    if(Number(before[0].products)!==Number(after[0].products))throw new Error('Product count changed; inspect before deploying.');
    console.log(JSON.stringify({ok:true,backup,products:Number(after[0].products),statements:statements.length}));
  }finally{await connection.end();}
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
