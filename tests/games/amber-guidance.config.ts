import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from '../../playwright.config';
export default defineConfig({...base,testDir:'.',testMatch:'amber-guidance.spec.ts',outputDir:path.resolve('test-results/amber-guidance/native'),retries:0,
  reporter:[['list'],['json',{outputFile:'test-results/amber-guidance/report.json'}]]});
