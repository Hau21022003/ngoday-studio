# Google Flow Playwright PoC

PoC CLI nhỏ, chạy headful trên Windows bằng Chrome/Edge đã cài sẵn. Authentication và automation được tách thành hai tiến trình. Đây không phải code ứng dụng chính và không có queue, database hoặc UI riêng.

## Safety contract

- Dùng browser profile riêng tại `%LOCALAPPDATA%\NgodayStudio\GoogleFlowChromeProfile`; không đụng Chrome profile mặc định.
- `npm run auth` mở Chrome thật, không có Playwright hoặc remote debugging. Người dùng tự đăng nhập và xử lý 2FA/CAPTCHA.
- `npm start` tái sử dụng profile bằng Playwright với `chromiumSandbox: true` và không thực hiện login.
- Nếu session hết hạn hoặc không xác minh được Flow app, automation đóng browser và dừng.
- Không lưu password, cookie hoặc token vào log/state.
- Không dùng private API, request interception, stealth hoặc bypass.
- Không có lệnh generate trong bootstrap CLI. Chỉ bổ sung/chạy bước submit sau khi người dùng xác nhận credit trong chat.
- Không tự retry generation.
- Không tự chụp screenshot, trace hay HAR vì chúng có thể chứa dữ liệu account/project.

## Cài đặt

```powershell
cd D:\self_project\ngoday-studio\poc\flow-playwright
npm install
```

PoC dùng `playwright-core` và browser cài sẵn nên không download Chromium riêng.

## Bước 1 — Đăng nhập thủ công

```powershell
npm run auth
```

Trong Chrome vừa mở:

1. Đăng nhập Google thủ công.
2. Xử lý 2FA/CAPTCHA nếu có.
3. Mở được Google Flow.
4. Đóng toàn bộ cửa sổ thuộc profile Video Studio này để giải phóng profile lock.

Không chạy `npm start` cùng lúc với browser authentication.

## Bước 2 — Kiểm tra tái sử dụng session bằng Playwright

Chrome:

```powershell
npm start
```

Edge:

```powershell
$env:FLOW_POC_BROWSER = 'msedge'
npm start
```

Các lệnh an toàn ban đầu:

- `status`: URL/title hiện tại và nhận diện sơ bộ trạng thái đăng nhập.
- `inspect`: liệt kê control đang hiển thị, đã redaction email.
- `create-project [tên-dự-kiến]`: click đúng control `New project`, không generate media; tên chỉ được lưu là requested name, chưa được coi là đã xác minh.
- `set-project-title <tên>`: chỉ sửa project do PoC vừa tạo, reload và chỉ đánh dấu verified khi tên vẫn tồn tại.
- `verify-project`: đọc tiêu đề của đúng project PoC đã ghi.
- `open-saved-project`: mở project PoC từ dashboard bằng exact project URL/href, không dựa vào vị trí card.
- `fill-prompt <nội-dung>`: chỉ điền prompt có prefix `POC_NO_GENERATE:` và tuyệt đối không submit.
- `save-project [tên]`: lưu URL project hiện tại để mở lại.
- `reopen-project`: mở URL project đã lưu.
- `reload`: reload trang hiện tại.
- `goto-flow`: quay lại trang Flow.
- `show-state`: hiển thị state không nhạy cảm đã lưu.
- `quit`: đóng context đúng cách để lưu browser session.

Nếu Flow đổi label hoặc có nhiều control trùng, lệnh sẽ dừng thay vì click đoán.

## Dữ liệu local

```text
.runtime/
  state.json               # project URL/name, không có cookie
  events.ndjson            # bằng chứng PoC đã lọc
downloads/                 # file test khi bước download được kiểm chứng

%LOCALAPPDATA%\NgodayStudio\GoogleFlowChromeProfile\
  # Profile/session riêng; không commit hoặc đưa vào diagnostic bundle
```

Không đánh dấu capability là PASS chỉ dựa trên script tồn tại. Kết quả chỉ được ghi vào `docs/04-flow-poc.md` sau khi thao tác live được quan sát.
