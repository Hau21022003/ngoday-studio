# M2 UX Contract — Template Authoring Prototype

- **Status:** Approved ngày 2026-10-23
- **Implementation:** Rebuilt theo flow hai bước, awaiting milestone review ngày 2026-10-23
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

1. Từ Templates, chọn `Tạo template mới` để vào bước `Chỉnh sửa nội dung`.
2. Bước 1 đặt form metadata ở trái; prompt editor là vùng chính và variable editor dùng danh sách compact với một detail row có thể mở tại một thời điểm. Bước này không hiển thị preview.
3. `Tiếp tục` kiểm tra metadata, content và variable contract rồi chuyển sang `Xem trước & hoàn thành`.
4. Bước 2 hiển thị tóm tắt metadata, danh sách biến kèm input giá trị mẫu và prompt đã render. `Quay lại` giữ nguyên draft trong phiên.
5. `Hoàn thành` tạo snapshot `v1.0` rồi quay về Templates với row mới được chọn. Preview value tạm không phải điều kiện lưu.

### Edit

1. `Chỉnh sửa` từ detail panel mở bước `Chỉnh sửa nội dung` với draft clone từ current version; snapshot gốc không đổi.
2. Metadata, content, variables và review page dùng cùng component với create.
3. Primary action tại bước review luôn là `Hoàn thành`; hành vi lưu phụ thuộc loại thay đổi:
   - Chỉ metadata/status đổi: cập nhật record, không tăng version.
   - Content hoặc variable contract đổi: tạo `v{next}`, kèm change note bắt buộc.
4. Preview values hoặc thao tác copy không làm draft dirty và không tạo version.
5. Lịch sử tiếp tục hiển thị read-only trong detail panel sau khi lưu; authoring hai bước không dùng contextual history rail.

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

- Preview nằm trong bước 2: bảng biến compact cho phép nhập giá trị mẫu, còn output plain text read-only nằm ngay phía dưới để đối chiếu nhanh; giá trị mặc định được điền trước nhưng vẫn có thể đổi trong phiên.
- Render thay thế literal tất cả placeholder bằng preview value. Required value thiếu hoặc token không hỗ trợ thì output không được coi là hợp lệ và `Sao chép` bị khóa.
- Optional value rỗng render thành chuỗi rỗng; preview giữ line break của content và không diễn giải Markdown/HTML.
- `Sao chép` dùng rendered output gần nhất hợp lệ; success hiển thị feedback ngắn “Đã sao chép”, failure giữ output và đưa ra hành động thử lại.
- Header giữ badge `Chưa lưu` và version gốc khi edit để tránh nhầm preview với current version.

## 6. Version history

- Snapshot version là bất biến và sắp xếp mới nhất trước; current version có badge rõ ràng.
- Template mới bắt đầu ở `v1.0`; mỗi thay đổi content/variable tăng minor tuần tự (`v1.2` → `v1.3`). M2 chưa có thao tác tăng major.
- Metadata/status không tạo version. Thay đổi preview values không tạo version.
- Mỗi item trong tab lịch sử của detail panel hiển thị version, change note, thời gian và người tạo; content/variables của current version tiếp tục có tab read-only riêng.
- Không có delete, overwrite hoặc restore-in-place trong prototype hai bước.

## 7. Unsaved changes, confirm và error states

- Editor create luôn hiển thị `Chưa lưu`; editor edit hiển thị badge này khi metadata, content hoặc variables khác base snapshot/state ban đầu. Không autosave trong M2.
- Đổi step/tab bên trong cùng editor không hỏi xác nhận. Back, Cancel, sidebar navigation, đổi template hoặc đóng editor khi dirty mở confirm `Bỏ thay đổi` / `Tiếp tục chỉnh sửa`.
- Nếu edit đang clean, Cancel/Back thoát ngay. Create và edit dirty đều hỏi confirm trước khi rời authoring.
- Validation hiển thị cạnh field và có summary focusable ở đầu form khi submit; field lỗi đầu tiên nhận focus.
- Mock load error dùng `ErrorState` với retry. Mock save/render/copy error dùng inline alert gần action, giữ nguyên toàn bộ draft/input và cho retry; không dùng toast làm nơi duy nhất chứa lỗi.
- Preview chưa đủ dữ liệu và loading đều có state riêng nhưng không che mất dữ liệu người dùng đã nhập.

## 8. Layout và component contract

Authoring dùng workspace toàn trang bên trong app shell hiện có, không dùng modal chật cho prompt dài.

- Header: breadcrumb quay về Templates, tên create/edit, badge version/draft và action theo bước (`Hủy` + `Tiếp tục`, hoặc `Quay lại` + `Hoàn thành`).
- Stepper chỉ có hai bước rõ ràng: `Chỉnh sửa nội dung` và `Xem trước & hoàn thành`. Không có right preview panel ở bước chỉnh sửa.
- Bước 1 desktop dùng hai cột: metadata compact ở trái, prompt editor là vùng chính ở phải với variable list + expandable detail bên dưới. Bước 2 dùng cột review có chiều rộng giới hạn vừa đủ đọc, gồm ba section có divider: metadata, variables + sample inputs, rendered prompt.
- Dưới `lg`, các vùng xếp dọc và bảng cho phép overflow ngang cục bộ; sidebar vẫn dùng convention responsive của M1. Không tạo horizontal overflow toàn page.
- Dùng divider và section hierarchy, không bọc mỗi field thành card; warm-light canvas, navy text, orange accent, subtle border, minimal shadow và compact density giữ nguyên từ M1.

Tái sử dụng từ M1: `AppShell`/sidebar, `Button`, `Input`, `Select`, `Badge`/`StatusBadge`, `DetailPanel` sections/dividers, `StateFeedback`, focus/reduced-motion và responsive conventions. `DataTable` tiếp tục phục vụ Templates browse; authoring dùng section/divider thay vì tạo thêm dashboard card hoặc right rail.

Shared primitive chỉ bổ sung khi implement: `Textarea`, `Field`/field message và `ConfirmDialog`. `VariableEditor`, `ReviewVariables` và rendered preview là feature component trước; chỉ nâng thành shared abstraction khi có consumer thứ hai rõ ràng.

## 9. Review contract đã duyệt

Các điểm sau đã được người dùng duyệt để bắt đầu implementation M2:

- field/terminology và ba status;
- cú pháp `{{variable_name}}`, variable types và blocking/warning rules;
- metadata-versus-version rule và minor-only numbering;
- full-page editor hai bước, review flow và confirm behavior;
- happy path create/edit/preview/copy/version cùng empty/loading/error states.

Khi implement xong M2 phải dừng để review; không bắt đầu M3.
