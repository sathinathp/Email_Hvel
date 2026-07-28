const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('audit-log') || line.includes('audit_log') || line.includes('/api/audit')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
