# Tea Survey Report PWA

Web app PWA đơn giản để sales ghi nhận khảo sát thị trường ngành trà sữa, đặc biệt cho các buổi test trà ONA.

## Chức năng chính

- Tạo báo cáo theo ngày và thị trường/khu vực.
- Trong từng báo cáo, thêm từng khách hàng cụ thể.
- Mỗi khách có khu vực, loại sản phẩm test, hẹn báo lại, ghi chú tổng.
- Thanh lọc test riêng cho từng sản phẩm:
  - Trà Đen
  - Trà Quả Mộng
  - Trà Gạo Rang
  - Trà Lài
  - Trà Olong
  - Trà Olong Sen
- Trạng thái nhanh: Chưa thử, OK, Quan tâm, Cần mẫu, Báo Tân, Chưa tốt, Thử lại.
- Test chung thị trường: Giá tốt, ngọt, lạt, béo, thơm, đậm, nhạt, đang bán hãng khác, cần mẫu lớn, chủ đi vắng, báo sau cho A Tân.
- Sửa hoặc xóa khách trong báo cáo.
- Lọc khách theo sản phẩm, trạng thái hoặc từ khóa.
- Copy báo cáo để gửi Zalo/Telegram/Gmail.
- Xuất CSV để mở bằng Excel.
- Có manifest và service worker để chạy như PWA, hỗ trợ offline sau lần mở đầu tiên.

## Cách dùng nhanh

1. Mở `index.html` hoặc deploy lên GitHub Pages/Vercel/Netlify.
2. Tạo báo cáo mới theo ngày và thị trường.
3. Bấm vào báo cáo vừa tạo.
4. Thêm từng khách hàng, chọn trạng thái cho từng loại trà.
5. Dùng nút **Copy báo cáo** hoặc **Xuất CSV** khi cần gửi tổng hợp.

## Deploy GitHub Pages

Vào **Settings → Pages** của repo, chọn:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/root`

Sau khi bật Pages, app có thể mở bằng link GitHub Pages của repo.

## Ghi chú kỹ thuật

App không dùng backend. Dữ liệu được lưu bằng `localStorage` trên trình duyệt của máy đang dùng. Khi đổi máy hoặc xóa cache trình duyệt, dữ liệu cũ có thể mất, nên cần dùng **Xuất CSV** để lưu báo cáo quan trọng.
