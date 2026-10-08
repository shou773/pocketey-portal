// Bundle the real renderer once (including its GLTF loader), avoiding two dev
// servers sharing Vite's optimized-dependency cache and separate Three classes.
// The production site is served unchanged. The review module lives only in server memory.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=resolve(process.argv[2]||'.'),port=Number(process.argv[3]||4344);
const entry=`export {createView} from ${JSON.stringify(root+'/src/games/render.ts')}; export {createState} from ${JSON.stringify(root+'/src/games/model.ts')};`;
const result=await build({stdin:{contents:entry,resolveDir:root,loader:'ts'},absWorkingDir:root,bundle:true,format:'esm',platform:'browser',write:false});
const dist=resolve(root,'dist');
createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/orbit-review-renderer.js') {res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);return;}
  try {
    const path=resolve(dist,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!path.startsWith(dist+'/'))throw Error('Invalid path');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]||'application/octet-stream');
    res.end(readFileSync(path));
  } catch {res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Orbit review: ${root} at http://127.0.0.1:${port}`));
