# Plan tổng Bếp Sỉ Báo Cáo

Tài liệu này là nguồn tham chiếu chính khi tiếp tục phát triển app. Nếu chuyển chat hoặc chuyển người làm, đọc file này trước để tránh lẫn giữa UI shell, logic thật, dữ liệu thật và kế hoạch tương lai.

## Mục tiêu app

**Bếp Sỉ Báo Cáo** là PWA mobile-first cho sales/thị trường. App dùng ngoài thị trường để tạo dữ liệu nhanh, quản lý dữ liệu đã tạo và về sau cho AI tổng hợp báo cáo trình công ty.

App có 4 nhánh nghiệp vụ chính:

1. MCP tuyến
2. Đơn hàng
3. Test sản phẩm
4. Báo cáo thị trường

Ngoài ra có:

- Home: nơi bắt đầu thao tác.
- Dữ liệu: nơi xem/quản lý dữ liệu đã tạo.
- AI: nơi tổng hợp báo cáo từ dữ liệu.
- Admin: cấu hình, sync, update.

## Trạng thái hiện tại

### Test sản phẩm

Đây là nhánh duy nhất đang có logic thật.

Luồng đang dùng:

```text
Home -> Test sản phẩm -> tạo file test tổng
Dữ liệu -> danh sách file test -> thêm khách / xem chi tiết / export
```

Quy tắc quan trọng:

- Không tự ý sửa logic Test khi đang cần dùng thực tế.
- Không sửa `test-first-app.js` nếu chỉ làm UI shell hoặc plan, trừ khi thật sự cần và phải nói rõ.
- Dữ liệu Test hiện gồm file test cha và khách test con.

### MCP / Đơn hàng / Báo cáo thị trường

Các nhánh này hiện mới là **UI shell**, chưa có logic lưu dữ liệu thật.

- MCP shell chỉ demo tuyến hôm nay, filter khách, card khách, nút Check-in/Đơn/Test/Báo cáo.
- Đơn hàng shell chỉ demo danh sách đơn và các nút thao tác.
- Báo cáo shell chỉ demo danh sách ghi nhận thị trường và các nút thao tác.
- Các nút demo chỉ hiện toast, không ghi dữ liệu.

## Kiến trúc màn hình

### 1. Home

Home là trang bắt đầu thao tác, không phải nơi quản lý dữ liệu sâu.

Home có 4 card:

```text
MCP tuyến | Đơn hàng
Test sản phẩm | Báo cáo
```

Mục tiêu Home:

- Cho sales chọn nhanh việc cần làm.
- Không nhồi form dài trên Home.
- Không biến Home thành trang dữ liệu.
- Card lớn, dễ bấm bằng ngón tay.

### 2. Action sheet sau khi bấm card Home

Đây là phần cần bổ sung vào plan tổng và triển khai sau.

Không nên để mọi card mở thẳng form dài. Mỗi card nên mở một action sheet/bottom sheet chọn thao tác.

#### MCP

```text
Card MCP
-> mở MCP hôm nay
-> chọn khách trong tuyến
-> Check-in / Đơn / Test / Báo cáo
```

MCP là ngoại lệ vì nó là màn điều phối tuyến, không cần action sheet trước.

#### Test sản phẩm

```text
Card Test
-> action sheet Test
   -> Tạo file test mới
   -> Chọn file test gần đây để thêm khách
   -> Xem dữ liệu test
```

Trong giai đoạn hiện tại, `Tạo file test mới` trỏ tới modal tạo file test đang dùng.

#### Đơn hàng

```text
Card Đơn hàng
-> action sheet Đơn hàng
   -> Tạo đơn mới
   -> Tạo đơn từ khách MCP hôm nay
   -> Xem đơn gần đây
```

#### Báo cáo thị trường

```text
Card Báo cáo
-> action sheet Báo cáo
   -> Tạo báo cáo mới
   -> Tạo báo cáo từ khách MCP hôm nay
   -> Xem báo cáo gần đây
```

## Vai trò tab Dữ liệu

Tab Dữ liệu là kho quản lý dữ liệu đã tạo, không chỉ riêng Test.

UI thực của Dữ liệu nên có bộ lọc nhánh:

```text
Dữ liệu
[MCP] [Đơn] [Test] [Báo cáo]
```

Khi chọn từng nhánh:

### Dữ liệu MCP

Hiển thị:

- Tuyến/ngày.
- Danh sách visit khách.
- Trạng thái ghé.
- Có đơn/test/báo cáo hay chưa.
- Chi tiết hoạt động tại từng khách.

Nguồn dữ liệu tương lai:

```text
customers
routes
route_customers
mcp_visits
```

### Dữ liệu Đơn hàng

Hiển thị:

- Danh sách đơn.
- Khách.
- Tổng tiền.
- Trạng thái đơn.
- Chi tiết đơn.

Nguồn dữ liệu tương lai:

```text
orders
order_items
```

### Dữ liệu Test

Hiển thị logic đang có:

- Danh sách file test.
- Sản phẩm trong file.
- Khách test thuộc file.
- Kết quả theo sản phẩm.
- Thêm khách vào file.
- Export Excel.

Nguồn dữ liệu hiện tại:

```text
test_files
test_file_products
test_customers
test_customer_results
```

### Dữ liệu Báo cáo thị trường

Hiển thị:

- Danh sách báo cáo.
- Khu vực/khách.
- Đối thủ/giá/khuyến mãi.
- Cơ hội/ghi chú.
- Ảnh nếu có.

Nguồn dữ liệu tương lai:

```text
market_reports
market_report_images
```

## Không ép tất cả thành file

Chỉ Test đang có mô hình file cha -> khách con.

Không nên ép MCP, Đơn hàng, Báo cáo thành file giống Test.

Cấu trúc đúng:

```text
MCP = tuyến/ngày/khách/visit
Đơn hàng = giao dịch
Test = file test + khách test + kết quả sản phẩm
Báo cáo = ghi nhận thị trường
```

Tất cả cùng xuất hiện trong tab Dữ liệu, nhưng mỗi nhánh có cấu trúc dữ liệu riêng.

## Quan hệ MCP với các nhánh khác

MCP là lớp ngữ cảnh, không ôm nghiệp vụ.

MCP chỉ cung cấp:

- date
- route_id
- customer_id
- visit_id
- source = mcp

Khi từ MCP bấm Đơn/Test/Báo cáo:

```text
MCP chọn khách/tuyến/ngày
-> mở nghiệp vụ riêng với context nhỏ
-> nghiệp vụ tự lưu vào bảng/module của nó
-> MCP chỉ đọc/trạng thái tổng hợp
```

Không làm:

```text
MCP lưu trực tiếp chi tiết đơn hàng/test/báo cáo
```

## Quy tắc chống lẫn logic

1. Home chỉ là nơi bắt đầu thao tác.
2. Dữ liệu là nơi quản lý/xem dữ liệu đã tạo.
3. MCP là điều phối tuyến, không lưu chi tiết nghiệp vụ.
4. Đơn hàng/Test/Báo cáo phải chạy độc lập ngoài MCP.
5. Nếu tạo từ MCP thì gắn `visit_id` nếu có.
6. Nếu tạo độc lập thì `visit_id` được phép null.
7. Test hiện đang dùng thật, không sửa logic khi chỉ làm UI.
8. UI shell được phép demo nhưng không được ghi dữ liệu thật.
9. Khi thêm logic thật cho nhánh nào, tạo module riêng, không nhét vào Test.
10. Supabase là trung tâm sync, Local DB là cache/hàng đợi offline.

## Thứ tự triển khai đề xuất

### Phase 1: Chốt UI tổng

- Home 4 card.
- MCP UI shell.
- Đơn hàng UI shell.
- Báo cáo UI shell.
- Dữ liệu UI shell có bộ lọc nhánh.
- Không thay đổi logic Test.

### Phase 2: Action sheet cho Home

- Card Test mở sheet chọn thao tác.
- Card Đơn hàng mở sheet chọn thao tác.
- Card Báo cáo mở sheet chọn thao tác.
- Card MCP mở thẳng MCP hôm nay.

### Phase 3: Dữ liệu hub thật

- Dữ liệu có bộ lọc nhánh thật.
- Test vẫn hiển thị data thật hiện tại.
- MCP/Đơn/Báo cáo ban đầu có thể dùng shell/mẫu, sau đó thay bằng data thật.

### Phase 4: MCP logic thật

- customers
- routes
- route_customers
- mcp_visits
- check-in/check-out
- trạng thái ghé
- link context sang Đơn/Test/Báo cáo

### Phase 5: Đơn hàng logic thật

- orders
- order_items
- trạng thái đơn
- tạo độc lập hoặc từ MCP

### Phase 6: Báo cáo thị trường logic thật

- market_reports
- ảnh/ghi chú/đối thủ/giá/cơ hội
- tạo độc lập hoặc từ MCP

### Phase 7: AI tổng hợp

AI đọc dữ liệu từ:

- mcp_visits
- orders
- test files/customers/results
- market_reports

AI tổng hợp theo:

- tuyến
- sales
- khu vực
- khách không mua
- sản phẩm được test nhiều
- đối thủ/giá/khuyến mãi

## Ghi chú deploy

Sau khi sửa repo, deploy bằng:

```powershell
cd "F:\1_A_Disk_D\Tool\report"

git fetch origin main
git reset --hard origin/main

git push deploy main --force-with-lease
```

Sau deploy nên mở URL có cache bust:

```text
https://report-nietz.vercel.app/?app_v=<tag>
```
