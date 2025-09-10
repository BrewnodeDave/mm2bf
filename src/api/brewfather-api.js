import axios from 'axios';

// Helper functions
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

function normalizeString(str) {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(str) {
  const normalized = normalizeString(str);
  const stopWords = ['the', 'and', 'for', 'with', 'crushed', 'uncrushed', 'whole', 'pellet', 'leaf'];
  return normalized.split(' ').filter(word => word.length > 2 && !stopWords.includes(word));
}

export class BrewfatherAPI {
  constructor(userId, apiKey) {
    if (!userId || !apiKey) {
      throw new Error('Brewfather User ID and API Key are required');
    }
    
    this.userId = userId;
    this.apiKey = apiKey;
    this.baseURL = 'https://api.brewfather.app/v2';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Basic ${Buffer.from(`${userId}:${apiKey}`).toString('base64')}`,
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }

  async testConnection() {
    try {
      const response = await this.client.get('/recipes');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: `Connection failed: ${error.response?.data?.message || error.message}` 
      };
    }
  }

  async updateFermentables(fermentables) {
    console.log(`\n🌾 Updating ${fermentables.length} fermentable(s) in Brewfather...`);
    
    const results = [];
    
    for (const fermentable of fermentables) {
        try {
            console.log(`\n  Processing: ${fermentable.name}`);
            console.log(`    Match status: ${fermentable.matchStatus || 'unknown'}`);
            console.log(`    Amount to add: ${fermentable.amount} ${fermentable.unit}`);
            
            if (!fermentable.brewfatherMatch) {
                console.log(`    ❌ No Brewfather match found`);
                results.push({
                    name: fermentable.name,
                    success: false,
                    action: 'not_found',
                    error: 'No matching item found in Brewfather inventory'
                });
                continue;
            }
            
            const brewfatherItem = fermentable.brewfatherMatch;
            const currentAmount = brewfatherItem?.inventory || 0;
            const newAmount = Math.trunc((currentAmount + fermentable.amount)*100)/100; // Round to 2 decimal places  

            console.log(`    Current amount: ${currentAmount} ${brewfatherItem?.inventory?.unit || fermentable.unit}`);
            console.log(`    New amount: ${newAmount} ${brewfatherItem?.inventory?.unit || fermentable.unit}`);
            
            // Warn about partial matches
            if (fermentable.matchStatus === 'partial') {
                console.log(`    ⚠️  WARNING: This is a partial match - please verify the ingredient is correct`);
            }

            const response = await this.client.patch(
              `/inventory/fermentables/${brewfatherItem._id}?inventory=${newAmount}`
            );

            if (response.status === 200) {
                console.log(`    ✅ Successfully updated`);
                results.push({
                    name: fermentable.name,
                    success: true,
                    action: 'updated',
                    currentAmount: currentAmount,
                    newAmount: newAmount,
                    adjustedBy: fermentable.amount,
                    unit: brewfatherItem.inventory?.unit || fermentable.unit,
                    matchStatus: fermentable.matchStatus,
                    brewfatherName: brewfatherItem.name
                });
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
            results.push({
                name: fermentable.name,
                success: false,
                action: 'error',
                error: error.message,
                matchStatus: fermentable.matchStatus
            });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  async updateHops(hops) {
    const results = [];
    
    // Get existing hops first
    const existingHops = await this.getHops();
    
    for (const hop of hops) {
      try {
        console.log(`Processing hop: ${hop.name}`);
        
        // Try to find existing item by name (bidirectional matching)
        const existing = existingHops.find(item => {
          if (!item.name) return false;
          const itemName = item.name.toLowerCase();
          const hopName = hop.name.toLowerCase();
          
          // Try exact match first
          if (itemName === hopName) return true;
          
          // Try bidirectional partial matching
          return itemName.includes(hopName.substring(0, 15)) ||
                 hopName.includes(itemName.substring(0, 15));
        });
        
        if (existing) {
          console.log(`→ Found existing hop: ${existing.name}`);
          console.log(`→ Existing inventory data:`, existing.inventory);
          console.log(`→ Existing full object:`, JSON.stringify(existing, null, 2));

          // The existing.inventory contains the current amount as a number
          const currentAmount = existing.inventory || 0;
          console.log(`→ Parsed current amount: ${currentAmount}`);

          const adjustAmount = hop.amount || 0;
          const newTotalAmount = Math.round((currentAmount + adjustAmount) * 100) / 100;

          console.log(`→ Current inventory: ${currentAmount}g`);
          console.log(`→ Adding: +${adjustAmount}g`);
          console.log(`→ New total will be: ${newTotalAmount}g`);
          
          
          console.log(`→ Sending data:`, JSON.stringify(updateData));
          
          // Debug: Log the exact request details
          const fullUrl = `${this.baseURL}/inventory/hops/${existing._id}`;
          console.log(`→ Full URL:`, fullUrl);
          console.log(`→ Headers:`, JSON.stringify(this.client.defaults.headers, null, 2));
          console.log(`→ Method: PATCH`);
          console.log(`→ Request Body:`, JSON.stringify(updateData, null, 2));
          
          let response;
          try {

            response = await this.client.patch(
              `/inventory/hops/${existing._id}?inventory=${newTotalAmount}`
            );
            if (response.data !== "Updated") {
              console.error(`→ Unexpected API response:`, response.status, response.data);
              
              // Check for read-only API key
              if (response.data === "Nothing to update") {
                results.push({
                  name: hop.name,
                  success: false,
                  action: 'error',
                  error: 'API key has read-only permissions. Please generate a new API key with read/write permissions in Brewfather Settings → API Keys.'
                });
              } else {
                results.push({
                  name: hop.name,
                  success: false,
                  action: 'error',
                  error: `Unexpected API response: ${response.status} ${JSON.stringify(response.data)}: ${existing._id}`
                });
              }
              continue;
            } else {
              console.log(`→ API Response:`, response.status, response.data);
            }

            results.push({
              name: hop.name,
              success: true,
              action: 'adjusted',
              id: existing._id,
              currentAmount: currentAmount,  // This should be the actual current amount
              adjustedBy: adjustAmount,
              newAmount: newTotalAmount,
              unit: 'g'
            });
          } catch (error) {
            console.error(`Failed to update hop ${hop.name}:`, error.response?.data || error.message);
            results.push({
              name: hop.name,
              success: false,
              action: 'error',
              error: error.response?.data?.message || error.message
            });
          }
        } else {
          // Item not found in existing inventory
          results.push({
            name: hop.name,
            success: false,
            action: 'not_found',
            error: 'Item not found in Brewfather inventory. Add it manually first, then run this tool to update quantities.'
          });
        }
        
      } catch (error) {
        console.error(`Failed to update hop ${hop.name}:`, error.response?.data || error.message);
        results.push({
          name: hop.name,
          success: false,
          action: 'error',
          error: error.response?.data?.message || error.message
        });
      }
    }
    
    return results;
  }

  async updateYeasts(yeasts) {
    const results = [];
    
    // Get existing yeasts first
    const existingYeasts = await this.getYeasts();
    
    for (const yeast of yeasts) {
      try {
        console.log(`Processing yeast: ${yeast.name}`);
        
        // Try to find existing item by name
        const existing = existingYeasts.find(item => 
          item.name && item.name.toLowerCase().includes(yeast.name.toLowerCase().substring(0, 20))
        );
        
        if (existing) {
          // Read the actual current inventory amount
          const currentAmount = existing.inventory || 0;
          const adjustAmount = yeast.amount || 0;
          const newTotalAmount = Math.trunc((currentAmount + adjustAmount) * 100) / 100; // Round to 2 decimal places

          console.log(`→ ${yeast.name}: Current ${currentAmount} pkg, Adding +${adjustAmount} pkg`);
          
          const response = await this.client.patch(
            `/inventory/yeasts/${existing._id}`);
          
          if (response.data === "Updated") {
            results.push({
              name: yeast.name,
              success: true,
              action: 'adjusted',
              id: existing._id,
              currentAmount: currentAmount,  // Actual current amount
              adjustedBy: adjustAmount,
              newAmount: newTotalAmount,
              unit: yeast.unit || 'pkg'
            });
          }
        } else {
          // Item not found in existing inventory
          results.push({
            name: yeast.name,
            success: false,
            action: 'not_found',
            error: 'Item not found in Brewfather inventory. Add it manually first, then run this tool to update quantities.'
          });
        }
        
      } catch (error) {
        console.error(`Failed to update yeast ${yeast.name}:`, error.response?.data || error.message);
        results.push({
          name: yeast.name,
          success: false,
          action: 'error',
          error: error.response?.data?.message || error.message
        });
      }
    }
    
    return results;
  }

  async updateMiscs(miscs) {
    const results = [];
    
    // Get existing miscs first
    const existingMiscs = await this.getMiscs();
    
    for (const misc of miscs) {
      try {
        console.log(`Processing misc: ${misc.name}`);
        
        // Try to find existing item by name
        const existing = existingMiscs.find(item => 
          item.name && item.name.toLowerCase().includes(misc.name.toLowerCase().substring(0, 20))
        );
        
        if (existing) {
          // Read the actual current inventory amount
          const currentAmount = existing.inventory || 0;
          const adjustAmount = misc.amount || 0;
          const newTotalAmount = Math.trunc((currentAmount + adjustAmount)*100)/100; // Round to 2 decimal places
          
          console.log(`→ ${misc.name}: Current ${currentAmount}g, Adding +${adjustAmount}g`);
          
          const response = await this.client.patch(
            `/inventory/miscs/${existing._id}?inventory=${newTotalAmount}`
          );
          
          if (response.data === "Updated") {
            results.push({
              name: misc.name,
              success: true,
              action: 'adjusted',
              id: existing._id,
              currentAmount: currentAmount,  // Actual current amount
              adjustedBy: adjustAmount,
              newAmount: newTotalAmount,
              unit: misc.unit || 'g'
            });
          }
        } else {
          // Item not found in existing inventory
          results.push({
            name: misc.name,
            success: false,
            action: 'not_found',
            error: 'Item not found in Brewfather inventory. Add it manually first, then run this tool to update quantities.'
          });
        }
        
      } catch (error) {
        console.error(`Failed to update misc ${misc.name}:`, error.response?.data || error.message);
        results.push({
          name: misc.name,
          success: false,
          action: 'error',
          error: error.response?.data?.message || error.message
        });
      }
    }
    
    return results;
  }

      // Helper for paginated inventory fetching
  async fetchAllInventory(endpoint) {
    let allItems = [];
    let lastId = null;
    let keepGoing = true;

    while (keepGoing) {
      const url = lastId
      ? `${endpoint}?inventory_exists=true&complete=true&limit=50&start_after=${lastId}`
      : `${endpoint}?inventory_exists=true&complete=true&limit=50`;
      
      const response = await this.client.get(url);
      const items = response.data || [];
      allItems = allItems.concat(items);

      if (items.length === 50) {
        lastId = items[items.length - 1]._id;
      } else {
        keepGoing = false;
      }
    }
    return allItems;
  }

  // Inventory getter methods
  async getFermentables() {
    try {
      const allFermentables = await this.fetchAllInventory('/inventory/fermentables');
      return allFermentables;
    } catch (error) {
      throw new Error(`Failed to get fermentables: ${error.response?.data?.message || error.message}`);
    }
  }


  async getHops() {
    try {
      const allHops = await this.fetchAllInventory('/inventory/hops');
      return allHops;
    } catch (error) {
      throw new Error(`Failed to get hops: ${error.response?.data?.message || error.message}`);
    }
  }

  async getYeasts() {
    try {
      const allYeasts = await this.fetchAllInventory('/inventory/yeasts');
      return allYeasts;
    } catch (error) {
      throw new Error(`Failed to get yeasts: ${error.response?.data?.message || error.message}`);
    }
  }

  async getMiscs() {
    try {
      const response = await this.client.get('/inventory/miscs');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get miscs: ${error.response?.data?.message || error.message}`);
    }
  }

  // Enhanced matching methods
  async matchHops(ingredients) {
    const results = {};
    
    try {
      const existingHops = await this.getHops();
      console.log(`Found ${existingHops.length} hops in Brewfather inventory`);
      
      for (const ingredient of ingredients) {
        console.log(`\n🌿 Matching hop: "${ingredient.name}"`);
        const match = this.findBestHopMatch(ingredient.name, existingHops);
        results[ingredient.name] = match;
        
        if (match.found) {
          console.log(`✅ Match found: "${match.brewfatherItem.name}" (score: ${match.score.toFixed(3)})`);
        } else {
          console.log(`❌ No match found for "${ingredient.name}"`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error matching hops:', error);
      throw error;
    }
  }

  async matchYeasts(ingredients) {
    const results = {};
    
    try {
      const existingYeasts = await this.getYeasts();
      console.log(`Found ${existingYeasts.length} yeasts in Brewfather inventory`);
      
      for (const ingredient of ingredients) {
        console.log(`\n🍺 Matching yeast: "${ingredient.name}"`);
        const match = this.findBestYeastMatch(ingredient.name, existingYeasts);
        results[ingredient.name] = match;
        
        if (match.found) {
          console.log(`✅ Match found: "${match.brewfatherItem.name}" (score: ${match.score.toFixed(3)})`);
        } else {
          console.log(`❌ No match found for "${ingredient.name}"`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error matching yeasts:', error);
      throw error;
    }
  }

  async matchFermentables(ingredients) {
    const results = {};
    
    try {
      const existingFermentables = await this.getFermentables();
      console.log(`Found ${existingFermentables.length} fermentables in Brewfather inventory`);
      
      for (const ingredient of ingredients) {
        console.log(`\n🌾 Matching fermentable: "${ingredient.name}"`);
        const match = this.findBestFermentableMatch(ingredient.name, existingFermentables);
        results[ingredient.name] = match;
        
        if (match.found) {
          console.log(`✅ Match found: "${match.brewfatherItem.name}" (score: ${match.score.toFixed(3)})`);
        } else {
          console.log(`❌ No match found for "${ingredient.name}"`);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error matching fermentables:', error);
      throw error;
    }
  }

  // Hop matching methods
  findBestHopMatch(ingredientName, existingHops) {
    const searchNorm = normalizeString(ingredientName);
    const searchKeywords = extractKeywords(ingredientName);
    
    console.log(`  🔎 Searching for: "${searchNorm}"`);
    console.log(`  📝 Keywords: [${searchKeywords.join(', ')}]`);
    
    const matches = existingHops.map(hop => {
      const hopNorm = normalizeString(hop.name);
      
      // Hop variety name matching (most important for hops)
      const varietyMatch = this.matchHopVariety(searchNorm, hopNorm);
      
      // Brand/origin matching for hops
      const hopBrands = this.extractHopBrands(searchNorm);
      const inventoryBrands = this.extractHopBrands(hopNorm);
      const brandMatch = hopBrands.some(brand => inventoryBrands.includes(brand));
      
      // Form matching (pellet, leaf, powder, etc.)
      const formMatch = this.matchHopForm(searchNorm, hopNorm);
      
      // Alpha acid matching (if present)
      const alphaMatch = this.matchAlphaAcid(searchNorm, hopNorm);
      
      // Keyword matching
      const hopKeywords = extractKeywords(hop.name);
      let keywordMatches = 0;
      let exactMatches = 0;
      
      for (const searchWord of searchKeywords) {
        let bestSimilarity = 0;
        let foundExact = false;
        
        for (const hopWord of hopKeywords) {
          if (searchWord === hopWord) {
            exactMatches++;
            foundExact = true;
            break;
          }
          
          const distance = levenshteinDistance(searchWord, hopWord);
          const similarity = 1 - (distance / Math.max(searchWord.length, hopWord.length));
          bestSimilarity = Math.max(bestSimilarity, similarity);
        }
        
        if (foundExact || bestSimilarity > 0.7) {
          keywordMatches++;
        }
      }
      
      const keywordScore = searchKeywords.length > 0 ? keywordMatches / searchKeywords.length : 0;
      const exactScore = searchKeywords.length > 0 ? exactMatches / searchKeywords.length : 0;
      
      // Overall similarity
      const overallDistance = levenshteinDistance(hopNorm, searchNorm);
      const maxLength = Math.max(hopNorm.length, searchNorm.length);
      const overallSimilarity = maxLength > 0 ? 1 - (overallDistance / maxLength) : 0;
      
      // Hop-specific similarity for common characteristics
      const hopSpecificScore = this.calculateHopSpecificSimilarity(searchNorm, hopNorm);
      
      // Combined score with weights optimized for hops
      let finalScore = (varietyMatch.score * 0.4) + (keywordScore * 0.2) + (exactScore * 0.2) + (overallSimilarity * 0.1) + (hopSpecificScore * 0.1);
      
      // Apply bonuses
      if (brandMatch) finalScore += 0.1;
      if (formMatch.found) finalScore += 0.05;
      if (alphaMatch.found) finalScore += 0.1;
      
      return {
        hop,
        score: finalScore,
        keywordMatches: `${keywordMatches}/${searchKeywords.length}`,
        exactMatches: `${exactMatches}/${searchKeywords.length}`,
        varietyMatch: varietyMatch.found,
        brandMatch,
        formMatch: formMatch.found,
        alphaMatch: alphaMatch.found,
        details: {
          varietyScore: varietyMatch.score,
          keywordScore,
          exactScore,
          overallSimilarity,
          hopSpecificScore
        }
      };
    });
    
    // Get best match
    const bestMatch = matches
      .filter(match => match.score > 0.25)
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestMatch) {
      return {
        found: true,
        confidence: bestMatch.score > 0.7 ? 'high' : bestMatch.score > 0.5 ? 'medium' : 'low',
        brewfatherItem: bestMatch.hop,
        score: bestMatch.score,
        keywordMatches: bestMatch.keywordMatches,
        exactMatches: bestMatch.exactMatches,
        varietyMatch: bestMatch.varietyMatch,
        brandMatch: bestMatch.brandMatch,
        formMatch: bestMatch.formMatch,
        alphaMatch: bestMatch.alphaMatch,
        details: bestMatch.details
      };
    }
    
    return {
      found: false,
      confidence: 'none',
      brewfatherItem: null,
      score: 0,
      suggestions: this.getSimilarHops(ingredientName, existingHops)
    };
  }

  matchHopVariety(searchNorm, hopNorm) {
    // Common hop varieties with alternative names
    const hopVarieties = {
      'cascade': ['cascade'],
      'centennial': ['centennial'],
      'chinook': ['chinook'],
      'columbus': ['columbus', 'ctz', 'tomahawk', 'zeus'],
      'citra': ['citra', 'hbc 394'],
      'mosaic': ['mosaic', 'hbc 369'],
      'amarillo': ['amarillo', 'vgxp01'],
      'simcoe': ['simcoe', 'yqh1320'],
      'galaxy': ['galaxy'],
      'nelson sauvin': ['nelson sauvin', 'nelson'],
      'saaz': ['saaz', 'czech saaz'],
      'hallertau': ['hallertau', 'hallertauer'],
      'fuggle': ['fuggle', 'fuggles'],
      'east kent golding': ['east kent golding', 'golding', 'kent golding'],
      'northern brewer': ['northern brewer'],
      'magnum': ['magnum'],
      'warrior': ['warrior'],
      'nugget': ['nugget'],
      'willamette': ['willamette'],
      'sterling': ['sterling'],
      'mt hood': ['mt hood', 'mount hood'],
      'liberty': ['liberty'],
      'crystal': ['crystal'],
      'ultra': ['ultra'],
      'tradition': ['tradition'],
      'tettnang': ['tettnang'],
      'spalt': ['spalt'],
      'sorachi ace': ['sorachi ace', 'sorachi'],
      'equinox': ['equinox', 'hbc 366'],
      'azacca': ['azacca', 'hbc 438'],
      'el dorado': ['el dorado', 'hbc 404'],
      'huell melon': ['huell melon', 'hull melon'],
      'mandarina bavaria': ['mandarina bavaria', 'mandarina'],
      'blanc': ['blanc', 'nelson blanc'],
      'wakatu': ['wakatu'],
      'riwaka': ['riwaka'],
      'motueka': ['motueka'],
      'pacific jade': ['pacific jade'],
      'green bullet': ['green bullet'],
      'southern cross': ['southern cross']
    };
    
    for (const [variety, aliases] of Object.entries(hopVarieties)) {
      const searchHasVariety = aliases.some(alias => searchNorm.includes(alias));
      const hopHasVariety = aliases.some(alias => hopNorm.includes(alias));
      
      if (searchHasVariety && hopHasVariety) {
        // Calculate how well the variety name matches
        let bestScore = 0;
        for (const alias of aliases) {
          if (searchNorm.includes(alias) && hopNorm.includes(alias)) {
            const score = alias.length / Math.max(searchNorm.length, hopNorm.length);
            bestScore = Math.max(bestScore, score);
          }
        }
        return { found: true, score: Math.min(bestScore * 2, 1.0), variety };
      }
    }
    
    return { found: false, score: 0, variety: null };
  }

  extractHopBrands(normalizedString) {
    // Common hop brands, farms, and origins
    const hopBrands = [
      'yakima chief', 'glacier', 'hop hash', 'cryo hops', 'lupulin powder',
      'charles faram', 'simply hops', 'hops direct', 'hop union',
      'new zealand hops', 'nz hops', 'hop products australia',
      'barth haas', 'john i haas', 'steiner hops',
      'czech', 'german', 'english', 'american', 'australian', 'new zealand',
      'yakima valley', 'willamette valley', 'kent', 'bavaria',
      'hallertau', 'tettnang', 'spalt', 'saaz'
    ];
    
    return hopBrands.filter(brand => normalizedString.includes(brand));
  }

  matchHopForm(searchNorm, hopNorm) {
    const hopForms = {
      'pellet': ['pellet', 'pellets', 'p90', 't90'],
      'leaf': ['leaf', 'whole', 'cone', 'flower'],
      'powder': ['powder', 'lupulin', 'cryo', 'hash'],
      'extract': ['extract', 'oil', 'co2']
    };
    
    for (const [form, keywords] of Object.entries(hopForms)) {
      const searchHasForm = keywords.some(keyword => searchNorm.includes(keyword));
      const hopHasForm = keywords.some(keyword => hopNorm.includes(keyword));
      
      if (searchHasForm && hopHasForm) {
        return { found: true, form };
      }
    }
    
    return { found: false, form: null };
  }

  matchAlphaAcid(searchNorm, hopNorm) {
    // Match alpha acid percentages (e.g., "12.5%", "12.5 aa", "alpha 12.5")
    const alphaPattern = /(?:alpha|aa|α)\s*:?\s*(\d+(?:\.\d+)?)\s*%?|(\d+(?:\.\d+)?)\s*%?\s*(?:alpha|aa|α)/gi;
    
    const searchAlpha = searchNorm.match(alphaPattern);
    const hopAlpha = hopNorm.match(alphaPattern);
    
    if (searchAlpha && hopAlpha) {
      // Extract numeric values
      const searchValue = parseFloat(searchAlpha[0].replace(/[^\d.]/g, ''));
      const hopValue = parseFloat(hopAlpha[0].replace(/[^\d.]/g, ''));
      
      // Consider a match if within 2% tolerance
      if (Math.abs(searchValue - hopValue) <= 2.0) {
        return { found: true, searchAlpha: searchValue, hopAlpha: hopValue };
      }
    }
    
    return { found: false, searchAlpha: null, hopAlpha: null };
  }

  calculateHopSpecificSimilarity(searchNorm, hopNorm) {
    // Hop usage characteristics
    const hopCharacteristics = {
      'bittering': ['bittering', 'bitter', 'magnum', 'warrior', 'nugget'],
      'aroma': ['aroma', 'aromatic', 'late', 'dry hop', 'finishing'],
      'dual': ['dual', 'dual purpose', 'both'],
      'citrus': ['citrus', 'grapefruit', 'orange', 'lemon', 'lime'],
      'floral': ['floral', 'flower', 'perfume', 'rose'],
      'piney': ['pine', 'piney', 'resin', 'woody'],
      'earthy': ['earth', 'herbal', 'spicy', 'pepper'],
      'fruity': ['fruit', 'berry', 'tropical', 'passion', 'mango'],
      'noble': ['noble', 'traditional', 'classic']
    };
    
    let characteristicScore = 0;
    let matchedCharacteristics = 0;
    
    for (const [characteristic, keywords] of Object.entries(hopCharacteristics)) {
      const searchHasChar = keywords.some(keyword => searchNorm.includes(keyword));
      const hopHasChar = keywords.some(keyword => hopNorm.includes(keyword));
      
      if (searchHasChar && hopHasChar) {
        characteristicScore += 1;
        matchedCharacteristics++;
      }
    }
    
    return matchedCharacteristics > 0 ? characteristicScore / Object.keys(hopCharacteristics).length : 0;
  }

  getSimilarHops(ingredientName, existingHops) {
    const searchKeywords = extractKeywords(ingredientName);
    
    const similar = existingHops
      .map(hop => {
        const hopKeywords = extractKeywords(hop.name);
        let commonWords = 0;
        
        for (const searchWord of searchKeywords) {
          for (const hopWord of hopKeywords) {
            const distance = levenshteinDistance(searchWord, hopWord);
            const similarity = 1 - (distance / Math.max(searchWord.length, hopWord.length));
            if (similarity > 0.6) {
              commonWords++;
              break;
            }
          }
        }
        
        return {
          hop,
          commonWords,
          similarity: searchKeywords.length > 0 ? commonWords / searchKeywords.length : 0
        };
      })
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => ({
        name: item.hop.name,
        id: item.hop._id,
        similarity: item.similarity,
        alpha: item.hop.alpha || 'N/A'
      }));
    
    return similar;
  }

  // Yeast matching methods
  findBestYeastMatch(ingredientName, existingYeasts) {
    const searchNorm = normalizeString(ingredientName);
    const searchKeywords = extractKeywords(ingredientName);
    
    console.log(`  🔎 Searching for: "${searchNorm}"`);
    console.log(`  📝 Keywords: [${searchKeywords.join(', ')}]`);
    
    const matches = existingYeasts.map(yeast => {
      const yeastNorm = normalizeString(yeast.name);
      
      // Brand/manufacturer matching for yeasts
      const yeastBrands = this.extractYeastBrands(searchNorm);
      const inventoryBrands = this.extractYeastBrands(yeastNorm);
      const brandMatch = yeastBrands.some(brand => inventoryBrands.includes(brand));
      
      // Strain number matching (e.g., "US-05", "WLP001", "1056")
      const strainMatch = this.matchYeastStrains(searchNorm, yeastNorm);
      
      // Keyword matching
      const yeastKeywords = extractKeywords(yeast.name);
      let keywordMatches = 0;
      let exactMatches = 0;
      
      for (const searchWord of searchKeywords) {
        let bestSimilarity = 0;
        let foundExact = false;
        
        for (const yeastWord of yeastKeywords) {
          if (searchWord === yeastWord) {
            exactMatches++;
            foundExact = true;
            break;
          }
          
          const distance = levenshteinDistance(searchWord, yeastWord);
          const similarity = 1 - (distance / Math.max(searchWord.length, yeastWord.length));
          bestSimilarity = Math.max(bestSimilarity, similarity);
        }
        
        if (foundExact || bestSimilarity > 0.7) {
          keywordMatches++;
        }
      }
      
      const keywordScore = searchKeywords.length > 0 ? keywordMatches / searchKeywords.length : 0;
      const exactScore = searchKeywords.length > 0 ? exactMatches / searchKeywords.length : 0;
      
      // Overall similarity
      const overallDistance = levenshteinDistance(yeastNorm, searchNorm);
      const maxLength = Math.max(yeastNorm.length, searchNorm.length);
      const overallSimilarity = maxLength > 0 ? 1 - (overallDistance / maxLength) : 0;
      
      // Yeast-specific similarity for common terms
      const yeastSpecificScore = this.calculateYeastSpecificSimilarity(searchNorm, yeastNorm);
      
      // Combined score with weights optimized for yeasts
      let finalScore = (keywordScore * 0.3) + (exactScore * 0.3) + (overallSimilarity * 0.2) + (yeastSpecificScore * 0.2);
      
      // Apply bonuses
      if (brandMatch) finalScore += 0.15;
      if (strainMatch.found) finalScore += strainMatch.bonus;
      
      return {
        yeast,
        score: finalScore,
        keywordMatches: `${keywordMatches}/${searchKeywords.length}`,
        exactMatches: `${exactMatches}/${searchKeywords.length}`,
        brandMatch,
        strainMatch: strainMatch.found,
        details: {
          keywordScore,
          exactScore,
          overallSimilarity,
          yeastSpecificScore
        }
      };
    });
    
    // Get best match
    const bestMatch = matches
      .filter(match => match.score > 0.25)
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestMatch) {
      return {
        found: true,
        confidence: bestMatch.score > 0.7 ? 'high' : bestMatch.score > 0.5 ? 'medium' : 'low',
        brewfatherItem: bestMatch.yeast,
        score: bestMatch.score,
        keywordMatches: bestMatch.keywordMatches,
        exactMatches: bestMatch.exactMatches,
        brandMatch: bestMatch.brandMatch,
        strainMatch: bestMatch.strainMatch,
        details: bestMatch.details
      };
    }
    
    return {
      found: false,
      confidence: 'none',
      brewfatherItem: null,
      score: 0,
      suggestions: this.getSimilarYeasts(ingredientName, existingYeasts)
    };
  }

  extractYeastBrands(normalizedString) {
    // Common yeast brands and manufacturers
    const yeastBrands = [
      'lallemand', 'fermentis', 'white labs', 'wyeast', 'mangrove jack', 'mangrove jacks',
      'safspirit', 'omega', 'imperial', 'bootleg biology', 'escarpment',
      'red star', 'lavlin', 'ec-1118', 'k1-v1116', 'bry-97', 'nottingham',
      'wlp', 'wy', 'us-05', 'us-04', 's-04', 's-05', 'belle saison'
    ];
    
    return yeastBrands.filter(brand => normalizedString.includes(brand));
  }

  matchYeastStrains(searchNorm, yeastNorm) {
    // Common yeast strain patterns
    const strainPatterns = [
      /us[-\s]?0?5/i,     // US-05, US05, US 05
      /us[-\s]?0?4/i,     // US-04
      /s[-\s]?0?4/i,      // S-04, S04
      /s[-\s]?0?5/i,      // S-05
      /wlp\s?(\d+)/i,     // WLP001, WLP 001
      /wy\s?(\d+)/i,      // WY1056, WY 1056
      /ec[-\s]?1118/i,    // EC-1118
      /k1[-\s]?v1116/i,   // K1-V1116
      /bry[-\s]?97/i,     // BRY-97
      /(\d{3,4})/         // Generic 3-4 digit numbers like 1056, 3787
    ];
    
    for (const pattern of strainPatterns) {
      const searchMatch = searchNorm.match(pattern);
      const yeastMatch = yeastNorm.match(pattern);
      
      if (searchMatch && yeastMatch) {
        // Check if the matched parts are the same
        if (searchMatch[0].replace(/[-\s]/g, '') === yeastMatch[0].replace(/[-\s]/g, '')) {
          return { found: true, bonus: 0.3 }; // High bonus for strain match
        }
      }
    }
    
    return { found: false, bonus: 0 };
  }

  calculateYeastSpecificSimilarity(searchNorm, yeastNorm) {
    // Yeast-specific terms that indicate similar types
    const yeastTypes = {
      'ale': ['ale', 'english', 'american', 'ipa', 'pale'],
      'lager': ['lager', 'pilsner', 'czech', 'german', 'continental'],
      'wheat': ['wheat', 'weizen', 'hefeweizen', 'witbier', 'blanc'],
      'belgian': ['belgian', 'abbey', 'trappist', 'saison', 'farmhouse'],
      'wine': ['wine', 'champagne', 'cider', 'mead'],
      'brett': ['brett', 'brettanomyces', 'wild', 'sour', 'funk'],
      'kveik': ['kveik', 'norwegian', 'voss', 'hornindal']
    };
    
    let typeScore = 0;
    let matchedTypes = 0;
    
    for (const [type, keywords] of Object.entries(yeastTypes)) {
      const searchHasType = keywords.some(keyword => searchNorm.includes(keyword));
      const yeastHasType = keywords.some(keyword => yeastNorm.includes(keyword));
      
      if (searchHasType && yeastHasType) {
        typeScore += 1;
        matchedTypes++;
      } else if (searchHasType || yeastHasType) {
        // Penalty for type mismatch
        typeScore -= 0.1;
      }
    }
    
    return matchedTypes > 0 ? typeScore / Object.keys(yeastTypes).length : 0;
  }

  getSimilarYeasts(ingredientName, existingYeasts) {
    const searchKeywords = extractKeywords(ingredientName);
    
    const similar = existingYeasts
      .map(yeast => {
        const yeastKeywords = extractKeywords(yeast.name);
        let commonWords = 0;
        
        for (const searchWord of searchKeywords) {
          for (const yeastWord of yeastKeywords) {
            const distance = levenshteinDistance(searchWord, yeastWord);
            const similarity = 1 - (distance / Math.max(searchWord.length, yeastWord.length));
            if (similarity > 0.6) {
              commonWords++;
              break;
            }
          }
        }
        
        return {
          yeast,
          commonWords,
          similarity: searchKeywords.length > 0 ? commonWords / searchKeywords.length : 0
        };
      })
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => ({
        name: item.yeast.name,
        id: item.yeast._id,
        similarity: item.similarity
      }));
  
    return similar;
  }

  // Fermentable matching methods
  findBestFermentableMatch(ingredientName, existingFermentables) {
    const searchNorm = normalizeString(ingredientName);
    const searchKeywords = extractKeywords(ingredientName);
    
    console.log(`  🔎 Searching for: "${searchNorm}"`);
    console.log(`  📝 Keywords: [${searchKeywords.join(', ')}]`);
    
    const matches = existingFermentables.map(fermentable => {
      const fermentableNorm = normalizeString(fermentable.name);
      
      // Malt type matching (most important for fermentables)
      const maltTypeMatch = this.matchMaltType(searchNorm, fermentableNorm);
      
      // Brand/manufacturer matching for malts
      const maltBrands = this.extractMaltBrands(searchNorm);
      const inventoryBrands = this.extractMaltBrands(fermentableNorm);
      const brandMatch = maltBrands.some(brand => inventoryBrands.includes(brand));
      
      // Color/EBC matching
      const colorMatch = this.matchMaltColor(searchNorm, fermentableNorm);
      
      // Processing form matching (crushed, flaked, etc.)
      const formMatch = this.matchMaltForm(searchNorm, fermentableNorm);
      
      // Origin matching (country/region)
      const originMatch = this.matchMaltOrigin(searchNorm, fermentableNorm);
      
      // Keyword matching
      const fermentableKeywords = extractKeywords(fermentable.name);
      let keywordMatches = 0;
      let exactMatches = 0;
      
      for (const searchWord of searchKeywords) {
        let bestSimilarity = 0;
        let foundExact = false;
        
        for (const fermentableWord of fermentableKeywords) {
          if (searchWord === fermentableWord) {
            exactMatches++;
            foundExact = true;
            break;
          }
          
          const distance = levenshteinDistance(searchWord, fermentableWord);
          const similarity = 1 - (distance / Math.max(searchWord.length, fermentableWord.length));
          bestSimilarity = Math.max(bestSimilarity, similarity);
        }
        
        if (foundExact || bestSimilarity > 0.7) {
          keywordMatches++;
        }
      }
      
      const keywordScore = searchKeywords.length > 0 ? keywordMatches / searchKeywords.length : 0;
      const exactScore = searchKeywords.length > 0 ? exactMatches / searchKeywords.length : 0;
      
      // Overall similarity
      const overallDistance = levenshteinDistance(fermentableNorm, searchNorm);
      const maxLength = Math.max(fermentableNorm.length, searchNorm.length);
      const overallSimilarity = maxLength > 0 ? 1 - (overallDistance / maxLength) : 0;
      
      // Malt-specific similarity for common characteristics
      const maltSpecificScore = this.calculateMaltSpecificSimilarity(searchNorm, fermentableNorm);
      
      // Combined score with weights optimized for malts
      let finalScore = (maltTypeMatch.score * 0.35) + (keywordScore * 0.25) + (exactScore * 0.2) + (overallSimilarity * 0.1) + (maltSpecificScore * 0.1);
      
      // Apply bonuses
      if (brandMatch) finalScore += 0.1;
      if (colorMatch.found) finalScore += 0.05;
      if (formMatch.found) finalScore += 0.03;
      if (originMatch.found) finalScore += 0.05;
      
      return {
        fermentable,
        score: finalScore,
        keywordMatches: `${keywordMatches}/${searchKeywords.length}`,
        exactMatches: `${exactMatches}/${searchKeywords.length}`,
        maltTypeMatch: maltTypeMatch.found,
        brandMatch,
        colorMatch: colorMatch.found,
        formMatch: formMatch.found,
        originMatch: originMatch.found,
        details: {
          maltTypeScore: maltTypeMatch.score,
          keywordScore,
          exactScore,
          overallSimilarity,
          maltSpecificScore
        }
      };
    });
    
    // Get best match
    const bestMatch = matches
      .filter(match => match.score > 0.25)
      .sort((a, b) => b.score - a.score)[0];
    
    if (bestMatch) {
      return {
        found: true,
        confidence: bestMatch.score > 0.7 ? 'high' : bestMatch.score > 0.5 ? 'medium' : 'low',
        brewfatherItem: bestMatch.fermentable,
        score: bestMatch.score,
        keywordMatches: bestMatch.keywordMatches,
        exactMatches: bestMatch.exactMatches,
        maltTypeMatch: bestMatch.maltTypeMatch,
        brandMatch: bestMatch.brandMatch,
        colorMatch: bestMatch.colorMatch,
        formMatch: bestMatch.formMatch,
        originMatch: bestMatch.originMatch,
        details: bestMatch.details
      };
    }
    
    return {
      found: false,
      confidence: 'none',
      brewfatherItem: null,
      score: 0,
      suggestions: this.getSimilarFermentables(ingredientName, existingFermentables)
    };
  }

  matchMaltType(searchNorm, fermentableNorm) {
    // Common malt types with alternative names
    const maltTypes = {
      'pale malt': ['pale malt', 'pale', 'base malt', '2-row', 'two row'],
      'pilsner malt': ['pilsner malt', 'pilsner', 'pils', 'lager malt'],
      'maris otter': ['maris otter', 'otter'],
      'munich malt': ['munich malt', 'munich'],
      'vienna malt': ['vienna malt', 'vienna'],
      'wheat malt': ['wheat malt', 'wheat', 'weizen malt'],
      'crystal malt': ['crystal malt', 'crystal', 'caramel malt', 'caramel'],
      'chocolate malt': ['chocolate malt', 'chocolate'],
      'black malt': ['black malt', 'black patent', 'patent malt'],
      'roasted barley': ['roasted barley', 'roast barley'],
      'amber malt': ['amber malt', 'amber'],
      'brown malt': ['brown malt', 'brown'],
      'biscuit malt': ['biscuit malt', 'biscuit'],
      'victory malt': ['victory malt', 'victory'],
      'special b': ['special b', 'special-b'],
      'aromatic malt': ['aromatic malt', 'aromatic'],
      'melanoidin malt': ['melanoidin malt', 'melanoidin'],
      'acidulated malt': ['acidulated malt', 'acidulated', 'acid malt'],
      'smoked malt': ['smoked malt', 'smoked', 'rauch malt'],
      'wheat flakes': ['wheat flakes', 'flaked wheat', 'rolled wheat'],
      'oat flakes': ['oat flakes', 'flaked oats', 'rolled oats'],
      'barley flakes': ['barley flakes', 'flaked barley', 'rolled barley'],
      'rice flakes': ['rice flakes', 'flaked rice'],
      'corn flakes': ['corn flakes', 'flaked corn', 'flaked maize'],
      'torrified wheat': ['torrified wheat', 'torrefied wheat'],
      'cara munich': ['cara munich', 'caramunich'],
      'cara vienna': ['cara vienna', 'caravienna'],
      'cara pils': ['cara pils', 'carapils', 'dextrin malt'],
      'cara aroma': ['cara aroma', 'caraaroma'],
      'cara red': ['cara red', 'carared'],
      'cara hell': ['cara hell', 'carahell']
    };
    
    for (const [maltType, aliases] of Object.entries(maltTypes)) {
      const searchHasMalt = aliases.some(alias => searchNorm.includes(alias));
      const fermentableHasMalt = aliases.some(alias => fermentableNorm.includes(alias));
      
      if (searchHasMalt && fermentableHasMalt) {
        // Calculate how well the malt type matches
        let bestScore = 0;
        for (const alias of aliases) {
          if (searchNorm.includes(alias) && fermentableNorm.includes(alias)) {
            const score = alias.length / Math.max(searchNorm.length, fermentableNorm.length);
            bestScore = Math.max(bestScore, score);
          }
        }
        return { found: true, score: Math.min(bestScore * 2, 1.0), maltType };
      }
    }
    
    return { found: false, score: 0, maltType: null };
  }

  extractMaltBrands(normalizedString) {
    // Common malt brands and maltsters
    const maltBrands = [
      'tmm', 'the malt miller', 'crisp', 'muntons', 'warminster',
      'maris otter', 'golden promise', 'pearl', 'optic',
      'weyermann', 'best malz', 'bestmalz', 'viking malt', 'dingemans',
      'castle malting', 'simpsons', 'thomas fawcett', 'fawcett',
      'briess', 'rahr', 'great western malting', 'malteurop',
      'bairds', 'pauls malt', 'boortmalt', 'soufflet',
      'german', 'belgian', 'english', 'american', 'canadian',
      'bohemian', 'czech', 'floor malted'
    ];
    
    return maltBrands.filter(brand => normalizedString.includes(brand));
  }

  matchMaltColor(searchNorm, fermentableNorm) {
    // Match color specifications (EBC, Lovibond, SRM)
    const colorPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:ebc|°ebc)/gi,
      /(\d+(?:\.\d+)?)\s*(?:l|°l|lovibond)/gi,
      /(\d+(?:\.\d+)?)\s*(?:srm)/gi,
      /(\d+(?:\.\d+)?)\s*(?:colour|color)/gi
    ];
    
    let searchColor = null;
    let fermentableColor = null;
    
    for (const pattern of colorPatterns) {
      const searchMatch = searchNorm.match(pattern);
      const fermentableMatch = fermentableNorm.match(pattern);
      
      if (searchMatch) searchColor = parseFloat(searchMatch[1]);
      if (fermentableMatch) fermentableColor = parseFloat(fermentableMatch[1]);
    }
    
    if (searchColor !== null && fermentableColor !== null) {
      // Consider a match if within 20% tolerance or 5 units (whichever is larger)
      const tolerance = Math.max(searchColor * 0.2, 5);
      if (Math.abs(searchColor - fermentableColor) <= tolerance) {
        return { found: true, searchColor, fermentableColor };
      }
    }
    
    return { found: false, searchColor, fermentableColor };
  }

  matchMaltForm(searchNorm, fermentableNorm) {
    const maltForms = {
      'crushed': ['crushed', 'cracked', 'milled'],
      'uncrushed': ['uncrushed', 'whole', 'uncrushed', 'grain'],
      'flaked': ['flaked', 'flakes', 'rolled'],
      'torrified': ['torrified', 'torrefied', 'puffed'],
      'extract': ['extract', 'lme', 'dme', 'liquid', 'dry'],
      'flour': ['flour', 'meal']
    };
    
    for (const [form, keywords] of Object.entries(maltForms)) {
      const searchHasForm = keywords.some(keyword => searchNorm.includes(keyword));
      const fermentableHasForm = keywords.some(keyword => fermentableNorm.includes(keyword));
      
      if (searchHasForm && fermentableHasForm) {
        return { found: true, form };
      }
    }
    
    return { found: false, form: null };
  }

  matchMaltOrigin(searchNorm, fermentableNorm) {
    const origins = {
      'english': ['english', 'england', 'uk', 'british'],
      'german': ['german', 'germany', 'deutsch'],
      'belgian': ['belgian', 'belgium'],
      'american': ['american', 'usa', 'us'],
      'canadian': ['canadian', 'canada'],
      'czech': ['czech', 'bohemian'],
      'french': ['french', 'france'],
      'australian': ['australian', 'australia']
    };
    
    for (const [origin, keywords] of Object.entries(origins)) {
      const searchHasOrigin = keywords.some(keyword => searchNorm.includes(keyword));
      const fermentableHasOrigin = keywords.some(keyword => fermentableNorm.includes(keyword));
      
      if (searchHasOrigin && fermentableHasOrigin) {
        return { found: true, origin };
      }
    }
    
    return { found: false, origin: null };
  }

  calculateMaltSpecificSimilarity(searchNorm, fermentableNorm) {
    // Malt characteristics and usage
    const maltCharacteristics = {
      'base': ['base', 'pale', 'pilsner', 'maris otter', 'two row', '2-row'],
      'specialty': ['crystal', 'caramel', 'chocolate', 'black', 'roasted', 'special'],
      'adjunct': ['flaked', 'torrified', 'rice', 'corn', 'oats', 'wheat'],
      'extract': ['extract', 'lme', 'dme', 'liquid', 'dry'],
      'roasted': ['roasted', 'black', 'chocolate', 'coffee'],
      'crystal': ['crystal', 'caramel', 'cara'],
      'wheat': ['wheat', 'weizen', 'white'],
      'munich': ['munich', 'amber', 'biscuit'],
      'smoked': ['smoked', 'rauch', 'beech']
    };
    
    let characteristicScore = 0;
    let matchedCharacteristics = 0;
    
    for (const [characteristic, keywords] of Object.entries(maltCharacteristics)) {
      const searchHasChar = keywords.some(keyword => searchNorm.includes(keyword));
      const fermentableHasChar = keywords.some(keyword => fermentableNorm.includes(keyword));
      
      if (searchHasChar && fermentableHasChar) {
        characteristicScore += 1;
        matchedCharacteristics++;
      }
    }
    
    return matchedCharacteristics > 0 ? characteristicScore / Object.keys(maltCharacteristics).length : 0;
  }

  getSimilarFermentables(ingredientName, existingFermentables) {
    const searchKeywords = extractKeywords(ingredientName);
    
    const similar = existingFermentables
      .map(fermentable => {
        const fermentableKeywords = extractKeywords(fermentable.name);
        let commonWords = 0;
        
        for (const searchWord of searchKeywords) {
          for (const fermentableWord of fermentableKeywords) {
            const distance = levenshteinDistance(searchWord, fermentableWord);
            const similarity = 1 - (distance / Math.max(searchWord.length, fermentableWord.length));
            if (similarity > 0.6) {
              commonWords++;
              break;
            }
          }
        }
        
        return {
          fermentable,
          commonWords,
          similarity: searchKeywords.length > 0 ? commonWords / searchKeywords.length : 0
        };
      })
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => ({
        name: item.fermentable.name,
        id: item.fermentable._id,
        similarity: item.similarity,
        color: item.fermentable.color || 'N/A'
      }));
  
    return similar;
  }

  // Main matching method - KEEP ONLY THIS ONE
  async findMatchingIngredients(invoiceIngredients) {
    const results = {};
    
    try {
      const [fermentables, hops, yeasts, miscs] = await Promise.all([
        this.getFermentables(),
        this.getHops(), 
        this.getYeasts(),
        this.getMiscs()
      ]);
      
      const invoiceHops = invoiceIngredients.filter(ing => ing.type === 'hop');
      const invoiceYeasts = invoiceIngredients.filter(ing => ing.type === 'yeast');
      const invoiceFermentables = invoiceIngredients.filter(ing => ing.type === 'fermentable');
      const otherIngredients = invoiceIngredients.filter(ing => !['hop', 'yeast', 'fermentable'].includes(ing.type));
      
      if (invoiceHops.length > 0) {
        const hopMatches = await this.matchHops(invoiceHops);
        Object.assign(results, hopMatches);
      }
      
      if (invoiceYeasts.length > 0) {
        const yeastMatches = await this.matchYeasts(invoiceYeasts);
        Object.assign(results, yeastMatches);
      }
      
      if (invoiceFermentables.length > 0) {
        const fermentableMatches = await this.matchFermentables(invoiceFermentables);
        Object.assign(results, fermentableMatches);
      }
      
      // Handle misc ingredients with basic matching
      for (const ingredient of otherIngredients) {
        const existingItems = miscs || [];
        
        let match = existingItems.find(item => 
          item.name && item.name.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        if (!match) {
          match = existingItems.find(item => 
            item.name && (
              item.name.toLowerCase().includes(ingredient.name.toLowerCase().substring(0, 15)) ||
              ingredient.name.toLowerCase().includes(item.name.toLowerCase().substring(0, 15))
            )
          );
        }
        
        if (match) {
          results[ingredient.name] = {
            found: true,
            brewfatherItem: match,
            confidence: match.name.toLowerCase() === ingredient.name.toLowerCase() ? 'high' : 'medium'
          };
        } else {
          const similar = existingItems.filter(item => {
            if (!item.name) return false;
            const itemWords = item.name.toLowerCase().split(/[\s-_]/);
            const ingredientWords = ingredient.name.toLowerCase().split(/[\s-_]/);
            return itemWords.some(word => 
              ingredientWords.some(iWord => 
                word.length > 3 && iWord.length > 3 && 
                (word.includes(iWord) || iWord.includes(word))
              )
            );
          }).slice(0, 3);
          
          results[ingredient.name] = {
            found: false,
            suggestions: similar.map(item => ({
              name: item.name,
              id: item._id
            }))
          };
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error finding matching ingredients:', error);
      throw error;
    }
  }
}
