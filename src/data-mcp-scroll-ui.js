function installDataMcpScrollUi(){
  let style=document.querySelector('style[data-mcp-data-scroll-ui]');
  if(!style){style=document.createElement('style');style.dataset.mcpDataScrollUi='1';document.head.appendChild(style)}
  style.textContent=`
    section.page[data-page="data"] #dataShell .mcp-session-card .shell-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:9px!important}
    section.page[data-page="data"] #dataShell .mcp-session-card .shell-actions button{width:100%!important;min-width:0!important;height:36px!important;border-radius:10px!important;font-size:10.5px!important;line-height:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;padding:0 4px!important}
  `;
}
installDataMcpScrollUi();
window.addEventListener('DOMContentLoaded',installDataMcpScrollUi);