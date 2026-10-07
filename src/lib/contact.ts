import {installLocale,language,LANGUAGE_EVENT,tr} from './locale';
type Turnstile = {render:(target:string,options:Record<string,unknown>)=>string;reset:(id:string)=>void;remove:(id:string)=>void};
declare global {interface Window {turnstile?:Turnstile}}
export function installContact(){
 installLocale();
 const form=document.querySelector<HTMLFormElement>('#contact-form')!;
 const category=document.querySelector<HTMLSelectElement>('#contact-type')!;
 const pageUrl=document.querySelector<HTMLInputElement>('#page-url')!;
 const button=document.querySelector<HTMLButtonElement>('#submit-button')!;
 const status=document.querySelector<HTMLElement>('#form-status')!;
 const security=document.querySelector<HTMLElement>('#security-note')!;
 const params=new URLSearchParams(location.search);
 const typeMap:Record<string,string>={site:'Site problem',info:'Incorrect or outdated information',general:'General inquiry'};
 function prefill(){const type=params.get('type');if(type&&typeMap[type])category.value=typeMap[type];pageUrl.value=params.get('url')||'';}
 prefill();
 let widgetId:string|null=null,token='',sending=false;
 let securityState:'waiting'|'ready'|'expired'|'failed'='waiting',statusState:'idle'|'sending'|'success'|'security'|'failed'='idle';
 function labels(){
  button.textContent=sending?tr('送信中…','Sending…'):tr('メッセージを送る','Send message');
  const notes={waiting:tr('迷惑送信対策の確認を待っています。','Waiting for the security check.'),ready:tr('セキュリティ確認が完了しました。','Security check complete.'),expired:tr('確認が期限切れになりました。自動で再確認します。','The security check expired. It is refreshing automatically.'),failed:tr('セキュリティ確認を読み込めませんでした。ページを再読み込みするか、下記メールをご利用ください。','The security check could not load. Reload the page or use the email address below.')};
  security.textContent=notes[securityState];security.classList.toggle('error',securityState==='failed');
  const messages={idle:'',sending:tr('送信しています…','Sending your message…'),success:tr('メッセージを送信しました。ありがとうございます。','Thanks — your message has been sent.'),security:tr('セキュリティ確認が完了してから送信してください。','Please wait for the security check before sending.'),failed:tr('送信できませんでした。もう一度お試しいただくか、contact@pocketey.comへメールでご連絡ください。','The message could not be sent. Try again or email contact@pocketey.com.')};
  status.textContent=messages[statusState];status.className='form-status '+(statusState==='success'?'success':['failed','security'].includes(statusState)?'error':'');
  document.querySelector<HTMLTextAreaElement>('#message')!.placeholder=tr('ゲーム名・ステージ・端末・ブラウザと、起きたことを教えてください。','Tell us the game, stage, device, browser and what happened.');
 }
 function render(){
  if(!window.turnstile||widgetId!==null)return;
  try{widgetId=window.turnstile.render('#turnstile-widget',{sitekey:'0x4AAAAAAEnkLqsp7oNIcKXj',action:'contact',theme:'light',size:'compact',language:language(),retry:'auto','retry-interval':3000,'refresh-expired':'auto','refresh-timeout':'auto','feedback-enabled':false,callback:(value:string)=>{token=value;securityState='ready';labels();},'expired-callback':()=>{token='';securityState='expired';labels();},'timeout-callback':()=>{token='';securityState='expired';labels();},'error-callback':()=>{token='';securityState='failed';labels();}});}catch{securityState='failed';labels();}
 }
 document.querySelector('script[data-turnstile]')?.addEventListener('load',render);
 document.querySelector('script[data-turnstile]')?.addEventListener('error',()=>{securityState='failed';labels();});
 render();const started=Date.now();const poll=setInterval(()=>{render();if(widgetId!==null||Date.now()-started>10000){clearInterval(poll);if(widgetId===null){securityState='failed';labels();}}},150);
 function resetSecurity(){token='';securityState='waiting';if(widgetId!==null&&window.turnstile){try{window.turnstile.reset(widgetId);}catch{securityState='failed';}}labels();}
 window.addEventListener(LANGUAGE_EVENT,()=>{if(widgetId!==null&&window.turnstile){try{window.turnstile.remove(widgetId);}catch{}widgetId=null;token='';securityState='waiting';render();}labels();});labels();
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending)return;statusState='idle';labels();
  if(!form.checkValidity()){form.reportValidity();return;}
  if(!token){statusState='security';labels();return;}
  const value=(id:string)=>form.querySelector<HTMLInputElement|HTMLTextAreaElement>(id)?.value||'';
  const payload={name:value('#name'),email:value('#email'),category:category.value,pageUrl:pageUrl.value,message:value('#message'),website:value('#website'),turnstileToken:token};
  sending=true;button.disabled=true;statusState='sending';labels();
  try{const response=await fetch('https://pocketey-contact.shishiyo1.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error('Contact request failed');form.reset();prefill();statusState='success';resetSecurity();}catch{statusState='failed';resetSecurity();}finally{sending=false;button.disabled=false;labels();}
 });
}
