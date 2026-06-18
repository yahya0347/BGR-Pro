/**
 * Vercel Serverless Function: Secure remove.bg API Proxy
 */

const API_KEY = 'tLpSUjHq9fYYV9A1sMQw2ikS';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    // Call remove.bg API using the secure API Key
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

    // If 402/403/400 error occurs (e.g. no premium credits), auto-retry using 'preview' size
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
      return res.status(response.status).json({ error: 'Failed to process background removal', details: errorText });
    }

    // Read the binary response and convert to a Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the binary image content
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
