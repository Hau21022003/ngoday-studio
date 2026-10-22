# Ngoday Studio

Ứng dụng desktop local-first để quản lý Episode, prompt template, script, scene và asset planning. Phase 1 không kết nối Google Flow, không gọi LLM API và không tạo media.

## Yêu cầu phát triển

- Windows.
- Node.js 22.22.1 trở lên trong dòng 22, hoặc Node.js 24 trở lên.
- npm 10 trở lên.

## Chạy ứng dụng

```powershell
npm install
npm run dev
```

Database được tạo tại Electron `userData/app.db`. Có thể dùng `NGODAY_USER_DATA_DIR` để tách dữ liệu khi smoke test nội bộ.

## Kiểm tra

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Ứng dụng dùng SQLite tích hợp trong Node/Electron (`node:sqlite`), không cần compiler C++ hoặc native rebuild. Renderer chạy sandboxed với `contextIsolation`, không có Node integration; filesystem và database chỉ được truy cập qua typed IPC use case.

Renderer dùng React + TypeScript, Tailwind CSS v4 và một tập nhỏ shadcn/ui được lưu trực tiếp trong source. Theme giữ palette navy/cam; các form submit dùng React Hook Form với schema Zod hiện có, còn scene autosave vẫn là controlled workflow với debounce 700 ms.

## Phạm vi an toàn

- Không lưu credential, cookie hoặc browser profile.
- Không có Playwright trong ứng dụng Phase 1.
- Không có network call bắt buộc.
- `poc/flow-playwright` là PoC độc lập, không được ứng dụng import hoặc sửa đổi.
- Metadata backup không chứa binary character reference.

Xem [tài liệu triển khai Phase 1](docs/06-phase1-implementation.md) và [định dạng script v1](docs/formats/script-v1.md).
