const { dbRun } = require('./db');
(async () => {
    try {
      await dbRun('ALTER TABLE posts ADD COLUMN updated_at INTEGER');
      await dbRun('UPDATE posts SET updated_at = created_at WHERE updated_at IS NULL');
      console.log('Migration: added updated_at column to posts.');
    } catch (e) { console.error('Error adding updated_at:', e); }

    try {
      await dbRun("ALTER TABLE users ADD COLUMN theme_banner_position TEXT DEFAULT '50% 50%'");
      console.log('Migration: added theme_banner_position column to users.');
    } catch (e) { console.error('Error adding theme_banner_position:', e); }
})();
