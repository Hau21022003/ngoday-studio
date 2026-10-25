# M8 — Assets & Phase 1 Hardening Implementation Evidence

- **Status:** Approved/Completed ngày 2026-10-25; automated, packaged verification và manual acceptance trên Electron thực tế PASS.
- **Baseline:** commit `ef09196b` — M7 Approved/Completed.
- **Schema:** giữ nguyên migration `0001_phase1_core`; không có migration mới.
- **Boundary:** không commit/push, không triển khai Phase 2/Google Flow/Playwright/media export.

## 1. Asset planning và candidate lifecycle

- Tab Assets dùng `AssetSlot` persisted làm danh sách chính theo Scene display order + slot order; không còn seed/mock asset hoặc generation/export action giả.
- Create/update slot dùng typed IPC, optimistic revision và canonical name readonly. Slot append-only trong M8; media type không đổi khi còn active candidate.
- Candidate import mở native picker ở main. Renderer không gửi path/MIME/bytes/hash. Main kiểm tra signature PNG/JPEG/WebP/MP4/WebM/MOV, media type, file thường, size > 0 và free space khi filesystem hỗ trợ.
- File được stream-copy vào managed workspace qua `.partial` rồi atomic rename, đồng thời tính SHA-256. Disk full/copy failure/stale DB revision cleanup artifact mới; file nguồn không bị move/xóa/sửa.
- Duplicate SHA-256 trong cùng active slot bị chặn. Accept mới atomically reject accepted cũ; rejected candidate có thể re-accept. Archive chỉ archive metadata, không xóa binary.
- UI hiển thị lifecycle `candidate/accepted/rejected` và integrity `unattached/available/missing/hash_mismatch` riêng. Action `Kiểm tra lại` không đổi lifecycle. Open/reveal resolve path từ Asset ID trong main.

## 2. Metadata backup/restore

- Settings có export và restore metadata backup v1; copy ghi rõ backup không chứa binary ảnh/video, browser profile, credential hoặc dữ liệu render/import tạm.
- Backup JSON strict có format/schema/app version, timestamp, payload SHA-256 và toàn bộ metadata Template/Version, Episode, SceneImportBatch, Scene/narration, AssetSlot, Asset.
- Restore có ConfirmDialog trước native picker và chỉ chạy khi database business trống. Không merge, overwrite, reset hoặc xóa dữ liệu hiện tại.
- Main validate checksum, unique IDs/names/order/path, reference, canonical mapping, one-accepted và slot status invariant trước transaction; sau insert kiểm tra record count, foreign keys và SQLite quick check.
- Binary bị loại khỏi backup; relative path vẫn được giữ. Khi restore sang workspace trống, Asset accepted giữ lifecycle nhưng integrity là `missing` và Episode không `ready_to_export`. Missing thumbnail dùng fallback thay vì làm hỏng Episode workspace.
- SQLite backup trước migration trong `src/main/persistence/backup.ts` giữ nguyên vai trò và implementation.

## 3. Phase 1 hardening và regression boundary

- M1–M7 Template/Episode/thumbnail/notes autosave/Scenes render-import-edit-order-approval tiếp tục chạy trên cùng typed bridge.
- Canonical AssetSlot Zod pattern, service generation và DB unique constraint thống nhất; Scene reorder không đổi canonical number/name.
- Episode workflow `ready_to_export` yêu cầu mọi Scene approved, required slot fulfilled và accepted file available.
- Không thêm dependency, network call, media protocol, queue/generation model, CharacterReference, Flow hoặc export/CapCut implementation.

## 4. Automated evidence

### `npm run verify` — PASS ngày 2026-10-25

- 9 test files, 45 tests PASS.
- Typecheck main/preload/shared/renderer PASS.
- Production build PASS cho main, CommonJS sandboxed preload và renderer.
- Coverage mới gồm:
  - file copy giữ nguyên source, signature/media mismatch, empty file và duplicate hash;
  - cleanup managed copy khi revision đổi sau copy;
  - accepted replacement, archive giữ binary, missing/hash mismatch không đổi lifecycle;
  - restart giữ accepted Asset và integrity available;
  - strict IPC không nhận renderer source path;
  - backup checksum/tamper/empty-only/transaction round-trip và binary exclusion.

### `npm run package` — PASS ngày 2026-10-25

- Script `package` chạy build, Windows unpacked package và packaged smoke đầy đủ. Output verification dùng `release/m8-verify` để không ghi đè executable manual-review đang mở; `package:verify` hiện hữu vẫn giữ default output.
- Service smoke tạo/approve Scene + AssetSlot, native-runtime managed import, accept Asset, metadata export và restore vào database/workspace trống; restored Asset metadata giữ nguyên và integrity `missing` vì binary không nằm trong backup.
- Relaunch đọc lại accepted Asset với integrity `available`, Episode `ready_to_export`, thumbnail và Template/Episode metadata.
- Hai bridge phases M6–M7 tiếp tục xác nhận CommonJS preload, typed IPC và restart persistence.
- Cuối smoke: migration version `1`, name `phase1_core`, `PRAGMA integrity_check = ok`.

### `git diff --check`

- PASS ngày 2026-10-25; chỉ có cảnh báo line-ending LF/CRLF theo Git config Windows, exit code `0` và không có whitespace error.

### Cảnh báo không chặn

- `node:sqlite` vẫn in experimental warning theo Electron runtime hiện tại.
- electron-builder tiếp tục báo default icon và duplicate dependency references từ baseline; package/smoke không thất bại.

## 5. Manual acceptance checklist — PASS

- [x] Assets tab hiển thị đúng các AssetSlot M7 hiện có; không còn dữ liệu/action mock.
- [x] Tạo slot mới và sửa prompt/media/required; dirty guard, save, reload và restart đúng.
- [x] Scene reorder không đổi canonical name hoặc Scene/slot mapping.
- [x] Native import cancel không mutation; import hợp lệ copy file nhưng không đổi file nguồn.
- [x] Empty/wrong-type/duplicate file có feedback rõ; disk-full/partial-copy cleanup có automated filesystem coverage.
- [x] Accept/reject/re-accept/replace accepted/archive đúng; archive không xóa binary.
- [x] Xóa managed file ngoài app hiện `missing`; sửa file hiện `hash_mismatch`; `Kiểm tra lại` cập nhật UI nhưng không đổi lifecycle.
- [x] Accepted file missing/mismatch làm Episode rời `ready_to_export`.
- [x] Đóng/mở Electron giữ slot/candidate/status/file integrity.
- [x] Settings ghi rõ backup không chứa binary; restore luôn hỏi xác nhận.
- [x] Restore trên database business không trống bị chặn và không thay đổi dữ liệu.
- [x] Restore metadata trên database trống tái tạo Template/Episode/Scene/narration/AssetSlot/Asset metadata; binary vắng mặt hiển thị missing và UI không crash.
- [x] Regression Template, Episode, thumbnail, Overview notes autosave và toàn bộ M7 Scenes workflow PASS.
- [x] Toàn bộ Phase 1 pilot chạy offline; không có Flow/Playwright/generation/export implementation.

## 6. Checkpoint

Người dùng xác nhận manual acceptance PASS trên Electron thực tế ngày 2026-10-25, gồm AssetSlot, file import, accept/reject/archive, integrity, restart persistence, metadata backup/restore và regression M1–M7. M8 và Phase 1 kết thúc ở trạng thái Approved/Completed; không triển khai Phase 2 trong thay đổi này.
