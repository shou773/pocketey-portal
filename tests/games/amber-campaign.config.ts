import {defineConfig} from '@playwright/test';
import path from 'node:path';
import base from '../../playwright.config';
export default defineConfig({...base,testDir:'.',testMatch:'amber-campaign.spec.ts',outputDir:path.resolve('test-results/amber-campaign/native'),retries:0,
 reporter:[['list'],['json',{outputFile:'test-results/amber-campaign/report.json'}]]});
