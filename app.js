const SUPABASE_URL = "https://fsolcdaawifreskqwrbq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5-I1KyTcCnbDQjXcwEB4kw_isI7q_nN";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let communityVideos = [];
const byId = id => document.getElementById(id);
const message = (id, text) => { const el=byId(id); if(el) el.textContent=text; };
const notify = text => {
  const toast=byId("toast");
  if(toast){toast.textContent=text;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),3000);}
};

function showAuth(mode) {
  byId("authHeading").textContent = mode==="login" ? "Welcome back" : "Create your account";
  byId("authSubmit").textContent = mode==="login" ? "Log in" : "Create account";
  byId("usernameLabel").hidden = mode==="login";
  byId("authUsername").hidden = mode==="login";
  byId("authUsername").required = mode!=="login";
  byId("authModal").dataset.mode=mode;
  message("authError","");
  byId("authModal").hidden=false;
}
function updateAccountUI(){
  byId("loginBtn").hidden=!!currentUser;
  byId("signupBtn").hidden=!!currentUser;
  byId("logoutBtn").hidden=!currentUser;
  byId("communityStatus").textContent=currentUser ? "Signed in" : "Public videos";
}

async function loadCommunityVideos(){
  const grid=byId("communityGrid");
  if(!grid) return;
  message("communityStatus","Loading videos...");
  const {data,error}=await db.from("videos").select("id,title,description,storage_path,thumbnail_path,user_id,uploader_name,created_at").order("created_at",{ascending:false}).limit(60);
  if(error){grid.textContent="Couldn't load videos: "+error.message;message("communityStatus","Unavailable");return;}
  communityVideos=data||[];
  renderCommunityVideos();
  message("communityStatus",data.length+" videos");
}

function renderCommunityVideos(){
  const grid=byId("communityGrid");
  const term=(byId("videoSearch")?.value||"").trim().toLowerCase();
  const filtered=communityVideos.filter(video=>[video.title,video.description,video.uploader_name].some(value=>(value||"").toLowerCase().includes(term)));
  grid.innerHTML="";
  if(!filtered.length){grid.innerHTML='<div class="empty-state"><h3>No community videos yet</h3><p>Be the first to share a video.</p></div>';message("communityStatus",term?"No matches":"0 videos");return;}
  for(const video of filtered){
    const publicUrl=db.storage.from("videos").getPublicUrl(video.storage_path).data.publicUrl;
    const card=document.createElement("article");card.className="community-video";card.dataset.videoId=video.id;card.dataset.ownerId=video.user_id;
    const player=document.createElement("video");player.controls=true;player.playsInline=true;player.preload="metadata";player.src=publicUrl;
    if(video.thumbnail_path){player.poster=db.storage.from("videos").getPublicUrl(video.thumbnail_path).data.publicUrl;}
    const title=document.createElement("h3");title.textContent=video.title||"Untitled video";
    const description=document.createElement("p");description.textContent=video.description||"";
    const uploader=document.createElement("p");uploader.className="video-uploader";uploader.textContent="Uploaded by "+(video.uploader_name||"YouWatch user");
    card.append(player,title,description,uploader);
    if(currentUser && currentUser.id===video.user_id){
      const remove=document.createElement("button");remove.className="soft-button";remove.textContent="Delete my video";
      remove.onclick=()=>deleteCommunityVideo(video);card.append(remove);
    }
    grid.append(card);
  }
  message("communityStatus",filtered.length+" of "+communityVideos.length+" videos");
}

async function deleteCommunityVideo(video){
  if(!confirm("Delete this video from the public community?")) return;
  const {error:rowError}=await db.from("videos").delete().eq("id",video.id).eq("user_id",currentUser.id);
  if(rowError){notify(rowError.message);return;}
  const {error:fileError}=await db.storage.from("videos").remove([video.storage_path]);
  if(fileError) notify("Video entry deleted, but its stored file could not be removed: "+fileError.message);
  else notify("Video deleted.");
  loadCommunityVideos();
}

async function handleAuth(event){
  event.preventDefault();
  const mode=byId("authModal").dataset.mode;
  const email=byId("authEmail").value.trim();
  const password=byId("authPassword").value;
  message("authError","");
  byId("authSubmit").disabled=true;
  try{
    if(mode==="login"){
      const {error}=await db.auth.signInWithPassword({email,password});
      if(error) throw error;
      byId("authModal").hidden=true;byId("authForm").reset();notify("You're logged in!");
    }else{
      const username=byId("authUsername").value.trim();
      const {data,error}=await db.auth.signUp({email,password,options:{data:{username}}});
      if(error) throw error;
      if(data.session){byId("authModal").hidden=true;notify("Account created!");}
      else message("authError","Account created. Check your email to confirm, then log in.");
    }
  }catch(error){message("authError",error.message||"Something went wrong.");}
  finally{byId("authSubmit").disabled=false;}
}

async function handleCloudUpload(event){
  event.preventDefault();
  message("cloudUploadError","");
  if(!currentUser){byId("cloudUploadModal").hidden=true;showAuth("login");return;}
  const file=byId("cloudFile").files[0];
  const thumbnail=byId("cloudThumbnail")?.files?.[0]||null;
  const title=byId("cloudTitle").value.trim();
  const description=byId("cloudDescription").value.trim();
  if(!file){message("cloudUploadError","Choose a video file.");return;}
  if(!["video/mp4","video/webm","video/quicktime"].includes(file.type)){message("cloudUploadError","Please choose an MP4, WebM, or MOV video.");return;}
  if(file.size>50*1024*1024){message("cloudUploadError","This file is over the 50 MB limit.");return;}
  if(thumbnail && !["image/jpeg","image/png","image/webp"].includes(thumbnail.type)){message("cloudUploadError","Thumbnail must be JPG, PNG, or WebP.");return;}
  if(thumbnail && thumbnail.size>5*1024*1024){message("cloudUploadError","Thumbnail must be under 5 MB.");return;}
  byId("cloudUploadSubmit").disabled=true;byId("cloudUploadSubmit").textContent="Uploading...";
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=currentUser.id+"/"+Date.now()+"-"+safeName;
  try{
    const {error:uploadError}=await db.storage.from("videos").upload(path,file,{contentType:file.type,upsert:false});
    if(uploadError) throw uploadError;
    let thumbnailPath=null;
    if(thumbnail){thumbnailPath=currentUser.id+"/thumbnails/"+Date.now()+"-"+thumbnail.name.replace(/[^a-zA-Z0-9._-]/g,"_");const {error:thumbError}=await db.storage.from("videos").upload(thumbnailPath,thumbnail,{contentType:thumbnail.type,upsert:false});if(thumbError){await db.storage.from("videos").remove([path]);throw thumbError;}}
    const {error:insertError}=await db.from("videos").insert({user_id:currentUser.id,title,description,storage_path:path,thumbnail_path:thumbnailPath,uploader_name:currentUser.user_metadata?.display_name||currentUser.user_metadata?.username||currentUser.email?.split("@")[0]||"YouWatch user"});
    if(insertError){await db.storage.from("videos").remove([path,...(thumbnailPath?[thumbnailPath]:[])]);throw insertError;}
    byId("cloudUploadModal").hidden=true;byId("cloudUploadForm").reset();notify("Your video is now public on YouWatch!");
    await loadCommunityVideos();
  }catch(error){message("cloudUploadError",error.message||"Upload failed.");}
  finally{byId("cloudUploadSubmit").disabled=false;byId("cloudUploadSubmit").textContent="Upload to YouWatch";}
}

byId("loginBtn").addEventListener("click",()=>showAuth("login"));
byId("signupBtn").addEventListener("click",()=>showAuth("signup"));
byId("logoutBtn").addEventListener("click",async()=>{const {error}=await db.auth.signOut();if(error)notify(error.message);else notify("Logged out.");});
byId("authForm").addEventListener("submit",handleAuth);
byId("cloudUploadForm").addEventListener("submit",handleCloudUpload);
byId("videoSearch")?.addEventListener("input",renderCommunityVideos);
document.querySelectorAll("[data-auth-close]").forEach(b=>b.addEventListener("click",()=>byId("authModal").hidden=true));
document.querySelectorAll("[data-upload-close]").forEach(b=>b.addEventListener("click",()=>byId("cloudUploadModal").hidden=true));
byId("authModal").addEventListener("click",e=>{if(e.target===byId("authModal"))byId("authModal").hidden=true;});
byId("cloudUploadModal").addEventListener("click",e=>{if(e.target===byId("cloudUploadModal"))byId("cloudUploadModal").hidden=true;});

// Route all upload buttons to permanent community storage instead of temporary browser-only storage.
["uploadTop","uploadCard","emptyAdd"].forEach(id=>{
  const button=byId(id);
  if(button) button.addEventListener("click",event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(!currentUser){showAuth("login");return;}
    byId("cloudUploadModal").hidden=false;
  },true);
});

db.auth.getSession().then(({data})=>{
  currentUser=data.session?.user||null;updateAccountUI();loadCommunityVideos();
});
db.auth.onAuthStateChange((_event,session)=>{
  currentUser=session?.user||null;updateAccountUI();loadCommunityVideos();
});
