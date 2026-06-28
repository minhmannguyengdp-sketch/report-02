async function boot(){const res=await fetch('/api/config',{cache:'no-store'}).catch(()=>null);const data=res&&res.ok?await res.json():{};console.log('runtime config loaded',Boolean(data.supabaseUrl),Boolean(data.aiConfigured));}
boot();
