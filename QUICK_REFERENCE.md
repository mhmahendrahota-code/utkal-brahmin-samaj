# ⚡ QUICK REFERENCE CARD
## Members Management - 8 Features at a Glance

---

| Feature | Where | What | Quick Steps |
|---------|-------|------|------------|
| **1. Stats Dashboard** | Top of page | 8 metric cards | Auto-loads - no action needed |
| **2. Filters** | Below search | 4 filter dropdowns | Click Filters → Select options → Auto-applies |
| **3. Bulk Ops** | Table rows | Select + Approve/Reject/Delete | ☑️ Select rows → Click action → Confirm |
| **4. Sort/Paginate** | Column headers + Bottom | Sort columns, 10-100 rows/page | Click header to sort • Select rows/page dropdown |
| **5. Quality Score** | Row highlighting + Status column | 0-100% data completeness | 🔴 Red = Incomplete • 🟡 Yellow = Good • ⚪ White = Excellent |
| **6. Duplicate Detection** | Purple "Check Duplicates" button | Find duplicate entries | Click button → Review pairs → Edit/Delete one |
| **7. Relationships** | Green sitemap icon per row | Link father/mother/spouse/children | Click icon → Select related member → Link |
| **8. Bulk Import** | Blue "Import Members" button | CSV file upload/paste | Upload CSV → Preview → Confirm import |

---

## 🎨 COLOR CODES

### Quality Highlighting
- 🔴 **Red** = <60% complete (Incomplete profile)
- 🟡 **Yellow** = 60-79% complete (Needs some info)
- ⚪ **White** = 80%+ complete (Good profile)

### Status Badges
- ✅ **Green** = Approved
- ⏳ **Orange/Amber** = Pending approval
- ⚰️ **Gray** = Deceased

### Icons
- 👨 Father | 👩 Mother | 💑 Spouse | 👶 Children
- 🎖️ Committee member | 💍 Matrimonial registered

---

## 🚀 KEYBOARD SHORTCUTS & QUICK ACTIONS

| Action | How |
|--------|-----|
| Select all members | Click header checkbox ☑️ |
| Toggle sort direction | Click column header again |
| Go to specific page | Click page number |
| Search while filtering | Type in search bar (works with filters) |
| View quality details | Hover over name for tooltip |
| Close modal | Click X or press ESC |

---

## 📊 STATS EXPLAINED

```
Total        = All members in database
Approved     = Status = Approved
Pending      = Status = Pending  
Incomplete   = Missing key fields (name/gotra/village)
Matrimonial  = Matrimonial registered = True
Committee    = Committee member = True
Deceased     = Marked deceased = True
Family Links = Has father OR mother OR spouse OR children
```

---

## 🔍 FILTER COMBINATIONS

**Example 1**: Find pending incomplete members
- Status: Pending + Quality: Incomplete

**Example 2**: Find committee members with complete profiles
- Committee: Yes + Quality: Excellent

**Example 3**: Find orphans (no family links)
- Family Links: No family links

---

## 📥 BULK IMPORT CSV TEMPLATE

```csv
name,surname,gotra,village,contactNumber,honorific
Rajesh Sharma,Sharma,Sharma Gotra,Delhi,9876543210,Mr
Priya Singh,Singh,Singh Gotra,Mumbai,9876543211,Ms
```

**Required**: name + gotra  
**Optional**: surname, village, contactNumber, honorific

---

## ⚠️ BEFORE YOU DELETE

```
❌ WRONG:     Click Delete randomly
✅ RIGHT:     Filter for duplicates first
             Review beside entries
             Then delete confirmed duplicate
```

---

## 📱 MOBILE TIPS

- Filters accessible on mobile ✓
- Bulk operations work on mobile ✓  
- CSV import works on mobile ✓
- Pagination recommended for small screens

---

## 🆘 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| Import fails | Check CSV has name + gotra columns |
| Filters not working | Refresh page |
| Duplicates not appearing | Check similar names - algorithm strict |
| Relationship not linking | Both members must exist, try refresh |
| Page slow | Use filters first, then sort |

---

## 📈 FEATURE CAPABILITIES

**Bulk Operations**: Up to 5000 members at once  
**Duplicate Detection**: Finds up to 50 top-matching pairs  
**Import**: 1000+ members in seconds  
**Pagination**: 10-100 rows per view  
**Filters**: Combine 4 criteria simultaneously  
**Sorting**: 4 columns sortable  

---

## 💡 PRO TIPS

1. **Always export before major changes** - Keep CSV backup
2. **Filter first** - Find your target group before bulk operations
3. **Check duplicates regularly** - Prevent data mess-ups
4. **Build family tree gradually** - Link relationships for genealogy
5. **Complete profiles slowly** - Use Edit button to add missing data
6. **Use quality highlighting** - Red rows need attention first

---

**Page**: `/admin/members`  
**Status**: ✅ All features live and tested  
**Last Updated**: April 2, 2026
