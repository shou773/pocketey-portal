import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'browser.spec.ts', outputDir: 'test-results/ball/run', timeout: 240000, workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/ball/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4335', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, locale: 'ja-JP',
    launchOptions: { executablePath: process.env.CI ? undefined : '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4335', url: 'http://127.0.0.1:4335', reuseExistingServer: true },
});
