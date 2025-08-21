import { InvoiceParser } from './parsers/invoice-parser.js';
import { IngredientMapper } from './mappers/ingredient-mapper.js';
import { InventoryReporter } from './reports/inventory-reporter.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class InventoryExtractor {
  constructor() {
    this.invoiceParser = new InvoiceParser();
    this.ingredientMapper = new IngredientMapper();
    this.reporter = new InventoryReporter();
  }

  async extractFromInvoice(pdfPath) {
    try {
      console.log(`📄 Processing invoice: ${path.basename(pdfPath)}`);
      
      // Parse the PDF invoice
      const invoiceData = await this.invoiceParser.parsePDF(pdfPath);
      console.log(`✅ Extracted ${invoiceData.items.length} items from invoice`);
      
      // Map items to ingredients with cost information
      const mappedIngredients = await this.ingredientMapper.mapIngredients(invoiceData.items);
      
      // Generate reports
      const reportFiles = this.reporter.saveReport(invoiceData, mappedIngredients);
      this.reporter.printSummary(reportFiles.report);
      
      console.log('\n📁 Reports saved:');
      console.log(`  📊 JSON Report: ${path.basename(reportFiles.jsonPath)}`);
      console.log(`  📋 CSV Report: ${path.basename(reportFiles.csvPath)}`);
      console.log(`  🍺 Brewfather CSV: ${path.basename(reportFiles.brewfatherPath)}`);
      
      console.log('\n💡 To add to Brewfather:');
      console.log('   1. Open Brewfather app');
      console.log('   2. Go to Inventory section');
      console.log('   3. Manually add each ingredient with the cost information from the CSV');
      console.log('   4. Or check if Brewfather supports CSV import in their settings');
      
      return {
        invoiceData,
        mappedIngredients,
        reportFiles
      };
      
    } catch (error) {
      console.error('❌ Error processing invoice:', error);
      throw error;
    }
  }
}

// Main execution for standalone cost extraction
async function main() {
  try {
    const extractor = new InventoryExtractor();
    
    // Check for PDF files in the current directory
    const currentDir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(currentDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('📄 No PDF files found in the current directory');
      console.log('💡 Place your Malt Miller invoice PDFs in this folder and run again');
      return;
    }
    
    console.log(`📄 Found ${pdfFiles.length} PDF file(s): ${pdfFiles.join(', ')}`);
    console.log('');
    
    // Process each PDF file
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(currentDir, pdfFile);
      await extractor.extractFromInvoice(pdfPath);
      console.log(''); // Add spacing between files
    }
    
    console.log('🎉 All invoices processed successfully!');
    
  } catch (error) {
    console.error('💥 Application error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { InventoryExtractor };
