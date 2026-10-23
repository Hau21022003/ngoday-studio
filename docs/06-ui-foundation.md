# UI Foundation — Light Creative Studio

## Mục tiêu

Giao diện mang cảm giác một bàn làm việc sản xuất nội dung: sáng, tập trung, có nhịp điệu biên tập và tránh kiểu dashboard SaaS chung chung. Foundation này chỉ dùng dữ liệu mock; chưa định nghĩa database, persistence hay logic nghiệp vụ Phase 1.

## Design tokens

Token được khai báo trong `src/renderer/src/styles/globals.css` và ánh xạ vào Tailwind CSS v4 bằng `@theme inline`.

### Màu sắc

- `background`: nền canvas ngà rất nhẹ; dùng cho toàn app.
- `surface`: trắng; dùng cho vùng nội dung cần tách khỏi canvas.
- `primary`: navy; dùng cho navigation active, CTA chính và trạng thái tiến độ.
- `accent`: cam; dùng có chọn lọc cho CTA tạo mới, điểm nhấn và cảnh báo nhẹ.
- `muted`: nền phụ cho hover, label và table header.
- `border`: đường phân tách nhẹ; ưu tiên border thay cho shadow.
- `success`: trạng thái local/hoàn tất; không dùng như màu trang trí.

Không dùng gradient. Không tạo màu riêng trực tiếp trong component nếu semantic token đã tồn tại.

### Typography

- Font mặc định: `Segoe UI Variable`, phù hợp desktop Windows và không cần network.
- Page title: 28–32px, weight 700, tracking âm nhẹ.
- Section title: 16px, weight 700.
- Body: 14px, line-height 24px.
- Metadata/helper: 11–12px.
- Label nhóm điều hướng: 10px uppercase, tracking rộng.

Heading phải theo hierarchy nội dung; không dùng display heading quá lớn trong workspace.

### Spacing

- Grid cơ sở: 4px.
- Khoảng trong control: 8–16px.
- Khoảng giữa các nhóm trong panel: 20–24px.
- Khoảng giữa section: 32–36px.
- Content gutter: 20px mobile, 28px tablet, 40px desktop.
- Chiều cao control chuẩn: 36px; compact 32px; prominent 40px.

### Radius và elevation

- Radius gốc: 8px.
- Control và panel: 6–10px; pill chỉ dành cho badge/status.
- Shadow mặc định bằng 0. Chỉ overlay như mobile sheet được dùng shadow nhẹ.
- Ưu tiên border, nền và khoảng trắng để tạo phân cấp.

## Quy ước component

- Primitive dùng cấu trúc source-owned của shadcn/ui trong `components/ui`.
- Variant được quản lý bằng `class-variance-authority`; class được hợp nhất qua `cn()`.
- Feature component nằm trực tiếp trong `components`; không đưa domain state vào primitive.
- Mọi control phải có focus-visible, trạng thái disabled và accessible name.
- Badge chỉ biểu thị trạng thái hoặc số lượng; không dùng pill như vật trang trí.
- Card chỉ dùng khi nội dung thật sự là một đơn vị độc lập. Danh sách dài ưu tiên row, divider và table-like layout.
- Icon dùng Lucide ở kích thước 16–18px; icon không thay thế label cho hành động quan trọng.

## App shell và responsive

- Desktop từ `lg`: sidebar cố định 256px, top bar 64px, content cuộn độc lập theo trang.
- Dưới `lg`: sidebar chuyển thành sheet từ cạnh trái; top bar giữ breadcrumb và action hệ thống.
- Dưới `sm`: ẩn search command, section chuyển về một cột và giảm gutter.
- Dữ liệu dạng bảng thu gọn cột phụ trên màn hình hẹp nhưng luôn giữ title và affordance mở chi tiết.
- Desktop là ưu tiên chính, nhưng viewport tối thiểu 320px vẫn không gây tràn ngang ngoài chủ ý.

## Navigation

- Nhóm `Chuẩn bị` chứa các phần thuộc Phase 1.
- Nhóm `Sản xuất` hiển thị trước cấu trúc tương lai nhưng ở trạng thái disabled để không ngụ ý đã có logic.
- Active item dùng nền navy rất nhạt và một vạch cam nhỏ; không dùng active pill đậm.
- Breadcrumb top bar phản chiếu khu vực đang chọn. Overview và ba khu vực Phase 1 có dữ liệu collection mock để kiểm tra shell, list pattern và responsive state; chưa có thao tác nghiệp vụ.
