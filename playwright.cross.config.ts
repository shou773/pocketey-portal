import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/games', testMatch:'**/cross-browser.spec.ts', timeout:120000,
  workers:1, retries:0,
  reporter:[['list'],['json',{outputFile:'cross-results/report.json'}]],
  outputDir:'cross-results',
  use:{baseURL:'http://127.0.0.1:4322',viewport:{width:390,height:844},deviceScaleFactor:1,screenshot:'only-on-failure'},
  projects:[{name:'webkit',use:{browserName:'webkit'}},{name:'firefox',use:{browserName:'firefox'}}],
  webServer:{command:'ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4322',url:'http://127.0.0.1:4322',reuseExistingServer:!process.env.CI}
});
