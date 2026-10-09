import { defineConfig } from '@playwright/test';
import original from './playwright.config';
export default defineConfig({...original,testMatch:'courses.spec.ts',outputDir:'test-results/tilt-courses/run',retries:0,reporter:[['list'],['json',{outputFile:'test-results/tilt-courses/report.json'}]]});
