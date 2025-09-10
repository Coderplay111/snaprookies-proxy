const axios = require('axios');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  try {
    const { queryStringParameters } = event;
    const downloadUrl = queryStringParameters?.url;
    const filename = queryStringParameters?.filename || 'download';
    const type = queryStringParameters?.type || 'video';

    if (!downloadUrl) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Download URL is required' }),
      };
    }

    console.log('Fetching:', downloadUrl);

    // Fetch the actual file from the external URL with proper headers and redirect handling
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 30000, // 30 second timeout
    });
    
    if (response.status !== 200) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    // Detect content type from response headers or infer from type parameter
    let contentType = response.headers['content-type'] || 'application/octet-stream';
    let extension = '';
    
    if (type === 'video') {
      extension = '.mp4';
      if (!contentType.includes('video')) {
        contentType = 'video/mp4';
      }
    } else if (type === 'audio') {
      extension = '.mp3';
      if (!contentType.includes('audio')) {
        contentType = 'audio/mpeg';
      }
    } else if (type === 'photo') {
      extension = '.jpg';
      if (!contentType.includes('image')) {
        contentType = 'image/jpeg';
      }
    }

    // Create safe filename
    const safeFilename = filename
      .replace(/[\r\n\t]/g, ' ')  // Replace newlines, carriage returns, and tabs with spaces
      .replace(/[^a-zA-Z0-9-_\s.]/g, '_')  // Replace invalid characters with underscores
      .replace(/\s+/g, '_')  // Replace multiple spaces with single underscore
      .replace(/_+/g, '_')  // Replace multiple underscores with single underscore
      .replace(/^_+|_+$/g, '')  // Remove leading and trailing underscores
      .substring(0, 100)  // Limit filename length to 100 characters
      + extension;

    // Convert ArrayBuffer to base64 for Netlify Functions
    const buffer = Buffer.from(response.data);
    const base64Data = buffer.toString('base64');

    // Return response with proper download headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache',
      },
      body: base64Data,
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('Download proxy error:', error);
    
    let errorMessage = 'Failed to download file';
    let statusCode = 500;
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to download source';
      statusCode = 502;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Download request timed out';
      statusCode = 504;
    } else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = `Download source returned error: ${error.response.status}`;
    }
    
    return {
      statusCode: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: error.message || 'Unknown error',
        timestamp: new Date().toISOString()
      }),
    };
  }
};
