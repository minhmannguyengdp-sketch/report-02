function installTestDataCardStyle(){
  let style=document.querySelector('style[data-test-data-card-ui]');
  if(!style){
    style=document.createElement('style');
    style.dataset.testDataCardUi='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    section.page[data-page="data"] #dataList .record{grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important;gap:8px!important;padding:10px!important;overflow:hidden!important}
    section.page[data-page="data"] #dataList .record>div{min-width:0!important;overflow:hidden!important}
    section.page[data-page="data"] #dataList .record h3{margin:0!important;font-size:14px!important;line-height:1.25!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    section.page[data-page="data"] #dataList .record p{margin:4px 0 0!important;font-size:12px!important;line-height:1.2!important;color:#17343d!important}
    section.page[data-page="data"] #dataList .record small{display:block!important;margin-top:4px!important;font-size:11px!important;line-height:1.2!important;color:#63727c!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    section.page[data-page="data"] #dataList .record aside{min-width:72px!important;display:flex!important;justify-content:flex-end!important}
    section.page[data-page="data"] #dataList .record .sync{font-size:10px!important;line-height:1!important;white-space:nowrap!important}
    section.page[data-page="data"] #dataList .record .test-actions{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;align-items:center!important;justify-content:stretch!important;width:100%!important;max-width:100%!important;margin-top:8px!important;overflow:hidden!important}
    section.page[data-page="data"] #dataList .record .test-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;height:30px!important;min-height:30px!important;max-height:30px!important;padding:0 4px!important;border-radius:9px!important;font-size:10.5px!important;line-height:1!important;font-weight:850!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:grid!important;place-items:center!important}
    section.page[data-page="data"] #dataList .record .test-actions .test-export-btn{border-color:#188733!important;color:#188733!important;background:#f4fff6!important}
    section.page[data-page="data"] #dataList .record .test-actions .test-delete-inline{border-color:#f4c7c7!important;color:#c62828!important;background:#fff7f7!important}
    @media(max-width:380px){section.page[data-page="data"] #dataList .record{grid-template-columns:1fr!important}section.page[data-page="data"] #dataList .record aside{justify-content:flex-start!important}section.page[data-page="data"] #dataList .record .test-actions button{font-size:10px!important}}
  `;
}
function normalizeTestActions(){
  document.querySelectorAll('section.page[data-page="data"] #dataList .record').forEach((record)=>{
    const actions=record.querySelector('.test-actions');
    if(!actions)return;
    record.querySelectorAll('button').forEach((button)=>{
      const text=(button.textContent||'').trim().toLowerCase();
      if(text==='xóa'||text==='xoá'||button.dataset.deleteTest||button.dataset.testDelete){
        if(!actions.contains(button))actions.appendChild(button);
        button.classList.add('test-delete-inline');
      }
    });
  });
}
function boot(){
  installTestDataCardStyle();
  normalizeTestActions();
  const list=document.querySelector('section.page[data-page="data"] #dataList');
  if(list&&!list.dataset.testCardUiWatch){
    list.dataset.testCardUiWatch='1';
    new MutationObserver(normalizeTestActions).observe(list,{childList:true,subtree:true});
  }
}
boot();
window.addEventListener('DOMContentLoaded',boot);
document.addEventListener('click',()=>setTimeout(normalizeTestActions,40),true);
