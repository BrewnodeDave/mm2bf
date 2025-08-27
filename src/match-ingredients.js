#!/usr/bin/env node

import { BrewfatherAPI } from './api/brewfather-api.js';
import { InvoiceParser } from './parsers/invoice-parser.js';
import { IngredientMapper } from './mappers/ingredient-mapper.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

class IngredientMatcher {
  constructor() {
    this.brewfatherAPI = new BrewfatherAPI(
      process.env.BREWFATHER_USER_ID,
      process.env.BREWFATHER_API_KEY
    );
    this.parser = new InvoiceParser();
    this.mapper = new IngredientMapper();
  }

  async analyzeInvoice(pdfPath) {
    try {
      console.log('🔍 Analyzing invoice and matching with Brewfather inventory...\n');
      
      // Parse invoice
      const invoiceData = await this.parser.parsePDF(pdfPath);
      console.log(`📄 Raw invoice data:`, invoiceData);
      
      if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
        console.error('❌ No items found in invoice');
        return;
      }
      
      const mappedIngredients = await this.mapper.mapIngredients(invoiceData.items);
      console.log(`📄 Mapped ingredients:`, mappedIngredients);
      
      if (!mappedIngredients || mappedIngredients.length === 0) {
        console.error('❌ No valid ingredients found after mapping');
        return;
      }
      
      console.log(`📄 Found ${mappedIngredients.length} ingredients in invoice\n`);
      
      // Use enhanced matching with separate type-specific matching
      const matches = await this.performEnhancedMatching(mappedIngredients);
      
      // Display results
      this.displayMatches(matches, mappedIngredients);
      
      // Generate suggestions for unmatched items
      await this.generateSuggestions(matches, mappedIngredients);
      
    } catch (error) {
      console.error('Error analyzing invoice:', error);
      throw error;
    }
  }

  async performEnhancedMatching(mappedIngredients) {
    console.log('🎯 Starting enhanced ingredient matching...\n');
    
    // Separate ingredients by type for optimized matching
    const ingredientsByType = {
      hop: mappedIngredients.filter(ing => ing.type === 'hop'),
      yeast: mappedIngredients.filter(ing => ing.type === 'yeast'),
      fermentable: mappedIngredients.filter(ing => ing.type === 'fermentable'),
      misc: mappedIngredients.filter(ing => ing.type === 'misc')
    };
    
    console.log('📊 Ingredient breakdown:');
    Object.entries(ingredientsByType).forEach(([type, items]) => {
      if (items.length > 0) {
        console.log(`  ${type}: ${items.length} items`);
      }
    });
    console.log('');
    
    const allMatches = {};
    
    try {
      // Use enhanced hop matching
      if (ingredientsByType.hop.length > 0) {
        console.log('🌿 Matching hops with enhanced algorithm...');
        const hopMatches = await this.brewfatherAPI.matchHops(ingredientsByType.hop);
        Object.assign(allMatches, hopMatches);
        console.log(`   Found ${Object.values(hopMatches).filter(m => m.found).length}/${ingredientsByType.hop.length} hop matches\n`);
      }
      
      // Use enhanced yeast matching
      if (ingredientsByType.yeast.length > 0) {
        console.log('🍺 Matching yeasts with enhanced algorithm...');
        const yeastMatches = await this.brewfatherAPI.matchYeasts(ingredientsByType.yeast);
        Object.assign(allMatches, yeastMatches);
        console.log(`   Found ${Object.values(yeastMatches).filter(m => m.found).length}/${ingredientsByType.yeast.length} yeast matches\n`);
      }
      
      // Use enhanced fermentable matching
      if (ingredientsByType.fermentable.length > 0) {
        console.log('🍞 Matching fermentables with enhanced algorithm...');
        const fermentableMatches = await this.brewfatherAPI.matchFermentables(ingredientsByType.fermentable);
        Object.assign(allMatches, fermentableMatches);
        console.log(`   Found ${Object.values(fermentableMatches).filter(m => m.found).length}/${ingredientsByType.fermentable.length} fermentable matches\n`);
      }
      
      // Use enhanced misc item matching
      if (ingredientsByType.misc.length > 0) {
        console.log('📦 Matching misc items with enhanced algorithm...');
        const miscMatches = await this.brewfatherAPI.matchMiscs(ingredientsByType.misc);
        Object.assign(allMatches, miscMatches);
        console.log(`   Found ${Object.values(miscMatches).filter(m => m.found).length}/${ingredientsByType.misc.length} misc matches\n`);
      }
      
    } catch (error) {
      console.error('Error during enhanced matching:', error);
    }
    
    return allMatches;
  }

  displayMatches(matches, ingredients) {
    console.log('🎯 INGREDIENT MATCHING RESULTS\n');
    console.log('=' .repeat(60));
    
    let exactMatches = 0;
    let partialMatches = 0;
    let noMatches = 0;
    
    for (const ingredient of ingredients) {
      const match = matches[ingredient.name];
      
      if (match?.found) {
        if (match.confidence === 'high') {
          console.log(`✅ EXACT MATCH: ${ingredient.name}`);
          console.log(`   → Brewfather: ${match.brewfatherItem.name}`);
          console.log(`   → Current stock: ${match.brewfatherItem.inventory?.amount || 0} ${match.brewfatherItem.inventory?.unit || 'units'}`);
          console.log(`   → Will add: ${ingredient.amount} ${ingredient.unit}`);
          exactMatches++;
        } else {
          console.log(`🟡 PARTIAL MATCH: ${ingredient.name}`);
          console.log(`   → Brewfather: ${match.brewfatherItem.name}`);
          console.log(`   → Current stock: ${match.brewfatherItem.inventory?.amount || 0} ${match.brewfatherItem.inventory?.unit || 'units'}`);
          console.log(`   → Will add: ${ingredient.amount} ${ingredient.unit}`);
          console.log(`   → ⚠️  Please verify this is the correct item`);
          partialMatches++;
        }
      } else {
        console.log(`❌ NO MATCH: ${ingredient.name}`);
        console.log(`   → Type: ${ingredient.type}`);
        console.log(`   → Amount: ${ingredient.amount} ${ingredient.unit}`);
        console.log(`   → Cost: £${ingredient.cost?.toFixed(2) || 'N/A'}`);
        
        if (match?.suggestions?.length > 0) {
          console.log(`   → Similar items in Brewfather:`);
          match.suggestions.forEach(suggestion => {
            console.log(`     • ${suggestion.name}`);
          });
        } else {
          console.log(`   → No similar items found in Brewfather`);
        }
        noMatches++;
      }
      console.log('');
    }
    
    console.log('📊 SUMMARY');
    console.log('-' .repeat(30));
    console.log(`Exact matches: ${exactMatches}`);
    console.log(`Partial matches: ${partialMatches} (verify before updating)`);
    console.log(`No matches: ${noMatches} (add to Brewfather manually first)`);
    console.log('');
  }

  async generateSuggestions(matches, ingredients) {
    const unmatchedByType = {};
    
    for (const ingredient of ingredients) {
      const match = matches[ingredient.name];
      if (!match?.found) {
        if (!unmatchedByType[ingredient.type]) {
          unmatchedByType[ingredient.type] = [];
        }
        unmatchedByType[ingredient.type].push(ingredient);
      }
    }
    
    if (Object.keys(unmatchedByType).length === 0) {
      console.log('🎉 All ingredients matched! You can run the sync now.');
      return;
    }
    
    console.log('📝 RECOMMENDATIONS');
    console.log('=' .repeat(60));
    console.log('To sync these ingredients, you need to:');
    console.log('');
    
    for (const [type, items] of Object.entries(unmatchedByType)) {
      console.log(`📋 ${type.toUpperCase()}S (${items.length} items):`);
      console.log(`1. Log into Brewfather web app`);
      console.log(`2. Go to Inventory → ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      console.log(`3. Add these items manually:`);
      console.log('');
      
      items.forEach(item => {
        console.log(`   • ${item.name}`);
        console.log(`     Amount: ${item.amount} ${item.unit}`);
        if (item.cost) {
          console.log(`     Cost: £${item.cost.toFixed(2)}`);
          console.log(`     Cost per ${item.unit}: £${(item.cost / item.amount).toFixed(4)}`);
        }
        console.log('');
      });
    }
    
    console.log('After adding the missing items to Brewfather, run:');
    console.log('  npm run sync');
    console.log('');
    console.log('Or to just extract costs without syncing:');
    console.log('  npm run extract');
  }

  async listBrewfatherInventory() {
    try {
      console.log('📦 BREWFATHER INVENTORY\n');
      
      const [fermentables, hops, yeasts, miscs] = await Promise.all([
        this.brewfatherAPI.getFermentables(),
        this.brewfatherAPI.getHops(),
        this.brewfatherAPI.getYeasts(),
        this.brewfatherAPI.getMiscs()
      ]);
      
      const sections = [
        { name: 'FERMENTABLES', items: fermentables },
        { name: 'HOPS', items: hops },
        { name: 'YEASTS', items: yeasts },
        { name: 'MISC', items: miscs }
      ];
      
      for (const section of sections) {
        console.log(`${section.name} (${section.items.length} items):`);
        console.log('-'.repeat(40));
        
        if (section.items.length === 0) {
          console.log('  No items found\n');
          continue;
        }
        
        section.items.forEach(item => {
          const amount = item.inventory?.amount || 0;
          const unit = item.inventory?.unit || 'units';
          console.log(`  • ${item.name}`);
          console.log(`    Stock: ${amount} ${unit}`);
          if (item.cost) {
            console.log(`    Cost: £${item.cost} per ${item.costUnit || unit}`);
          }
        });
        console.log('');
      }
      
    } catch (error) {
      console.error('Error fetching Brewfather inventory:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const matcher = new IngredientMatcher();
  
  try {
    if (command === 'list') {
      await matcher.listBrewfatherInventory();
      return;
    }
    
    // Check for PDF files
    const currentDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
    const files = fs.readdirSync(currentDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in the current directory');
      console.log('\nUsage:');
      console.log('  npm run match        - Analyze PDF invoices for ingredient matching');
      console.log('  npm run match list   - List all items in Brewfather inventory');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} PDF file(s): ${pdfFiles.join(', ')}\n`);
    
    // Process each PDF file
    for (const pdfFile of pdfFiles) {
      const pdfPath = path.join(currentDir, pdfFile);
      console.log(`Processing: ${pdfFile}`);
      await matcher.analyzeInvoice(pdfPath);
    }
    
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { IngredientMatcher };
