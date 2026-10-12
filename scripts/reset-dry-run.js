const { resolveMongoUri } = require('../src/config/env');
const mongoose = require('mongoose');

const RESET_COLLECTIONS = ['chatmessages', 'conversations', 'ledgers', 'orders', 'notifications', 'carts', 'wishlists'];
const PRESERVE_COLLECTIONS = ['users', 'products', 'categories', 'vector_store'];
const FINANCIAL_COLLECTIONS = ['ledgers', 'orders'];
const ALLOW_FINANCIAL_DELETE = process.env.ALLOW_FINANCIAL_DELETE === 'true';

async function run() {
  let uri;
  try { uri = resolveMongoUri(); } catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log('SELECTED_DB=' + db.databaseName);
  console.log('DRY_RUN_ONLY no deletions performed');

  console.log('\n== PRESERVE (must remain) ==');
  for (const c of PRESERVE_COLLECTIONS) {
    console.log('PRESERVE\t' + c + '\t' + (await db.collection(c).countDocuments()));
  }

  const adminUsers = await db.collection('users').find({ role: 'admin' }, { projection: { _id: 1 } }).toArray();
  const adminIds = adminUsers.map((u) => u._id);
  const adminIdStrings = adminUsers.map((u) => String(u._id));
  console.log('\nADMINS_FOUND=' + adminIds.length);

  console.log('\n== RESET TARGETS: total docs that would be deleted ==');
  const counts = {};
  for (const c of RESET_COLLECTIONS) {
    counts[c] = await db.collection(c).countDocuments();
    const gated = FINANCIAL_COLLECTIONS.includes(c) && !ALLOW_FINANCIAL_DELETE;
    console.log('WOULD_DELETE\t' + c + '\t' + counts[c] + (gated ? '\t(GATED: needs ALLOW_FINANCIAL_DELETE=true)' : ''));
  }

  console.log('\n== ADMIN-OWNED subset within reset targets (explicit decision) ==');
  const adminChecks = {
    carts: await db.collection('carts').countDocuments({ user: { $in: adminIds } }),
    wishlists: await db.collection('wishlists').countDocuments({ user: { $in: adminIds } }),
    notifications: await db.collection('notifications').countDocuments({ userId: { $in: adminIds } }),
    orders: await db.collection('orders').countDocuments({ user: { $in: adminIds } }),
    ledgers: await db.collection('ledgers').countDocuments({ user: { $in: adminIds } }),
    conversations: await db.collection('conversations').countDocuments({ userId: { $in: adminIdStrings } }),
    chatmessages: await db.collection('chatmessages').countDocuments({ userId: { $in: adminIdStrings } }),
  };
  for (const [c, n] of Object.entries(adminChecks)) {
    console.log('ADMIN_OWNED\t' + c + '\t' + n);
  }

  console.log('\n== NON-ADMIN subset ==');
  console.log('NON_ADMIN\tcarts\t' + (counts.carts - adminChecks.carts));
  console.log('NON_ADMIN\twishlists\t' + (counts.wishlists - adminChecks.wishlists));
  console.log('NON_ADMIN\tnotifications\t' + (counts.notifications - adminChecks.notifications));
  console.log('NON_ADMIN\torders\t' + (counts.orders - adminChecks.orders));

  console.log('\n== LEDGER / PAYMENT REVIEW (not auto-deleted) ==');
  console.log('LEDGERS_IN_SCOPE=' + counts.ledgers + ' ORDERS_IN_SCOPE=' + counts.orders + ' ALLOW_FINANCIAL_DELETE=' + ALLOW_FINANCIAL_DELETE);

  console.log('\n== DEPENDENCY ORDER (child -> parent) ==');
  console.log('1 chatmessages -> 2 conversations -> 3 ledgers -> 4 orders -> 5 notifications/carts/wishlists (users preserved)');
  console.log('KEEP_ADMIN_PERSONAL=' + (process.env.KEEP_ADMIN_PERSONAL !== 'false'));

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
}

module.exports = { run };
