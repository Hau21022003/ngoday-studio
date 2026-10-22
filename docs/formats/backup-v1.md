# Định dạng metadata backup v1

Backup là JSON có envelope:

```json
{
  "format": "ngoday-backup",
  "schemaVersion": 1,
  "exportedAt": "UTC ISO-8601 timestamp",
  "tables": {}
}
```

`tables` chứa dữ liệu Phase 1 theo schema đã validate:

- `episodes`
- `prompt_templates`, `prompt_template_versions`
- `scripts`, `script_revisions`, `scenes`
- `character_references`
- `asset_slots`, `asset_slot_references`

Không bao gồm:

- credential, cookie, token hoặc browser profile;
- dữ liệu `.runtime` của PoC;
- binary character reference;
- Flow asset, generation attempt hoặc media.

Export ghi vào file `.part` rồi rename sau khi serialize thành công và không ghi đè file đã tồn tại. Restore chỉ chấp nhận database trống, validate toàn bộ envelope trước khi ghi và chạy trong một transaction. Path reference không tồn tại hoặc có hash/size thay đổi được đánh dấu `missing` sau restore.
