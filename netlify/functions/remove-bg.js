/**
 * Netlify Serverless Function: Secure remove.bg API Proxy
 */

const API_KEY = 'tLpSUjHq9fYYV9A1sMQw2ikS';

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { image } = JSON.parse(event.body);
    if (!image) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing image data' })
      };
    }

    // Call remove.bg API using the secure API Key (try 'auto' size first for high-res)
    let response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_file_b64: image,
        size: 'auto'
      })
    });

    // If 402/403/400 error occurs (e.g. no premium credits), auto-retry using 'preview' size (which uses free API calls)
    if (!response.ok && (response.status === 402 || response.status === 403 || response.status === 400)) {
      console.log('Retrying with size: preview due to premium credit limits...');
      response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_file_b64: image,
          size: 'preview'
        })
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('remove.bg API error:', errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to process background removal', details: errorText })
      };
    }

    // Read the binary response and convert to a Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the binary image content decoded back to the client
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Serverless function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
};
