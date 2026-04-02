# 🌳 FAMILY TREE QUICK REFERENCE

## कहाँ जाएं? (Access Points)

| Feature | URL | Purpose | Access |
|---------|-----|---------|--------|
| **Community Tree** | `/members/community-tree` | पूरे समाज का family tree | Public, Homepage link |
| **Individual Tree** | `/members/family-tree/:id` | किसी व्यक्ति का अपना tree | Public, Profile से |
| **Relationship Mgmt** | `/admin/members` | नए relationships set करना | Admin only |

---

## 📚 Features at a Glance

### On Community Tree (/members/community-tree)

```
┌─ Gotra Filter (गोत्र फ़िल्टर)
│  └─ सभी परिवार (All)
│     Sharma Gotra
│     Singh Gotra
│     ...
│
├─ Search Box (सदस्य खोजें)
│  └─ Real-time name/surname search
│
├─ Interactive Tree (इंटरेक्टिव ट्री)
│  ├─ Mouse zoom (wheel)
│  ├─ Mouse drag (pan)
│  ├─ Click node (profile drawer)
│  └─ Color coded members
│
├─ Minimap (Bottom-left)
│  └─ Overview of entire tree
│
└─ Legend (Bottom-right)
   ├─ Regular member (white + saffron)
   ├─ Current viewer (orange)
   ├─ Deceased (gray)
   └─ Lineage lines (dark)
```

### On Individual Tree (/members/family-tree/:id)

```
सभी features + अतिरिक्त:

┌─ View Mode Toggle (ऊपर right)
│  ├─ Immediate (नजदीकी) - Parents/Children/Spouse only
│  └─ Full (पूर्ण) - Entire ancestry + descendants
│
└─ Same Interactive Features
   (Search, Minimap, Legend, etc.)
```

---

## 🎮 Interaction Guide

### Desktop
```
Mouse Wheel Up/Down     → Zoom in/out
Left-click + Drag       → Pan around
Single Click on Node    → Open profile drawer
Right-click Menu        → (if enabled) additional options
```

### Mobile/Tablet
```
Pinch (2-finger)        → Zoom in/out
Two-finger Drag         → Pan around
Single Tap              → Open profile drawer
Tap Legend              → View indicators
```

---

## 👤 What Appears in Profile Drawer?

```
When you click any member in the tree:

┌─────────────────────────────────────────┐
│         [Profile Image]                 │
│                                         │
│  Member Name                            │
│  Surname (in सaffron)                  │
│  Title/Occupation                       │
│                                         │
│  📍 Village: _______________           │
│  ॐ Gotra: ___________________         │
│  📱 Contact: ________________         │
│  ✉️  Email: _________________        │
│  🏠 Address: ________________        │
│  🕯️ Deceased (if applicable) │
│                                         │
│  [View Full Profile Button]             │
│                                         │
└─────────────────────────────────────────┘

◄ बंद करने के लिए: X button या backdrop पर click करें
```

---

## 🔄 Relationship Setting (Admin)

### Process:
```
1. Go to /admin/members page
2. Find member in table
3. Click green sitemap icon (🗺️) in Actions column
4. Modal opens with:
   - Father dropdown
   - Mother dropdown
   - Spouse dropdown
   - Children section

5. Select from dropdown → Link करो
6. System automatically:
   ✓ Reciprocal relationship creates
   ✓ Family tree updates
   ✓ Page refreshes

Example:
• If Raj's father = Ram
• Then Ram's children automatically includes Raj
• Tree shows this relationship immediately
```

---

## 🎨 Visual Indicators

### Member Types

```
Normal Member               Current Viewer (You)
┌──────────────────┐      ┌──────────────────┐
│ ┃                │      │ ■                │
│ ┃ Name           │      │ ■ Your Name      │
│ ┃ Surname        │      │ ■ Your Surname   │
└──────────────────┘      └──────────────────┘
White + Saffron bar       Orange indicator


Deceased Member
┌──────────────────┐
│ ░                │ (grayed out)
│ ░ Late Name      │
│ ░ Surname        │
└──────────────────┘
Gray border + Slate bar
```

### Connection Lines

```
Vertical Line (|)          = Parent-child
Horizontal Line (__)       = Sibling group
Dotted/Curved Line         = Spouse connection
```

---

## 📊 View Modes (Individual Tree Only)

### Mode: IMMEDIATE (नजदीकी)
```
Shows ONLY:
- Your parents (if set)
- Your spouse (if set)
- Your children (if set)
- Your grandchildren (if set)

Useful: Quick family overview
Time: Instant load
```

### Mode: FULL (पूर्ण)
```
Shows EVERYTHING:
- All ancestors (दादा, परदादा, आदि)
- You
- All descendants (बच्चे, पोते, आदि)
- All siblings & their families
- Extended relationships

Useful: Complete genealogy
Time: Few seconds for large families
```

---

## 🔍 Search Function

```
Where: Search box (ऊपर middle)
Type: Member name, surname, anything

Result:
✓ Match होने वाले members highlight होते हैं
✓ बाकी fade हो जाते हैं
✓ Position auto-adjust होती है

Example:
Search "Sharma" → सभी Sharma family members highlight हो जाते हैं
```

---

## 🗺️ Minimap (छोटा नक्शा)

```
Location: Bottom-left corner
Shows: पूरे tree का mini version

Use: 
- बड़े family trees में orientation
- Scroll करते पता चले कहाँ हो
- Desktop पर visible, mobile पर hidden

Helpful for: 500+ member families
```

---

## 📋 Legend (संकेत)

```
Location: Bottom-right corner
Always visible as reference

Shows:
1. Regular Member symbol
2. Current Viewer (self) symbol
3. Deceased Member symbol
4. Lineage Connection line

Always available: No menu opening needed
```

---

## 🔐 Privacy Info

```
Public View:
✓ Everyone can see community tree
✓ All member info is public
✓ Phone, email, address visible
✗ No permissions/privacy filtering

Admin Control:
- "isFamilyTreeOnly" flag
- Hides from directory
- Still in family tree
- For historical members

Example:
Great-great-grandfather might be marked 
as "tree-only" - not in member directory 
but still visible in lineage
```

---

## 🐛 Troubleshooting

### Issue: Tree not loading
```
Solution:
1. Refresh page (F5 or Ctrl+R)
2. Check internet connection
3. Wait 3-5 seconds for D3.js render
4. Try different browser
```

### Issue: Member not appearing
```
Reasons:
- Not approved yet (isFamilyTreeOnly not set)
- No relationships set in admin
- Check admin → Relationship Manager

Fix:
- Set relationships in admin panel
- Mark isFamilyTreeOnly if needed
```

### Issue: Relationships showing wrong
```
Fix:
1. Go to /admin/members
2. Find member
3. Click sitemap icon
4. Check/correct relationships
5. Save changes
6. Go to tree → Refresh
```

### Issue: Very large family (slow)
```
Optimize:
- Use "Immediate" mode instead of "Full"
- Filter by specific Gotra
- Use Search to isolate branches
- Desktop recommended (better rendering)
```

---

## 📱 Mobile Tips

```
✓ Supported: Family tree works on mobile
✓ Responsive: Adapts to screen size
✓ Touch: Pinch zoom, 2-finger drag

Tips:
- Landscape mode recommended
- Zoom in first
- Use search to reduce tree size
- Minimap hidden (saves space)
```

---

## 🎯 Common Tasks

### Task 1: See My Ancestors
```
1. Go to your profile
2. Click "Family Tree" link
3. Select "Full" mode
4. Scroll up to see ancestors
```

### Task 2: View Community Tree
```
1. Homepage
2. Click "संपूर्ण वंशावली (Family Tree)"
3. OR directly: /members/community-tree
```

### Task 3: Find All Sharmas
```
1. Community Tree page
2. Select "Sharma Gotra" from dropdown
3. Only Sharma family tree shows
```

### Task 4: Search Someone
```
1. On any tree page
2. Type name in search bar
3. Members matching name highlight
```

### Task 5: Set Up Relationships (Admin)
```
1. Go to /admin/members
2. Find member in table
3. Click 🗺️ (sitemap icon)
4. Select Father/Mother/Spouse/Children
5. Click Link → Save
```

---

## ⚙️ Technical Info

### Data Stored:
```
Member Document has:
- father: ID reference (or null)
- mother: ID reference (or null)
- spouse: ID reference (or null)
- children: Array of IDs (or empty)
- isDeceased: Boolean
- deathDate: Date (if deceased)
- isFamilyTreeOnly: Boolean
```

### API Used:
```
Frontend:
- D3.js v7 for visualization
- Vanilla JavaScript for interactions

Backend:
- MongoDB for storage
- Express.js for API
- Lean queries for performance
```

### Loading Flow:
```
1. User visits /members/family-tree/:id
2. Browser fetches /members/api/family-tree/:id
3. API returns JSON with all relationships
4. D3.js renders tree (2-3 seconds for large)
5. User can interact (zoom, pan, click)
```

---

## ✅ Feature Checklist

- ✅ Interactive D3.js visualization
- ✅ Immediate / Full view modes
- ✅ Gotra filtering
- ✅ Real-time search
- ✅ Profile drawer
- ✅ Minimap navigation
- ✅ Visual legend
- ✅ Touch support
- ✅ Mobile responsive
- ✅ Relationship management
- ✅ Deceased indicator
- ✅ Performance optimized
- ✅ Public access
- ✅ Admin control

---

## 🚀 Status

**All Features**: ✅ LIVE & WORKING  
**Performance**: ⚡ OPTIMIZED  
**Mobile**: 📱 RESPONSIVE  
**Admin**: 🔑 READY  

---

**Access Now**:
- Community: `http://localhost:3000/members/community-tree`
- Individual: `http://localhost:3000/members/family-tree/:id`
- Admin: `http://localhost:3000/admin/members`
