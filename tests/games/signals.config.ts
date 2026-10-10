import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';
export default defineConfig({...base,testDir:'.',testMatch:'signals.spec.ts',outputDir:'../../test-results/orbit-signals/run',retries:0,reporter:[['list'],['json',{outputFile:'test-results/orbit-signals/report.json'}]]});
