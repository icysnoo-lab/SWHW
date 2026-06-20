const { dbAll } = require('./db');
(async () => {
  const posts = await dbAll('SELECT id, parent_id, created_at, updated_at FROM posts ORDER BY id DESC LIMIT 10;');
  console.log(posts);
})();
