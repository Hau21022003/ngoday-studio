# Roadmap 3 Phase

## 1. Nguyên tắc triển khai

- Mỗi Phase phải tạo ra một luồng dùng được, không chỉ khung kỹ thuật.
- Không bắt đầu automation rộng trước khi Flow PoC đạt cổng go/no-go.
- Human-in-the-loop là thiết kế chính thức, không phải workaround tạm thời.
- Mặc định giữ dữ liệu, không tự động xóa hoặc ghi đè.
- Mỗi Phase chỉ thêm dependency khi có use case đã được chấp nhận.

## 2. Phase 1 — Episode, Prompt Template & Script Editor

### Mục tiêu

Tạo nguồn dữ liệu local đáng tin cậy cho Episode, prompt, script, scene và asset slot; chưa điều khiển Flow.

### Phạm vi

1. Khởi tạo Electron + React + TypeScript với main/preload/renderer an toàn.
2. SQLite migrations và repository cho Episode, template/version, script/revision, scene, character reference metadata và asset slot.
3. Episode CRUD, archive và tìm kiếm cơ bản.
4. Prompt Template Editor:
   - Tạo phiên bản template bất biến.
   - Validate biến cho phép.
   - Preview/render theo Episode.
   - Copy prompt đã render.
5. Script Editor:
   - Tạo thủ công.
   - Paste/import Markdown và JSON theo schema đã công bố.
   - Tách/reorder scene.
   - Autosave và revision history tối thiểu.
   - Duyệt từng scene.
6. Asset planning:
   - Tạo asset slot cho từng scene.
   - Media type, prompt, references và canonical name.
   - Kiểm tra duplicate/missing data.
7. Export/import backup metadata và script; chưa gồm browser profile.
8. Unit tests cho template rendering, ordering, naming, validation và persistence.

### Ngoài phạm vi Phase 1

- Không tự động điều khiển ChatGPT web.
- Không bắt buộc tích hợp OpenAI/Gemini API. Bản tối thiểu dùng copy/paste/import; tích hợp LLM chỉ thực hiện sau khi chốt provider, chi phí và cách giữ API key.
- Không khởi chạy Playwright hoặc tạo media thật.
- Không quản lý binary media ngoài character reference local.

### Deliverables

- App local chạy được trên Windows ở môi trường phát triển.
- Database schema/migration và cơ chế backup cơ bản.
- UI hoàn chỉnh từ tạo Episode đến danh sách scene/asset slot đã duyệt.
- Định dạng import/export kịch bản được ghi rõ và có sample fixture trong giai đoạn implementation.
- Test report cho logic cốt lõi.

### Acceptance criteria

- Tạo, sửa, archive và mở lại Episode sau khi restart mà không mất dữ liệu.
- Template thay đúng biến; biến thiếu/không hỗ trợ bị báo trước khi render.
- Tạo revision mới không làm thay đổi snapshot cũ đã lưu.
- Import một script hợp lệ tạo đúng scene theo thứ tự; import lỗi không ghi dữ liệu nửa chừng.
- Reorder scene cập nhật lại canonical name có preview và yêu cầu xác nhận nếu có nguy cơ ảnh hưởng mapping.
- Scene chỉ chuyển `approved` khi các trường bắt buộc hợp lệ.
- Mỗi asset slot trong Episode có canonical name duy nhất.
- Autosave không làm mất nội dung khi đóng/mở lại app trong kịch bản test.
- Backup rồi restore vào database trống tái tạo được Episode/template/script; không bao gồm credential.
- Không có network call bắt buộc cho toàn bộ Phase 1.

### Exit gate

Người dùng duyệt data model, naming convention, script import format và UI flow. Sau đó mới thực hiện Flow PoC.

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
   - `script.md` theo thứ tự scene.
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
- `manifest.json`, `manifest.csv` và `script.md` cùng mô tả một snapshot.
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

1. Chốt naming, script format và cách tạo kịch bản.
2. Hoàn thành Phase 1.
3. Người dùng review Google terms/account/tier; chạy Phase 2A PoC.
4. Chỉ productize Phase 2 nếu mapping + rename + download đạt.
5. Pilot một Episode trước khi cho queue nhiều scene.
6. Hoàn thành Phase 3 và xác nhận import CapCut thủ công.

