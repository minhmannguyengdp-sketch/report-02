const DB_NAME = 'bep-si-report-local-db';
const DB_VERSION = 3;

export const LOCAL_STORES = Object.freeze({
  meta: 'meta',
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  orderItems: 'order_items',
  onaTests: 'ona_tests',
  onaTestItems: 'ona_test_items',
  marketReports: 'market_reports',
  marketReportProducts: 'market_report_products',
  marketReportCompetitors: 'market_report_competitors',
  aiSummaries: 'ai_summaries',
  mcpRoutes: 'mcp_routes',
  mcpRouteCustomers: 'mcp_route_customers',
  mcpRouteSessions: 'mcp_route_sessions',
  mcpVisits: 'mcp_visits',
  syncQueue: 'sync_queue'
});

const BUSINESS_STORES = [
  LOCAL_STORES.products,
  LOCAL_STORES.customers,
  LOCAL_STORES.orders,
  LOCAL_STORES.orderItems,
  LOCAL_STORES.onaTests,
  LOCAL_STORES.onaTestItems,
  LOCAL_STORES.marketReports,
  LOCAL_STORES.marketReportProducts,
  LOCAL_STORES.marketReportCompetitors,
  LOCAL_STORES.aiSummaries,
  LOCAL_STORES.mcpRoutes,
  LOCAL_STORES.mcpRouteCustomers,
  LOCAL_STORES.mcpRouteSessions,
  LOCAL_STORES.mcpVisits
];

let dbPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function createStore(db, name, options = { keyPath: 'id' }) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
}

function ensureBusinessIndexes(store) {
  if (!store.indexNames.contains('sync_status')) store.createIndex('sync_status', 'sync_status', { unique: false });
  if (!store.indexNames.contains('updated_at')) store.createIndex('updated_at', 'updated_at', { unique: false });
}

function nowIso() {
  return new Date().toISOString();
}

export function openLocalDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(db, LOCAL_STORES.meta, { keyPath: 'key' });
      BUSINESS_STORES.forEach((name) => {
        const store = createStore(db, name, { keyPath: 'id' });
        if (store) ensureBusinessIndexes(store);
      });
      const queue = createStore(db, LOCAL_STORES.syncQueue, { keyPath: 'id' });
      if (queue && !queue.indexNames.contains('status')) queue.createIndex('status', 'status', { unique: false });
      if (queue && !queue.indexNames.contains('source_id')) queue.createIndex('source_id', 'source_id', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được local DB.'));
  });
  return dbPromise;
}

export async function getAllLocal(storeName) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).getAll());
}

export async function getLocal(storeName, id) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(id));
}

export async function putLocal(storeName, row) {
  if (!row?.id && storeName !== LOCAL_STORES.meta) throw new Error(`Dòng ${storeName} thiếu id.`);
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(row);
  await txDone(tx);
  return row;
}

export async function putManyLocal(storeName, rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  rows.forEach((row) => {
    if (!row?.id && storeName !== LOCAL_STORES.meta) throw new Error(`Dòng ${storeName} thiếu id.`);
    store.put(row);
  });
  await txDone(tx);
  return rows;
}

export async function clearLocalStore(storeName) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await txDone(tx);
}

export async function getMeta(key, fallback = null) {
  if (!key) return fallback;
  const row = await getLocal(LOCAL_STORES.meta, key);
  return row && Object.prototype.hasOwnProperty.call(row, 'value') ? row.value : fallback;
}

export async function setMeta(key, value) {
  if (!key) throw new Error('Meta key is required.');
  const row = { key, value, updated_at: nowIso() };
  const db = await openLocalDb();
  const tx = db.transaction(LOCAL_STORES.meta, 'readwrite');
  tx.objectStore(LOCAL_STORES.meta).put(row);
  await txDone(tx);
  return value;
}

export async function enqueueLocalSync(type, sourceId, payload = {}) {
  if (!type) throw new Error('Sync job thiếu type.');
  if (!sourceId) throw new Error('Sync job thiếu source_id.');
  const timestamp = nowIso();
  const job = {
    id: `${type}:${sourceId}:${Date.now()}`,
    type,
    source_id: sourceId,
    payload,
    status: 'pending',
    attempts: 0,
    last_error: '',
    created_at: timestamp,
    updated_at: timestamp
  };
  await putLocal(LOCAL_STORES.syncQueue, job);
  return job;
}

export async function getSyncQueue() {
  const rows = await getAllLocal(LOCAL_STORES.syncQueue);
  return rows.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

export async function updateSyncJob(id, patch = {}) {
  if (!id) throw new Error('Sync job id is required.');
  const current = await getLocal(LOCAL_STORES.syncQueue, id);
  const next = {
    ...(current || { id, created_at: nowIso() }),
    ...patch,
    id,
    updated_at: nowIso()
  };
  if (patch.status === 'error') next.attempts = Number(current?.attempts || 0) + 1;
  await putLocal(LOCAL_STORES.syncQueue, next);
  return next;
}

export async function clearDoneSyncJobs() {
  const rows = await getAllLocal(LOCAL_STORES.syncQueue);
  const done = rows.filter((row) => row.status === 'done' || row.status === 'synced');
  if (!done.length) return 0;
  const db = await openLocalDb();
  const tx = db.transaction(LOCAL_STORES.syncQueue, 'readwrite');
  const store = tx.objectStore(LOCAL_STORES.syncQueue);
  done.forEach((row) => store.delete(row.id));
  await txDone(tx);
  return done.length;
}

export async function localStats() {
  const db = await openLocalDb();
  const stats = { records: 0, pending: 0, error: 0, byStore: {} };
  for (const name of BUSINESS_STORES) {
    const tx = db.transaction(name, 'readonly');
    const rows = await requestToPromise(tx.objectStore(name).getAll());
    stats.byStore[name] = rows.length;
    stats.records += rows.length;
    stats.pending += rows.filter((row) => row.sync_status === 'pending' || row.sync_status === 'local').length;
    stats.error += rows.filter((row) => row.sync_status === 'error').length;
  }
  return stats;
}
