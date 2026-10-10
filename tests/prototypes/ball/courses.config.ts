import { defineConfig } from '@playwright/test';
import path from 'node:path';
import original from './playwright.config';
export default defineConfig({...original,testMatch:['courses.spec.ts','neck.spec.ts'],outputDir:path.resolve('test-results/tilt-courses/run'),retries:0,reporter:[['list'],['json',{outputFile:'test-results/tilt-courses/report.json'}]]});
