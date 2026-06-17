const https = require('https');

function checkUrl(url) {
  return new Promise((resolve) => {
    console.log(`Checking ${url} ...`);
    https.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
      });
      res.on('end', () => {
        console.log(`Downloaded size: ${size} bytes`);
        resolve({ statusCode: res.statusCode, size });
      });
    }).on('error', (err) => {
      console.error(`Error:`, err.message);
      resolve({ error: err.message });
    });
  });
}

(async () => {
  await checkUrl('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js');
  await checkUrl('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js');
})();
