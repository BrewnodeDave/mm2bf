import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class InventoryReporter {
  constructor() {
    this.reports = [];
  }

  generateReport(invoiceData, mappedIngredients) {
    const report = {
      invoice: {
        number: invoiceData.invoiceNumber,
        date: invoiceData.date,
        total: invoiceData.total
      },
      ingredients: mappedIngredients,
      summary: this.generateSummary(mappedIngredients),
      timestamp: new Date().toISOString()
    };

    this.reports.push(report);
    return report;
  }

  generateSummary(ingredients) {
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
          totalCost: 0,
          items: []
        };
      }

      const itemCost = (ingredient.cost || 0) * (ingredient.amount || 0);
      summary.byType[type].count++;
      summary.byType[type].totalCost += itemCost;
      summary.totalCost += itemCost;
      
      summary.byType[type].items.push({
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        costPerUnit: ingredient.cost,
        totalCost: itemCost
      });
    });

    return summary;
  }

  exportToCSV(invoiceData, mappedIngredients) {
    const headers = [
      'Type',
      'Name',
      'Quantity',
      'Unit', 
      'Cost per Unit (£)',
      'Total Cost (£)',
      'Supplier',
      'Notes'
    ];

    const rows = mappedIngredients.map(ingredient => [
      ingredient.type,
      ingredient.name,
      ingredient.amount || 0,
      ingredient.unit || '',
      (ingredient.cost || 0).toFixed(4),
      ((ingredient.cost || 0) * (ingredient.amount || 0)).toFixed(2),
      ingredient.supplier || 'Malt Miller',
      ingredient.notes || ''
    ]);

    const csvContent = [
      `# Malt Miller Invoice ${invoiceData.invoiceNumber} - ${invoiceData.date}`,
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  exportToBrewfatherCSV(mappedIngredients) {
    // Format for Brewfather inventory import (if supported)
    const headers = [
      'Type',
      'Name',
      'Amount',
      'Unit',
      'Cost',
      'Cost Unit',
      'Supplier'
    ];

    const rows = mappedIngredients.map(ingredient => [
      ingredient.type,
      ingredient.name,
      ingredient.amount || 0,
      ingredient.unit || '',
      ingredient.cost || 0,
      'GBP',
      ingredient.supplier || 'Malt Miller'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  saveReport(invoiceData, mappedIngredients, outputDir = '.') {
    const report = this.generateReport(invoiceData, mappedIngredients);
    const timestamp = new Date().toISOString().slice(0, 10);
    const invoiceNum = invoiceData.invoiceNumber || 'unknown';
    
    // Save JSON report
    const jsonFilename = `malt-miller-${invoiceNum}-${timestamp}.json`;
    const jsonPath = path.join(outputDir, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    // Save CSV report
    const csvContent = this.exportToCSV(invoiceData, mappedIngredients);
    const csvFilename = `malt-miller-${invoiceNum}-${timestamp}.csv`;
    const csvPath = path.join(outputDir, csvFilename);
    fs.writeFileSync(csvPath, csvContent);
    
    // Save Brewfather-compatible CSV
    const brewfatherCSV = this.exportToBrewfatherCSV(mappedIngredients);
    const brewfatherFilename = `brewfather-inventory-${invoiceNum}-${timestamp}.csv`;
    const brewfatherPath = path.join(outputDir, brewfatherFilename);
    fs.writeFileSync(brewfatherPath, brewfatherCSV);

    return {
      jsonPath,
      csvPath,
      brewfatherPath,
      report
    };
  }

  printSummary(report) {
    console.log('\n📊 INVENTORY REPORT');
    console.log('==================');
    console.log(`Invoice: ${report.invoice.number} (${report.invoice.date})`);
    console.log(`Total Items: ${report.summary.totalItems}`);
    console.log(`Total Cost: £${report.summary.totalCost.toFixed(2)}`);
    
    console.log('\nBy Category:');
    Object.entries(report.summary.byType).forEach(([type, data]) => {
      console.log(`\n${type.toUpperCase()} (${data.count} items - £${data.totalCost.toFixed(2)}):`);
      data.items.forEach(item => {
        console.log(`  • ${item.name}`);
        console.log(`    ${item.amount} ${item.unit} @ £${item.costPerUnit.toFixed(4)}/${item.unit} = £${item.totalCost.toFixed(2)}`);
      });
    });
  }
}
