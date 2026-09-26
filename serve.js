const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = '/home/user/bob-xray/READY-TO-PASTE';
const types = { '.html':'text/html; charset=utf-8', '.md':'text/plain; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.js':'text/javascript' };
http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/' || p === '') p = '/index.html';
  const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, '0.0.0.0', () => console.log('Bob X-Ray dashboard serving on http://0.0.0.0:8080'));
