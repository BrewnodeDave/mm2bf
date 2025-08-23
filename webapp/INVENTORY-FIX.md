# 🔧 Fixed: Current Amount Showing as Zero

## The Problem
When partial matches were found, the current amount was showing as "0 units" instead of the actual inventory amount from Brewfather.

## Root Cause
The issue was in the data structure mapping between the Brewfather API response and the frontend display:

1. **Brewfather API** returns inventory amounts in the `inventory` field (as a number)
2. **Frontend** was expecting the data in a nested `inventory.amount` structure
3. **API matching logic** wasn't properly mapping the inventory data

## ✅ What I Fixed

### 1. Updated API Matching Logic (`src/api/brewfather-api.js`)
```javascript
// Before: Inconsistent field mapping
currentAmount = match.inventory_amount || match.amount || match.inventory || 0;

// After: Proper Brewfather API structure
const currentAmount = match.inventory || 0;  // Direct from Brewfather
```

### 2. Added Proper Unit Mapping
```javascript
// Now correctly assigns units based on ingredient type:
- fermentable: 'kg'
- hop/misc: 'g' 
- yeast: 'pkg'
```

### 3. Structured Data Consistently
```javascript
brewfatherItem: {
  ...match,
  currentAmount: currentAmount,
  unit: unit,
  inventory: {
    amount: currentAmount,  // For frontend compatibility
    unit: unit
  }
}
```

### 4. Added Missing Dependency
- Added `axios` to `package.json` for Brewfather API calls

### 5. Frontend Display
- Ensured proper fallback chain for displaying current amounts
- Now shows actual inventory amounts instead of "0 units"

## 🧪 How to Test

1. **Deploy the updated code** to Netlify
2. **Upload a Malt Miller invoice** 
3. **Analyze matches** with Brewfather credentials
4. **Check partial matches** - should now show actual current amounts like:
   - "Brewfather: Citra (Current: 2.5 kg)" ✅
   - Instead of: "Brewfather: Citra (Current: 0 units)" ❌

## 📦 Files Modified

- ✅ `src/api/brewfather-api.js` - Fixed inventory amount mapping
- ✅ `static/index.html` - Cleaned up display logic
- ✅ `package.json` - Added axios dependency
- ✅ `netlify/functions/api.js` - Uses updated API code automatically

## 🚀 Ready to Deploy

The fix is ready! When you deploy to Netlify, the current amounts should display correctly for all ingredient matches.
