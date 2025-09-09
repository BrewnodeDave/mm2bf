const busboy = require('@fastify/busboy');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { InvoiceParser } = require('../../src/parsers/invoice-parser.js');

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
        fs.unlinkSync(filePath); // Clean up temp file
        resolve({
          statusCode: 200,
          body: JSON.stringify(invoiceData),
          headers: { 'Content-Type': 'application/json' }
        });
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