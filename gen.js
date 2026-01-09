const jwt = require('jsonwebtoken');

// 1. ВСТАВЬ СЮДА СВОЙ СЕКРЕТ (обычный, из дашборда Supabase)
const secret = 'ТВОЙ_СЕКРЕТ_ЗДЕСЬ'; 

// 2. ПРИДУМАЙ И ВСТАВЬ СЮДА KID (например 'supa-key-1')
// Этот же KID нужно будет вписать в настройки PowerSync!
const kid = 'supa-key-1'; 

const payload = {
  sub: 'admin-permanent',
  role: 'service_role',
  iss: 'supabase',
  aud: 'authenticated'
};

const token = jwt.sign(payload, secret, { 
  expiresIn: '100y', 
  algorithm: 'HS256',
  header: { kid: kid } 
});

console.log('--- GENERATED TOKEN ---');
console.log(token);
console.log('--- END ---');

// ПОДСКАЗКА ДЛЯ BASE64URL:
// Чтобы получить секрет для вставки в PowerSync (Secret base64url encoded),
// раскомментируй и запусти этот кусок:

/*
const base64urlSecret = Buffer.from(secret).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
console.log('--- SECRET FOR POWERSYNC (Base64Url) ---');
console.log(base64urlSecret);
*/

