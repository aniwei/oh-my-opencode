const fs = require('fs');
const filepath = 'src/modes/interactive/components/Prompt/index.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// remove local.promptWarning because it seems totally missing or we should default to false
content = content.replace(/local\.promptWarning/g, "false /* local.promptWarning */");

fs.writeFileSync(filepath, content);
