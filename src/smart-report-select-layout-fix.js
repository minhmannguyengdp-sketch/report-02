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
      grid-template-rows:auto auto minmax(0,1fr) auto!important;
    }
    #modal[data-type="smart-generated"] .ss-modal{
      grid-template-rows:auto auto auto minmax(0,1fr) auto!important;
    }
    #modal[data-type="smart-select"] .ss-foot,
    #modal[data-type="smart-generating"] .ss-foot,
    #modal[data-type="smart-generated"] .ss-foot{
      align-self:end!important;
    }
    #modal[data-type="smart-select"] .ss-body,
    #modal[data-type="smart-generating"] .ss-body,
    #modal[data-type="smart-generated"] .ss-body{
      min-height:0!important;
    }
  `;
}
installSmartReportSelectLayoutFix();
window.addEventListener('DOMContentLoaded',installSmartReportSelectLayoutFix);
