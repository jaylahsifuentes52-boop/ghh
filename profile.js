(() => {
  const db = window.supabase.createClient(
    "https://fsolcdaawifreskqwrbq.supabase.co",
    "sb_publishable_5-I1KyTcCnbDQjXcwEB4kw_isI7q_nN"
  );
  const $ = id => document.getElementById(id);
  const css = document.createElement("style");
  css.textContent = `
    .profile-trigger{display:flex;align-items:center;gap:9px;border:1px solid #ffffff20;background:#ffffff0b;color:#fff;border-radius:14px;padding:6px 12px 6px 7px;font:600 13px 'DM Sans',sans-serif;cursor:pointer}
    .profile-avatar{width:35px;height:35px;flex:0 0 35px;border-radius:50%;object-fit:cover;background:linear-gradient(135deg,#9b5cff,#48d8d0);display:grid;place-items:center;color:white;font-weight:800;overflow:hidden}
    .profile-trigger:hover{border-color:#a78bfa;transform:translateY(-1px)}
    .profile-preview{width:104px;height:104px;border-radius:50%;object-fit:cover;background:#27203e;border:3px solid #a78bfa;display:grid;place-items:center;color:#cbb8ff;font-size:32px;margin:4px auto 15px}
    .profile-pick{display:block;text-align:center;padding:11px;border:1px dashed #ffffff40;border-radius:12px;color:#c9b9ff;cursor:pointer;font-size:12px;margin:10px 0}
    .profile-pick input{display:none}
    .profile-tip{font-size:11px;color:#8994aa;line-height:1.5;margin:7px 0}
    @media(max-width:760px){.profile-trigger{padding:5px 8px}.profile-trigger .profile-name{display:none}}
  `;
  document.head.appendChild(css);

  const actions = document.querySelector(".top-actions");
  if (!actions) return;
  const trigger = document.createElement("button");
  trigger.className = "profile-trigger";
  trigger.type = "button";
  trigger.innerHTML = '<span class="profile-avatar" id="profileAvatar">Y</span><span class="profile-name" id="profileName">My profile</span>';
  actions.insertBefore(trigger, actions.firstChild);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "profileModal";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="profileHeading">
      <button class="close-modal" id="profileClose" type="button" aria-label="Close">×</button>
      <div class="modal-symbol">✦</div><p class="eyebrow">YOUR YOUWATCH ID</p>
      <h2 id="profileHeading">Edit your profile</h2>
      <img class="profile-preview" id="profilePreview" alt="Profile picture preview">
      <label class="profile-pick">📷 Choose profile picture<input id="profilePicture" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <p class="profile-tip">Choose an image you have permission to use. Images are resized before saving.</p>
      <form id="profileForm">
        <label for="profileDisplayName">Display name</label>
        <input id="profileDisplayName" maxlength="24" required placeholder="Your name">
        <p class="form-error" id="profileError"></p>
        <button class="upload-button full-button" id="profileSave" type="submit">Save profile</button>
      </form>
    </section>`;
  document.body.appendChild(modal);

  let user = null, avatarData = "";
  const initial = name => (name || "Y").trim().charAt(0).toUpperCase() || "Y";
  function showProfile(name, avatar) {
    $("profileName").textContent = name || "My profile";
    $("profileAvatar").textContent = avatar ? "" : initial(name);
    $("profileAvatar").style.backgroundImage = avatar ? 'url("' + avatar + '")' : "";
    $("profileAvatar").style.backgroundSize = "cover";
    $("profilePreview").src = avatar || "";
    $("profilePreview").style.display = avatar ? "block" : "grid";
    $("profilePreview").textContent = avatar ? "" : initial(name);
  }
  async function loadProfile() {
    const {data,error} = await db.auth.getUser();
    if (error) return;
    user = data.user;
    if (!user) { showProfile("My profile",""); return; }
    const m = user.user_metadata || {};
    showProfile(m.display_name || m.username || user.email?.split("@")[0] || "You", m.avatar_data || "");
  }
  trigger.addEventListener("click", async () => {
    await loadProfile();
    if (!user) {
      if ($("authModal")) $("authModal").hidden = false;
      else if (typeof showToast === "function") showToast("Log in to edit your profile.");
      return;
    }
    const m = user.user_metadata || {};
    $("profileDisplayName").value = m.display_name || m.username || user.email?.split("@")[0] || "";
    avatarData = m.avatar_data || "";
    $("profileError").textContent = "";
    showProfile($("profileDisplayName").value, avatarData);
    modal.hidden = false;
  });
  $("profileClose").addEventListener("click", () => modal.hidden = true);
  modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });
  $("profilePicture").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      $("profileError").textContent = "Choose a JPG, PNG, or WebP image."; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const side = Math.min(img.width,img.height);
        ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,256,256);
        avatarData = canvas.toDataURL("image/jpeg",0.72);
        showProfile($("profileDisplayName").value,avatarData);
        $("profileError").textContent = "";
      };
      img.onerror = () => $("profileError").textContent = "That image could not be opened.";
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $("profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!user) return;
    const name = $("profileDisplayName").value.trim();
    if (!name) { $("profileError").textContent = "Enter a display name."; return; }
    const btn = $("profileSave");
    btn.disabled = true; btn.textContent = "Saving...";
    const {error} = await db.auth.updateUser({data:{
      ...user.user_metadata,
      display_name:name,
      username:name,
      avatar_data:avatarData
    }});
    btn.disabled = false; btn.textContent = "Save profile";
    if (error) { $("profileError").textContent = error.message; return; }
    await loadProfile();
    modal.hidden = true;
    if (typeof showToast === "function") showToast("Your profile was saved!");
  });
  db.auth.onAuthStateChange(() => setTimeout(loadProfile,0));
  loadProfile();
})();