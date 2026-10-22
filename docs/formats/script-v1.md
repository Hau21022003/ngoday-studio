# Định dạng script v1

Phase 1 hỗ trợ Markdown thân thiện để paste/chỉnh sửa và JSON để trao đổi chính xác. Import luôn validate toàn bộ trước khi mở transaction; lỗi không thay đổi scene hiện có.

## Markdown

File bắt buộc có marker:

```markdown
<!-- ngoday-script:v1 -->
```

Cấu trúc scene:

```markdown
# Tiêu đề script tùy chọn

## Scene 1: Tên scene bắt buộc

### Summary

Tóm tắt tùy chọn.

### Narration

Lời dẫn tùy chọn.

### Image Prompt

Prompt ảnh tùy chọn.

### Video Prompt

Prompt video tùy chọn.
```

Quy tắc:

- Scene đánh số liên tục từ 1 và thứ tự file là thứ tự import.
- Chỉ bốn section trên được chấp nhận trong v1.
- Mỗi scene phải có title và ít nhất một trường nội dung không rỗng.
- Markdown ngoài section của scene bị từ chối để tránh âm thầm bỏ dữ liệu.

Fixture: `tests/fixtures/script-v1-valid.md`.

## JSON

```json
{
  "schemaVersion": 1,
  "title": "Tiêu đề tùy chọn",
  "scenes": [
    {
      "title": "Opening",
      "summary": "Tóm tắt",
      "narration": "Lời dẫn",
      "imagePrompt": "Prompt ảnh",
      "videoPrompt": "Prompt video"
    }
  ]
}
```

`schemaVersion` phải bằng `1`; `scenes` phải có ít nhất một phần tử. Các trường nội dung bị thiếu được chuẩn hóa thành chuỗi rỗng. Fixture đầy đủ: `tests/fixtures/script-v1-valid.json`.

## Quan hệ với asset slot

Script import chỉ tạo scene và các prompt làm việc ở cấp scene. Asset slot được lập kế hoạch riêng sau import để một scene có thể có số output tự do. Khi tạo slot mới, UI dùng image prompt hiện tại làm giá trị gợi ý ban đầu; người dùng có thể chỉnh prompt riêng của slot.
