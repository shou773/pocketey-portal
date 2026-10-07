import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';
import candidate from './playwright.config';
const directory=process.env.GAME_BASELINE_DIST;
if(!directory)throw new Error('GAME_BASELINE_DIST must point to the built public main baseline');
const quoted="'"+directory.replaceAll("'","'\\''")+"'";
export default defineConfig({...candidate,
 testDir:resolve(directory,'..','tests/games'),
 grep:/three stages through normal input, unlock and persistence/,
 reporter:[['list'],['json',{outputFile:'baseline-results/report.json'}]],
 outputDir:'baseline-results',
 use:{...candidate.use,baseURL:'http://localhost:4323'},
 webServer:{command:`python3 -m http.server 4323 --bind 127.0.0.1 --directory ${quoted}`,url:'http://localhost:4323',reuseExistingServer:false}
});
