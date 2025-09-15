const { logApiCall } = require( './utils/logger.cjs');
const busboy = require('@fastify/busboy');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { InvoiceParser } = require('../../src/parsers/invoice-parser.js');
const { IngredientMapper } = require('../../src/mappers/ingredient-mapper.js');

const mapper = new IngredientMapper();

function  generateSummary(ingredients) {
  const summary = {
    totalItems: ingredients.length,
    totalCost: 0,
    byType: {}
  };

  ingredients.forEach(ingredient => {
    const type = ingredient.type;
    if (!summary.byType[type]) {
      summary.byType[type] = {
        count: 0,
        totalCost: 0
      };
    }
    
    summary.byType[type].count++;
    if (ingredient.cost) {
      summary.byType[type].totalCost += (ingredient.cost * ingredient.amount);
      summary.totalCost += (ingredient.cost * ingredient.amount);
    }
  });

  return summary;
}

export const handler = async (event) => {
  let result;

  if (event.httpMethod !== 'POST') {
    const errorResponse = { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Content-Type': 'application/json' }
    };
    logApiCall('parse', event, errorResponse);
    return errorResponse;
  } 

  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    const errorResponse = {
      statusCode: 400,
      body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
      headers: { 'Content-Type': 'application/json' }
    };
    logApiCall('parse', event, errorResponse);
    return errorResponse;
  }

  return new Promise((resolve, reject) => {
    const bb = new busboy.Busboy({ headers: { 'content-type': contentType } });
    let filePath = '';
    let fileWriteStream;

    bb.on('file', (fieldname, file, filename) => {
      if (!filename) {
        const errorResponse = {
          statusCode: 400,
          body: JSON.stringify({ error: 'No file provided' }),
          headers: { 'Content-Type': 'application/json' }
        }
        logApiCall('on file', event, errorResponse);
        return resolve(errorResponse);
      }

      filePath = path.join(os.tmpdir(), `invoice-${Date.now()}-${filename}`);
      fileWriteStream = fs.createWriteStream(filePath);

      file.on('error', (error) => {
        console.error('File upload error:', error);
        const errorResponse = {
          statusCode: 500,
          body: JSON.stringify({ error: 'File upload failed' }),
          headers: { 'Content-Type': 'application/json' }
        };
        logApiCall('on error', event, errorResponse);
        resolve(errorResponse);
      });

      file.pipe(fileWriteStream);
    });

    bb.on('finish', async () => {
      try {
        // Verify file exists and has content
        if (!fs.existsSync(filePath)) {
          const errorResponse = {
            statusCode: 400,
            body: JSON.stringify({ error: 'No file was uploaded' }),
            headers: { 'Content-Type': 'application/json' }
          };
          logApiCall('pdf-on-finish', event, errorResponse);
          throw new Error(errorResponse.body);
        }

        const fileStats = fs.statSync(filePath);
        if (fileStats.size === 0) {
          const errorResponse = {
            statusCode: 400,
            body: JSON.stringify({ error: 'Uploaded file is empty' }),
            headers: { 'Content-Type': 'application/json' }
          };
          logApiCall('pdf-on-finish', event, errorResponse);
          throw new Error(errorResponse.body);

        }

        console.log('Processing PDF:', filePath);
        const parser = new InvoiceParser();
        const invoiceData = await parser.parsePDF(filePath);

        // Detailed validation of parsed data
        if (!invoiceData) {
          const errorResponse = {
            statusCode: 400,
            body: JSON.stringify({ error: 'PDF parsing failed - no data returned' }),
            headers: { 'Content-Type': 'application/json' }
          };
          logApiCall('pdf-on-finish', event, errorResponse);
          throw new Error(errorResponse.body);
        }

        if (!Array.isArray(invoiceData.items)) {
          const errorResponse = {
            statusCode: 400,
            body: JSON.stringify({ error: 'PDF parsing failed - invalid items structure' }),
            headers: { 'Content-Type': 'application/json' }
          };
          logApiCall('pdf-on-finish', event, errorResponse);
          throw new Error(errorResponse.body);
        }

        if (invoiceData.items.length === 0) {
          const errorResponse = {
            statusCode: 400,
            body: JSON.stringify({ error: 'No items found in invoice' }),
            headers: { 'Content-Type': 'application/json' }
          };
          logApiCall('pdf-on-finish', event, errorResponse);
          throw new Error(errorResponse.body);
        }

        console.log(`Successfully parsed ${invoiceData.items.length} items`);

        // Map ingredients
        const mappedIngredients = await mapper.mapIngredients(invoiceData.items);
        console.log(`Mapped ${mappedIngredients.length} ingredients`);
        
        // Generate report
        const reportData = {
          invoice: invoiceData,
          ingredients: mappedIngredients,
          summary: generateSummary(mappedIngredients),
          timestamp: new Date().toISOString()
        };

        // Clean up uploaded file
        fs.unlink(filePath, (err) => {
          if (err) console.error('Error deleting file:', err);
        });

        const result = {
          statusCode: 200,
          body: JSON.stringify(reportData),
          headers: { 'Content-Type': 'application/json' }
        };
        logApiCall('pdf-on-finish', event, result);

        resolve(result);

      } catch (err) {
        console.error('Parse error:', err);
        // Clean up file if it exists
        if (filePath && fs.existsSync(filePath)) {
          fs.unlink(filePath, () => {});
        }

        const errorResponse = {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Failed to process PDF data',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
          }),
          headers: { 'Content-Type': 'application/json' }
        };
        logApiCall('pdf-on-finish', event, errorResponse);
        resolve(errorResponse);
      }
    });

    try {
      const buffer = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(event.body);
      bb.end(buffer);
    } catch (error) {
      console.error('Request body processing error:', error);
      const errorResponse = {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to process request body' }),
        headers: { 'Content-Type': 'application/json' }
      };
      logApiCall('pdf-on-finish', event, errorResponse);
      resolve(errorResponse);
    }
  });
};