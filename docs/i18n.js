/* Shared language preference and translation of registered interface copy. */
(() => {
  'use strict';
  const choices={en:'English',ko:'한국어',de:'Deutsch'};
  const key='night-studies.language';
  const normalize=value=>String(value||'').toLowerCase().split('-')[0];
  const preferred=new URL(location.href).searchParams.get('lang');
  let saved;
  try{saved=localStorage.getItem(key);}catch{}
  let lang=[preferred,saved,...(navigator.languages||[navigator.language])].map(normalize).find(k=>Object.hasOwn(choices,k))||'en';
  if(Object.hasOwn(choices,normalize(preferred)))try{localStorage.setItem(key,lang);}catch{}
  document.documentElement.lang=lang;
  const entries=new Map(), originals=new Map();
  const attributes=['alt','aria-label','aria-description','aria-valuetext','placeholder','title','content'];
  const omit='script,style,textarea,noscript,[contenteditable=true],[translate=no],[data-no-i18n],[data-language-picker]';
  const t=(ko,en,de)=>({ko,en,de})[lang]??ko;
  function text(value){
    if(typeof value!=='string')return value;
    const stripped=value.trim(),id=entries.has(stripped)?stripped:originals.get(stripped);
    if(!id)return value;
    const [en,de]=entries.get(id);
    return value.replace(stripped,()=>t(id,en,de));
  }
  function add(dictionary){
    for(const [ko,row] of Object.entries(dictionary)){
      if(!Array.isArray(row)||row.length!==2)continue;
      entries.set(ko,row);
      for(const val of row)if(!originals.has(val))originals.set(val,ko);
    }
    if(document.readyState!=='loading')apply(document.documentElement);
  }
  function updatePicker(host){
    let selector=host.querySelector('select');
    if(!selector){
      selector=document.createElement('select');selector.className='ns-language';selector.setAttribute('translate','no');
      for(const [value,label] of Object.entries(choices)){const item=document.createElement('option');item.value=value;item.lang=value;item.textContent=label;selector.append(item);}
      selector.addEventListener('change',()=>setLanguage(selector.value));host.append(selector);
    }
    selector.value=lang;selector.setAttribute('aria-label',t('언어','Language','Sprache'));selector.title=t('언어 변경','Change language','Sprache wechseln');
  }
  function translateNode(node){
    if(node.nodeType===Node.TEXT_NODE){
      if(!node.parentElement || node.parentElement.closest(omit))return;
      const out=text(node.data);if(out!==node.data)node.data=out;
    }else if(node.nodeType===Node.ELEMENT_NODE){
      if(node.matches('[data-language-picker]')){updatePicker(node);return;}
      if(node.closest(omit))return;
      // Preserve the form value of options without explicit values when translating labels.
      if(node.tagName==='OPTION' && !node.hasAttribute('value'))node.value=node.value;
      for(const attr of attributes){
        if(!node.hasAttribute(attr) || (attr==='content' && !node.matches('meta[name=description]')))continue;
        const orig=node.getAttribute(attr),out=text(orig);if(orig!==out)node.setAttribute(attr,out);
      }
    }
  }
  function apply(root=document.body){
    if(!root)return;
    translateNode(root);
    if(root.nodeType!==Node.ELEMENT_NODE || root.closest(omit))return;
    const walk=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        if(node.nodeType===Node.ELEMENT_NODE && node.matches(omit) && !node.hasAttribute('data-language-picker'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    for(let n=walk.nextNode();n;n=walk.nextNode())translateNode(n);
  }
  function setLanguage(value){
    if(!Object.hasOwn(choices,value))return;
    lang=value;document.documentElement.lang=lang;
    try{localStorage.setItem(key,lang);}catch{}
    const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(history.state,'',url);
    apply(document.documentElement);
    document.dispatchEvent(new CustomEvent('night-language',{detail:{lang}}));
  }
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('language.css',document.currentScript.src);document.head.append(css);
  window.NightI18n={get lang(){return lang;},t,text,add,apply,setLanguage};
  function init(){
    apply(document.documentElement);
    new MutationObserver(records=>{
      for(const rec of records){
        if(rec.type==='childList')rec.addedNodes.forEach(apply);
        else translateNode(rec.target);
      }
    }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
