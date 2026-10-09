import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'campaign.spec.ts', outputDir: 'test-results/alpine-campaign/native',
  timeout: 240000, expect: {timeout:10000}, workers: 1, retries: 0,
  reporter: [['list'],['json',{outputFile:'test-results/alpine-campaign/native-report.json'}]],
  use: {baseURL:'http://127.0.0.1:4346',viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,
    screenshot:'only-on-failure',launchOptions:{args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4346',url:'http://127.0.0.1:4346',reuseExistingServer:!process.env.CI},
});
