import { decrypt, encrypt } from '../tests/support/crypto';

function usage(): void {
  console.log(`
Usage:
  npm run encrypt:password -- <plain-password>
  npm run encrypt:password -- --token <plain-security-token>

Examples:
  npm run encrypt:password -- "MyPassword@2026"
  npm run encrypt:password -- --token "abc123token"

Add output to .env:
  ENCRYPTION_SECRET=your-strong-secret
  SF_PASSWORD_ENCRYPTED=<encrypted-value>
  SF_SECURITY_TOKEN_ENCRYPTED=<encrypted-token>   # optional
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

const password = args[0];
console.log(encrypt(password));
