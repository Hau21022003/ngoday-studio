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

**Status:** Proposed.  
**Decision:** SQLite lưu metadata/queue; filesystem lưu media; không server/cloud sync trong ba Phase.  
**Reason:** phù hợp một người dùng, đơn giản, dễ backup và không phát sinh vận hành backend.

### D-003 — Electron process boundary

**Status:** Proposed.  
**Decision:** React renderer chỉ gọi typed IPC qua preload; database, filesystem và Playwright nằm ở main/application layer. `contextIsolation` bật và `nodeIntegration` tắt.  
**Reason:** giảm quyền của UI và giữ side effect ở một nơi.

### D-004 — SQLite và binary media

**Status:** Proposed.  
**Decision:** SQLite không chứa blob media. File nằm trong workspace do người dùng chọn; DB lưu relative path, hash và metadata.  
**Reason:** database nhỏ, backup/export media rõ ràng và dễ dùng với CapCut.

### D-005 — Cách tạo Scenes ở Phase 1

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** từ Episode, người dùng chọn Scene Template, render/copy prompt sang ChatGPT thủ công rồi paste hoặc import JSON Scenes. Không tự động hóa ChatGPT web. Tích hợp LLM API là tùy chọn sau khi chốt provider/chi phí/secret storage.
**Reason:** tạo được Scenes có cấu trúc mà không thêm auth, API cost và dependency chưa cần thiết.

### D-006 — Version bất biến

**Status:** Proposed.  
**Decision:** template version và generation attempt đã sử dụng không bị update đè; thay đổi tạo snapshot/version mới. Phase 1 không có script revision. Scene hiện hành được cập nhật trực tiếp; generation attempt ở Phase 2 giữ prompt snapshot đã thực sự sử dụng.
**Reason:** luôn truy được prompt nào sinh ra media nào.

### D-007 — Asset slot và tên canonical

**Status:** Proposed.  
**Decision:** `scene-{sceneOrder:02}-{assetOrder:02}` biểu diễn một output logic; retry/version nằm trong metadata, không nằm trong tên canonical.  
**Consequence:** reorder scene có thể đổi hàng loạt canonical name nên phải preview và xác nhận.

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

**Status:** Proposed.  
**Decision:** rejected asset và source file không bị automation xóa. App có thể đánh dấu/archive; cleanup tự động được deferred.  
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
**Consequence:** mọi roadmap, UI contract, data model, backup và acceptance criteria phải tham chiếu trực tiếp Episode/Scene; implementation hiện hành còn tab Script sẽ được chỉnh ở lượt UI sau.

### D-020 — Narration thuộc Scene

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** narration/voice-over là field trực tiếp của từng Scene và được review/approve cùng Scene. Không có narration document toàn Episode làm nguồn dữ liệu chính.
**Consequence:** export narration toàn Episode chỉ là file dẫn xuất từ các Scene theo thứ tự, không phải object có lifecycle riêng.

### D-021 — `Nội dung nguồn` là input tùy chọn, tạm thời

**Status:** Accepted theo yêu cầu ngày 2026-10-24.
**Decision:** flow `Tạo Scenes` có trường `Nội dung nguồn` tùy chọn để dán outline/kịch bản có sẵn vào Scene Template. Giá trị này chỉ phục vụ render/copy prompt trong phiên; Phase 1 không persistence, revision hoặc backup riêng cho nó.
**Consequence:** sau import thành công, JSON Scenes đã validate và các Scene được tạo mới là nguồn dữ liệu chính.

## 3. Vấn đề cần người dùng xác nhận trước Phase 1

### Q1 — Ý nghĩa hai số trong tên

Đề xuất hiện tại coi `scene-01-02` là asset thứ 02 thuộc scene 01. Cần xác nhận số thứ hai là:

- Asset/shot thứ tự trong scene; hoặc
- Version/take retry; hoặc
- Một ý nghĩa khác trong quy trình hiện tại.

Đây là quyết định ảnh hưởng data model, reorder và export.

### Q2 — Loại asset cho mỗi scene

Cần xác nhận một scene thường có:

- Một video duy nhất;
- Một ảnh + một video;
- Nhiều shot/clip; hoặc
- Số lượng tự do theo scene.

Đề xuất: asset slot tự do, mỗi slot chọn `image` hoặc `video`.

### Q3 — JSON Scenes schema

Cần một fixture JSON Scenes thực tế đã ẩn thông tin nhạy cảm để chốt field và parser. Schema tối thiểu dự kiến gồm:

- `order`, `title`, `summary`.
- `narration`/voice-over trực tiếp trong Scene.
- `image_prompt`, `video_prompt` và asset hints tùy chọn.

Import Markdown/CSV và parser tách Script → Scenes không thuộc Phase 1.

### Q5 — Scene approval

Cần xác nhận duyệt ở mức scene đủ hay phải duyệt riêng narration, image prompt và video prompt. Đề xuất một trạng thái scene cùng validation chi tiết; asset slot chỉ queue khi scene approved.

### Q6 — Reorder sau khi đã generate

Nếu đổi thứ tự scene sau khi asset đã rename/download, có hai lựa chọn:

- Giữ canonical name cũ để mapping bất biến.
- Renumber toàn bộ Flow/local/export.

Đề xuất khóa số scene sau generation đầu tiên; muốn reorder thì dùng display order riêng hoặc yêu cầu migration có preview.

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

Trước khi implement, cần có câu trả lời tối thiểu cho:

- Q1: semantics của canonical name.
- Q2: asset structure mỗi scene.
- Q3: một sample JSON Scenes và field bắt buộc.
- Q6: quy tắc reorder sau generation.
- Q7–Q11: account, budget, settings, rename fallback và terms cho PoC.
- Q13–Q15: workspace/export/CapCut expectation trước Phase 3.

Các quyết định `Blocked by PoC` chỉ chuyển sang `Accepted` khi có bằng chứng theo `04-flow-poc.md`.

