# Phase 1 — Báo cáo triển khai

**Ngày hoàn tất kỹ thuật:** 2026-10-23
**Trạng thái:** Hoàn tất local trên branch `feat/phase-1`, chờ người dùng review; chưa push/merge.

## 1. Phạm vi đã triển khai

- Electron + React + TypeScript, renderer sandboxed, typed IPC validate hai chiều.
- SQLite local với migration, foreign key, WAL và transaction.
- Episode create/edit/archive/search và mở lại sau restart.
- Prompt template/version bất biến, allowlist biến, render/copy và rendered snapshot.
- Script editor, autosave, import Markdown/JSON, immutable revision và revision history.
- Scene reorder có preview canonical rename và confirmation.
- Scene approval với validation scene/slot/reference.
- Asset slot tự do theo scene, image/video, prompt, required flag, references và canonical name.
- Character reference metadata: path, MIME, size, SHA-256, availability.
- Metadata backup/restore versioned; restore chỉ vào database trống.
- Responsive layout cho cửa sổ desktop/laptop từ 960px trở lên.

Không có Playwright, Flow adapter, generation, video automation, batch/unattended workflow, LLM API hoặc CapCut automation.

## 2. Kiến trúc thực tế

```text
React renderer
  -> Tailwind CSS v4 + source-owned shadcn/ui primitives
  -> sandboxed preload / typed use-case API
  -> Electron main services
  -> repository
  -> SQLite (node:sqlite)
```

`node:sqlite` được chọn thay cho `better-sqlite3` sau khi native rebuild yêu cầu Visual Studio C++ toolchain trên máy phát triển. Lựa chọn này giữ nguyên data model/transaction semantics, bỏ dependency native và đơn giản hóa setup/packaging. Electron 45 dùng Node 24; test local cũng chạy được trên Node 22.22.1.

Database chỉ có aggregate Phase 1. Queue, generation attempt, Flow asset, media version và export snapshot chưa được tạo sớm.

## 3. Quy tắc nghiệp vụ đã chốt

- Canonical name: `scene-{sceneOrder:02}-{assetOrder:02}`; số thứ hai là asset logic, không phải retry.
- Scene có số asset slot tự do; slot chọn `image` hoặc `video`.
- Scene approved cần title, ít nhất một nội dung, ít nhất một slot, prompt slot không rỗng và mọi reference còn đúng size/hash.
- Sửa scene hoặc asset slot đã approved chuyển scene sang `needs_changes`.
- Episode tự chuyển `script_ready` khi có scene và toàn bộ scene đã approved; thay đổi làm mất điều kiện sẽ đưa Episode về `draft`.
- Reorder có asset slot bắt buộc preview/xác nhận; cập nhật order và canonical name trong một transaction.
- Import thay scene hiện có cần xác nhận và rollback toàn bộ nếu lỗi.
- Template version, script revision và rendered prompt snapshot không bị update đè.

## 4. Kiểm thử

Các lệnh verification:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Test tự động bao phủ:

- template variables/rendering;
- Markdown/JSON parser và invalid fixtures;
- canonical naming/reorder preview;
- migration, foreign key/unique constraint và reopen database;
- Episode CRUD/search/archive;
- immutable template/script revisions;
- import rollback;
- approval/invalidation;
- backup/restore database trống;
- autosave qua close/reopen;
- renderer load flow, điều hướng Tabs, field validation, AlertDialog và debounce autosave.

Electron production build được smoke bằng `userData` tạm: main process mở database, sandboxed preload expose bridge, renderer gọi `episodes.list` qua validated IPC rồi app thoát. Smoke không mở Flow và không dùng network/AI credit.

## 5. Đối chiếu acceptance criteria

| Acceptance criterion                         | Kết quả                                         |
| -------------------------------------------- | ----------------------------------------------- |
| Episode giữ dữ liệu qua restart              | PASS — integration test reopen database         |
| Template thay biến, báo missing/unsupported  | PASS — unit tests                               |
| Revision mới không đổi snapshot cũ           | PASS — integration tests                        |
| Import đúng thứ tự; lỗi không ghi nửa chừng  | PASS — parser + rollback tests                  |
| Reorder preview và xác nhận canonical rename | PASS — service + UI                             |
| Scene chỉ approved khi hợp lệ                | PASS — validation test                          |
| Canonical name duy nhất trong Episode        | PASS — DB constraint + test                     |
| Autosave giữ nội dung sau đóng/mở            | PASS — integration + renderer debounce test     |
| Backup/restore tái tạo metadata vào DB trống | PASS — integration test                         |
| Không có network call bắt buộc               | PASS — Phase 1 không có provider/network client |

## 6. Ghi chú vận hành

- Chạy development bằng `npm run dev`.
- App database nằm ở Electron `userData/app.db`.
- Character reference không được copy; app phát hiện file bị mất hoặc thay đổi bằng size/SHA-256.
- Installer, code signing và auto-update được giữ ngoài Phase 1.
- PoC tại `poc/flow-playwright` không bị import hoặc thay đổi.

## 7. UI system Phase 1

Renderer Phase 1 đã được chuẩn hóa bằng Tailwind CSS v4 và shadcn/ui theo hướng source-owned. Chỉ các primitive đang được dùng mới được thêm: Button, Input, Textarea, Select, Checkbox, Field/Label, Card, Badge, Alert, Separator, Tooltip, Dialog, AlertDialog, Tabs và Spinner.

- Theme dùng CSS variables semantic nhưng giữ palette navy/cam, nền giấy ấm và heading serif của thiết kế ban đầu.
- Navigation chính dùng Tabs có semantics và keyboard behavior; ở cửa sổ hẹp sidebar thu gọn nhưng workspace vẫn giữ đủ chiều rộng thao tác.
- Episode và template create form dùng React Hook Form + Zod để hiển thị lỗi tại field. Scene editor không chuyển sang form library để giữ nguyên controlled autosave, debounce 700 ms và optimistic revision check.
- Mọi xác nhận archive/delete/restore/replace/reorder dùng AlertDialog thay cho `window.confirm`; dialog có title, description, focus trap và trả focus về trigger.
- Scene/asset grid tự chuyển từ nhiều cột sang một cột theo chiều rộng; toolbar được phép wrap. Mục tiêu sử dụng là desktop/laptop từ 960 px trở lên.
- Autosave status dùng live region; icon-only action giữ accessible name và có tooltip; field lỗi dùng `aria-invalid` và `role="alert"`.
- Stylesheet renderer giảm từ 833 dòng CSS component thủ công xuống 103 dòng theme/base; layout và state styling còn lại nằm cạnh component bằng Tailwind utilities.

Migration UI không thay đổi domain, SQLite migration, repository/service, preload, IPC contract hoặc Flow PoC. Không có Flow call, network client hay AI credit được sử dụng.
