# Quyết định và vấn đề cần xác nhận

## 1. Quy ước trạng thái

- `Accepted`: đã đủ rõ để dùng làm mặc định khi implement.
- `Proposed`: đề xuất hiện tại, cần người dùng duyệt.
- `Blocked by PoC`: không được coi là khả thi trước khi có bằng chứng.
- `Deferred`: cố ý để sau, không chặn Phase hiện tại.

## 2. Decision log

### D-001 — Dự án độc lập

**Status:** Accepted theo yêu cầu.  
**Decision:** `ngoday-studio` được tạo mới tại `D:\self_project\ngoday-studio`, không đọc, import hay phụ thuộc dự án cũ.  
**Consequence:** mọi schema, UI và automation được thiết kế từ yêu cầu trong bộ tài liệu này.

### D-002 — Local-first, không backend

**Status:** Accepted trong M5B ngày 2026-10-24.
**Decision:** SQLite lưu metadata/queue; filesystem lưu media; không server/cloud sync trong ba Phase.  
**Reason:** phù hợp một người dùng, đơn giản, dễ backup và không phát sinh vận hành backend.

### D-003 — Electron process boundary

**Status:** Accepted trong M5B ngày 2026-10-24.
**Decision:** React renderer chỉ gọi typed IPC qua preload; database, filesystem và Playwright nằm ở main/application layer. `contextIsolation` bật và `nodeIntegration` tắt.  
**Reason:** giảm quyền của UI và giữ side effect ở một nơi.

### D-004 — SQLite và binary media

**Status:** Accepted trong M5B ngày 2026-10-24.
**Decision:** SQLite không chứa blob media. File nằm trong workspace do người dùng chọn; DB lưu relative path, hash và metadata.  
**Reason:** database nhỏ, backup/export media rõ ràng và dễ dùng với CapCut.

### D-005 — Cách tạo Scenes ở Phase 1

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** từ Episode, người dùng chọn Scene Template, render/copy prompt sang ChatGPT thủ công rồi paste hoặc import JSON Scenes. Không tự động hóa ChatGPT web. Tích hợp LLM API là tùy chọn sau khi chốt provider/chi phí/secret storage.
**Reason:** tạo được Scenes có cấu trúc mà không thêm auth, API cost và dependency chưa cần thiết.

### D-006 — Version bất biến

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** template version và generation attempt đã sử dụng không bị update đè; thay đổi tạo snapshot/version mới. Phase 1 không có script revision. Scene hiện hành được cập nhật trực tiếp; generation attempt ở Phase 2 giữ prompt snapshot đã thực sự sử dụng.
**Reason:** luôn truy được prompt nào sinh ra media nào.

### D-007 — Asset slot và tên canonical ổn định

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** `scene-{canonicalNo:02}-{slotOrder:02}` biểu diễn một output logic; retry/version nằm trong metadata, không nằm trong tên canonical. Scene có `displayOrder` riêng để reorder, còn `canonicalNo` được cấp một lần và không đổi.
**Consequence:** reorder chỉ đổi thứ tự biên tập, không rename Flow/local asset. Phase 1 không xóa riêng Scene. Replace chỉ được phép trước khi graph có Asset và được reset canonical về `1..N`; sau khi có Asset thì replace bị khóa nên canonical đã đưa vào sử dụng không bị tái dùng.

### D-008 — Human review trước rename/download

**Status:** Proposed.  
**Decision:** generation dừng ở review; chỉ candidate được accept mới được rename trên Flow, verify và download.  
**Reason:** tiết kiệm thao tác/download cho kết quả bị loại và giữ đúng mapping accepted media.

### D-009 — Browser automation có giám sát

**Status:** Proposed.  
**Decision:** Playwright chạy headful với browser profile riêng; login/2FA/CAPTCHA do người dùng làm. Không chạy unattended ở bản đầu.  
**Reason:** Google có thể chặn browser bị automation điều khiển; Flow là UI bên thứ ba không có contract ổn định.

### D-010 — Không dùng private Flow API

**Status:** Proposed.  
**Decision:** không phụ thuộc endpoint nội bộ, token trích xuất, network interception hoặc reverse engineering. Chỉ thao tác UI và public API nếu Google công bố sau này.  
**Reason:** giảm rủi ro bảo mật, điều khoản và gãy tích hợp.

### D-011 — Concurrency mặc định bằng 1

**Status:** Proposed.  
**Decision:** Phase 2 tạo một generation tại một thời điểm. Chỉ tăng concurrency khi có remote asset identity ổn định và test mapping đạt.  
**Reason:** mapping chính xác quan trọng hơn throughput ở bản đầu.

### D-012 — Retry fail-closed

**Status:** Proposed.  
**Decision:** không retry submit generation khi kết quả click mơ hồ; chuyển `unknown/reconciling`. Rename phải read-after-write; download phải kiểm tra integrity.  
**Reason:** tránh tốn credit kép và gắn nhầm media.

### D-013 — Rename trong Flow là cổng bắt buộc

**Status:** Accepted cho thiết kế; feasibility đã được xác minh bởi minimal image PoC, ngưỡng lặp production chưa đạt.
**Decision:** Phase 2 chỉ được tuyên bố đạt khi đúng asset được rename trong Flow và exact Rename value đọc lại đúng sau reload. Direct UI là đường mặc định; Flow Agent chỉ là fallback nếu UI này biến mất.
**Known evidence:** Trên image PoC ngày 2026-10-22, menu của tile có `Đổi tên`; `scene-01-01` tồn tại sau reload trên cùng `data-media-id`. Tile caption có thể vẫn là caption sinh tự động nên không được dùng làm postcondition.
**Consequence:** local rename không được dùng để “lách” acceptance criterion này. Automation phải dùng nút `Xong`, reload rồi mở lại Rename để read-after-write; batch/unattended vẫn chờ test lặp.

### D-014 — Tên Flow và tên download là hai postcondition riêng

**Status:** Accepted; hành vi đã được quan sát trong minimal image PoC.
**Decision:** lưu riêng `observed_name` trên Flow, `suggestedFilename` và local canonical filename. App dùng Playwright `saveAs` hoặc filesystem staging để đảm bảo tên local, nhưng vẫn phải verify tên Flow độc lập.
**Known evidence:** asset có Rename value `scene-01-01`, còn Flow download gợi ý `scene-01-01_20261022230148.jpg`; file JPEG hợp lệ nhưng không có exact canonical basename.
**Reason:** Flow giữ scene prefix nhưng tự thêm timestamp; display name không bảo đảm exact filename export/download.

### D-015 — Queue bền vững trong SQLite

**Status:** Proposed.  
**Decision:** job/checkpoint/event được ghi database; khi restart, job `running` phải reconcile trước khi chạy tiếp.  
**Reason:** generation dài và trình duyệt/UI có thể đóng bất ngờ.

### D-016 — Không tự động xóa trong ba Phase

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** rejected asset và source file không bị automation xóa. App có thể đánh dấu/archive; cleanup tự động được deferred.  
**Consequence:** hard-delete aggregate bị chặn bằng FK `RESTRICT`. Replace asset-free phải xóa Slot → Scene → orphan import batch tường minh trong một transaction; archive không cascade child hoặc binary.
**Reason:** tránh mất dữ liệu khi mapping/accept sai.

### D-017 — Export là snapshot bất biến

**Status:** Proposed.  
**Decision:** mỗi export có revision/folder riêng và manifest/hash; không move source và không ghi đè export cũ.  
**Reason:** dễ rollback, so sánh và import CapCut lại.

### D-018 — Windows-first

**Status:** Proposed.  
**Decision:** ba Phase đầu hỗ trợ Windows vì path đích, Flow desktop và CapCut workflow hiện tại đều ở Windows. Kiến trúc tránh khóa path không cần thiết nhưng chưa cam kết macOS/Linux.  
**Reason:** giảm ma trận test/packaging.

### D-019 — Không có Script module/domain object

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** Phase 1 không có tab/module `Script`, bảng `scripts`, `script_revisions`, repository/IPC Script hoặc bước Script → Scenes. Workflow chuẩn là `Episode → Scenes → Assets`.
**Consequence:** mọi roadmap, UI contract, data model, backup và acceptance criteria phải tham chiếu trực tiếp Episode/Scene; Workspace hiện hành đã được đồng bộ còn `Overview / Scenes / Assets`.

### D-020 — Narration thuộc Scene

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** narration/voice-over là field trực tiếp của từng Scene và được review/approve cùng Scene. Không có narration document toàn Episode làm nguồn dữ liệu chính.
**Consequence:** export narration toàn Episode chỉ là file dẫn xuất từ các Scene theo thứ tự, không phải object có lifecycle riêng.

### D-021 — `Nội dung nguồn` là input tùy chọn, tạm thời

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** flow `Tạo Scenes` có trường `Nội dung nguồn` tùy chọn để dán outline/kịch bản có sẵn vào Scene Template. Giá trị này chỉ phục vụ render/copy prompt trong phiên; Phase 1 không persistence, revision hoặc backup riêng cho nó.
**Consequence:** sau import thành công, JSON Scenes đã validate và các Scene được tạo mới là nguồn dữ liệu chính.

### D-022 — Core schema Phase 1 tối thiểu

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** migration đầu chỉ tạo `prompt_templates`, `prompt_template_versions`, `episodes`, `scene_import_batches`, `scenes`, `asset_slots`, `assets` và `schema_migrations`. `scene_import_batches` chỉ là provenance record tối thiểu; table Flow, generation attempt, queue và export chỉ được thêm ở Phase tương ứng.
**Reason:** tránh schema speculative và giữ migration đầu truy vết trực tiếp về UI/workflow M1–M4.

### D-023 — Template variables là immutable JSON snapshot

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** variable definitions nằm trong `prompt_template_versions.variables_json`, được validate/canonicalize trước khi ghi. Current version là version có `(major, minor)` lớn nhất, không lưu pointer vòng; usage count là projection.
**Reason:** variable contract luôn được dùng cùng prompt content và không cần query/chỉnh sửa độc lập.

### D-024 — Tách AssetSlot và Asset

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** `AssetSlot` là logical output cần có của Scene với status `draft/ready/fulfilled`; `Asset` là candidate/file thực tế với lifecycle `candidate/accepted/rejected`. Một slot có thể có nhiều candidate nhưng partial unique index giới hạn tối đa một Asset active ở trạng thái `accepted`.
**Consequence:** working prompt nằm trên slot; prompt thực sự đã dùng được snapshot trên Asset. File `missing/hash_mismatch` là integrity projection riêng và không ghi đè lifecycle Asset. Queue/generation state chỉ thêm cùng job model Phase 2.

### D-025 — JSON Scenes v1 strict và không tin status từ GPT

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** import dùng envelope `{ schemaVersion: 1, scenes: [...] }`, có thể bóc đúng một outer Markdown JSON fence, reject unknown key và validate toàn payload trước transaction. JSON không nhận ID/status/canonical/timestamp; mọi Scene import bắt đầu `draft`.
**Consequence:** preview trả payload hash; commit gửi lại raw JSON và hash để main revalidate. Import lỗi rollback toàn bộ provenance batch + Scene + AssetSlot. `append` nối tiếp numbering; `replace` chỉ chạy khi graph chưa từng có Asset và reset numbering `1..N`.

### D-026 — Optimistic concurrency cho current-state entity

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** Template metadata, Episode, Scene, AssetSlot và Asset có `revision_no`; mutation phải gửi `expectedRevisionNo`. Version/provenance snapshot bất biến không có update.
**Consequence:** conflict trả `STALE_REVISION`, không last-write-wins. Asset delete trong UI là archive metadata; binary không tự động bị xóa.

### D-027 — Migration forward-only có checksum và backup

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** SQL migration tuần tự, transactional và không sửa file đã apply; `schema_migrations` lưu checksum. Database có dữ liệu được backup nhất quán trước migration quan trọng; phục hồi bằng backup + forward fix thay vì down migration framework.
**Reason:** đơn giản, kiểm toán được và phù hợp local single-user.

### D-028 — Typed IPC theo use case

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** preload expose namespace Template/Episode/Scene creation/Scene/AssetSlot/Asset với request-response schema và `IpcResult<T>`; không expose `ipcRenderer`, SQL, filesystem hoặc generic CRUD.
**Consequence:** request lẫn response đều validate; business transaction và path trust boundary nằm ở main/application layer.

### D-029 — Provenance tối thiểu cho Scene import

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** mỗi commit import tạo một `SceneImportBatch` bất biến gồm Episode, TemplateVersion, mode, payload hash, rendered-prompt hash tùy chọn, scene count và timestamp. Scene import trỏ tới batch; Scene tạo thủ công không có batch.
**Consequence:** truy được lần import và đúng TemplateVersion mà không lặp provenance trên từng Scene. Không có module/repository/IPC CRUD riêng cho batch; không persist rendered prompt, raw JSON hoặc `Nội dung nguồn`.

### D-030 — Episode workflow status là projection

**Status:** Accepted trong M5A ngày 2026-10-24.
**Decision:** Episode chỉ persist `archived_at`; `draft/scenes_ready/producing/ready_to_export` được derive từ Scene, AssetSlot, Asset và file integrity.
**Consequence:** database không có Episode workflow-status column có thể lệch graph. List/filter dùng query projection; archive vẫn là mutation có optimistic concurrency.

### D-031 — SQLite driver dùng runtime Electron

**Status:** Accepted cho M5B ngày 2026-10-24.
**Decision:** M5B dùng synchronous `node:sqlite` đi kèm Electron 45/Node 24, không đóng gói native addon riêng. Main process là database owner duy nhất; repository/application transaction không `await` bên trong transaction.
**Consequence:** loại bỏ rủi ro ABI/rebuild của native addon và packaged Windows smoke test đã chạy migration thật thành công. API vẫn được Node đánh dấu experimental, vì vậy upgrade Electron/Node phải chạy lại migration, repository và packaged-runtime test; chỉ đổi driver qua adapter nếu runtime bỏ hoặc thay đổi API không tương thích.

### D-032 — Atomic Template edit qua typed IPC

**Status:** Accepted/Implemented trong M6 ngày 2026-10-24; manual acceptance PASS.
**Decision:** bổ sung `templates.saveEdit` để một thao tác UI có thể update metadata và append immutable TemplateVersion trong cùng application transaction. Command dùng `expectedRevisionNo`, request/response schema strict và trả aggregate đã commit.
**Revision semantics:** một `saveEdit` thành công làm tăng Template `revision_no` đúng một lần, kể cả khi command chứa cả metadata patch và version mới; toàn bộ thay đổi rollback nếu bất kỳ bước nào lỗi.
**Reason:** màn hình đã duyệt có một nút Save cho cả metadata lẫn nội dung version; gọi hai IPC riêng có thể để lại partial commit mà renderer không thể rollback an toàn. Đây là contract additive, không đổi schema hoặc invariant version bất biến.

### D-033 — Episode thumbnail IPC giới hạn trong workspace

**Status:** Accepted/Implemented trong M6 ngày 2026-10-24; manual acceptance PASS.
**Decision:** bổ sung use case typed IPC hẹp để import/read Episode thumbnail trong workspace. Main validate image/size/path và chỉ trả relative path hoặc nội dung ảnh cần hiển thị; không expose generic filesystem, absolute path hoặc `ipcRenderer`.
**Reason:** renderer sandbox không thể tự tạo một workspace-relative file đáng tin cậy, trong khi contract cấm blob trong SQLite và absolute path trong dữ liệu Episode.

### D-034 — Sandboxed preload dùng CommonJS artifact

**Status:** Accepted/Implemented trong M6 ngày 2026-10-24; dev, packaged bridge smoke và manual acceptance PASS.
**Decision:** build preload thành CommonJS `index.cjs` và dùng một shared artifact name cho cả build config lẫn `BrowserWindow`. Giữ nguyên `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; renderer fail-fast nếu typed bridge M6 không tồn tại và không dùng mock/in-memory fallback.
**Reason:** Electron sandboxed preload không load được bundle ESM `index.mjs` trong cả dev và packaged app (`SyntaxError: Cannot use import statement outside a module`), khiến `contextBridge.exposeInMainWorld` không chạy và `window.studio` là `undefined`.

## 3. Quyết định Phase 1 đã đóng

### Q1 — Ý nghĩa hai số trong tên

**Đã đóng:** `scene-01-02` là AssetSlot thứ 02 của Scene có `canonicalNo = 01`; số thứ hai không phải version/take. Reorder không đổi tên.

### Q2 — Loại asset cho mỗi scene

**Đã đóng:** một Scene có số AssetSlot tự do; mỗi slot chọn `image` hoặc `video`. Asset là candidate/file con theo D-024.

### Q3 — JSON Scenes schema

**Đã đóng về schema:** contract field nằm tại `08-m5-domain-persistence-contract.md`:

- Bắt buộc: `order`, `title`, `narration`, `visualDescription`, `sceneType`, `mediaType`.
- Tùy chọn: `summary`, `notes`, `assetSlots`.

Import Markdown/CSV và parser tách Script → Scenes không thuộc Phase 1. M5B dùng fixture JSON v1 đã ẩn dữ liệu nhạy cảm tại `tests/fixtures/scenes-v1.valid.json` để kiểm thử import boundary.

### Q5 — Scene approval

**Đã đóng:** duyệt một `SceneStatus` cho toàn Scene; narration và visual description là validation chi tiết. Slot chỉ chuyển `ready` khi Scene approved và prompt hợp lệ.

### Q6 — Reorder sau khi đã generate

**Đã đóng:** `canonicalNo` ổn định, `displayOrder` thay đổi độc lập. Reorder không rename; replace chỉ reset numbering khi graph chưa từng có Asset.

## 4. Vấn đề cần xác nhận trước Flow PoC

### Q7 — Tài khoản, plan và credit budget

Cần biết loại account/plan, UI language và số generation tối đa cho PoC. Flow hiện hỗ trợ Việt Nam nhưng model, quota, Agent và watermark có thể khác theo plan/khu vực.

### Q8 — Chính sách watermark

Help Center hiện cho biết watermark hiển thị có thể bị áp dụng tại Việt Nam tùy plan. Cần kiểm tra trực tiếp setting và output của account; không giả định PoC có thể tắt watermark.

### Q9 — Model/settings mặc định

Cần chốt các default có trong account tại thời điểm PoC:

- Image/video model.
- Aspect ratio/orientation.
- Duration/resolution.
- Output count.
- Audio/silent preference.
- Số character reference tối đa.

App phải lưu snapshot thực tế, không hard-code feature theo tài liệu marketing.

### Q10 — Phương pháp rename chấp nhận được

**Kết quả PoC tối thiểu:** direct deterministic UI rename tồn tại và đã PASS trên một image asset; Flow Agent chưa cần dùng. Câu hỏi về fallback chỉ còn áp dụng nếu Google bỏ/thay đổi direct UI hoặc khi test video/reference cho kết quả khác.

Thứ tự đề xuất:

1. Direct deterministic UI rename nếu có.
2. Chọn đúng một asset và yêu cầu Flow Agent rename, sau đó verify độc lập.
3. Người dùng rename thủ công tại checkpoint, app verify.

Cần xác nhận fallback 3 có được coi là đáp ứng Phase 2 hay không. Theo tài liệu hiện tại, đây là supervised automation nhưng vẫn rename trong Flow.

### Q11 — Điều khoản và mức chấp nhận rủi ro account

Google cảnh báo browser bị phần mềm automation điều khiển có thể bị chặn đăng nhập, và Terms cấm lạm dụng/bypass cũng như một số truy cập tự động trái machine-readable instructions. Cần người dùng review terms hiện hành và xác nhận PoC trên project test. App sẽ không bypass protection.

### Q12 — Retention trên Flow

Cần chốt rejected candidate được:

- Giữ nguyên trong project;
- Chuyển collection `Rejected`; hoặc
- Người dùng xóa thủ công.

Đề xuất không tự động xóa ở MVP.

## 5. Vấn đề cần xác nhận trước Phase 3

### Q13 — Workspace và cấu trúc folder

Cần chọn root mặc định và quy tắc slug Episode. Đề xuất người dùng chọn workspace, app tạo folder theo Episode slug và export revision.

### Q14 — Quy tắc version local

Đề xuất candidate/version nằm trong thư mục library nội bộ; folder CapCut chỉ chứa bản accepted với canonical name. Cần xác nhận có muốn giữ rejected downloads hay chỉ giữ metadata/thumbnail.

### Q15 — Yêu cầu import CapCut

Cần xác nhận CapCut chỉ cần folder media tên đúng hay còn cần:

- Tách folder images/videos/audio.
- Một file CSV shot list.
- Narration/subtitle file.
- Frame rate/resolution normalization.

Ba Phase hiện tại không tạo hoặc sửa project CapCut.

### Q16 — Backup và dung lượng

Cần chốt backup chỉ gồm metadata hay gồm cả media. Đề xuất hai lệnh riêng:

- Metadata backup nhanh.
- Full workspace backup do người dùng chủ động chọn vì dung lượng lớn.

## 6. Các quyết định cố ý deferred

- Cloud sync và multi-user.
- Tích hợp trực tiếp CapCut.
- LLM provider abstraction đầy đủ.
- Song song nhiều Flow generation.
- Auto-delete/retention policy.
- macOS/Linux packaging.
- Auto-update và code signing.
- Tạo thumbnail/transcode bằng FFmpeg nếu chưa có nhu cầu thực tế.

## 7. Checklist duyệt kế hoạch

M5A, M5B và M6 đã Approved/Completed ngày 2026-10-24. M6 chỉ nối Template/Episode; D-032–D-034 đã được implement và manual acceptance PASS. D-002–D-007, D-016 và D-022–D-034 đã đóng cho phạm vi hiện tại; Q1, Q2, Q3 schema, Q5 và Q6 không còn là câu hỏi mở.

Các quyết định còn cần trước phase tương ứng:

- Q7–Q11: account, budget, settings, rename fallback và terms cho PoC.
- Q13–Q15: workspace/export/CapCut expectation trước Phase 3.

Các quyết định `Blocked by PoC` chỉ chuyển sang `Accepted` khi có bằng chứng theo `04-flow-poc.md`.

