const busboy = require('@fastify/busboy');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { InvoiceParser } = require('../../src/parsers/invoice-parser.js');

import { IngredientMapper } from '../../src/mappers/ingredient-mapper.js';
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'] || event.headers['Content-Type'];
  if (!contentType || !contentType.startsWith('multipart/form-data')) {
    return { statusCode: 400, body: 'Content-Type must be multipart/form-data' };
  }

  return new Promise((resolve, reject) => {
    const bb = new busboy.Busboy({ headers: { 'content-type': contentType } });
    let filePath = '';
    let fileWriteStream;

    bb.on('file', (fieldname, file, filename) => {
      filePath = path.join(os.tmpdir(), filename);
      fileWriteStream = fs.createWriteStream(filePath);
      file.pipe(fileWriteStream);
    });

    bb.on('finish', async () => {
      try {
        const parser = new InvoiceParser();
        const invoiceData = await parser.parsePDF(filePath);
        /////
if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      return res.status(400).json({ error: 'No items found in invoice' });
    }

    // Map ingredients
    const mappedIngredients = await mapper.mapIngredients(invoiceData.items);
    
    // Generate report
    const reportData = {
      invoice: invoiceData,
      ingredients: mappedIngredients,
      summary: generateSummary(mappedIngredients),
      timestamp: new Date().toISOString()
    };

    // Clean up uploaded file
    fs.unlinkSync(filePath);

     resolve({
          statusCode: 200,
          body: JSON.stringify(reportData),
          headers: { 'Content-Type': 'application/json' }
        });
        //////
        // fs.unlinkSync(filePath); // Clean up temp file
        // resolve({
        //   statusCode: 200,
        //   body: JSON.stringify(invoiceData),
        //   headers: { 'Content-Type': 'application/json' }
        // });
      } catch (err) {
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: err.message }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    bb.end(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
  });
};