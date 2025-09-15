import { InventoryReporter } from '../../src/reports/inventory-reporter.js';
import { logApiCall } from './utils/logger.cjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    const errorResponse = {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    await logApiCall('generate-reports', event, errorResponse);
    return errorResponse;
  }

  try {
    const { invoiceData, ingredients } = JSON.parse(event.body);
    
    if (!invoiceData || !ingredients) {
      const errorResponse = {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invoice data and ingredients are required' })
      };
      await logApiCall('generate-reports', event, errorResponse);
      return errorResponse;
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

    const errorResponse = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
    return errorResponse;
  }
};