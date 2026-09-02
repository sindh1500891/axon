import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET || 'axon-bdd-default-secret';
  return scryptSync(secret, 'axon-bdd-salt', 32);
}

function encrypt(plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function usage() {
  console.log(`
Usage:
  npm run encrypt:password -- "your-password"
  npm run encrypt:password -- --token "your-security-token"
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

if (args[0] === '--token') {
  const token = args[1];
  if (!token) {
    console.error('Missing token value.');
    usage();
    process.exit(1);
  }
  console.log(encrypt(token));
  process.exit(0);
}

console.log(encrypt(args[0]));
