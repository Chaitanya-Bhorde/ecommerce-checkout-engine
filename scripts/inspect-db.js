const { resolveMongoUri } = require('../src/config/env');
const mongoose = require('mongoose');

async function run() {
  let uri;
  try {
    uri = resolveMongoUri();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    const safeHost = db.databaseName;
    const cols = await db.listCollections().toArray();
    console.log('DATABASE_NAME=' + safeHost);
    console.log('TOTAL_COLLECTIONS=' + cols.length);
    const rows = [];
    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      rows.push({ collection: c.name, count });
    }
    rows.sort((a, b) => a.collection.localeCompare(b.collection));
    for (const r of rows) {
      console.log(`${r.collection}\t${r.count}`);
    }
    await mongoose.disconnect();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
