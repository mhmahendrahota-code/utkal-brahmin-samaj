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
    console.log('[Generation] Starting full recalculation...');
    
    // 1. Reset everyone to null first
    await Member.updateMany({}, { generationLevel: null });
    
    // 2. Find "True Roots"
    // Criteria: No parents AND (no spouse OR spouse has no parents either)
    // This identifies the top-most couple(s) in the tree.
    const allMembers = await Member.find({}).select('_id father mother spouse name').lean();
    const memberMap = new Map(allMembers.map(m => [m._id.toString(), m]));
    
    const trueRoots = allMembers.filter(m => {
      const hasNoParents = !m.father && !m.mother;
      if (!hasNoParents) return false;
      
      if (!m.spouse) return true; // No parents, no spouse -> Root
      
      const spouse = memberMap.get(m.spouse.toString());
      if (!spouse) return true; // Spouse not in DB -> Root
      
      const spouseHasNoParents = !spouse.father && !spouse.mother;
      return spouseHasNoParents; // Both have no parents -> Top Couple Root
    });

    console.log(`[Generation] Found ${trueRoots.length} true ancestral roots.`);

    const globalLevelMap = new Map();
    const queue = [];

    // Initialize queue with true roots
    for (const root of trueRoots) {
      queue.push({ id: root._id.toString(), level: 0 });
      globalLevelMap.set(root._id.toString(), 0);
    }

    // 3. Global BFS traversal
    let processedCount = 0;
    while (queue.length > 0) {
      const { id, level } = queue.shift();
      processedCount++;

      try {
        await Member.findByIdAndUpdate(id, { generationLevel: level });
        updated++;

        const m = memberMap.get(id);
        
        // Propagate to spouse
        if (m.spouse) {
          const spouseId = m.spouse.toString();
          if (!globalLevelMap.has(spouseId)) {
            await Member.findByIdAndUpdate(spouseId, { generationLevel: level });
            globalLevelMap.set(spouseId, level);
            // Spouses don't necessarily need to go into queue unless we want to find children via mother
            queue.push({ id: spouseId, level: level });
          }
        }

        // Add children
        const children = await Member.find({
          $or: [{ father: id }, { mother: id }]
        }).select('_id').lean();

        for (const child of children) {
          const childId = child._id.toString();
          const childLevel = level + 1;
          
          if (!globalLevelMap.has(childId) || globalLevelMap.get(childId) > childLevel) {
            globalLevelMap.set(childId, childLevel);
            queue.push({ id: childId, level: childLevel });
          }
        }
      } catch (e) {
        errors++;
      }
      
      if (processedCount % 50 === 0) console.log(`[Generation] Processed ${processedCount} members...`);
    }

    // 4. Fallback for disconnected fragments (if any left)
    const survivors = await Member.find({ generationLevel: null }).select('_id name').lean();
    if (survivors.length > 0) {
      console.log(`[Generation] Resolving ${survivors.length} remaining members...`);
      for (const s of survivors) {
        const level = await resolveGenerationLevel(s._id);
        await Member.findByIdAndUpdate(s._id, { generationLevel: level || 0 });
        updated++;
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
