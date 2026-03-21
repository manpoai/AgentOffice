// Run inside Outline container with: NODE_PATH=/opt/outline/node_modules node /tmp/outline-signin2.js
// This script uses Outline's own models to properly encrypt jwtSecret

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const EncryptedField = require('sequelize-encrypted');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const seq = new Sequelize(DATABASE_URL, { logging: false });

  // Setup encrypted field exactly like Outline does
  const encrypted = EncryptedField(Sequelize, SECRET_KEY);

  // Define a minimal User model matching Outline's schema
  const User = seq.define('user', {
    id: { type: DataTypes.UUID, primaryKey: true },
    email: DataTypes.STRING,
    name: DataTypes.STRING,
    jwtSecret: encrypted.vault('jwtSecret'),
    lastSignedInAt: DataTypes.DATE,
    lastActiveAt: DataTypes.DATE,
  }, {
    tableName: 'users',
    timestamps: false,
  });

  // Find our user
  const user = await User.findOne({ where: { email: 'admin@asuite.local' } });
  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  // Generate and set jwtSecret through the encrypted vault
  const jwtSecretValue = crypto.randomBytes(64).toString('hex');
  user.jwtSecret = jwtSecretValue;
  user.lastSignedInAt = null;
  await user.save();

  // Verify by re-reading
  const reloaded = await User.findByPk(user.id);
  const decryptedSecret = reloaded.jwtSecret;
  console.log('Secret matches:', JSON.stringify(decryptedSecret) === JSON.stringify(jwtSecretValue));

  // Generate signin token
  const token = jwt.sign({
    id: user.id,
    createdAt: new Date().toISOString(),
    type: 'email-signin'
  }, jwtSecretValue);

  console.log('LINK:http://localhost:3000/auth/email.callback?token=' + token);
  await seq.close();
}

main().catch(e => { console.error(e); process.exit(1); });
