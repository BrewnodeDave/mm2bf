# Malt Miller to Brewfather Sync - Web Application

A modern single-page application (SPA) for extracting ingredients from Malt Miller invoices and syncing them with your Brewfather inventory.

## Features

🎯 **Modern Web Interface**
- Clean, responsive design with Tailwind CSS
- Step-by-step wizard interface
- Real-time progress indicators
- Drag & drop PDF upload

📊 **Smart Analysis**
- Automatic ingredient parsing and categorization
- Cost per unit calculations
- Intelligent matching with existing Brewfather inventory
- Visual match confidence indicators

🔗 **Brewfather Integration**
- Brewfather v2 API integration
- Secure credential handling
- Real-time sync status
- Detailed sync results

📁 **Export Options**
- Multiple report formats (JSON, CSV, Brewfather CSV)
- Instant download functionality
- Detailed cost breakdowns

## Quick Start

### 1. Start the Web Application
```bash
# From the main project directory
npm run webapp-dev

# Or directly from webapp directory
cd webapp
npm run dev
```

The application will be available at `http://localhost:3000`

### 2. Upload Your Invoice
- Drag and drop your Malt Miller PDF invoice
- Or click to browse and select the file
- The app automatically parses and categorizes ingredients

### 3. Analyze Matches (Optional)
- Enter your Brewfather API credentials
- Test the connection
- Analyze which ingredients match your existing inventory
- See detailed matching results with confidence levels

### 4. Sync or Download
- **Sync**: Automatically update your Brewfather inventory
- **Download**: Get detailed reports for manual import

## API Endpoints

The webapp provides a REST API that can be used independently:

### `POST /api/parse`
Upload and parse a Malt Miller invoice PDF
- **Body**: multipart/form-data with `invoice` file
- **Returns**: Parsed invoice data with categorized ingredients

### `POST /api/test-connection`
Test Brewfather API credentials
- **Body**: `{ "userId": "...", "apiKey": "..." }`
- **Returns**: Connection status

### `POST /api/analyze-matches`
Analyze ingredient matches with Brewfather inventory
- **Body**: `{ "ingredients": [...], "userId": "...", "apiKey": "..." }`
- **Returns**: Detailed matching results

### `POST /api/sync`
Sync ingredients with Brewfather
- **Body**: `{ "ingredients": [...], "userId": "...", "apiKey": "..." }`
- **Returns**: Sync results by ingredient type

### `POST /api/generate-reports`
Generate downloadable reports
- **Body**: `{ "invoiceData": {...}, "ingredients": [...] }`
- **Returns**: Report files in multiple formats

## Technology Stack

- **Frontend**: Vue.js 3 (CDN), Tailwind CSS, Font Awesome
- **Backend**: Express.js with ES modules
- **File Upload**: Multer middleware
- **PDF Processing**: pdf2json library
- **API Integration**: Brewfather v2 API

## Development

### Project Structure
```
webapp/
├── package.json          # Dependencies and scripts
├── server.js            # Express server with API routes
└── public/
    ├── index.html       # Main SPA template
    └── app.js          # Vue.js application logic
```

### Environment Variables
The webapp inherits configuration from the main project's `.env` file:
```bash
BREWFATHER_USER_ID=your_user_id
BREWFATHER_API_KEY=your_api_key
```

### Adding Features
1. **New API Endpoint**: Add route in `server.js`
2. **UI Changes**: Update `public/index.html` and `public/app.js`
3. **New Dependencies**: Update `webapp/package.json`

## Security Considerations

- API credentials are only stored in memory during the session
- File uploads are limited to 10MB PDFs only
- Uploaded files are automatically deleted after processing
- CORS enabled for development (configure for production)

## Production Deployment

For production deployment:

1. **Set Environment**: `NODE_ENV=production`
2. **Configure CORS**: Update allowed origins in `server.js`
3. **Reverse Proxy**: Use nginx or similar for SSL/static files
4. **Process Manager**: Use PM2 or similar for process management

```bash
# Production start
npm run start

# Or with PM2
pm2 start webapp/server.js --name "malt-miller-webapp"
```

## Troubleshooting

### Common Issues

**"No PDF files found"**
- Ensure you're uploading a valid PDF file
- Check file size (10MB limit)

**"Connection failed"**
- Verify Brewfather API credentials
- Check User ID and API Key format
- Ensure API key has required scopes (Read/Edit Inventory)

**"No items found in invoice"**
- Verify PDF is a Malt Miller invoice
- Check if PDF is text-based (not scanned image)

### Debug Mode
```bash
# Start with debug logging
DEBUG=* npm run webapp-dev
```

## Integration with CLI Tools

The webapp complements the CLI tools:

- **Web Interface**: User-friendly, visual feedback
- **CLI Tools**: Automation, batch processing, scripting

Both use the same core parsing and API logic, ensuring consistent results.
