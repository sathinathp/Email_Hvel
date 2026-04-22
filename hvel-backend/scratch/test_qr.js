const qrcode = require('qrcode');
qrcode.toDataURL('otpauth://totp/HVEL:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=HVEL')
    .then(url => {
        console.log('Success! URL length:', url.length);
        console.log('Prefix:', url.substring(0, 50));
    })
    .catch(err => {
        console.error('Failure:', err);
    });
