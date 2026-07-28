const dns = require('dns');

dns.resolveTxt('attest.page', (err, records) => {
  if (err) {
    console.error('DNS Lookup Error:', err);
  } else {
    console.log('TXT Records for attest.page:');
    records.forEach(record => {
      console.log(record.join(' '));
    });
  }
});
