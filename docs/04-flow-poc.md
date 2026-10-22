# PoC Playwright với Google Flow

## 1. Mục tiêu

PoC phải chứng minh bằng quan sát trên tài khoản thật rằng Playwright có thể điều khiển Flow đủ an toàn cho workflow yêu cầu. PoC không nhằm tạo framework automation hoàn chỉnh và không được mở rộng thành batch lớn trước khi các cổng quan trọng đạt.

Cổng bắt buộc:

1. Auth/session dùng profile riêng và người dùng đăng nhập thủ công.
2. Tạo/mở đúng Flow project.
3. Submit và theo dõi generation mà không gửi trùng.
4. Ánh xạ đúng output với scene/attempt.
5. Đổi tên đúng asset ngay trong Flow và đọc lại xác minh.
6. Download đúng asset sau rename và xác minh file local.
7. Resume sau reload/restart mà không làm lại hành động mơ hồ.

Nếu mục 4 hoặc 5 không đạt, kết luận là **no-go cho full automation theo yêu cầu hiện tại**. Local rename sau download chỉ là fallback giảm phạm vi, không phải kết quả đạt.

## 2. Những gì tài liệu chính thức đã xác nhận

Tại thời điểm kiểm tra 2026-10-22:

- Flow hỗ trợ desktop Chromium và Việt Nam. Google lưu ý chức năng có thể khác theo vùng/gói; watermark hiển thị có thể được áp dụng ở Việt Nam tùy plan/settings.
- Help Center mô tả tạo/đổi tên project, tìm/filter asset, download asset/project/collection và nhiều trạng thái pending/error.
- Flow Agent có thể được yêu cầu đổi tên file cụ thể, tổ chức collection hoặc xóa asset. Agent query có quota ngày; media generation do Agent vẫn dùng credit.
- Google mô tả generation tile có thể hiển thị loại asset và prompt, hữu ích cho đối chiếu.
- Google Takeout xuất media bằng internal `media_id`, không phải display name. Vì vậy không thể suy luận rằng rename trong Flow chắc chắn quyết định filename tải xuống.
- Google Account Help cảnh báo đăng nhập có thể bị chặn nếu browser bị điều khiển bằng automation hoặc embedded trong app.
- Chưa tìm thấy public API chính thức để quản lý Flow project/asset/rename. Gemini API có Veo nhưng là workflow khác và không đáp ứng yêu cầu quản lý tên trong Flow project.

Hệ quả: khả năng thao tác là hợp lý về mặt UI, nhưng độ ổn định, auth, asset identity, rename và download filename đều phải được PoC; không được coi là hợp đồng API.

## 3. Giới hạn an toàn và tuân thủ

- Người dùng tự xem xét và chấp nhận Google Terms, policy của Flow và điều kiện tài khoản trước khi chạy PoC.
- Chỉ thao tác project và nội dung thuộc tài khoản của người dùng.
- Không scrape nội dung của người khác, không gọi endpoint private và không reverse-engineer protocol.
- Không che dấu automation, bypass CAPTCHA/2FA, fingerprint protection, rate limit hoặc `Unusual Activity`.
- Khi Google yêu cầu auth/verification, PoC dừng để người dùng thao tác trực tiếp.
- Không lưu password, access token hoặc cookie trong database/log.
- Dùng generation test nhỏ, prompt vô hại và có budget credit được người dùng duyệt.
- PoC chạy headful để người dùng nhìn thấy toàn bộ thao tác.

## 4. Môi trường PoC

### Điều kiện trước khi chạy

- Windows và bản Chrome/Edge/Chromium được Flow hỗ trợ.
- Tài khoản Google 18+, ở vùng hỗ trợ, có plan/credits và quyền dùng Flow phù hợp.
- UI language cố định cho suốt PoC, ưu tiên English để đối chiếu Help Center và locator; không tự đổi cài đặt account.
- Một project test riêng, không chứa tài sản quan trọng.
- Một ảnh character reference test không nhạy cảm, có quyền sử dụng.
- Output count đặt mức thấp nhất.
- Ghi lại model, aspect ratio, plan, watermark setting và timezone tại đầu run.

### Browser strategy cần so sánh

Ưu tiên thử theo thứ tự:

1. Playwright `launchPersistentContext` với installed Chrome/Edge (`channel`) và `userDataDir` riêng của app.
2. Playwright Chromium bundled với profile riêng nếu Flow và Google login chấp nhận.
3. Nếu sign-in automation context bị chặn, cho người dùng mở browser được app khởi chạy và login thủ công; không tự nhập credential.

Không dùng Chrome default profile vì profile lock, rủi ro dữ liệu cá nhân và hành vi khó lặp lại.

## 5. Chiến lược locator và quan sát

Thứ tự ưu tiên locator:

1. `getByRole` với accessible name ổn định.
2. Label/placeholder và text có scope rõ.
3. Thuộc tính semantic ổn định (`aria-*`, `data-testid`) nếu có.
4. Quan hệ DOM cục bộ quanh tile đã xác định.
5. CSS class sinh tự động chỉ dùng tạm trong PoC và phải đánh dấu rủi ro.

Không dựa vào:

- Chỉ số `nth()` của tile trên grid.
- Tọa độ click cố định.
- Sleep cố định như cơ chế chính.
- Tên file download để suy ra asset trước khi đã xác minh.

Mỗi action ghi lại:

- URL/project identity quan sát được.
- Locator strategy và precondition.
- Timestamp, prompt/settings/reference snapshot.
- Danh sách/tập asset trước và sau action nếu đọc được.
- Postcondition, screenshot khi lỗi và confidence của mapping.

## 6. Kịch bản PoC chi tiết

### P0 — Review terms và account

1. Người dùng xác nhận project test, plan/credit budget và quyền đối với reference.
2. Mở Terms/Flow policy hiện hành và xác nhận chấp nhận rủi ro browser automation.
3. Xác nhận không có yêu cầu chạy unattended hoặc bypass security.

**Pass:** có xác nhận go từ người dùng.  
**Stop:** điều khoản, tài khoản hoặc mục đích sử dụng không phù hợp.

### P1 — Launch và session persistence

1. Khởi chạy browser headful với profile riêng.
2. Mở Flow; người dùng login/2FA thủ công nếu cần.
3. Đóng browser đúng cách, mở lại bằng cùng profile.
4. Lặp lại ít nhất 3 lần khởi động.

**Pass:** 3/3 lần vào được Flow hoặc chuyển rõ sang `AUTH_REQUIRED`; không cần app lưu/điền password.  
**Fail/stop:** Google chặn automation context, yêu cầu bypass hoặc session hỏng lặp lại.

### P2 — Project lifecycle

1. Chụp danh sách project trước thao tác.
2. Tạo project với tên PoC duy nhất.
3. Ghi URL, project ID nếu công khai và tên hiển thị.
4. Reload, thoát về project list và mở lại đúng project.
5. Thử rename project để hiểu hành vi locator, nhưng không dùng kết quả này thay cho asset rename.

**Pass:** tạo và mở lại đúng project 3/3 lần, có identity đủ bền vững để reconcile.  
**Fail:** chỉ có thể tìm project bằng vị trí trên grid hoặc có nguy cơ mở nhầm.

### P3 — Image generation tối thiểu

1. Đặt output count nhỏ nhất và bật tile details nếu cần.
2. Ghi asset baseline.
3. Nhập prompt test duy nhất, chọn image/model/settings và submit một lần.
4. Quan sát các trạng thái pending/generating/success/error.
5. Reload giữa lúc pending ở một run để kiểm tra khả năng reconcile.
6. Đối chiếu prompt/settings/thời gian và output mới.

**Pass:** 5 run hợp lệ, không duplicate, mọi output được nhận diện hoặc dừng `MAPPING_AMBIGUOUS`; mục tiêu cuối là 100% mapping chắc chắn trên tập test.  
**Fail:** click outcome không xác định và không thể đối chiếu trước khi retry.

### P4 — Video generation và character reference

1. Chọn một asset slot video.
2. Attach reference test; xác minh thumbnail/tên hoặc dấu hiệu UI trước submit.
3. Submit prompt, theo dõi tới terminal state.
4. Ghi nhận model tự đổi, policy/audio error, credit/rate limit nếu xuất hiện.
5. Reload và mở lại output từ project.

**Pass:** reference và settings được xác nhận trước submit; output video được mapping chính xác và mở lại được.  
**Fail:** không thể biết reference nào đã được attach hoặc output thuộc attempt nào.

### P5 — Asset identity và mapping

Thử tìm một định danh bền vững theo thứ tự:

1. Asset ID công khai trong URL hoặc semantic DOM.
2. Tên/prompt/timestamp/type/version được Flow hiển thị.
3. Diff giữa tập asset trước/sau với concurrency 1 và expected output count.
4. Human selection nếu các tín hiệu trên không đủ.

Không sử dụng internal network API làm dependency sản phẩm.

**Pass:** 10/10 output trong ma trận image/video được nối đúng attempt; confidence thấp luôn dừng, không tự đoán.  
**No-go:** không có cách phân biệt hai output tương tự sau reload.

### P6 — Đổi tên asset trong Flow

Kiểm tra hai đường, ưu tiên đường xác định hơn:

#### A. Direct UI rename

1. Chọn đúng một asset đã mapping.
2. Mở menu/detail và tìm hành động rename hoặc field tên.
3. Nhập canonical name, save.
4. Đóng/reload project, tìm lại asset và đọc tên.
5. Search theo canonical name nếu Flow hỗ trợ.

#### B. Flow Agent rename

Nếu direct UI không tồn tại:

1. Chọn đúng một asset.
2. Bật Agent và đưa selected asset vào context theo UI được hỗ trợ.
3. Gửi yêu cầu cụ thể, ví dụ đổi tên selected file thành canonical name; không yêu cầu batch trong PoC đầu.
4. Chờ Agent báo hoàn tất.
5. Tắt/đóng Agent, reload và đọc lại tên asset độc lập với câu trả lời của Agent.
6. Lặp với tên gần giống để phát hiện rename nhầm.

Các case bắt buộc:

- Ký tự hợp lệ theo convention.
- Tên đã đúng từ trước (idempotent).
- Tên trùng nếu Flow cho phép/không cho phép.
- Agent quota/error.
- Reload sau rename.

**Pass:** 10/10 lần đổi đúng asset, tên đọc lại chính xác sau reload; không asset khác bị đổi; đường thao tác có lỗi rõ khi không đạt.  
**No-go:** Agent trả lời thành công nhưng tên không đổi, chọn nhầm asset, không đọc lại được tên, hoặc rename phụ thuộc diễn giải không ổn định.

### P7 — Download sau rename

1. Từ asset đã xác minh tên, bắt đầu chờ Playwright download event trước khi click.
2. Ghi `suggestedFilename`, content disposition nếu API Playwright cung cấp, loại action và asset identity.
3. `saveAs` vào staging với tên canonical do app kiểm soát.
4. Kiểm tra file tồn tại, bytes > 0, signature/MIME, mở/đọc metadata tối thiểu và SHA-256.
5. So sánh suggested filename với display name trên Flow.
6. Lặp cho image và video.

**Pass:** 10/10 download đúng asset và file hợp lệ. Tên local canonical có thể được đảm bảo bằng `saveAs`.  
**Ghi chú quyết định:** nếu suggested filename không theo tên trên Flow, yêu cầu “rename trong Flow” vẫn có thể đạt nếu tên Flow đã verify, nhưng app phải ghi rõ download được lưu lại bằng canonical name; không được tuyên bố Flow cung cấp filename đó.

### P8 — Failure, pause/resume và reconcile

Mô phỏng an toàn:

- Pause khi một generation đang pending.
- Reload trang khi đang observe.
- Đóng app sau submit và trước khi thấy output.
- Làm download thất bại vào path test không hợp lệ hoặc tạm ngắt mạng có kiểm soát.
- Đăng xuất test profile rồi resume.
- Tạo một mapping mơ hồ có chủ đích bằng nhiều output nếu budget cho phép.

**Pass:** không submit trùng; job đi vào `reconciling`, `waiting_user` hoặc retry an toàn; không đánh dấu thành công khi chưa verify.

### P9 — Selector stability

1. Chạy lại smoke flow sau khi đóng/mở browser.
2. Chạy ở ít nhất hai kích thước cửa sổ desktop hợp lý.
3. Nếu có thể, chạy lại vào ngày khác để bắt A/B rollout ngắn hạn.
4. Thay text locale chỉ để đánh giá rủi ro; bản đầu có thể chính thức hỗ trợ một locale UI.

**Pass:** locator chính không phụ thuộc tọa độ/nth/class động và lỗi selector được phát hiện sớm bởi health check.

## 7. Ma trận bằng chứng

| Capability | Bằng chứng cần lưu | Ngưỡng go |
| --- | --- | --- |
| Session | Event log mỗi lần launch, không chứa token | 3/3 |
| Project reopen | URL/ref + tên đọc lại | 3/3 |
| Submit | Một click intent ↔ một attempt/output set | Không duplicate |
| Observe | Timeline state và terminal result | Mọi run có kết luận |
| Mapping | Remote evidence + local attempt ID | 10/10 chắc chắn |
| Reference | Pre-submit UI evidence | 5/5 đúng |
| Rename | Tên trước/sau và sau reload | 10/10 đúng asset |
| Download | Asset ref, suggested name, hash, bytes | 10/10 hợp lệ |
| Restart | Checkpoint trước/sau | 0 duplicate |

Số lần có thể điều chỉnh nếu credit hạn chế, nhưng mapping, rename và restart không được thông qua chỉ bằng một lần thành công.

## 8. Kết quả PoC cần bàn giao

- Bảng capability: `pass`, `conditional`, `fail`.
- Danh sách selector strategy, không cần lưu selector nhạy cảm ngoài repo ứng dụng nếu UI thay đổi nhanh.
- Video/screenshot lỗi đã lọc và event timeline.
- Kết luận cách rename: direct UI, Flow Agent hoặc không khả thi.
- Kết luận quan hệ giữa display name và download suggested filename.
- Retry/timeout thực đo, tín hiệu rate limit và credit behavior.
- Go/no-go cho Phase 2B và danh sách rủi ro còn lại.

## 9. Fallback theo thứ tự

### Fallback 1 — Supervised Playwright

App điều hướng, điền prompt và phát hiện output; người dùng bấm xác nhận submit/rename khi UI không đủ ổn định. App tiếp tục sau khi đọc lại postcondition. Vẫn có thể đáp ứng rename trong Flow nếu thao tác và verification xảy ra ở đó.

### Fallback 2 — Manual rename checkpoint

App mở đúng asset và hiển thị tên cần đặt; người dùng đổi tên trong Flow, sau đó app reconcile và download. Đây là fallback gần nhất với yêu cầu gốc.

### Fallback 3 — Download rồi rename local

App/người dùng download asset, app dùng mapping và manifest để lưu bằng canonical name. Phương án này bảo toàn quy trình downstream nhưng **không đáp ứng** yêu cầu đổi tên trong Flow; cần người dùng chấp nhận giảm phạm vi.

### Fallback 4 — Manual Flow, app quản lý phần còn lại

Người dùng tự tạo/duyệt/đổi tên/download trên Flow; app import media, yêu cầu chọn asset slot và kiểm tra tên/hash.

### Fallback 5 — Gemini/Veo API chính thức

Thay generation UI bằng API chính thức để có operation ID và download ổn định. Phương án này không tạo tài sản trong project Flow và thay đổi đáng kể sản phẩm; chỉ thực hiện sau quyết định riêng.

## 10. Stop conditions

Dừng PoC hoặc chuyển về người dùng ngay khi:

- CAPTCHA/2FA/security challenge xuất hiện.
- `Unusual Activity`, account warning hoặc policy block lặp lại.
- Cần dùng kỹ thuật che dấu automation/bypass.
- Không thể xác định chắc asset vừa tạo.
- Rename không thể verify độc lập.
- UI hoặc plan bắt đầu dùng credit ngoài số lượng đã duyệt.
- Flow/Google terms hoặc machine-readable instruction hiện hành không cho phép cách truy cập dự kiến.
- Có nguy cơ thao tác project thật ngoài project test.

## 11. Nguồn chính thức được kiểm tra ngày 2026-10-22

- [Manage your Google Flow projects, assets & collections](https://support.google.com/flow/answer/16935308?hl=en)
- [Use the Google Flow Agent](https://support.google.com/flow/answer/17093911?hl=en)
- [Get started with Google Flow](https://support.google.com/flow/answer/16353333?hl=en)
- [Where you can use Google Flow](https://support.google.com/flow/answer/16353544?hl=en)
- [Download your Google Flow data](https://support.google.com/labs/answer/17571126?hl=en)
- [Use keyboard shortcuts in Google Flow](https://support.google.com/labs/answer/17069754?hl=en)
- [Sign in with a supported browser](https://support.google.com/accounts/answer/7675428?hl=en)
- [Google Terms of Service](https://policies.google.com/terms?hl=en-US)
- [Generate videos with Veo in Gemini API](https://ai.google.dev/gemini-api/docs/veo)

