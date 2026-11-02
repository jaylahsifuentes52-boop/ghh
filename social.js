(() => {
  const db = window.supabase.createClient(
    "https://fsolcdaawifreskqwrbq.supabase.co",
    "sb_publishable_5-I1KyTcCnbDQjXcwEB4kw_isI7q_nN"
  );
  const $ = id => document.getElementById(id);
  let me = null;
  const nameOf = user => user?.user_metadata?.display_name || user?.user_metadata?.username || user?.email?.split("@")[0] || "YouWatch user";
  const escapeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const style = document.createElement("style");
  style.textContent = `
    .social-author{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:12px 0 10px}
    .social-author-name{font-size:12px!important;color:#d2c5ff!important;font-weight:700}
    .follow-btn{border:1px solid #9b7bfa66;background:#8b5cf622;color:#d9caff;border-radius:99px;padding:7px 12px;font-size:11px;font-weight:800;white-space:nowrap}
    .follow-btn.following{background:#ffffff0c;border-color:#ffffff25;color:#aeb8ca}
    .social-divider{height:1px;background:#ffffff12;margin:12px 0}
    .comment-title{font-size:12px;font-weight:800;color:#e8eaff;margin-bottom:8px}
    .comment-list{display:grid;gap:8px;max-height:170px;overflow:auto;margin-bottom:10px}
    .comment-item{background:#ffffff08;border:1px solid #ffffff0d;border-radius:10px;padding:8px 10px}
    .comment-item strong{display:block;color:#cbb8ff;font-size:10px;margin-bottom:3px}
    .comment-item span{font-size:11px;color:#c1c8d7;overflow-wrap:anywhere}
    .comment-form{display:flex;gap:6px}
    .comment-form input{min-width:0;flex:1;background:#090e19;border:1px solid #ffffff1c;border-radius:10px;padding:9px;color:#fff;font:12px 'DM Sans',sans-serif}
    .comment-form button{border:0;border-radius:10px;padding:0 11px;background:linear-gradient(120deg,#8b5cf6,#4c9eaa);color:white;font-size:11px}
    .social-hint{font-size:10px;color:#8590a6;margin:6px 0 0}
    .community-video{padding:14px}
  `;
  document.head.appendChild(style);

  async function loadMe(){const {data}=await db.auth.getUser();me=data.user||null;}
  async function hydrateCards(){
    await loadMe();
    document.querySelectorAll(".community-video").forEach(card=>{
      if(card.dataset.socialReady==="1") return;
      const matchedVideo=(typeof communityVideos!=="undefined"?communityVideos:[]).find(v=>v.title===(card.querySelector("h3")?.textContent||"Untitled video"));
      const videoId=card.dataset.videoId || matchedVideo?.id, ownerId=card.dataset.ownerId || matchedVideo?.user_id;
      if(!videoId) return;
      card.dataset.socialReady="1";
      const author=card.querySelector(".video-uploader");
      const authorName=author?.textContent?.replace(/^Uploaded by\s*/,"") || "YouWatch user";
      const area=document.createElement("section");area.className="social-area";
      area.innerHTML=`
        <div class="social-author"><span class="social-author-name">${escapeText(authorName)}</span><button class="follow-btn" type="button" data-follow>＋ Subscribe</button></div>
        <div class="social-divider"></div><div class="comment-title">Comments</div>
        <div class="comment-list" data-comments><span class="social-hint">Loading comments...</span></div>
        <form class="comment-form"><input maxlength="500" aria-label="Write a comment" placeholder="Add a comment..." required><button type="submit">Post</button></form>
        <p class="social-hint" data-social-hint></p>`;
      card.append(area);
      const follow=area.querySelector("[data-follow]");
      const hint=area.querySelector("[data-social-hint]");
      const comments=area.querySelector("[data-comments]");
      if(!me || !ownerId || ownerId===me.id){follow.hidden=true;}
      else {
        db.from("subscriptions").select("id",{count:"exact",head:true}).eq("subscriber_id",me.id).eq("creator_id",ownerId)
          .then(({count,error})=>{if(error){hint.textContent="Run the social setup SQL below to enable subscriptions.";return;}follow.textContent=count?"✓ Subscribed":"＋ Subscribe";follow.classList.toggle("following",!!count);});
      }
      follow.addEventListener("click",async()=>{
        if(!me){hint.textContent="Log in to subscribe.";return;}
        follow.disabled=true;
        const {data}=await db.from("subscriptions").select("id").eq("subscriber_id",me.id).eq("creator_id",ownerId).maybeSingle();
        let result;
        if(data) result=await db.from("subscriptions").delete().eq("id",data.id);
        else result=await db.from("subscriptions").insert({subscriber_id:me.id,creator_id:ownerId});
        follow.disabled=false;
        if(result.error){hint.textContent="Subscriptions need the social setup SQL in Supabase.";return;}
        const {count}=await db.from("subscriptions").select("id",{count:"exact",head:true}).eq("subscriber_id",me.id).eq("creator_id",ownerId);
        follow.textContent=count?"✓ Subscribed":"＋ Subscribe";follow.classList.toggle("following",!!count);
      });
      async function refreshComments(){
        const {data,error}=await db.from("video_comments").select("id,user_id,username,content,created_at").eq("video_id",videoId).order("created_at",{ascending:true}).limit(30);
        if(error){comments.innerHTML='<span class="social-hint">Comments will work after the Supabase social setup.</span>';return;}
        comments.innerHTML="";
        if(!data?.length){comments.innerHTML='<span class="social-hint">No comments yet. Start the conversation!</span>';return;}
        data.forEach(comment=>{
          const item=document.createElement("div");item.className="comment-item";
          const strong=document.createElement("strong");strong.textContent=comment.username||"YouWatch user";
          const span=document.createElement("span");span.textContent=comment.content;
          item.append(strong,span);
          if(me?.id===comment.user_id){const del=document.createElement("button");del.type="button";del.className="comment-delete";del.textContent="Delete";del.onclick=async()=>{await db.from("video_comments").delete().eq("id",comment.id);refreshComments();};item.append(del);}
          comments.append(item);
        });
      }
      area.querySelector(".comment-form").addEventListener("submit",async e=>{
        e.preventDefault();
        if(!me){hint.textContent="Log in to comment.";return;}
        const input=e.currentTarget.querySelector("input"),content=input.value.trim();
        if(!content)return;
        const button=e.currentTarget.querySelector("button");button.disabled=true;
        const {error}=await db.from("video_comments").insert({video_id:videoId,user_id:me.id,username:nameOf(me),content});
        button.disabled=false;
        if(error){hint.textContent="Couldn't post. Check that you ran the Supabase social setup SQL.";return;}
        input.value="";hint.textContent="Comment posted!";refreshComments();
      });
      refreshComments();
    });
  }
  const observer=new MutationObserver(()=>hydrateCards());
  const grid=$("communityGrid");
  if(grid)observer.observe(grid,{childList:true});
  db.auth.onAuthStateChange(()=>{document.querySelectorAll(".community-video").forEach(c=>delete c.dataset.socialReady);hydrateCards();});
  hydrateCards();
})();