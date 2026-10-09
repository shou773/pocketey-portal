import {defineConfig} from '@playwright/test';import path from 'node:path';import base from '../../../playwright.config';
export default defineConfig({...base,testDir:'.',testMatch:'climax.spec.ts',outputDir:path.resolve('test-results/pulse-climax/native'),retries:0,reporter:[['list'],['json',{outputFile:'test-results/pulse-climax/report.json'}]]});
