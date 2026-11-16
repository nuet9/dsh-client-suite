import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
export async function verifyDesktop(ctx, base){
 ctx.get('clientModules')?.rebuilt('dsh-whale-widget');
 const origin=ctx.webServer.getOrigin();const first=await fetch(ctx.connection.authenticatedUrl(origin+'/'),{redirect:'manual'});
 const cookie=(first.headers.get('set-cookie')||'').split(';')[0];if(!cookie.includes('='))throw Error('验证会话建立失败');
 const headers={Cookie:cookie};const json=await fetch(origin+'/dsh-whale/desktop.json',{headers}).then(r=>r.json());
 const unauth=await fetch(origin+'/dsh-whale/desktop.json');const script=await fetch(origin+'/dsh-whale/widget.js',{headers}).then(r=>r.text());
 const playwright=await import(pathToFileURL(path.join(process.env.DSH_PROFILE_DIR||path.join(process.env.USERPROFILE,'.dsh','profiles','desktop'),'node_modules','playwright','index.mjs')).href);
 const browser=await playwright.chromium.launch({headless:true,executablePath:'__DSH_SUITE_DSH_WHALE_WIDGET_PROGRAM_FILES__/Google/Chrome/Application/chrome.exe'});
 const evidence={nativeBuilt:true,defaultEnabled:json.enabled,unauthenticatedStatus:unauth.status,hasSetting:script.includes("menuLabel('桌面置顶')"),checks:[]};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const sep=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,sep),value:cookie.slice(sep+1),url:origin}]);
  const page=await context.newPage();let mode=false,fail=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Exercise the shipped widget and shipped desktop document in client mode;
  // desktop.json is simulated solely in this isolated page, so no native window opens.
  await page.addInitScript(()=>Object.defineProperty(window,'__dshwDesktop',{get:()=>false,set:()=>{},configurable:true}));
  await page.route('**/dsh-whale/desktop.json',async route=>{const req=route.request();if(req.method()==='POST'){const d=req.postDataJSON();if(fail){await route.fulfill({status:500,json:{ok:false,error:'测试启动失败'}});return;}mode=d.enabled;}await route.fulfill({json:{ok:true,enabled:mode,running:mode,ready:mode,prefs:{}}});});
  await page.goto(origin+'/dsh-whale/desktop');await page.waitForSelector('.dshwv-img',{state:'visible'});await page.waitForFunction(()=>window.__dshwCollectRegion?.()?.ready);evidence.hitRegion=await page.evaluate(()=>{const d=window.__dshwCollectRegion();const root=document.querySelector('.dshwv-root').getBoundingClientRect();const hit=(x,y)=>d.rects.some(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h);let blank=0,blocked=0;for(let y=root.top;y<root.bottom;y+=3)for(let x=root.left;x<root.right;x+=3){if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;if(!hit(x,y))blank++;else blocked++;}return {transparentTopLeftPassesThrough:!hit(root.left+5,root.top+5),blankSamples:blank,interactiveSamples:blocked,regionRectangles:d.rects.length};});evidence.checks.push({name:'桌面透明外框不占原生鼠标区域',passed:evidence.hitRegion.transparentTopLeftPassesThrough&&evidence.hitRegion.blankSamples>0&&evidence.hitRegion.interactiveSamples>0});
  await page.goto(origin+'/');await page.waitForSelector('.dshwv-img',{state:'visible'});await page.waitForFunction(()=>document.querySelector('.dshwv-img')?.naturalWidth>0);
  const open=async()=>{await page.locator('.dshwv-menu-btn').dispatchEvent('click');await page.waitForSelector('.dshwv-menu-open',{timeout:5000});};
  await page.clock.install();await open();const auto=page.getByLabel('自动气泡',{exact:true});evidence.checks.push({name:'自动气泡默认2分钟且含六种选项',passed:await auto.inputValue()==='120'&&await auto.locator('option').count()===6});await auto.selectOption('0');await page.reload();await page.waitForSelector('.dshwv-img',{state:'visible'});await open();evidence.checks.push({name:'关闭自动气泡后刷新仍保留',passed:await page.getByLabel('自动气泡',{exact:true}).inputValue()==='0'});await page.getByLabel('自动气泡',{exact:true}).selectOption('120');await page.locator('.dshwv-menu-btn').dispatchEvent('click');await page.clock.fastForward(121000);evidence.checks.push({name:'两分钟后自动显示随机语录而非余额',passed:await page.locator('.dshwv-pop-open').count()>0&&!/余额/.test(await page.locator('.dshwv-pop').innerText())});await page.locator('.dshwv-pop').dispatchEvent('click');
  await open();const toggle=page.getByRole('checkbox',{name:'桌面置顶',exact:true});await toggle.waitFor({state:'visible'});
  evidence.checks.push({name:'原菜单仅一个桌面置顶开关',passed:await toggle.count()===1&&!await toggle.isChecked()});
  fail=true;await toggle.click();await page.waitForFunction(()=>!document.querySelector('[aria-label="桌面置顶"]').disabled);evidence.checks.push({name:'启动失败时开关回退且角色保留',passed:!await toggle.isChecked()&&await page.locator('.dshwv-root').isVisible()});
  fail=false;await toggle.click();await page.waitForFunction(()=>document.documentElement.hasAttribute('data-dshw-desktop-active'));evidence.checks.push({name:'切到桌面后客户端角色隐藏',passed:!await page.locator('.dshwv-root').isVisible()});
  mode=false;await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-dshw-desktop-active'));await open();evidence.checks.push({name:'关闭桌面后原角色恢复且开关关闭',passed:await page.locator('.dshwv-root').isVisible()&&!await toggle.isChecked()});
  evidence.checks.push({name:'无额外工具栏且角色只有一个',passed:await page.locator('#controls').count()===0&&await page.locator('.dshwv-root').count()===1});await page.reload();await page.waitForSelector('.dshwv-img',{state:'visible'});await open();evidence.checks.push({name:'完整Harness页面重载后角色及设置恢复',passed:await page.locator('.dshwv-root').count()===1&&await page.getByRole('checkbox',{name:'桌面置顶',exact:true}).count()===1});evidence.clientModule=ctx.get("clientModules")?.graph().entries.find(e=>e.id==='dsh-whale-widget');evidence.pageErrors=errors;
  evidence.passed=evidence.checks.every(c=>c.passed)&&errors.length===0&&unauth.status===401;
 }finally{await browser.close();}
 const dir=path.join(base,'evidence');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'desktop-setting.json'),JSON.stringify(evidence,null,2));return evidence;
}
