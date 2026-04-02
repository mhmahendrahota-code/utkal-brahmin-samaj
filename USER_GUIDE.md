# 👥 MEMBERS MANAGEMENT - USER GUIDE
## All 8 Features Quick Reference

---

## 1️⃣ QUICK STATS DASHBOARD

**What**: Real-time member statistics overview  
**Where**: Top of `/admin/members` page  
**What You See**: 8 colored stat cards

### Stat Cards Display:
- **Total**: All members in database
- **Approved**: ✓ Members with isApproved=true
- **Pending**: ⏳ Members waiting approval
- **Incomplete**: ⚠️ Missing name/gotra/village
- **Matrimonial**: 💍 Registered for matrimonial
- **Committee**: 🎖️ Committee members
- **Deceased**: ⚰️ Marked as deceased
- **Family Links**: 👨‍👩‍👧 Members with relationships

### How to Use:
1. Navigate to `/admin/members`
2. Stats load automatically
3. Cards update in real-time

---

## 2️⃣ ADVANCED FILTERS

**What**: Filter members by multiple criteria  
**Where**: "Filters" button below search bar  
**What You Get**: Refined member list

### Available Filters:

#### Filter 1: Approval Status
- ☐ All Statuses (default)
- ✓ Approved
- ⏳ Pending

#### Filter 2: Family Links  
- ☐ All Members (default)
- 👨 Has Father
- 👩 Has Mother
- 💑 Has Spouse
- 👶 Has Children
- 🚫 No Family Links

#### Filter 3: Committee
- ☐ All Members (default)
- ✓ Committee Members
- ✗ Non-Committee Members

#### Filter 4: Data Quality
- ☐ All Statuses (default)
- ⭐ Excellent (80%+)
- ✓ Good (60-79%)
- ⚠️ Incomplete (<60%)

### How to Use:
1. Click **"Filters"** button
2. Select from any dropdown
3. Table updates immediately
4. Combines ALL selected filters
5. Filtering works with search

### Example:
- Select: Pending + Incomplete
- Result: Pending members with incomplete profiles only

---

## 3️⃣ BULK OPERATIONS

**What**: Select multiple members and perform actions  
**Where**: Checkbox column in table + Bulk Actions Bar  
**What You Can Do**: Approve, Reject, Delete in bulk

### How to Use:

**Option 1: Select All**
1. Check header checkbox
2. ✓ Selects ALL visible members
3. Bulk bar appears at top

**Option 2: Select Individual**
1. Check boxes on specific members
2. Bulk bar appears when 1+ selected
3. Shows "X selected"

### Actions Available:
- **Approve**: Mark all selected as approved
- **Reject**: Mark all selected as pending
- **Delete**: Remove selected members
- **Clear**: Deselect all

### Before Deleting:
- Confirmation dialog appears
- Shows member name and impact
- Lists what will be cleaned up:
  - Child links removed
  - Family links cleared
  - Relationship data cleaned

### How to Use:
1. Check boxes (select individual or use header select-all)
2. Bulk Actions Bar appears at top
3. Click desired action button
4. Confirm in dialog
5. Operation completes, page refreshes

---

## 4️⃣ SORT & PAGINATION

**What**: Organize table and navigate large lists  
**Where**: Column headers (clickable) + Bottom controls

### SORTING

**Sortable Columns**:
- Name
- Gotra  
- Village
- Contact

**How to Sort**:
1. Click any sortable column header
2. Arrow appears: ↑ (ascending) or ↓ (descending)
3. Click again to toggle direction
4. Table re-sorts, pagination resets to page 1

### PAGINATION

**Rows Per Page Options**:
- 10 rows
- 25 rows (default)
- 50 rows
- 100 rows

**Navigation**:
- **Previous/Next**: Move one page
- **Page Numbers**: Click to jump to page
- **Smart Display**: Shows pages intelligently (1...5 6 7...10)

**Display Info**: "Showing X-Y of Z members"

### How to Use:
1. Select "Rows per page" dropdown (bottom left)
2. Choose desired rows per page
3. Use Previous/Next buttons or click page numbers
4. Current page highlighted in blue/saffron color

---

## 5️⃣ DATA QUALITY HIGHLIGHTING

**What**: Visual indicators for profile completeness  
**Where**: Each member row + Status column

### Quality Scoring (0-100%):
- Name: 20%
- Gotra: 20%
- Village: 20%
- Contact Number: 15%
- Surname: 15%
- Approval Status: 10%

### Visual Indicators:

**Row Background Color**:
- 🔴 Red + Red Border: <60% (Incomplete)
- 🟡 Yellow: 60-79% (Good)
- ⚪ White: 80%+ (Excellent)

**Status Column Badge**:
- ✅ Green + "80%": Excellent
- ⚠️ Yellow + "60%": Good
- ❌ Red + "40%": Incomplete

**Member Name Indicators**:
- 🔴 Red icon: <60% (very incomplete)
- 🟡 Yellow icon: 60-79% (partially complete)
- No icon: 80%+ (complete)

**Tooltip on Hover**: Shows what's missing
- Example: "Missing: contact, surname"

### How to Use:
1. Look for color-coded rows
2. Red rows need attention
3. Hover over names for details
4. Filter by "Incomplete" to see only profiles needing work
5. Click Edit to complete profile

---

## 6️⃣ DUPLICATE DETECTION

**What**: Find and resolve duplicate member entries  
**Where**: "Check Duplicates" button (purple)  
**What You Get**: List of similar members with merge options

### How Detection Works:
- **95% Match**: Exact same contact number
- **85% Match**: Same gotra + surname
- **Up to 50%**: Similar names (85%+ text match)
- **30% Match**: Same parents (siblings)

### How to Use:

**Step 1**: Click "Check Duplicates" button
- Modal opens, scan begins
- Shows loading spinner

**Step 2**: Review Results
- Shows match score for each pair
- Lists reasons for match
- Shows "95% - Same contact number"

**Step 3**: View Pair Details
- Member 1 left side
- Member 2 right side
- Shows name, surname, gotra, village, contact, approval status

**Step 4**: Take Action
- Click **Edit First** to modify member 1
- Click **Edit Second** to modify member 2  
- Click **Delete Duplicate** to remove one
- Deleting removes all relationships properly

### Example Scenario:
```
Found Pair: 95% Match
Reason: Same contact number

Member 1         | Member 2
John Sharma      | John Shrama (typo!)
Sharma Gotra     | Sharma Gotra
Delhi            | Delhi
9876543210       | 9876543210 ← SAME
Status: Approved | Status: Pending

Action: Delete Duplicate → Removes Member 2
```

---

## 7️⃣ RELATIONSHIP MANAGER

**What**: Link/unlink family relationships between members  
**Where**: Green sitemap icon in Actions column  
**What You Can Do**: Manage father, mother, spouse, children

### How to Use:

**Step 1**: Click sitemap icon on any member row
- Modal opens showing relationships
- Shows member name you're editing

**Step 2**: Link Father
- Dropdown: Select from all other members
- Status: Shows ✓ Father linked or Not linked
- Button: Unlink (if linked) - appears when linked

**Step 3**: Link Mother  
- Dropdown: Select from all other members
- Status: Shows current status
- Button: Unlink (if linked)

**Step 4**: Link Spouse
- Dropdown: Select partner member
- Status: Shows married/unmarried
- Button: Unlink (if linked)
- Reciprocal: Both get marked as married

**Step 5**: Link Children
- Shows count of current children
- List of linked children
- Add Child dropdown: Select child member
- Button: "Add Child" to establish relationship

### What Happens:
- Links are reciprocal (bidirectional)
- Father automatically adds to children list
- Spouse gets reciprocal spouse link
- Child gets parent link
- All data syncs immediately

### Example Workflow:
```
1. Open John Sharma's relationship manager
2. Select "Rahul Sharma" as Father
3. Link established ✓
4. Rahul's children list now includes John
5. John's "Has Father" now shows Yes
```

---

## 8️⃣ BULK IMPORT CSV

**What**: Import multiple members from CSV file  
**Where**: "Import Members" button (indigo/blue)  
**What You Do**: Upload/paste CSV data to create members

### Supported Format:

**CSV Columns** (comma-separated):
```
name, surname, gotra, village, contactNumber, honorific
```

**Required Fields**:
- name ✓ (required)
- gotra ✓ (required)

**Optional Fields**:
- surname
- village
- contactNumber
- honorific

### Example CSV:
```csv
name,surname,gotra,village,contactNumber,honorific
Rajesh Sharma,Sharma,Sharma Gotra,Delhi,9876543210,Mr
Priya Singh,Singh,Singh Gotra,Mumbai,9876543211,Ms
Amit Kumar,,Kumar Gotra,Bangalore,,Mr
```

### How to Use:

**Method 1: Upload File**
1. Click "Import Members"
2. Drag CSV file into drop zone OR
3. Click "Choose File" and select file
4. Preview appears

**Method 2: Paste Data**
1. Click in textarea
2. Paste CSV data
3. Preview appears

### Step-by-Step:

**Step 1**: Open Modal
- Click "Import Members" button
- Modal opens

**Step 2**: Add Data
- Upload file OR paste text
- Preview section appears

**Step 3**: Review Preview
- Shows first 10 members in preview table
- Shows "+X more" if more records
- Displays error if invalid

**Step 4**: Import
- Click "Import" button
- Confirmation dialog appears
- Shows: "Import 15 members?"

**Step 5**: Results
- Success message appears
- Shows: "✅ Imported 15 new members!"
- Also shows: "2 duplicates skipped"
- Page refreshes with new members

### What Happens:
- **New members** get `isApproved: false` (pending review)
- **Duplicates** skipped (same name + gotra existing)
- **All fields** validated before save
- **Database** indexed for fast lookup

### Example Validation:
```
CSV Row 1: "John" (missing gotra) ❌ SKIPPED
CSV Row 2: "Rahul,Sharma,Sharma Gotra" ✅ IMPORTED
CSV Row 3: "Rahul,Sharma,Sharma Gotra" ⚠️ DUPLICATE SKIPPED
```

---

## 🎯 COMMON WORKFLOWS

### Workflow 1: Clean Up Database
1. Click "Check Duplicates"
2. Review potential duplicates
3. Delete clearly wrong entries
4. Edit others to merge info

### Workflow 2: Add Members from List
1. Prepare CSV file with new members
2. Click "Import Members"
3. Upload CSV
4. Review preview
5. Import confirmed

### Workflow 3: Complete Profiles
1. Filter: Data Quality = Incomplete
2. Sort by name
3. Click Edit on each
4. Fill missing fields
5. Quality score improves

### Workflow 4: Build Family Tree
1. Import basic members
2. Filter by village/surname
3. For each member, click sitemap
4. Link father/mother
5. Links cascade to children

### Workflow 5: Bulk Operations
1. Search/filter to find group
2. Select all (header checkbox)
3. Click "Approve" to bulk approve
4. Or "Delete" to remove duplicates

---

## ⚠️ IMPORTANT NOTES

### Data Safety
- Deletions remove relationships properly
- No orphaned data left behind
- Bulk operations can be massive - use carefully
- Always confirm before deleting

### Performance
- Duplicate detection slow for 10,000+ members
- Sort/pagination instant for <5000 members
- Import processes optimally
- Filters real-time

### Backups
- No auto-backup in system (yet)
- Export CSV regularly for safety
- Keep records of bulk operations
- Document major changes

### Best Practices
✓ Always review before bulk operations
✓ Complete profiles before closing
✓ Check for duplicates before importing
✓ Use filters before bulk deleting
✓ Export data regularly

---

**Last Updated**: April 2, 2026  
**Version**: 1.0  
**Status**: Production Ready
