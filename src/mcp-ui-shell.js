import './business-ui-shells.js';
import { makeGoogleMapsUrl, makeMcpRouteCustomer, nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';
import { getActiveMcpSessionDetail, recalcMcpRouteSession, upsertMcpVisitForSession } from './mcp-core.js';

const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const statusLabel = { todo: 'Chưa ghé', done: 'Đã ghé', checked_in: 'Đã ghé', order: 'Có đơn', test: 'Có test', report: 'Có báo cáo', no: 'Không mua', no_buy: 'Không mua', follow_up: 'Theo dõi', skipped: 'Bỏ qua' };
const statusNote = { done: 'Đã check-in', checked_in: 'Đã check-in', order: 'Đánh dấu có đơn', test: 'Đánh dấu có test', report: 'Đánh dấu có báo cáo', no: 'Đã ghé nhưng không mua', no_buy: 'Đã ghé nhưng không mua' };
let activeFilter = 'all';

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

function css() { /* Shell styles are preloaded from polish.css to avoid first-load reflow. */ }

function page() {
  if (document.querySelector('section.page[data-page="mcp"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page mcp-page" data-page="mcp"></section>');
}

async function loadState() {
  const detail = await getActiveMcpSessionDetail();
  if (!detail) return null;
  const session = detail.session;
  const route = detail.route || { id: session.route_id, route_name: session.route_name, area: session.area };
  return {
    session,
    route,
    customers: detail.customers,
    visits: detail.visits,
    stats: detail.stats,
    today: session.session_date
  };
}

function visitFor(customer, visits) {
  return visits.find((visit) => visit.route_customer_id === customer.id) || null;
}

function statusOf(customer, visits) {
  const visit = visitFor(customer, visits);
  if (!visit) return 'todo';
  if (visit.status === 'order' || visit.has_order) return 'order';
  if (visit.status === 'test' || visit.has_test) return 'test';
  if (visit.status === 'report' || visit.has_report) return 'report';
  if (visit.status === 'no_buy') return 'no';
  return visit.status || 'done';
}

function statusClasses(status) {
  const base = status === 'todo' ? 'todo' : 'done';
  return [base, status].filter(Boolean).join(' ');
}

function statCount(customers, visits, status) {
  return customers.filter((customer) => statusOf(customer, visits) === status).length;
}

function customerMapUrl(customer) {
  return customer.google_maps_url || makeGoogleMapsUrl(customer.geo_lat, customer.geo_lng);
}

function renderLocation(customer) {
  const url = customerMapUrl(customer);
  if (!url) return '';
  const accuracy = Number.isFinite(Number(customer.geo_accuracy)) ? ` · ±${Math.round(Number(customer.geo_accuracy))}m` : '';
  return `<small class="mcp-location">📍 Đã lưu vị trí${accuracy} <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở Google Maps</a></small>`;
}

function renderCards(customers, visits) {
  const filtered = customers.filter((customer) => {
    const status = statusOf(customer, visits);
    return activeFilter === 'all' || status === activeFilter || (activeFilter === 'done' && status !== 'todo');
  });

  if (!customers.length) {
    return '<p class="mcp-empty">Tuyến này chưa có khách. Bấm + Khách để thêm khách đầu tiên.</p>';
  }
  if (!filtered.length) return '<p class="mcp-empty">Không có khách trong bộ lọc này.</p>';

  return filtered.map((customer) => {
    const status = statusOf(customer, visits);
    const detail = [customer.area, customer.phone, customer.address].filter(Boolean).join(' · ') || 'Khách trong tuyến';
    return `<article class="mcp-customer" data-status="${esc(statusClasses(status))}" data-customer-id="${esc(customer.id)}">
      <div class="mcp-customer-head"><div><h3>${esc(customer.customer_name)}</h3><small>${esc(detail)}</small></div><span class="mcp-badge ${esc(status)}">${esc(statusLabel[status] || status)}</span></div>
      ${customer.note ? `<small class="mcp-note">${esc(customer.note)}</small>` : ''}
      ${renderLocation(customer)}
      <div class="mcp-actions">
        <button type="button" data-mcp-status="done" data-customer-id="${esc(customer.id)}">Check-in</button>
        <button type="button" data-mcp-status="order" data-customer-id="${esc(customer.id)}">Có đơn</button>
        <button type="button" data-mcp-status="test" data-customer-id="${esc(customer.id)}">Có test</button>
        <button type="button" data-mcp-status="no" data-customer-id="${esc(customer.id)}">Không mua</button>
      </div>
    </article>`;
  }).join('');
}

function renderNoSession(section) {
  section.innerHTML = `<article class="mcp-route-card"><div class="mcp-route-main"><small>Chưa chọn phiên tuyến</small><b>MCP tuyến</b><p>Chọn ngày và tuyến trước khi thao tác khách.</p></div><div class="mcp-score"><span><b>0</b> khách</span><span><b>0</b> ghé</span></div></article><div class="mcp-list-wrap"><div class="mcp-list"><p class="mcp-empty">Chưa có phiên MCP đang mở. Bấm nút bên dưới để chọn ngày/tuyến.</p><button type="button" class="primary wide" data-mcp-start>Chọn / bắt đầu tuyến</button></div></div>`;
}

async function render() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  const state = await loadState();
  if (!state) return renderNoSession(section);
  const { session, route, customers, visits, today } = state;
  const done = customers.filter((customer) => statusOf(customer, visits) !== 'todo').length;
  const order = statCount(customers, visits, 'order');
  const test = statCount(customers, visits, 'test');
  const weekday = weekdayNames[Number(session.weekday)] || 'Phiên tuyến';
  const filters = [
    ['all', 'Tất cả'],
    ['todo', 'Chưa ghé'],
    ['done', 'Đã ghé'],
    ['order', 'Có đơn'],
    ['test', 'Có test'],
    ['no', 'Không mua']
  ];

  section.innerHTML = `<article class="mcp-route-card"><div class="mcp-route-main"><small>${esc(weekday)} · ${esc(today)}</small><b>${esc(route.route_name || session.route_name || 'Tuyến')} · ${esc(route.area || session.area || 'Chưa đặt khu vực')}</b><p>Phiên MCP đang thao tác.</p></div><div class="mcp-score"><span><b>${customers.length}</b> khách</span><span><b>${done}</b> ghé</span></div></article>
    <div class="mcp-stats"><div class="mcp-stat"><b>${customers.length}</b><span>Khách</span></div><div class="mcp-stat"><b>${done}</b><span>Đã ghé</span></div><div class="mcp-stat"><b>${order}</b><span>Có đơn</span></div><div class="mcp-stat"><b>${test}</b><span>Có test</span></div></div>
    <div class="mcp-list-wrap"><div class="mcp-filters"><button type="button" class="mcp-filter mcp-add" data-mcp-add-customer>+ Khách</button><button type="button" class="mcp-filter" data-mcp-start>Đổi tuyến</button>${filters.map(([value, label]) => `<button type="button" class="mcp-filter ${activeFilter === value ? 'active' : ''}" data-mcp-filter="${value}">${label}</button>`).join('')}</div><div class="mcp-list">${renderCards(customers, visits)}</div></div>`;
}

function openCustomerModal() {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-customer';
  dialog.innerHTML = `<form class="modal" data-mcp-customer-form><header><h2>Thêm khách vào tuyến</h2><button type="button" data-close>Đóng</button></header><div class="form"><div class="grid"><label><span>Khách</span><input id="mcpCustomerName" required placeholder="Tên quán / đại lý"></label><label><span>SĐT</span><input id="mcpCustomerPhone" inputmode="tel"></label></div><label><span>Khu vực</span><input id="mcpCustomerArea" placeholder="Ví dụ: Chợ Lớn"></label><label><span>Địa chỉ</span><input id="mcpCustomerAddress"></label><article class="line"><b>Vị trí khách</b><small id="mcpGeoStatus">Chưa lấy vị trí. Đứng tại khách rồi bấm nút bên dưới.</small><button type="button" class="secondary wide" data-mcp-get-location>📍 Lấy vị trí hiện tại</button><a id="mcpGeoMapLink" class="secondary wide" href="#" target="_blank" rel="noopener noreferrer" hidden>Mở Google Maps</a><input id="mcpGeoLat" type="hidden"><input id="mcpGeoLng" type="hidden"><input id="mcpGeoAccuracy" type="hidden"><input id="mcpGeoCapturedAt" type="hidden"><input id="mcpGoogleMapsUrl" type="hidden"></article><label><span>Ghi chú tuyến</span><textarea id="mcpCustomerNote" rows="2" placeholder="Giờ ghé, người liên hệ, ưu tiên..."></textarea></label><button class="primary" data-mcp-save-customer>Thêm vào tuyến</button></div></form>`;
  if (!dialog.open) dialog.showModal();
  document.querySelector('#mcpCustomerName')?.focus();
}

function setGeoFields({ latitude, longitude, accuracy }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const acc = Number(accuracy);
  const url = makeGoogleMapsUrl(lat, lng);
  const capturedAt = nowIso();
  const setValue = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.value = value ?? '';
  };
  setValue('#mcpGeoLat', lat);
  setValue('#mcpGeoLng', lng);
  setValue('#mcpGeoAccuracy', Number.isFinite(acc) ? Math.round(acc) : '');
  setValue('#mcpGeoCapturedAt', capturedAt);
  setValue('#mcpGoogleMapsUrl', url);
  const status = document.querySelector('#mcpGeoStatus');
  if (status) status.textContent = `Đã lấy vị trí: ${lat.toFixed(6)}, ${lng.toFixed(6)}${Number.isFinite(acc) ? ` · độ chính xác ±${Math.round(acc)}m` : ''}`;
  const link = document.querySelector('#mcpGeoMapLink');
  if (link && url) {
    link.href = url;
    link.hidden = false;
  }
}

function requestCustomerLocation() {
  const status = document.querySelector('#mcpGeoStatus');
  if (!navigator.geolocation) {
    if (status) status.textContent = 'Máy/trình duyệt không hỗ trợ lấy vị trí.';
    return toast('Máy không hỗ trợ lấy vị trí.');
  }
  if (status) status.textContent = 'Đang lấy vị trí, vui lòng cho phép quyền GPS...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      setGeoFields({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      toast('Đã lấy vị trí khách.');
    },
    (error) => {
      const message = error.code === error.PERMISSION_DENIED ? 'Bạn chưa cho phép quyền vị trí.' : 'Không lấy được vị trí. Thử đứng ngoài trời hoặc bật GPS.';
      if (status) status.textContent = message;
      toast(message);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

async function saveCustomer(event) {
  event.preventDefault();
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi thêm khách.');
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const current = customers.filter((customer) => customer.route_id === state.session.route_id);
  const name = document.querySelector('#mcpCustomerName')?.value.trim();
  if (!name) return toast('Nhập tên khách trước đã.');
  const row = makeMcpRouteCustomer({
    route_id: state.session.route_id,
    customer_name: name,
    phone: document.querySelector('#mcpCustomerPhone')?.value,
    area: document.querySelector('#mcpCustomerArea')?.value || state.route.area || state.session.area,
    address: document.querySelector('#mcpCustomerAddress')?.value,
    note: document.querySelector('#mcpCustomerNote')?.value,
    geo_lat: document.querySelector('#mcpGeoLat')?.value,
    geo_lng: document.querySelector('#mcpGeoLng')?.value,
    geo_accuracy: document.querySelector('#mcpGeoAccuracy')?.value,
    geo_captured_at: document.querySelector('#mcpGeoCapturedAt')?.value || null,
    geo_source: document.querySelector('#mcpGeoLat')?.value ? 'gps' : '',
    google_maps_url: document.querySelector('#mcpGoogleMapsUrl')?.value,
    sort_order: current.length + 1
  });
  await putLocal(LOCAL_STORES.mcpRouteCustomers, row);
  await recalcMcpRouteSession(state.session.id);
  document.querySelector('#modal')?.close();
  await render();
  toast(row.google_maps_url ? 'Đã thêm khách và lưu vị trí.' : 'Đã thêm khách vào tuyến.');
}

async function setVisitStatus(customerId, status) {
  const state = await loadState();
  if (!state) return toast('Chọn phiên tuyến trước khi cập nhật.');
  const existing = state.visits.find((visit) => visit.route_customer_id === customerId);
  await upsertMcpVisitForSession({
    ...(existing || {}),
    session_id: state.session.id,
    route_customer_id: customerId,
    status,
    has_order: status === 'order' || existing?.has_order,
    has_test: status === 'test' || existing?.has_test,
    has_report: status === 'report' || existing?.has_report,
    note: statusNote[status] || existing?.note || ''
  });
  await render();
  toast(statusLabel[status] ? `Đã cập nhật: ${statusLabel[status]}` : 'Đã cập nhật trạng thái.');
}

function isInActiveMcpPage(target) {
  return Boolean(target?.closest?.('section.page[data-page="mcp"].active'));
}

function handleMcpActionClick(event) {
  const geoButton = event.target.closest('[data-mcp-get-location]');
  if (geoButton && event.target.closest('#modal[data-type="mcp-customer"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    requestCustomerLocation();
    return;
  }
  if (!isInActiveMcpPage(event.target)) return;
  const addButton = event.target.closest('[data-mcp-add-customer]');
  if (addButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCustomerModal();
    return;
  }
  const filter = event.target.closest('[data-mcp-filter]');
  if (filter) {
    event.preventDefault();
    event.stopImmediatePropagation();
    activeFilter = filter.dataset.mcpFilter || 'all';
    render();
    return;
  }
  const statusButton = event.target.closest('[data-mcp-status]');
  if (statusButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setVisitStatus(statusButton.dataset.customerId, statusButton.dataset.mcpStatus);
  }
}

function boot() {
  css();
  page();
  render().catch((error) => {
    console.warn('mcp render failed', error);
    toast('Không mở được dữ liệu MCP local.');
  });
}

window.addEventListener('click', handleMcpActionClick, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-customer-form]')) return;
  saveCustomer(event);
});

window.addEventListener('mcp:session-changed', () => render());
boot();
window.addEventListener('DOMContentLoaded', boot);
