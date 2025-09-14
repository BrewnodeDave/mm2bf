import { InventoryReporter } from '../../src/reports/inventory-reporter.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { invoiceData, ingredients } = JSON.parse(event.body);
    
    if (!invoiceData || !ingredients) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invoice data and ingredients are required' })
      };
    }

    const reporter = new InventoryReporter();
    
    // Generate report content directly without saving files
    const reports = {
      json: {
        filename: `mm-inventory-${invoiceData.invoice.invoiceNumber}.json`,
        content: JSON.stringify(reporter.generateReport(invoiceData, ingredients), null, 2)
      },
      csv: {
        filename: `mm-inventory-${invoiceData.invoice.invoiceNumber}.csv`,
        content: reporter.exportToCSV(invoiceData, ingredients)
      },
      brewfatherCsv: {
        filename: `brewfather-inventory-${invoiceData.invoice.invoiceNumber}.csv`,
        content: reporter.exportToBrewfatherCSV(ingredients)
      }
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ reports })
    };

  } catch (error) {
    console.error('Error generating reports:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};