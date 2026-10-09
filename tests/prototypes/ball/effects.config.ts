import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({ ...base, testMatch: 'effects.spec.ts', outputDir: 'test-results/ball-effects/run', reporter: [['list'], ['json', { outputFile: 'test-results/ball-effects/report.json' }]] });