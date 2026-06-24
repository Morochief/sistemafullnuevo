/**
 * Script to generate password hashes for demo users
 * Usage: node generate-password-hashes.js
 */

import bcrypt from 'bcryptjs';

const passwords = {
  admin: 'admin123',
  kevin: 'kevin123',
  rodrigo: 'rodrigo123'
};

async function generateHashes() {
  console.log('Generating password hashes...\n');
  
  for (const [user, password] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`${user}:`);
    console.log(`  Password: ${password}`);
    console.log(`  Hash: ${hash}\n`);
  }
}

generateHashes().catch(console.error);
