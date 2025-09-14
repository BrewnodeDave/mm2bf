# The Malt Miller to Brewfather Sync

A modern web application for extracting ingredients from Malt Miller invoices and syncing them with your Brewfather inventory.

## Features

🎯 **Modern Web Interface**
- Clean, responsive design with Tailwind CSS
- Step-by-step wizard interface
- Drag & drop PDF upload
- Selective syncing with checkboxes

📊 **Smart Analysis**
- Automatic ingredient parsing and categorization
- Intelligent matching with existing Brewfather inventory
- Visual match confidence indicators
- Select which items to sync

🔗 **Brewfather Integration**
- Brewfather v2 API integration
- Secure credential handling
- Real-time sync status
- Detailed sync results

## Quick Start

### 1. Deploy to Netlify
```bash
netlify deploy --prod
```

The application will be available at your Netlify domain.

### 2. Local Development
```bash
# Install dependencies
npm ci
cd webapp && npm ci
cd ../netlify/functions && npm ci
cd ../..

# Start local development
netlify dev
```

### 3. Usage Flow
1. Upload your Malt Miller PDF invoice
2. Enter your Brewfather API credentials
3. Review matched ingredients
4. Select items to sync (using checkboxes)
5. Click Sync to update Brewfather
 
## API Endpoints

The application provides Netlify Functions for all operations:

### `POST /.netlify/functions/parse`
Upload and parse a Malt Miller invoice PDF
- **Body**: multipart/form-data with `invoice` file
- **Returns**: Parsed invoice data with categorized ingredients

### `POST /.netlify/functions/test-connection`
Test Brewfather API credentials
- **Body**: `{ "userId": "...", "apiKey": "..." }`
- **Returns**: Connection status

### `POST /.netlify/functions/analyze-matches`
Analyze ingredient matches with Brewfather inventory
- **Body**: `{ "ingredients": [...], "userId": "...", "apiKey": "..." }`
- **Returns**: Detailed matching results

### `POST /.netlify/functions/sync`
Sync selected ingredients with Brewfather
- **Body**: `{ "ingredients": [...], "userId": "...", "apiKey": "..." }`
- **Returns**: Sync results by ingredient type

## Technology Stack

- **Frontend**: Vue.js 3 (CDN), Tailwind CSS
- **Backend**: Netlify Functions
- **PDF Processing**: pdf2json library
- **API Integration**: Brewfather v2 API

## Project Structure
```
/
├── netlify/
│   └── functions/        # Serverless functions
├── src/
│   ├── api/             # API integration code
│   ├── parsers/         # PDF parsing logic
│   └── mappers/         # Data transformation
└── webapp/
    └── static/          # Frontend assets
        ├── index.html   # Main SPA template
        └── app.js       # Vue.js application
```

## Development

### Environment Variables
Create a `.env` file:
```bash
BREWFATHER_USER_ID=your_user_id
BREWFATHER_API_KEY=your_api_key
```

### Adding Features
1. **New Function**: Add to `netlify/functions/`
2. **UI Changes**: Update `webapp/static/index.html` and `app.js`
3. **New Dependencies**: Update appropriate `package.json`

## Troubleshooting

### Common Issues

**"502 Bad Gateway"**
- Check Netlify Function logs
- Verify function dependencies are installed
- Check function timeout limits

**"Connection failed"**
- Verify Brewfather API credentials
- Ensure API key has required scopes

**"No items found in invoice"**
- Verify PDF is a Malt Miller invoice
- Check if PDF is text-based

### Debug Mode
```bash
# Start with debug logging
netlify dev
```
