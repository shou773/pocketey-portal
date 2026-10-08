import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Auxiliary geometry diagnostic, never used for the native screenshot pair.
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const reports = [];
for (const [label, base] of [['before', 'http://127.0.0.1:4383'], ['after', 'http://127.0.0.1:4387']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await page.setContent('<canvas style="width:390px;height:600px"></canvas>');
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const m = await import('/src/games/model.ts'), v = await import('/src/games/render.ts');
    const scenery = await import('/src/games/amber-scenery.ts');
    const geometry = (g, paint = false) => Object.fromEntries(['position', 'normal', 'skinIndex', 'skinWeight', ...(paint ? ['color', 'colorBack'] : [])].filter(k => g.attributes[k]).map(k => [k, Array.from(g.attributes[k].array)]).concat([['indices', g.index ? Array.from(g.index.array) : []]]));
    const meshes = (group, paint = false) => {
      const entries = [];
      group.traverse(o => { if (o.isMesh) entries.push({ type: o.type, geometry: geometry(o.geometry, paint), instances: o.instanceMatrix ? Array.from(o.instanceMatrix.array) : [], matrix: o.matrixWorld.toArray(), ...(paint ? {material: {color:o.material.color?.getHex(),emissive:o.material.emissive?.getHex(),vertexShader:o.material.vertexShader,fragmentShader:o.material.fragmentShader}} : {}) }); });
      return entries;
    };
    const platforms = m.stages.amber.map(stage => stage.platforms.map(p => {
      const group = new T.Group(), g = scenery.placeSandstone(group, (p.a + p.b) / 2, p.y, p.b - p.a);
      const result = geometry(g); g.dispose(); return result;
    }));
    const entries = [];
    // Separate canvases avoid reusing a disposed WebGL context.
    for (const kind of ['amber', 'orbit']) {
      const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:390px;height:600px'; document.body.replaceChildren(canvas);
      const view = v.createView(canvas, kind); view.load(0);
      const deadline = performance.now() + 15000;
      while (canvas.dataset.artAdopted !== 'true') { if (performance.now() > deadline) throw Error('Art adoption timeout'); await new Promise(r => setTimeout(r, 20)); }
      let scene, camera; const render = view.renderer.render.bind(view.renderer);
      view.renderer.render = (s, c) => { scene = s; camera = c; render(s, c); };
      for (let stage = 0; stage < 3; stage++) {
        view.load(stage); const state = m.createState(kind, stage); state.time = 1; view.draw(state);
        const spikes = scene.children[3].children.filter(o => o.isInstancedMesh && o.geometry.type === 'ConeGeometry');
        entries.push({kind,stage,state,camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray()},
          invariant:kind==='orbit'?meshes(scene,true):{player:meshes(scene.children[5]),spikes:spikes.map(o=>({geometry:geometry(o.geometry),instances:Array.from(o.instanceMatrix.array)}))},
          calls:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles});
      }
      view.renderer.dispose();
    }
    return {platforms,entries};
  });
  // Hash complete arrays while retaining human-readable camera/count summaries.
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  result.platforms = result.platforms.map(stage => stage.map(hash));
  for (const e of result.entries) { e.invariantHash = hash(e.invariant); delete e.invariant; }
  reports.push({label,...result}); await page.close();
}
await browser.close();
const equal = JSON.stringify(reports[0].platforms) === JSON.stringify(reports[1].platforms) && reports[0].entries.every((e,i) => {
  const other = reports[1].entries[i]; return e.invariantHash === other.invariantHash && JSON.stringify(e.camera) === JSON.stringify(other.camera) && JSON.stringify(e.state) === JSON.stringify(other.state);
});
await fs.writeFile(new URL('./evidence/geometry-check.json', import.meta.url), JSON.stringify({equal,protocol:'All Amber platform positions/normals/indices, character skin attributes/transforms, spike geometry/instances and both games cameras/states. Full Orbit scene mesh geometry, vertex paint, shader source and transforms across 3 stages.',reports},null,2));
console.log(JSON.stringify({equal,counts:reports.map(r=>({label:r.label,entries:r.entries.map(({kind,stage,calls,triangles})=>({kind,stage,calls,triangles}))}))}));
if (!equal) process.exitCode=1;
