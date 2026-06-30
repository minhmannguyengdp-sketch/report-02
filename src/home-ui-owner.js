function installHomeUi(){
  let style=document.querySelector('style[data-home-ui-owner]');
  if(!style){
    style=document.createElement('style');
    style.dataset.homeUiOwner='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    .top{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:60!important;height:0!important;min-height:0!important;padding:0 14px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:block!important;pointer-events:none!important}
    .top .brand{display:none!important}
    main{height:100dvh!important;padding:12px 12px 86px!important}
    section.page[data-page="create"]{position:relative!important;overflow:hidden!important;isolation:isolate!important;background:linear-gradient(180deg,#fbfffd 0%,#f4fbf8 46%,#eff8f4 100%)!important}
    section.page[data-page="create"]::before{content:"";position:absolute;left:0;right:0;bottom:72px;height:48%;z-index:-1;pointer-events:none;opacity:.52;background-image:linear-gradient(180deg,rgba(245,250,248,0) 0%,rgba(245,250,248,.18) 14%,rgba(245,250,248,.62) 82%,rgba(245,250,248,.86) 100%),url("../wallpaper-home.png");background-repeat:no-repeat;background-position:center bottom;background-size:min(96vw,430px) auto;filter:saturate(.92);}
    section.page[data-page="create"]::after{content:"";position:absolute;left:0;right:0;bottom:72px;height:44%;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(245,250,248,.86) 0%,rgba(245,250,248,.18) 22%,rgba(245,250,248,0) 54%)}
    section.page[data-page="create"] .grid-actions{position:relative!important;z-index:1!important;margin-bottom:0!important}
    section.page[data-page="create"] .panel{display:none!important}
  `;
}
installHomeUi();
window.addEventListener('DOMContentLoaded',installHomeUi);
