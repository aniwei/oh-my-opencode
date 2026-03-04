const fs = require('fs');
const filepath = 'src/modes/interactive/components/Prompt/index.tsx';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/status/g, "sync.status"); // This is dangerous, so let's use regex
content = content.replace(/\(status as any\)/g, "(sync.status as any)");
content = content.replace(/typeof status/g, "typeof sync.status");
content = content.replace(/\(status as string\)/g, "(sync.status as string)");
content = content.replace(/status !==/g, "sync.status !==");
fs.writeFileSync(filepath, content);
