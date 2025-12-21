/**
 * Simple PouchDB import test to diagnose the import issue
 */
/* eslint-disable @typescript-eslint/no-require-imports */

// Try different import methods
console.log('Testing PouchDB imports...');

// Method 1: Default import
try {
  const _PouchDB1 = require('pouchdb');
  console.log('✅ Method 1 (require): PouchDB imported successfully');
  console.log('   PouchDB type:', typeof _PouchDB1);
  console.log('   PouchDB default:', typeof (_PouchDB1 as Record<string, unknown>).default);
} catch (error) {
  console.error('❌ Method 1 failed:', (error as Error).message);
}

// Method 2: ES6 import
import * as _PouchDB2 from 'pouchdb';
console.log('✅ Method 2 (ES6): PouchDB imported successfully');
console.log('   PouchDB type:', typeof _PouchDB2);
console.log('   PouchDB default:', typeof (_PouchDB2 as unknown as Record<string, unknown>).default);

// Method 3: Named import if available
try {
  const _PouchDB3 = require('pouchdb').default || require('pouchdb');
  console.log('✅ Method 3 (fallback): PouchDB imported successfully');
  console.log('   PouchDB type:', typeof _PouchDB3);
} catch (error) {
  console.error('❌ Method 3 failed:', (error as Error).message);
}

export { };