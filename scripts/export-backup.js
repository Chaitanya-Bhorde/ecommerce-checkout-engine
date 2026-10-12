const fs = require('fs');
const path = require('path');
const { resolveMongoUri } = require('../src/config/env');
const mongoose = require('mongoose');

const OUT_DIR = path.join(__dirname, '..', 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function run() {
  let uri;
  try {
    uri = resolveMongoUri();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  const orders = await db.collection('orders').find({}).toArray();
  const ledgers = await db.collection('ledgers').find({}).toArray();

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const gitignorePath = path.join(OUT_DIR, '.gitignore');
  if (!fs.existsSync(gitignorePath)) fs.writeFileSync(gitignorePath, '*\n');

  const ordersFile = path.join(OUT_DIR, `orders-${stamp}.json`);
  const ledgersFile = path.join(OUT_DIR, `ledgers-${stamp}.json`);
  fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
  fs.writeFileSync(ledgersFile, JSON.stringify(ledgers, null, 2));

  const orderIds = new Set(orders.map((o) => String(o._id)));
  let ledgersLinked = 0;
  for (const l of ledgers) {
    if (l.order && orderIds.has(String(l.order))) ledgersLinked += 1;
  }

  const seenOrderIds = new Set(orders.map((o) => String(o._id)));
  const duplicateOrderIds = seenOrderIds.size !== orders.length;

  console.log('EXPORT_COMPLETE');
  console.log('ORDERS_EXPORTED=' + orders.length);
  console.log('LEDGERS_EXPORTED=' + ledgers.length);
  console.log('LEDGERS_LINKED_TO_ORDERS=' + ledgersLinked);
  console.log('DUPLICATE_ORDER_IDS=' + duplicateOrderIds);
  console.log('ORDERS_FILE=' + path.relative(process.cwd(), ordersFile));
  console.log('LEDGERS_FILE=' + path.relative(process.cwd(), ledgersFile));
  console.log('IDS_PRESERVED_AS_HEX=' + (orders.length > 0 && typeof String(orders[0]._id) === 'string'));

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((e) => {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  });
}

module.exports = { run };
