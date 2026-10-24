# M6 — UI Persistence Integration Plan

- **Status:** Approved ngày 2026-10-24; chưa implement.
- **Prerequisite:** M5A và M5B Approved/Completed ngày 2026-10-24.
- **Contract source:** `08-m5-domain-persistence-contract.md`.
- **UI baseline:** M1–M4 đã duyệt; giữ nguyên information architecture, layout, component primitives và interaction chính.

## 1. Mục tiêu và guardrail

M6 thay nguồn dữ liệu mock/in-memory của Templates và Episodes bằng SQLite thông qua `window.studio` typed preload/IPC đã có từ M5B. Kết quả phải là một vertical slice local-first có thể đóng hẳn ứng dụng, mở lại và tiếp tục với dữ liệu đã lưu.

Guardrail bắt buộc:

1. Không redesign, không đổi route/navigation, spacing, typography, màu hoặc cấu trúc browse/detail/authoring đã duyệt.
2. Không thêm/sửa table, column, constraint hoặc migration `0001_phase1_core.sql` trong M6.
3. Không đưa SQLite, filesystem hoặc `ipcRenderer` vào renderer; renderer chỉ gọi API allowlist từ preload.
4. Không seed mock vào production database. Database mới phải đi qua empty state thật và tạo dữ liệu bằng UI.
5. Không đổi invariant đã duyệt: TemplateVersion bất biến; Episode workflow status là projection; mutation dùng `expectedRevisionNo`.
6. Không nối Scenes/Assets UI vào persistence trong M6. Hai phần này tiếp tục ở M7/M8 sau checkpoint tương ứng.
7. Dữ liệu nhập chưa lưu phải được giữ trong component khi request lỗi hoặc revision conflict; không tự reload/ghi đè draft.

## 2. Kết quả rà soát Git trước M6

Snapshot tại checkpoint lập kế hoạch:

- Nhánh `feat/phase-1-ui-foundation` đi trước remote 3 commit; ba commit này là tài liệu workflow, Scenes workspace và Assets workspace đã có trước M5B.
- Index hiện có 6 file tài liệu staged; 11 file tracked có unstaged changes; 37 file untracked sau khi thêm evidence/kế hoạch.
- Các file runtime chưa commit truy vết được về M5B: package/config, main startup, preload bridge, shared contract, migration, repositories, services, IPC, tests và packaged smoke.
- Không có renderer component M1–M4 nào bị sửa trong implementation M5B; file renderer mới duy nhất là declaration cho `window.studio`.
- `git diff HEAD --check` không báo whitespace error; Git chỉ cảnh báo một số working-copy LF sẽ được chuyển sang CRLF nếu Git ghi lại file.
- `out/` và `release/` là generated output đã ignore; không đưa vào commit.

### 2.1. Đề xuất tách commit sạch

Không commit trực tiếp trạng thái index hiện tại vì M5A docs đang staged nhưng phần implementation M5B còn unstaged/untracked. Trước khi commit, chỉ chuẩn hóa index bằng thao tác unstage an toàn; không discard hoặc checkout worktree.

Đề xuất ba commit tuần tự:

1. `docs(phase1): record approved M4 baseline`
   - `docs/06-ui-foundation.md` và hunk M2–M4 status tương ứng trong `docs/03-roadmap.md`.
   - Lý do tách: đây là tài liệu đi kèm hai commit Scenes/Assets đã tồn tại, không phải implementation persistence.
2. `feat(persistence): complete M5B foundation`
   - `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.node.json`, `vitest.config.ts`.
   - `src/main/domain/**`, `src/main/persistence/**`, `src/main/services/**`, `src/main/ipc/**`, `src/main/types/**`, `src/main/index.ts`.
   - `src/shared/**`, `src/preload/index.ts`, `src/renderer/src/studio-api.d.ts`.
   - `tests/**`, `scripts/verify-package.mjs`.
   - `docs/01-workflow.md`, `docs/02-architecture.md`, các hunk M5 trong `docs/03-roadmap.md`, `docs/05-decisions.md`, `docs/08-m5-domain-persistence-contract.md`, `docs/09-m5b-persistence-foundation.md`.
   - Chạy lại `git diff --cached --check`, `npm run verify` và `npm run package:verify` ngay trước commit.
3. `docs(m6): add UI persistence integration plan`
   - `docs/10-m6-ui-persistence-integration-plan.md` và hunk link M6 trong `docs/03-roadmap.md`.

Dùng staging theo path và `git add -p` cho `docs/03-roadmap.md`; không dùng reset/checkout làm mất worktree. Không squash ba commit đang đi trước remote vào M5B.

## 3. Baseline và khoảng cách cần nối

M5B đã expose đầy đủ `window.studio.templates`, `episodes`, `sceneCreation`, `scenes`, `assetSlots` và `assets`, nhưng renderer chưa gọi API này.

| Khu vực | Hiện tại | Đích M6 |
| --- | --- | --- |
| Templates list/detail | `initialTemplates`, filter/sort local | List summary qua IPC; load aggregate khi chọn/mở editor |
| Template create/edit | Tạo ID/timestamp/version trong renderer | Main service tạo UUID/timestamp/hash; version bất biến trong SQLite |
| Template preview | Render local từ mock draft | Pure shared validation cho draft; IPC render cho version đã persist |
| Episodes list | `initialEpisodes`, legacy status | `EpisodeSummary` từ IPC; workflow status projection từ database graph |
| Episode create/edit | Draft mẫu và save state trong memory | Create/get/update bằng UUID + optimistic revision |
| Episode workspace | Một `workspaceEpisode` hard-code | Load đúng Episode theo query param `episode=<uuid>` |
| Notes | Local state, chỉ cảnh báo rời trang | Debounced single-flight autosave qua `episodes.update` |
| Archive | Action disabled | Dùng `episodes.archive`, bỏ row khỏi list mặc định |
| Thumbnail | Object URL/bundled renderer asset | Binary trong workspace, DB chỉ giữ relative path |

### 3.1. Đồng bộ vocabulary, không redesign

Các type trình bày cục bộ đang là legacy và không được đẩy xuống database:

| UI mock hiện tại | Contract đã duyệt | Cách xử lý |
| --- | --- | --- |
| Template purpose `script` | `scene` | Thay enum nội bộ bằng shared type; giữ badge/vị trí, đổi label sang “Scene” |
| Episode `idea/script-ready/in-progress/complete` | `draft/scenes_ready/producing/ready_to_export` | Dùng projection thật và map sang badge/tone hiện có; bỏ status khỏi mutation form |
| Scene `in-progress` | `in_review` | Chỉ ghi mapping cho M7; chưa sửa Scenes data source trong M6 |
| Asset `waiting/generating/ready` | AssetSlot `draft/ready/fulfilled` + Asset `candidate/accepted/rejected` | Chỉ ghi mapping cho M8; không ép hai lifecycle thành một enum |

Episode status không phải field editable. M6 giữ nguyên vị trí khối trạng thái trong form nhưng chuyển thành read-only/derived presentation; create luôn bắt đầu ở `draft`. Đây là alignment bắt buộc với contract, không phải thay đổi thiết kế.

## 4. Phạm vi M6

### 4.1. Trong phạm vi

- Template list/search/filter/sort/select/detail/history từ persisted data.
- Template create, metadata edit, immutable version append, variable validation, preview/render và copy.
- Episode list/search/filter/sort, create, edit, archive và open workspace bằng persisted ID.
- Episode Overview dùng aggregate/projection thật; notes autosave có concurrency guard.
- Loading/empty/error/retry/save-error/conflict states dùng primitive hiện có.
- Thumbnail Episode được đưa vào workspace qua main process và hiển thị lại sau restart.
- Unit/integration/UI-controller tests và packaged restart smoke trên Windows.
- Xóa dependency runtime vào mock arrays ở hai vertical slice; mock chỉ còn trong test fixture/story URL nếu thực sự cần.

### 4.2. Ngoài phạm vi

- Persist/render/import/edit/reorder/approve Scenes trong UI; thuộc M7.
- Persist AssetSlot/Asset hoặc file asset production; thuộc M8.
- Recovery/restore UI, retention, export, Flow automation, cloud sync.
- Schema/migration mới, seed production, generic CRUD hoặc generic filesystem API.
- Redesign hoặc refactor CSS không cần thiết cho data integration.

## 5. Thứ tự tích hợp và checkpoint

Thứ tự toàn Phase 1 được khóa là `Template → Episode → Scene → Asset` để mỗi bước chỉ phụ thuộc dữ liệu đã bền vững ở bước trước.

| Gate | Milestone | Kết quả | Điều kiện chuyển bước |
| --- | --- | --- | --- |
| G0 | M6 foundation | Renderer data client, error mapping, request race guard, test harness | Contract tests và typecheck PASS |
| G1 | M6 Template | Template browse/authoring/history/render dùng SQLite | Template restart + stale revision tests PASS |
| G2 | M6 Episode | Episode browse/authoring/archive/overview/notes dùng SQLite | Episode restart + autosave conflict tests PASS |
| G3 | M6 review | Full verify, packaged restart smoke, manual visual regression | Người dùng duyệt M6 |
| G4 | M7 Scene | Scene creation/import/editor/reorder/approval dùng SQLite | Chỉ bắt đầu sau M6 PASS |
| G5 | M8 Asset | AssetSlot/Asset/file integrity/hardening dùng SQLite | Chỉ bắt đầu sau M7 PASS |

Scenes và Assets vẫn có thể được mở để review prototype trong M6, nhưng mọi handoff/demo phải nói rõ chúng còn mock. M6 không ghi dữ liệu Scene/Asset từ renderer.

## 6. Thiết kế tích hợp renderer

### 6.1. Data client nhỏ, typed và không framework mới

Tạo một lớp helper mỏng cho renderer:

- Nhận `IpcResult<T>` và trả data hoặc `StudioClientError` giữ nguyên `code`, `fieldErrors`, `retryable`.
- Không bọc lại `StudioApi` thành generic CRUD và không nhận channel string.
- Có request token/generation để response cũ không ghi đè state mới khi người dùng đổi search/filter/selection nhanh.
- Component giữ state `idle/loading/ready/error/saving/conflict`; không dùng giá trị `demo` làm nguồn dữ liệu production.
- View mapper chỉ tạo thuộc tính trình bày như label, badge tone, thumbnail kind và version string; UUID/revision/domain status giữ nguyên.

Không thêm state-management/query library ở M6. React state/effect hiện có đủ cho single-window local app và giảm phạm vi thay đổi.

### 6.2. Routing và selection

- Giữ hash route `#templates`, `#episodes` và query params hiện tại.
- ID trong URL được coi là opaque UUID; bỏ kiểm tra dựa trên mock array.
- Sau list load: giữ selected ID nếu còn tồn tại; nếu không chọn item đầu; nếu list rỗng hiển thị empty state.
- Detail/authoring gọi `get(id)`; `NOT_FOUND` đưa về list an toàn và giữ thông báo, không crash.
- Search IPC debounce 250–300 ms; sort tiếp tục client-side vì list contract chưa có sort field. Page size M6 tối đa 100 theo schema hiện tại; chưa thêm infinite pagination.

## 7. Template vertical slice

### 7.1. Browse và detail

1. `templates.list` nhận search/purpose/status; category tab và filter cùng map vào `purpose` mà không đổi layout.
2. List dùng `TemplateSummary`; chỉ gọi `templates.get` cho selection/detail/editor để tránh N+1 query.
3. History dùng `versions` trả về từ aggregate, sắp xếp version mới nhất trước như repository hiện tại.
4. Thumbnail/card illustration tiếp tục derive từ purpose; không persist presentation-only value.

### 7.2. Create

- Draft ban đầu giữ UI hiện có nhưng purpose chuẩn là `scene` và variable IDs là `crypto.randomUUID()` hợp lệ.
- Client validation cho phản hồi tức thời; `templates.create` vẫn là authority cuối và transaction tạo Template + v1.0.
- Không tự sinh ID, timestamp, hash hoặc version number trong renderer.
- Thành công dùng aggregate trả về để cập nhật list/selection; lỗi giữ nguyên draft và step hiện tại.

### 7.3. Edit metadata và immutable version

Màn hình hiện tại cho phép một lần bấm “Hoàn thành” thay đổi cả metadata và nội dung version. Gọi tuần tự `updateMetadata` rồi `createVersion` có thể để lại trạng thái partial nếu lệnh thứ hai lỗi hoặc app đóng giữa hai lệnh.

Đề xuất một bổ sung IPC tối thiểu, không đổi schema/invariant:

- `templates.saveEdit(command) -> TemplateAggregate`.
- Command chứa `id`, `expectedRevisionNo`, metadata patch tùy chọn và version draft tùy chọn.
- Application service kiểm tra version/metadata, rồi update metadata + append immutable version trong một SQLite transaction; revision chỉ tăng theo semantics được chốt cho command này.
- Hai API M5B riêng lẻ vẫn giữ cho use case độc lập; UI edit dùng command nguyên tử.

Lý do kỹ thuật: bảo toàn semantics một nút Save của UI đã duyệt và transaction rule “metadata + version nếu cùng command” trong contract; tránh partial commit mà renderer không thể rollback an toàn. Đây là thay đổi additive typed IPC, không phải schema change, và chỉ được implement nếu kế hoạch M6 được duyệt.

### 7.4. Preview/render/copy

- Tách validation/render pure hiện có thành shared domain policy để create draft chưa có `templateVersionId` vẫn preview được mà không persist tạm.
- Main `TemplateService.render` tái sử dụng cùng policy; version đã persist tiếp tục có thể render qua typed IPC.
- Values gửi theo variable `name`, không theo UI-only ID.
- Copy chỉ bật khi render thành công; lỗi required/number/select map về field hiện có.

## 8. Episode vertical slice

### 8.1. List, create, edit và archive

- `episodes.list` dùng search/topic/workflowStatus; sort vẫn client-side trên page đã tải.
- Status badge map trực tiếp từ `workflowStatus`; không lưu status từ form.
- Create gửi title/topic/description/notes/thumbnailRelativePath/createdByName; main tạo slug/UUID/timestamp/revision.
- Edit load đúng aggregate theo URL, gửi patch allowlist cùng `expectedRevisionNo`; save success cập nhật revision local.
- Archive dùng confirmation primitive hiện có, gọi `episodes.archive`, rồi loại row khỏi list mặc định. Không xóa Scene/Asset/file.
- `createdByName/updatedByName` tạm dùng một hằng local actor name duy nhất vì Phase 1 chưa có account; không lấy từ input tùy ý trên từng component.

### 8.2. Workspace Overview

- `EpisodeWorkspacePage` nhận `episodeId`, load `EpisodeAggregate`, không dùng `workspaceEpisode` hard-code.
- Header, information card và production progress dùng `workflowStatus`, `sceneCount`, `productionProgress`, timestamps thật.
- `EpisodeScenesTab` và `EpisodeAssetsTab` chưa nhận persisted collection trong M6; chúng giữ phạm vi prototype đến M7/M8.

### 8.3. Notes autosave

Chỉ notes trong Workspace Overview autosave ở M6. Template authoring, Episode create/edit, archive và mọi status transition vẫn explicit save/action.

Autosave controller:

1. Debounce 750 ms sau lần gõ cuối; flush sớm khi blur hoặc đổi tab/route trong app.
2. Tối đa một request đang chạy. Nếu người dùng tiếp tục gõ, coalesce thành đúng một pending snapshot mới nhất.
3. Mỗi request gửi revision hiện tại; success cập nhật revision từ response rồi mới gửi pending snapshot.
4. Response cũ không được clear dirty state của text mới hơn.
5. `STALE_REVISION`: dừng autosave, giữ nguyên text local, hiển thị conflict với lựa chọn tải bản mới hoặc thử lại sau khi người dùng quyết định; không auto overwrite.
6. Lỗi retryable: giữ dirty state và cho Retry; không loop vô hạn.
7. Khi còn pending/error, navigation guard hiện có tiếp tục chặn đóng/rời trang. Không dựa vào async save trong `beforeunload`.

Policy chuẩn bị cho milestone sau:

- M7 Scene content có thể dùng cùng controller; reorder/approval/import luôn explicit transaction.
- M8 AssetSlot prompt có thể autosave; accept/reject/archive Asset luôn explicit transition.

### 8.4. Thumbnail và filesystem boundary

`thumbnailRelativePath` phải trỏ vào workspace, nhưng renderer sandbox hiện chỉ có object URL/bundled URL và không có use case IPC để copy/read thumbnail. Lưu URL renderer hoặc absolute path sẽ vi phạm contract.

Đề xuất bổ sung namespace typed IPC hẹp cho Episode thumbnail:

- Import một ảnh do người dùng chọn hoặc một bundled suggestion qua main process.
- Validate loại ảnh, signature, giới hạn dung lượng và tên file; ghi file tạm rồi atomic rename vào thư mục thumbnail trong workspace.
- Trả relative path để dùng trong `CreateEpisodeCommand`/`UpdateEpisodeCommand`.
- Đọc thumbnail chỉ qua use case allowlisted kiểm tra path nằm trong workspace; renderer tạo/revoke object URL để hiển thị.
- Không expose generic read/write path, dialog handle hoặc filesystem API.
- Không tự xóa thumbnail khi archive. Cleanup orphan được deferred cho hardening có policy riêng.

Đây là bổ sung typed IPC không đổi schema, có lý do kỹ thuật rõ ràng từ sandbox + workspace path invariant. Nếu chưa duyệt bổ sung này, M6 phải giữ `thumbnailRelativePath = null` và không thể tuyên bố thumbnail đã persist.

## 9. Loading, error và optimistic concurrency

| Tình huống | Hành vi UI |
| --- | --- |
| Initial list/detail load | Dùng loading/skeleton hiện có; không flash mock data |
| Empty database/filter | Empty state hiện có; CTA create giữ nguyên |
| Retryable `DB_UNAVAILABLE` | Error state + Retry; giữ selection/filter/draft |
| `VALIDATION_ERROR` | Map `fieldErrors` vào field; focus field đầu, giữ draft |
| `DUPLICATE_NAME` | Gắn lỗi name/slug tương ứng, không đóng authoring |
| `STALE_REVISION` | Chuyển conflict state; không retry mutation tự động |
| `NOT_FOUND` khi mở ID cũ | Thông báo và quay về list/selection hợp lệ |
| `INTERNAL_ERROR`/response contract lỗi | Generic safe error; log không chứa draft nhạy cảm |
| Request list trả sai thứ tự | Request token bỏ response cũ |

Optimistic update chỉ dùng cho presentation an toàn như selected state. Mutation dữ liệu chỉ cập nhật canonical client cache sau response success; archive có thể remove row sau success. Không rollback bằng cách đoán revision.

## 10. File dự kiến thay đổi khi implement M6

### 10.1. Renderer hiện có

- `src/renderer/src/components/template-data.ts`: bỏ domain type/mock runtime legacy; giữ presentation mapping/fixture nếu còn cần cho test.
- `src/renderer/src/components/templates-page.tsx`: list/detail loading, selection và retry qua API.
- `src/renderer/src/components/template-authoring-page.tsx`: typed draft mapping, async save/render, field/conflict errors.
- `src/renderer/src/components/episodes-page.tsx`: persisted list/filter/status/archive/routing.
- `src/renderer/src/components/episode-authoring-page.tsx`: load/create/update, derived status, thumbnail import.
- `src/renderer/src/components/episode-workspace-page.tsx`: aggregate thật, notes autosave, revision handling.
- `src/renderer/src/studio-api.d.ts`: chỉ đổi nếu StudioBridge surface được bổ sung.
- `src/renderer/src/components/ui/state-feedback.tsx` và `confirm-dialog.tsx`: chỉ mở rộng props tối thiểu nếu existing primitives chưa đủ; không đổi visual tokens.

### 10.2. Renderer mới dự kiến

- `src/renderer/src/data/studio-client.ts`: unwrap typed result và normalized client error.
- `src/renderer/src/data/view-models.ts`: pure domain-to-presentation mapper.
- `src/renderer/src/hooks/use-single-flight-autosave.ts`: debounce/coalesce/revision-safe controller.
- `src/renderer/src/lib/thumbnail-object-url.ts`: lifecycle object URL nếu thumbnail IPC được duyệt.

### 10.3. Shared/main/preload dự kiến

- `src/shared/domain.ts`, `src/shared/validation.ts`, `src/shared/ipc.ts`: chỉ thêm atomic Template edit và thumbnail use cases đã nêu; không sửa entity/schema.
- `src/main/services/template-service.ts`: transaction save metadata + version.
- `src/main/services/episode-thumbnail-service.ts` (mới): workspace boundary, validation và atomic file write/read.
- `src/main/persistence/foundation.ts`: wire thumbnail service; không đổi repository/schema.
- `src/main/ipc/register-studio-ipc.ts` và `src/preload/index.ts`: allowlist + request/response validation cho hai use case additive.
- `src/main/index.ts`: chỉ thay đổi nếu thumbnail read/import cần registration/lifecycle ở app startup.

### 10.4. Tests/config/docs dự kiến

- `tests/template-ui-integration.test.tsx` và `tests/episode-ui-integration.test.tsx` hoặc controller tests tương đương.
- `tests/restart-persistence.test.ts`: cùng database path, close/reopen foundation, xác nhận Template/Episode còn nguyên.
- `tests/ipc-contract.test.ts`: hai additive IPC boundary và invalid payload.
- `tests/persistence-services.test.ts`: atomic Template edit, thumbnail path/size/type và rollback/cleanup.
- `tests/autosave-controller.test.ts`: debounce, coalesce, out-of-order, retry và stale revision.
- `scripts/verify-package.mjs`: packaged executable chạy hai lần trên cùng temp root cho write/read restart smoke.
- `vitest.config.ts`, `tsconfig.web.json`, `package.json`, `package-lock.json`: chỉ khi cần DOM/component test dependency; ưu tiên pure controller test để tránh dependency không cần thiết.
- `docs/03-roadmap.md`, `docs/05-decisions.md` và tài liệu evidence M6 mới khi implementation hoàn tất.

Danh sách trên là dự kiến. Implementation phải dừng và quay lại decision log nếu cần migration, generic filesystem capability hoặc thay đổi UI contract ngoài các điểm alignment đã nêu.

## 11. Kế hoạch kiểm thử

### 11.1. Automated

1. Giữ toàn bộ 15 tests M5B hiện tại PASS.
2. Template create/list/get, metadata edit, atomic version append, duplicate name, invalid variables, render và stale revision.
3. Episode create/list/get/update/archive, workflow projection và stale revision.
4. Renderer client mapping cho success/error/field error; response cũ không overwrite response mới.
5. Autosave fake-timer tests: debounce, one in-flight, coalescing, revision chaining, retryable error và conflict.
6. Close/reopen cùng SQLite file: Template aggregate/version và Episode metadata/notes vẫn đúng.
7. Thumbnail import/read reject absolute/traversal/oversize/non-image; persisted relative path hiển thị lại sau reopen.
8. `npm run verify` PASS gồm typecheck main/preload/shared/renderer và production build.
9. `npm run package:verify` chạy executable đóng gói hai lần trên cùng temp user-data; lần một ghi fixture qua application service, lần hai đọc lại, kiểm tra migration version/integrity và xóa temp root sau success.

Packaged smoke không dùng production user-data và không seed database người dùng.

### 11.2. Manual checkpoint

- First run database rỗng hiển thị empty state thật.
- Tạo Template, copy preview, sửa metadata + tạo version, đóng app/mở lại; version cũ không đổi.
- Tạo Episode, chỉnh sửa, chọn thumbnail, nhập notes; đóng app/mở lại và kiểm tra list + workspace.
- Search/filter/sort và deep link selection dùng persisted IDs.
- Archive Episode biến mất khỏi list mặc định sau restart nhưng dữ liệu không bị hard-delete.
- Giả lập save error và stale revision; draft/notes vẫn còn, không có silent overwrite.
- So sánh desktop/mobile widths chính với baseline M1–M4; không có layout hoặc interaction redesign.
- Xác nhận Scenes/Assets vẫn được báo là prototype mock ở checkpoint M6 và chưa ghi database.

## 12. Rủi ro và mitigation

| Rủi ro | Mitigation |
| --- | --- |
| Empty production DB làm UI khác demo mock | Empty state + CTA create; test data chỉ ở fixture |
| Legacy UI enum lọt vào IPC | Dùng shared domain type, mapper exhaustive và bỏ duplicate domain union |
| Metadata + version partial commit | Atomic `templates.saveEdit` additive command |
| Search/detail response về sai thứ tự | Request token và selected-ID reconciliation |
| Autosave tạo `STALE_REVISION` với chính nó | Single-flight + revision chaining + coalescing |
| Conflict làm mất text local | Freeze autosave, giữ draft và yêu cầu quyết định rõ |
| Thumbnail thoát workspace hoặc file giả MIME | Main boundary, signature/size validation, atomic write và relative path |
| M6 Overview thật nhưng Scene/Asset còn mock gây hiểu nhầm | Handoff/checkpoint ghi rõ phạm vi; không gọi mutation IPC cho hai tab |
| Test package ghi vào dữ liệu thật | Temp user-data/workspace bắt buộc, fail nếu path không nằm dưới temp root |
| `node:sqlite` runtime thay đổi | Giữ packaged smoke bắt buộc sau mọi upgrade Electron/Node |

## 13. Acceptance criteria M6

M6 chỉ được coi là hoàn tất khi đồng thời đạt:

1. Templates và Episodes không còn lấy runtime data từ mock arrays ở production route.
2. Template create/edit/version/render và Episode create/edit/archive/open dùng typed preload/IPC; renderer không có Node/filesystem/SQLite access.
3. Saved Template/Episode/notes/thumbnail còn nguyên sau full app quit/relaunch bằng packaged executable test và manual check.
4. TemplateVersion cũ bất biến; một lần save metadata + version không để partial commit.
5. Episode workflow status chỉ derive từ domain projection, không persist hoặc cho user chỉnh trực tiếp.
6. Search/filter/sort/selection/deep link phản ánh persisted data và không bị stale response overwrite.
7. Loading/empty/error/retry/conflict dùng component hiện có; request lỗi không làm mất draft.
8. Notes autosave tuân thủ debounce/single-flight/revision; conflict không last-write-wins.
9. Không có migration/schema diff; `0001_phase1_core.sql` và checksum đã apply không bị sửa.
10. Không redesign UI; chỉ thay data source và trạng thái kỹ thuật cần thiết.
11. M5B regression, test M6, production build và Windows packaged restart smoke đều PASS.
12. Dừng tại checkpoint; không nối Scenes persistence trước khi người dùng duyệt M6.

## 14. Rollback

Rollback code M6 dựa trên commit boundary, không dùng down migration:

1. Giữ commit M5B đã verify làm checkpoint độc lập trước mọi code M6.
2. Implement M6 theo commit nhỏ G0/G1/G2/G3; khi lỗi có thể revert commit M6 tương ứng mà không chạm M5B.
3. Vì M6 không đổi schema, renderer mock cũ có thể được khôi phục bằng revert code; database version `1` và dữ liệu đã tạo vẫn tương thích, không bị xóa.
4. Additive IPC chưa có caller sau revert là vô hại và có thể revert cùng service/preload commit.
5. Thumbnail file đã import không tự xóa khi rollback; giữ nguyên để tránh mất dữ liệu. Cleanup chỉ làm bằng policy/hardening được duyệt sau.
6. Test/package luôn dùng temp root. Với dữ liệu development, tạo backup có chủ đích trước test thủ công có mutation lớn; không restore/delete tự động.
7. Nếu phát hiện cần schema change trong lúc làm M6: dừng, không sửa `0001`; lập decision + forward migration mới và quay lại checkpoint review.

## 15. Quyết định đã duyệt tại checkpoint

1. M6 chỉ giao persisted Template + Episode; thứ tự Scene → Asset được khóa cho M7 → M8, không kéo vào implementation M6.
2. Cho phép additive `templates.saveEdit` để một thao tác save metadata + version có transaction nguyên tử.
3. Cho phép typed IPC hẹp cho import/read Episode thumbnail trong workspace; không expose generic filesystem.
4. Autosave M6 chỉ áp dụng cho Episode notes; các mutation có lifecycle/version vẫn explicit.
5. Chấp nhận commit split ở mục 2.1. Sau khi implement và verify, phần M6 phải dừng ở checkpoint review trước khi commit/push.
