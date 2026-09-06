'use strict';
// Isolated browser test. All URLs are intercepted; no live API/user writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {chromium}=require(process.env.LZ_PLAYWRIGHT_PATH || 'playwright');
const source=path.resolve(__dirname,'../public/convite');
const origin='https://app.lzgames.com.br';
const release=require('../../core/config/appRelease.json');
const payload=Buffer.from(JSON.stringify({id:99999999,v:2,n:Buffer.alloc(32,7).toString('base64url')})).toString('base64url');
const code='LZ'+payload+'.'+crypto.createHmac('sha256','synthetic-public-invite-test-only').update(payload).digest().subarray(0,16).toString('base64url');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'lz-invite-browser-'));
let count=0;function check(value,message){assert.ok(value,message);count++;}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.LZ_CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});try{
  const page=await browser.newPage({viewport:{width:390,height:844}}), requests=[],errors=[]; let mode='ok';
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.copyWrites=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copyWrites.push(text)}}});});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({path:url.pathname,method:request.method()});
    if(url.origin!==origin) return route.abort();
    if(url.pathname==='/convite/' || url.pathname==='/convite') return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(source,'index.html'),'utf8')});
    const files={'/convite/invite-v1.js':['invite-v1.js','application/javascript'],'/convite/invite-v1.css':['invite-v1.css','text/css']};
    if(files[url.pathname]) {const [name,type]=files[url.pathname];return route.fulfill({contentType:type,body:fs.readFileSync(path.join(source,name),'utf8')});}
    if(url.pathname==='/api/app/invite-info'){
      assert.equal(request.method(),'GET');assert.equal(await request.headerValue('cookie'),null);assert.equal(await request.headerValue('authorization'),null);
      if(mode==='offline')return route.abort();
      if(mode==='invalid'||url.searchParams.has('ref')&&url.searchParams.get('ref')!==code)return route.fulfill({status:400,contentType:'application/json',body:'{"ok":false}'});
      return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,data:{has_invite:url.searchParams.has('ref'),release:mode==='foreign'?{...release,apk_url:'https://untrusted.fixture.invalid/evil.apk'}:release}})});
    }
    return route.abort();
  });
  const open=async suffix=>{await page.goto(origin+'/convite/'+suffix);await page.waitForFunction(()=>!document.getElementById('page-status').textContent.includes('Conferindo'));};
  await open('?ref='+encodeURIComponent(code));
  check(await page.locator('#invite-code').inputValue()===code,'complete signed code preserved');
  check(await page.locator('#download-apk').getAttribute('href')===release.apk_url,'official download, not login');
  check(await page.locator('#use-invite').isVisible(),'manual before-login binding instructions');
  check((await page.evaluate(()=>window.copyWrites)).length===0,'no automatic clipboard write');
  check((await page.evaluate(()=>Object.keys(localStorage))).length===0,'no automatic tracking/session binding');
  await page.locator('#copy-code').click();
  check((await page.evaluate(()=>window.copyWrites))[0]===code,'copy requires a user click');
  check((await page.locator('#copy-status').innerText()).includes('antes de entrar'),'copy result explains when to use invite');
  for(const [width,height] of [[320,740],[390,844],[1200,850]]){
    await page.setViewportSize({width,height});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow at '+width);
    check((await page.locator('#download-apk').boundingBox()).height>=44,'download touch target '+width);
    await page.screenshot({path:path.join(output,'invite-'+width+'.png'),fullPage:true});
  }
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied')}},configurable:true});document.execCommand=()=>false});
  await page.locator('#copy-code').click();
  check((await page.locator('#copy-status').innerText()).includes('selecionado'),'clipboard denial leaves manual selection');
  check(await page.evaluate(()=>document.getElementById('invite-code').selectionEnd===document.getElementById('invite-code').value.length),'whole code selected for manual copy');
  await open('');check(await page.locator('#generic-note').isVisible(),'generic download does not invent referrer');
  check(await page.locator('#invite-section').isHidden(),'generic page hides invitation fields');
  for(const query of ['?ref=invalid','?ref='+code+'&ref='+code,'?ref=','?ref='+encodeURIComponent('<script>alert(1)</script>')]){
    const before=requests.filter(r=>r.path==='/api/app/invite-info').length;await open(query);
    check(await page.locator('#download-section').isHidden(),'invalid query hides download');
    check(await page.locator('#without-invite').isVisible(),'invalid query offers generic download explicitly');
    check(requests.filter(r=>r.path==='/api/app/invite-info').length===before,'invalid query rejected locally');
  }
  mode='invalid';await open('?ref='+code);check(await page.locator('#without-invite').isVisible(),'bad signature fails clearly');
  mode='offline';await open('?ref='+code);check(await page.locator('#retry').isVisible(),'outage offers retry');
  check(await page.locator('#download-apk').getAttribute('href')===null,'outage leaves no unchecked download');
  mode='ok';await page.locator('#retry').click();await page.locator('#download-section').waitFor({state:'visible'});check(await page.locator('#retry').isHidden(),'retry recovers');
  mode='foreign';await open('?ref='+code);check(await page.locator('#download-apk').getAttribute('href')===null,'foreign APK metadata fails closed');
  check(errors.length===0,'no script errors');check(requests.every(r=>r.method==='GET'),'no registration, binding, payment or message sent');
  console.log(JSON.stringify({checks:count,status:'passed',screenshots:output,externalRequestsSent:0}));
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
