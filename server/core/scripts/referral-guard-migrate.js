"use strict";
const fs=require('node:fs'),dotenv=require('dotenv');
for(const file of ['/etc/lzgames/db.env','/etc/lzgames/db.systemd.env'])Object.assign(process.env,dotenv.parse(fs.readFileSync(file)));
const log=console.log;console.log=()=>{};const db=require('../db');console.log=log;
const {schema,seed}=require('../lib/referralGuardSchema');
(async()=>{
  let c;
  try{
    if(!process.argv.includes('--apply'))throw new Error('explicit_apply_required');
    c=await db.dbCashback.getConnection();
    await schema(c);
    console.log(JSON.stringify({migration:'referral_guard_v2',...await seed(db.dbMain,c)}));
  }catch(e){console.error(JSON.stringify({migration:'failed',category:e.code||'private_details_omitted'}));process.exitCode=1;}
  finally{c?.release();await Promise.all(Object.values(db).filter(Boolean).map(p=>p.end()));}
})();
