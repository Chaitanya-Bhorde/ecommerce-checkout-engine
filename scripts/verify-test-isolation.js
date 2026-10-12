const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.test') });

const testUri = process.env.MONGODB_TEST_URI;
if (!testUri) {
  console.error('BLOCKED: MONGODB_TEST_URI is not set in .env.test. Create the dedicated Atlas test user first. No fallback to shared credentials.');
  process.exit(1);
}

(async () => {
  await mongoose.connect(testUri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log('CONNECTED_DB=' + db.databaseName);

  if (db.databaseName !== 'ecommerce_test') {
    console.log('FAIL: connected database is not ecommerce_test');
    await mongoose.disconnect();
    process.exit(1);
  }

  try {
    const cols = await db.listCollections().toArray();
    console.log('ECOMMERCE_TEST_ACCESS=GRANTED collections=' + cols.length);
  } catch (e) {
    console.log('ECOMMERCE_TEST_ACCESS=DENIED ' + e.message.slice(0, 80));
  }

  let prodDenied = false;
  try {
    const prodDb = db.client.db('ecommerce');
    await prodDb.collection('users').findOne({});
    console.log('PROD_ECOMMERCE_ACCESS=GRANTED (ISOLATION FAILED - do not proceed)');
  } catch (e) {
    prodDenied = /not authorized|unauthorized|requires authentication/i.test(e.message);
    console.log('PROD_ECOMMERCE_ACCESS=DENIED ' + (prodDenied ? '(not authorized)' : '(' + e.message.slice(0, 60) + ')'));
  }

  await mongoose.disconnect();
  console.log(prodDenied ? 'ISOLATION_VERIFIED=PASS' : 'ISOLATION_VERIFIED=FAIL');
  process.exit(prodDenied ? 0 : 1);
})().catch((e) => {
  console.error('VERIFY_ERROR ' + e.message.slice(0, 120));
  process.exit(1);
});
