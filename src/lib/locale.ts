export type Language = 'ja' | 'en';
export const LANGUAGE_KEY = 'pocketey-language-v1';
export const LANGUAGE_EVENT = 'pocketey-languagechange';
export const language = (): Language => document.documentElement.lang === 'ja' ? 'ja' : 'en';
export const tr = (ja: string, en: string) => language() === 'ja' ? ja : en;
let installed = false;
function apply() {
 const lang=language();
 document.querySelectorAll<HTMLImageElement>('img[data-alt-ja]').forEach(e=>{e.alt=e.dataset[lang==='ja'?'altJa':'altEn']!;});
 document.querySelectorAll<HTMLOptionElement>('option[data-option-ja]').forEach(e=>{e.textContent=e.dataset[lang==='ja'?'optionJa':'optionEn']!;});
 const title=document.querySelector<HTMLTitleElement>('title[data-ja]');if(title)document.title=title.dataset[lang]!;
 document.querySelectorAll<HTMLMetaElement>('meta[data-ja]').forEach(e=>{e.content=e.dataset[lang]!;});
 document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.language===lang)));
 document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a=>{const raw=a.getAttribute('href')!;if(raw.startsWith('#')||a.hasAttribute('data-no-locale'))return;const url=new URL(raw,location.href);if(url.origin===location.origin&&!url.pathname.startsWith('/games/assets/')){url.searchParams.set('lang',lang);a.href=url.pathname+url.search+url.hash;}});
}
export function chooseLanguage(lang: Language) {
 document.documentElement.lang=lang;
 try{localStorage.setItem(LANGUAGE_KEY,lang);}catch{/* The language still works for this page and its links. */}
 const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
 apply();window.dispatchEvent(new Event(LANGUAGE_EVENT));
}
export function installLocale() {
 if(installed)return;installed=true;apply();
 document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(b=>b.addEventListener('click',()=>chooseLanguage(b.dataset.language as Language)));
 window.addEventListener('storage',e=>{if(e.key===LANGUAGE_KEY&&(e.newValue==='ja'||e.newValue==='en'))chooseLanguage(e.newValue);});
}
