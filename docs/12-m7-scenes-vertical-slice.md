# M7 — Scenes Vertical Slice Implementation Evidence

- **Status:** Approved/Completed ngày 2026-10-25; automated, packaged verification và manual acceptance trên Electron review PASS.
- **Baseline:** commit `eb90e20` — M6 Approved/Completed.
- **Scope:** chỉ Scenes vertical slice. Không đổi schema/migration `0001`, không triển khai Asset planning UI, backup/restore hoặc hardening thuộc M8.

## 1. Kết quả implementation

### Tạo và import Scenes

- Flow chỉ tải Scene Template đang `active`, cho chọn TemplateVersion bất biến và để main kiểm tra lại eligibility.
- Main tự map Episode vào `episode_title`, `topic`, `notes`; hỗ trợ `source_content` tùy chọn cùng alias M5B `episode_topic`/`episode_description`. Custom Template variables được nhập trong flow.
- Prompt render qua typed IPC và có thể copy thủ công sang ChatGPT; app không gọi LLM.
- Nút **Xem JSON mẫu** mở dialog read-only với strict Scenes JSON v1 đầy đủ (Scene + AssetSlot), cho copy kèm feedback. Mẫu nằm ở shared module dùng chung với regression; không tự chèn vào Template, raw JSON hoặc rendered prompt.
- Paste hoặc chọn file JSON tối đa 1 MiB; main dùng strict JSON Scenes v1, preview hash/warning/count/canonical mapping rồi mới commit.
- Append/replace dùng import transaction và optimistic Episode revision đã có từ M5B. Replace có confirm và chỉ hợp lệ khi graph asset-free.
- `Nội dung nguồn`, custom render values, rendered prompt và raw JSON không được persist.

### Review, edit, approval và reorder

- Scene list/detail lấy dữ liệu persisted từ Episode aggregate và `scenes.get`; có search, filter, sort và loading/error/empty state.
- Editor dùng explicit Save với Scene `expectedRevisionNo`. Validation/error/stale giữ nguyên draft; reload bản lưu là thao tác chủ động.
- Notes-only giữ trạng thái approved. Sửa title/summary/narration/visual/type/media của Scene approved làm Scene về draft theo service hiện có.
- Status transition tách riêng; main chặn approval nếu narration hoặc visual description trống và trả field error về editor.
- AssetSlot/import provenance được hiển thị read-only để kiểm tra media prompt/canonical mapping. Không có mutation AssetSlot/Asset trong M7 UI.
- Reorder dùng toàn bộ persisted Scene IDs, có keyboard buttons và drag alternative, preview `displayOrder` cũ/mới cùng canonical names; commit không đổi `canonicalNo`.

### Dirty state và concurrency

- Chuyển Scene, rời tab, mở route khác hoặc đóng cửa sổ khi Scene/order còn dirty đều có guard phù hợp.
- Import/reorder chờ cả request Episode notes autosave đang in-flight. Autosave failure hoặc `STALE_REVISION` dừng structural mutation và giữ notes draft.
- Autosave controller được kích hoạt lại sau lifecycle replay của React StrictMode; dev mode không còn báo giả notes conflict chỉ vì effect cleanup kiểm tra.
- Ngay trước mutation, renderer đọc Episode revision mới nhất và so Scene structure signature với snapshot preview/reorder. Thay đổi đồng thời làm dừng commit, giữ JSON/order draft.
- Main vẫn là authority cuối: revalidate Template eligibility, raw payload/hash, replace rule và `expectedEpisodeRevisionNo` trong transaction.

## 2. Boundary giữ nguyên

- Không có migration/schema mới; không thêm table, repository hoặc IPC generic.
- Tái sử dụng `SceneCreationService`, `SceneService`, repository transaction, domain validation, typed IPC và sandboxed CommonJS preload từ M5B/M6.
- Không tạo Script object/revision, không persist prompt/source/raw response.
- Không nối Output Contract/JSON Schema vào rendered prompt và không thêm biến JSON mẫu bắt buộc cho Template.
- M1–M6 Template/Episode/thumbnail/autosave flows vẫn nằm trong cùng regression và packaged smoke.
- M8 chưa bắt đầu: chưa chỉnh sửa AssetSlot, chưa register/accept/reject Asset, chưa backup/restore UI và chưa hardening Phase 1.

## 3. Automated evidence

### `npm run verify` — PASS ngày 2026-10-25

- 7 test files, 38 tests PASS.
- Typecheck main/preload/shared/renderer PASS.
- Production build PASS cho main, CommonJS preload và renderer.
- Regression bao phủ JSON mẫu tập trung qua strict import preview, reserved Scene variables/transient source, Template eligibility, strict import/atomic rollback, Scene edit/approval demotion/invalid approval/stale revision, reorder/stale Episode revision/canonical stability, renderer draft/order helpers, Episode autosave single-flight failure gate + StrictMode lifecycle replay, typed IPC/preload surface và restart persistence.

### `npm run package:verify` — PASS ngày 2026-10-25

- Windows unpacked package build PASS và chạy chính `Ngộ Dậy Studio.exe` trên temp workspace cô lập.
- Four-launch smoke vẫn xác nhận M6 service/renderer-bridge restart paths.
- `bridge-write` chạy M7 qua sandboxed preload: auto-render Scene prompt, strict preview/commit hai Scene, edit, approve cả hai và reorder.
- `bridge-read` relaunch cùng database: xác nhận Scene count/order, approval + edit, canonical number, AssetSlot prompt và provenance TemplateVersion; sau đó Episode revision vẫn update được.
- Migration vẫn version `1`, `phase1_core`; `PRAGMA integrity_check = ok`.

Cảnh báo không chặn giữ nguyên baseline: runtime vẫn đánh dấu `node:sqlite` experimental; electron-builder vẫn báo default icon và duplicate dependency references.

## 4. Manual acceptance checklist

- [x] Tạo hoặc dùng một Scene Template `active`, mở một Episode persisted và vào tab **Scenes**.
- [x] Mở **Tạo / Import** rồi **Xem JSON mẫu**; xác nhận dialog có Scene + AssetSlot đầy đủ, nút **Sao chép JSON** báo thành công và không tự điền Template/prompt/ô JSON.
- [x] Mở **Tạo / Import**, chọn đúng TemplateVersion; xác nhận prompt có title/topic/notes Episode, có `Nội dung nguồn` khi nhập và copy được.
- [x] Import JSON thực tế trên Electron: tạo đủ 26 Scenes và 26 AssetSlots; dữ liệu hiển thị đúng trong Scene List/Detail — người dùng xác nhận ngày 2026-10-25.
- [x] Thử JSON sai/unknown field; xác nhận không có Scene nào được ghi nửa chừng và raw JSON vẫn còn để sửa.
- [x] Edit một Scene, Save, chuyển Scene khác rồi quay lại; nội dung đã lưu còn nguyên. Thử rời Scene khi chưa Save và kiểm tra confirm giữ/bỏ draft.
- [x] Xóa narration hoặc visual description rồi thử approve; xác nhận bị chặn và lỗi nằm đúng field. Bổ sung đủ dữ liệu và approve thành công.
- [x] Sửa content của Scene approved và Save; xác nhận Scene về draft. Approve lại, chỉ sửa notes và Save; xác nhận approval được giữ.
- [x] Reorder ít nhất hai Scene, kiểm tra preview rồi Save; display order đổi nhưng canonical number/tên AssetSlot không đổi.
- [x] Thử **replace** trên graph asset-free, đọc confirm kỹ và xác nhận canonical numbering bắt đầu lại từ 1.
- [x] Trong lúc Scene/order dirty, thử đổi tab, mở Edit Episode hoặc quay về Episodes; xác nhận guard không làm mất draft ngoài ý muốn.
- [x] Đóng/mở lại app; xác nhận import, edit, approval, order, AssetSlot prompt và provenance vẫn còn.
- [x] Smoke M1–M6: mở Templates, lưu một Template; mở Episodes/Overview, sửa notes và xác nhận autosave vẫn hoạt động.

## 5. Checkpoint

Người dùng xác nhận manual acceptance PASS trên Electron review ngày 2026-10-25. M7 kết thúc tại checkpoint Approved/Completed; không triển khai M8 trong thay đổi này.
