const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (err) => {
  console.error("JSDOM Error:", err);
});
virtualConsole.on("jsdomError", (err) => {
  console.error("JSDOM jsdomError:", err);
});
virtualConsole.sendTo(console);

const html = fs.readFileSync('editor.html', 'utf8');

// We need to inject a script to catch unhandled rejections
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  resources: "usable",
  url: "http://localhost/",
  virtualConsole
});

dom.window.addEventListener("error", (event) => {
  console.error("Window Error:", event.error);
});
