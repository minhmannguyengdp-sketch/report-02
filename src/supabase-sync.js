import { LOCAL_STORES, getAllLocal, putLocal, putManyLocal, localStats } from '../local-db.js';

let cfg = { supabaseUrl: '', supabaseKey: '', loaded: false };
let syncing = false;

const MCP_ROUTE_COLUMNS = ['id', 'route_name', 'weekday', 'area', 'distributor_id', 'active', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_ROUTE_CUSTOMER_COLUMNS = ['id', 'route_id', 'customer_id', 'customer_name', 'phone', 'area', 'address', 'sort_order', 'active', 'note', 'geo_lat', 'geo_lng', 'geo_accuracy', 'geo_captured_at', 'geo_source', 'google_maps_url', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_ROUTE_SESSION_COLUMNS = ['id', 'route_id', 'route_name', 'session_date', 'weekday', 'sales', 'area', 'status', 'planned_customers', 'visited_customers', 'order_count', 'test_count', 'report_count', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_VISIT_COLUMNS = ['id', 'session_id', 'route_id', 'route_customer_id', 'visit_date', 'status', 'has_order', 'has_test', 'has_report', 'order_id', 'test_id', 'report_id', 'checkin_at', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const ORDER_COLUMNS = ['id', 'order_code', 'order_date', 'sales', 'customer_id', 'customer_name', 'customer_phone', 'area', 'delivery_address', 'source_type', 'source_id', 'status', 'subtotal', 'discount_total', 'grand_total', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const ORDER_ITEM_COLUMNS = ['id', 'order_id', 'product_id', 'product_name', 'sku', 'unit', 'quantity', 'unit_price', 'discount', 'line_total', 'note', 'raw_payload', 'created_at'];
const MARKET_REPORT_COLUMNS = ['id', 'report_date', 'sales', 'market_area', 'route_name', 'market_type', 'total_shops', 'competitor_summary', 'price_summary', 'demand_summary', 'company_product_summary', 'opportunity_summary', 'risk_summary', 'next_action', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];

const BUSINESS_GROUPS = [
  { store: LOCAL_STORES.mcpRoutes, table: 'mcp_routes', columns: MCP_ROUTE_COLUMNS, label: 'tuyến' },
  { store: LOCAL_STORES.mcpRouteCustomers, table: 'mcp_route_customers', columns: MCP_ROUTE_CUSTOMER_COLUMNS, label: 'khách tuyến' },
  { store: LOCAL_STORES.mcpRouteSessions, table: 'mcp_route_sessions', columns: MCP_ROUTE_SESSION_COLUMNS, label: 'phiên tuyến' },
  { store: LOCAL_STORES.mcpVisits, table: 'mcp_visits', columns: MCP_VISIT_COLUMNS, label: 'lượt ghé' },
  { store: LOCAL_STORES.orders, table: 'orders', columns: ORDER_COLUMNS, label: 'đơn' },
  { store: LOCAL_STORES.orderItems, table: 'order_items', columns: ORDER_ITEM_COLUMNS, label: 'dòng đơn' },
  { store: LOCAL_STORES.marketReports, table: 'market_reports', columns: MARKET_REPORT_COLUMNS, label: 'báo cáo' }
];

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
}

function mountCloudStatusStyle() {
  if (document.querySelector('style[data-cloud-sync-status]')) return;
  const style = document.createElement('style');
  style.dataset.cloudSyncStatus = '1';
  style.textContent = `
    .sync-state.cloud-ok span{background:#12a150!important}
    .sync-state.cloud-local span{background:#f59625!important}
    .sync-state.cloud-sync span{background:#f59e0b!important;box-shadow:0 0 0 3px rgba(245,158,11,.14)}
    .sync-state.cloud-error span{background:#dc2626!important;box-shadow:0 0 0 3px rgba(220,38,38,.12)}
  `;
  document.head.appendChild(style);
}

function setSyncButtonBusy(isBusy) {
  const button = document.querySelector('#syncBtn');
  if (!button) return;
  button.disabled = isBusy;
  button.textContent = isBusy ? 'Đang sync...' : 'Đồng bộ';
}

function setSyncState(label, tone = 'local') {
  const state = document.querySelector('#syncState');
  if (!state) return;
  state.className = `sync-state cloud-${tone}`;
  state.innerHTML = `<span></span><b>${label}</b>`;
}

function setAdminTitle() {
  const card = document.querySelector('section.page[data-page="admin"] article.admin');
  const title = card?.querySelector('b');
  if (title) title.textContent = 'Đồng bộ đám mây';
  const warn = document.querySelector('section.page[data-page="admin"] .warn');
  if (warn) warn.textContent = 'Local DB là cache. Đám mây dùng để đồng bộ nhiều thiết bị.';
}

function normalizeCloudLabels() {
  mountCloudStatusStyle();
  setAdminTitle();
  const current = document.querySelector('#syncState b');
  if (current?.textContent?.trim() === 'Supabase') current.textContent = 'Đám mây';
}

function setAdminInfo(message) {
  const info = document.querySelector('#dbInfo');
  if (info) info.textContent = message;
  setAdminTitle();
}

async function refreshAdminStats(extra = '') {
  const element = document.querySelector('#adminStats');
  if (!element) return;
  const stats = await localStats();
  const lines = [
    `Tổng local: ${stats.records}`,
    `Hàng đợi sync: ${stats.pending}`,
    `Lỗi sync: ${stats.error}`
  ];
  if (extra) lines.push(extra);
  element.innerHTML = lines.map((line) => String(line)).join('<br>');
}

async function loadConfig() {
  if (cfg.loaded) return cfg;
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (response.ok) {
      const json = await response.json();
      cfg.supabaseUrl = String(json.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      cfg.supabaseKey = String(json.supabaseKey || '');
    }
  } catch (error) {
    console.warn('business sync config failed', error);
  }
  cfg.loaded = true;
  return cfg;
}

function hasCloud() {
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && navigator.onLine);
}

function apiUrl(table, params = 'on_conflict=id') {
  const query = params ? `?${params}` : '';
  return `${cfg.supabaseUrl}/rest/v1/${table}${query}`;
}

function headers(extra = {}) {
  return {
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
    ...extra
  };
}

function nowIso() {
  return new Date().toISOString();
}

function deletedAt(row = {}) {
  return row.deleted_at || row.raw_payload?.deleted_at || null;
}

function cloudStatus(row = {}) {
  return deletedAt(row) || row.status === 'deleted' ? 'deleted' : 'active';
}

function rawPayload(row = {}, extra = {}) {
  return { ...(row.raw_payload || {}), ...extra };
}

function needsSync(row = {}) {
  if (row.sync_status !== 'synced' || !row.synced_at) return true;
  const changedAt = row.updated_at || row.created_at || '';
  return Boolean(changedAt && String(changedAt) > String(row.synced_at));
}

function pickColumns(row = {}, columns = [], syncedAt = '') {
  return columns.reduce((record, column) => {
    let value = row[column];
    if (column === 'sync_status') value = 'synced';
    if (column === 'synced_at') value = syncedAt;
    if (value === undefined) value = null;
    record[column] = value;
    return record;
  }, {});
}

function markSynced(row = {}, syncedAt = '') {
  return {
    ...row,
    sync_status: 'synced',
    synced_at: syncedAt
  };
}

async function upsert(table, rows) {
  if (!rows.length) return 0;
  const response = await fetch(apiUrl(table), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${text}`);
  }
  return rows.length;
}

async function fetchRows(table) {
  const response = await fetch(apiUrl(table, 'select=*'), {
    method: 'GET',
    headers: headers({ Prefer: 'return=representation' }),
    cache: 'no-store'
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table} pull: ${response.status} ${text}`);
  }
  return response.json();
}

async function syncStore({ store, table, columns, label }) {
  const rows = (await getAllLocal(store)).filter(needsSync);
  if (!rows.length) return { label, count: 0, mode: 'push' };
  const syncedAt = nowIso();
  await upsert(table, rows.map((row) => pickColumns(row, columns, syncedAt)));
  for (const row of rows) await putLocal(store, markSynced(row, syncedAt));
  return { label, count: rows.length, mode: 'push' };
}

async function pullStore({ store, table, label }) {
  const rows = await fetchRows(table);
  if (!rows.length) return { label, count: 0, mode: 'pull' };
  await putManyLocal(store, rows);
  return { label, count: rows.length, mode: 'pull' };
}

async function syncMcp() {
  const results = [];
  for (const group of BUSINESS_GROUPS.slice(0, 4)) results.push(await syncStore(group));
  return results;
}

async function syncOrders() {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  const pendingOrders = orders.filter(needsSync);
  if (!pendingOrders.length) return [{ label: 'đơn', count: 0, mode: 'push' }, { label: 'dòng đơn', count: 0, mode: 'push' }];

  const syncedAt = nowIso();
  const orderIds = new Set(pendingOrders.map((order) => order.id));
  const scopedItems = items.filter((item) => orderIds.has(item.order_id));
  await upsert('orders', pendingOrders.map((order) => pickColumns(order, ORDER_COLUMNS, syncedAt)));
  await upsert('order_items', scopedItems.map((item) => pickColumns(item, ORDER_ITEM_COLUMNS, syncedAt)));
  for (const order of pendingOrders) await putLocal(LOCAL_STORES.orders, markSynced(order, syncedAt));
  return [{ label: 'đơn', count: pendingOrders.length, mode: 'push' }, { label: 'dòng đơn', count: scopedItems.length, mode: 'push' }];
}

async function syncTests() {
  const [tests, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.onaTestItems)
  ]);
  const pendingTests = tests.filter(needsSync);
  const pendingItems = items.filter(needsSync);
  if (!pendingTests.length && !pendingItems.length) {
    return [
      { label: 'file test', count: 0, mode: 'push' },
      { label: 'SP test', count: 0, mode: 'push' },
      { label: 'khách test', count: 0, mode: 'push' },
      { label: 'kết quả test', count: 0, mode: 'push' }
    ];
  }

  const syncedAt = nowIso();
  const testsById = new Map(tests.map((row) => [row.id, row]));
  const files = pendingTests.filter((row) => row.raw_payload?.kind === 'test_file');
  const customers = pendingTests.filter((row) => row.raw_payload?.kind === 'test_customer');
  const fileProducts = pendingItems.filter((item) => testsById.get(item.test_id)?.raw_payload?.kind === 'test_file');
  const customerResults = pendingItems.filter((item) => testsById.get(item.test_id)?.raw_payload?.kind === 'test_customer');

  const fileRows = files.map((file) => ({
    id: file.id,
    title: file.customer_name || 'File test',
    test_date: file.test_date || null,
    sales: file.sales || '',
    note: file.overall_note || '',
    sync_status: 'synced',
    status: cloudStatus(file),
    deleted_at: deletedAt(file),
    raw_payload: rawPayload(file, { kind: 'test_file' }),
    created_at: file.created_at || syncedAt,
    updated_at: file.updated_at || syncedAt,
    synced_at: syncedAt
  }));

  const productRows = fileProducts.map((item, index) => ({
    id: item.id,
    file_id: item.test_id,
    product_name: item.product_name || '',
    sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
    created_at: item.created_at || syncedAt,
    updated_at: item.updated_at || syncedAt,
    status: cloudStatus(item),
    deleted_at: deletedAt(item),
    sync_status: 'synced',
    raw_payload: rawPayload(item, { kind: 'selected_product' }),
    synced_at: syncedAt
  }));

  const customerRows = customers.map((customer) => ({
    id: customer.id,
    file_id: customer.raw_payload?.file_id || '',
    customer_name: customer.customer_name || '',
    phone: customer.customer_phone || '',
    area: customer.area || '',
    status: deletedAt(customer) || customer.status === 'deleted' ? 'deleted' : (customer.overall_status || 'pending'),
    note: customer.overall_note || '',
    sync_status: 'synced',
    created_at: customer.created_at || syncedAt,
    updated_at: customer.updated_at || syncedAt,
    deleted_at: deletedAt(customer),
    raw_payload: rawPayload(customer, { kind: 'test_customer', file_id: customer.raw_payload?.file_id || '' }),
    synced_at: syncedAt
  }));

  const resultRows = customerResults.map((item) => {
    const customer = testsById.get(item.test_id) || {};
    return {
      id: item.id,
      file_id: customer.raw_payload?.file_id || '',
      customer_id: item.test_id,
      product_id: item.product_id || '',
      product_name: item.product_name || '',
      status: deletedAt(item) || item.status === 'deleted' ? 'deleted' : (item.status || 'pending'),
      note: item.note || '',
      created_at: item.created_at || syncedAt,
      updated_at: item.updated_at || syncedAt,
      deleted_at: deletedAt(item),
      sync_status: 'synced',
      raw_payload: rawPayload(item, { kind: 'test_result' }),
      synced_at: syncedAt
    };
  });

  await upsert('test_files', fileRows);
  await upsert('test_file_products', productRows);
  await upsert('test_customers', customerRows);
  await upsert('test_customer_results', resultRows);
  for (const row of pendingTests) await putLocal(LOCAL_STORES.onaTests, markSynced(row, syncedAt));
  for (const row of pendingItems) await putLocal(LOCAL_STORES.onaTestItems, markSynced(row, syncedAt));
  return [
    { label: 'file test', count: fileRows.length, mode: 'push' },
    { label: 'SP test', count: productRows.length, mode: 'push' },
    { label: 'khách test', count: customerRows.length, mode: 'push' },
    { label: 'kết quả test', count: resultRows.length, mode: 'push' }
  ];
}

async function pullTests() {
  const [files, products, customers, results] = await Promise.all([
    fetchRows('test_files'),
    fetchRows('test_file_products'),
    fetchRows('test_customers'),
    fetchRows('test_customer_results')
  ]);
  const filesById = new Map(files.map((file) => [file.id, file]));
  const localTests = [
    ...files.map((file) => ({
      id: file.id,
      test_date: file.test_date || null,
      sales: file.sales || '',
      customer_id: '',
      customer_name: file.title || 'File test',
      customer_phone: '',
      area: '',
      shop_type: '',
      test_type: 'Test sản phẩm',
      follow_date: null,
      need_sample: false,
      overall_status: file.status === 'deleted' ? 'deleted' : 'pending',
      overall_note: file.note || '',
      status: file.status === 'deleted' ? 'deleted' : undefined,
      deleted_at: file.deleted_at || null,
      sync_status: 'synced',
      raw_payload: rawPayload(file, { kind: 'test_file' }),
      created_at: file.created_at || nowIso(),
      updated_at: file.updated_at || file.created_at || nowIso(),
      synced_at: file.synced_at || nowIso()
    })),
    ...customers.map((customer) => {
      const file = filesById.get(customer.file_id) || {};
      return {
        id: customer.id,
        test_date: file.test_date || customer.created_at || null,
        sales: file.sales || '',
        customer_id: '',
        customer_name: customer.customer_name || '',
        customer_phone: customer.phone || '',
        area: customer.area || '',
        shop_type: '',
        test_type: 'Test sản phẩm',
        follow_date: null,
        need_sample: false,
        overall_status: customer.status === 'deleted' ? 'deleted' : (customer.status || 'pending'),
        overall_note: customer.note || '',
        status: customer.status === 'deleted' ? 'deleted' : undefined,
        deleted_at: customer.deleted_at || null,
        sync_status: 'synced',
        raw_payload: rawPayload(customer, { kind: 'test_customer', file_id: customer.file_id || '' }),
        created_at: customer.created_at || nowIso(),
        updated_at: customer.updated_at || customer.created_at || nowIso(),
        synced_at: customer.synced_at || nowIso()
      };
    })
  ];
  const localItems = [
    ...products.map((product) => ({
      id: product.id,
      test_id: product.file_id || '',
      product_id: '',
      product_name: product.product_name || '',
      status: product.status === 'deleted' ? 'deleted' : 'pending',
      note: '',
      deleted_at: product.deleted_at || null,
      sync_status: 'synced',
      raw_payload: rawPayload(product, { kind: 'selected_product', source: 'cloud' }),
      created_at: product.created_at || nowIso(),
      updated_at: product.updated_at || product.created_at || nowIso(),
      synced_at: product.synced_at || nowIso()
    })),
    ...results.map((result) => ({
      id: result.id,
      test_id: result.customer_id || '',
      product_id: result.product_id || '',
      product_name: result.product_name || '',
      status: result.status === 'deleted' ? 'deleted' : (result.status || 'pending'),
      note: result.note || '',
      deleted_at: result.deleted_at || null,
      sync_status: 'synced',
      raw_payload: rawPayload(result, { kind: 'test_result', file_id: result.file_id || '' }),
      created_at: result.created_at || nowIso(),
      updated_at: result.updated_at || result.created_at || nowIso(),
      synced_at: result.synced_at || nowIso()
    }))
  ];
  await putManyLocal(LOCAL_STORES.onaTests, localTests);
  await putManyLocal(LOCAL_STORES.onaTestItems, localItems);
  return [
    { label: 'file test', count: files.length, mode: 'pull' },
    { label: 'SP test', count: products.length, mode: 'pull' },
    { label: 'khách test', count: customers.length, mode: 'pull' },
    { label: 'kết quả test', count: results.length, mode: 'pull' }
  ];
}

async function syncReports() {
  return [await syncStore({ store: LOCAL_STORES.marketReports, table: 'market_reports', columns: MARKET_REPORT_COLUMNS, label: 'báo cáo' })];
}

async function pullBusiness() {
  const results = [];
  for (const group of BUSINESS_GROUPS) results.push(await pullStore(group));
  results.push(await pullTests());
  return results;
}

function summarize(results = []) {
  const flat = results.flat();
  const total = flat.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const detail = flat.filter((item) => item.count).map((item) => `${item.count} ${item.label}`).join(' · ');
  return { total, detail: detail || 'không có dòng mới' };
}

function summarizeByMode(results = [], mode = '') {
  return summarize(results.flat().filter((item) => item.mode === mode));
}

export async function syncBusinessNow({ silent = false } = {}) {
  if (syncing) return { total: 0, detail: 'đang sync' };
  syncing = true;
  setSyncButtonBusy(true);
  setSyncState('Đang sync', 'sync');
  try {
    await loadConfig();
    if (!hasCloud()) {
      setSyncState('Máy', 'local');
      setAdminInfo('Chưa nối đám mây hoặc đang offline. Dữ liệu vẫn lưu máy.');
      if (!silent) toast('Chưa nối đám mây hoặc đang offline.');
      await refreshAdminStats();
      return { total: 0, detail: 'offline' };
    }

    setSyncState('Đám mây', 'ok');
    setAdminInfo(`Đã nối đám mây\n${cfg.supabaseUrl}`);
    const results = [];
    results.push(await syncMcp());
    results.push(await syncOrders());
    results.push(await syncTests());
    results.push(await syncReports());
    results.push(await pullBusiness());
    const pushed = summarizeByMode(results, 'push');
    const pulled = summarizeByMode(results, 'pull');
    await refreshAdminStats(`Đẩy lên: ${pushed.detail}<br>Kéo về: ${pulled.detail}`);
    if (!silent) toast(`Đã đồng bộ. Kéo về: ${pulled.detail}.`);
    window.dispatchEvent(new CustomEvent('mcp:session-changed'));
    window.dispatchEvent(new CustomEvent('report:changed'));
    window.dispatchEvent(new CustomEvent('order:changed'));
    window.dispatchEvent(new CustomEvent('test:changed'));
    normalizeCloudLabels();
    return { total: pushed.total + pulled.total, detail: `push ${pushed.detail}; pull ${pulled.detail}` };
  } catch (error) {
    console.warn('business sync failed', error);
    setSyncState('Lỗi sync', 'error');
    setAdminInfo(`Lỗi sync đám mây: ${error.message}`);
    await refreshAdminStats('Business sync: lỗi');
    if (!silent) toast('Sync business lỗi. Xem Admin để biết thêm.');
    return { total: 0, detail: 'error', error };
  } finally {
    syncing = false;
    setSyncButtonBusy(false);
  }
}

function handleSyncClick(event) {
  if (!event.target.closest('#syncBtn')) return;
  syncBusinessNow().catch((error) => {
    console.warn('business sync click failed', error);
    setSyncState('Lỗi sync', 'error');
    toast('Sync business lỗi.');
  });
  setTimeout(normalizeCloudLabels, 100);
  setTimeout(normalizeCloudLabels, 600);
  setTimeout(normalizeCloudLabels, 1400);
}

async function boot() {
  mountCloudStatusStyle();
  await loadConfig();
  setSyncState(hasCloud() ? 'Đám mây' : 'Máy', hasCloud() ? 'ok' : 'local');
  setAdminInfo(hasCloud() ? `Đã nối đám mây\n${cfg.supabaseUrl}` : 'Chưa nối đám mây hoặc đang offline.');
  normalizeCloudLabels();
}

document.addEventListener('click', handleSyncClick);
window.bepSiSyncBusiness = syncBusinessNow;
boot();
window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('online', boot);
window.addEventListener('offline', boot);
document.addEventListener('click', () => setTimeout(normalizeCloudLabels, 120));