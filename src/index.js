import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { InvoiceParser } from './parsers/invoice-parser.js';
import { BrewfatherAPI } from './api/brewfather-api.js';
import { IngredientMapper } from './mappers/ingredient-mapper.js';
import { InventoryReporter } from './reports/inventory-reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class MaltMillerInventorySync {
  constructor() {
    this.invoiceParser = new InvoiceParser();
    this.brewfatherAPI = new BrewfatherAPI(
      process.env.BREWFATHER_USER_ID,
      process.env.BREWFATHER_API_KEY
    );
    this.ingredientMapper = new IngredientMapper();
    this.reporter = new InventoryReporter();
  }

  async processInvoice(pdfPath) {
    try {
      console.log(`Processing invoice: ${pdfPath}`);
      
      // Parse the PDF invoice
      const invoiceData = await this.invoiceParser.parsePDF(pdfPath);
      console.log(`Extracted ${invoiceData.items.length} items from invoice`);
      
      // Map items to Brewfather format
      const mappedIngredients = await this.ingredientMapper.mapIngredients(invoiceData.items);
      
      // Group by ingredient type
      const groupedIngredients = this.groupIngredientsByType(mappedIngredients);
      
      console.log('Ingredient summary:');
      Object.entries(groupedIngredients).forEach(([type, items]) => {
        const totalCost = items.reduce((sum, item) => sum + (item.cost * item.amount || 0), 0);
        console.log(`  ${type}: ${items.length} items (Total cost: £${totalCost.toFixed(2)})`);
      });
      
      // Add ingredients to Brewfather
      const results = await this.addToBrewfather(groupedIngredients);
      
      // Generate detailed report
      const reportFiles = this.reporter.saveReport(invoiceData, mappedIngredients);
      this.reporter.printSummary(reportFiles.report);
      
      console.log('\n📁 Reports saved:');
      console.log(`  JSON: ${path.basename(reportFiles.jsonPath)}`);
      console.log(`  CSV: ${path.basename(reportFiles.csvPath)}`);
      console.log(`  Brewfather CSV: ${path.basename(reportFiles.brewfatherPath)}`);
      
      // Display sync results
      this.displaySyncResults(results);
      
      console.log('\nSync completed successfully!');
      return results;
      
    } catch (error) {
      console.error('Error processing invoice:', error);
      throw error;
    }
  }

  groupIngredientsByType(ingredients) {
    return ingredients.reduce((groups, ingredient) => {
      const type = ingredient.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ingredient);
      return groups;
    }, {});
  }

  async addToBrewfather(groupedIngredients) {
    const results = {};
    
    for (const [type, ingredients] of Object.entries(groupedIngredients)) {
      console.log(`Updating ${ingredients.length} ${type} ingredients in Brewfather...`);
      
      try {
        switch (type) {
          case 'fermentable':
            results[type] = await this.brewfatherAPI.updateFermentables(ingredients);
            break;
          case 'hop':
            results[type] = await this.brewfatherAPI.updateHops(ingredients);
            break;
          case 'yeast':
            results[type] = await this.brewfatherAPI.updateYeasts(ingredients);
            break;
          case 'misc':
            results[type] = await this.brewfatherAPI.updateMiscs(ingredients);
            break;
          default:
            console.warn(`Unknown ingredient type: ${type}`);
        }
      } catch (error) {
        console.error(`Error updating ${type} ingredients:`, error);
        results[type] = { error: error.message };
      }
    }
    
    return results;
  }

  displaySyncResults(results) {
    console.log('\n🎯 SYNC RESULTS SUMMARY:\n');
    
    const summary = this.getSyncSummary(results);
    
    Object.entries(summary).forEach(([type, data]) => {
      if (data.successful > 0) {
        console.log(`✅ ${type.toUpperCase()} - Updated (${data.successful}):`);
        data.items.filter(item => item.success).forEach(item => {
          const current = item.currentAmount || 0;
          const adjustment = item.adjustedBy || 0;
          const newTotal = item.newAmount || (current + adjustment);
          console.log(`   • ${item.name}: ${current} → ${newTotal} ${item.unit} (+${adjustment} ${item.unit})`);
        });
      }
      
      if (data.notFound > 0) {
        console.log(`⚠️ ${type.toUpperCase()} - Not Found in Brewfather (${data.notFound}):`);
        data.items.filter(item => item.action === 'not_found').forEach(item => {
          console.log(`   • ${item.name}`);
        });
      }
      
      if (data.errors > 0) {
        console.log(`❌ ${type.toUpperCase()} - Errors (${data.errors}):`);
        data.items.filter(item => item.action === 'error').forEach(item => {
          console.log(`   • ${item.name}: ${item.error}`);
        });
      }
    });
  }
  
  getSyncSummary(results) {
    const summary = {};
    
    for (const [type, typeResults] of Object.entries(results)) {
      if (typeResults.error) {
        if (!summary[type]) {
          summary[type] = { successful: 0, notFound: 0, errors: 0, items: [] };
        }
        summary[type].errors += 1;
        summary[type].items.push({ name: typeResults.error, action: 'error' });
        continue;
      }
      
      if (Array.isArray(typeResults)) {
        const successes = typeResults.filter(r => r.success);
        const failures = typeResults.filter(r => !r.success);
        const notFound = failures.filter(r => r.action === 'not_found');
        
        if (!summary[type]) {
          summary[type] = { successful: 0, notFound: 0, errors: 0, items: [] };
        }
        
        summary[type].successful += successes.length;
        summary[type].notFound += notFound.length;
        summary[type].errors += failures.length - notFound.length;
        
        successes.forEach(result => {
          summary[type].items.push({ name: result.name, success: true, currentAmount: result.currentAmount, adjustedBy: result.adjustedBy, newAmount: result.newAmount, unit: result.unit });
        });
        
        notFound.forEach(result => {
          summary[type].items.push({ name: result.name, action: 'not_found' });
        });
        
        failures.filter(r => r.action !== 'not_found').forEach(result => {
          summary[type].items.push({ name: result.name, action: 'error', error: result.error });
        });
      }
    }
    
    return summary;
  }
}

// Main execution
async function main() {
  try {
    const sync = new MaltMillerInventorySync();
    
    // Check for PDF files in the current directory
    const currentDir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(currentDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in the current directory');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} PDF file(s): ${pdfFiles.join(', ')}`);
    
    // Process each PDF file
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(currentDir, pdfFile);
      await sync.processInvoice(pdfPath);
    }
    
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { MaltMillerInventorySync };
