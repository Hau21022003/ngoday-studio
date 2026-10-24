# M6 — UI Persistence Integration Evidence

- **Status:** Approved/Completed ngày 2026-10-24; manual acceptance trên ứng dụng thực tế, automated verification và dev/packaged bridge smoke đều PASS.
- **Baseline:** `4406b3f` (M4 docs), `a583d90` (M5B persistence foundation), `3ffe9f2` (M6 plan).
- **Scope:** chỉ Template và Episode; Scene/Asset UI vẫn là prototype mock cho M7/M8.

## 1. Kết quả implementation

### Template

- Browse/detail/history lấy `TemplateSummary`/`TemplateAggregate` từ SQLite qua `window.studio.templates`.
- Create giao UUID, timestamp, hash và initial immutable version cho main service.
- Edit dùng additive `templates.saveEdit`; metadata + immutable version nằm trong một transaction và tăng Template revision đúng một lần.
- Renderer giữ draft/field error khi IPC lỗi hoặc `STALE_REVISION`; không tự ghi đè.
- Preview draft vẫn phản hồi tức thời bằng pure renderer policy; thao tác copy trên persisted version gọi typed `templates.render` để main revalidate/render.

### Episode

- List/create/edit/archive/workspace dùng persisted ID và typed Episode IPC; workflow status chỉ là projection read-only.
- Workspace Overview load aggregate, timestamps, scene count và production progress thật.
- Notes autosave debounce 750 ms, chỉ một request in-flight, coalesce snapshot mới nhất và chain revision từ response.
- `STALE_REVISION` khóa auto retry, giữ nguyên draft; người dùng chủ động “Đồng bộ và lưu lại” để lấy revision mới rồi retry draft.
- Thumbnail import/read chỉ qua `episodeThumbnails` allowlist: PNG/JPEG/WebP, tối đa 5 MiB, kiểm tra magic signature, content-addressed relative path, temp-write + atomic rename và chặn traversal/symlink ra ngoài workspace.

### Boundary và guardrail

- Renderer không nhận Node, SQLite, filesystem hay channel string tự do.
- Không sửa schema/migration `0001_phase1_core.sql`; không seed production database.
- Không nối Scene/Asset component với persistence và không gọi mutation Scene/Asset từ M6 UI.
- Layout, route/hash, component primitives và visual tokens M1–M4 được giữ nguyên; chỉ thêm loading/error/conflict/save feedback cần cho dữ liệu thật.

## 2. Automated evidence

### Preload blocking defect và regression

- Manual acceptance ban đầu phát hiện `window.studio` là `undefined` ở Template Preview & Complete và Episode create/save.
- Root cause đã tái hiện ở cả dev và packaged executable: sandboxed preload được build thành ESM `index.mjs`; Electron log `SyntaxError: Cannot use import statement outside a module`, nên `contextBridge.exposeInMainWorld` chưa từng chạy.
- Fix tại boundary: preload build CommonJS `index.cjs`, BrowserWindow dùng cùng shared artifact name; vẫn giữ `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- Renderer bootstrap kiểm tra bridge M6 trước khi mount và fail-fast với lỗi rõ ràng; không có mock/in-memory fallback.
- Dev smoke đã mở renderer thật, gọi Template create/save/render, Episode create/revision-chain update và thumbnail import/read qua `window.studio`, rồi ghi success marker.

### `npm run verify` — PASS

- 6 test files, 28 tests PASS.
- Typecheck main/preload/shared/renderer PASS.
- Production build PASS: main, preload và renderer bundles.
- Bao phủ Template/Episode CRUD/list/archive, atomic Template edit + rollback, immutable version, stale revision, typed IPC validation/error, thumbnail trust boundary, autosave debounce/single-flight/coalesce/conflict, preload bridge surface/format/fail-fast và reopen cùng SQLite/workspace.

### `npm run package:verify` — PASS

- Windows unpacked package build PASS.
- Khởi chạy chính `Ngộ Dậy Studio.exe` bốn lần trên cùng temp root, với Electron user-data cũng được cô lập trong temp root:
  1. Lần `write` tạo Template, Episode notes và thumbnail trong database/workspace tạm.
  2. Lần `read` mở lại đúng database/workspace và xác nhận aggregate/version/notes/thumbnail còn nguyên.
  3. Lần `bridge-write` mở renderer thật với sandboxed preload, xác nhận `window.studio`, rồi gọi Template create/atomic edit/render, Episode create + hai update nối revision và thumbnail import/read qua IPC.
  4. Lần `bridge-read` relaunch executable, đọc lại cùng dữ liệu qua preload/IPC, kiểm tra list/get/thumbnail và lưu Episode notes thêm một revision.
- Migration version `1`, tên `phase1_core` và `PRAGMA integrity_check = ok`.
- Temp smoke root được kiểm tra path trước khi xóa; không dùng production user-data.

Các cảnh báo không chặn: `node:sqlite` vẫn experimental theo runtime Electron; package dùng default Electron icon và electron-builder báo duplicate dependency references đã có từ baseline.

### Manual acceptance — PASS

- Người dùng xác nhận Template lưu thành công trên ứng dụng thực tế.
- Người dùng xác nhận Episode lưu thành công trên ứng dụng thực tế.
- Lỗi blocking `Cannot read properties of undefined` tại `window.studio.templates`/`window.studio.episodes` không còn tái hiện sau preload fix.

## 3. Files thay đổi

- Shared/IPC/preload: `src/shared/domain.ts`, `src/shared/validation.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`.
- Main: Template atomic edit, thumbnail service/wiring/IPC và packaged two-launch smoke trong `src/main/**` + `scripts/verify-package.mjs`.
- Renderer/preload bootstrap: CommonJS preload build/path, testable bridge factory, renderer bridge assertion, Template/Episode browse/authoring/workspace, view mapping, typed result helper và single-flight autosave controller.
- Tests: `tests/ipc-contract.test.ts`, `tests/persistence-services.test.ts`, `tests/autosave-controller.test.ts`, `tests/restart-persistence.test.ts`, `tests/preload-bridge.test.ts`.
- Docs: roadmap, decision semantics, plan status và evidence này.

## 4. Checkpoint và rollback

- M6 đã được duyệt và được chốt bằng một commit local riêng với message `feat(persistence): integrate Template and Episode UI`; không push theo yêu cầu.
- Rollback dùng `git revert` commit M6 để giữ lịch sử và không chạm commit baseline `3ffe9f2`; không cần down migration vì M6 không đổi schema.
- Thumbnail đã nhập vào workspace người dùng không bị tự xóa khi rollback; cleanup vẫn deferred để tránh mất dữ liệu.
- M7 chưa được triển khai trong commit này.
