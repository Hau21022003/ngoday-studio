# UI Foundation — Ngộ Dậy Studio

## Source of truth

Trang `Templates` là design source of truth cho toàn bộ sản phẩm. Mọi page mới — Episodes, Script Editor, Scenes, Assets, Queue, Media và Settings — phải dùng token và component trong foundation này, không tạo visual language riêng.

Định hướng cố định: **Light Creative Studio / Production Workspace**. Giao diện sáng, tập trung cho công việc biên tập, mật độ vừa phải và tránh cảm giác dashboard SaaS chung chung.

Foundation hiện chỉ dùng dữ liệu mock. Không có database, persistence, IPC nghiệp vụ hoặc business logic Phase 1.

## M1 review routes

M1 dùng query parameter chỉ dành cho review để tái hiện các state của Templates mà không thêm debug control vào giao diện:

- Ready: `/#templates`
- Empty: `/?demo=empty#templates`
- Loading: `/?demo=loading#templates`
- Error + retry: `/?demo=error#templates`

Detail panel là read-only trong baseline M1. Tab đang mở được phản ánh bằng `detail=overview|content|variables|history`. M2 kích hoạt tạo/chỉnh sửa bằng state in-memory nhưng vẫn không ghi dữ liệu qua restart và không gọi IPC nghiệp vụ.

## M2 review routes

M2 tiếp tục dùng query parameter chỉ dành cho review, không hiển thị debug control trong sản phẩm:

- Create: `/?author=create#templates`
- Edit: `/?author=edit&template=youtube-long-form#templates`
- Authoring loading: `/?author=create&authorState=loading#templates`
- Authoring load error + retry: `/?author=create&authorState=error#templates`
- Mock save error giữ nguyên draft + retry: `/?author=edit&template=youtube-long-form&authorState=save-error#templates`

Luồng authoring hai bước được phản ánh bằng `authorStep=1|2`: `1` là chỉnh sửa nội dung, `2` là xem trước và hoàn thành. Preview values chỉ tồn tại trong phiên editor và không đưa lên URL; authoring không còn dùng preview/history rail bên phải.

## M3 Episodes List review routes

Phần đầu M3 chỉ gồm danh sách episode full-width, dùng dữ liệu in-memory và chưa nối sang create/edit/archive hoặc Episode workspace:

- Ready: `/#episodes`
- Empty: `/?demo=empty#episodes`
- Loading: `/?demo=loading#episodes`
- Error + retry: `/?demo=error#episodes`

## Tokens

Token được khai báo tại `src/renderer/src/styles/globals.css`, sau đó ánh xạ vào Tailwind CSS v4 bằng `@theme inline`.

### Color

| Token | Vai trò |
| --- | --- |
| `background` | Canvas warm-light của toàn app |
| `surface` | Panel, table và control màu trắng |
| `primary` | Navy cho chữ, navigation và hành động chính không mang tính tạo mới |
| `accent` | Cam cho CTA tạo mới, active tab và selected state |
| `accent-soft`, `selected` | Nền cam rất nhạt cho navigation/row đang chọn |
| `muted` | Table header, hover nhẹ và secondary surface |
| `border`, `border-strong`, `input` | Border semantic theo mức nhấn |
| `success`, `warning`, `info`, `danger`, `lavender` | Status/purpose badge; luôn dùng kèm soft background |

Không dùng gradient, glassmorphism hoặc màu hex trực tiếp trong feature page. Ngoại lệ duy nhất hiện tại là màu minh họa thumbnail mock; khi có asset thật sẽ thay bằng media component.

### Typography

- Font: `Segoe UI Variable`, fallback `Segoe UI` và system sans-serif; không phụ thuộc network.
- Page title: 28px, weight 700, line-height 36px.
- Section title: 14px, weight 700.
- Body/UI label: 14px.
- Metadata/table helper: 11–12px.
- Code/identifier: `Cascadia Code` hoặc system monospace.
- Heading dùng `text-balance`; copy dài dùng `text-pretty`, `truncate`, `line-clamp` hoặc `break-words` tùy ngữ cảnh.

Không dùng giant heading trong workspace.

### Spacing

- Base grid: 4px.
- Control height: 32px compact, 36px default, 40px prominent.
- Row padding: 10–12px theo chiều dọc; table giữ density đủ để scan nhanh.
- Section padding: 16–20px.
- Page gutter: 20px mobile, 28px tablet, 32px desktop.
- Khoảng giữa các nhóm lớn: 20–28px.

### Radius, border và shadow

- Radius gốc: 7px; control/panel dùng 4–10px.
- Badge dùng rounded-md, không dùng pill quá mức.
- Panel dùng border 1px; divider thay cho nested card.
- `shadow-panel` rất nhẹ, chỉ giúp surface tách khỏi warm canvas.
- `shadow-overlay` chỉ dành cho drawer/overlay.

## Shared components

Các primitive source-owned theo convention shadcn/ui nằm trong `src/renderer/src/components/ui`:

- `Button`: `default`, `accent`, `outline`, `secondary`, `ghost`, `destructive`; size `sm`, `default`, `lg`, `icon-sm`, `icon`.
- `Input`, `SearchField`, `Select`: control 36px, label accessible, focus ring thống nhất.
- `Badge`, `StatusBadge`: purpose/status semantic nhẹ, không dùng màu trang trí tùy ý.
- `Table`: table semantic, density tốt, row hover nhẹ và `selected` màu cam nhạt.
- `Tabs`: active underline cam, hỗ trợ Arrow Left/Right, Home và End.
- `DetailPanel`, `DetailSection`, `DetailDivider`: panel phải bên phải dùng section + separator, tránh card hóa.
- `Sheet`: navigation responsive, reduced-motion và overscroll containment.
- `StateFeedback`: `EmptyState`, `LoadingState`, `ErrorState`; loading tôn trọng reduced-motion, error có next step.
- `TemplateThumbnail`: minh họa mock duy nhất cho foundation preview.

Feature component phải compose các primitive này. Không copy class control/table/badge vào từng page.

## App shell và navigation

- Desktop từ `lg`: sidebar cố định 226px, không có global top header.
- Sidebar dùng link thật để hỗ trợ keyboard, Cmd/Ctrl-click và URL hash.
- Active navigation dùng nền cam nhạt, chữ/icon cam và vạch cam 2px.
- Dưới `lg`: sidebar chuyển thành sheet; menu trigger nằm trong vùng đầu page, không tạo global header mới.
- `Templates` dùng layout master–detail: content/list bên trái, detail panel 450px bên phải từ `xl`.
- Dưới `xl`: detail panel chuyển xuống dưới danh sách; toolbar tự wrap, table cho phép scroll ngang có chủ đích.
- Page có skip link và main landmark.

## Interaction conventions

- Filter/search/action nằm trên một hàng khi đủ không gian và tự wrap trên viewport hẹp.
- Navigation dùng `<a>`; action dùng `<button>`; dữ liệu tabular dùng `<table>`.
- Icon-only action bắt buộc có `aria-label`; icon trang trí dùng `aria-hidden="true"`.
- Focus dùng `focus-visible`; không xóa outline nếu không có ring thay thế.
- Tabs và template selection được phản ánh vào URL (`category`, `template`, hash route).
- Dates/times hiển thị qua `Intl.DateTimeFormat` với timezone `Asia/Ho_Chi_Minh`.
- Không dùng `transition: all`; animation chỉ dùng opacity/transform và phải có reduced-motion fallback.

## Quy tắc mở rộng

Khi thêm page mới:

1. Dùng token hiện có trước khi đề xuất token mới.
2. Compose shared component; không fork style cho một page.
3. Dùng row/divider/table trước card nếu nội dung là một collection.
4. Detail view dùng `DetailPanel` + `DetailSection`.
5. Cung cấp empty/loading/error state ngay khi tạo data view.
6. Chạy review theo skill `web-design-guidelines` cho toàn bộ file thay đổi trước khi merge.
