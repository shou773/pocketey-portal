import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: ['browser.spec.ts', 'campaign.spec.ts', 'choice.spec.ts'], outputDir: path.resolve('test-results/conveyor/run'),
  timeout: 45000, expect: { timeout: 10000 }, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/conveyor/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4341', viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1, locale: 'ja-JP',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (process.env.CI ? undefined : '/usr/bin/chromium'),
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4341', url: 'http://127.0.0.1:4341', reuseExistingServer: true },
});

