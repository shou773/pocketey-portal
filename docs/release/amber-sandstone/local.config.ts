import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'../../../tests/games',testMatch:'browser.spec.ts',timeout:120000,workers:1,
  outputDir:'../../../test-results/amber-sandstone',
  reporter:[['list'],['json',{outputFile:'evidence/functional-report.json'}]],
  use:{baseURL:'http://127.0.0.1:4386',viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,locale:'ja-JP',
    launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}
});
