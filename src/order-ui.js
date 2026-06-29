import { makeOrder, makeOrderItem, makeMcpVisit, todayIsoDate, uid } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal, putManyLocal } from '../local-db.js';
import { districtsForProvince, provinceOptions } from './vn-admin-units.js';

const currency = new Intl.NumberFormat('vi-VN');
const statusText = { draft: 'Nháp', pending_confirm: 'Chờ xác nhận', confirmed: 'Đã chốt' };

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

function page() {
  if (document.querySelector('section.page[data-page="order-shell"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page shell-page order-page" data-page="order-shell"></section>');
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return '0đ';
  return `${currency.format(amount)}đ`;
}

async function loadOrders() {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  const sorted = orders.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { orders: sorted, items };
}

function orderItemsOf(order, items) {
  return items.filter((item) => item.order_id === order.id);
}

function card(order, items) {
  const lines = orderItemsOf(order, items);
  const products = lines.map((item) => `${item.product_name} x${item.quantity}`).join(' · ') || 'Chưa có sản phẩm';
  const status = statusText[order.status] || order.status || 'Nháp';
  return `<article class="shell-card" data-order-id="${esc(order.id)}"><div class="shell-card-head"><div><h3>${esc(order.customer_name || 'Khách lẻ')}</h3><small>${esc(products)}</small><small>${esc(order.delivery_address || order.area || '')}</small></div><span class="shell-badge green">${esc(formatMoney(order.grand_total))}</span></div><div class="shell-actions"><button type="button" class="primary-lite" data-order-detail="${esc(order.id)}">Chi tiết</button><button type="button" data-order-detail="${esc(order.id)}">${esc(status)}</button><button type="button" data-order-repeat="${esc(order.id)}">Tạo lại</button></div></article>`;
}

async function render() {
  const section = document.querySelector('section.page[data-page="order-shell"]');
  if (!section) return;
  const { orders, items } = await loadOrders();
  const today = todayIsoDate();
  const todayOrders = orders.filter((order) => order.order_date === today);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const pending = orders.filter((order) => order.status === 'draft' || order.status === 'pending_confirm').length;

  section.innerHTML = `<div class="shell-top"><div class="shell-title"><h1>Đơn hàng</h1><p>Tạo đơn nhanh, lưu local trước khi sync.</p></div><div class="shell-top-actions"><button type="button" class="shell-back" data-page="create">Home</button><button type="button" class="shell-back order-create-btn" data-order-create>+ Đơn</button></div></div><article class="shell-hero order"><b>Tạo đơn nhanh ngoài tuyến</b><small>Khách · sản phẩm · số lượng · đơn giá · ghi chú giao hàng</small></article><div class="shell-grid"><div class="shell-kpis"><div class="shell-kpi"><b>${todayOrders.length}</b><span>Đơn hôm nay</span></div><div class="shell-kpi"><b>${esc(formatMoney(revenue))}</b><span>Doanh số</span></div><div class="shell-kpi"><b>${pending}</b><span>Chờ xử lý</span></div></div><div class="shell-list">${orders.map((order) => card(order, items)).join('') || '<p class="data-shell-note">Chưa có đơn hàng. Bấm + Đơn để tạo đơn đầu tiên.</p>'}</div></div>`;
}

async function customerOptions(selectedId = '') {
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const active = customers.filter((customer) => customer.active !== false).sort((a, b) => String(a.customer_name).localeCompare(String(b.customer_name), 'vi'));
  return '<option value="">Chọn khách MCP</option>' + active.map((customer) => `<option value="${esc(customer.id)}" ${customer.id === selectedId ? 'selected' : ''}>${esc(customer.customer_name)}${customer.area ? ` · ${esc(customer.area)}` : ''}</option>`).join('');
}

function productRow(name = '', quantity = 1, price = '') {
  return `<div class="order-line" data-order-line><input data-order-product placeholder="Sản phẩm" value="${esc(name)}"><input data-order-qty type="number" inputmode="numeric" min="1" value="${esc(quantity)}"><input data-order-price type="number" inputmode="numeric" min="0" placeholder="Giá" value="${esc(price)}"><button type="button" class="secondary" data-order-remove-line>×</button></div>`;
}

function provinceListHtml(province = '') {
  const districts = districtsForProvince(province);
  return `<datalist id="vnProvinceList">${provinceOptions.map((name) => `<option value="${esc(name)}"></option>`).join('')}</datalist><datalist id="vnDistrictList">${districts.map((name) => `<option value="${esc(name)}"></option>`).join('')}</datalist>`;
}

function updateDistrictOptions({ clearInvalid = false } = {}) {
  const province = document.querySelector('#orderProvince')?.value || '';
  const districtInput = document.querySelector('#orderDistrict');
  const list = document.querySelector('#vnDistrictList');
  if (!list) return;
  const districts = districtsForProvince(province);
  list.innerHTML = districts.map((name) => `<option value="${esc(name)}"></option>`).join('');
  if (clearInvalid && districtInput?.value && districts.length && !districts.includes(districtInput.value)) {
    districtInput.value = '';
  }
}

function syncCustomerMode({ clearCustomer = false } = {}) {
  const mode = document.querySelector('#orderCustomerMode')?.value || 'manual';
  const select = document.querySelector('#orderCustomerSelect');
  if (!select) return mode;
  select.disabled = mode !== 'mcp';
  select.closest('label')?.classList.toggle('is-disabled', mode !== 'mcp');
  if (mode !== 'mcp' && clearCustomer) select.value = '';
  return mode;
}

function splitArea(value = '') {
  const text = String(value || '').trim();
  if (!text) return { province: '', district: '' };
  const parts = text.split(/\s*[·,-]\s*/).filter(Boolean);
  if (parts.length >= 2) return { province: parts[0], district: parts.slice(1).join(' · ') };
  return { province: '', district: text };
}

function parseGeoText(value = '') {
  const text = String(value || '').trim();
  if (!text) return { geo_text: '', google_maps_url: '', geo_lat: null, geo_lng: null };
  const url = /^https?:\/\//i.test(text) ? text : '';
  const match = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || text.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const lat = match ? Number(match[1]) : null;
  const lng = match ? Number(match[2]) : null;
  return {
    geo_text: text,
    google_maps_url: url,
    geo_lat: Number.isFinite(lat) ? lat : null,
    geo_lng: Number.isFinite(lng) ? lng : null
  };
}

function composeArea(province = '', district = '') {
  return [province, district].map((item) => String(item || '').trim()).filter(Boolean).join(' · ');
}

async function openOrderModal(seed = {}) {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const selectedCustomerId = seed.route_customer_id || '';
  const options = await customerOptions(selectedCustomerId);
  const split = splitArea(seed.area || '');
  const province = seed.province || seed.raw_payload?.province || split.province;
  const district = seed.district || seed.raw_payload?.district || split.district;
  const geoText = seed.geo_text || seed.raw_payload?.geo_text || seed.raw_payload?.google_maps_url || '';
  const mode = selectedCustomerId ? 'mcp' : 'manual';
  dialog.dataset.type = 'order-create';
  dialog.innerHTML = `<form class="modal" data-order-form><header><h2>Tạo đơn hàng</h2><button type="button" data-close>Đóng</button></header><div class="form order-form">${provinceListHtml(province)}<div class="grid"><label><span>Ngày</span><input id="orderDate" type="date" value="${esc(seed.order_date || todayIsoDate())}"></label><label><span>Sales</span><input id="orderSales" value="${esc(seed.sales || 'A Tân')}"></label></div><div class="grid order-customer-source-row"><label><span>Nguồn khách</span><select id="orderCustomerMode"><option value="manual" ${mode === 'manual' ? 'selected' : ''}>Nhập tay</option><option value="mcp" ${mode === 'mcp' ? 'selected' : ''}>Khách MCP</option></select></label><label><span>Khách MCP</span><select id="orderCustomerSelect" ${mode === 'mcp' ? '' : 'disabled'}>${options}</select></label></div><div class="grid"><label><span>Khách</span><input id="orderCustomerName" required value="${esc(seed.customer_name || '')}"></label><label><span>SĐT</span><input id="orderCustomerPhone" inputmode="tel" value="${esc(seed.customer_phone || '')}"></label></div><div class="grid"><label><span>Tỉnh/TP</span><input id="orderProvince" list="vnProvinceList" autocomplete="address-level1" value="${esc(province)}" placeholder="Bến Tre"></label><label><span>Quận/Huyện</span><input id="orderDistrict" list="vnDistrictList" autocomplete="address-level2" value="${esc(district)}" placeholder="Chợ Lách"></label></div><label><span>Địa chỉ giao</span><input id="orderAddress" autocomplete="street-address" value="${esc(seed.delivery_address || '')}"></label><label><span>Định vị / Google Maps</span><input id="orderGeoText" inputmode="url" value="${esc(geoText)}" placeholder="Dán link Google Maps hoặc tọa độ 10.7,106.6"></label><div class="line"><b>Sản phẩm</b><div id="orderLines">${productRow(seed.product_name || '', seed.quantity || 1, seed.unit_price || '')}</div><button type="button" class="secondary wide" data-order-add-line>+ Thêm sản phẩm</button></div><label><span>Ghi chú giao hàng</span><textarea id="orderNote" rows="2">${esc(seed.note || '')}</textarea></label><div class="total" id="orderTotal"><b>Tổng: 0đ</b></div><button class="primary" data-order-save>Lưu đơn</button></div></form>`;
  dialog.showModal();
  syncCustomerMode();
  updateDistrictOptions();
  if (mode === 'mcp') await fillCustomerFromSelect();
  updateTotal();
  document.querySelector('#orderCustomerName')?.focus();
}

async function fillCustomerFromSelect() {
  const select = document.querySelector('#orderCustomerSelect');
  if (!select?.value || syncCustomerMode() !== 'mcp') return;
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((row) => row.id === select.value);
  if (!customer) return;
  const split = splitArea(customer.area || '');
  const province = customer.raw_payload?.province || split.province || '';
  const district = customer.raw_payload?.district || split.district || customer.area || '';
  document.querySelector('#orderCustomerName').value = customer.customer_name || '';
  document.querySelector('#orderCustomerPhone').value = customer.phone || '';
  document.querySelector('#orderProvince').value = province;
  updateDistrictOptions();
  document.querySelector('#orderDistrict').value = district;
  document.querySelector('#orderAddress').value = customer.address || '';
  const geo = customer.google_maps_url || (customer.geo_lat && customer.geo_lng ? `${customer.geo_lat},${customer.geo_lng}` : '');
  document.querySelector('#orderGeoText').value = geo;
}

function readLines() {
  return [...document.querySelectorAll('[data-order-line]')].map((row) => {
    const quantity = Math.max(1, Number(row.querySelector('[data-order-qty]')?.value || 1));
    const unitPrice = Math.max(0, Number(row.querySelector('[data-order-price]')?.value || 0));
    return {
      product_name: row.querySelector('[data-order-product]')?.value.trim() || '',
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice
    };
  }).filter((line) => line.product_name);
}

function updateTotal() {
  const total = readLines().reduce((sum, line) => sum + line.line_total, 0);
  const element = document.querySelector('#orderTotal');
  if (element) element.innerHTML = `<b>Tổng: ${esc(formatMoney(total))}</b>`;
}

async function markMcpHasOrder(routeCustomerId) {
  if (!routeCustomerId) return;
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((row) => row.id === routeCustomerId);
  if (!customer?.route_id) return;
  const today = todayIsoDate();
  const visits = await getAllLocal(LOCAL_STORES.mcpVisits);
  const existing = visits.find((visit) => visit.route_customer_id === routeCustomerId && visit.visit_date === today);
  const visit = makeMcpVisit({
    ...(existing || {}),
    id: existing?.id || `mcp-visit-${today}-${routeCustomerId}`,
    route_id: customer.route_id,
    route_customer_id: routeCustomerId,
    visit_date: today,
    status: 'order',
    has_order: true,
    note: 'Có đơn hàng'
  });
  await putLocal(LOCAL_STORES.mcpVisits, visit);
}

async function saveOrder(event) {
  event.preventDefault();
  const lines = readLines();
  const customerName = document.querySelector('#orderCustomerName')?.value.trim();
  if (!customerName) return toast('Nhập tên khách trước đã.');
  if (!lines.length) return toast('Thêm ít nhất 1 sản phẩm.');

  const total = lines.reduce((sum, line) => sum + line.line_total, 0);
  const mode = syncCustomerMode();
  const routeCustomerId = mode === 'mcp' ? (document.querySelector('#orderCustomerSelect')?.value || '') : '';
  const province = document.querySelector('#orderProvince')?.value.trim() || '';
  const district = document.querySelector('#orderDistrict')?.value.trim() || '';
  const area = composeArea(province, district);
  const geo = parseGeoText(document.querySelector('#orderGeoText')?.value || '');
  const order = makeOrder({
    id: uid('order'),
    order_date: document.querySelector('#orderDate')?.value || todayIsoDate(),
    sales: document.querySelector('#orderSales')?.value,
    customer_id: routeCustomerId,
    customer_name: customerName,
    customer_phone: document.querySelector('#orderCustomerPhone')?.value,
    area,
    delivery_address: document.querySelector('#orderAddress')?.value,
    source_type: routeCustomerId ? 'mcp' : 'manual',
    source_id: routeCustomerId,
    status: 'pending_confirm',
    subtotal: total,
    grand_total: total,
    note: document.querySelector('#orderNote')?.value,
    sync_status: 'local',
    raw_payload: { kind: 'order', customer_mode: mode, route_customer_id: routeCustomerId, province, district, ...geo }
  });
  const items = lines.map((line) => makeOrderItem({ ...line, id: uid('order-item'), order_id: order.id }));
  await putLocal(LOCAL_STORES.orders, order);
  await putManyLocal(LOCAL_STORES.orderItems, items);
  await markMcpHasOrder(routeCustomerId);
  document.querySelector('#modal')?.close();
  await render();
  toast('Đã lưu đơn hàng vào máy.');
}

async function showDetail(orderId) {
  const { orders, items } = await loadOrders();
  const order = orders.find((row) => row.id === orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  const lines = orderItemsOf(order, items);
  const geo = order.raw_payload?.google_maps_url || order.raw_payload?.geo_text || '';
  const geoLine = geo ? `<p class="data-shell-note">Định vị: ${esc(geo)}</p>` : '';
  const dialog = document.querySelector('#modal');
  dialog.dataset.type = 'order-detail';
  dialog.innerHTML = `<div class="modal"><header><h2>${esc(order.customer_name || 'Đơn hàng')}</h2><button type="button" data-close>Đóng</button></header><div class="total"><b>${esc(formatMoney(order.grand_total))}</b><br><small>${esc(order.order_date || '')} · ${esc(order.area || '')}</small></div>${lines.map((line) => `<article class="line"><b>${esc(line.product_name)}</b><small>SL ${esc(line.quantity)} · Giá ${esc(formatMoney(line.unit_price))} · Thành tiền ${esc(formatMoney(line.line_total))}</small></article>`).join('') || '<p class="empty">Chưa có sản phẩm.</p>'}${order.delivery_address ? `<p class="data-shell-note">Địa chỉ: ${esc(order.delivery_address)}</p>` : ''}${geoLine}${order.note ? `<p class="data-shell-note">${esc(order.note)}</p>` : ''}</div>`;
  dialog.showModal();
}

async function repeatOrder(orderId) {
  const { orders, items } = await loadOrders();
  const order = orders.find((row) => row.id === orderId);
  const first = orderItemsOf(order || {}, items)[0];
  if (!order) return toast('Không tìm thấy đơn.');
  await openOrderModal({
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    area: order.area,
    province: order.raw_payload?.province,
    district: order.raw_payload?.district,
    geo_text: order.raw_payload?.geo_text || order.raw_payload?.google_maps_url,
    delivery_address: order.delivery_address,
    note: order.note,
    route_customer_id: order.raw_payload?.route_customer_id || order.customer_id,
    product_name: first?.product_name || '',
    quantity: first?.quantity || 1,
    unit_price: first?.unit_price || ''
  });
}

function boot() {
  page();
  render().catch((error) => {
    console.warn('order render failed', error);
    toast('Không mở được dữ liệu đơn hàng local.');
  });
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-order-create]')) {
    event.preventDefault();
    openOrderModal();
    return;
  }
  if (event.target.closest('[data-order-add-line]')) {
    event.preventDefault();
    document.querySelector('#orderLines')?.insertAdjacentHTML('beforeend', productRow());
    updateTotal();
    return;
  }
  const remove = event.target.closest('[data-order-remove-line]');
  if (remove) {
    event.preventDefault();
    const rows = document.querySelectorAll('[data-order-line]');
    if (rows.length > 1) remove.closest('[data-order-line]')?.remove();
    updateTotal();
    return;
  }
  const detail = event.target.closest('[data-order-detail]');
  if (detail) {
    event.preventDefault();
    showDetail(detail.dataset.orderDetail);
    return;
  }
  const repeat = event.target.closest('[data-order-repeat]');
  if (repeat) {
    event.preventDefault();
    repeatOrder(repeat.dataset.orderRepeat);
  }
}, true);

document.addEventListener('change', (event) => {
  if (event.target.closest('#orderCustomerMode')) syncCustomerMode({ clearCustomer: true });
  if (event.target.closest('#orderCustomerSelect')) fillCustomerFromSelect();
  if (event.target.closest('#orderProvince')) updateDistrictOptions({ clearInvalid: true });
  if (event.target.closest('[data-order-line]')) updateTotal();
});

document.addEventListener('input', (event) => {
  if (event.target.closest('#orderProvince')) updateDistrictOptions({ clearInvalid: true });
  if (event.target.closest('[data-order-line]')) updateTotal();
});

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-order-form]')) return;
  saveOrder(event);
});

boot();
window.addEventListener('DOMContentLoaded', boot);
