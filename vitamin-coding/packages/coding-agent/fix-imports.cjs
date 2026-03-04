const fs = require('fs');
const filepath = 'src/modes/interactive/route/session/index.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// The file has a bunch of paths for `../../component` that should be `../../components` 
content = content.replace(/\.\.\/\.\.\/component/g, "../../components");

// Also `@opencode-ai/sdk/v2` should probably be `@opencode-ai/sdk` if installed or we need to replace it.
content = content.replace(/'@opencode-ai\/sdk\/v2'/g, "'@vitamin/sdk/v2'"); // Or anything that fits. Let's see later. Currently we might not even need it.

fs.writeFileSync(filepath, content);
