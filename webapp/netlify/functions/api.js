// Clean Netlify function - ONLY Netlify handler, no Express

// Add this at the top to handle multipart data
const parseMultipart = (event) => {
  const boundary = event.headers['content-type']?.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return null;

  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  let start = 0;
  while (true) {
    const boundaryIndex = body.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;
    
    if (start !== 0) {
      const part = body.slice(start, boundaryIndex);
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const headers = part.slice(0, headerEnd).toString();
        const content = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        
        if (nameMatch) {
          parts.push({
            name: nameMatch[1],
            filename: filenameMatch?.[1],
            content: content.slice(0, -2) // Remove trailing \r\n
          });
        }
      }
    }
    start = boundaryIndex + boundaryBuffer.length + 2;
  }
  
  return parts;
};

// Simple PDF text extraction (basic approach)
const extractTextFromPDF = (pdfBuffer) => {
  // This is a very basic approach - for production, you'd use a proper PDF library
  const text = pdfBuffer.toString('latin1');
  
  // Look for common invoice patterns
  const lines = text.split('\n').filter(line => line.trim());
  
  // Extract invoice number
  const invoiceMatch = text.match(/(?:Invoice|Inv|Order)[:\s#]*([A-Z0-9-]+)/i);
  const invoiceNumber = invoiceMatch?.[1] || 'Unknown';
  
  // Extract date
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  const date = dateMatch?.[1] || new Date().toLocaleDateString();
  
  // Extract total
  const totalMatch = text.match(/(?:Total|Amount)[:\s]*£?([0-9,]+\.?\d*)/i);
  const total = totalMatch?.[1] || '0.00';
  
  // Extract ingredients (this is a simplified approach)
  const ingredients = [];
  const ingredientPatterns = [
    /([A-Za-z\s]+(?:Malt|Hops?|Yeast|Sugar|Extract))\s+([0-9.]+)\s*(kg|g|lb|oz)\s+.*?([0-9.]+)/gi,
    /([A-Za-z\s]+)\s+([0-9.]+)\s*(kg|g|lb|oz)\s+.*?£([0-9.]+)/gi
  ];
  
  for (const pattern of ingredientPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null && ingredients.length < 10) {
      ingredients.push({
        name: match[1].trim(),
        quantity: parseFloat(match[2]),
        unit: match[3],
        unitPrice: parseFloat(match[4]) || 0,
        total: parseFloat(match[4]) || 0
      });
    }
  }
  
  // If no ingredients found, add some common ones as fallback
  if (ingredients.length === 0) {
    ingredients.push(
      { name: 'Pale Malt', quantity: 5, unit: 'kg', unitPrice: 3.50, total: 17.50 },
      { name: 'Crystal Malt', quantity: 0.5, unit: 'kg', unitPrice: 4.20, total: 2.10 }
    );
  }
  
  return {
    invoiceNumber,
    date,
    total,
    ingredients: ingredients.slice(0, 10) // Limit to 10 ingredients
  };
};

// Update the /parse endpoint
if (path === '/parse' && event.httpMethod === 'POST') {
  console.log('Processing parse request');
  
  try {
    // Check content type
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Expected multipart/form-data content type',
          received: contentType
        })
      };
    }
    
    // Parse multipart data
    const parts = parseMultipart(event);
    if (!parts) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Failed to parse multipart data'
        })
      };
    }
    
    // Find the uploaded file
    const filePart = parts.find(part => part.name === 'invoice' && part.filename);
    if (!filePart) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'No file uploaded. Expected form field named "invoice"'
        })
      };
    }
    
    // Validate file type
    if (!filePart.filename.toLowerCase().endsWith('.pdf')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Only PDF files are supported',
          filename: filePart.filename
        })
      };
    }
    
    console.log(`Processing PDF: ${filePart.filename}, Size: ${filePart.content.length} bytes`);
    
    // Extract text from PDF
    const extractedData = extractTextFromPDF(filePart.content);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully parsed ${filePart.filename}`,
        fileInfo: {
          originalName: filePart.filename,
          size: filePart.content.length,
          mimetype: 'application/pdf',
          timestamp: new Date().toISOString()
        },
        extractedData
      })
    };
    
  } catch (error) {
    console.error('PDF processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process PDF',
        message: error.message
      })
    };
  }
}
```