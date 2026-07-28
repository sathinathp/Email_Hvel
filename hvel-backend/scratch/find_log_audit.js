const fs = require('fs');
const path = require('path');

['outlook.js', 'content.js'].forEach(file => {
  const filePath = path.join(__dirname, '../../hvel-extension', file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('function logAuditEvent') || line.includes('logAuditEvent =') || line.includes('logAuditEvent(')) {
      console.log(`${file}:${idx + 1}: ${line}`);
    }
  });
});
