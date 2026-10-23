# M2 UX Contract — Template Authoring Prototype

- **Status:** Approved ngày 2026-10-23
- **Implementation:** Complete, awaiting milestone review ngày 2026-10-23
- **Visual source of truth:** M1 Templates và `06-ui-foundation.md`

## 1. Mục tiêu và ranh giới

M2 kiểm chứng trọn luồng tạo, sửa, khai báo biến, preview, copy và tạo version mới bằng mock/in-memory state. Prototype phải dùng lại app shell, token và interaction convention của M1; không thêm database, persistence, business IPC, autosave, form framework hoặc validation dependency.

Không thuộc M2: xóa template, import/export, gọi LLM, phân quyền, thumbnail upload, major-version workflow và dữ liệu còn lại sau khi restart.

## 2. Field contract

### Template metadata hiện hành

| Field | Quy tắc |
| --- | --- |
| `name` | Bắt buộc, trim, 3–80 ký tự và không trùng tên khác khi so sánh không phân biệt hoa/thường. |
| `purpose` | Bắt buộc: `script`, `thumbnail`, `hook`, `description`, `idea`, `other`. |
| `description` | Bắt buộc, trim, 10–240 ký tự; dùng tại list/detail M1. |
| `status` | `experimental` (Thử nghiệm), `active` (Đang dùng), `inactive` (Không hoạt động); template mới mặc định `experimental`. |

`id`, current version, created/updated time, creator và usage count là field hệ thống chỉ đọc. Thumbnail trong M2 tiếp tục là mock/derived theo purpose, không phải authoring field.

### Snapshot của một version

| Field | Quy tắc |
| --- | --- |
| `content` | Prompt thô phải có nội dung sau khi trim, tối đa 20.000 ký tự; khi lưu/render vẫn giữ nguyên whitespace người dùng nhập. |
| `variables` | Danh sách khai báo biến theo contract bên dưới. |
| `changeNote` | Bắt buộc khi tạo version kế tiếp, 3–160 ký tự; version đầu dùng “Khởi tạo template”. |
| `version`, `createdAt`, `createdBy` | Hệ thống sinh và chỉ đọc. |

Preview values là state tạm của phiên editor, không nằm trong template/version. Draft giữ `baseVersion` để UI luôn cho biết đang sửa từ snapshot nào.

## 3. Create và edit flow

### Create

1. Từ Templates, chọn `Tạo template mới` rồi chọn purpose.
2. Điền `Thông tin` → soạn `Nội dung & biến` → nhập dữ liệu và kiểm tra tại `Xem trước`.
3. Có thể quay lại bước trước mà không mất draft trong phiên hiện tại.
4. `Tạo template` chỉ bật khi metadata, content và variable contract hợp lệ; thao tác tạo snapshot `v1.0` rồi quay về Templates với row mới được chọn. Preview value tạm không phải điều kiện lưu.

### Edit

1. `Chỉnh sửa` từ detail panel mở editor với draft clone từ current version; snapshot gốc không đổi.
2. Metadata, content và variables dùng cùng form/component với create.
3. Primary action phụ thuộc loại thay đổi:
   - Chỉ metadata/status đổi: `Lưu thay đổi`, không tăng version.
   - Content hoặc variable contract đổi: `Tạo v{next}`, kèm change note bắt buộc.
4. Preview values hoặc thao tác copy không làm draft dirty và không tạo version.
5. Mở version cũ ở chế độ read-only. `Tạo draft từ phiên bản này` copy snapshot đó vào draft; khi lưu vẫn dùng số kế tiếp của current head, không ghi đè hoặc rẽ nhánh lịch sử.

## 4. Variable syntax và validation

- Placeholder trong prompt dùng đúng cú pháp `{{variable_name}}`.
- Tên chuẩn hóa lowercase snake_case và phải khớp `^[a-z][a-z0-9_]*$`; không hỗ trợ dấu cách, dấu chấm, nesting, condition, loop hoặc expression trong M2.
- Mỗi variable có: `name`, `label`, `description`, `type`, `required`, `defaultValue` tùy chọn và `options` khi type là `select`.
- Type hỗ trợ: `text`, `multiline`, `number`, `select`. Preview value được kiểm tra theo type; select phải có ít nhất một option không trùng.
- Tên khai báo phải unique. Placeholder được dùng nhưng chưa khai báo, placeholder sai cú pháp, khai báo trùng hoặc thiếu options là **error** và chặn save version lẫn render/copy.
- Required preview value bị thiếu hoặc value sai type là **preview error**: chặn render/copy nhưng không chặn lưu một template có source contract hợp lệ.
- Variable đã khai báo nhưng không xuất hiện trong content là **warning**, không chặn lưu. UI cho phép xóa variable thừa hoặc chèn placeholder tại caret.
- Parser và validator là pure functions dùng chung cho editor/preview; M2 không thêm schema library chỉ cho prototype.

## 5. Rendered prompt preview

- Preview gồm form giá trị biến ở trái và output plain text read-only ở phải; giá trị mặc định được điền trước nhưng vẫn có thể đổi trong phiên.
- Render thay thế literal tất cả placeholder bằng preview value. Required value thiếu hoặc token không hỗ trợ thì output không được coi là hợp lệ và `Sao chép` bị khóa.
- Optional value rỗng render thành chuỗi rỗng; preview giữ line break của content và không diễn giải Markdown/HTML.
- `Sao chép` dùng rendered output gần nhất hợp lệ; success hiển thị feedback ngắn “Đã sao chép”, failure giữ output và đưa ra hành động thử lại.
- Preview luôn gắn nhãn nguồn: `Bản nháp chưa lưu` hoặc version read-only đang xem, tránh nhầm với current version.

## 6. Version history

- Snapshot version là bất biến và sắp xếp mới nhất trước; current version có badge rõ ràng.
- Template mới bắt đầu ở `v1.0`; mỗi thay đổi content/variable tăng minor tuần tự (`v1.2` → `v1.3`). M2 chưa có thao tác tăng major.
- Metadata/status không tạo version. Thay đổi preview values không tạo version.
- Mỗi item hiển thị version, change note, thời gian và người tạo; có thể mở content/variables read-only và tạo draft từ snapshot.
- Không có delete, overwrite hoặc restore-in-place. “Khôi phục” luôn có nghĩa là tạo draft mới rồi xuất bản thành version kế tiếp.

## 7. Unsaved changes, confirm và error states

- Editor hiển thị `Chưa lưu` khi metadata, content hoặc variables khác base snapshot/state ban đầu; không autosave trong M2.
- Đổi step/tab bên trong cùng editor không hỏi xác nhận. Back, Cancel, sidebar navigation, đổi template hoặc đóng editor khi dirty mở confirm `Bỏ thay đổi` / `Tiếp tục chỉnh sửa`.
- Nếu clean, Cancel/Back thoát ngay. Tạo draft từ version cũ chỉ hỏi confirm khi draft hiện tại đang dirty.
- Validation hiển thị cạnh field và có summary focusable ở đầu form khi submit; field lỗi đầu tiên nhận focus.
- Mock load error dùng `ErrorState` với retry. Mock save/render/copy error dùng inline alert gần action, giữ nguyên toàn bộ draft/input và cho retry; không dùng toast làm nơi duy nhất chứa lỗi.
- History rỗng của template chưa tạo, preview chưa đủ dữ liệu và loading đều có state riêng nhưng không che mất dữ liệu người dùng đã nhập.

## 8. Layout và component contract

Authoring dùng workspace toàn trang bên trong app shell hiện có, không dùng modal chật cho prompt dài.

- Header: breadcrumb quay về Templates, tên create/edit, badge version/draft, `Hủy` và primary action.
- Stepper trong editor: `Thông tin`, `Nội dung & biến`, `Xem trước`; create đi theo thứ tự nhưng cho phép quay lại, edit cho phép chuyển tự do. `Lịch sử` là contextual rail riêng ở bên phải khi edit, không phải bước bắt buộc của create flow.
- Desktop `xl`: content chính và contextual rail/preview 360–450px. Dưới `xl`: các vùng xếp dọc; dưới `lg` tiếp tục dùng sidebar sheet của M1. Chỉ vùng editor code/prompt được scroll nội bộ khi thật sự cần, không tạo horizontal overflow toàn page.
- Dùng divider và section hierarchy, không bọc mỗi field thành card; warm-light canvas, navy text, orange accent, subtle border, minimal shadow và compact density giữ nguyên từ M1.

Tái sử dụng từ M1: `AppShell`/sidebar, `PageHeader`, `Button`, `Input`, `Select`, `Badge`/`StatusBadge`, `Tabs`, `DetailPanel` sections/dividers, `StateFeedback`, focus/reduced-motion và responsive conventions. `DataTable` tiếp tục phục vụ Templates browse; history ngắn dùng semantic list/divider thay vì ép vào table.

Shared primitive chỉ bổ sung khi implement: `Textarea`, `Field`/field message và `ConfirmDialog`. `TemplateEditor`, `VariableEditor`, `PromptPreview` và `VersionHistory` là feature component trước; chỉ nâng thành shared abstraction khi có consumer thứ hai rõ ràng.

## 9. Review contract đã duyệt

Các điểm sau đã được người dùng duyệt để bắt đầu implementation M2:

- field/terminology và ba status;
- cú pháp `{{variable_name}}`, variable types và blocking/warning rules;
- metadata-versus-version rule và minor-only numbering;
- full-page editor, step order và confirm behavior;
- happy path create/edit/preview/copy/version cùng empty/loading/error states.

Khi implement xong M2 phải dừng để review; không bắt đầu M3.
