/**
 * Simple PouchDB import test to diagnose the import issue
 */

// Try different import methods
console.log('Testing PouchDB imports...');

// Method 1: Default import
try {
  const PouchDB1 = require('pouchdb');
  console.log('✅ Method 1 (require): PouchDB imported successfully');
  console.log('   PouchDB type:', typeof PouchDB1);
  console.log('   PouchDB default:', typeof (PouchDB1 as any).default);
} catch (error) {
  console.error('❌ Method 1 failed:', (error as any).message);
}

// Method 2: ES6 import
import * as PouchDB2 from 'pouchdb';
console.log('✅ Method 2 (ES6): PouchDB imported successfully');
console.log('   PouchDB type:', typeof PouchDB2);
console.log('   PouchDB default:', typeof (PouchDB2 as any).default);

// Method 3: Named import if available
try {
  const PouchDB3 = require('pouchdb').default || require('pouchdb');
  console.log('✅ Method 3 (fallback): PouchDB imported successfully');
  console.log('   PouchDB type:', typeof PouchDB3);
} catch (error) {
  console.error('❌ Method 3 failed:', (error as any).message);
}

export {};