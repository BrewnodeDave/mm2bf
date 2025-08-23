import axios from 'axios';

export class BrewfatherAPI {
  constructor(userId, apiKey) {
    if (!userId || !apiKey) {
      throw new Error('Brewfather User ID and API Key are required');
    }
    
    this.userId = userId;
    this.apiKey = apiKey;
    this.baseURL = 'https://api.brewfather.app/v2';
    
    // Create axios instance with authentication
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
    const results = [];
    
    // Get existing fermentables first
    const existingFermentables = await this.getFermentables();
    
    for (const fermentable of fermentables) {
      try {
        console.log(`Processing fermentable: ${fermentable.name}`);
        
        // Try to find existing item by name
        const existing = existingFermentables.find(item => 
          item.name && item.name.toLowerCase().includes(fermentable.name.toLowerCase().substring(0, 20))
        );
        
        if (existing) {
          // Read the actual current inventory amount
          const currentAmount = existing.inventory || 0;
          const adjustAmount = fermentable.amount || 0;
          const newTotalAmount = currentAmount + adjustAmount;
          
          console.log(`→ ${fermentable.name}: Current ${currentAmount}kg, Adding +${adjustAmount}kg`);
          
          // Update existing item using inventory_adjust
          const updateData = {
            inventory_adjust: adjustAmount
          };
          
          // Add cost if provided
          if (fermentable.cost) {
            updateData.cost = fermentable.cost;
            updateData.costUnit = 'GBP';
          }
          
          const response = await this.client.patch(`/inventory/fermentables/${existing._id}`, updateData);
          
          if (response.data === "Updated") {
            results.push({
              name: fermentable.name,
              success: true,
              action: 'adjusted',
              id: existing._id,
              currentAmount: currentAmount,  // Actual current amount from existing.inventory
              adjustedBy: adjustAmount,
              newAmount: newTotalAmount,
              unit: fermentable.unit || 'kg'
            });
          } else {
            if (response.data === "Nothing to update") {
              results.push({
                name: fermentable.name,
                success: false,
                action: 'error',
                error: 'API key has read-only permissions. Please generate a new API key with read/write permissions in Brewfather Settings → API Keys.'
              });
            } else {
              results.push({
                name: fermentable.name,
                success: false,
                action: 'error',
                error: `Unexpected API response: ${response.status} ${JSON.stringify(response.data)}`
              });
            }
          }
        } else {
          // Item not found in existing inventory
          results.push({
            name: fermentable.name,
            success: false,
            action: 'not_found',
            error: 'Item not found in Brewfather inventory. Add it manually first, then run this tool to update quantities.'
          });
        }
        
      } catch (error) {
        console.error(`Failed to update fermentable ${fermentable.name}:`, error.response?.data || error.message);
        results.push({
          name: fermentable.name,
          success: false,
          action: 'error',
          error: error.response?.data?.message || error.message
        });
      }
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
          const newTotalAmount = currentAmount + adjustAmount;
          
          console.log(`→ Current inventory: ${currentAmount}g`);
          console.log(`→ Adding: +${adjustAmount}g`);
          console.log(`→ New total will be: ${newTotalAmount}g`);
          
          // Update existing item using inventory_adjust
          const updateData = {
            inventory_adjust: adjustAmount
          };
          
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
              `/inventory/hops/${existing._id}?inventory_adjust=${adjustAmount}`,
              updateData
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
          const newTotalAmount = currentAmount + adjustAmount;
          
          console.log(`→ ${yeast.name}: Current ${currentAmount} pkg, Adding +${adjustAmount} pkg`);
          
          // Update existing item using inventory_adjust
          const updateData = {
            inventory_adjust: adjustAmount
          };
          
          // Add cost if provided
          if (yeast.cost) {
            updateData.cost = yeast.cost;
            updateData.costUnit = 'GBP';
          }
          
          const response = await this.client.patch(`/inventory/yeasts/${existing._id}`, updateData);
          
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
          const newTotalAmount = currentAmount + adjustAmount;
          
          console.log(`→ ${misc.name}: Current ${currentAmount}g, Adding +${adjustAmount}g`);
          
          // Update existing item using inventory_adjust
          const updateData = {
            inventory_adjust: adjustAmount
          };
          
          // Add cost if provided
          if (misc.cost) {
            updateData.cost = misc.cost;
            updateData.costUnit = 'GBP';
          }
          
          const response = await this.client.patch(`/inventory/miscs/${existing._id}`, updateData);
          
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

  // Helper methods to get existing inventory
  async getFermentables() {
    try {
      const response = await this.client.get('/inventory/fermentables');
      console.log('📦 FERMENTABLES API RESPONSE:', {
        count: response.data.length,
        sample: response.data.slice(0, 3).map(item => ({
          name: item.name,
          inventory: item.inventory,
          type: typeof item.inventory,
          allFields: Object.keys(item)
        }))
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get fermentables: ${error.response?.data?.message || error.message}`);
    }
  }

  async getHops() {
    try {
      const response = await this.client.get('/inventory/hops');
      console.log('Sample hop from API:', response.data[0]);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get hops: ${error.response?.data?.message || error.message}`);
    }
  }

  async getYeasts() {
    try {
      const response = await this.client.get('/inventory/yeasts');
      return response.data;
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

  // Enhanced method to search for ingredients and provide suggestions
  async findMatchingIngredients(ingredients) {
    const results = {};
    
    try {
      // Get all existing inventory
      const [fermentables, hops, yeasts, miscs] = await Promise.all([
        this.getFermentables(),
        this.getHops(), 
        this.getYeasts(),
        this.getMiscs()
      ]);
      
      const allInventory = {
        fermentable: fermentables,
        hop: hops,
        yeast: yeasts,
        misc: miscs
      };
      
      for (const ingredient of ingredients) {
        const type = ingredient.type;
        const existingItems = allInventory[type] || [];
        
        // Try exact name match first
        let match = existingItems.find(item => 
          item.name && item.name.toLowerCase() === ingredient.name.toLowerCase()
        );
        
        // Try partial name match
        if (!match) {
          match = existingItems.find(item => 
            item.name && (
              item.name.toLowerCase().includes(ingredient.name.toLowerCase().substring(0, 15)) ||
              ingredient.name.toLowerCase().includes(item.name.toLowerCase().substring(0, 15))
            )
          );
        }
        
        if (match) {
          // Brewfather API stores inventory amount directly in the 'inventory' field
          console.log('🔍 DEBUGGING INVENTORY CONVERSION:', {
            ingredientName: ingredient.name,
            matchName: match.name,
            rawInventory: match.inventory,
            typeOfInventory: typeof match.inventory
          });
          
          // Simple and direct conversion
          let currentAmount = 0;
          if (match.inventory !== null && match.inventory !== undefined) {
            currentAmount = Number(match.inventory) || 0;
          }
          
          console.log('✅ Final currentAmount:', currentAmount);
          
          console.log(`Found match for ${ingredient.name}:`, {
            name: match.name,
            originalInventoryField: match.inventory,
            currentAmount: currentAmount,
            type: typeof match.inventory,
            fullMatchObject: match
          });
          
          // Get the appropriate unit for this ingredient type
          let unit = 'units';
          switch (type) {
            case 'fermentable':
              unit = 'kg';
              break;
            case 'hop':
            case 'misc':
              unit = 'g';
              break;
            case 'yeast':
              unit = 'pkg';
              break;
          }
          
          const brewfatherItem = {
            ...match,
            currentAmount: currentAmount,
            unit: unit,
            // Create inventory object for frontend compatibility
            inventory: {
              amount: currentAmount,
              unit: unit
            },
            // Also keep the raw inventory value for debugging
            rawInventory: match.inventory
          };
          
          console.log(`Final brewfatherItem for ${ingredient.name}:`, {
            name: brewfatherItem.name,
            currentAmount: brewfatherItem.currentAmount,
            unit: brewfatherItem.unit,
            inventory: brewfatherItem.inventory,
            rawInventory: brewfatherItem.rawInventory
          });
          
          results[ingredient.name] = {
            found: true,
            brewfatherItem: brewfatherItem,
            confidence: match.name.toLowerCase() === ingredient.name.toLowerCase() ? 'high' : 'medium'
          };
        } else {
          // Find similar items for suggestions
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
      
      console.log('Final matching results:', JSON.stringify(results, null, 2));
      return results;
    } catch (error) {
      console.error('Error finding matching ingredients:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error;
    }
  }
}
