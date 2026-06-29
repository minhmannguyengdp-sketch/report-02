# Plan MCP theo tuyến

## Mục tiêu

Bổ sung MCP như một tab/module riêng cho app **Bếp Sỉ Báo Cáo**, phục vụ sales/NPP đi tuyến cố định theo ngày mà không làm rối hoặc phá logic hiện có của 3 nghiệp vụ chính:

- Đơn hàng
- Test sản phẩm
- Báo cáo thị trường

MCP chỉ đóng vai trò **kế hoạch tuyến + danh sách khách + tracking ghé điểm bán**. Các nghiệp vụ Đơn hàng/Test/Báo cáo vẫn lưu và xử lý độc lập.

---

## Nguyên tắc kiến trúc

### 1. MCP là lớp ngữ cảnh, không ôm nghiệp vụ

MCP chỉ cung cấp ngữ cảnh:

- Ngày đi tuyến
- Tuyến phụ trách
- Khách thuộc tuyến
- Trạng thái ghé khách
- Link sang hành động Đơn hàng/Test/Báo cáo

MCP không chứa chi tiết đơn hàng, chi tiết test, hay nội dung báo cáo thị trường.

Luồng đúng:

```text
MCP chọn khách/tuyến/ngày
→ mở nghiệp vụ riêng
→ nghiệp vụ tự lưu dữ liệu
→ MCP chỉ nhận trạng thái tổng hợp
```

Không làm:

```text
MCP lưu trực tiếp chi tiết đơn hàng/test/báo cáo
```

---

## Vị trí UI

Bottom navigation nên có tab riêng:

```text
MCP | Đơn hàng | Test | Báo cáo
```

Nếu cần tài khoản/cài đặt, ưu tiên đặt ở header/avatar thay vì nhồi thêm tab thứ 5 trên mobile.

MCP nên là tab đầu vì sales mở app ra thường cần biết hôm nay đi tuyến nào trước.

---

## Logic MCP theo tuyến cố định

Với NPP, tuyến gần như cố định theo lịch tuần.

Ví dụ:

```text
Thứ 2 → Tuyến A → danh sách khách Tuyến A
Thứ 3 → Tuyến B → danh sách khách Tuyến B
Thứ 4 → Tuyến C → danh sách khách Tuyến C
```

Khi sales mở MCP vào Thứ 2, hệ thống tự hiển thị:

```text
MCP hôm nay
Tuyến A
Danh sách khách thuộc Tuyến A
```

Sales không cần chọn quá nhiều bộ lọc phức tạp. UI mặc định nên ưu tiên:

- Hôm nay
- Tuyến của tôi
- Trạng thái khách trong tuyến

---

## Màn hình MCP chính

Màn hình MCP là trạm điều phối tuyến, không phải màn hình nhập form dài.

Gợi ý layout mobile:

```text
MCP hôm nay
Thứ 2, 29/06

Tuyến A
32 khách | Đã ghé 12 | Có đơn 8

[+ Thêm khách]

Bộ lọc nhanh:
[Tất cả] [Chưa ghé] [Đã ghé] [Có đơn] [Không mua]

Danh sách khách:
--------------------------------
Tạp hoá Minh Anh
Chưa ghé • 1.2km
[Check-in] [Đơn] [Test] [Báo cáo]
--------------------------------
Quán Bún Cô Lan
Đã ghé • Không mua
[Xem] [Đơn] [Test] [Báo cáo]
```

Mỗi card khách chỉ có các thao tác nhanh:

- Check-in
- Đơn
- Test
- Báo cáo

---

## Logic thao tác từ MCP sang nghiệp vụ

### Bấm Check-in

Cập nhật trạng thái ghé trong MCP:

- Chưa ghé
- Đã ghé
- Bỏ qua
- Không mua
- Có phát sinh

Check-in có thể lưu thêm GPS/thời gian/ghi chú ngắn.

### Bấm Đơn

Mở form tạo đơn hàng của module Đơn hàng với thông tin điền sẵn:

- customer_id
- route_id
- visit_id
- sales_id
- source = mcp

Đơn hàng vẫn lưu vào module/bảng Đơn hàng. MCP chỉ cập nhật trạng thái tổng hợp là khách này có đơn.

### Bấm Test

Mở form ghi nhận test của module Test với ngữ cảnh khách/tuyến/ngày.

Test vẫn lưu vào module/bảng Test. MCP chỉ nhận trạng thái là khách này có test.

### Bấm Báo cáo

Mở form Báo cáo thị trường với ngữ cảnh khách/tuyến/ngày.

Báo cáo vẫn lưu vào module/bảng Báo cáo. MCP chỉ nhận trạng thái là khách này có báo cáo.

---

## Nghiệp vụ vẫn phải chạy độc lập ngoài MCP

Để không làm hư 3 nhánh hiện có, Đơn hàng/Test/Báo cáo vẫn phải tạo được từ chính tab của chúng.

### Tạo đơn từ tab Đơn hàng

```text
Tab Đơn hàng
→ + Tạo đơn
→ Chọn khách
→ Nếu khách có MCP hôm nay thì tự gắn visit_id
→ Nếu không có MCP hôm nay thì vẫn cho lưu, visit_id để trống
```

### Tạo test từ tab Test

```text
Tab Test
→ + Ghi nhận test
→ Chọn khách
→ Nếu có MCP hôm nay thì tự gắn visit_id
→ Nếu không có MCP hôm nay thì vẫn lưu độc lập
```

### Tạo báo cáo từ tab Báo cáo

```text
Tab Báo cáo
→ + Tạo báo cáo
→ Chọn khách/khu vực/đối thủ
→ Nếu có MCP hôm nay thì tự gắn visit_id
→ Nếu không có MCP hôm nay thì vẫn lưu độc lập
```

Quy tắc quan trọng: `visit_id` là liên kết tốt nếu có, nhưng không phải điều kiện bắt buộc để lưu nghiệp vụ.

---

## Cấu trúc dữ liệu mục tiêu

MCP nên tách dữ liệu thành các lớp rõ ràng:

```text
customers
routes
route_customers
mcp_visits
orders
product_tests
market_reports
```

### customers

Lưu hồ sơ khách hàng/điểm bán.

Trường gợi ý:

- customer_id
- name
- phone
- address
- gps_lat
- gps_lng
- customer_type
- status
- created_by
- created_at

### routes

Lưu tuyến bán hàng cố định của NPP.

Trường gợi ý:

- route_id
- route_name
- area
- sales_id
- weekday
- frequency
- status

Ví dụ:

```text
route_name = Tuyến A
weekday = Monday
frequency = weekly
```

### route_customers

Bảng nối khách hàng vào tuyến.

Trường gợi ý:

- route_id
- customer_id
- sort_order
- is_primary_route
- status
- added_by
- added_at

Không sửa trực tiếp lịch cũ khi thêm khách vào tuyến. Thêm khách cố định phải đi qua `route_customers`.

### mcp_visits

Bản ghi MCP phát sinh theo ngày từ tuyến.

Trường gợi ý:

- visit_id
- date
- route_id
- customer_id
- sales_id
- visit_status
- checkin_time
- checkout_time
- gps_lat
- gps_lng
- note

Ví dụ khi tới Thứ 2, hệ thống sinh các visit cho Tuyến A:

```text
29/06 - Tuyến A - Khách 001
29/06 - Tuyến A - Khách 002
29/06 - Tuyến A - Khách 003
```

### orders / product_tests / market_reports

Các bảng/module nghiệp vụ chỉ cần tham chiếu ngữ cảnh nếu có:

- customer_id
- route_id
- visit_id
- sales_id
- created_at

`visit_id` có thể null khi tạo nghiệp vụ ngoài MCP.

---

## Thêm khách mới vào tuyến

Trong MCP có nút:

```text
+ Thêm khách
```

Khi bấm, mở bottom sheet với 2 hướng:

```text
1. Chọn khách đã có
2. Tạo khách mới
```

### Chọn khách đã có

Luồng:

```text
Tìm khách
→ chọn khách
→ chọn kiểu thêm
```

Các kiểu thêm:

- Thêm phát sinh hôm nay
- Thêm cố định vào Tuyến A

Nếu khách đang thuộc tuyến khác, hiển thị cảnh báo:

```text
Khách này đang thuộc Tuyến B.
Bạn muốn:
- Gán thêm vào Tuyến A
- Chuyển từ Tuyến B sang Tuyến A
- Chỉ thêm phát sinh hôm nay
- Huỷ
```

Không tự động chuyển tuyến để tránh phá dữ liệu NPP.

### Tạo khách mới

Form sales ngoài thị trường nên ngắn:

```text
Tên cửa hàng *
Số điện thoại
Địa chỉ
[Lấy GPS hiện tại]
Loại khách
Ghi chú

Thêm vào:
( ) Chỉ hôm nay
( ) Cố định vào Tuyến A

[Lưu khách]
```

Sau khi lưu:

- Tạo customer mới
- Nếu chọn chỉ hôm nay: tạo `mcp_visit` cho ngày hiện tại, không thêm vào `route_customers`
- Nếu chọn cố định: thêm vào `route_customers`, đồng thời tạo `mcp_visit` hôm nay nếu đang ở tuyến hiện tại

---

## Trạng thái khách mới và chống trùng

Khách mới do sales tạo nên có trạng thái:

```text
Chờ duyệt
```

Lý do:

- Tránh sales tạo trùng khách
- Tránh sai tuyến
- Giữ master data sạch cho NPP

Khi nhập tên hoặc số điện thoại gần giống khách có sẵn, UI nên báo:

```text
Có thể khách này đã tồn tại:

Tạp hoá Minh Anh
SĐT: 09xxxxxxx
Đang thuộc: Tuyến B

[Chọn khách này] [Tạo khách mới]
```

Admin/NPP xử lý sau:

- Duyệt khách mới
- Gộp khách trùng
- Chuyển tuyến
- Từ chối/xoá nếu sai

---

## Báo cáo thống kê từ MCP

Tab Báo cáo được phép đọc dữ liệu MCP để phân tích, nhưng không sửa MCP.

Ví dụ thống kê:

```text
Hiệu suất Tuyến A hôm nay

Tổng khách trong tuyến: 32
Đã ghé: 24
Chưa ghé: 8
Có đơn: 15
Không mua: 9
Có test sản phẩm: 4
Có báo cáo thị trường: 6
```

Nguồn tính:

- mcp_visits
- orders
- product_tests
- market_reports

AI report có thể tổng hợp theo:

- Tuyến
- Sales
- Khu vực
- Khách không phát sinh đơn
- Sản phẩm được test nhiều
- Đối thủ/giá/khuyến mãi từ báo cáo thị trường

---

## Component UI đề xuất

### MCP

- `RouteTodayHeader`
- `RouteFilterBar`
- `CustomerVisitCard`
- `AddCustomerToRouteSheet`
- `VisitActionButtons`

### Dùng chung

- `CustomerPicker`
- `ProductPicker`
- `GPSButton`
- `ImageUpload`
- `StatusBadge`

### Module nghiệp vụ giữ riêng

- Order list/form/detail thuộc Đơn hàng
- Test list/form/detail thuộc Test
- Report list/form/detail thuộc Báo cáo

MCP không import sâu logic xử lý nội bộ của 3 module. Chỉ truyền context tối thiểu khi mở form.

---

## Context truyền từ MCP sang module khác

Khi bấm từ card khách trong MCP sang Đơn/Test/Báo cáo, chỉ truyền object ngữ cảnh nhỏ:

```text
customer_id
route_id
visit_id
source = mcp
```

Không truyền toàn bộ object tuyến/khách quá lớn. Không để form Đơn/Test/Báo cáo phụ thuộc trực tiếp vào state nội bộ của MCP.

---

## Rule chống hư nhánh còn lại

1. MCP không chứa chi tiết đơn hàng/test/báo cáo.
2. Đơn hàng/Test/Báo cáo có thể tạo từ MCP hoặc tạo độc lập.
3. Nếu tạo từ MCP thì gắn `visit_id`.
4. Nếu tạo độc lập thì `visit_id` được phép null.
5. Báo cáo chỉ đọc MCP để thống kê, không sửa MCP.
6. Thêm khách cố định vào tuyến phải qua `route_customers`, không sửa lịch cũ trực tiếp.
7. Khách mới nên có trạng thái chờ duyệt để tránh bẩn dữ liệu.
8. Không tự động chuyển tuyến khách nếu phát hiện khách đang thuộc tuyến khác.
9. UI MCP chỉ dùng form ngắn, thao tác nhanh ngoài thị trường.
10. Mọi thay đổi nghiệp vụ phải nằm trong module nghiệp vụ tương ứng.

---

## Thứ tự triển khai đề xuất

### Phase 1: Plan UI/static mock trong MCP

- Thêm tab MCP trong điều hướng.
- Dựng màn hình MCP hôm nay bằng dữ liệu mock/local.
- Hiển thị tuyến, bộ lọc, card khách, trạng thái ghé.
- Chưa đụng logic Đơn hàng/Test/Báo cáo.

### Phase 2: Liên kết context sang module hiện có

- Từ MCP bấm Đơn/Test/Báo cáo thì mở đúng form tương ứng.
- Prefill customer/route/visit context.
- Module nghiệp vụ vẫn tự lưu dữ liệu của nó.

### Phase 3: Thêm khách vào MCP/tuyến

- Bottom sheet `+ Thêm khách`.
- Chọn khách đã có.
- Tạo khách mới form ngắn.
- Chọn `chỉ hôm nay` hoặc `cố định vào tuyến`.
- Gắn trạng thái `chờ duyệt` cho khách mới.

### Phase 4: Báo cáo đọc MCP

- Tab Báo cáo đọc `mcp_visits` và các module nghiệp vụ để thống kê.
- Không cho Báo cáo sửa MCP.
- AI tổng hợp theo tuyến/sales/khu vực/sản phẩm/đối thủ.

### Phase 5: Đồng bộ Supabase/offline

- Local DB là cache/hàng đợi offline.
- Supabase là nguồn dữ liệu trung tâm khi cấu hình env đầy đủ.
- Ưu tiên sync các entity MCP sau khi module Test hiện tại ổn định.

---

## Kết luận

Cách ráp phù hợp nhất:

```text
MCP = tuyến + khách + tracking ghé
Đơn hàng = giao dịch
Test = thử sản phẩm
Báo cáo = ghi nhận thị trường + phân tích
```

MCP liên kết các nhánh bằng `customer_id`, `route_id`, `visit_id`, nhưng không nuốt logic nghiệp vụ của các nhánh đó. Cách này giữ app gọn cho sales, đúng vận hành NPP, và giảm rủi ro làm hư các module đang có.
