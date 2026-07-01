function installSmartReportSelectLayoutFix(){
  let style=document.querySelector('style[data-smart-report-select-layout-fix]');
  if(!style){
    style=document.createElement('style');
    style.dataset.smartReportSelectLayoutFix='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    #modal[data-type="smart-select"] .ss-modal,
    #modal[data-type="smart-generating"] .ss-modal{
      grid-template-rows:auto auto minmax(0,1fr)!important;
    }
    #modal[data-type="smart-generated"] .ss-modal{
      grid-template-rows:auto auto auto minmax(0,1fr)!important;
    }
    #modal[data-type="smart-select"] .ss-body,
    #modal[data-type="smart-generating"] .ss-body,
    #modal[data-type="smart-generated"] .ss-body{
      min-height:0!important;
      padding-bottom:86px!important;
    }
    #modal[data-type="smart-select"] .ss-foot,
    #modal[data-type="smart-generating"] .ss-foot,
    #modal[data-type="smart-generated"] .ss-foot{
      position:fixed!important;
      left:0!important;
      right:0!important;
      bottom:0!important;
      z-index:99999!important;
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      padding:10px 12px calc(10px + env(safe-area-inset-bottom))!important;
      background:#fff!important;
      border-top:1px solid #dce8e5!important;
      box-shadow:0 -10px 24px rgba(12,55,50,.10)!important;
    }
    #modal[data-type="smart-select"] .ss-foot button,
    #modal[data-type="smart-generating"] .ss-foot button,
    #modal[data-type="smart-generated"] .ss-foot button{
      min-height:44px!important;
      height:44px!important;
    }
  `;
}
installSmartReportSelectLayoutFix();
window.addEventListener('DOMContentLoaded',installSmartReportSelectLayoutFix);
