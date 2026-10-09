import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: '.',
  testMatch: 'rendered.spec.ts',
  outputDir: path.resolve('test-results/alpine/rendered/run'),
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/alpine/rendered/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4342',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    locale: 'ja-JP',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CI ? undefined : (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium'),
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'ASTRO_TELEMETRY_DISABLED=1 npm run preview -- --host 127.0.0.1 --port 4342',
    url: 'http://127.0.0.1:4342',
    reuseExistingServer: !process.env.CI,
  },
});
