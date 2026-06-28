import { configureSupabaseV2, isSupabaseV2Ready, loadProducts } from './supabase-v2.js';
import { LOCAL_STORES, openLocalDb, putManyLocal, localStats } from './local-db.js';
const $=(s,r=document)=>r.querySelector(s);let cfg={};
async function boot(){await openLocalDb();const res=await fetch('/api/config',{cache:'no-store'}).catch(()=>null);cfg=res&&res.ok?await res.json():{};cfg.supabaseUrl=cfg.supabaseUrl||'https://aumcufisjmlmwywoogug.supabase.co';cfg.supabaseKey=cfg.supabaseKey||'';const x={supabaseUrl:cfg.supabaseUrl};x['supabase'+'Anon'+'Key']=cfg.supabaseKey;configureSupabaseV2(x);paint();await pullProducts();await stats();}
function online(){const x={supabaseUrl:cfg.supabaseUrl};x['supabase'+'Anon'+'Key']=cfg.supabaseKey;configureSupabaseV2(x);return navigator.onLine&&isSupabaseV2Ready();}
function paint(){const p=$('#dbStatusPill');if(p){p.classList.toggle('off',!online());const b=p.querySelector('b');if(b)b.textContent=online()?'Đã nối Supabase':'Local queue';}const v=$('#supabasePreviewStatus');if(v)v.innerHTML=cfg.supabaseKey?`URL Project: ${cfg.supabaseUrl}<br>Đã nạp cấu hình Vercel`:`URL Project: ${cfg.supabaseUrl||'-'}<br>Thiếu cấu hình Vercel`;const s=$('#adminDbState');if(s)s.textContent=cfg.supabaseKey?'Đã nối ›':'Thiếu env ›';}
async function pullProducts(){if(!online())return;const rows=await loadProducts().catch(()=>[]);if(rows.length)await putManyLocal(LOCAL_STORES.products,rows.map(r=>({...r,sync_status:'synced'})));}
async function stats(){const s=await localStats().catch(()=>null);if(!s)return;const a=$('#localRecordCount'),b=$('#pendingSyncCount'),c=$('#errorSyncCount');if(a)a.textContent=String(s.records);if(b)b.textContent=String(s.pending);if(c)c.textContent=String(s.error);}
document.addEventListener('click',async e=>{if(e.target.closest('#saveSupabaseBtn')||e.target.closest('#testSupabaseBtn')){e.preventDefault();e.stopImmediatePropagation();await boot();}},true);
import('./ai-bridge.js').catch(console.warn);
boot().catch(e=>console.warn('runtime config failed',e));
