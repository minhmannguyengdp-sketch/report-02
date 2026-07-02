function installDataMcpScrollUi(){
  let style=document.querySelector('style[data-mcp-data-scroll-ui]');
  if(!style){style=document.createElement('style');style.dataset.mcpDataScrollUi='1';document.head.appendChild(style)}
  style.textContent=`
    section.page[data-page="data"].active{display:flex!important;flex-direction:column!important;min-height:0!important;overflow:hidden!important;gap:8px!important}
    section.page[data-page="data"]>h1{display:none!important}
    section.page[data-page="data"] #dataHub{min-height:0!important;display:flex!important;flex-direction:column!important;gap:8px!important;margin:0!important}
    section.page[data-page="data"] #dataHub .data-hub-tabs{flex:0 0 auto!important;margin:0!important;display:grid!important;visibility:visible!important}
    section.page[data-page="data"].data-mode-test #dataHub{flex:0 0 auto!important;overflow:visible!important}
    section.page[data-page="data"].data-mode-shell #dataHub{flex:1 1 auto!important;overflow:hidden!important}
    section.page[data-page="data"].data-mode-test #dataShell{display:none!important}
    section.page[data-page="data"].data-mode-shell #dataShell{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important}
    section.page[data-page="data"].data-mode-shell #dataShell.active{display:flex!important;flex-direction:column!important;gap:8px!important;min-height:0!important;overflow:hidden!important}
    section.page[data-page="data"] #dataShell .data-shell-kpis,section.page[data-page="data"] #dataShell .data-shell-open-card{flex:0 0 auto!important;margin:0!important}
    section.page[data-page="data"] #dataShell .data-shell-list{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:2px 4px 18px 2px!important}
    section.page[data-page="data"].data-mode-test .data-list-wrap{display:block!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding-bottom:18px!important}
    section.page[data-page="data"].data-mode-shell .data-list-wrap{display:none!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:9px!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-actions button{width:100%!important;min-width:0!important;height:36px!important;border-radius:10px!important;font-size:10.5px!important;line-height:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;padding:0 4px!important}
  `;
}
function boot(){
  installDataMcpScrollUi();
  const page=document.querySelector('section.page[data-page="data"]');
  const tab=document.querySelector('section.page[data-page="data"] #dataHub [data-data-view].active')?.dataset?.dataView||'test';
  const shell=document.querySelector('section.page[data-page="data"] #dataShell');
  if(page){page.classList.toggle('data-mode-test',tab==='test');page.classList.toggle('data-mode-shell',tab!=='test')}
  if(shell) shell.classList.toggle('data-shell-mcp-scroll',tab==='mcp'||!!shell.querySelector('.mcp-session-card'));
}
boot();
window.addEventListener('DOMContentLoaded',boot);
document.addEventListener('click',()=>setTimeout(boot,120),true);
window.addEventListener('mcp:session-changed',()=>setTimeout(boot,120));
window.addEventListener('order:changed',()=>setTimeout(boot,120));
window.addEventListener('report:changed',()=>setTimeout(boot,120));