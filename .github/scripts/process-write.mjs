import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const eventType = process.env.EVENT_TYPE;
const rawPayload = process.env.PAYLOAD;

if (!rawPayload) {
  console.error('PAYLOAD env var is missing');
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(rawPayload);
} catch (e) {
  console.error('Invalid JSON in PAYLOAD:', e.message);
  process.exit(1);
}

const data = payload.data;
const target = payload.target;

console.log(`Processing: ${eventType}`);
console.log(`Timestamp: ${payload.timestamp}`);

// --- Helpers ---

function readJSONFile(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSONFile(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function requireFields(obj, fields, context) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      console.error(`Validation failed: missing '${f}' in ${context}`);
      process.exit(1);
    }
  }
}

// --- Handlers ---

function handleCreateTransaction(txn, yearMonth) {
  requireFields(txn, ['date', 'amount', 'type'], 'transaction');
  if (typeof txn.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(txn.date)) {
    console.error('Validation failed: date must be YYYY-MM-DD string');
    process.exit(1);
  }

  const month = yearMonth || txn.date.slice(0, 7);
  const dir = 'data/transactions';
  const filePath = `${dir}/${month}.json`;

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let file = readJSONFile(filePath);
  if (!file) {
    file = { _schema_version: 1, month, lastId: 0, transactions: [] };
  }

  file.lastId += 1;
  txn.id = file.lastId;
  txn.createdAt = new Date().toISOString();
  file.transactions.push(txn);
  file.updatedAt = new Date().toISOString();

  writeJSONFile(filePath, file);
  console.log(`Created transaction ${txn.id} in ${month}`);
}

function handleEditTransaction(txn, yearMonth) {
  requireFields(txn, ['id'], 'transaction edit');
  if (typeof txn.id !== 'number') {
    console.error('Validation failed: id must be a number');
    process.exit(1);
  }

  const filePath = `data/transactions/${yearMonth}.json`;
  const file = readJSONFile(filePath);
  if (!file) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const idx = file.transactions.findIndex(t => t.id === txn.id);
  if (idx === -1) {
    console.error(`Transaction ${txn.id} not found in ${yearMonth}`);
    process.exit(1);
  }

  Object.assign(file.transactions[idx], txn);
  file.transactions[idx].updatedAt = new Date().toISOString();
  file.updatedAt = new Date().toISOString();

  writeJSONFile(filePath, file);
  console.log(`Updated transaction ${txn.id} in ${yearMonth}`);
}

function handleDeleteTransaction(payload, yearMonth) {
  const ids = payload.ids || (payload.id != null ? [payload.id] : null);
  if (!ids || ids.length === 0) {
    console.error('Validation failed: provide id or ids to delete');
    process.exit(1);
  }

  const filePath = `data/transactions/${yearMonth}.json`;
  const file = readJSONFile(filePath);
  if (!file) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const idsSet = new Set(ids);
  const before = file.transactions.length;
  file.transactions = file.transactions.filter(t => !idsSet.has(t.id));
  const removed = before - file.transactions.length;
  file.updatedAt = new Date().toISOString();

  writeJSONFile(filePath, file);
  console.log(`Deleted ${removed} transaction(s) from ${yearMonth}`);
}

function handleUpdateConfig(newConfig) {
  if (!newConfig || typeof newConfig !== 'object') {
    console.error('Validation failed: config data must be an object');
    process.exit(1);
  }

  const filePath = 'data/config.json';
  const file = readJSONFile(filePath) || { _schema_version: 1 };

  const { _savedAt, pat, geminiKey, ...cleanConfig } = newConfig;
  if (cleanConfig.repo) {
    const { pat: _rPat, ...cleanRepo } = cleanConfig.repo;
    cleanConfig.repo = cleanRepo;
  }
  Object.assign(file, cleanConfig);
  delete file.pat;
  delete file.geminiKey;
  if (file.repo) delete file.repo.pat;
  for (const key of Object.keys(file)) {
    if (file[key] === null) delete file[key];
  }
  file._schema_version = 1;
  file.updatedAt = new Date().toISOString();

  writeJSONFile(filePath, file);
  console.log('Config updated');
}

function handleUpdateCategories(categories) {
  if (!categories || typeof categories !== 'object') {
    console.error('Validation failed: categories data must be an object');
    process.exit(1);
  }

  const file = { ...categories, _schema_version: 1, updatedAt: new Date().toISOString() };
  writeJSONFile('data/categories.json', file);
  console.log('Categories updated');
}

function handleUpdatePaymentMethods(methods) {
  if (!methods) {
    console.error('Validation failed: methods data is required');
    process.exit(1);
  }

  const file = {
    _schema_version: 1,
    methods: methods.methods || methods,
    updatedAt: new Date().toISOString()
  };
  writeJSONFile('data/payment-methods.json', file);
  console.log('Payment methods updated');
}

function handleUpdateSavings(savingsData) {
  if (!savingsData || typeof savingsData !== 'object') {
    console.error('Validation failed: savings data must be an object');
    process.exit(1);
  }

  const file = {
    _schema_version: 1,
    goals: savingsData.goals || [],
    deposits: savingsData.deposits || [],
    updatedAt: new Date().toISOString()
  };
  writeJSONFile('data/savings.json', file);
  console.log('Savings updated');
}

// --- Dispatch ---

const handlers = {
  'create-transaction': handleCreateTransaction,
  'edit-transaction': handleEditTransaction,
  'delete-transaction': handleDeleteTransaction,
  'update-config': handleUpdateConfig,
  'update-categories': handleUpdateCategories,
  'update-payment-methods': handleUpdatePaymentMethods,
  'update-savings': handleUpdateSavings
};

const handler = handlers[eventType];
if (!handler) {
  console.error(`Unknown event type: ${eventType}`);
  process.exit(1);
}

handler(data, target);
console.log('Done.');
