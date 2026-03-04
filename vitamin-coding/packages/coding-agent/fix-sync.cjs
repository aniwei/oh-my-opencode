const fs = require('fs');
const filepath = 'src/modes/interactive/context/sync.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// The main issue in sync.tsx is `providers`, `providerList` variables.
// Let's see what is inside sync.tsx.
console.log(content.split('\n').filter(l => l.includes('providers')).map((l, i) => `${i}: ${l}`).join('\n'));

