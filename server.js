const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initDb, dbRun, dbGet, dbAll } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads folder if not exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create public folder if not exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Multer storage configuration for attachments and settings images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadsDir));

// Helper: Hashing function
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// Helper: HTML entity decode
function htmlEntityDecode(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Helper: Parse Open Graph metadata
async function getUrlMetadata(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(3000) // 3 seconds timeout
    });
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) return null;

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? htmlEntityDecode(titleMatch[1].trim()) : null;

    // Helper to get meta tag content by property or name
    const getMeta = (prop) => {
      const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
      let match = html.match(regex);
      if (!match) {
        const regexReverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
        match = html.match(regexReverse);
      }
      return match ? htmlEntityDecode(match[1].trim()) : null;
    };

    const ogTitle = getMeta('og:title') || title;
    const ogDesc = getMeta('og:description') || getMeta('description');
    const ogImage = getMeta('og:image');

    return {
      title: ogTitle || url,
      description: ogDesc || '',
      image_url: ogImage || ''
    };
  } catch (error) {
    console.error(`Error scraping metadata for ${url}:`, error.message);
    return null;
  }
}

// Middleware: Authentication check
async function requireAuth(req, res, next) {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    const session = await dbGet(`
      SELECT s.user_hash_id, u.nickname, u.profile_pic, u.theme_bg_color, u.theme_banner_color, u.theme_banner_image, u.theme_banner_position, u.theme_post_bg_color, u.theme_text_color
      FROM sessions s
      JOIN users u ON s.user_hash_id = u.hash_id
      WHERE s.token = ?
    `, [token]);

    if (!session) {
      res.clearCookie('session_token');
      return res.status(401).json({ error: '유효하지 않은 세션입니다.' });
    }

    req.user = {
      hashId: session.user_hash_id,
      nickname: session.nickname,
      profilePic: session.profile_pic,
      theme: {
        bg: session.theme_bg_color,
        bannerColor: session.theme_banner_color,
        bannerImage: session.theme_banner_image,
        bannerPosition: session.theme_banner_position || '50% 50%',
        postBg: session.theme_post_bg_color,
        text: session.theme_text_color
      }
    };
    next();
  } catch (err) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

// ----------------- Auth API -----------------

// POST /api/register - Register new account
app.post('/api/register', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: '비밀번호는 최소 4자 이상이어야 합니다.' });
  }

  try {
    // Generate cryptographically unique HASH ID using SHA-256
    let hashId;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      hashId = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      const existingUser = await dbGet('SELECT hash_id FROM users WHERE hash_id = ?', [hashId]);
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: '고유 HASH ID 생성에 실패했습니다. 다시 시도해 주세요.' });
    }

    // Salt and Hash Password
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, passwordSalt);

    // Generate Recovery Key (24 bytes random hex string -> 48 chars)
    const recoveryKey = crypto.randomBytes(24).toString('hex');
    const recoverySalt = crypto.randomBytes(16).toString('hex');
    const recoveryHash = hashPassword(recoveryKey, recoverySalt);

    // Insert user
    await dbRun(`
      INSERT INTO users (hash_id, password_hash, password_salt, recovery_hash, recovery_salt, nickname)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [hashId, passwordHash, passwordSalt, recoveryHash, recoverySalt, hashId]);

    // Send recovery key details to user
    res.json({
      success: true,
      hashId,
      recoveryKey
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '회원 가입 중 오류가 발생했습니다.' });
  }
});

// POST /api/login - Login with HASH ID & Password
app.post('/api/login', async (req, res) => {
  const { hashId, password } = req.body;
  if (!hashId || !password) {
    return res.status(400).json({ error: 'HASH ID와 비밀번호를 모두 입력해 주세요.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE hash_id = ?', [hashId]);
    if (!user) {
      return res.status(400).json({ error: '존재하지 않는 HASH ID 또는 비밀번호가 틀립니다.' });
    }

    const calculatedHash = hashPassword(password, user.password_salt);
    if (calculatedHash !== user.password_hash) {
      return res.status(400).json({ error: '존재하지 않는 HASH ID 또는 비밀번호가 틀립니다.' });
    }

    // Generate Session Token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await dbRun('INSERT INTO sessions (token, user_hash_id, created_at) VALUES (?, ?, ?)', [
      sessionToken,
      user.hash_id,
      Date.now()
    ]);

    // Set cookie (expires in 30 days)
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      user: {
        hashId: user.hash_id,
        nickname: user.nickname,
        profilePic: user.profile_pic
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// POST /api/login-recovery - Login using recovery key file
app.post('/api/login-recovery', upload.single('recoveryFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '복구 키 파일(.txt)을 업로드해 주세요.' });
  }

  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    
    // Clean up uploaded temp file
    fs.unlinkSync(req.file.path);

    // Parse recovery key and hash ID
    const idMatch = fileContent.match(/HASH ID:\s*([^\r\n]+)/);
    const keyMatch = fileContent.match(/Recovery Key:\s*([^\r\n]+)/);

    if (!idMatch || !keyMatch) {
      return res.status(400).json({ error: '올바른 복구 키 파일 형식이 아닙니다.' });
    }

    const hashId = idMatch[1].trim();
    const recoveryKey = keyMatch[1].trim();

    const user = await dbGet('SELECT * FROM users WHERE hash_id = ?', [hashId]);
    if (!user) {
      return res.status(400).json({ error: '복구 키 파일에 적힌 사용자를 찾을 수 없습니다.' });
    }

    const calculatedHash = hashPassword(recoveryKey, user.recovery_salt);
    if (calculatedHash !== user.recovery_hash) {
      return res.status(400).json({ error: '복구 키가 일치하지 않습니다.' });
    }

    // Auth Success - Create Session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await dbRun('INSERT INTO sessions (token, user_hash_id, created_at) VALUES (?, ?, ?)', [
      sessionToken,
      user.hash_id,
      Date.now()
    ]);

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      user: {
        hashId: user.hash_id,
        nickname: user.nickname,
        profilePic: user.profile_pic
      },
      triggerPasswordReset: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '계정 복구 중 오류가 발생했습니다.' });
  }
});

// POST /api/logout - Logout user
app.post('/api/logout', async (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    await dbRun('DELETE FROM sessions WHERE token = ?', [token]);
  }
  res.clearCookie('session_token');
  res.json({ success: true });
});

// POST /api/change-password - Change user password
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '비밀번호는 최소 4글자 이상이어야 합니다.' });
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);

    await dbRun(`
      UPDATE users 
      SET password_hash = ?, password_salt = ? 
      WHERE hash_id = ?
    `, [hash, salt, req.user.hashId]);

    res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
});

// GET /api/user/me - Check current authentication status
app.get('/api/user/me', async (req, res) => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.json({ authenticated: false });
  }
  try {
    const session = await dbGet(`
      SELECT s.user_hash_id, u.nickname, u.profile_pic, u.theme_bg_color, u.theme_banner_color, u.theme_banner_image, u.theme_banner_position, u.theme_post_bg_color, u.theme_text_color
      FROM sessions s
      JOIN users u ON s.user_hash_id = u.hash_id
      WHERE s.token = ?
    `, [token]);

    if (!session) {
      res.clearCookie('session_token');
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        hashId: session.user_hash_id,
        nickname: session.nickname,
        profilePic: session.profile_pic,
        theme: {
          bg: session.theme_bg_color,
          bannerColor: session.theme_banner_color,
          bannerImage: session.theme_banner_image,
          bannerPosition: session.theme_banner_position || '50% 50%',
          postBg: session.theme_post_bg_color,
          text: session.theme_text_color
        }
      }
    });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// ----------------- User Settings API -----------------

// POST /api/user/settings - Update profile settings and colors
app.post('/api/user/settings', requireAuth, upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), async (req, res) => {
  const { nickname, themeBgColor, themeBannerColor, themeBannerPosition, themePostBgColor, themeTextColor } = req.body;

  try {
    const user = await dbGet('SELECT * FROM users WHERE hash_id = ?', [req.user.hashId]);
    let newProfilePic = user.profile_pic;
    let newBannerImage = user.theme_banner_image;

    // Handle profile pic upload
    if (req.files && req.files['profilePic']) {
      // Remove old file if it existed and was custom
      if (user.profile_pic && fs.existsSync(path.join(__dirname, user.profile_pic))) {
        fs.unlinkSync(path.join(__dirname, user.profile_pic));
      }
      newProfilePic = `/uploads/${req.files['profilePic'][0].filename}`;
    }

    // Handle banner image upload
    if (req.files && req.files['bannerImage']) {
      if (user.theme_banner_image && fs.existsSync(path.join(__dirname, user.theme_banner_image))) {
        fs.unlinkSync(path.join(__dirname, user.theme_banner_image));
      }
      newBannerImage = `/uploads/${req.files['bannerImage'][0].filename}`;
    }

    // Update settings in database
    await dbRun(`
      UPDATE users
      SET nickname = ?,
          profile_pic = ?,
          theme_bg_color = ?,
          theme_banner_color = ?,
          theme_banner_image = ?,
          theme_banner_position = ?,
          theme_post_bg_color = ?,
          theme_text_color = ?
      WHERE hash_id = ?
    `, [
      nickname || req.user.hashId,
      newProfilePic,
      themeBgColor || '#001d13',
      themeBannerColor || '#757575',
      newBannerImage,
      themeBannerPosition || '50% 50%',
      themePostBgColor || '#ffffff',
      themeTextColor || '#000000',
      req.user.hashId
    ]);

    res.json({
      success: true,
      user: {
        hashId: req.user.hashId,
        nickname: nickname || req.user.hashId,
        profilePic: newProfilePic,
        theme: {
          bg: themeBgColor || '#001d13',
          bannerColor: themeBannerColor || '#757575',
          bannerImage: newBannerImage,
          bannerPosition: themeBannerPosition || '50% 50%',
          postBg: themePostBgColor || '#ffffff',
          text: themeTextColor || '#000000'
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '설정 저장 중 오류가 발생했습니다.' });
  }
});

// ----------------- Posts API -----------------

// GET /api/posts - Get all posts (and all replies) formatted
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await dbAll(`
      SELECT p.id, p.parent_id, p.user_hash_id, p.content, p.created_at, p.updated_at, p.is_deleted,
             u.nickname, u.profile_pic
      FROM posts p
      LEFT JOIN users u ON p.user_hash_id = u.hash_id
      ORDER BY p.created_at ASC
    `);

    const attachments = await dbAll('SELECT * FROM attachments');
    const embeds = await dbAll('SELECT * FROM embeds');

    // Maps to store attachments and embeds by post_id
    const attachmentsMap = {};
    attachments.forEach(att => {
      if (!attachmentsMap[att.post_id]) attachmentsMap[att.post_id] = [];
      attachmentsMap[att.post_id].push(att);
    });

    const embedsMap = {};
    embeds.forEach(emb => {
      if (!embedsMap[emb.post_id]) embedsMap[emb.post_id] = [];
      embedsMap[emb.post_id].push(emb);
    });

    // Map attachments and embeds, handle deleted posts
    posts.forEach(post => {
      post.attachments = attachmentsMap[post.id] || [];
      post.embeds = embedsMap[post.id] || [];
      if (post.is_deleted) {
        post.content = '[삭제된 게시글/댓글입니다]';
        post.attachments = [];
        post.embeds = [];
        post.nickname = '알 수 없음';
        post.profile_pic = null;
      }
    });

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 불러오기 중 오류가 발생했습니다.' });
  }
});

// POST /api/posts - Create a new post or reply
app.post('/api/posts', requireAuth, upload.array('files'), async (req, res) => {
  const { content, parentId } = req.body;
  const files = req.files || [];

  if (!content && files.length === 0) {
    return res.status(400).json({ error: '게시글 내용을 입력하거나 파일을 업로드해 주세요.' });
  }

  const parsedParentId = parentId ? parseInt(parentId, 10) : null;

  try {
    const now = Date.now();

    // 1. Insert post record
    const result = await dbRun(`
      INSERT INTO posts (parent_id, user_hash_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [parsedParentId, req.user.hashId, content || '', now, now]);

    const postId = result.lastID;

    // 1b. Bump updated_at on the thread root so feeds sort by latest activity
    const rootId = await findThreadRoot(parsedParentId);
    if (rootId) {
      await dbRun('UPDATE posts SET updated_at = ? WHERE id = ?', [now, rootId]);
    }

    // 2. Insert attachments (uploaded files)
    for (const file of files) {
      await dbRun(`
        INSERT INTO attachments (post_id, file_name, file_path, file_type)
        VALUES (?, ?, ?, ?)
      `, [postId, file.originalname, `/uploads/${file.filename}`, file.mimetype]);
    }

    // 3. Scan for links and insert embeds (max 1 link preview per post for performance)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = content ? content.match(urlRegex) : null;
    if (match && match.length > 0) {
      const url = match[0];
      const meta = await getUrlMetadata(url);
      if (meta) {
        await dbRun(`
          INSERT INTO embeds (post_id, url, title, description, image_url)
          VALUES (?, ?, ?, ?, ?)
        `, [postId, url, meta.title, meta.description, meta.image_url]);
      }
    }

    // Return the created post details
    const newPost = await dbGet(`
      SELECT p.id, p.parent_id, p.user_hash_id, p.content, p.created_at, p.is_deleted,
             u.nickname, u.profile_pic
      FROM posts p
      JOIN users u ON p.user_hash_id = u.hash_id
      WHERE p.id = ?
    `, [postId]);

    newPost.attachments = await dbAll('SELECT * FROM attachments WHERE post_id = ?', [postId]);
    newPost.embeds = await dbAll('SELECT * FROM embeds WHERE post_id = ?', [postId]);

    res.json(newPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 작성 중 오류가 발생했습니다.' });
  }
});

// Helper: Remove a post's attachments from disk and DB
async function purgePostMedia(postId) {
  const attachments = await dbAll('SELECT file_path FROM attachments WHERE post_id = ?', [postId]);
  for (const att of attachments) {
    const fullPath = path.join(__dirname, att.file_path);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {
        console.error(`Failed to delete file ${fullPath}:`, e.message);
      }
    }
  }
  await dbRun('DELETE FROM attachments WHERE post_id = ?', [postId]);
  await dbRun('DELETE FROM embeds WHERE post_id = ?', [postId]);
}

// Helper: Walk up to the thread root (post with no parent)
async function findThreadRoot(postId) {
  if (!postId) return null;
  let current = await dbGet('SELECT id, parent_id FROM posts WHERE id = ?', [postId]);
  while (current && current.parent_id) {
    current = await dbGet('SELECT id, parent_id FROM posts WHERE id = ?', [current.parent_id]);
  }
  return current ? current.id : null;
}

// Helper: Check recursively if a post has any active (undeleted) descendants
async function hasUndeletedDescendants(postId) {
  const children = await dbAll('SELECT id, is_deleted FROM posts WHERE parent_id = ?', [postId]);
  for (const child of children) {
    if (!child.is_deleted) return true;
    const hasUndeleted = await hasUndeletedDescendants(child.id);
    if (hasUndeleted) return true;
  }
  return false;
}

// Helper: Check if an entire tree (post + all descendants) is fully deleted
async function isEntirelyDeleted(postId) {
  const post = await dbGet('SELECT id, is_deleted FROM posts WHERE id = ?', [postId]);
  if (!post || !post.is_deleted) return false;
  const children = await dbAll('SELECT id FROM posts WHERE parent_id = ?', [postId]);
  for (const child of children) {
    if (!(await isEntirelyDeleted(child.id))) return false;
  }
  return true;
}

// Startup cleanup: purge any root threads where every post is deleted
async function purgeAllDeletedThreads() {
  const roots = await dbAll('SELECT id FROM posts WHERE parent_id IS NULL');
  let count = 0;
  for (const root of roots) {
    if (await isEntirelyDeleted(root.id)) {
      await purgePostAndDescendants(root.id);
      count++;
    }
  }
  if (count > 0) console.log(`Startup cleanup: purged ${count} fully-deleted thread(s).`);
}

// Helper: Recursively purge a post and all its descendants from DB and disk
async function purgePostAndDescendants(postId) {
  const children = await dbAll('SELECT id FROM posts WHERE parent_id = ?', [postId]);
  for (const child of children) {
    await purgePostAndDescendants(child.id);
  }
  await purgePostMedia(postId);
  await dbRun('DELETE FROM posts WHERE id = ?', [postId]);
}

// Helper: Recursively prune deleted ancestors that have no remaining active children/descendants
async function pruneDeletedAncestors(parentId) {
  if (!parentId) return;
  
  const parent = await dbGet('SELECT * FROM posts WHERE id = ?', [parentId]);
  if (!parent || !parent.is_deleted) return;
  
  // Check if this parent has any active descendants left
  const hasActive = await hasUndeletedDescendants(parentId);
  if (hasActive) return;
  
  // No active descendants left — fully purge the parent and its subtree
  const grandParentId = parent.parent_id;
  await purgePostAndDescendants(parentId);
  
  // Recurse upward
  await pruneDeletedAncestors(grandParentId);
}

// DELETE /api/posts/:id - Smart delete with bottom-up pruning
app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  const postId = parseInt(req.params.id, 10);

  try {
    const post = await dbGet('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    if (post.user_hash_id !== req.user.hashId) {
      return res.status(403).json({ error: '게시글 삭제 권한이 없습니다.' });
    }

    if (post.is_deleted) {
      return res.status(400).json({ error: '이미 삭제된 게시글입니다.' });
    }

    // 1. Purge media from disk
    await purgePostMedia(postId);

    // 2. Check if post has any active (undeleted) descendants
    const hasActive = await hasUndeletedDescendants(postId);
    
    if (!hasActive) {
      // No active descendants — fully delete from DB
      const parentId = post.parent_id;
      await purgePostAndDescendants(postId);
      
      // Prune deleted ancestors that no longer have active descendants
      await pruneDeletedAncestors(parentId);
    } else {
      // Has active descendants — soft-delete (keep skeleton for thread structure)
      await dbRun(`
        UPDATE posts 
        SET content = '', is_deleted = 1 
        WHERE id = ?
      `, [postId]);
    }

    res.json({ success: true, message: '게시글이 삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '게시글 삭제 중 오류가 발생했습니다.' });
  }
});

// Start server after initializing DB
initDb()
  .then(async () => {
    // Migrate updated_at column into existing databases
    try {
      await dbRun('ALTER TABLE posts ADD COLUMN updated_at INTEGER');
      await dbRun('UPDATE posts SET updated_at = created_at WHERE updated_at IS NULL');
      console.log('Migration: added updated_at column to posts.');
    } catch (e) { /* Column already exists — no-op */ }

    // Migrate theme_banner_position column into existing databases
    try {
      await dbRun("ALTER TABLE users ADD COLUMN theme_banner_position TEXT DEFAULT '50% 50%'");
      console.log('Migration: added theme_banner_position column to users.');
    } catch (e) { /* Column already exists — no-op */ }

    // Startup: purge threads that are entirely made of deleted posts
    await purgeAllDeletedThreads();

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
  });
