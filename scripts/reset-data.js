const { resolveMongoUri } = require('../src/config/env');
const mongoose = require('mongoose');

const PRESERVE = new Set(['users', 'products', 'categories', 'vector_store']);
const KEEP_ADMIN_PERSONAL = process.env.KEEP_ADMIN_PERSONAL !== 'false';
const ALLOW_FINANCIAL_DELETE = process.env.ALLOW_FINANCIAL_DELETE === 'true';
const EXPECTED_DB = 'ecommerce_test';

const ORDER = [
  { name: 'chatmessages', kind: 'chat' },
  { name: 'conversations', kind: 'chat' },
  { name: 'ledgers', kind: 'financial' },
  { name: 'orders', kind: 'financial' },
  { name: 'notifications', kind: 'notification' },
  { name: 'carts', kind: 'user' },
  { name: 'wishlists', kind: 'user' },
];

function parseConfirmedDb(argv = process.argv) {
  const idx = argv.indexOf('--confirm-reset');
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

function filterFor(step, adminIds) {
  if (KEEP_ADMIN_PERSONAL) {
    if (step.name === 'carts' || step.name === 'wishlists') return { user: { $nin: adminIds } };
    if (step.name === 'notifications') return { userId: { $nin: adminIds } };
  }
  return {};
}

async function run() {
  const confirmedDb = parseConfirmedDb();
  if (confirmedDb !== EXPECTED_DB) {
    throw new Error('Refusing to reset: run with --confirm-reset ' + EXPECTED_DB + ' (received: ' + confirmedDb + ')');
  }

  const uri = resolveMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const actualDb = db.databaseName;
  if (actualDb !== EXPECTED_DB) {
    await mongoose.disconnect();
    throw new Error('Refusing to reset: connected database "' + actualDb + '" is not "' + EXPECTED_DB + '"');
  }
  console.log('VERIFIED_DB=' + actualDb);

  const adminUsers = await db.collection('users').find({ role: 'admin' }, { projection: { _id: 1 } }).toArray();
  if (adminUsers.length === 0) {
    await mongoose.disconnect();
    throw new Error('No administrator account found in users; refusing to reset.');
  }
  if (adminUsers.length > 1) {
    console.log('WARNING_MULTIPLE_ADMINS=' + adminUsers.length + ' all will be preserved');
  }
  const adminIds = adminUsers.map((u) => u._id);
  console.log('ADMINS_PRESERVED=' + adminIds.length);

  console.log('\n== RESET PLAN ==');
  for (const step of ORDER) {
    if (PRESERVE.has(step.name)) {
      console.log('PLAN\t' + step.name + '\tPRESERVE');
    } else if (step.kind === 'financial' && !ALLOW_FINANCIAL_DELETE) {
      console.log('PLAN\t' + step.name + '\tSKIP(financial; needs ALLOW_FINANCIAL_DELETE=true)');
    } else {
      console.log('PLAN\t' + step.name + '\tDELETE filter=' + JSON.stringify(filterFor(step, adminIds)));
    }
  }

  for (const step of ORDER) {
    if (PRESERVE.has(step.name)) {
      console.log('SKIP(preserved) ' + step.name);
      continue;
    }

    if (step.kind === 'financial' && !ALLOW_FINANCIAL_DELETE) {
      console.log('SKIP(financial, needs ALLOW_FINANCIAL_DELETE=true) ' + step.name);
      continue;
    }

    const filter = filterFor(step, adminIds);
    const res = await db.collection(step.name).deleteMany(filter);
    console.log('DELETED ' + step.name + ' count=' + res.deletedCount + ' filter=' + JSON.stringify(filter));
  }

  console.log('KEEP_ADMIN_PERSONAL=' + KEEP_ADMIN_PERSONAL);
  console.log('ALLOW_FINANCIAL_DELETE=' + ALLOW_FINANCIAL_DELETE);
  console.log('RESET_COMPLETE');
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch(async (e) => {
    console.error('RESET_ERROR ' + e.message);
    console.error('No partial guarantee; inspect which steps logged DELETED above.');
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}

module.exports = { run, parseConfirmedDb, filterFor };
