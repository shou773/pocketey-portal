import fs from 'node:fs';
import path from 'node:path';
for(const forbidden of ['src/content/news','src/pages/news','src/pages/guides','src/pages/affiliate-disclosure','public/images/news','dist/news','dist/guides','dist/affiliate-disclosure'])if(fs.existsSync(forbidden))throw new Error(`Retired travel content must not be published: ${forbidden}`);
for(const required of ['index.html','games/index.html','games/orbit-ribbon/index.html','games/amber-step/index.html','about/index.html','privacy/index.html','contact/index.html','404.html'])if(!fs.existsSync(path.join('dist',required)))throw new Error(`Missing public route: ${required}`);
const sitemap=fs.readFileSync('dist/sitemap-0.xml','utf8');if(/\/(news|guides|affiliate-disclosure|404)(\/|\.|<)/.test(sitemap))throw new Error('Retired or error routes leaked into sitemap');
if(fs.existsSync('public/ads.txt'))throw new Error('Advertising configuration is outside this release');
console.log('Portal routes and retirement guard passed.');
