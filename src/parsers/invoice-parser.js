import fs from 'fs';
import PDFParser from 'pdf2json';

export class InvoiceParser {
  constructor() {
    this.maltMillerPatterns = {
      // Common Malt Miller invoice patterns
      itemLine: /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:kg|g|L|ml|each|pkt|sachets?)\s+£(\d+\.\d{2})/gim,
      totalLine: /total[:\s]*£(\d+\.\d{2})/i,
      invoiceNumber: /invoice[:\s#]*(\d+)/i,
      date: /date[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    };
  }

  async parsePDF(pdfPath) {
    try {
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', (errData) => {
          reject(new Error(`PDF parse error: ${errData.parserError}`));
        });
        
        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          try {
            // Extract text from all pages
            let fullText = '';
            
            if (pdfData.Pages) {
              for (const page of pdfData.Pages) {
                if (page.Texts) {
                  for (const textItem of page.Texts) {
                    for (const textRun of textItem.R) {
                      if (textRun.T) {
                        // Decode the text
                        const decodedText = decodeURIComponent(textRun.T);
                        fullText += decodedText + ' ';
                      }
                    }
                  }
                  fullText += '\n';
                }
              }
            }
            
            const invoiceData = this.parseInvoiceText(fullText);
            resolve(invoiceData);
          } catch (error) {
            reject(new Error(`Failed to process PDF data: ${error.message}`));
          }
        });
        
        pdfParser.loadPDF(pdfPath);
      });
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  parseInvoiceText(text) {
    const invoiceData = {
      invoiceNumber: null,
      date: null,
      total: null,
      items: [],
      rawText: text // Include raw text for debugging
    };

    // Extract invoice metadata
    const invoiceMatch = text.match(/Invoice Number:\s*(\d+)/i);
    if (invoiceMatch) {
      invoiceData.invoiceNumber = invoiceMatch[1];
    }

    const dateMatch = text.match(/Invoice Date:\s*([^\\n]+)/i);
    if (dateMatch) {
      invoiceData.date = dateMatch[1].trim();
    }

    // Look for total - try multiple patterns
    const totalMatches = [
      /Total\s+£(\d+\.\d{2})/i,
      /Grand Total[:\s]*£(\d+\.\d{2})/i,
      /Final Total[:\s]*£(\d+\.\d{2})/i
    ];
    
    for (const pattern of totalMatches) {
      const match = text.match(pattern);
      if (match) {
        invoiceData.total = parseFloat(match[1]);
        break;
      }
    }

    // Parse line items - this invoice format seems to have tabular data
    // Look for product lines that start after "Product Quantity Weight Price VAT Line Total"
    const headerMatch = text.indexOf('Product Quantity Weight Price VAT Line Total');
    
    if (headerMatch !== -1) {
      // Extract everything after the header until "Subtotal"
      const subtotalMatch = text.indexOf('Subtotal');
      const itemsSection = subtotalMatch !== -1 ? 
        text.substring(headerMatch, subtotalMatch) : 
        text.substring(headerMatch);
      
      // The items are in a continuous string, we need to parse differently
      // Look for price patterns to identify item boundaries
      const pricePattern = /£\s*\d+\.\d{2}/g;
      const prices = [...itemsSection.matchAll(pricePattern)];
      
      // Each item should have 3 prices: unit price, VAT, line total
      // So we group by 3s to find items
      for (let i = 0; i < prices.length; i += 3) {
        if (i + 2 < prices.length) {
          const lineTotalMatch = prices[i + 2];
          
          // Find the start of this item (after the previous item's last price)
          const startIndex = i === 0 ? 
            itemsSection.indexOf('Large Grain Bag') : // Skip the header for first item
            prices[i - 1].index + prices[i - 1][0].length;
          
          // Extract the item text from start to just before the unit price
          const itemText = itemsSection.substring(startIndex, prices[i].index).trim();
          
          if (itemText && itemText.length > 3) {
            const item = this.parseItemText(itemText, parseFloat(lineTotalMatch[0].replace('£', '').trim()));
            if (item) {
              invoiceData.items.push(item);
            }
          }
        }
      }
    }

    // If the header approach didn't work, try alternative parsing
    if (invoiceData.items.length === 0) {
      invoiceData.items = this.parseItemsAlternative(text);
    }

    return invoiceData;
  }

  parseItemText(itemText, lineTotal) {
    // Parse item text like: "Large Grain Bag/Kettle Liner - BIAB - Brew in a Bag   EQU-11-022   3923299000   CN   2 0.4kg"
    
    if (!itemText || itemText.length < 3) return null;
    
    // Extract quantity and weight from the end
    const quantityMatch = itemText.match(/(\d+)\s+([0-9.]+)(kg|g|L|ml|each|pkt|sachets?)\s*$/i);
    let quantity = 1;
    let unit = 'each';
    
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]);
      const weightValue = parseFloat(quantityMatch[2]);
      unit = quantityMatch[3];
      
      // If we have both quantity and weight, multiply them for total weight
      if (unit === 'kg' || unit === 'g') {
        quantity = quantity * weightValue;
      }
      
      // Remove the quantity/weight part from the item text
      itemText = itemText.replace(quantityMatch[0], '').trim();
    } else {
      // Try to find just a quantity at the end
      const qtyMatch = itemText.match(/(\d+)\s+0\.0kg\s*$/i);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]);
        unit = 'each';
        itemText = itemText.replace(qtyMatch[0], '').trim();
      }
    }
    
    // Remove product codes and country codes from the end
    // Patterns like EQU-11-022, 3923299000, CN, AT, GB
    itemText = itemText.replace(/\s+[A-Z]{2,}-\d+-\d+/g, '');
    itemText = itemText.replace(/\s+\d{7,}/g, '');
    itemText = itemText.replace(/\s+[A-Z]{1,3}(?=\s|$)/g, '');
    
    // Clean up multiple spaces
    const productName = itemText.trim().replace(/\s+/g, ' ');
    
    if (!productName || productName.length < 3) return null;
    
    return {
      name: productName,
      quantity: quantity,
      unit: unit,
      price: lineTotal,
      rawLine: itemText
    };
  }

  parseProductLine(line) {
    // This method handles the specific Malt Miller invoice format
    // Example line: "Large Grain Bag/Kettle Liner - BIAB - Brew in a Bag   EQU-11-022   3923299000   CN   2 0.4kg £ 24.00 £ 4.00 £ 24.00"
    
    if (!line || line.length < 10) return null;
    
    // Look for price patterns (£ followed by digits)
    const priceMatches = line.match(/£\s*(\d+\.\d{2})/g);
    if (!priceMatches || priceMatches.length < 1) return null;
    
    // Extract the last price as the line total
    const lineTotalMatch = priceMatches[priceMatches.length - 1].match(/£\s*(\d+\.\d{2})/);
    if (!lineTotalMatch) return null;
    
    const lineTotal = parseFloat(lineTotalMatch[1]);
    
    // Try to extract quantity and weight
    const quantityMatch = line.match(/\s(\d+)\s+([0-9.]+(?:kg|g|L|ml|each|pkt|sachets?))/i);
    let quantity = 1;
    let unit = 'each';
    
    if (quantityMatch) {
      quantity = parseInt(quantityMatch[1]);
      const weightMatch = quantityMatch[2].match(/([0-9.]+)(kg|g|L|ml|each|pkt|sachets?)/i);
      if (weightMatch) {
        const weightValue = parseFloat(weightMatch[1]);
        unit = weightMatch[2];
        // If we have a quantity and weight, multiply them
        if (unit === 'kg' || unit === 'g') {
          quantity = quantity * weightValue;
        }
      }
    } else {
      // Try to find standalone quantities
      const qtyMatch = line.match(/\s(\d+)\s/);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]);
      }
      
      // Try to find weight/volume info in the product name
      const weightInNameMatch = line.match(/([0-9.]+)\s*(kg|g|L|ml|pkt|sachets?)/i);
      if (weightInNameMatch) {
        const weightValue = parseFloat(weightInNameMatch[1]);
        unit = weightInNameMatch[2];
        if (quantity > 1 && (unit === 'kg' || unit === 'g')) {
          quantity = quantity * weightValue;
        } else if (quantity === 1) {
          quantity = weightValue;
        }
      }
    }
    
    // Extract product name - everything before the first code/number sequence
    let productName = line;
    
    // Remove prices from the end
    for (const priceMatch of priceMatches) {
      productName = productName.replace(priceMatch, '');
    }
    
    // Remove product codes (patterns like EQU-11-022, 3923299000)
    productName = productName.replace(/\s+[A-Z]{2,}-\d+-\d+\s+/g, ' ');
    productName = productName.replace(/\s+\d{7,}\s+/g, ' ');
    productName = productName.replace(/\s+[A-Z]{1,3}\s+/g, ' '); // Remove country codes like CN
    
    // Remove quantity and weight info that we've already extracted
    if (quantityMatch) {
      productName = productName.replace(quantityMatch[0], ' ');
    }
    
    // Clean up the product name
    productName = productName.trim().replace(/\s+/g, ' ');
    
    if (!productName || productName.length < 3) return null;
    
    return {
      name: productName,
      quantity: quantity,
      unit: unit,
      price: lineTotal,
      rawLine: line
    };
  }

  parseItemLine(line) {
    // Try multiple patterns for different invoice formats
    const patterns = [
      // Pattern 1: Name Quantity Unit Price
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(kg|g|L|ml|each|pkt|sachets?)\s+£(\d+\.\d{2})$/i,
      // Pattern 2: Name Price (quantity embedded in name)
      /^(.+?)\s+£(\d+\.\d{2})$/i,
      // Pattern 3: More flexible pattern
      /^(.+?)\s+(\d+(?:\.\d+)?)\s*(?:x\s*)?(\w+)?\s*£(\d+\.\d{2})$/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const item = {
          name: match[1].trim(),
          rawLine: line
        };

        if (match.length >= 4) {
          item.quantity = parseFloat(match[2]);
          item.unit = match[3] || 'each';
          item.price = parseFloat(match[4] || match[2]);
        } else {
          item.price = parseFloat(match[2]);
          // Try to extract quantity from name
          const qtyMatch = item.name.match(/(\d+(?:\.\d+)?)\s*(kg|g|L|ml|pkt|sachets?)/i);
          if (qtyMatch) {
            item.quantity = parseFloat(qtyMatch[1]);
            item.unit = qtyMatch[2];
            item.name = item.name.replace(qtyMatch[0], '').trim();
          } else {
            item.quantity = 1;
            item.unit = 'each';
          }
        }

        return item;
      }
    }

    return null;
  }

  parseItemsAlternative(text) {
    const items = [];
    const lines = text.split('\n');
    
    let currentItem = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and common headers/footers
      if (!line || this.isHeaderFooterLine(line)) continue;
      
      // Look for price patterns
      const priceMatch = line.match(/£(\d+\.\d{2})/);
      
      if (priceMatch && currentItem) {
        // This line might be the price for the previous item
        currentItem.price = parseFloat(priceMatch[1]);
        items.push(currentItem);
        currentItem = null;
      } else if (this.looksLikeIngredient(line)) {
        // Start a new item
        if (currentItem) {
          items.push(currentItem);
        }
        
        currentItem = {
          name: line,
          rawLine: line,
          quantity: 1,
          unit: 'each',
          price: 0
        };
        
        // Try to extract quantity from the name
        const qtyMatch = line.match(/(\d+(?:\.\d+)?)\s*(kg|g|L|ml|pkt|sachets?)/i);
        if (qtyMatch) {
          currentItem.quantity = parseFloat(qtyMatch[1]);
          currentItem.unit = qtyMatch[2];
          currentItem.name = line.replace(qtyMatch[0], '').trim();
        }
        
        // Check if price is on the same line
        if (priceMatch) {
          currentItem.price = parseFloat(priceMatch[1]);
          items.push(currentItem);
          currentItem = null;
        }
      }
    }
    
    // Add any remaining item
    if (currentItem) {
      items.push(currentItem);
    }
    
    return items;
  }

  isHeaderFooterLine(line) {
    const skipPatterns = [
      /^(invoice|date|total|subtotal|vat|delivery|payment)/i,
      /^(the malt miller|address|tel|email)/i,
      /^(page \d+|\d+\/\d+)$/i,
      /^£?\d+\.\d{2}$/,
      /^\d+$/,
      /^thank you/i
    ];
    
    return skipPatterns.some(pattern => pattern.test(line));
  }

  looksLikeIngredient(line) {
    const ingredientKeywords = [
      // Malts
      'malt', 'grain', 'wheat', 'barley', 'oats', 'rye', 'corn', 'rice',
      'pale', 'pilsner', 'munich', 'vienna', 'crystal', 'caramel',
      'chocolate', 'black', 'roasted', 'smoked', 'amber',
      
      // Hops
      'hop', 'hops', 'pellet', 'pellets', 'leaf',
      'cascade', 'centennial', 'chinook', 'citra', 'columbus',
      'fuggle', 'golding', 'hallertau', 'saaz', 'tettnang',
      
      // Yeast
      'yeast', 'saccharomyces', 'brettanomyces', 'lactobacillus',
      'wyeast', 'white labs', 'fermentis', 'lallemand',
      'nutrient', 'energizer',
      
      // Water minerals and misc
      'gypsum', 'calcium', 'magnesium', 'sodium', 'chloride', 'sulfate',
      'acid', 'phosphoric', 'lactic', 'citric',
      'irish moss', 'whirlfloc', 'protofloc', 'clarity',
      'campden', 'potassium', 'metabisulfite'
    ];
    
    const lowerLine = line.toLowerCase();
    return ingredientKeywords.some(keyword => lowerLine.includes(keyword)) ||
           /\d+(?:\.\d+)?\s*(kg|g|L|ml|pkt|sachets?)/i.test(line);
  }
}
