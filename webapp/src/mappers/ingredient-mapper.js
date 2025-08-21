export class IngredientMapper {
  constructor() {
    this.fermentableKeywords = {
      base: ['pale', 'pilsner', 'maris otter', 'golden promise', 'lager', 'base'],
      crystal: ['crystal', 'caramel', 'cara'],
      chocolate: ['chocolate', 'brown'],
      black: ['black', 'roasted', 'patent'],
      wheat: ['wheat', 'weizen'],
      specialty: ['munich', 'vienna', 'amber', 'biscuit', 'victory', 'aromatic']
    };

    this.hopKeywords = [
      'hop', 'hops', 'pellet', 'pellets', 'leaf',
      // Common hop varieties
      'admiral', 'amarillo', 'cascade', 'centennial', 'chinook', 'citra', 'columbus',
      'fuggle', 'golding', 'hallertau', 'kent', 'liberty', 'magnum', 'northern',
      'nugget', 'perle', 'saaz', 'simcoe', 'sterling', 'tettnang', 'willamette'
    ];

    this.yeastKeywords = [
      'yeast', 'saccharomyces', 'brettanomyces', 'lactobacillus',
      'wyeast', 'white labs', 'fermentis', 'lallemand', 'mangrove',
      'nutrient', 'energizer', 'dap'
    ];

    this.waterMineralKeywords = [
      'gypsum', 'calcium', 'magnesium', 'sodium', 'chloride', 'sulfate',
      'acid', 'phosphoric', 'lactic', 'citric', 'campden',
      'potassium', 'metabisulfite', 'salt'
    ];

    this.clarifierKeywords = [
      'irish moss', 'whirlfloc', 'protofloc', 'clarity', 'fining',
      'gelatin', 'isinglass', 'bentonite'
    ];
  }

  async mapIngredients(items) {
    const mappedIngredients = [];

    for (const item of items) {
      const ingredient = await this.categorizeIngredient(item);
      if (ingredient) {
        mappedIngredients.push(ingredient);
      }
    }

    return mappedIngredients;
  }

  async categorizeIngredient(item) {
    const name = item.name.toLowerCase();
    
    // Determine ingredient type
    if (this.isFermentable(name)) {
      return this.mapFermentable(item);
    } else if (this.isHop(name)) {
      return this.mapHop(item);
    } else if (this.isYeast(name)) {
      return this.mapYeast(item);
    } else if (this.isWaterMineral(name) || this.isClarifier(name)) {
      return this.mapMisc(item);
    }

    // If we can't categorize it, treat it as misc
    console.warn(`Could not categorize ingredient: ${item.name}`);
    return this.mapMisc(item);
  }

  isFermentable(name) {
    // Exclude equipment and non-fermentable items
    const excludeWords = [
      'bag', 'liner', 'kettle', 'equipment', 'thermometer', 'hydrometer',
      'bottle', 'cap', 'cork', 'tube', 'valve', 'clamp', 'bucket'
    ];
    
    if (excludeWords.some(word => name.includes(word))) {
      return false;
    }
    
    const fermentableWords = [
      'malt', 'grain', 'wheat', 'barley', 'oats', 'rye', 'corn', 'rice',
      'pale', 'pilsner', 'munich', 'vienna', 'crystal', 'caramel',
      'chocolate', 'black', 'roasted', 'smoked', 'amber', 'base',
      'maris otter', 'golden promise', 'cara', 'special'
    ];
    
    return fermentableWords.some(word => name.includes(word));
  }

  isHop(name) {
    return this.hopKeywords.some(keyword => name.includes(keyword));
  }

  isYeast(name) {
    return this.yeastKeywords.some(keyword => name.includes(keyword));
  }

  isWaterMineral(name) {
    return this.waterMineralKeywords.some(keyword => name.includes(keyword));
  }

  isClarifier(name) {
    return this.clarifierKeywords.some(keyword => name.includes(keyword));
  }

  mapFermentable(item) {
    const name = item.name.toLowerCase();
    let subType = 'Base';
    let color = 2;
    
    // Determine fermentable subtype and color
    if (Object.keys(this.fermentableKeywords.crystal).some(word => name.includes(word))) {
      subType = 'Crystal';
      color = this.extractColorFromName(name) || 60;
    } else if (Object.keys(this.fermentableKeywords.chocolate).some(word => name.includes(word))) {
      subType = 'Roasted';
      color = 400;
    } else if (Object.keys(this.fermentableKeywords.black).some(word => name.includes(word))) {
      subType = 'Roasted';
      color = 500;
    } else if (Object.keys(this.fermentableKeywords.wheat).some(word => name.includes(word))) {
      subType = 'Wheat';
      color = 3;
    } else if (Object.keys(this.fermentableKeywords.specialty).some(word => name.includes(word))) {
      subType = 'Specialty';
      color = 10;
    }

    return {
      type: 'fermentable',
      name: item.name,
      subType,
      color,
      amount: this.convertToKg(item.quantity, item.unit),
      unit: 'kg',
      cost: this.calculateCostPerUnit(item.price, this.convertToKg(item.quantity, item.unit), 'kg'),
      supplier: 'Malt Miller',
      origin: this.extractOrigin(item.name),
      notes: `Imported from invoice. Original: ${item.rawLine}`
    };
  }

  mapHop(item) {
    const name = item.name.toLowerCase();
    let form = 'Pellet';
    
    if (name.includes('leaf') || name.includes('whole')) {
      form = 'Leaf';
    } else if (name.includes('extract')) {
      form = 'Extract';
    }

    return {
      type: 'hop',
      name: item.name,
      subType: form,
      form,
      alpha: this.extractAlphaFromName(item.name) || 5.0,
      amount: this.convertToGrams(item.quantity, item.unit),
      unit: 'g',
      cost: this.calculateCostPerUnit(item.price, this.convertToGrams(item.quantity, item.unit), 'g'),
      supplier: 'Malt Miller',
      origin: this.extractOrigin(item.name),
      notes: `Imported from invoice. Original: ${item.rawLine}`
    };
  }

  mapYeast(item) {
    const name = item.name.toLowerCase();
    let form = 'Dry';
    let subType = 'Ale';
    let laboratory = 'Unknown';
    
    if (name.includes('liquid')) {
      form = 'Liquid';
    }
    
    if (name.includes('lager')) {
      subType = 'Lager';
    } else if (name.includes('wheat') || name.includes('weizen')) {
      subType = 'Wheat';
    } else if (name.includes('wild') || name.includes('brett')) {
      subType = 'Wild';
    }
    
    // Extract laboratory/brand
    if (name.includes('wyeast')) {
      laboratory = 'Wyeast';
    } else if (name.includes('white labs')) {
      laboratory = 'White Labs';
    } else if (name.includes('fermentis')) {
      laboratory = 'Fermentis';
    } else if (name.includes('lallemand')) {
      laboratory = 'Lallemand';
    }

    const yeastUnit = this.isYeastNutrient(name) ? 'g' : 'pkg';
    const amountInBaseUnit = yeastUnit === 'g' ? 
      this.convertToGrams(item.quantity || 1, item.unit) : 
      (item.quantity || 1);

    return {
      type: 'yeast',
      name: item.name,
      subType,
      form,
      laboratory,
      productId: this.extractProductId(item.name),
      amount: amountInBaseUnit,
      unit: yeastUnit,
      cost: this.calculateCostPerUnit(item.price, amountInBaseUnit, yeastUnit),
      supplier: 'Malt Miller',
      notes: `Imported from invoice. Original: ${item.rawLine}`
    };
  }

  mapMisc(item) {
    const name = item.name.toLowerCase();
    let subType = 'Other';
    let use = 'Boil';
    
    if (this.isWaterMineral(name)) {
      subType = 'Water Agent';
      use = 'Mash';
    } else if (this.isClarifier(name)) {
      subType = 'Fining';
      use = 'Secondary';
    } else if (name.includes('acid')) {
      subType = 'Water Agent';
      use = 'Mash';
    } else if (name.includes('nutrient')) {
      subType = 'Yeast Nutrient';
      use = 'Primary';
    }

    const amountInGrams = this.convertToGrams(item.quantity, item.unit);

    return {
      type: 'misc',
      name: item.name,
      subType,
      use,
      amount: amountInGrams,
      unit: 'g',
      cost: this.calculateCostPerUnit(item.price, amountInGrams, 'g'),
      supplier: 'Malt Miller',
      notes: `Imported from invoice. Original: ${item.rawLine}`
    };
  }

  // Helper methods
  convertToKg(quantity, unit) {
    if (!quantity) return 0;
    
    switch (unit?.toLowerCase()) {
      case 'kg':
        return quantity;
      case 'g':
        return quantity / 1000;
      case 'lb':
        return quantity * 0.453592;
      case 'oz':
        return quantity * 0.0283495;
      default:
        return quantity; // Assume kg if unknown
    }
  }

  convertToGrams(quantity, unit) {
    if (!quantity) return 0;
    
    switch (unit?.toLowerCase()) {
      case 'g':
        return quantity;
      case 'kg':
        return quantity * 1000;
      case 'oz':
        return quantity * 28.3495;
      case 'lb':
        return quantity * 453.592;
      default:
        return quantity; // Assume grams if unknown
    }
  }

  extractColorFromName(name) {
    const colorMatch = name.match(/(\d+)l?(?:\s*ebc|\s*lovibond)?/i);
    return colorMatch ? parseInt(colorMatch[1]) : null;
  }

  extractAlphaFromName(name) {
    const alphaMatch = name.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:alpha|aa)/i);
    return alphaMatch ? parseFloat(alphaMatch[1]) : null;
  }

  extractOrigin(name) {
    const origins = [
      'german', 'english', 'american', 'uk', 'usa', 'czech', 'belgian',
      'new zealand', 'australian', 'slovenian', 'french'
    ];
    
    const lowerName = name.toLowerCase();
    for (const origin of origins) {
      if (lowerName.includes(origin)) {
        return origin.charAt(0).toUpperCase() + origin.slice(1);
      }
    }
    
    return 'Unknown';
  }

  extractProductId(name) {
    // Try to extract product ID from yeast names (e.g., "WLP001", "US-05", "Wyeast 1056")
    const idMatch = name.match(/(?:WLP|US-|BE-|K-97|S-|Wyeast\s+)(\d+)/i);
    return idMatch ? idMatch[0] : '';
  }

  isYeastNutrient(name) {
    return name.includes('nutrient') || name.includes('energizer') || name.includes('dap');
  }

  calculateCostPerUnit(totalPrice, amount, unit) {
    if (!totalPrice || !amount || amount === 0) {
      return 0;
    }
    
    // Calculate cost per unit
    const costPerUnit = totalPrice / amount;
    
    // Round to 4 decimal places for precision
    return Math.round(costPerUnit * 10000) / 10000;
  }
}
