'use strict';
// Offline Chromium component test. All HTTP is blocked; $.ajax is a synthetic ledger.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=process.env.LZ_ASSISTANCE_ROOT||path.resolve(__dirname,'../..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'lz-credit-browser-'));
const browser=spawn('/usr/bin/google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-extensions','--disable-background-networking','--disable-sync','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
let ws,seq=0;const waiters=new Map();let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const request=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{waiters.delete(id);reject(new Error('CDP timeout: '+method));},10000);waiters.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const r=await request('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;}
(async()=>{
  try {
    const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Browser startup timeout')),10000);
      browser.stderr.on('data',b=>{output+=b;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
    const port=new URL(endpoint).port;
    const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    const page=pages.find(p=>p.type==='page'&&p.url==='about:blank');if(!page)throw new Error('No test page');
    ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&waiters.has(m.id)){const p=waiters.get(m.id);waiters.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
    await request('Page.enable');await request('Runtime.enable');await request('Network.enable');await request('Network.setBlockedURLs',{urls:['http://*','https://*']});
    const source=fs.readFileSync(path.join(root,'painel/paginas/os.php'),'utf8');
    const start=source.indexOf('<div id="app-credit-panel"');let end=start,depth=0;
    const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=start;let match;
    while((match=tags.exec(source))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){end=tags.lastIndex;break;}}
    check(end>start,'component markup found');
    const css=fs.readFileSync(path.join(root,'assets/plugins/bootstrap/css/bootstrap.min.css'),'utf8');
    const panel=source.slice(start,end);
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="padding:20px;background:#f4f6f9;color:#182334"><main style="max-width:1050px;margin:auto"><h2>OS de demonstração</h2><input id="id" value="10" type="hidden"><input id="cliente" value="707" type="hidden"><input id="app-credit-csrf" value="${'a'.repeat(64)}" type="hidden"><label>Total a pagar <input id="subtotal" readonly value="100,00"></label><input id="frete" value="0" type="hidden"><select id="tipo_desconto" hidden><option value="Valor">Valor</option></select>${panel}</main></body></html>`;
    const {frameTree}=await request('Page.getFrameTree');await request('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
    await evaluate(fs.readFileSync(path.join(root,'painel/js/jquery-1.11.1.min.js'),'utf8'));
    await evaluate(`window.calls=[];window.active=null;window.failQuote=false;window.buscar=()=>{};
      $.ajax=opts=>new Promise((resolve,reject)=>setTimeout(()=>{
        window.calls.push(opts.data);const v=opts.data;
        if(v.action==='quote') {if(window.failQuote){reject({responseJSON:{message:'Falha sintética'}});return;}
          resolve({data:{os_id:10,customer_id:707,subtotal_cents:window.active?9010:10000,earned_cents:1980,used_cents:window.active?990:0,available_cents:window.active?990:1980,limit_cents:window.active?0:1980,active:window.active,reason:'',request_id:'${'a'.repeat(32)}'}});
        } else {if(v.action==='apply')window.active={id:v.request_id,amount_cents:v.amount_cents,can_undo:true};else window.active=null;resolve({data:{state:window.active?'active':'reversed'}});}
      },20));`);
    await evaluate(fs.readFileSync(path.join(root,'painel/js/app-credit.js'),'utf8'));
    await evaluate(`document.querySelector('main').id='modalForm';document.getElementById('modalForm').dispatchEvent(new Event('shown.bs.modal',{bubbles:true}));new Promise(r=>setTimeout(r,80))`);
    check((await evaluate(`document.getElementById('app-credit-balance').textContent`)).includes('19,80'),'available balance rendered');
    await evaluate(`$('#app-credit-amount').val('9,90');document.getElementById('app-credit-apply').click();document.getElementById('app-credit-apply').click();new Promise(r=>setTimeout(r,140))`);
    check(await evaluate(`window.calls.filter(x=>x.action==='apply').length===1`),'double tap sends once');
    check(await evaluate(`$('#subtotal').val()==='90,10' && $('#tipo_desconto').prop('disabled')===true && $('#app-credit-undo').prop('hidden')===false`),'net value and financial locks');
    if(process.env.LZ_CREDIT_SCREENSHOTS==='1') {
      for(const [width,height] of [[1200,760],[390,844]]) {
        await request('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
        check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'no horizontal overflow '+width);
        const shot=await request('Page.captureScreenshot',{format:'png'});const name=path.join(profile,'credit-'+width+'.png');fs.writeFileSync(name,Buffer.from(shot.data,'base64'));console.log('Screenshot: '+name);
      }
    }
    await evaluate(`$('#app-credit-reason').val('Corrigir serviço');document.getElementById('app-credit-undo').click();new Promise(r=>setTimeout(r,140))`);
    check(await evaluate(`$('#subtotal').val()==='100,00' && $('#tipo_desconto').prop('disabled')===false`),'undo restores preview and unlocks');
    await evaluate(`$('#cliente').val('808');document.getElementById('app-credit-apply').click();new Promise(r=>setTimeout(r,80))`);
    check(await evaluate(`window.calls.filter(x=>x.action==='apply').length===1`),'unsaved different customer blocked');
    await evaluate(`window.failQuote=true;document.getElementById('app-credit-refresh').click();new Promise(r=>setTimeout(r,80))`);
    check(await evaluate(`$('#app-credit-apply').prop('disabled')===true`),'lookup failure cannot redeem');
    console.log(checks+' Chromium checks passed; no server requests sent.');
  } finally {
    if(ws)ws.close();browser.kill('SIGTERM');
    await new Promise(resolve=>{if(browser.exitCode!==null||browser.signalCode!==null)resolve();else browser.once('exit',resolve);});
    if(process.env.LZ_CREDIT_SCREENSHOTS!=='1')fs.rmSync(profile,{recursive:true});
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
