// Global Application State
let currentUser = null;
let selectedComposeFiles = [];
let activeReplyFiles = {}; // Map of postId -> Array of files

// DOM Elements
const authView = document.getElementById('auth-view');
const appView = document.getElementById('app-view');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');

// Forms
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const recoveryForm = document.getElementById('recovery-form');
const composeForm = document.getElementById('compose-form');
const settingsForm = document.getElementById('settings-form');
const resetPasswordForm = document.getElementById('reset-password-form');

// Buttons & Toggles
const switchToRegisterBtn = document.getElementById('switch-to-register');
const switchToLoginBtn = document.getElementById('switch-to-login');
const switchToRecoveryBtn = document.getElementById('switch-to-recovery');
const switchToLoginFromRecBtn = document.getElementById('switch-to-login-from-rec');

const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnLogout = document.getElementById('btn-logout');

// Modal Elements
const settingsModal = document.getElementById('settings-modal-backdrop');
const resetPasswordModal = document.getElementById('reset-password-modal-backdrop');

// Color picker inputs
const colorBg = document.getElementById('color-bg');
const colorBanner = document.getElementById('color-banner');
const colorPostBg = document.getElementById('color-post-bg');
const colorText = document.getElementById('color-text');

const textColorBg = document.getElementById('text-color-bg');
const textColorBanner = document.getElementById('text-color-banner');
const textColorPostBg = document.getElementById('text-color-post-bg');
const textColorText = document.getElementById('text-color-text');

// Customization UI fields
const settingsNickname = document.getElementById('settings-nickname');
const settingsProfilePic = document.getElementById('settings-profile-pic');
const settingsBannerImage = document.getElementById('settings-banner-image');

// Page Header info
const appNickname = document.getElementById('app-nickname');
const appHashid = document.getElementById('app-hashid');
const appAvatar = document.getElementById('app-avatar');
const appBanner = document.getElementById('app-banner');

// Compose attachments
const composeFilesInput = document.getElementById('compose-files');
const composeFilePreviews = document.getElementById('compose-file-previews');
const feedContainer = document.getElementById('feed-container');

// Registration Download box elements
const registerSuccessBox = document.getElementById('register-success-box');
const btnDownloadKey = document.getElementById('btn-download-key');
const btnProceedLogin = document.getElementById('btn-proceed-login');
let generatedRecoveryKeyData = null; // Stores object containing { hashId, recoveryKey }

// Recovery file upload dropzone elements
const recoveryDropzone = document.getElementById('recovery-dropzone');
const recoveryFileInput = document.getElementById('recovery-file-input');
const recoveryFileName = document.getElementById('recovery-file-name');
let selectedRecoveryFile = null;

// ================= BANNER DRAG STATE =================
let bannerPosition = { x: 50, y: 50 }; // percentage
let bannerDragging = false;
let bannerDragStart = null;
let bannerDragOrigin = null;

// ================= THEME APPLICATION =================

function applyTheme(theme) {
  if (!theme) return;
  document.documentElement.style.setProperty('--bg-color', theme.bg || '#001d13');
  document.documentElement.style.setProperty('--banner-color', theme.bannerColor || '#757575');
  document.documentElement.style.setProperty('--post-bg-color', theme.postBg || '#4B3E3E');
  document.documentElement.style.setProperty('--text-color', theme.text || '#FFFFFF');

  if (theme.bannerImage) {
    appBanner.style.backgroundImage = `url('${theme.bannerImage}')`;
    appBanner.style.backgroundColor = 'transparent';
    // Apply saved position
    if (theme.bannerPosition) {
      const parts = theme.bannerPosition.split(' ');
      bannerPosition.x = parseFloat(parts[0]) || 50;
      bannerPosition.y = parseFloat(parts[1]) || 50;
    }
    appBanner.style.backgroundPosition = `${bannerPosition.x}% ${bannerPosition.y}%`;
    appBanner.classList.add('has-banner-image');
  } else {
    appBanner.style.backgroundImage = 'none';
    appBanner.style.backgroundColor = theme.bannerColor || '#757575';
    appBanner.classList.remove('has-banner-image');
  }

  if (appAvatar) {
    appAvatar.src = theme.profilePic || '/uploads/default-avatar.png';
    appAvatar.onerror = () => {
      appAvatar.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    };
  }
}

// Banner drag-to-reposition
function getClientPos(e) {
  return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                   : { x: e.clientX, y: e.clientY };
}

appBanner.addEventListener('mousedown', startBannerDrag);
appBanner.addEventListener('touchstart', startBannerDrag, { passive: false });

function startBannerDrag(e) {
  if (!appBanner.classList.contains('has-banner-image')) return;
  e.preventDefault();
  bannerDragging = true;
  bannerDragStart = getClientPos(e);
  bannerDragOrigin = { ...bannerPosition };
  appBanner.classList.add('dragging-banner');
}

window.addEventListener('mousemove', moveBannerDrag);
window.addEventListener('touchmove', moveBannerDrag, { passive: false });

function moveBannerDrag(e) {
  if (!bannerDragging) return;
  e.preventDefault();
  const cur = getClientPos(e);
  const rect = appBanner.getBoundingClientRect();
  // Invert: dragging right moves focal point left (image shifts right)
  const dx = (bannerDragStart.x - cur.x) / rect.width * 100;
  const dy = (bannerDragStart.y - cur.y) / rect.height * 100;
  bannerPosition.x = Math.min(100, Math.max(0, bannerDragOrigin.x + dx));
  bannerPosition.y = Math.min(100, Math.max(0, bannerDragOrigin.y + dy));
  appBanner.style.backgroundPosition = `${bannerPosition.x}% ${bannerPosition.y}%`;
}

window.addEventListener('mouseup', endBannerDrag);
window.addEventListener('touchend', endBannerDrag);

function endBannerDrag() {
  if (!bannerDragging) return;
  bannerDragging = false;
  appBanner.classList.remove('dragging-banner');
}

// Update settings dialog values
function populateSettingsForm() {
  if (!currentUser) return;
  settingsNickname.value = currentUser.nickname || '';
  
  const theme = currentUser.theme || {};
  colorBg.value = theme.bg || '#001d13';
  colorBanner.value = theme.bannerColor || '#757575';
  colorPostBg.value = theme.postBg || '#4B3E3E';
  colorText.value = theme.text || '#FFFFFF';

  textColorBg.textContent = colorBg.value.toUpperCase();
  textColorBanner.textContent = colorBanner.value.toUpperCase();
  textColorPostBg.textContent = colorPostBg.value.toUpperCase();
  textColorText.textContent = colorText.value.toUpperCase();
}

// Live update labels for color pickers
[colorBg, colorBanner, colorPostBg, colorText].forEach(picker => {
  picker.addEventListener('input', (e) => {
    const textLabelId = 'text-' + e.target.id;
    document.getElementById(textLabelId).textContent = e.target.value.toUpperCase();
  });
});

// ================= AUTH MANAGEMENT =================

// Check auth on load
async function checkAuth() {
  try {
    const res = await fetch('/api/user/me');
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
      showApp();
    } else {
      showAuth();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    showAuth();
  }
}

function showApp() {
  authView.style.display = 'none';
  appView.style.display = 'block';

  if (appNickname) appNickname.textContent = currentUser.nickname || currentUser.hashId;
  if (appHashid) appHashid.textContent = `@${currentUser.hashId}`;
  
  applyTheme(currentUser.theme);
  loadFeed();
}

function showAuth() {
  appView.style.display = 'none';
  authView.style.display = 'flex';
  showLoginForm();
}

function showLoginForm() {
  authTitle.textContent = '로그인';
  authSubtitle.textContent = '개인 독립형 웹사이트에 로그인합니다.';
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  registerSuccessBox.classList.add('hidden');
  recoveryForm.classList.add('hidden');
}

function showRegisterForm() {
  authTitle.textContent = '계정 생성';
  authSubtitle.textContent = '새로운 계정(HASH ID)을 만듭니다.';
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  registerSuccessBox.classList.add('hidden');
  recoveryForm.classList.add('hidden');
}

function showRecoveryForm() {
  authTitle.textContent = '계정 복구 로그인';
  authSubtitle.textContent = '복구 키 파일(.txt)을 사용하여 본인인증 후 로그인합니다.';
  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  registerSuccessBox.classList.add('hidden');
  recoveryForm.classList.remove('hidden');
  selectedRecoveryFile = null;
  recoveryFileName.textContent = '';
}

// Nav Swapping Handlers
switchToRegisterBtn.addEventListener('click', showRegisterForm);
switchToLoginBtn.addEventListener('click', showLoginForm);
switchToRecoveryBtn.addEventListener('click', showRecoveryForm);
switchToLoginFromRecBtn.addEventListener('click', showLoginForm);

// Handle Registration Submit
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '회원 가입에 실패했습니다.');
      return;
    }

    // Prepare Recovery Download
    generatedRecoveryKeyData = {
      hashId: data.hashId,
      recoveryKey: data.recoveryKey
    };

    // Display generated HASH ID on screen
    document.getElementById('display-generated-hashid').textContent = data.hashId;

    registerForm.classList.add('hidden');
    registerSuccessBox.classList.remove('hidden');
    authTitle.textContent = '계정 생성 완료';
    authSubtitle.textContent = '복구 키를 반드시 보관하세요.';
    btnProceedLogin.disabled = true; // Disable until downloaded
  } catch (err) {
    alert('서버 통신 중 오류가 발생했습니다.');
  }
});

// Download Recovery Key handler
btnDownloadKey.addEventListener('click', () => {
  if (!generatedRecoveryKeyData) return;

  const content = `[개인 웹사이트 복구 키]
HASH ID: ${generatedRecoveryKeyData.hashId}
Recovery Key: ${generatedRecoveryKeyData.recoveryKey}
주의: 본 복구 키 파일은 비밀번호 분실 시 로그인에 필요합니다. 절대 타인에게 공유하지 마세요.`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `recovery_key_${generatedRecoveryKeyData.hashId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  btnProceedLogin.disabled = false; // Enable move-to-login
});

// Proceed to login page after recovery download
btnProceedLogin.addEventListener('click', () => {
  generatedRecoveryKeyData = null;
  showLoginForm();
});

// Handle Login Submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const hashId = document.getElementById('login-hash-id').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashId, password })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '로그인에 실패했습니다.');
      return;
    }

    currentUser = data.user;
    showApp();
  } catch (err) {
    alert('서버 통신 중 오류가 발생했습니다.');
  }
});

// Drag and Drop & File Upload handlers for recovery key
recoveryDropzone.addEventListener('click', () => recoveryFileInput.click());

recoveryDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  recoveryDropzone.style.borderColor = 'var(--accent-primary)';
});

recoveryDropzone.addEventListener('dragleave', () => {
  recoveryDropzone.style.borderColor = 'rgba(255,255,255,0.15)';
});

recoveryDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  recoveryDropzone.style.borderColor = 'rgba(255,255,255,0.15)';
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].name.endsWith('.txt')) {
    handleRecoveryFileSelect(files[0]);
  } else {
    alert('올바른 .txt 복구 키 파일을 올려 주세요.');
  }
});

recoveryFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleRecoveryFileSelect(e.target.files[0]);
  }
});

function handleRecoveryFileSelect(file) {
  selectedRecoveryFile = file;
  recoveryFileName.textContent = `선택된 파일: ${file.name}`;
}

// Handle Recovery Login Submit
recoveryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedRecoveryFile) {
    alert('복구 키 파일을 먼저 선택해 주세요.');
    return;
  }

  const formData = new FormData();
  formData.append('recoveryFile', selectedRecoveryFile);

  try {
    const res = await fetch('/api/login-recovery', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '복구 키 로그인에 실패했습니다.');
      return;
    }

    currentUser = data.user;
    
    // Recovery works, now log user in and FORCE change password modal
    showApp();
    if (data.triggerPasswordReset) {
      resetPasswordModal.classList.add('active');
    }
  } catch (err) {
    alert('서버 통신 중 오류가 발생했습니다.');
  }
});

// Force Password Change submit handler
resetPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById('reset-new-password').value;

  try {
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '비밀번호 변경에 실패했습니다.');
      return;
    }

    alert('비밀번호가 성공적으로 변경되었습니다!');
    resetPasswordModal.classList.remove('active');
    document.getElementById('reset-new-password').value = '';
  } catch (err) {
    alert('서버 통신 중 오류가 발생했습니다.');
  }
});

// Logout handler
btnLogout.addEventListener('click', async () => {
  if (!confirm('정말 로그아웃 하시겠습니까?')) return;
  try {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    showAuth();
  } catch (err) {
    console.error('Logout failed:', err);
  }
});

// ================= SETTINGS DIALOGS =================

btnOpenSettings.addEventListener('click', () => {
  populateSettingsForm();
  settingsModal.classList.add('active');
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

// Close modal when clicking outside card
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
});

// Handle Settings Form submit
settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append('nickname', settingsNickname.value.trim());
  formData.append('themeBgColor', colorBg.value);
  formData.append('themeBannerColor', colorBanner.value);
  formData.append('themeBannerPosition', `${bannerPosition.x}% ${bannerPosition.y}%`);
  formData.append('themePostBgColor', colorPostBg.value);
  formData.append('themeTextColor', colorText.value);

  const picFile = settingsProfilePic.files[0];
  if (picFile) {
    formData.append('profilePic', picFile);
  }

  const bannerFile = settingsBannerImage.files[0];
  if (bannerFile) {
    formData.append('bannerImage', bannerFile);
  }

  try {
    const res = await fetch('/api/user/settings', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '설정 저장에 실패했습니다.');
      return;
    }

    // Update state and layout
    currentUser = data.user;
    if (appNickname) appNickname.textContent = currentUser.nickname;
    applyTheme(currentUser.theme);

    // Reset settings files fields
    settingsProfilePic.value = '';
    settingsBannerImage.value = '';

    settingsModal.classList.remove('active');
    
    // Reload feed (since authors' avatars or nicknames might have changed)
    loadFeed();
  } catch (err) {
    alert('설정 저장 중 오류가 발생했습니다.');
  }
});

// ================= COMPOSE (WRITE POST) ATTACHMENTS =================

// Handle attachment selecting in compose form
composeFilesInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    // Prevent duplicate entries
    if (!selectedComposeFiles.some(f => f.name === file.name && f.size === file.size)) {
      selectedComposeFiles.push(file);
    }
  });
  renderComposeFilePreviews();
  composeFilesInput.value = ''; // clear input so change triggers next time
});

function renderComposeFilePreviews() {
  composeFilePreviews.innerHTML = '';
  selectedComposeFiles.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'file-preview-card';
    card.setAttribute('draggable', 'true');
    card.dataset.index = index;

    // Generate thumbnail or icon
    let previewContent = '';
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      previewContent = `<img src="${url}" class="preview-thumb" alt="${file.name}">`;
      // Store object URL so we can revoke it later to avoid memory leaks
      card.dataset.objectUrl = url;
    } else {
      let icon = '📁';
      if (file.type.startsWith('audio/')) icon = '🎵';
      else if (file.type.startsWith('video/')) icon = '🎥';
      else if (file.name.endsWith('.pdf')) icon = '📄';
      else if (file.name.endsWith('.djvu')) icon = '📚';
      else if (file.name.endsWith('.txt')) icon = '📝';
      previewContent = `<div class="preview-icon">${icon}</div>`;
    }

    card.innerHTML = `
      ${previewContent}
      <div class="preview-info">
        <span class="preview-name">${file.name}</span>
        <span class="preview-size">${formatFileSize(file.size)}</span>
      </div>
      <button type="button" class="preview-remove-btn" data-index="${index}">&times;</button>
    `;

    // Remove event listener
    card.querySelector('.preview-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(card.dataset.index, 10);
      if (card.dataset.objectUrl) {
        URL.revokeObjectURL(card.dataset.objectUrl);
      }
      selectedComposeFiles.splice(idx, 1);
      renderComposeFilePreviews();
    });

    // Drag-and-drop event handlers
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('dragover');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('dragover');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('dragover');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = parseInt(card.dataset.index, 10);
      if (fromIndex !== toIndex && !isNaN(fromIndex)) {
        const [moved] = selectedComposeFiles.splice(fromIndex, 1);
        selectedComposeFiles.splice(toIndex, 0, moved);
        renderComposeFilePreviews();
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    composeFilePreviews.appendChild(card);
  });
}

// Size formatter helper
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Handle Compose Submit (Main top-level post)
composeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = document.getElementById('compose-content').value.trim();

  if (!content && selectedComposeFiles.length === 0) {
    alert('게시글 내용을 입력하거나 파일을 첨부해 주세요.');
    return;
  }

  const formData = new FormData();
  formData.append('content', content);
  
  selectedComposeFiles.forEach(file => {
    formData.append('files', file);
  });

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '게시물 작성에 실패했습니다.');
      return;
    }

    // Reset compose editor
    document.getElementById('compose-content').value = '';
    selectedComposeFiles = [];
    renderComposeFilePreviews();

    // Reload feed
    loadFeed();
  } catch (err) {
    alert('게시글 작성 중 오류가 발생했습니다.');
  }
});

// ================= RENDER FEED & THREADS TREE =================

async function loadFeed() {
  try {
    const res = await fetch('/api/posts');
    const posts = await res.json();
    
    if (!res.ok) {
      feedContainer.innerHTML = '<p class="text-center" style="opacity: 0.6; padding: 20px;">피드를 불러올 수 없습니다.</p>';
      return;
    }

    renderFeedTree(posts);
  } catch (err) {
    feedContainer.innerHTML = '<p class="text-center" style="opacity: 0.6; padding: 20px;">서버 통신 중 오류가 발생했습니다.</p>';
  }
}

function renderFeedTree(posts) {
  feedContainer.innerHTML = '';
  if (posts.length === 0) {
    feedContainer.innerHTML = '<p class="text-center" style="opacity: 0.6; padding: 40px;">첫 게시물을 작성해 보세요!</p>';
    return;
  }

  // 1. Build nested tree structure
  const postsMap = {};
  posts.forEach(post => {
    post.replies = [];
    postsMap[post.id] = post;
  });

  const roots = [];
  posts.forEach(post => {
    if (post.parent_id && postsMap[post.parent_id]) {
      postsMap[post.parent_id].replies.push(post);
    } else {
      roots.push(post);
    }
  });

  // Sort threads: newest activity first (updated_at, fallback to created_at)
  roots.sort((a, b) => {
    const aTime = a.updated_at || a.created_at;
    const bTime = b.updated_at || b.created_at;
    return bTime - aTime;
  });

  // 2. Render roots recursively
  roots.forEach(rootPost => {
    const postWrapper = renderPostTreeRecursive(rootPost);
    feedContainer.appendChild(postWrapper);
  });

  // Apply post height enhancements (compactness & text truncation)
  adjustPostMediaCompactness();
  handleTextTruncation();
  optimizeThreeImageGalleries();
}

// Recursive renderer returning HTML node
function renderPostTreeRecursive(post) {
  const postWrapper = document.createElement('div');
  postWrapper.className = 'post-wrapper';
  postWrapper.id = `post-wrapper-${post.id}`;

  // Build current post element
  const postCard = document.createElement('div');
  postCard.className = `post-card ${post.is_deleted ? 'deleted-post' : ''}`;
  postCard.id = `post-card-${post.id}`;

  // Time formatter helper
  const formattedTime = new Date(post.created_at).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

  // Attachments layout HTML
  let attachmentsHtml = '';
  if (post.attachments && post.attachments.length > 0) {
    attachmentsHtml = '<div class="post-attachments">';
    
    // Group images together in a gallery
    const imgAttachments = post.attachments.filter(att => /\.(jpe?g|png|webp|gif)$/i.test(att.file_path));
    const nonImgAttachments = post.attachments.filter(att => !/\.(jpe?g|png|webp|gif)$/i.test(att.file_path));

    if (imgAttachments.length > 0) {
      let galleryClass = 'gallery-1';
      if (imgAttachments.length === 2) galleryClass = 'gallery-2';
      else if (imgAttachments.length === 3) galleryClass = 'gallery-3';
      else if (imgAttachments.length === 4) galleryClass = 'gallery-4';
      else if (imgAttachments.length === 5) galleryClass = 'gallery-5';
      else if (imgAttachments.length === 6) galleryClass = 'gallery-6';
      else if (imgAttachments.length > 6) galleryClass = 'gallery-collapsed';

      attachmentsHtml += `<div class="post-gallery ${galleryClass}">`;
      
      if (imgAttachments.length <= 6) {
        imgAttachments.forEach(att => {
          attachmentsHtml += `<img src="${att.file_path}" alt="${att.file_name}" class="media-image">`;
        });
      } else {
        // Collapsed view for 6+ (7 or more) images
        // Render first 5 normally
        for (let i = 0; i < 5; i++) {
          const att = imgAttachments[i];
          attachmentsHtml += `<img src="${att.file_path}" alt="${att.file_name}" class="media-image">`;
        }
        // Render 6th inside more-container with overlay text
        const att6 = imgAttachments[5];
        attachmentsHtml += `
          <div class="gallery-more-container">
            <img src="${att6.file_path}" alt="${att6.file_name}" class="media-image">
            <div class="gallery-more-overlay">+${imgAttachments.length - 5}</div>
          </div>
        `;
        // Render remaining images hidden from view so they are still in the DOM for lightbox navigation
        for (let i = 6; i < imgAttachments.length; i++) {
          const att = imgAttachments[i];
          attachmentsHtml += `<img src="${att.file_path}" alt="${att.file_name}" class="media-image" style="display: none;">`;
        }
      }
      attachmentsHtml += '</div>';
    }

    nonImgAttachments.forEach(att => {
      const isAudio = /\.(mp3|wav|flac|ogg)$/i.test(att.file_path);
      const isVideo = /\.(mp4)$/i.test(att.file_path);
      const isPdf = /\.pdf$/i.test(att.file_path);
      const isDjvu = /\.djvu$/i.test(att.file_path);

      if (isAudio) {
        attachmentsHtml += `<audio controls class="media-audio" src="${att.file_path}"></audio>`;
      } else if (isVideo) {
        attachmentsHtml += `<video controls class="media-video" src="${att.file_path}"></video>`;
      } else if (isPdf) {
        attachmentsHtml += `
          <div class="pdf-container" style="margin-top: 10px; width: 100%;">
            <iframe src="${att.file_path}" class="media-pdf" style="width: 100%; height: 500px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: #fff;"></iframe>
            <a href="${att.file_path}" class="attachment-file-link" download="${att.file_name}" style="margin-top: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>${att.file_name} 다운로드</span>
            </a>
          </div>
        `;
      } else if (isDjvu) {
        attachmentsHtml += `
          <a href="${att.file_path}" class="attachment-file-link" download="${att.file_name}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${att.file_name} (DJVU) 다운로드</span>
          </a>
        `;
      } else {
        attachmentsHtml += `
          <a href="${att.file_path}" class="attachment-file-link" download="${att.file_name}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${att.file_name} 다운로드</span>
          </a>
        `;
      }
    });
    attachmentsHtml += '</div>';
  }

  // Embed card HTML
  let embedHtml = '';
  if (post.embeds && post.embeds.length > 0) {
    const embed = post.embeds[0];
    const imageStyle = embed.image_url ? `style="background-image: url('${embed.image_url}');"` : 'style="display:none;"';
    
    embedHtml = `
      <a href="${embed.url}" class="embed-card" target="_blank" rel="noopener noreferrer">
        <div class="embed-image" ${imageStyle}></div>
        <div class="embed-info">
          <div class="embed-title">${embed.title || embed.url}</div>
          ${embed.description ? `<div class="embed-desc">${embed.description}</div>` : ''}
          <div class="embed-url">${new URL(embed.url).hostname}</div>
        </div>
      </a>
    `;
  }

  // Action Buttons: Only show reply/delete on active (non-deleted) posts
  let actionButtonsHtml = '';
  if (!post.is_deleted) {
    const isOwner = currentUser && post.user_hash_id === currentUser.hashId;
    actionButtonsHtml = `
      <div class="post-actions">
        <div class="post-action-left">
          <button type="button" class="post-btn btn-reply-toggle" data-id="${post.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            댓글
          </button>
        </div>
        ${isOwner ? `
          <button type="button" class="post-btn btn-delete-post" data-id="${post.id}" style="color:var(--accent-danger);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            삭제
          </button>
        ` : ''}
      </div>
    `;
  }

  const avatarSrc = post.profile_pic || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
  
  // Assemble card contents
  postCard.innerHTML = `
    <div class="post-header">
      <img src="${avatarSrc}" alt="아바타" class="post-author-avatar" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'">
      <div class="post-meta">
        <span class="post-author-name">${post.nickname || post.user_hash_id}</span>
        <span class="post-time">${formattedTime}</span>
      </div>
    </div>
    <div class="post-body">${post.content}</div>
    ${attachmentsHtml}
    ${embedHtml}
    ${actionButtonsHtml}
  `;

  postWrapper.appendChild(postCard);

  // Build Reply editor inline (hidden by default)
  if (!post.is_deleted) {
    const replyEditor = document.createElement('div');
    replyEditor.className = 'reply-editor';
    replyEditor.id = `reply-editor-${post.id}`;
    replyEditor.innerHTML = `
      <form class="reply-form" data-parent-id="${post.id}">
        <textarea class="reply-content" placeholder="댓글을 입력하세요..."></textarea>
        
        <div class="file-previews-container" id="reply-previews-${post.id}"></div>

        <div class="compose-toolbar" style="margin-top:10px;">
          <div class="file-input-wrapper">
            <button type="button" class="btn btn-secondary" style="padding: 8px 14px; font-size:0.85rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              파일
            </button>
            <input type="file" class="reply-files-input" data-id="${post.id}" multiple accept="image/*,audio/*,video/*,.txt,.zip,.tar.gz,.pdf,.djvu">
          </div>
          <div class="d-flex gap-10">
            <button type="button" class="btn btn-secondary btn-reply-cancel" data-id="${post.id}" style="padding: 8px 14px; font-size:0.85rem;">취소</button>
            <button type="submit" class="btn btn-primary" style="padding: 8px 14px; font-size:0.85rem; width:auto;">댓글 작성</button>
          </div>
        </div>
      </form>
    `;
    postWrapper.appendChild(replyEditor);

    // Event handler: Toggle Reply
    const btnToggle = postCard.querySelector('.btn-reply-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const isVisible = replyEditor.style.display === 'block';
        replyEditor.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
          replyEditor.querySelector('textarea').focus();
          activeReplyFiles[post.id] = [];
          renderReplyFilePreviews(post.id);
        }
      });
    }

    // Event handler: Cancel Reply
    const btnCancel = replyEditor.querySelector('.btn-reply-cancel');
    btnCancel.addEventListener('click', () => {
      replyEditor.style.display = 'none';
      activeReplyFiles[post.id] = [];
    });

    // Event handler: Reply attachment adding
    const replyFilesInput = replyEditor.querySelector('.reply-files-input');
    const previewsContainer = replyEditor.querySelector(`#reply-previews-${post.id}`);

    replyFilesInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (!activeReplyFiles[post.id]) {
        activeReplyFiles[post.id] = [];
      }
      files.forEach(file => {
        if (!activeReplyFiles[post.id].some(f => f.name === file.name && f.size === file.size)) {
          activeReplyFiles[post.id].push(file);
        }
      });
      renderReplyFilePreviews(post.id);
      replyFilesInput.value = '';
    });

    // Event handler: Reply submit
    const replyForm = replyEditor.querySelector('.reply-form');
    replyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const replyContent = replyEditor.querySelector('.reply-content').value.trim();
      const files = activeReplyFiles[post.id] || [];

      if (!replyContent && files.length === 0) {
        alert('댓글 내용을 입력하거나 파일을 첨부해 주세요.');
        return;
      }

      const formData = new FormData();
      formData.append('content', replyContent);
      formData.append('parentId', post.id);
      files.forEach(file => {
        formData.append('files', file);
      });

      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || '댓글 작성에 실패했습니다.');
          return;
        }

        // Reset and hide
        replyEditor.style.display = 'none';
        delete activeReplyFiles[post.id];

        // Reload feed
        loadFeed();
      } catch (err) {
        alert('댓글 작성 중 오류가 발생했습니다.');
      }
    });

    // Event handler: Delete Post
    const btnDelete = postCard.querySelector('.btn-delete-post');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!confirm('정말 이 게시글을 삭제하시겠습니까? 첨부된 파일도 영구적으로 삭제되며, 스레드 흐름 보존을 위해 내용은 삭제 마크로 대체됩니다.')) return;
        try {
          const res = await fetch(`/api/posts/${post.id}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || '게시글 삭제에 실패했습니다.');
            return;
          }
          loadFeed();
        } catch (err) {
          alert('게시글 삭제 중 오류가 발생했습니다.');
        }
      });
    }
  }

  // Render child replies recursively
  if (post.replies && post.replies.length > 0) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'thread-children';
    post.replies.forEach(replyPost => {
      const childNode = renderPostTreeRecursive(replyPost);
      childrenContainer.appendChild(childNode);
    });
    postWrapper.appendChild(childrenContainer);
  }

  return postWrapper;
}

// Function to render reply file attachment badges
function renderReplyFilePreviews(postId) {
  const container = document.getElementById(`reply-previews-${postId}`);
  if (!container) return;
  
  container.innerHTML = '';
  const files = activeReplyFiles[postId] || [];
  files.forEach((file, index) => {
    const badge = document.createElement('div');
    badge.className = 'preview-badge';
    badge.innerHTML = `
      <span>${file.name} (${formatFileSize(file.size)})</span>
      <button type="button" data-index="${index}">&times;</button>
    `;
    badge.querySelector('button').addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      activeReplyFiles[postId].splice(idx, 1);
      renderReplyFilePreviews(postId);
    });
    container.appendChild(badge);
  });
}

// Adjust media layout compactness for long posts (posts whose height > 80% viewport height)
function adjustPostMediaCompactness() {
  const postCards = document.querySelectorAll('.post-card');
  const viewportHeight = window.innerHeight;
  postCards.forEach(card => {
    if (card.offsetHeight > viewportHeight * 0.8) {
      card.classList.add('compact-media');
    }
  });
}

// Truncate text body if lines exceed 12, showing 7 lines with "더보기" unroll button
function handleTextTruncation() {
  const postBodies = document.querySelectorAll('.post-body');
  postBodies.forEach(body => {
    if (body.dataset.processed) return;
    body.dataset.processed = "true";

    const lh = parseFloat(window.getComputedStyle(body).lineHeight) || 24;
    const maxHeightOf12Lines = lh * 12;

    if (body.scrollHeight > maxHeightOf12Lines + 5) {
      body.classList.add('truncated-body');
      
      const btn = document.createElement('button');
      btn.className = 'read-more-btn';
      btn.textContent = '더보기';
      
      btn.addEventListener('click', () => {
        if (body.classList.contains('truncated-body')) {
          body.classList.remove('truncated-body');
          btn.textContent = '접기';
        } else {
          body.classList.add('truncated-body');
          btn.textContent = '더보기';
        }
      });
      
      body.parentNode.insertBefore(btn, body.nextSibling);
    }
  });
}

// Lightbox Media Viewer State and Functions
let currentLightboxMedia = [];
let currentLightboxIndex = -1;

function openLightbox(mediaElements, startIndex) {
  currentLightboxMedia = mediaElements;
  currentLightboxIndex = startIndex;
  
  const overlay = document.getElementById('lightbox-overlay');
  overlay.classList.add('active');
  
  showLightboxMedia();
  
  document.addEventListener('keydown', handleLightboxKeydown);
}

function closeLightbox() {
  const overlay = document.getElementById('lightbox-overlay');
  overlay.classList.remove('active');
  document.getElementById('lightbox-content').innerHTML = '';
  document.removeEventListener('keydown', handleLightboxKeydown);
}

function showLightboxMedia() {
  const content = document.getElementById('lightbox-content');
  content.innerHTML = '';
  
  if (currentLightboxIndex < 0 || currentLightboxIndex >= currentLightboxMedia.length) return;
  
  const element = currentLightboxMedia[currentLightboxIndex];
  const src = element.getAttribute('src');
  
  if (element.tagName.toLowerCase() === 'img') {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'lightbox-media';
    content.appendChild(img);
  } else if (element.tagName.toLowerCase() === 'video') {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.className = 'lightbox-media';
    content.appendChild(video);
  }
}

function handleLightboxKeydown(e) {
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowLeft') {
    navigateLightbox(-1);
  } else if (e.key === 'ArrowRight') {
    navigateLightbox(1);
  }
}

function navigateLightbox(dir) {
  if (currentLightboxMedia.length <= 1) return;
  currentLightboxIndex = (currentLightboxIndex + dir + currentLightboxMedia.length) % currentLightboxMedia.length;
  showLightboxMedia();
}

// Event Listeners for Lightbox
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));
document.getElementById('lightbox-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox-overlay' || e.target.id === 'lightbox-content') {
    closeLightbox();
  }
});

// Event delegation for opening media in lightbox
feedContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('gallery-more-overlay')) {
    e.preventDefault();
    e.stopPropagation();
    const gallery = e.target.closest('.post-gallery');
    if (gallery) {
      gallery.classList.remove('gallery-collapsed');
      gallery.classList.add('gallery-expanded');
    }
    return;
  }

  if (e.target.classList.contains('media-image') || e.target.classList.contains('media-video')) {
    const postCard = e.target.closest('.post-card');
    if (!postCard) return;
    
    // Find all images and videos in this specific post card
    const mediaList = Array.from(postCard.querySelectorAll('.media-image, .media-video'));
    const index = mediaList.indexOf(e.target);
    if (index !== -1) {
      e.preventDefault();
      openLightbox(mediaList, index);
    }
  }
});

// Optimize layout for 3-image galleries based on natural image aspect ratios
function optimizeThreeImageGalleries() {
  const galleries = document.querySelectorAll('.post-gallery.gallery-3');
  galleries.forEach(gallery => {
    if (gallery.dataset.optimized) return;
    gallery.dataset.optimized = "true";

    const imgs = Array.from(gallery.querySelectorAll('.media-image'));
    if (imgs.length !== 3) return;

    let loadedCount = 0;
    const imgData = [];

    imgs.forEach((img, index) => {
      const checkDimensions = () => {
        imgData.push({
          element: img,
          width: img.naturalWidth,
          height: img.naturalHeight,
          ratio: img.naturalHeight / img.naturalWidth,
          index: index
        });
        
        loadedCount++;
        if (loadedCount === 3) {
          applyThreeImageLayout(gallery, imgData);
        }
      };

      if (img.complete) {
        checkDimensions();
      } else {
        img.addEventListener('load', checkDimensions);
        img.addEventListener('error', checkDimensions);
      }
    });
  });
}

function applyThreeImageLayout(gallery, imgData) {
  // horizontal if width > height (ratio < 1)
  const allHorizontal = imgData.every(data => data.width > data.height);

  if (allHorizontal) {
    gallery.classList.add('gallery-3-horizontal');
    gallery.removeAttribute('style');
  } else {
    // some are vertical: find the one with the greatest vertical ratio
    let greatestIndex = 0;
    let maxRatio = -1;
    imgData.forEach((data, i) => {
      if (data.ratio > maxRatio) {
        maxRatio = data.ratio;
        greatestIndex = i;
      }
    });

    const greatestImg = imgData[greatestIndex].element;
    const otherImgs = imgData.filter((_, i) => i !== greatestIndex).map(d => d.element);

    gallery.classList.add('gallery-3-vertical-mix');
    
    // Position greatest vertical image on left side, spanning full height
    greatestImg.style.gridColumn = '1 / 2';
    greatestImg.style.gridRow = '1 / 3';
    
    // Position other two sharing right side height evenly
    otherImgs[0].style.gridColumn = '2 / 3';
    otherImgs[0].style.gridRow = '1 / 2';
    
    otherImgs[1].style.gridColumn = '2 / 3';
    otherImgs[1].style.gridRow = '2 / 3';
  }
}

// Initial session check
checkAuth();
