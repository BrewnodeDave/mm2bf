import { MaltMillerInventorySync } from './index.js';
import { InvoiceParser } from './parsers/invoice-parser.js';
import { BrewfatherAPI } from './api/brewfather-api.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function testPDFParsing() {
  console.log('=== Testing PDF Parsing ===');
  
  const parser = new InvoiceParser();
  const pdfPath = path.resolve(__dirname, '..', 'invoice-18759.pdf');
  
  try {
    const invoiceData = await parser.parsePDF(pdfPath);
    
    console.log('Invoice Number:', invoiceData.invoiceNumber);
    console.log('Date:', invoiceData.date);
    console.log('Total:', invoiceData.total);
    console.log('Items found:', invoiceData.items.length);
    
    // Debug: Show raw text content to help with parsing
    if (invoiceData.rawText) {
      console.log('\nRaw text content (first 500 chars):');
      console.log(invoiceData.rawText.slice(0, 500));
      console.log('\n...\n');
    }
    
    console.log('\nFirst 5 items:');
    invoiceData.items.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - ${item.quantity} ${item.unit} - £${item.price}`);
    });
    
    return invoiceData;
  } catch (error) {
    console.error('PDF parsing failed:', error);
    return null;
  }
}

async function testBrewfatherConnection() {
  console.log('\\n=== Testing Brewfather Connection ===');
  
  if (!process.env.BREWFATHER_USER_ID || !process.env.BREWFATHER_API_KEY) {
    console.log('⚠️  Brewfather credentials not found in .env file');
    console.log('Please copy .env.example to .env and fill in your credentials');
    return false;
  }
  
  try {
    const api = new BrewfatherAPI(
      process.env.BREWFATHER_USER_ID,
      process.env.BREWFATHER_API_KEY
    );
    
    const result = await api.testConnection();
    
    if (result.success) {
      console.log('✅ Brewfather connection successful!');
      return true;
    } else {
      console.log('❌ Brewfather connection failed:', result.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Brewfather connection error:', error.message);
    return false;
  }
}

async function testIngredientMapping(invoiceData) {
  console.log('\n=== Testing Ingredient Mapping ===');
  
  if (!invoiceData || !invoiceData.items.length) {
    console.log('No invoice data to test mapping');
    return;
  }
  
  // Import just the ingredient mapper, not the full sync class
  const { IngredientMapper } = await import('./mappers/ingredient-mapper.js');
  const mapper = new IngredientMapper();
  
  try {
    const mappedIngredients = await mapper.mapIngredients(invoiceData.items);
    
    // Group by type manually
    const grouped = mappedIngredients.reduce((groups, ingredient) => {
      const type = ingredient.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ingredient);
      return groups;
    }, {});
    
    console.log('Ingredient mapping results:');
    Object.entries(grouped).forEach(([type, items]) => {
      console.log(`\n${type.toUpperCase()}S (${items.length}):`);
      items.slice(0, 3).forEach(item => {
        const costInfo = item.cost > 0 ? ` @ £${item.cost.toFixed(4)}/${item.unit}` : '';
        console.log(`  - ${item.name} (${item.amount} ${item.unit}${costInfo})`);
      });
      if (items.length > 3) {
        console.log(`  ... and ${items.length - 3} more`);
      }
    });
    
    return mappedIngredients;
  } catch (error) {
    console.error('Ingredient mapping failed:', error);
    return null;
  }
}

async function runDryRun() {
  console.log('\\n=== Running Dry Run (no API calls) ===');
  console.log('This will parse the PDF and show what would be sent to Brewfather');
  
  const invoiceData = await testPDFParsing();
  if (!invoiceData) return;
  
  const mappedIngredients = await testIngredientMapping(invoiceData);
  if (!mappedIngredients) return;
  
  console.log('\\n✅ Dry run completed successfully!');
  console.log('If everything looks correct, run npm start to sync with Brewfather');
}

async function main() {
  console.log('Malt Miller to Brewfather Sync - Test Script\\n');
  
  const args = process.argv.slice(2);
  
  if (args.includes('--connection-only')) {
    await testBrewfatherConnection();
  } else if (args.includes('--parse-only')) {
    await testPDFParsing();
  } else if (args.includes('--dry-run')) {
    await runDryRun();
  } else {
    // Run all tests
    const invoiceData = await testPDFParsing();
    const connectionOk = await testBrewfatherConnection();
    
    if (invoiceData) {
      await testIngredientMapping(invoiceData);
    }
    
    console.log('\\n=== Summary ===');
    console.log(`PDF Parsing: ${invoiceData ? '✅' : '❌'}`);
    console.log(`Brewfather Connection: ${connectionOk ? '✅' : '❌'}`);
    
    if (invoiceData && connectionOk) {
      console.log('\\n🎉 All tests passed! You can now run "npm start" to sync your inventory.');
    } else {
      console.log('\\n⚠️  Some tests failed. Please check the errors above.');
    }
  }
}

main().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
});
