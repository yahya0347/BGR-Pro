const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/"
});

dom.window.addEventListener("error", (event) => {
  console.error("JSDOM Error Caught:", event.error);
});
setTimeout(() => {
  console.log("JSDOM initialization completed successfully.");
}, 3000);
