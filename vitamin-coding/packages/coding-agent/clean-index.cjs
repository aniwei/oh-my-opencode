const fs = require('fs');
const filepath = 'src/modes/interactive/route/session/index.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// The `tools` are imported from `@/tool/` which is probably aliased to `@vitamin/tools` or it's a monorepo workspace.
// Since we have a `package.json` that contains `@vitamin/tools`, I assume `@/tool/` should be `@vitamin/tools` or its internal path.
// But some components might have been removed. Let's see what is inside `@/tool/`
