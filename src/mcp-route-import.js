import { makeMcpRoute, makeMcpRouteCustomer, nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal, putManyLocal } from '../local-db.js';

const WEEKDAY_MAP = new Map([
  ['cn', 0], ['chu nhat', 0], ['chủ nhật', 0], ['sunday', 0], ['sun', 0],
  ['t2', 1], ['thu 2', 1], ['thứ 2', 1], ['thứ hai', 1], ['monday', 1], ['mon', 1], ['2', 1],
  ['t3', 2], ['thu 3', 2], ['thứ 3', 2], ['thứ ba', 2], ['tuesday', 2], ['tue', 2], ['3', 2],
  ['t4', 3], ['thu 4', 3], ['thứ 4', 3], ['thứ tư', 3], ['wednesday', 3], ['wed', 3], ['4', 3],
  ['t5', 4], ['thu 5', 4], ['thứ 5', 4], ['thứ năm', 4], ['thursday', 4], ['thu', 4], ['5', 4],
  ['t6', 5], ['thu 6', 5], ['thứ 6', 5], ['thứ sáu', 5], ['friday', 5], ['fri', 5], ['6', 5],
  ['t7', 6], ['thu 7', 6], ['thứ 7', 6], ['thứ bảy', 6], ['saturday', 6], ['sat', 6], ['7', 6]
]);

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function normalize(value = '') {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function clean(value = '') {
  return String(value ?? '').trim();
}

function parseWeekday(value) {
  const raw = clean(value);
  if (!raw) return new Date().getDay();
  const normalized = normalize(raw);
  if (WEEKDAY_MAP.has(raw.toLowerCase())) return WEEKDAY_MAP.get(raw.toLowerCase());
  if (WEEKDAY_MAP.has(normalized)) return WEEKDAY_MAP.get(normalized);
  const number = Number(raw);
  if (Number.isFinite(number)) return Math.max(0, Math.min(6, Math.trunc(number)));
  return new Date().getDay();
}

function splitLine(line) {
  const delimiter = line.includes('\t') ? '\t' : ',';
  const output = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      output.push(clean(current));
      current = '';
      continue;
    }
    current += char;
  }
  output.push(clean(current));
  return output;
}

function headerIndex(headers, names) {
  const normalized = headers.map(normalize);
  return names.map(normalize).map((name) => normalized.indexOf(name)).find((index) => index >= 0) ?? -1;
}

function parseRows(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = splitLine(lines[0]);
  const hasHeader = first.some((cell) => ['route_name', 'ten tuyen', 'tuyến', 'customer_name', 'khach', 'khách', 'sdt', 'phone'].includes(normalize(cell)));
  const headers = hasHeader ? first : [];
  const rows = (hasHeader ? lines.slice(1) : lines).map(splitLine);

  const routeIndex = hasHeader ? headerIndex(headers, ['route_name', 'tuyen', 'tuyến', 'ten tuyen', 'tên tuyến']) : 0;
  const weekdayIndex = hasHeader ? headerIndex(headers, ['weekday', 'thu', 'thứ', 'ngay', 'ngày']) : 1;
  const areaIndex = hasHeader ? headerIndex(headers, ['area', 'khu vuc', 'khu vực']) : 2;
  const customerIndex = hasHeader ? headerIndex(headers, ['customer_name', 'khach', 'khách', 'ten khach', 'tên khách']) : 3;
  const phoneIndex = hasHeader ? headerIndex(headers, ['phone', 'sdt', 'sđt', 'so dien thoai', 'số điện thoại']) : 4;
  const addressIndex = hasHeader ? headerIndex(headers, ['address', 'dia chi', 'địa chỉ']) : 5;
  const noteIndex = hasHeader ? headerIndex(headers, ['note', 'ghi chu', 'ghi chú']) : 6;
  const latIndex = hasHeader ? headerIndex(headers, ['lat', 'geo_lat', 'latitude']) : 7;
  const lngIndex = hasHeader ? headerIndex(headers, ['lng', 'geo_lng', 'longitude']) : 8;

  return rows.map((cells, index) => ({
    rowNumber: index + 1 + (hasHeader ? 1 : 0),
    route_name: clean(cells[routeIndex]),
    weekday: parseWeekday(cells[weekdayIndex]),
    area: clean(cells[areaIndex]),
    customer_name: clean(cells[customerIndex]),
    phone: clean(cells[phoneIndex]),
    address: clean(cells[addressIndex]),
    note: clean(cells[noteIndex]),
    geo_lat: clean(cells[latIndex]),
    geo_lng: clean(cells[lngIndex])
  })).filter((row) => row.route_name || row.customer_name);
}

function routeKey(route) {
  return [normalize(route.route_name), Number(route.weekday || 0), normalize(route.area)].join('|');
}

function customerKey(customer) {
  return [customer.route_id, normalize(customer.customer_name), normalize(customer.phone)].join('|');
}

function ensureCss() {
  if (document.querySelector('style[data-mcp-route-import-ui]')) return;
  const style = document.createElement('style');
  style.dataset.mcpRouteImportUi = '1';
  style.textContent = `
    #modal[data-type="mcp-import"]{box-sizing:border-box!important;width:min(400px,calc(100vw - 18px))!important;max-width:calc(100vw - 18px)!important;max-height:calc(100dvh - 18px)!important;border-radius:18px!important;overflow:hidden!important;background:#fff!important;box-shadow:0 24px 70px rgba(8,35,55,.22)!important}
    #modal[data-type="mcp-import"] .modal{box-sizing:border-box!important;width:100%!important;max-height:calc(100dvh - 18px)!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;display:grid!important;gap:12px!important;padding:15px!important}
    #modal[data-type="mcp-import"] header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;position:sticky!important;top:0!important;z-index:2!important;background:#fff!important;padding-bottom:4px!important}
    #modal[data-type="mcp-import"] h2{margin:0!important;font-size:19px!important;line-height:1.18!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #modal[data-type="mcp-import"] header button{flex:0 0 auto!important;min-height:34px!important;border:1px solid #dce8e5!important;border-radius:999px!important;background:#fbfffd!important;color:#17343d!important;padding:0 11px!important;font-weight:850!important}
    #modal[data-type="mcp-import"] .form{display:grid!important;gap:10px!important;min-width:0!important}
    #modal[data-type="mcp-import"] .line{display:grid!important;gap:7px!important;border:1px solid #dce8e5!important;border-radius:14px!important;background:#fbfffd!important;padding:10px!important;min-width:0!important;overflow:hidden!important}
    #modal[data-type="mcp-import"] textarea{box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:100%!important;min-height:210px!important;border:1px solid #cad7d4!important;border-radius:12px!important;background:#fff!important;color:#082337!important;padding:10px!important;font-size:16px!important;line-height:1.35!important;outline:none!important;resize:vertical!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important}
    #modal[data-type="mcp-import"] textarea:focus{border-color:#00957f!important;box-shadow:0 0 0 3px rgba(0,149,127,.13)!important}
    #modal[data-type="mcp-import"] .primary{width:100%!important;min-height:44px!important;border-radius:13px!important}
    #modal[data-type="mcp-import"] small{color:#63727c!important;line-height:1.35!important}
  `;
  document.head.appendChild(style);
}

function exampleText() {
  return 'route_name,weekday,area,customer_name,phone,address,note,lat,lng\nTuyến A,T2,Chợ Lớn,Tạp hoá Minh Anh,0900000000,12 Nguyễn Trãi,Ghé sáng,,\nTuyến A,T2,Chợ Lớn,Cafe Góc Phố,0911111111,45 Trần Hưng Đạo,Ưu tiên trà lài,,';
}

function openImportModal() {
  ensureCss();
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-import';
  dialog.innerHTML = `<form class="modal" data-mcp-import-form>
    <header><h2>Import tuyến MCP</h2><button type="button" data-close>Đóng</button></header>
    <div class="form">
      <article class="line"><b>Dán CSV/TSV tuyến cố định</b><small>Cột hỗ trợ: route_name, weekday, area, customer_name, phone, address, note, lat, lng. Có thể dùng T2/T3 hoặc số 1-6, CN/0.</small></article>
      <textarea id="mcpImportText" spellcheck="false">${esc(exampleText())}</textarea>
      <button class="primary" data-mcp-run-import>Import vào MCP local</button>
    </div>
  </form>`;
  if (!dialog.open) dialog.showModal();
  document.querySelector('#mcpImportText')?.focus();
}

async function runImport(event) {
  event.preventDefault();
  const text = document.querySelector('#mcpImportText')?.value || '';
  const rows = parseRows(text);
  if (!rows.length) return toast('Không có dòng hợp lệ để import.');
  const invalid = rows.find((row) => !row.route_name || !row.customer_name);
  if (invalid) return toast(`Dòng ${invalid.rowNumber} thiếu tuyến hoặc tên khách.`);

  const now = nowIso();
  const [existingRoutes, existingCustomers] = await Promise.all([
    getAllLocal(LOCAL_STORES.mcpRoutes),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers)
  ]);
  const routesByKey = new Map(existingRoutes.map((route) => [routeKey(route), route]));
  const customersByKey = new Map(existingCustomers.map((customer) => [customerKey(customer), customer]));
  const routeOrder = new Map();
  const routesToSave = [];
  const customersToSave = [];

  for (const row of rows) {
    const draftRoute = { route_name: row.route_name, weekday: row.weekday, area: row.area };
    const key = routeKey(draftRoute);
    let route = routesByKey.get(key);
    if (!route) {
      route = makeMcpRoute({ ...draftRoute, sync_status: 'local', raw_payload: { kind: 'mcp_import_route', imported_at: now } });
      routesByKey.set(key, route);
      routesToSave.push(route);
    }
    const currentOrder = routeOrder.get(route.id) || existingCustomers.filter((customer) => customer.route_id === route.id).length;
    const draftCustomer = makeMcpRouteCustomer({
      route_id: route.id,
      customer_name: row.customer_name,
      phone: row.phone,
      area: row.area || route.area,
      address: row.address,
      note: row.note,
      geo_lat: row.geo_lat,
      geo_lng: row.geo_lng,
      sort_order: currentOrder + 1,
      sync_status: 'local',
      raw_payload: { kind: 'mcp_import_customer', imported_at: now, source_row: row.rowNumber }
    });
    const cKey = customerKey(draftCustomer);
    if (customersByKey.has(cKey)) continue;
    customersByKey.set(cKey, draftCustomer);
    routeOrder.set(route.id, currentOrder + 1);
    customersToSave.push(draftCustomer);
  }

  if (routesToSave.length) await putManyLocal(LOCAL_STORES.mcpRoutes, routesToSave);
  if (customersToSave.length) await putManyLocal(LOCAL_STORES.mcpRouteCustomers, customersToSave);
  if (!routesToSave.length && !customersToSave.length) return toast('Các tuyến/khách này đã có trong MCP local.');
  document.querySelector('#modal')?.close();
  window.dispatchEvent(new CustomEvent('mcp:routes-imported'));
  toast(`Đã import ${routesToSave.length} tuyến, ${customersToSave.length} khách.`);
}

function ensureImportButton() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  const filters = section.querySelector('.mcp-filters');
  if (filters && !filters.querySelector('[data-mcp-import-route]')) {
    filters.insertAdjacentHTML('afterbegin', '<button type="button" class="mcp-filter" data-mcp-import-route>Import</button>');
  }
  const noSessionList = section.querySelector('.mcp-list');
  if (noSessionList && !section.querySelector('.mcp-filters') && !noSessionList.querySelector('[data-mcp-import-route]')) {
    noSessionList.insertAdjacentHTML('beforeend', '<button type="button" class="secondary wide" data-mcp-import-route>Import tuyến cố định</button>');
  }
}

function boot() {
  ensureCss();
  ensureImportButton();
}

window.addEventListener('click', (event) => {
  const button = event.target.closest('[data-mcp-import-route]');
  if (button && button.closest('section.page[data-page="mcp"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openImportModal();
  }
}, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-import-form]')) return;
  runImport(event).catch((error) => {
    console.warn('mcp import failed', error);
    toast('Import MCP lỗi. Kiểm tra định dạng dữ liệu.');
  });
});

window.addEventListener('mcp:session-changed', () => setTimeout(ensureImportButton, 0));
window.addEventListener('mcp:routes-imported', () => setTimeout(ensureImportButton, 0));
const observer = new MutationObserver(() => ensureImportButton());
observer.observe(document.documentElement, { childList: true, subtree: true });
boot();
window.addEventListener('DOMContentLoaded', boot);
