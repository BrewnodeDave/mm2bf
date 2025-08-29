// Update the sync-brewfather endpoint

app.post('/api/sync-brewfather', async (req, res) => {
    try {
        const { credentials, ingredients, includePartialMatches = false } = req.body;
        
        if (!credentials?.userId || !credentials?.apiKey) {
            return res.status(400).json({ error: 'Missing Brewfather credentials' });
        }
        
        if (!ingredients || !Array.isArray(ingredients)) {
            return res.status(400).json({ error: 'Invalid ingredients data' });
        }
        
        console.log(`🔄 Starting Brewfather sync for ${ingredients.length} items...`);
        console.log(`📝 Include partial matches: ${includePartialMatches}`);
        
        // Filter ingredients based on match status
        const itemsToSync = ingredients.filter(ingredient => {
            if (ingredient.matchStatus === 'exact') return true;
            if (ingredient.matchStatus === 'partial' && includePartialMatches) return true;
            return false;
        });
        
        console.log(`✅ ${itemsToSync.length} items will be synced (${ingredients.length - itemsToSync.length} filtered out)`);
        
        // Initialize Brewfather API
        const brewfatherAPI = new BrewfatherAPI(credentials.userId, credentials.apiKey);
        
        // Test connection first
        const connectionTest = await brewfatherAPI.testConnection();
        if (!connectionTest.success) {
            return res.status(400).json({ error: connectionTest.message });
        }
        
        // Group ingredients by type
        const ingredientsByType = {
            fermentable: itemsToSync.filter(ing => ing.type === 'fermentable'),
            hop: itemsToSync.filter(ing => ing.type === 'hop'),
            yeast: itemsToSync.filter(ing => ing.type === 'yeast'),
            misc: itemsToSync.filter(ing => ing.type === 'misc')
        };
        
        const results = {};
        let totalSuccess = 0;
        let totalNotFound = 0;
        let totalErrors = 0;
        
        // Process each ingredient type
        for (const [type, items] of Object.entries(ingredientsByType)) {
            if (items.length === 0) {
                results[type] = [];
                continue;
            }
            
            console.log(`\n🔄 Processing ${items.length} ${type}(s)...`);
            
            try {
                // Map to the format expected by the API
                const mappedItems = items.map(ingredient => ({
                    name: ingredient.name,
                    type: ingredient.type,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    cost: ingredient.cost,
                    brewfatherMatch: ingredient.brewfatherMatch,
                    matchStatus: ingredient.matchStatus
                }));
                
                const typeResults = await brewfatherAPI[`update${type.charAt(0).toUpperCase() + type.slice(1)}s`](mappedItems);
                results[type] = typeResults;
                
                // Count results
                if (Array.isArray(typeResults)) {
                    typeResults.forEach(result => {
                        if (result.success) {
                            totalSuccess++;
                        } else if (result.action === 'not_found') {
                            totalNotFound++;
                        } else {
                            totalErrors++;
                        }
                    });
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${type}s:`, error);
                results[type] = items.map(item => ({
                    name: item.name,
                    success: false,
                    action: 'error',
                    error: error.message
                }));
                totalErrors += items.length;
            }
        }
        
        console.log(`\n📊 Sync Summary:`);
        console.log(`  ✅ Success: ${totalSuccess}`);
        console.log(`  ⚠️  Not Found: ${totalNotFound}`);
        console.log(`  ❌ Errors: ${totalErrors}`);
        
        res.json({
            success: true,
            results,
            summary: {
                totalProcessed: itemsToSync.length,
                success: totalSuccess,
                notFound: totalNotFound,
                errors: totalErrors
            },
            includePartialMatches
        });
        
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ 
            error: 'Internal server error during sync',
            details: error.message 
        });
    }
});

// In server.js, update the parseInvoice function to extract the actual total

function parseInvoice(text) {
    console.log('📄 Starting invoice parsing...');
    console.log('📝 First 500 characters of PDF text:', text.substring(0, 500));
    
    const lines = text.split('\n');
    const items = [];
    let invoiceTotal = null;
    let invoiceNumber = null;
    let vatAmount = null;
    let subtotal = null;
    let shipping = null;
    
    // Extract invoice number - fix the syntax error
    const invoiceNumberMatch = text.match(/Invoice\s+(?:Number\s*[:\-]?\s*)?(\d+)/i) ||
                              text.match(/INV[\-\s]*(\d+)/i) ||
                              text.match(/Order\s+(?:Number\s*[:\-]?\s*)?(\d+)/i); // Fixed this line
    if (invoiceNumberMatch) {
        invoiceNumber = invoiceNumberMatch[1];
        console.log(`📄 Found invoice number: ${invoiceNumber}`);
    }
    
    // Parse individual lines for items first
    console.log('🔍 Parsing individual items...');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) continue;
        
        // Log each line to see what we're parsing
        if (trimmedLine.includes('£') || /\d+\.\d+/.test(trimmedLine)) {
            console.log(`🔍 Checking line: "${trimmedLine}"`);
        }
        
        // TMM-specific pattern (name, quantity, unit, price)
        const tmmMatch = trimmedLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([kKgGmMlL]+)\s+£(\d+(?:\.\d+)?)$/);
        if (tmmMatch) {
            const [, name, quantity, unit, price] = tmmMatch;
            
            if (isBrewingIngredient(name)) {
                const item = {
                    name: name.trim(),
                    type: determineIngredientType(name),
                    amount: parseFloat(quantity),
                    unit: unit.trim(),
                    cost: parseFloat(price)
                };
                items.push(item);
                console.log(`✅ Parsed item: ${name} - ${quantity}${unit} - £${price}`);
            }
            continue;
        }
        
        // More flexible patterns for different invoice formats
        const patterns = [
            // Standard format: Name Quantity Unit Price
            /^(.+?)\s+(\d+(?:\.\d+)?)\s*([kKgGmMlL]+|ea|each|bag|bags|pack|packs|pk)\s+£(\d+(?:\.\d+)?)$/i,
            // With dash separator: Name - Quantity Unit Price
            /^(.+?)\s*[-:]\s*(\d+(?:\.\d+)?)\s*([kKgGmMlL]+|ea|each|bag|bags|pack|packs|pk)\s+£(\d+(?:\.\d+)?)$/i,
            // Without £ symbol: Name Quantity Unit Price
            /^(.+?)\s+(\d+(?:\.\d+)?)\s*([kKgGmMlL]+|ea|each|bag|bags|pack|packs|pk)\s+(\d+(?:\.\d+)?)$/i,
            // Tab separated
            /^(.+?)\t+(\d+(?:\.\d+)?)\s*([kKgGmMlL]+|ea|each|bag|bags|pack|packs|pk)\t+£?(\d+(?:\.\d+)?)$/i,
            // Price at end with various separators
            /^(.+?)\s+(\d+(?:\.\d+)?)\s*([kKgGmMlL]+|ea|each|bag|bags|pack|packs|pk).*?£?(\d+(?:\.\d+)?)$/i
        ];
        
        for (const pattern of patterns) {
            const match = trimmedLine.match(pattern);
            if (match) {
                const [, name, quantity, unit, price] = match;
                const cleanName = name.trim();
                const parsedQuantity = parseFloat(quantity);
                const parsedPrice = parseFloat(price);
                
                // Additional validation
                if (isBrewingIngredient(cleanName) && !isNaN(parsedQuantity) && !isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice < 1000) {
                    const item = {
                        name: cleanName,
                        type: determineIngredientType(cleanName),
                        amount: parsedQuantity,
                        unit: unit.trim().toLowerCase(),
                        cost: parsedPrice
                    };
                    items.push(item);
                    console.log(`✅ Parsed item: ${cleanName} - ${parsedQuantity}${unit} - £${parsedPrice}`);
                }
                break;
            }
        }
    }
    
    // Enhanced total detection - check each line more carefully
    console.log('💰 Looking for invoice totals...');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        
        // Skip lines that are clearly not totals
        if (line.length === 0 || line.length > 100) continue;
        
        console.log(`🔍 Checking line for totals: "${line}"`);
        
        // Comprehensive total patterns - ordered by priority
        const totalChecks = [
            // Highest priority - explicit total lines
            {
                regex: /(?:Total\s+(?:Inc(?:luding)?\.?\s*VAT|Inc\.?\s*Tax))\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 1,
                name: "Total Inc VAT"
            },
            {
                regex: /(?:Amount\s+Due)\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 1,
                name: "Amount Due"
            },
            {
                regex: /(?:Total\s+Due)\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 1,
                name: "Total Due"
            },
            {
                regex: /(?:Final\s+Total)\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 1,
                name: "Final Total"
            },
            // Medium priority
            {
                regex: /(?:Grand\s+Total)\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 2,
                name: "Grand Total"
            },
            {
                regex: /(?:Invoice\s+Total)\s*[£]?\s*(\d+[.,]\d{2})/i,
                priority: 2,
                name: "Invoice Total"
            },
            // Generic total - lowest priority
            {
                regex: /^Total\s*[£]?\s*(\d+[.,]\d{2})$/i,
                priority: 3,
                name: "Total"
            },
            // Check for split lines (label on one line, amount on next)
            {
                regex: /^(?:Total\s+(?:Inc(?:luding)?\.?\s*VAT|Inc\.?\s*Tax))$/i,
                checkNextLine: true,
                priority: 1,
                name: "Total Inc VAT (split)"
            },
            {
                regex: /^(?:Amount\s+Due)$/i,
                checkNextLine: true,
                priority: 1,
                name: "Amount Due (split)"
            }
        ];
        
        for (const check of totalChecks) {
            if (check.checkNextLine && check.regex.test(line)) {
                // Look for amount on next line
                const amountMatch = nextLine.match(/[£]?\s*(\d+[.,]\d{2})/);
                if (amountMatch) {
                    const total = parseFloat(amountMatch[1].replace(',', '.'));
                    if (!isNaN(total) && total > 0 && total < 10000) { // Reasonable bounds
                        if (!invoiceTotal || check.priority <= 2) {
                            invoiceTotal = total;
                            console.log(`💰 Found ${check.name}: £${total} from lines "${line}" + "${nextLine}"`);
                        }
                    }
                }
            } else {
                const match = line.match(check.regex);
                if (match) {
                    const total = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(total) && total > 0 && total < 10000) { // Reasonable bounds
                        if (!invoiceTotal || check.priority <= 2) {
                            invoiceTotal = total;
                            console.log(`💰 Found ${check.name}: £${total} from line: "${line}"`);
                        }
                    }
                }
            }
        }
        
        // Look for VAT amount
        if (!vatAmount) {
            const vatPatterns = [
                /VAT\s*(?:@\s*\d+%)?\s*[£]?\s*(\d+[.,]\d{2})/i,
                /Tax\s*[£]?\s*(\d+[.,]\d{2})/i,
                /V\.A\.T\.\s*[£]?\s*(\d+[.,]\d{2})/i
            ];
            
            for (const pattern of vatPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const vat = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(vat) && vat >= 0) {
                        vatAmount = vat;
                        console.log(`📊 Found VAT: £${vat} from line: "${line}"`);
                        break;
                    }
                }
            }
        }
        
        // Look for subtotal
        if (!subtotal) {
            const subtotalPatterns = [
                /(?:Sub\s*Total|Net\s*Total|Goods\s*Total)\s*[£]?\s*(\d+[.,]\d{2})/i,
                /Subtotal\s*[£]?\s*(\d+[.,]\d{2})/i
            ];
            
            for (const pattern of subtotalPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const sub = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(sub) && sub > 0) {
                        subtotal = sub;
                        console.log(`📊 Found subtotal: £${sub} from line: "${line}"`);
                        break;
                    }
                }
            }
        }
        
        // Look for shipping/delivery
        if (!shipping) {
            const shippingPatterns = [
                /(?:Shipping|Delivery|Postage|Carriage|P&P)\s*[£]?\s*(\d+[.,]\d{2})/i,
                /Freight\s*[£]?\s*(\d+[.,]\d{2})/i
            ];
            
            for (const pattern of shippingPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const ship = parseFloat(match[1].replace(',', '.'));
                    if (!isNaN(ship) && ship >= 0) {
                        shipping = ship;
                        console.log(`📊 Found shipping: £${ship} from line: "${line}"`);
                        break;
                    }
                }
            }
        }
    }
    
    // If we still don't have a total, try a different approach
    if (!invoiceTotal) {
        console.log('🔍 No total found, trying more aggressive patterns...');
        
        // Look for any line that ends with a reasonable total amount
        const allAmounts = [];
        for (const line of lines) {
            const amounts = line.match(/£(\d+[.,]\d{2})/g);
            if (amounts) {
                amounts.forEach(amountStr => {
                    const amount = parseFloat(amountStr.replace('£', '').replace(',', '.'));
                    if (!isNaN(amount) && amount > 10 && amount < 10000) {
                        allAmounts.push({ amount, line: line.trim() });
                    }
                });
            }
        }
        
        // Sort by amount descending and take the largest reasonable one
        allAmounts.sort((a, b) => b.amount - a.amount);
        
        if (allAmounts.length > 0) {
            // Check if the largest amount is likely a total
            const largest = allAmounts[0];
            const calculatedItemsTotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);
            
            // If the largest amount is close to or greater than our items total, it's likely the invoice total
            if (largest.amount >= calculatedItemsTotal * 0.8) {
                invoiceTotal = largest.amount;
                console.log(`💰 Using largest reasonable amount as total: £${invoiceTotal} from: "${largest.line}"`);
            }
        }
    }
    
    // Calculate items total for comparison
    const calculatedItemsTotal = items.reduce((sum, item) => sum + (item.cost || 0), 0);
    
    console.log(`📊 Invoice parsing summary:`);
    console.log(`  Items found: ${items.length}`);
    console.log(`  Items total: £${calculatedItemsTotal.toFixed(2)}`);
    console.log(`  Invoice total from PDF: £${invoiceTotal ? invoiceTotal.toFixed(2) : 'Not found'}`);
    console.log(`  VAT: £${vatAmount ? vatAmount.toFixed(2) : 'Not found'}`);
    console.log(`  Shipping: £${shipping ? shipping.toFixed(2) : 'Not found'}`);
    
    // Build the summary with proper fallback
    const summary = calculateEnhancedSummary(items, {
        total: invoiceTotal,
        vat: vatAmount,
        subtotal: subtotal,
        shipping: shipping,
        calculatedItemsTotal
    });
    
    return {
        invoice: {
            invoiceNumber,
            totalFromPDF: invoiceTotal,
            vatAmount,
            subtotal,
            shipping,
            items
        },
        summary
    };
}

function calculateEnhancedSummary(items, totals) {
    const byType = {};
    let calculatedTotal = 0;
    
    items.forEach(item => {
        if (!byType[item.type]) {
            byType[item.type] = { count: 0, totalCost: 0 };
        }
        byType[item.type].count++;
        byType[item.type].totalCost += item.cost || 0;
        calculatedTotal += item.cost || 0;
    });
    
    // Use the actual total from PDF if available, otherwise use calculated
    const finalTotal = totals.total || calculatedTotal;
    
    // Calculate other amounts (discounts, fees, etc.)
    const knownAmounts = calculatedTotal + (totals.vat || 0) + (totals.shipping || 0);
    const otherAmount = totals.total ? Math.max(0, totals.total - knownAmounts) : 0;
    
    return {
        totalItems: items.length,
        totalCost: finalTotal, // The final total to display
        calculatedTotal: calculatedTotal, // Just the items
        actualTotal: totals.total, // From PDF
        vat: totals.vat,
        shipping: totals.shipping,
        subtotal: totals.subtotal,
        costDiscrepancy: totals.total ? Math.abs(totals.total - calculatedTotal) : 0,
        byType,
        breakdown: {
            items: calculatedTotal,
            vat: totals.vat || 0,
            shipping: totals.shipping || 0,
            other: otherAmount
        }
    };
}