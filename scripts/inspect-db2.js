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
    const Oid = mongoose.Types.ObjectId;

    console.log('===== USERS (email + role only, no secrets) =====');
    const users = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
    for (const u of users) {
      console.log(`USER\t${u._id}\t${u.email}\t${u.role}`);
    }
    const adminIds = users.filter(u => u.role === 'admin').map(u => String(u._id));
    console.log('ADMIN_USER_IDS=' + adminIds.join(','));

    console.log('\n===== ORDERS: status distribution + link to users =====');
    const orders = await db.collection('orders').find({}, { projection: { user: 1, status: 1, total: 1, 'payment.method': 1 } }).toArray();
    const byStatus = {};
    const byUser = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      const uid = String(o.user);
      byUser[uid] = (byUser[uid] || 0) + 1;
    }
    console.log('ORDER_STATUS=' + JSON.stringify(byStatus));
    console.log('ORDERS_PER_USER=' + JSON.stringify(byUser));

    console.log('\n===== LEDGERS: type + status distribution =====');
    const ledgers = await db.collection('ledgers').find({}, { projection: { type: 1, status: 1, amount: 1 } }).toArray();
    const lByStatus = {}; const lByType = {};
    for (const l of ledgers) { lByStatus[l.status] = (lByStatus[l.status] || 0) + 1; lByType[l.type] = (lByType[l.type] || 0) + 1; }
    console.log('LEDGER_STATUS=' + JSON.stringify(lByStatus));
    console.log('LEDGER_TYPE=' + JSON.stringify(lByType));

    console.log('\n===== CARTS / WISHLISTS / NOTIFICATIONS per user =====');
    const carts = await db.collection('carts').find({}, { projection: { user: 1 } }).toArray();
    const wish = await db.collection('wishlists').find({}, { projection: { user: 1 } }).toArray();
    console.log('CART_USERS=' + carts.map(c => String(c.user)).join(','));
    console.log('WISHLIST_USERS=' + wish.map(w => String(w.user)).join(','));
    const notifByUser = await db.collection('notifications').aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]).toArray();
    console.log('NOTIF_PER_USER=' + JSON.stringify(notifByUser.map(n => ({ user: String(n._id), count: n.count }))));

    console.log('\n===== CONVERSATIONS/CHATMESSAGES link check =====');
    const convs = await db.collection('conversations').find({}, { projection: { userId: 1 } }).toArray();
    console.log('CONVERSATIONS=' + convs.length + ' sample_userIds=' + convs.slice(0,5).map(c => c.userId).join(','));
    const msgSample = await db.collection('chatmessages').find({}, { projection: { conversationId: 1 } }).limit(3).toArray();
    console.log('CHATMESSAGES_SAMPLE_CONV_IDS=' + msgSample.map(m => String(m.conversationId)).join(','));

    console.log('\n===== Does any ledger reference an order that would be deleted? =====');
    const orderIds = new Set(orders.map(o => String(o._id)));
    const ledgersWithOrder = await db.collection('ledgers').find({ order: { $ne: null } }, { projection: { order: 1, status: 1 } }).toArray();
    let orphanAfterOrderDelete = 0;
    for (const l of ledgersWithOrder) { if (orderIds.has(String(l.order))) orphanAfterOrderDelete++; }
    console.log('LEDGERS_REFERENCING_EXISTING_ORDERS=' + orphanAfterOrderDelete + ' (of ' + ledgersWithOrder.length + ' ledgers with an order ref)');

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
