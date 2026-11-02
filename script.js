const $ = (id) => document.getElementById(id);
const videoGrid = $('videoGrid');
const emptyState = $('emptyState');
const modal = $('youtubeModal');
const fileInput = $('videoFile');
let videos = [];
let localUrls = [];

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function openModal() { $('formError').textContent = ''; modal.hidden = false; $('youtubeUrl').focus(); }
function closeModal() { modal.hidden = true; }
function getYoutubeId(value) {
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0];
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed','shorts','live'].includes(parts[0])) return parts[1];
    }
  } catch(e) {}
  return null;
}
function addYoutube(url, title) {
  const id = getYoutubeId(url);
  if (!id || !/^[\w-]{6,}$/.test(id)) {
    $('formError').textContent = 'That link does not look like a supported YouTube video URL.';
    return false;
  }
  videos.unshift({id: crypto.randomUUID(), type:'youtube', videoId:id, title:title.trim() || 'YouTube video', source:'YouTube'});
  render();
  return true;
}
function render() {
  videoGrid.innerHTML = '';
  emptyState.hidden = videos.length > 0;
  $('videoCount').textContent = `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`;
  videos.forEach(video => {
    const card = document.createElement('article');
    card.className = 'video-card';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (video.type === 'youtube') {
      const img = document.createElement('img');
      img.src = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
      img.alt = 'YouTube video thumbnail';
      img.onerror = () => { img.remove(); thumb.textContent = '▶'; };
      thumb.appendChild(img);
    } else {
      thumb.textContent = '▶';
    }
    const badge = document.createElement('span');
    badge.className = 'play-badge'; badge.textContent = '▶ Play';
    thumb.appendChild(badge);
    const info = document.createElement('div'); info.className = 'card-info';
    const title = document.createElement('div'); title.className = 'card-title'; title.textContent = video.title;
    const type = document.createElement('div'); type.className = 'card-type'; type.textContent = video.source;
    const actions = document.createElement('div'); actions.className = 'card-actions';
    const play = document.createElement('button'); play.textContent = 'Watch'; play.onclick = () => watchVideo(video);
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.className = 'delete'; remove.onclick = () => {
      videos = videos.filter(v => v.id !== video.id);
      if (video.url) { URL.revokeObjectURL(video.url); localUrls = localUrls.filter(u => u !== video.url); }
      render();
    };
    actions.append(play, remove); info.append(title, type, actions); card.append(thumb, info); videoGrid.appendChild(card);
  });
}
function watchVideo(video) {
  if (video.type === 'youtube') {
    const player = document.createElement('div');

    player.innerHTML = `
      <iframe
        width="100%"
        height="500"
        src="https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1"
        title="YouWatch Player"
        frameborder="0"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen>
      </iframe>
    `;

    const win = window.open('', '_blank');

    win.document.write(`
      <html>
      <head>
        <title>YouWatch Player</title>
        <style>
          body {
            background: #090b14;
            color: white;
            font-family: Arial;
            padding: 20px;
          }
          iframe {
            border: none;
            border-radius: 15px;
          }
        </style>
      </head>
      <body>
        <h2>YouWatch Player</h2>
        ${player.innerHTML}
      </body>
      </html>
    `);
  } else {
    const win = window.open('', '_blank');

    win.document.write(`
      <video controls autoplay style="width:100%">
        <source src="${video.url}">
      </video>
    `);
  }
}
function uploadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) { showToast('Please choose a video file.'); return; }
  const url = URL.createObjectURL(file); localUrls.push(url);
  videos.unshift({id:crypto.randomUUID(), type:'file', title:file.name.replace(/\.[^.]+$/, ''), source:'Uploaded from this device', url});
  render(); showToast('Your video was added to YouWatch.');
}
['addYoutubeTop','addYoutubeCard'].forEach(id => $(id).addEventListener('click', openModal));
['uploadTop','uploadCard','emptyAdd'].forEach(id => $(id).addEventListener('click', () => fileInput.click()));
fileInput.addEventListener('change', e => { uploadFile(e.target.files[0]); e.target.value = ''; });
$('youtubeForm').addEventListener('submit', e => {
  e.preventDefault();
  if (addYoutube($('youtubeUrl').value, $('youtubeTitle').value)) {
    closeModal(); $('youtubeForm').reset(); showToast('YouTube video added.');
  }
});
document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModal));
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  btn.classList.add('active');
  $('collectionTitle').textContent = btn.dataset.view === 'library' ? 'Your library' : 'Your videos';
}));
render();
