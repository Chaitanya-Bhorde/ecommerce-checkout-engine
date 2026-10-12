const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArray(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('NOT_ARRAY:' + path.basename(file));
  return data;
}

async function run() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('ERROR: backups directory missing');
    process.exit(1);
  }
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
  const orderFiles = files.filter((f) => f.startsWith('orders-')).sort();
  const ledgerFiles = files.filter((f) => f.startsWith('ledgers-')).sort();

  console.log('BACKUP_DIR=' + path.relative(process.cwd(), BACKUP_DIR));
  console.log('ORDER_FILES=' + orderFiles.length + ' LEDGER_FILES=' + ledgerFiles.length);

  let ok = true;

  for (const of of orderFiles) {
    const stamp = of.replace(/^orders-/, '').replace(/\.json$/, '');
    const lf = 'ledgers-' + stamp + '.json';
    const orderPath = path.join(BACKUP_DIR, of);
    const ledgerPath = path.join(BACKUP_DIR, lf);

    let orders, ledgers;
    try {
      orders = parseArray(orderPath);
    } catch (e) {
      console.log('ORDER_PARSE_FAIL ' + of + ' :: ' + e.message);
      ok = false;
      continue;
    }
    const orderIds = orders.map((o) => String(o._id));
    const orderIdSet = new Set(orderIds);
    const dupOrderIds = orderIdSet.size !== orderIds.length;

    let ledgerLinked = null;
    let ledgerBadRef = null;
    let ledgerCount = null;
    if (fs.existsSync(ledgerPath)) {
      try {
        ledgers = parseArray(ledgerPath);
        ledgerCount = ledgers.length;
        ledgerLinked = 0;
        ledgerBadRef = 0;
        for (const l of ledgers) {
          if (l.order === null || l.order === undefined) continue;
          if (orderIdSet.has(String(l.order))) ledgerLinked += 1;
          else ledgerBadRef += 1;
        }
      } catch (e) {
        console.log('LEDGER_PARSE_FAIL ' + lf + ' :: ' + e.message);
        ok = false;
      }
    } else {
      console.log('LEDGER_FILE_MISSING ' + lf);
      ok = false;
    }

    console.log('--- ' + stamp + ' ---');
    console.log('ORDERS=' + orders.length + ' UNIQUE_ORDER_IDS=' + orderIdSet.size + ' DUP_ORDER_IDS=' + dupOrderIds);
    console.log('ORDER_FILE_BYTES=' + fs.statSync(orderPath).size + ' ORDER_SHA256=' + sha256(orderPath));
    if (ledgerCount !== null) {
      console.log('LEDGERS=' + ledgerCount + ' LEDGERS_LINKED_TO_ORDERS=' + ledgerLinked + ' LEDGERS_BAD_REF=' + ledgerBadRef);
      console.log('LEDGER_FILE_BYTES=' + fs.statSync(ledgerPath).size + ' LEDGER_SHA256=' + sha256(ledgerPath));
    }
    if (dupOrderIds || (ledgerBadRef && ledgerBadRef > 0)) ok = false;
  }

  const firstOrder = sha256(path.join(BACKUP_DIR, orderFiles[0]));
  const runsIdentical = orderFiles.every((f) => sha256(path.join(BACKUP_DIR, f)) === firstOrder);
  console.log('ORDER_RUNS_BYTE_IDENTICAL=' + runsIdentical);
  console.log('VERIFY_OK=' + ok);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  run().catch((e) => {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  });
}

module.exports = { run };
