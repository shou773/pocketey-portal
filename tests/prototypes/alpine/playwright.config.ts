import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'input.spec.ts', outputDir: 'test-results/alpine/input',
  timeout: 30000, retries: 0, workers: 1,
  reporter: [['list'],['json',{outputFile:'test-results/alpine/input-report.json'}]],
  use: { baseURL: 'http://127.0.0.1:4340', viewport: {width:390,height:844}, hasTouch:true,
    locale:'ja-JP', launchOptions:{executablePath:process.env.CI?undefined:'/usr/bin/chromium',args:['--no-sandbox']} },
  webServer:{command:'ASTRO_TELEMETRY_DISABLED=1 npm run dev -- --host 127.0.0.1 --port 4340',url:'http://127.0.0.1:4340',reuseExistingServer:true},
});
