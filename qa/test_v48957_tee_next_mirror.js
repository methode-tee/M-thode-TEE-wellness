const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const web = fs.readFileSync(path.join(root, 'tee-next.html'), 'utf8');
const native = fs.readFileSync(path.join(root, 'www', 'tee-next.html'), 'utf8');

if (!native.trim()) throw new Error('www/tee-next.html est vide');
if (web !== native) throw new Error('Les copies Web et iOS de tee-next.html diffèrent');

console.log(JSON.stringify({
  status: 'ok',
  version: 'V489.5.7',
  tee_next_web_ios_mirror: true,
  runtime_changed: false,
  database_changed: false
}, null, 2));
