const { dbAll, dbGet, dbRun } = require('./db');

async function fixUpdatedAt() {
  const roots = await dbAll('SELECT id, created_at FROM posts WHERE parent_id IS NULL');
  for (const root of roots) {
    // Find the max created_at of this root and all its descendants
    // A simple recursive CTE or just a recursive JS function
    let maxTime = root.created_at;

    async function checkDescendants(parentId) {
      const children = await dbAll('SELECT id, created_at FROM posts WHERE parent_id = ?', [parentId]);
      for (const child of children) {
        if (child.created_at > maxTime) maxTime = child.created_at;
        await checkDescendants(child.id);
      }
    }
    
    await checkDescendants(root.id);
    
    // Update the root's updated_at
    await dbRun('UPDATE posts SET updated_at = ? WHERE id = ?', [maxTime, root.id]);
  }
  console.log('Fixed updated_at for all threads.');
}

fixUpdatedAt();
