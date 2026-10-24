# Quy trình sản xuất video

## 1. Mục đích và phạm vi

`ngoday-studio` là desktop app local-first hỗ trợ quy trình từ Episode và Scene Template đến Scenes, media đã được duyệt, đặt tên và sắp xếp để đưa vào CapCut.

Phạm vi của kế hoạch:

- Quản lý Episode, prompt template, Scene và asset.
- Điều khiển Google Flow bằng Playwright, với người dùng đăng nhập và giám sát.
- Đặt tên media ngay trong project Flow trước khi tải xuống.
- Lưu lịch sử lần tạo, duyệt media, tải xuống và xuất folder theo thứ tự.
- Có queue bền vững, retry có kiểm soát, pause/resume và phục hồi sau khi app đóng bất ngờ.

Không thuộc phạm vi hiện tại:

- Tự động hóa CapCut hoặc tạo project CapCut.
- Backend/cloud sync, cộng tác nhiều người hay điều khiển từ xa.
- Tự động nhập mật khẩu Google, vượt CAPTCHA/2FA hoặc né rate limit.
- Gọi endpoint nội bộ/không công khai của Flow.
- Tự động đăng/publish video.

## 2. Quy trình thủ công hiện tại

1. Tạo Episode và chọn Scene Template.
2. Nếu đã có nội dung hoặc kịch bản sẵn, dán vào trường `Nội dung nguồn`; nếu không, chỉ dùng metadata/ghi chú của Episode.
3. Render prompt, copy sang ChatGPT thủ công và yêu cầu trả về JSON Scenes.
4. Import JSON, review/chỉnh sửa/reorder/approve từng Scene; narration/voice-over nằm trực tiếp trong Scene.
5. Mở Google Flow, tạo project tương ứng với tập phim.
6. Với từng Scene, nhập prompt, chọn loại tạo ảnh/video và gắn character reference khi cần.
7. Chờ tạo, xem kết quả và tạo lại nếu chưa đạt.
8. Đổi tên trực tiếp từng asset trong project Flow theo Scene, tải media về máy rồi đưa vào CapCut thủ công.

Các điểm dễ lỗi:

- Prompt được copy thủ công nên có thể nhầm Episode hoặc nhầm scene.
- Không có nguồn dữ liệu duy nhất cho Scene, narration, prompt đã gửi và media đã chọn.
- Nhiều generation chạy gần nhau khiến khó xác định asset thuộc scene nào.
- Retry có thể làm tốn credit hoặc sinh asset trùng nếu lần gửi trước đã thành công nhưng UI chưa phản hồi.
- Tên trên Flow, tên file tải xuống và vị trí file local có thể không đồng nhất.
- Khi app hoặc trình duyệt đóng giữa chừng, trạng thái công việc phải được đối chiếu lại bằng tay.

## 3. Quy trình đích

### 3.1. Chuẩn bị Episode và Scenes

1. Tạo Episode với `title`, `topic`, `slug`, mô tả, ghi chú và thông số mặc định.
2. Mở flow tạo Scenes và chọn một phiên bản Scene Template.
3. Nếu đã có nội dung/kịch bản sẵn, dán vào trường `Nội dung nguồn` tùy chọn. Trường này chỉ là input tạm để render prompt, không tạo `Script` object và không có revision/persistence riêng.
4. Render template bằng biến, tối thiểu có `{{topic}}`, `{{episode_title}}`, `{{notes}}` và `{{source_content}}` tùy chọn.
5. Copy prompt đã render sang ChatGPT thủ công; Phase 1 không tự động hóa ChatGPT web và không bắt buộc LLM API.
6. Paste hoặc chọn file JSON Scenes do ChatGPT trả về. App validate toàn bộ payload và hiển thị preview trước khi import; lỗi không ghi dữ liệu nửa chừng.
7. Review, chỉnh sửa, reorder và approve từng Scene. Mỗi Scene sở hữu trực tiếp `narration`/voice-over và các prompt media; chỉ Scene `approved` mới được dùng để lập asset hoặc đưa vào queue Flow.

### 3.2. Chuẩn bị job Flow

1. Liên kết Episode với một Flow project mới hoặc project có sẵn.
2. Với mỗi scene đã duyệt, khai báo các asset slot cần tạo, ví dụ:
   - `scene-01-01`: video chính của scene 01.
   - `scene-01-02`: ảnh hoặc clip bổ sung thứ hai của scene 01.
3. Mỗi slot giữ loại media, prompt snapshot, model/settings và danh sách character reference.
4. App kiểm tra trước khi xếp hàng: prompt không rỗng, reference tồn tại, tên canonical không trùng, project đã liên kết và tài khoản Flow đang dùng đúng.
5. Người dùng xem tổng số generation dự kiến và xác nhận trước khi công việc dùng credit được gửi.

### 3.3. Tạo, duyệt, đổi tên và tải xuống

Luồng chuẩn cho một asset slot:

```text
Draft -> Queued -> Submitting -> Generating -> Ready for review
  -> Rejected -> Queued as a new attempt
  -> Accepted -> Rename pending -> Renamed & verified
              -> Download pending -> Downloaded & verified
```

Quy tắc vận hành:

- Giai đoạn đầu chỉ chạy một generation tại một thời điểm để giảm rủi ro mapping sai.
- Trước khi submit, app lưu snapshot prompt, reference và trạng thái project.
- Sau khi submit, app phải phát hiện asset mới và gắn nó với đúng `generation_attempt`; không dựa duy nhất vào vị trí tile.
- Khi generation hoàn tất, app dừng ở `Ready for review`. Người dùng chọn `Accept` hoặc `Reject`.
- `Reject` không ghi đè lịch sử. Một attempt mới được tạo với prompt/references mới hoặc giữ nguyên theo lựa chọn của người dùng.
- `Accept` kích hoạt đổi tên trên Flow. Chỉ sau khi đọc lại UI và xác minh đúng tên canonical, app mới cho phép download tự động.
- Sau download, app kiểm tra file tồn tại, kích thước lớn hơn 0, định dạng cơ bản và hash; sau đó mới đánh dấu hoàn tất.

### 3.4. Quy ước đặt tên

Quy ước đề xuất:

```text
scene-{canonicalNo:02}-{slotOrder:02}
```

Trong đó:

- `canonicalNo` là số ổn định được cấp khi tạo Scene; reorder chỉ đổi `displayOrder`, không đổi số này.
- `slotOrder` là thứ tự AssetSlot trong Scene, không phải số lần retry/version.
- Phần mở rộng do loại file quyết định sau khi download, ví dụ `scene-01-01.mp4` hoặc `scene-01-02.png`.
- `attemptNo` và version không nằm trong tên canonical; chúng được quản lý trong database và manifest.

Nếu một asset canonical được tạo lại, candidate cũ vẫn được giữ trong lịch sử. Chỉ một Asset active được đánh dấu `accepted` cho mỗi AssetSlot. Cách xử lý tên candidate/rejected ngay trong Flow cần được chốt sau PoC vì Flow có thể không cho phép hai asset cùng tên hoặc có thể đổi tên qua Agent thay vì một trường nhập trực tiếp.

### 3.5. Pause, resume và retry

- `Pause` ngăn queue bắt đầu bước mới. Nó không giả định có thể hủy generation đã gửi lên Flow.
- Nếu một generation đang chạy khi pause, app theo dõi đến một checkpoint an toàn rồi dừng.
- Khi resume hoặc mở app lại, mọi job từng ở `running` chuyển sang `reconciling`; app đọc lại Flow trước khi quyết định tiếp tục.
- Navigation, đọc trạng thái và download lỗi mạng có thể retry tự động với backoff hữu hạn.
- Submit generation không được retry tự động nếu kết quả gửi là mơ hồ, vì có thể tốn credit hai lần. App phải đối chiếu asset mới hoặc yêu cầu người dùng quyết định.
- Rename phải có bước read-after-write. Nếu không xác minh được, job chuyển sang `waiting_user`, không download tự động.
- CAPTCHA, 2FA, yêu cầu đăng nhập lại, `Unusual Activity`, policy block hoặc hết credit luôn chuyển sang xử lý có người dùng.

### 3.6. Quản lý media và xuất cho CapCut

1. Media tải xuống đi vào thư mục staging của Episode.
2. App tính hash và ghi metadata: scene/slot, attempt, nguồn Flow, prompt snapshot, thời điểm và trạng thái duyệt.
3. Media đã chấp nhận được hiển thị theo thứ tự scene; có thể mở bằng ứng dụng mặc định để kiểm tra.
4. Lệnh Export tạo một snapshot bất biến, không di chuyển/xóa bản gốc.
5. Folder export được sắp xếp bằng tên zero-padded và kèm manifest để truy vết.

Ví dụ:

```text
episode-slug/
  media/
    scene-01-01.mp4
    scene-01-02.png
    scene-02-01.mp4
  manifest.json
  manifest.csv
  scenes.json
  narration.md
```

CapCut vẫn được thao tác thủ công. Export không chỉnh sửa hay tạo file project riêng của CapCut.

## 4. Human-in-the-loop bắt buộc

- Đăng nhập Google, 2FA và CAPTCHA.
- Xác nhận trước bước dùng Flow credits.
- Duyệt hoặc từ chối từng media candidate.
- Xử lý khi mapping asset không chắc chắn.
- Xử lý policy block, rate limit kéo dài hoặc UI Flow thay đổi.
- Duyệt snapshot export trước khi đưa vào CapCut.

## 5. Trạng thái nghiệp vụ chính

| Đối tượng | Trạng thái đề xuất |
| --- | --- |
| Episode | workflow projection `draft`, `scenes_ready`, `producing`, `ready_to_export`; archive từ `archivedAt` |
| Scene | `draft`, `in_review`, `approved`, `needs_changes` |
| Asset slot | `draft`, `ready`, `fulfilled` |
| Asset | lifecycle `candidate`, `accepted`, `rejected`; file integrity derive riêng |
| Job | `queued`, `running`, `retry_wait`, `waiting_user`, `paused`, `succeeded`, `failed`, `cancelled` |
| Generation attempt | `prepared`, `submitted`, `generating`, `ready`, `rejected`, `accepted`, `unknown`, `failed` |

Trạng thái chi tiết của automation không được suy ra chỉ từ giao diện renderer; database là nguồn dữ liệu bền vững, còn Flow là nguồn xác minh cho trạng thái remote.

## 6. Nguyên tắc an toàn dữ liệu

- Autosave nội dung local và dùng transaction khi cập nhật nhiều record liên quan.
- Không lưu mật khẩu Google trong app/database.
- Browser profile dành riêng cho automation; không dùng profile Chrome cá nhân đang mở.
- Không tự động xóa asset trên Flow hoặc file local trong ba Phase đầu.
- Download vào file tạm rồi đổi sang tên đích sau khi kiểm tra thành công.
- Không ghi đè file cùng tên; export mới dùng revision/timestamp của export.
- Log không chứa cookie, token, nội dung auth hoặc ảnh chụp màn hình ngoài trường hợp lỗi đã được người dùng biết.

## 7. Định nghĩa hoàn tất toàn quy trình

Một Episode được coi là `ready_to_export` khi:

- Tất cả scene bắt buộc đã được duyệt.
- Mỗi asset slot bắt buộc có đúng một media version được chấp nhận.
- Tên asset đã được xác minh trong Flow nếu Episode dùng Flow automation.
- File local đã download và vượt kiểm tra integrity.
- Không còn job `running`, `unknown` hoặc `waiting_user`.
- Manifest có thể truy ngược từ file local đến scene, attempt và Flow asset tương ứng.

