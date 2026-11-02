const SUPABASE_URL = "https://fsolcdaawifreskqwrbq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5-I1KyTcCnbDQjXcwEB4kw_isI7q_nN";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let currentUser = null;

async function loadVideos() {
  const grid = document.getElementById("videoGrid");
  grid.innerHTML = "Loading videos...";

  const { data, error } = await db
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    grid.textContent = "Error: " + error.message;
    return;
  }

  grid.innerHTML = "";

  data.forEach(video => {
    const url = db.storage
      .from("videos")
      .getPublicUrl(video.storage_path).data.publicUrl;

    const card = document.createElement("div");
    card.className = "video-card";

    const title = document.createElement("h3");
    title.textContent = video.title;

    const description = document.createElement("p");
    description.textContent = video.description || "";

    const player = document.createElement("video");
    player.src = url;
    player.controls = true;
    player.playsInline = true;
    player.style.width = "100%";

    card.append(title, description, player);
    grid.appendChild(card);
  });
}

async function signUp(email, password, username) {
  const { error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) alert(error.message);
  else alert("Account created! Check your email if confirmation is required.");
}

async function logIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
  } else {
    currentUser = data.user;
    alert("You are logged in!");
    loadVideos();
  }
}

async function logOut() {
  await db.auth.signOut();
  currentUser = null;
  alert("Logged out.");
}

async function uploadVideo(file, title, description) {
  if (!currentUser) {
    alert("Please log in first!");
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    alert("Video must be smaller than 50 MB.");
    return;
  }

  const path = currentUser.id + "/" + Date.now() + "-" + file.name;

  const { error: uploadError } = await db.storage
    .from("videos")
    .upload(path, file);

  if (uploadError) {
    alert(uploadError.message);
    return;
  }

  const { error } = await db.from("videos").insert({
    user_id: currentUser.id,
    title: title,
    description: description,
    storage_path: path
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Video uploaded!");
  loadVideos();
}

async function searchVideos(search) {
  const { data, error } = await db
    .from("videos")
    .select("*")
    .ilike("title", "%" + search + "%");

  if (error) {
    alert(error.message);
    return;
  }

  const grid = document.getElementById("videoGrid");
  grid.innerHTML = "";

  data.forEach(video => {
    const url = db.storage
      .from("videos")
      .getPublicUrl(video.storage_path).data.publicUrl;

    const card = document.createElement("div");
    card.className = "video-card";

    const title = document.createElement("h3");
    title.textContent = video.title;

    const player = document.createElement("video");
    player.src = url;
    player.controls = true;
    player.style.width = "100%";

    card.append(title, player);
    grid.appendChild(card);
  });
}

db.auth.getSession().then(({ data }) => {
  currentUser = data.session?.user || null;
  loadVideos();
});

db.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
});
