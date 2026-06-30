# Order Revenue Data Audit

Ngày audit: 2026-06-30

Mục tiêu: kiểm tra dữ liệu `orders` và `order_items` hiện tại có đủ nền để làm thống kê doanh thu, xuất Excel/PDF, và báo cáo theo khách/ngành/SKU/tuyến hay chưa.

## 1. Kết luận nhanh

Hiện tại cấu trúc đơn hàng **đủ để tính doanh thu cơ bản**:

- doanh thu theo ngày
- doanh thu theo khách
- doanh thu theo sales
- doanh thu theo khu vực/tuyến nếu lấy từ `area` hoặc `raw_payload.mcp_route_name`
- doanh thu theo SKU
- doanh thu theo sản phẩm

Nhưng còn **thiếu field phẳng trên `order_items`** để thống kê theo ngành/category một cách sạch:

- `industry`
- `industry_key`
- `category`
- `category_key`
- `brand`
- `choice_text` hoặc `flavor`

Hiện các thông tin này có thể nằm trong `order_items.raw_payload.catalog_product`, nhưng không nên bắt UI thống kê phải đọc sâu vào `raw_payload` lâu dài.

## 2. Orders hiện có

`makeOrder()` đang chuẩn hoá các field chính:

```txt
id
order_code
order_date
sales
customer_id
customer_name
customer_phone
area
delivery_address
source_type
source_id
status
subtotal
discount_total
grand_total
note
sync_status
raw_payload
created_at
updated_at
synced_at
```

Trong flow tạo đơn, `saveOrder()` đang set thêm các dữ liệu quan trọng:

```txt
order_date
sales
customer_id
customer_name
customer_phone
area
delivery_address
source_type
source_id
status = pending_confirm
subtotal
grand_total
note
sync_status = local
raw_payload.kind
raw_payload.customer_source
raw_payload.route_customer_id
raw_payload.mcp_session_id
raw_payload.mcp_route_id
raw_payload.mcp_route_name
raw_payload.product_catalog
raw_payload.province
raw_payload.district
raw_payload.geo_text / google_maps_url / geo_lat / geo_lng
```

Đánh giá:

- Đủ cho thống kê tổng quan.
- Đủ cho thống kê theo ngày/khách/sales/khu vực.
- Có MCP route trong `raw_payload`, nhưng chưa có `route_id` / `route_name` phẳng trên order.
- Chưa có xoá mềm: chưa thấy `deleted_at`, `deleted_by`, `delete_reason` hoặc status `deleted`.

## 3. Order items hiện có

`readLines()` đang tạo line có các field:

```txt
product_id
product_name
sku
unit
quantity
unit_price
line_total
raw_payload.source
raw_payload.catalog_product
raw_payload.choices
raw_payload.choice_required
raw_payload.missing_choice
```

`makeOrderItem()` đang chuẩn hoá thành:

```txt
id
order_id
product_id
product_name
sku
unit
quantity
unit_price
discount
line_total
note
raw_payload
created_at
```

Đánh giá:

- Đủ cho thống kê theo SKU.
- Đủ cho thống kê theo sản phẩm.
- Đủ cho tính doanh thu từ `line_total`.
- Có thể lấy ngành/category từ `raw_payload.catalog_product`, nhưng chưa tối ưu.
- Chưa có `updated_at` / `sync_status` trên item. Sync item hiện đi theo order pending nên tạm ổn, nhưng nếu sửa item riêng sau này cần cân nhắc.

## 4. Sync Supabase hiện có

`ORDER_COLUMNS` hiện sync:

```txt
id, order_code, order_date, sales, customer_id, customer_name, customer_phone,
area, delivery_address, source_type, source_id, status, subtotal, discount_total,
grand_total, note, sync_status, raw_payload, created_at, updated_at, synced_at
```

`ORDER_ITEM_COLUMNS` hiện sync:

```txt
id, order_id, product_id, product_name, sku, unit, quantity, unit_price,
discount, line_total, note, raw_payload, created_at
```

Đánh giá:

- Không nên đổi schema Supabase ngay ở bước kế tiếp.
- Nếu cần thống kê local trước, có thể đọc `raw_payload.catalog_product` để lấy ngành/category.
- Khi đã ổn mới cân nhắc thêm cột phẳng cho category/industry vào item và sync.

## 5. Rủi ro dữ liệu hiện tại

### 5.1. Doanh thu theo ngành chưa sạch

Lý do: `industry_key/category_key` chưa nằm phẳng trên `order_items`.

Cách tạm ổn cho Phase 2:

```js
const product = item.raw_payload?.catalog_product || {};
const industryKey = item.industry_key || product.industry_key || 'khac';
const industry = item.industry || product.industry || 'Khác';
```

Sau này nếu chuẩn hoá sâu hơn, mới bổ sung field phẳng.

### 5.2. Doanh thu theo tuyến chưa sạch hoàn toàn

Hiện route nằm trong:

```txt
order.raw_payload.mcp_route_id
order.raw_payload.mcp_route_name
```

Cách tạm ổn:

```js
const routeName = order.route_name || order.raw_payload?.mcp_route_name || order.area || 'Chưa rõ tuyến';
```

### 5.3. Xoá đơn chưa có cơ chế mềm

Hiện `ORDER_STATUSES` chưa có `deleted`. Có `cancelled`.

Khuyến nghị an toàn:

- Giai đoạn đầu dùng `cancelled` để loại khỏi doanh thu.
- Nếu cần xoá mềm riêng, thêm field vào `raw_payload.deleted_at`, `raw_payload.delete_reason` trước, chưa đổi schema.

### 5.4. Tổng doanh thu nên tính từ item

`orders.grand_total` đang là snapshot, hiển thị nhanh được.

Nguồn tính chuẩn cho báo cáo nên là:

```txt
sum(order_items.line_total)
```

Khi không có items, fallback mới dùng `orders.grand_total`.

## 6. Khuyến nghị bước 2

Bước tiếp theo nên thêm module tính toán riêng:

```txt
src/order-summary.js
```

Module này chỉ đọc local data và tính toán, không render UI, không sửa DB, không sửa sync.

Các hàm nên có:

```js
export async function getOrderRevenueDataset(filters = {})
export function summarizeOrders(dataset)
export function groupRevenueByCustomer(dataset)
export function groupRevenueByIndustry(dataset)
export function groupRevenueBySku(dataset)
export function groupRevenueByRoute(dataset)
export function groupRevenueBySales(dataset)
```

Nguồn dữ liệu:

```txt
LOCAL_STORES.orders
LOCAL_STORES.orderItems
```

Filter tối thiểu:

```txt
date_from
date_to
status
customer_id/customer_name
sales
route_name
industry_key
sku
```

Loại khỏi doanh thu mặc định:

```txt
cancelled
```

Nếu sau này có xoá mềm thì loại thêm:

```txt
deleted
raw_payload.deleted_at
```

## 7. Test sau bước 2

Tạo dữ liệu mẫu bằng UI hiện có:

```txt
1. Tạo 3 đơn trong hôm nay.
2. Ít nhất 2 khách khác nhau.
3. Ít nhất 2 SKU trùng giữa các đơn.
4. Ít nhất 2 ngành khác nhau.
5. Có 1 đơn status cancelled nếu đã có thao tác huỷ/xoá mềm.
```

Kiểm tra:

```txt
- Tổng doanh thu = tổng line_total của item hợp lệ.
- Theo khách cộng lại bằng tổng doanh thu.
- Theo ngành cộng lại bằng tổng doanh thu.
- Theo SKU cộng lại bằng tổng doanh thu.
- Theo sales/tuyến không làm chết UI nếu thiếu dữ liệu.
```

## 8. Nguyên tắc không làm ở bước 2

```txt
Không sửa order-ui.js nếu chưa cần.
Không đổi IndexedDB version/store.
Không đổi Supabase schema.
Không thêm UI doanh thu ngay khi module tính toán chưa test.
Không thêm chart/thư viện nặng.
Không đụng Test/MCP/Report để làm thống kê Order.
```

## 9. Chốt trạng thái

Bước 1 đã xác nhận:

```txt
Dữ liệu đơn hiện đủ để bắt đầu làm thống kê doanh thu local.
Điểm thiếu chính là industry/category/brand/choice chưa phẳng trên order_items.
Bước 2 nên tạo module order-summary.js đọc orders + order_items, fallback lấy ngành từ raw_payload.catalog_product, chưa đổi schema.
```
