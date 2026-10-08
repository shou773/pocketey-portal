import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const reports=[];
try {
 const page=await browser.newPage({viewport:{width:800,height:800}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.TILT_ART_BASE||'http://127.0.0.1:4342');
 for(const kind of ['wind-rock','rooted-observatory']) {
  await page.setContent('<canvas style="width:800px;height:800px;display:block"></canvas><style>body{margin:0}</style>');
  const result=await page.evaluate(async kind=>{
   const {preview}=await import('/docs/release/tilttrail-organic/preview.ts');
   return preview(document.querySelector('canvas'),kind);
  },kind);
  await fs.mkdir(new URL('./evidence/',import.meta.url),{recursive:true});
  await fs.writeFile(new URL(`./evidence/model-${kind}.png`,import.meta.url),Buffer.from(result.image.split(',')[1],'base64'));
  delete result.image;reports.push({kind,...result});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(new URL('./evidence/model-previews.json',import.meta.url),JSON.stringify({errors,reports},null,2)+'\n');
 console.log(reports);
} finally {await browser.close();}
