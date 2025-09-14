import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { InvoiceParser } from '../src/parsers/invoice-parser.js';
import { IngredientMapper } from '../src/mappers/ingredient-mapper.js';
import { BrewfatherAPI } from '../src/api/brewfather-api.js';
import { InventoryReporter } from '../src/reports/inventory-reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize services
const parser = new InvoiceParser();
const mapper = new IngredientMapper();
const reporter = new InventoryReporter();

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Parse invoice PDF
app.post('/.netlify/functions/parse', upload.single('invoice'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`Processing uploaded file: ${req.file.originalname}`);
    
    // Parse the PDF
    const invoiceData = await parser.parsePDF(req.file.path);
    
    if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
      return res.status(400).json({ error: 'No items found in invoice' });
    }

    // Map ingredients
    const mappedIngredients = await mapper.mapIngredients(invoiceData.items);
    
    // Generate report
    const reportData = {
      invoice: invoiceData,
      ingredients: mappedIngredients,
      summary: generateSummary(mappedIngredients),
      timestamp: new Date().toISOString()
    };

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json(reportData);
    
  } catch (error) {
    console.error('Error parsing invoice:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Test Brewfather connection
app.post('/.netlify/functions/test-connection', async (req, res) => {
  try {
    const { userId, apiKey } = req.body;
    
    if (!userId || !apiKey) {
      return res.status(400).json({ error: 'User ID and API Key are required' });
    }

    const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
    const result = await brewfatherAPI.testConnection();
    
    res.json(result);
    
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze ingredient matches
app.post('/.netlify/functions/analyze-matches', async (req, res) => {
  try {
    const { ingredients, userId, apiKey } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }
    
    if (!userId || !apiKey) {
      return res.status(400).json({ error: 'Brewfather credentials are required' });
    }

    const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
    const matches = await brewfatherAPI.findMatchingIngredients(ingredients);
    
    res.json({ matches });
    
  } catch (error) {
    console.error('Error analyzing matches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync with Brewfather
app.post('/.netlify/functions/sync', async (req, res) => {
  try {
    const { ingredients, userId, apiKey } = req.body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }
    
    if (!userId || !apiKey) {
      return res.status(400).json({ error: 'Brewfather credentials are required' });
    }

    const brewfatherAPI = new BrewfatherAPI(userId, apiKey);
    
    // Group ingredients by type
    const groupedIngredients = ingredients.reduce((groups, ingredient) => {
      const type = ingredient.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(ingredient);
      return groups;
    }, {});

    const results = {};
    
    // Update each type
    for (const [type, typeIngredients] of Object.entries(groupedIngredients)) {
      try {
        switch (type) {
          case 'fermentable':
            results[type] = await brewfatherAPI.updateFermentables(typeIngredients);
            break;
          case 'hop':
            results[type] = await brewfatherAPI.updateHops(typeIngredients);
            break;
          case 'yeast':
            results[type] = await brewfatherAPI.updateYeasts(typeIngredients);
            break;
          case 'misc':
            results[type] = await brewfatherAPI.updateMiscs(typeIngredients);
            break;
        }
      } catch (error) {
        console.error(`Error updating ${type} ingredients:`, error);
        results[type] = { error: error.message };
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error('Error syncing with Brewfather:', error);
    res.status(500).json({ error: error.message });
  }
});


// Serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// Helper functions
function generateSummary(ingredients) {
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
        totalCost: 0
      };
    }
    
    summary.byType[type].count++;
    if (ingredient.cost) {
      summary.byType[type].totalCost += (ingredient.cost * ingredient.amount);
      summary.totalCost += (ingredient.cost * ingredient.amount);
    }
  });

  return summary;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Route ${req.url} not found` });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.listen(port, () => {
  console.log(`🍺 Malt Miller Webapp running on http://localhost:${port}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'static')}`);
});
