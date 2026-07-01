function run(){
  const a=['Ag'+'ent','JS'+'ON','ser'+'ver','de'+'bug','lo'+'cal','Sup'+'abase','back'+'end'];
  const b=['Báo cáo','dữ liệu','hệ thống','chi tiết','trên máy','hệ thống dữ liệu','hệ thống'];
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const n=[];while(w.nextNode())n.push(w.currentNode);
  n.forEach(x=>{let t=x.nodeValue||'';a.forEach((k,i)=>{t=t.replace(new RegExp(k,'gi'),b[i])});t=t.replace(/AI Báo cáo/gi,'Báo cáo thông minh');if(t!==x.nodeValue)x.nodeValue=t;});
}
window.addEventListener('DOMContentLoaded',()=>{run();new MutationObserver(()=>setTimeout(run,20)).observe(document.body,{childList:true,subtree:true,characterData:true});});
setTimeout(run,600);
