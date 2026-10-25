# M5B — Persistence Foundation implementation

- **Status:** Approved/Completed ngày 2026-10-24; checkpoint review PASS trước M6.
- **Contract source:** `08-m5-domain-persistence-contract.md`.
- **Scope guard:** chưa nối renderer M1–M4 vào database và không thay đổi UI.

## 1. Thành phần đã tạo

- Shared domain/validation/IPC contract tại `src/shared/` dùng Zod strict schemas cho request, response, entity và JSON Scenes v1.
- SQLite owner tại main process dùng `node:sqlite`, bật `foreign_keys`, WAL và `busy_timeout`.
- Migration `0001_phase1_core.sql` tạo đúng graph `Template/TemplateVersion`, `Episode`, `SceneImportBatch`, `Scene`, `AssetSlot`, `Asset`; không có Script table.
- Migration runner forward-only khóa checksum, chặn schema không được quản lý, dùng `BEGIN IMMEDIATE`, rollback khi lỗi và hoàn tất trước khi đăng ký business IPC.
- Backup safety checkpoint WAL, tạo consistent backup cho database đã có version trước migration, chuyển backup sang delete journal mode và chạy integrity check.
- Row mapper validate output database trước khi trả domain object.
- Repository cho Template, Episode, Scene/import batch, AssetSlot và Asset; không expose raw SQL/row.
- Application services sở hữu optimistic concurrency, status/invariant, canonical naming, file-boundary/integrity và transaction nhiều repository.
- Preload expose allowlisted `StudioApi`; main validate cả request lẫn response và trả `IpcResult` có mã lỗi ổn định.

## 2. Import Scenes

- Preview bóc tối đa một outer Markdown JSON fence, parse JSON v1 strict, reject unknown key, giới hạn 1 MiB/200 Scenes và tạo normalized preview + SHA-256 payload hash.
- Commit nhận lại raw JSON/hash/template version/mode/expected Episode revision, revalidate trước transaction.
- `append` cấp tiếp `displayOrder` và `canonicalNo`; `replace` chỉ chạy khi graph chưa có Asset.
- Một transaction ghi `SceneImportBatch`, toàn bộ Scenes, required AssetSlots mặc định khi thiếu và bump Episode revision. Lỗi ở bất kỳ bước nào rollback toàn bộ.
- Provenance giữ `templateVersionId`, payload hash và optional rendered-prompt hash; không persist raw prompt, raw JSON hoặc `Nội dung nguồn`.

## 3. Safety và verification

- `npm run test`: unit/integration cho migration empty/N-1/rollback/checksum/unmanaged schema, repository concurrency/constraint, import append/replace/conflict/atomicity, asset lifecycle/file integrity và IPC trust boundary.
- `npm run build`: typecheck main/preload/shared/renderer và production build.
- `npm run package:verify`: tạo Windows unpacked package, khởi chạy chính executable với workspace tạm, xác nhận migration version `1` và `PRAGMA integrity_check = ok`.
- Package smoke loại `ELECTRON_RUN_AS_NODE` khỏi môi trường tiến trình con để kiểm tra đúng Electron runtime thay vì Node mode của test host.

## 4. Rủi ro còn lại

- `node:sqlite` vẫn được Node gắn nhãn experimental; mọi lần nâng Electron/Node phải chạy lại full test và packaged-runtime smoke.
- M5B chưa có recovery UI hoặc thao tác restore; runner giữ backup và fail-fast để người dùng/phần M8 phục hồi có chủ đích.
- File integrity hiện được derive đồng bộ từ filesystem/hash khi query; thư viện media lớn có thể cần cache/background verification ở M8.
- Register imported asset hiện chỉ chấp nhận path đã nằm trong workspace; flow chọn/copy file ngoài workspace thuộc vertical slice/UI integration sau.
- Windows package đang dùng icon mặc định và chưa code-sign; đây là packaging hardening ngoài persistence contract hiện tại.

## 5. Kết quả checkpoint review

- Người dùng duyệt M5B với kết quả **PASS** ngày 2026-10-24 dựa trên verification và Windows packaged smoke hiện tại.
- Lần xác nhận tại checkpoint: `npm run verify` PASS với 3 test files/15 tests, typecheck PASS và production build PASS.
- `npm run package:verify` PASS: executable Windows unpacked khởi tạo database, áp dụng migration version `1` và trả `PRAGMA integrity_check = ok`.
- M5B không nối renderer M1–M4 vào database. M6 chưa được implement và phải dừng tại checkpoint kế hoạch riêng trước khi viết code.
