const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Sequelize } = require('sequelize');

async function main() {
  const seq = new Sequelize(process.env.DATABASE_URL, { logging: false });
  const SECRET_KEY = process.env.SECRET_KEY;
  const key = Buffer.from(SECRET_KEY, 'hex');

  // Generate jwtSecret value
  const jwtSecretValue = crypto.randomBytes(64).toString('hex');

  // Encrypt exactly like sequelize-encrypted vault set()
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.end(JSON.stringify(jwtSecretValue), 'utf-8');
  const encrypted = Buffer.concat([iv, cipher.read()]);

  // Verify
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, encrypted.slice(0, 16));
  const decrypted = decipher.update(encrypted.slice(16), undefined, 'utf8') + decipher.final('utf8');
  console.log('Decrypt OK:', JSON.parse(decrypted) === jwtSecretValue);

  // Write BLOB and reset lastSignedInAt
  await seq.query('UPDATE users SET "jwtSecret" = $1, "lastSignedInAt" = NULL WHERE email = $2', {
    bind: [encrypted, 'admin@asuite.local']
  });

  // Generate signin token
  const token = jwt.sign({
    id: 'c0000000-0000-0000-0000-000000000001',
    createdAt: new Date().toISOString(),
    type: 'email-signin'
  }, jwtSecretValue);

  console.log('LINK:http://localhost:3000/auth/email.callback?token=' + token);
  await seq.close();
}
main().catch(e => { console.error(e); process.exit(1); });
