import type {Page} from '@playwright/test';
/** Test-only recorder: mirrors the delivered mix; leaves the speaker connection intact. */
export async function installAudioCapture(page:Page){
 await page.addInitScript(()=>{
  const original=AudioNode.prototype.connect;let recorder:MediaRecorder|undefined;const chunks:Blob[]=[];
  AudioNode.prototype.connect=function(this:AudioNode,destination:AudioNode|AudioParam,...args:number[]){
   const result=(original as Function).call(this,destination,...args);
   if(destination===this.context.destination&&!recorder){
    const context=this.context as AudioContext, mirror=context.createMediaStreamDestination();
    (original as Function).call(this,mirror);
    const canvas=document.querySelector<HTMLCanvasElement>('canvas')!;
    const stream=new MediaStream([...canvas.captureStream(30).getVideoTracks(),...mirror.stream.getAudioTracks()]);
    recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:1000000,audioBitsPerSecond:128000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(250);
    (window as any).__stopGameCapture=()=>new Promise<string>(resolve=>{recorder!.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:recorder!.mimeType}).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);resolve(btoa(binary));stream.getTracks().forEach(t=>t.stop());};recorder!.stop();});
   }
   return result;
  } as typeof AudioNode.prototype.connect;
 });
}
export async function stopAudioCapture(page:Page):Promise<Buffer>{const encoded=await page.evaluate(()=>(window as any).__stopGameCapture());return Buffer.from(encoded,'base64');}
