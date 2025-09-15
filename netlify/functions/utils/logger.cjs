const axios = require('axios');

exports.logApiCall = async function logApiCall(functionName, event, result) {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      function: functionName,
      ip: event.headers['client-ip'] || event.headers['x-forwarded-for'],
      userAgent: event.headers['user-agent'],
      path: event.path,
      method: event.httpMethod,
      status_code: result?.statusCode,
      // Don't log sensitive data
      queryParams: event.queryStringParameters || {},
      // Hash the body to avoid logging sensitive information
      bodyHash: event.body ? hashBody(event.body) : null,
      result
    };

    // Send to your logging server
    await axios.post(process.env.LOGGING_API_URL, {
      ...logData,
      apiKey: process.env.LOGGING_API_KEY
    });

  } catch (error) {
    // Don't let logging errors affect the main function
    console.error('Logging error:', error.message);
  }
}

function hashBody(body) {
  // Simple hash function - replace with more secure one if needed
  let hash = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}