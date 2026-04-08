/**
 * Generation Auto-Update System
 * 
 * generationLevel stores the absolute depth from the oldest known ancestor.
 * Root ancestor (no father/mother) → generationLevel = 0
 * Child of root → 1, grandchild → 2, and so on.
 * 
 * Rules:
 *  - If a member has no parents → level = 0 (root)
 *  - If parent has a known level → level = parent.level + 1
 *  - If parent has no level yet → we try to resolve it recursively
 *  - Spouse always gets same level as primary member
 *  - On edit, all descendants are cascade-updated
 */

const Member = require('../models/Member');

/**
 * Walk up the ancestor chain to resolve generationLevel for a member.
 * Uses iterative BFS to avoid call stack issues on deep trees.
 */
async function resolveGenerationLevel(memberId, visited = new Set()) {
  if (visited.has(memberId.toString())) return null; // circular guard
  visited.add(memberId.toString());

  const member = await Member.findById(memberId).select('father mother generationLevel').lean();
  if (!member) return null;

  // If already computed and stored, return it
  if (member.generationLevel !== null && member.generationLevel !== undefined) {
    return member.generationLevel;
  }

  // No parents → root (level 0)
  const parentId = member.father || member.mother;
  if (!parentId) return 0;

  // Resolve parent's level recursively
  const parentLevel = await resolveGenerationLevel(parentId.toString(), visited);
  if (parentLevel === null) return 0; // fallback if parent can't be resolved

  return parentLevel + 1;
}

/**
 * Set generationLevel for a member and cascade update all descendants.
 * Call this AFTER saving a member with a new/changed parent.
 */
async function updateGenerationCascade(memberId) {
  try {
    const level = await resolveGenerationLevel(memberId.toString());
    if (level === null) return;

    // Save to DB
    await Member.findByIdAndUpdate(memberId, { generationLevel: level });

    // Also update spouse to same level
    const member = await Member.findById(memberId).select('spouse').lean();
    if (member && member.spouse) {
      await Member.findByIdAndUpdate(member.spouse, { generationLevel: level });
    }

    // Cascade to all children recursively (BFS)
    await cascadeToDescendants(memberId, level);

  } catch (err) {
    console.error('[Generation] Cascade update error:', err.message);
  }
}

/**
 * BFS cascade: update generationLevel for all descendants of a member.
 */
async function cascadeToDescendants(parentId, parentLevel) {
  const queue = [{ id: parentId, level: parentLevel }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id.toString())) continue;
    visited.add(id.toString());

    // Find all direct children
    const children = await Member.find({
      $or: [{ father: id }, { mother: id }]
    }).select('_id spouse').lean();

    for (const child of children) {
      const childLevel = level + 1;
      await Member.findByIdAndUpdate(child._id, { generationLevel: childLevel });

      // Update spouse to same level
      if (child.spouse) {
        await Member.findByIdAndUpdate(child.spouse, { generationLevel: childLevel });
      }

      queue.push({ id: child._id.toString(), level: childLevel });
    }
  }
}

/**
 * Recalculate ALL members in the database from scratch.
 * Finds roots (no parents) and BFS downward.
 * Returns { updated, errors }
 */
async function recalculateAllGenerations() {
  let updated = 0;
  let errors = 0;

  try {
    // Find root members (no father, no mother)
    const roots = await Member.find({
      father: null,
      mother: null
    }).select('_id').lean();

    // Also find members whose father/mother reference is broken (not in DB)
    const allIds = new Set((await Member.find().select('_id').lean()).map(m => m._id.toString()));

    // BFS from each root
    for (const root of roots) {
      const queue = [{ id: root._id.toString(), level: 0 }];
      const visited = new Set();

      while (queue.length > 0) {
        const { id, level } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);

        try {
          await Member.findByIdAndUpdate(id, { generationLevel: level });
          updated++;

          // Same level for spouse
          const m = await Member.findById(id).select('spouse').lean();
          if (m && m.spouse) {
            await Member.findByIdAndUpdate(m.spouse, { generationLevel: level });
            visited.add(m.spouse.toString());
            updated++;
          }

          // Add children to queue
          const children = await Member.find({
            $or: [{ father: id }, { mother: id }]
          }).select('_id').lean();

          for (const child of children) {
            if (!visited.has(child._id.toString())) {
              queue.push({ id: child._id.toString(), level: level + 1 });
            }
          }
        } catch (e) {
          errors++;
        }
      }
    }
  } catch (err) {
    console.error('[Generation] Full recalculate error:', err.message);
  }

  return { updated, errors };
}

module.exports = {
  resolveGenerationLevel,
  updateGenerationCascade,
  recalculateAllGenerations
};
