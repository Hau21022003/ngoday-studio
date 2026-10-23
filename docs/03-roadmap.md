# Roadmap 3 Phase

## 1. Nguyên tắc triển khai

- Mỗi Phase phải tạo ra một luồng dùng được, không chỉ khung kỹ thuật.
- Không bắt đầu automation rộng trước khi Flow PoC đạt cổng go/no-go.
- Human-in-the-loop là thiết kế chính thức, không phải workaround tạm thời.
- Mặc định giữ dữ liệu, không tự động xóa hoặc ghi đè.
- Mỗi Phase chỉ thêm dependency khi có use case đã được chấp nhận.

## 2. Phase 1 — Episode, Scene Templates, Scenes & Assets

### Mục tiêu

Tạo một workflow local đáng tin cậy theo chuỗi `Episode → Scenes → Assets`; chưa điều khiển Flow. `Script` không còn là module/object riêng. Scene Template render prompt từ metadata Episode và `Nội dung nguồn` tùy chọn; người dùng copy prompt sang ChatGPT, import JSON Scenes rồi review/edit/approve. Phase 1 gồm **8 milestone tuần tự** để chốt UI/workflow trước, sau đó mới thiết kế và nối persistence.

### Nguyên tắc chia milestone

- Mỗi milestone phải tạo ra một lát cắt có thể chạy, demo và review độc lập.
- Dùng dữ liệu mock xuyên suốt M1–M4. Không thêm SQLite, repository, persistence nghiệp vụ hoặc IPC dữ liệu trước khi toàn bộ UI/workflow liên quan được duyệt.
- `Templates` là design source of truth. Episodes, Scenes và Assets chỉ được compose token/component đã chốt; không tạo visual language riêng.
- Không tạo bảng, repository, IPC, revision history hoặc tab riêng cho Script. Narration/voice-over là field của Scene.
- Mỗi milestone có một điểm dừng bắt buộc. Chỉ bắt đầu milestone kế tiếp sau khi người dùng duyệt hoặc yêu cầu điều chỉnh rõ ràng.
- Feedback làm thay đổi milestone đã duyệt phải được cập nhật lại vào acceptance criteria và tài liệu trước khi triển khai tiếp.
- Mỗi milestone implementation phải build thành công, không có lỗi console trong luồng demo và không làm hỏng milestone đã duyệt trước đó.

### Thứ tự và phụ thuộc

| Milestone | Kết quả review chính | Loại dữ liệu | Phụ thuộc |
| --- | --- | --- | --- |
| M1 — UI Foundation + Templates Browse | Visual system, app shell và mật độ trang Templates | Mock | Không |
| M2 — Template Authoring Prototype | Luồng tạo/sửa/preview/version template | Mock/in-memory | M1 được duyệt |
| M3 — Episodes & Workspace Prototype | Information architecture và luồng quản lý Episode | Mock/in-memory | M1–M2 được duyệt |
| M4 — Scenes & Assets Prototype | Workflow tạo/import/review Scenes và lập kế hoạch Assets ở mức UI | Mock/in-memory | M1–M3 được duyệt |
| M5 — Domain Contract & Persistence Foundation | Data model, migration, repository và IPC contract | SQLite/test fixtures | M1–M4 được duyệt |
| M6 — Templates & Episodes Vertical Slice | Template và Episode hoạt động bền vững sau restart | Persisted | M5 được duyệt |
| M7 — Scenes Vertical Slice | Render/copy Scene Template, import JSON, edit, reorder và approval | Persisted | M6 được duyệt |
| M8 — Asset Planning & Phase 1 Hardening | Asset slot, backup/restore và kiểm thử end-to-end | Persisted | M7 được duyệt |

### Trạng thái hiện tại

- Implementation mới của Phase 1 bắt đầu từ baseline đã chốt trong repository này.
- Mọi implementation Phase 1 cũ hoặc thử nghiệm không phải baseline và không bắt buộc reuse. Chỉ tham khảo hoặc tái sử dụng phần phù hợp sau khi được đánh giá chủ động theo milestone đang thực hiện.
- **M1 — Approved/Completed ngày 2026-10-23.** Visual direction, density, responsive behavior và browse/detail structure của Templates đã được người dùng duyệt và trở thành baseline cho các milestone sau.
- **M2 — Implemented.** Prototype mock/in-memory đã bao phủ create/edit, variable validation, review metadata + sample values, rendered preview/copy, immutable version history, unsaved confirm và error recovery. Contract mục đích template được điều chỉnh từ `script` sang `scene` theo workflow mới; UI hiện hành sẽ được đồng bộ trong bước implementation sau.
- **M3 — Implemented theo plan cũ, cần alignment trước review.** Episode list, Create/Edit và Workspace Overview đã có mock/in-memory. Tab `Script` còn tồn tại trong code hiện hành nhưng bị loại khỏi target contract; lượt này chỉ cập nhật tài liệu, chưa sửa UI.
- M4–M8 ở trạng thái planned.
- Không có milestone database/persistence nào được phép bắt đầu trước khi M4 qua điểm dừng review.

### M1 — UI Foundation + Templates Browse

**Phạm vi**

- Chuẩn hóa token màu, typography, spacing, radius, border và shadow theo `06-ui-foundation.md`.
- Chuẩn hóa primitive dùng chung: button, input/select/search, badge/status, table/list row, tabs, sidebar/nav item, detail panel và empty/loading/error state.
- Hoàn thiện app shell desktop-first, sidebar cố định và navigation responsive cơ bản.
- Dựng trang Templates bằng mock data: tabs, search/filter/sort, selected row và detail panel.
- Chưa triển khai tạo/sửa template thật, database, persistence hoặc IPC nghiệp vụ.

**Acceptance criteria**

- Trang Templates bám đúng hướng Light Creative Studio / Production Workspace và là nguồn tham chiếu trực quan cho page sau.
- Màu, khoảng cách, control và trạng thái tương tác đến từ token/component dùng chung; không có style riêng không cần thiết trong page.
- Desktop layout có density rõ ràng; viewport hẹp chuyển navigation/detail/toolbar đúng quy ước mà không gây horizontal overflow ngoài vùng table chủ đích.
- Keyboard focus, tab interaction, label/aria cho icon action và reduced motion hoạt động ở mức foundation.
- Có thể demo selected, empty, loading và error state bằng dữ liệu mock; build và smoke test không có lỗi console.

**Điểm dừng review**

Người dùng duyệt visual direction, density, token, component, app shell, responsive behavior và cấu trúc browse/detail của Templates. Không bắt đầu Template Editor trước khi M1 được duyệt.

### M2 — Template Authoring Prototype

**UX contract đã duyệt:** `07-m2-template-authoring-contract.md`. M2 dùng mock/in-memory state và phải dừng tại điểm review trước M3.

**Phạm vi**

- Dùng mock/in-memory state để mô phỏng tạo template, chỉnh sửa metadata/nội dung, khai báo biến, preview và copy prompt đã render.
- Mô phỏng version history bất biến, validation state, unsaved changes, confirm/cancel và success/error feedback.
- Giữ nguyên foundation M1; chỉ thêm shared component khi có use case tái sử dụng rõ ràng.
- Chưa lưu dữ liệu qua restart và chưa thiết kế schema SQLite.

**Acceptance criteria**

- Một reviewer có thể đi hết happy path: mở template → chỉnh nội dung/biến → preview → copy → tạo version mới.
- UI thể hiện rõ biến hợp lệ, biến thiếu, biến không hỗ trợ và nội dung chưa lưu.
- Version cũ và version đang chỉnh sửa được phân biệt rõ trong UI; thao tác phá hủy có bước xác nhận phù hợp.
- Các trạng thái form, validation và feedback dùng chung visual system đã duyệt ở M1.

**Điểm dừng review**

Người dùng chốt field, terminology, variable syntax, versioning mental model và thứ tự thao tác của Template Editor. Không bắt đầu Episodes prototype trước khi M2 được duyệt.

### M3 — Episodes & Workspace Prototype

**Phạm vi**

- Dựng Episode list với mock data: search, status filter, sort, selected row và trạng thái rỗng/lỗi/loading.
- Dựng luồng tạo, sửa metadata, mở workspace và archive Episode bằng in-memory state.
- Episode Workspace chỉ có tabs `Overview / Scenes / Assets`; không có tab `Script`.
- Xác định navigation từ Episode sang Scenes/Assets mà chưa triển khai nghiệp vụ phía sau.
- Chưa persistence, chưa autosave và chưa import JSON Scenes.

**Acceptance criteria**

- Luồng tạo → tìm → mở → sửa → archive Episode có thể demo hoàn chỉnh trong một phiên chạy.
- Trạng thái và primary action rõ ràng, không biến page thành generic dashboard hoặc lạm dụng card.
- Episode pages tái sử dụng app shell, page header, toolbar, table/list, badge, dialog/form và state feedback từ foundation.
- Navigation cho biết rõ context Episode hiện tại, đường quay lại danh sách và chuỗi workflow `Episode → Scenes → Assets`.
- Không còn label, tab hay quick action nào coi Script là module độc lập.

**Điểm dừng review**

Người dùng chốt Episode fields, status, archive behavior, navigation hierarchy `Overview / Scenes / Assets` và mức thông tin cần hiển thị. Không bắt đầu Scenes prototype trước khi M3 được duyệt.

### M4 — Scenes & Assets Prototype

**Phạm vi**

- Dùng một fixture Episode cố định để dựng flow tạo Scenes, scene list/detail và asset planning bằng mock/in-memory state.
- Dựng `Tạo Scenes`: chọn Scene Template, nhập `Nội dung nguồn` tùy chọn, render/preview/copy prompt để dùng với ChatGPT thủ công.
- Mô phỏng paste/chọn file JSON Scenes, validate toàn payload, preview thay đổi rồi import nguyên tử vào state trong phiên.
- Mô phỏng review/edit/reorder/approve Scene; narration/voice-over nằm trực tiếp trong từng Scene. Không có Script Editor, script revision hoặc bước Script → Scenes.
- Mô phỏng asset slot theo scene: media type, prompt, reference, canonical-name preview và duplicate/missing state.
- Bao phủ confirm flow khi reorder có nguy cơ ảnh hưởng naming/mapping; chưa ghi database hoặc filesystem.

**Acceptance criteria**

- Reviewer có thể đi hết prototype: Episode → render/copy Scene prompt → import JSON Scenes → review/approval → asset slots mà không gặp dead end.
- Editor có hierarchy rõ, density phù hợp và dùng section/separator thay cho nested card quá mức.
- `Nội dung nguồn` là field tùy chọn của flow tạo Scenes và không được trình bày như một Script record bền vững.
- JSON import success/failure, unsaved scene edit, invalid scene, reorder warning và duplicate asset state đều có UI rõ ràng.
- Naming preview và quan hệ Episode → Scene → Asset slot đủ rõ để thảo luận data model.
- Mọi page kế thừa foundation; thay đổi shared visual rule được phản ánh lại trang Templates.

**Điểm dừng review**

Người dùng duyệt toàn bộ Phase 1 workflow, naming convention, JSON Scenes schema, scene approval và asset-slot model. Đây là cổng bắt buộc trước mọi công việc database/persistence.

### M5 — Domain Contract & Persistence Foundation

**Điều kiện bắt đầu:** M1–M4 đã được duyệt và các câu hỏi nghiệp vụ ảnh hưởng schema đã có quyết định ghi trong `05-decisions.md`.

**Phạm vi**

- Chốt domain types và validation schema cho Episode, template/version, Scene, JSON Scenes import, character reference metadata và asset slot.
- Xác nhận schema không có `scripts`, `script_revisions` hoặc quan hệ Script → Scene; `Nội dung nguồn` chỉ là input tạm của renderer/application flow.
- Thiết kế SQLite migrations, repository boundary, transaction rules và typed IPC qua preload.
- Tạo test fixtures tương ứng với mock đã được duyệt; không tự ý thêm field chỉ vì thuận tiện cho database.
- Spike sớm native SQLite packaging trên Windows; ưu tiên migration failure handling, transaction safety và backup trước migration quan trọng.
- Không xây cơ chế rollback migration phức tạp khi chưa có use case; ưu tiên migration tuần tự, transaction nguyên tử và hướng phục hồi tiến về phía trước.

**Acceptance criteria**

- Data model truy vết được về field và workflow đã duyệt ở M1–M4.
- ER/data model chỉ thể hiện `Episode → Scene → Asset slot`; narration thuộc Scene và không có bảng Script/revision.
- Migration chạy được trên database trống và database ở version trước, có version rõ ràng.
- Migration lỗi hoặc bị gián đoạn không để lại schema/data nửa chừng, trả lỗi có thể chẩn đoán và giữ được đường phục hồi an toàn bằng transaction/backup; không yêu cầu rollback framework tổng quát.
- Renderer không truy cập Node/SQLite trực tiếp; IPC validation chặn payload sai.
- Repository contract có test cho transaction, constraint chính và lỗi dự kiến.
- Dev build/package spike xác nhận SQLite tương thích Electron trên Windows.

**Điểm dừng review**

Người dùng duyệt ER/data model, migration strategy, IPC surface và backup boundary. Chưa nối page sản phẩm với database trước khi M5 được duyệt.

### M6 — Templates & Episodes Vertical Slice

**Phạm vi**

- Nối UI đã duyệt với repository/IPC cho Template CRUD, immutable version, validation, preview/render và copy.
- Nối Episode create/edit/archive/search/open với persistence thật.
- Thay mock data bằng persisted data nhưng giữ nguyên contract và visual behavior đã duyệt.

**Acceptance criteria**

- Template và Episode tạo/sửa/archive còn nguyên sau khi restart app.
- Tạo version mới không thay đổi snapshot cũ; biến thiếu/không hỗ trợ bị báo trước khi render.
- Search/filter và selected detail phản ánh đúng dữ liệu đã lưu.
- Lỗi IPC/database được chuyển thành error state có hướng xử lý, không làm mất input chưa lưu.
- Unit/integration test bao phủ validation, rendering, repository và restart smoke path.

**Điểm dừng review**

Người dùng kiểm tra một vertical slice bằng dữ liệu thật và duyệt hành vi persistence/error recovery. Không nối Scenes persistence trước khi M6 được duyệt.

### M7 — Scenes Vertical Slice

**Phạm vi**

- Nối flow `Tạo Scenes` với Template renderer: chọn Scene Template, nhập `Nội dung nguồn` tùy chọn, preview và copy prompt.
- Paste hoặc chọn file JSON Scenes theo schema đã duyệt; validate toàn payload và import trong một transaction.
- Persist Scene CRUD, narration/voice-over, media prompts, reorder và approval validation.
- Không persist `Nội dung nguồn`, rendered prompt, raw ChatGPT response hay Script revision như object riêng trong Phase 1.
- Reorder hiển thị preview/confirm khi canonical naming bị ảnh hưởng.

**Acceptance criteria**

- Rendered prompt dùng đúng Episode data, Scene Template version và chỉ chèn `Nội dung nguồn` khi người dùng cung cấp.
- JSON hợp lệ tạo đúng Scene theo thứ tự và gán narration/voice-over vào đúng Scene; import lỗi không ghi dữ liệu nửa chừng.
- Scene đã lưu còn nguyên sau close/reopen; save error giữ input để người dùng thử lại.
- Reorder cập nhật order/naming preview nhất quán và yêu cầu xác nhận khi có ảnh hưởng mapping.
- Scene chỉ chuyển `approved` khi các trường bắt buộc hợp lệ.
- Không có table/repository/IPC/UI state dành cho Script hoặc script revision.

**Điểm dừng review**

Người dùng duyệt flow bằng một fixture JSON Scenes thực tế đã ẩn dữ liệu nhạy cảm, bao gồm render/copy prompt, import, edit, reorder và approval. Không triển khai asset persistence/hardening trước khi M7 được duyệt.

### M8 — Asset Planning & Phase 1 Hardening

**Phạm vi**

- Persist asset slot, media type, prompt, character reference metadata và canonical name.
- Thêm validation duplicate/missing data và constraint canonical name duy nhất trong Episode.
- Hoàn thiện export/import backup metadata, Scenes và narration; chưa gồm browser profile hay binary media.
- Chạy regression, backup/restore và end-to-end test cho toàn bộ Phase 1; cập nhật tài liệu/sample fixtures.

**Acceptance criteria**

- Asset slot còn nguyên sau restart; canonical name duy nhất và validation thống nhất giữa UI/domain/database.
- Backup rồi restore vào database trống tái tạo được Episode/template/Scene/asset slot mà không gồm credential hoặc `Nội dung nguồn` tạm.
- Luồng end-to-end từ tạo Episode đến scene/asset slot đã duyệt chạy được không cần network.
- Test report bao phủ template rendering, JSON validation, import transaction, Scene editing/ordering/approval, naming và persistence.
- Không có regression so với visual/workflow đã duyệt ở M1–M4.

**Điểm dừng review**

Người dùng chạy pilot một Episode, duyệt kết quả restore và test report. Chỉ khi M8 được duyệt mới xem Phase 1 hoàn tất và chuyển sang Phase 2.

### Ngoài phạm vi Phase 1

- Không tự động điều khiển ChatGPT web.
- Không bắt buộc tích hợp OpenAI/Gemini API. Bản tối thiểu dùng copy/paste/import; tích hợp LLM chỉ thực hiện sau khi chốt provider, chi phí và cách giữ API key.
- Không khởi chạy Playwright hoặc tạo media thật.
- Không quản lý binary media ngoài character reference local.

### Deliverables

- App local chạy được trên Windows ở môi trường phát triển.
- Database schema/migration và cơ chế backup cơ bản.
- UI hoàn chỉnh từ tạo Episode, tạo/import/review Scenes đến danh sách asset slot đã duyệt.
- JSON Scenes schema được ghi rõ và có sample fixture trong giai đoạn implementation.
- Test report cho logic cốt lõi.

### Acceptance criteria tổng thể

- Tạo, sửa, archive và mở lại Episode sau khi restart mà không mất dữ liệu.
- Template thay đúng biến; biến thiếu/không hỗ trợ bị báo trước khi render.
- Tạo Template version mới không làm thay đổi snapshot cũ đã lưu.
- Scene Template render đúng metadata Episode và `Nội dung nguồn` tùy chọn; prompt có thể copy để dùng với ChatGPT thủ công.
- Import JSON Scenes hợp lệ tạo đúng Scene/narration theo thứ tự; import lỗi không ghi dữ liệu nửa chừng.
- Reorder scene cập nhật lại canonical name có preview và yêu cầu xác nhận nếu có nguy cơ ảnh hưởng mapping.
- Scene chỉ chuyển `approved` khi các trường bắt buộc hợp lệ.
- Mỗi asset slot trong Episode có canonical name duy nhất.
- Scene đã lưu không mất nội dung khi đóng/mở lại app trong kịch bản test.
- Backup rồi restore vào database trống tái tạo được Episode/template/Scene/asset slot; không bao gồm credential hoặc `Nội dung nguồn` tạm.
- Không tồn tại Script module/tab/domain object, script revision hoặc Script → Scenes conversion trong Phase 1.
- Không có network call bắt buộc cho toàn bộ Phase 1.

### Exit gate

Tất cả điểm dừng M1–M8 đã được người dùng duyệt; data model, naming convention, JSON Scenes schema, UI flow và backup/restore có bằng chứng kiểm thử. Sau đó mới thực hiện Phase 2.

## 3. Phase 2 — Google Flow Automation bằng Playwright

### Mục tiêu

Tạo một pipeline có giám sát để tạo media trong đúng Flow project, xác định đúng output, cho người dùng duyệt, đổi tên trên Flow, xác minh tên rồi download.

### Phase 2A — PoC bắt buộc

Thực hiện đúng kế hoạch trong `04-flow-poc.md`, trên tài khoản/test project do người dùng cung cấp và với generation nhỏ nhất có thể.

PoC phải trả lời được:

- Google login có duy trì được trong persistent profile mà không tự động nhập password không?
- Có tạo/mở lại đúng project và nhận diện project ổn định không?
- Có submit image/video/reference và theo dõi đến success/error không?
- Có ánh xạ output về đúng attempt mà không dựa vào tile position không?
- Đổi tên một asset cụ thể trên Flow dùng UI trực tiếp hay Flow Agent; có đọc lại để xác minh không?
- Tên hiển thị Flow có ảnh hưởng tới suggested filename khi download không?
- Có resume sau reload/app restart mà không submit trùng không?
- Terms/policy và giới hạn tài khoản có chấp nhận việc dùng automation này không?

Nếu cổng rename/mapping không đạt, dừng mở rộng Phase 2 và trình bày fallback để người dùng quyết định. Không mô tả local rename là đã đáp ứng yêu cầu đổi tên trong Flow.

### Phase 2B — Productize automation

1. Browser session manager:
   - Headful Chrome/Chromium, profile riêng.
   - User login/2FA thủ công.
   - Health check, reconnect và sign-out state.
2. Flow adapter:
   - Project create/open/link.
   - Generation settings, prompt và reference attach.
   - Submit với chống double-click.
   - Observe pending/success/error/rate limit.
   - Rename + verify.
   - Download event + save staging.
3. Durable queue:
   - Job chain, lease/checkpoint, pause/resume.
   - Retry policy theo loại action.
   - Reconcile sau crash/restart.
4. Review UI:
   - Preview candidate.
   - Prompt/settings/reference snapshot.
   - Accept, reject, chỉnh prompt và tạo attempt mới.
5. Diagnostics:
   - Structured log, event timeline, screenshot lỗi.
   - Nút `Open Flow project` và `Resolve manually`.
6. Safety:
   - Xác nhận batch/credit trước submit.
   - Concurrency mặc định 1.
   - Dừng khi auth/CAPTCHA/unusual activity/mapping mơ hồ.

### Retry matrix tối thiểu

| Action | Auto retry | Ghi chú |
| --- | --- | --- |
| Mở trang/đọc trạng thái | Có, hữu hạn | Backoff + reload có kiểm soát |
| Upload reference | Có nếu xác nhận chưa attach | Kiểm tra thumbnail/hash trước submit |
| Submit generation | Không khi kết quả mơ hồ | Reconcile trước để tránh tốn credit kép |
| Poll/observe | Có | Không tạo request generation mới |
| Rename | Có nếu đọc thấy tên cũ | Luôn verify tên mới |
| Download | Có | File `.part`, hash và kiểm tra format |
| Policy/auth/CAPTCHA | Không | Chuyển `waiting_user` |

### Acceptance criteria

- PoC go/no-go đã được người dùng duyệt bằng chứng.
- Browser profile tách biệt; app không lưu/nhập Google password và không bypass 2FA/CAPTCHA.
- Tạo hoặc liên kết đúng Flow project, lưu đủ thông tin để mở lại sau restart.
- Với test run đã thống nhất, mỗi submit tạo đúng số attempt mong đợi và không có duplicate do retry.
- App nhận biết `pending`, `success`, lỗi generation, policy block, rate limit và auth required ở các fixture/live case khả dụng.
- Mapping attempt → Flow asset đạt 100% trong bộ thử nghiệm PoC; trường hợp không chắc chắn dừng chờ người dùng.
- Media chỉ được rename sau khi người dùng accept.
- Tên canonical được đọc lại từ Flow và lưu `rename_verified_at` trước download.
- Download được gắn đúng asset slot, có size/hash và mở được theo kiểm tra cơ bản.
- Pause ngăn job mới; resume/restart tiếp tục từ checkpoint mà không submit lại action mơ hồ.
- Người dùng có thể xử lý thủ công trong Flow rồi bấm reconcile để app tiếp tục.
- Log không chứa cookie/password/token.

### Exit gate

Một Episode pilot nhỏ hoàn tất từ scene đã duyệt đến media đã rename/verified/downloaded, với manifest mapping đúng và không có action `unknown` chưa xử lý.

## 4. Phase 3 — Media Management & CapCut Export

### Mục tiêu

Quản lý media version local và tạo folder snapshot đúng thứ tự để nhập CapCut thủ công.

### Phạm vi

1. Media library theo Episode/scene/asset slot.
2. Hiển thị version/attempt, accepted/rejected, kích thước, hash, duration/dimensions khi lấy được.
3. Thay đổi media accepted có xác nhận và audit; không xóa version cũ.
4. Phát hiện file thiếu, file bị sửa ngoài app và hash mismatch.
5. Relink file khi workspace được di chuyển.
6. Export preset tối thiểu:
   - Folder media phẳng, tên canonical zero-padded.
   - `manifest.json` đầy đủ metadata.
   - `manifest.csv` dễ kiểm tra.
   - `scenes.json` theo thứ tự Scene.
   - `narration.md` tổng hợp narration/voice-over từ từng Scene.
7. Export preflight và progress; ghi vào staging rồi finalize.
8. Mở folder export và copy path; không điều khiển CapCut.

### Cấu trúc manifest tối thiểu

Mỗi dòng/record gồm:

- Episode ID/title/slug và export revision.
- Scene ID/order/title.
- Asset slot ID/canonical name/media type.
- Accepted attempt/version ID.
- Relative path, extension, bytes, SHA-256.
- Flow project/asset reference nếu có.
- Prompt/settings/reference snapshot IDs.
- Thời điểm rename verified, download và export.

### Acceptance criteria

- Media library hiển thị đúng toàn bộ candidate và đúng một accepted version cho mỗi slot.
- App báo file missing/hash mismatch trước export và không tạo snapshot “thành công” giả.
- Export chỉ bao gồm media accepted, theo đúng thứ tự scene/asset.
- Hai lần export không ghi đè lẫn nhau; mỗi snapshot có ID/revision rõ ràng.
- Tên file an toàn trên Windows, không trùng và khớp canonical name.
- Hash trong manifest khớp file thực tế sau export.
- `manifest.json`, `manifest.csv`, `scenes.json` và `narration.md` cùng mô tả một snapshot.
- Folder export có thể được mở và kéo media vào CapCut thủ công theo thứ tự tên file.
- Không sửa, di chuyển hoặc xóa source media khi export thất bại.

### Exit gate

Một Episode pilot được export, kiểm tra manifest/hash và import thủ công vào CapCut theo đúng thứ tự mà không cần đổi tên lại.

## 5. Kiểm thử xuyên suốt

### Unit tests

- Template variables và rendered snapshot.
- Scene/asset ordering và canonical naming.
- State transition, retry classification và queue leasing.
- Import validation, path safety, hash/manifest.

### Integration tests local

- SQLite migration/transaction/backup restore.
- IPC validation và filesystem staging/finalize.
- Crash/restart simulation với job checkpoints.

### Flow contract tests

- Chạy thủ công theo checklist vì tiêu tốn credit và phụ thuộc account/UI.
- Tách smoke test không tốn credit: sign-in detection, project list/open, locator health.
- Fixture/screenshot chỉ hỗ trợ test parser/state detection; không thay thế live PoC.

### Regression checklist trước release

- Login/profile vẫn hoạt động.
- Project create/open.
- Image generation và video generation theo model đã hỗ trợ.
- Reference attach.
- Asset mapping.
- Rename + read-back.
- Download + integrity.
- Pause/resume/restart.
- Manual recovery.

## 6. Rủi ro và giảm thiểu

| Rủi ro | Tác động | Giảm thiểu |
| --- | --- | --- |
| Flow đổi UI/A-B test/locale | Selector hỏng | Adapter riêng, locator accessibility, health check, fail closed |
| Google chặn browser automation/login | Không thể chạy unattended | Headful, login thủ công, profile riêng; dừng thay vì bypass |
| Điều khoản hoặc machine-readable rules không cho phép | Rủi ro tài khoản/pháp lý | User review terms, không reverse-engineer, có đường manual/API fallback |
| Flow Agent rename không xác định hoặc hết quota | Sai tên/không rename được | Chọn một asset, prompt cụ thể, read-back; ưu tiên direct rename nếu UI có |
| Không có remote asset ID ổn định | Mapping sai | Concurrency 1, before/after diff, prompt/time evidence, human confirmation |
| Click submit mơ hồ | Tốn credit kép | `unknown` state, reconcile trước retry |
| Rate limit/credit/policy | Queue dừng lâu | Backoff, budget confirmation, `waiting_user`, không spam retry |
| Download name không theo display name | File local sai kỳ vọng | PoC xác minh; `saveAs` canonical + manifest, nhưng vẫn tách khỏi tiêu chí rename in-Flow |
| App crash/mất điện | Job/partial file hỏng | Durable queue, lease/checkpoint, `.part`, transaction |
| Native SQLite packaging | Build lỗi theo Electron ABI | Spike packaging sớm, rebuild trong CI; fallback library chỉ khi cần |
| Ổ đĩa đầy/file bị sửa ngoài app | Mất hoặc sai media | Preflight dung lượng, hash, không overwrite, relink |
| Watermark/model/feature khác theo vùng và gói | Output không đạt yêu cầu | Kiểm tra account settings ở PoC, lưu settings snapshot |

## 7. Thứ tự ra quyết định

1. Chốt naming, JSON Scenes schema và flow tạo/import Scenes bằng Scene Template.
2. Hoàn thành Phase 1.
3. Người dùng review Google terms/account/tier; chạy Phase 2A PoC.
4. Chỉ productize Phase 2 nếu mapping + rename + download đạt.
5. Pilot một Episode trước khi cho queue nhiều scene.
6. Hoàn thành Phase 3 và xác nhận import CapCut thủ công.

