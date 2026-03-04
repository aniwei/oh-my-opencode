const fs = require('fs');
const filepath = 'src/modes/interactive/components/Prompt/index.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/useSDK\(\)/g, "useSync()");
content = content.replace(/sdk\./g, "sync.");
content = content.replace(/promptModelWarning/g, "useLocal().promptModelWarning");
content = content.replace(/import { useSync } from "\.\.\/\.\.\/context\/sync";/, "import { useSyncStore } from '../../context/sync';\nimport { useSDK } from '../../hooks/useSDK';");
fs.writeFileSync(filepath, content);
