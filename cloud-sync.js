// THL AI Interviewer — optional Supabase cloud sync for GitHub Pages.
// Requires supabase-config.js and supabase-schema.sql; until configured, local
// checklist and JSON backup/restore continue working independently.
// Public publishable key only; NEVER put any service-role/secret key in this repo.
const statusEl=document.getElementById('cloudStatus');
const study=window.THLStudy;
const config=window.THL_SUPABASE_CONFIG||{};
const storage=window.localStorage;
const pendingKey='thl_study_cloud_pending_v1';
const ownerKey='thl_study_cloud_owner_v1';
const validIds=new Set(study.ids());
// Keep prior 35-day lecture/checklist IDs readable and backed up after changing the UI.
// Never treat legacy flags as completion of new section checkpoints.
const legacyId=/^(?:d\d{1,2}[tw]\d{1,2}|p\d{1,2}|[KR]\d{1,2}|ref\d{1,2})$/;
const allowedId=id=>validIds.has(id)||legacyId.test(id);
let client=null, signedUser=null, busy=false, ready=false;
const getJSON=(key)=>{try{const v=JSON.parse(storage.getItem(key)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return {}}};
const storeJSON=(key,v)=>{try{storage.setItem(key,JSON.stringify(v))}catch{}};
const status=(message)=>{if(statusEl)statusEl.textContent=message};
const isConfigured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url||'')&&/^sb_publishable_|^eyJ/.test(config.publishableKey||'');
function queueChange(id,checked){
 if(!allowedId(id))return;
 const p=getJSON(pendingKey);
 p[id]=Boolean(checked);
 storeJSON(pendingKey,p);
 if(signedUser)syncNow().catch(e=>status('Cloud sync failed; changes saved locally: '+e.message));
}
window.addEventListener('thl-progress-change',e=>{
 if(typeof e.detail?.id==='string')queueChange(e.detail.id,e.detail.checked);
});
window.addEventListener('thl-theme-change',()=>{if(signedUser)syncTheme().catch(()=>status('Theme saved locally; cloud update pending.'))});
window.addEventListener('thl-cloud-action',e=>{
 const name=e.detail?.name;
 if(name==='login')emailLogin(e.detail?.email||'').catch(err=>status('Sign in failed: '+err.message));
 if(name==='sync')syncNow().catch(err=>status('Sync failed: '+err.message));
 if(name==='logout')signOut().catch(err=>status('Sign out failed: '+err.message));
});
async function emailLogin(email){
 if(!ready){status('Supabase is not configured yet. Follow SUPABASE_SETUP.md first.');return}
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('Enter a valid email address to receive a sign-in link.');return}
 status('Sending sign-in link…');
 const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error)throw error;
 status('Check your email for a sign-in link. Open it in the same browser to complete login.');
}
async function syncTheme(){
 if(!signedUser||!client)return;
 const {error}=await client.from('thl_study_preferences').upsert({user_id:signedUser.id,theme:study.getTheme(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
 if(error)throw error;
}
async function syncNow(){
 if(!ready||!client){status('Cloud sync is not configured; your browser progress is still saved.');return}
 if(!signedUser){status('Please sign in to synchronize across browsers.');return}
 if(busy)return;
 busy=true;
 status('Syncing cloud progress…');
 try{
  // After account switching, prevent cross-account transfer of local data.
  let owner=storage.getItem(ownerKey);
  if(owner&&owner!==signedUser.id){storeJSON(pendingKey,{});study.applyRemote({},'light');owner=null}
  const {data:cloud,error:readError}=await client.from('thl_study_items').select('item_id,checked').eq('user_id',signedUser.id);
  if(readError)throw readError;
  const remote={};for(const row of cloud||[])if(allowedId(row.item_id))remote[row.item_id]=row.checked===true;
  const local=study.getState();
  const pending=getJSON(pendingKey);
  const updates={};
  if(!owner){
    // Migration: seed ONLY checked local items missing in cloud, never
    // overwrite an already stored remote false/true on another browser.
    for(const [id,value] of Object.entries(local))if(allowedId(id)&&value===true&&!(id in remote))updates[id]=true;
  }
  // If already signed in, synchronize older checked IDs absent from the cloud rather than discarding them.
  if(owner===signedUser.id){for(const [id,value] of Object.entries(local))if(legacyId.test(id)&&value===true&&!(id in remote))updates[id]=true;}
  if(!owner||owner===signedUser.id)for(const [id,value] of Object.entries(pending))if(allowedId(id))updates[id]=value===true;
  if(Object.keys(updates).length){
   const rows=Object.entries(updates).map(([item_id,checked])=>({user_id:signedUser.id,item_id,checked,updated_at:new Date().toISOString()}));
   const {error:writeError}=await client.from('thl_study_items').upsert(rows,{onConflict:'user_id,item_id'});
   if(writeError)throw writeError;
   Object.assign(remote,updates);
  }
  // Mark local changes as completed only if not modified while the request was in-flight.
  const latest=getJSON(pendingKey);
  for(const [id,checked] of Object.entries(pending))if(latest[id]===checked)delete latest[id];
  storeJSON(pendingKey,latest);
  let cloudTheme=null;
  const {data:pref,error:prefError}=await client.from('thl_study_preferences').select('theme').eq('user_id',signedUser.id).maybeSingle();
  if(prefError)throw prefError;
  if(pref?.theme==='light'||pref?.theme==='dark')cloudTheme=pref.theme;
  if(!cloudTheme||!owner){
    // First device migration: keep existing theme only if cloud has no preference.
    if(!cloudTheme){cloudTheme=study.getTheme();await syncTheme()}
  }
  study.applyRemote({...remote,...latest},cloudTheme);
  storage.setItem(ownerKey,signedUser.id);
  status('✅ Synced with Supabase · '+signedUser.email+' · '+new Date().toLocaleTimeString());
 }catch(e){
  status('⚠️ Not synced. Local progress is preserved. '+e.message);
  throw e;
 }finally{
  busy=false;
 }
 // Handle local changes made while a network request was in progress.
 if(Object.keys(getJSON(pendingKey)).length)await syncNow();
}
async function signOut(){
 if(!client)return;
 const {error}=await client.auth.signOut();if(error)throw error;
 signedUser=null;status('Signed out. Browser-only progress remains on this device.');
}
async function initialize(){
 if(!isConfigured()){
  status('Local-only mode. To enable cloud sync, configure the Supabase project and publishable key from the setup guide. Backup/restore is available now.');
  return;
 }
 try{
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  ready=true;
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(session?.user){signedUser=session.user;await syncNow()}else status('Supabase configured. Sign in with your email to sync across browsers.');
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN'&&session?.user){
     signedUser=session.user;
     // Defer Supabase operations outside auth state callback to avoid deadlocks.
     Promise.resolve().then(()=>syncNow()).catch(()=>{});
    }else if(event==='SIGNED_OUT'){
     signedUser=null;
     status('Signed out. Your local backup and saved progress remain available.');
    }
  });
 }catch(err){ready=false;status('Cloud sync unavailable; browser progress still works. '+err.message)}
}
initialize();
