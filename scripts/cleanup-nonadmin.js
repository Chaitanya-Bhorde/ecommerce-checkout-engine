const { resolveMongoUri } = require('../src/config/env');
const mongoose = require('mongoose');

const EXPECTED_DB = 'ecommerce';
const TARGETS = [
  { name: 'chatmessages', field: 'userId', kind: 'string' },
  { name: 'conversations', field: 'userId', kind: 'string' },
  { name: 'notifications', field: 'userId', kind: 'oid' },
  { name: 'wishlists', field: 'user', kind: 'oid' },
  { name: 'carts', field: 'user', kind: 'oid' },
];
const NEVER_TOUCH = ['orders', 'ledgers', 'products', 'categories', 'vector_store', 'idempotencies', 'supporttickets'];

function parseConfirm(argv = process.argv) {
  const idx = argv.indexOf('--confirm');
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

async function run() {
  const confirm = parseConfirm();
  if (confirm !== EXPECTED_DB) {
    throw new Error('Refusing to clean: run with --confirm ' + EXPECTED_DB + ' (received: ' + confirm + ')');
  }

  const uri = resolveMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const actualDb = db.databaseName;
  if (actualDb !== EXPECTED_DB) {
    await mongoose.disconnect();
    throw new Error('Refusing to clean: connected database "' + actualDb + '" is not "' + EXPECTED_DB + '"');
  }
  console.log('VERIFIED_DB=' + actualDb);

  const adminUsers = await db.collection('users').find({ role: 'admin' }, { projection: { _id: 1 } }).toArray();
  if (adminUsers.length === 0) {
    await mongoose.disconnect();
    throw new Error('No administrator account found; refusing to clean.');
  }
  const adminIds = adminUsers.map((u) => u._id);
  const adminIdStr = adminUsers.map((u) => String(u._id));
  console.log('ADMINS_PRESERVED=' + adminUsers.length);

  const nonAdmins = await db.collection('users').find({ role: { $ne: 'admin' } }, { projection: { _id: 1 } }).toArray();
  const nonAdminIds = nonAdmins.map((u) => u._id);
  const nonAdminIdStr = nonAdmins.map((u) => String(u._id));
  console.log('NON_ADMIN_USERS=' + nonAdmins.length);

  console.log('\n== BEFORE COUNTS ==');
  const before = {};
  for (const t of TARGETS) {
    const vals = t.kind === 'oid' ? nonAdminIds : nonAdminIdStr;
    before[t.name] = await db.collection(t.name).countDocuments({ [t.field]: { $in: vals } });
    console.log('  ' + t.name + ' (non-admin) = ' + before[t.name]);
  }
  before.users = nonAdmins.length;
  console.log('  users (non-admin) = ' + before.users);
  console.log('NEVER_TOUCH=' + NEVER_TOUCH.join(','));

  if (nonAdminIds.length === 0) {
    console.log('\nNO_NON_ADMIN_USERS nothing to delete');
    await mongoose.disconnect();
    return;
  }

  console.log('\n== DELETING (children before parents; admin excluded) ==');
  for (const t of TARGETS) {
    const vals = t.kind === 'oid' ? nonAdminIds : nonAdminIdStr;
    const filter = { [t.field]: { $in: vals } };
    const res = await db.collection(t.name).deleteMany(filter);
    console.log('DELETED ' + t.name + ' count=' + res.deletedCount + ' filter_field=' + t.field);
  }
  const userFilter = { _id: { $in: nonAdminIds }, role: { $ne: 'admin' } };
  const userRes = await db.collection('users').deleteMany(userFilter);
  console.log('DELETED users count=' + userRes.deletedCount + ' (role != admin)');

  console.log('\n== AFTER COUNTS ==');
  const remainingNonAdmin = await db.collection('users').countDocuments({ role: { $ne: 'admin' } });
  console.log('  users (non-admin) = ' + remainingNonAdmin);
  for (const t of TARGETS) {
    const vals = t.kind === 'oid' ? nonAdminIds : nonAdminIdStr;
    const left = await db.collection(t.name).countDocuments({ [t.field]: { $in: vals } });
    console.log('  ' + t.name + ' (non-admin) = ' + left);
  }

  console.log('\n== PRESERVED VERIFICATION ==');
  console.log('  admin_users=' + (await db.collection('users').countDocuments({ role: 'admin' })));
  console.log('  admin_carts=' + (await db.collection('carts').countDocuments({ user: { $in: adminIds } })));
  console.log('  admin_wishlists=' + (await db.collection('wishlists').countDocuments({ user: { $in: adminIds } })));
  console.log('  admin_notifications=' + (await db.collection('notifications').countDocuments({ userId: { $in: adminIds } })));
  console.log('  admin_conversations=' + (await db.collection('conversations').countDocuments({ userId: { $in: adminIdStr } })));
  console.log('  admin_chatmessages=' + (await db.collection('chatmessages').countDocuments({ userId: { $in: adminIdStr } })));
  console.log('  products=' + (await db.collection('products').countDocuments()));
  console.log('  categories=' + (await db.collection('categories').countDocuments()));
  console.log('  vector_store=' + (await db.collection('vector_store').countDocuments()));
  console.log('  orders(preserved)=' + (await db.collection('orders').countDocuments()));
  console.log('  ledgers(preserved)=' + (await db.collection('ledgers').countDocuments()));

  await mongoose.disconnect();
  console.log('\nCLEANUP_COMPLETE financial records preserved');
}

if (require.main === module) {
  run().catch(async (e) => {
    console.error('CLEANUP_ERROR ' + e.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}

module.exports = { run, parseConfirm };
