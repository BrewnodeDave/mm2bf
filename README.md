# Malt Miller Inventory to Brewfather Sync

This JavaScript module automatically extracts ingredients from Malt Miller invoice PDFs and syncs them with your Brewfather inventory using the Brewfather v2 API.

## Features

- ✅ **PDF Invoice Parsing**: Automatically extracts ingredients from Malt Miller PDF invoices
- ✅ **Smart Classification**: Identifies malts, hops, yeast, water minerals, and equipment
- ✅ **Cost Calculation**: Calculates cost per unit for accurate inventory valuation
- ✅ **Brewfather v2 API**: Updates existing inventory items with new stock and costs
- ✅ **Ingredient Matching**: Smart matching between invoice items and Brewfather inventory
- ✅ **Multiple Export Formats**: CSV, JSON reports for manual import if needed
- ✅ **Detailed Logging**: Shows exactly what items are being processed

## What It Extracts

- **Malts & Fermentables**: Base malts, specialty malts, adjuncts (auto-detected EBC colors)
- **Hops**: Pellets, leaf hops, hop extracts (with alpha acid detection)
- **Yeast**: Dry yeast, liquid yeast, yeast nutrients (detects laboratory/brand)
- **Water Minerals**: Salts, acids, clarifiers
- **Equipment**: Correctly categorizes non-ingredient items as misc

## Quick Start

### Option 1: Web Application (Recommended)

Launch the modern web interface for the best user experience:

```bash
npm run webapp-dev
```

Then open http://localhost:3000 in your browser for:
- 🎯 **Drag & drop PDF upload**
- 📊 **Visual ingredient analysis** 
- 🔗 **Interactive Brewfather matching**
- 📁 **One-click report downloads**

### Option 2: Extract Costs Only (CLI)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Extract costs from invoice:**
   ```bash
   npm run extract
   ```
   This generates detailed CSV reports with cost per unit that you can manually import to Brewfather.

### Option 3: Auto-Sync with Brewfather (CLI Advanced)

1. **Get Brewfather API credentials:**
   - Go to [Brewfather](https://web.brewfather.app) → Settings → API
   - Generate a new API key with "Read Inventory" and "Edit Inventory" scopes
   - Copy your User ID and API key

2. **Configure credentials:**
   ```bash
   cp .env.example .env
   # Edit .env and add your Brewfather User ID and API key
   ```

3. **Analyze what ingredients can be matched:**
   ```bash
   npm run match
   ```
   This shows which invoice items match your existing Brewfather inventory.

4. **Add missing items to Brewfather manually:**
   - Log into Brewfather web app
   - Add any unmatched ingredients to your inventory (you can set amounts to 0)

## How Brewfather v2 API Works

The Brewfather v2 API doesn't allow creating new inventory items via API - it only allows updating existing ones. This is actually better for inventory management because:

1. **Quality Control**: You manually add items to Brewfather with correct specifications
2. **Cost Tracking**: The tool updates quantities and costs without duplicating items
3. **Smart Matching**: Automatically matches invoice items with your existing inventory

## Workflow

### Step 1: Extract and Analyze (Always)
```bash
# See what's in your invoice
npm run extract

# Check what matches your Brewfather inventory
npm run match
```

### Step 2: Add Missing Items (If Auto-syncing)
- Log into Brewfather web app
- Add any "NO MATCH" ingredients from the analysis
- You can set quantities to 0 initially

### Step 3: Sync (Optional)
```bash
# Update Brewfather with invoice quantities and costs
npm run sync
```

The tool will:
- ✅ Update quantities for matched items
- ✅ Set cost per unit for accurate inventory valuation  
- ✅ Generate detailed reports for your records

## Available Interfaces

### 🌐 Web Application
- **Start**: `npm run webapp-dev`
- **URL**: http://localhost:3000
- **Best for**: Interactive use, visual feedback, drag & drop uploads

### 💻 Command Line Interface  
- **Extract costs**: `npm run extract` (offline, no API needed)
- **Analyze matches**: `npm run match` (shows sync compatibility)  
- **Auto-sync**: `npm run sync` (updates Brewfather inventory)
- **Best for**: Automation, batch processing, scripting

Both interfaces use the same core logic and produce identical results.

6. **Try auto-sync to Brewfather (experimental):**
   ```bash
   npm start
   ```

## Usage Examples

### Extract Costs Only (Recommended)
```bash
npm run extract
```
Generates detailed CSV reports with cost per unit for manual import to Brewfather.

### Test PDF Parsing Only
```bash
npm run parse-only
```

### Test Brewfather Connection Only
```bash
npm run connection-test
```

### Run Complete Dry Run
```bash
npm run dry-run
```

### Try Auto-Sync to Brewfather (Experimental)
```bash
npm start
```

## Example Output

```
📄 Processing invoice: invoice-18759.pdf
✅ Extracted 4 items from invoice

📊 INVENTORY REPORT
==================
Invoice: 18759 (14th June 2025)
Total Items: 4
Total Cost: £37.53

By Category:

MISC (1 items - £24.00):
  • Large Grain Bag/Kettle Liner - BIAB - Brew in a Bag
    800 g @ £0.0300/g = £24.00

YEASTS (3 items - £13.53):
  • LALBREW® CBC-1 CASK & BOTTLE CONDITIONING YEAST
    1 pkg @ £4.4500/pkg = £4.45
  • WHC Dried Yeast - High Voltage - 11g Packet
    1 pkg @ £4.4900/pkg = £4.49
  • WHC Dried Yeast - Mango Madness - 11g Packet
    1 pkg @ £4.5900/pkg = £4.59

📁 Reports saved:
  📊 JSON Report: malt-miller-18759-2025-08-17.json
  📋 CSV Report: malt-miller-18759-2025-08-17.csv
  🍺 Brewfather CSV: brewfather-inventory-18759-2025-08-17.csv
```

### Generated CSV Format

The CSV reports include detailed cost information:

| Type | Name | Quantity | Unit | Cost per Unit (£) | Total Cost (£) |
|------|------|----------|------|-------------------|----------------|
| yeast | LALBREW® CBC-1 CASK & BOTTLE CONDITIONING YEAST | 1 | pkg | 4.4500 | 4.45 |
| yeast | WHC Dried Yeast - High Voltage - 11g Packet | 1 | pkg | 4.4900 | 4.49 |

## Supported Formats

- **Malt Miller PDF Invoices**: Automatically detects and parses the tabular format
- **Multiple Items**: Handles multiple ingredients per invoice
- **Quantities & Units**: Extracts quantities in kg, g, L, ml, packets, etc.
- **Pricing**: Captures individual line totals

## Troubleshooting

### PDF Parsing Issues
- Ensure the PDF is a standard Malt Miller invoice
- Check that the PDF contains searchable text (not just images)
- Run `npm run test -- --parse-only` to debug parsing

### Brewfather Connection Issues
- Verify your User ID and API key in `.env`
- Test connection with `npm run test -- --connection-only`
- Check that your API key has inventory write permissions

### Ingredient Classification Issues
- Review the dry run output to see how items are classified
- Equipment and non-ingredients are automatically categorized as "misc"
- The system is conservative and will mark unknown items as "misc"

## Files Structure

```
src/
├── index.js              # Main application entry point
├── parsers/
│   └── invoice-parser.js  # PDF parsing logic
├── api/
│   └── brewfather-api.js  # Brewfather API client
├── mappers/
│   └── ingredient-mapper.js # Ingredient classification
└── test.js              # Test and validation scripts
```

## License

MIT
