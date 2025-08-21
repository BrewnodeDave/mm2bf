import { InvoiceParser } from './src/parsers/invoice-parser.js';

const parser = new InvoiceParser();

async function testParsing() {
  try {
    const result = await parser.parsePDF('./invoice-18759.pdf');
    console.log('=== SERVER-SIDE PARSING RESULT ===');
    console.log('Invoice data:', {
      number: result.invoiceNumber,
      date: result.date,
      total: result.total
    });
    console.log('Items found:', result.items.length);
    console.log('First few items:');
    result.items.slice(0, 5).forEach((item, i) => {
      console.log(`Item ${i+1}:`, {
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price
      });
    });
    
    // Also show some raw text for comparison
    console.log('\n=== RAW TEXT SAMPLE ===');
    console.log('Raw text length:', result.rawText?.length || 'No raw text');
    if (result.rawText) {
      console.log('First 500 chars:', result.rawText.substring(0, 500));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testParsing();
