const dotenv = require('dotenv');

const EXPECTED_TEST_DB = 'ecommerce_test';

dotenv.config();

function dbNameFromUri(uri) {
  const match = uri.match(/^[a-z+]+:\/\/[^/]+\/([^?]*)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function swapDbName(uri, newDb) {
  const match = uri.match(/^([a-z+]+:\/\/[^/]+)(?:\/[^?]*)?(\?.*)?$/i);
  if (!match) return null;
  return `${match[1]}/${newDb}${match[2] || ''}`;
}

function isTestMode() {
  return (
    process.env.APP_ENV === 'test' ||
    process.env.DB_ENV === 'test' ||
    process.env.USE_TEST_DB === 'true'
  );
}

function resolveMongoUri() {
  if (isTestMode()) {
    const explicit = process.env.MONGODB_TEST_URI;
    const base = process.env.MONGODB_URI || process.env.MONGO_URI;
    const candidate = explicit || (base ? swapDbName(base, EXPECTED_TEST_DB) : null);
    if (!candidate) {
      throw new Error('Test environment is active but no MongoDB URI is available. Aborting before any connection.');
    }
    const resolvedDb = dbNameFromUri(candidate);
    if (resolvedDb !== EXPECTED_TEST_DB) {
      throw new Error(`Test environment is active but the resolved database "${resolvedDb}" is not exactly "${EXPECTED_TEST_DB}". Aborting before any connection.`);
    }
    return candidate;
  }
  const base = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!base) {
    throw new Error('MONGODB_URI is not set in the environment.');
  }
  return base;
}

if (isTestMode()) {
  const testUri = resolveMongoUri();
  process.env.MONGODB_URI = testUri;
  if (process.env.MONGO_URI) process.env.MONGO_URI = testUri;
}

module.exports = { resolveMongoUri, EXPECTED_TEST_DB, isTestMode, dbNameFromUri, swapDbName };
