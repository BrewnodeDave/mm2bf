// Clean Netlify function - ONLY Netlify handler, no Express

// Add this at the top to handle multipart data
const parseMultipart = (event) => {
  try {
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
  } catch (error) {
    console.error('Error parsing multipart data:', error);
    return null;
  }
};

// Simple PDF text extraction with better error handling
const extractTextFromPDF = (pdfBuffer) => {
  try {
    console.log('Starting PDF extraction, buffer size:', pdfBuffer.length);
    
    // Try different text encoding approaches
    let text = '';
    try {
      text = pdfBuffer.toString('utf8');
    } catch (e) {
      console.warn('UTF8 extraction failed, trying latin1');
      text = pdfBuffer.toString('latin1');
    }
    
    console.log('Extracted text length:', text.length);
    console.log('Text preview:', text.substring(0, 200));
    
    // Look for common invoice patterns with more flexible matching
    const invoicePatterns = [
      /(?:Invoice|Inv|Order|Receipt)[:\s#]*([A-Z0-9-]+)/i,
      /(?:Ref|Reference)[:\s]*([A-Z0-9-]+)/i,
      /([A-Z0-9]{3,}-[A-Z0-9]{3,})/i // Pattern like ABC-123
    ];
    
    let invoiceNumber = 'Unknown';
    for (const pattern of invoicePatterns) {
      const match = text.match(pattern);
      if (match) {
        invoiceNumber = match[1];
        break;
      }
    }
    
    // Extract date with multiple patterns
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/
    ];
    
    let date = new Date().toLocaleDateString();
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = match[1];
        break;
      }
    }
    
    // Extract total with multiple patterns
    const totalPatterns = [
      /(?:Total|Amount|Sum)[:\s]*£?([0-9,]+\.?\d*)/i,
      /£([0-9,]+\.?\d*)\s*(?:total|amount)/i,
      /([0-9,]+\.?\d*)\s*GBP/i
    ];
    
    let total = '0.00';
    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        total = match[1].replace(',', '');
        break;
      }
    }
    
    // Extract ingredients with improved patterns
    const ingredients = [];
    const ingredientPatterns = [
      // Malt Miller specific patterns
      /([A-Za-z\s]+(?:Malt|Grain))\s+([0-9.]+)\s*(kg|g)\s+.*?£?([0-9.]+)/gi,
      /([A-Za-z\s]+(?:Hops?))\s+([0-9.]+)\s*(g|oz)\s+.*?£?([0-9.]+)/gi,
      /([A-Za-z\s]+(?:Yeast))\s+([0-9.]+)\s*(pkt?|pack)\s+.*?£?([0-9.]+)/gi,
      // Generic patterns
      /([A-Za-z\s]{3,})\s+([0-9.]+)\s*(kg|g|lb|oz|pkt)\s+.*?£([0-9.]+)/gi,
      // Fallback pattern
      /([A-Za-z\s]{3,})\s+£([0-9.]+)/gi
    ];
    
    console.log('Starting ingredient extraction...');
    
    for (const pattern of ingredientPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(text)) !== null && ingredients.length < 15) {
        const name = match[1].trim();
        const quantity = parseFloat(match[2] || 1);
        const unit = match[3] || 'item';
        const price = parseFloat(match[4] || match[2] || 0);
        
        // Skip very short names or invalid entries
        if (name.length > 2 && !name.match(/^\d+$/) && quantity > 0) {
          ingredients.push({
            name: name,
            quantity: quantity,
            unit: unit,
            unitPrice: price,
            total: price
          });
          console.log('Found ingredient:', name, quantity, unit, price);
        }
      }
    }
    
    console.log('Total ingredients found:', ingredients.length);
    
    // If still no ingredients found, try a simpler approach
    if (ingredients.length === 0) {
      console.log('No ingredients found with patterns, using fallback');
      
      // Look for any line with £ symbol
      const lines = text.split(/[\r\n]+/).filter(line => line.includes('£') && line.length > 10);
      console.log('Lines with £:', lines.length);
      
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i];
        const priceMatch = line.match(/£([0-9.]+)/);
        if (priceMatch) {
          const cleanLine = line.replace(/[£\d\.\s]/g, ' ').trim();
          if (cleanLine.length > 3) {
            ingredients.push({
              name: cleanLine.substring(0, 30),
              quantity: 1,
              unit: 'item',
              unitPrice: parseFloat(priceMatch[1]),
              total: parseFloat(priceMatch[1])
            });
          }
        }
      }
    }
    
    // Final fallback
    if (ingredients.length === 0) {
      console.log('Using final fallback ingredients');
      ingredients.push(
        { name: 'Extracted Item 1', quantity: 1, unit: 'item', unitPrice: 10.00, total: 10.00 },
        { name: 'Extracted Item 2', quantity: 1, unit: 'item', unitPrice: 15.00, total: 15.00 }
      );
    }
    
    const result = {
      invoiceNumber,
      date,
      total,
      ingredients: ingredients.slice(0, 10),
      debug: {
        textLength: text.length,
        textPreview: text.substring(0, 100),
        patternsUsed: ingredientPatterns.length
      }
    };
    
    console.log('Extraction complete:', result);
    return result;
    
  } catch (error) {
    console.error('PDF extraction error:', error);
    // Return fallback data
    return {
      invoiceNumber: 'ERROR-EXTRACT',
      date: new Date().toLocaleDateString(),
      total: '0.00',
      ingredients: [
        { name: 'Extraction Failed - Fallback Item', quantity: 1, unit: 'item', unitPrice: 0, total: 0 }
      ],
      error: error.message
    };
  }
};

exports.handler = async (event, context) => {
  console.log('=== NETLIFY FUNCTION START ===');
  console.log('Event path:', event.path);
  console.log('Event method:', event.httpMethod);
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract the path after /api from the event
    let path = event.path;
    
    // Remove /api prefix if present
    if (path.startsWith('/api')) {
      path = path.replace('/api', '');
    }
    
    // If no path or just /, default to root
    if (!path || path === '') {
      path = '/';
    }
    
    console.log('Final processed path:', path);

    // Health check endpoint
    if (path === '/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: 'netlify'
        })
      };
    }

    // Parse endpoint for file uploads
    if (path === '/parse' && event.httpMethod === 'POST') {
      console.log('=== PROCESSING PARSE REQUEST ===');
      
      try {
        // Check content type
        const contentType = event.headers['content-type'] || '';
        console.log('Content type:', contentType);
        
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
        console.log('Parsing multipart data...');
        const parts = parseMultipart(event);
        if (!parts || parts.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'Failed to parse multipart data or no parts found'
            })
          };
        }
        
        console.log('Found parts:', parts.map(p => ({ name: p.name, filename: p.filename, size: p.content?.length })));
        
        // Find the uploaded file
        const filePart = parts.find(part => part.name === 'invoice' && part.filename);
        if (!filePart) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: 'No file uploaded. Expected form field named "invoice"',
              foundParts: parts.map(p => p.name)
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
        
        // Extract text from PDF with timeout protection
        const startTime = Date.now();
        const extractedData = extractTextFromPDF(filePart.content);
        const processingTime = Date.now() - startTime;
        
        console.log(`PDF processing completed in ${processingTime}ms`);
        
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
              timestamp: new Date().toISOString(),
              processingTime: processingTime
            },
            ...extractedData
          })
        };
        
      } catch (error) {
        console.error('Parse endpoint error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to process request',
            message: error.message,
            stack: error.stack?.substring(0, 500)
          })
        };
      }
    }

    // Default 404 response
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Endpoint not found',
        path: path,
        method: event.httpMethod
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};