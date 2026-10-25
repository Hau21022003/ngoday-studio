import type { ScenesImportDocument } from "./domain"

const scenesJsonV1SampleDocument = {
  schemaVersion: 1,
  scenes: [
    {
      order: 1,
      title: "Mở đầu: Nhịp sống buổi sớm",
      summary: "Giới thiệu không khí yên bình và chủ đề chính của Episode.",
      narration: "Một ngày mới bắt đầu từ những khoảnh khắc rất đỗi quen thuộc.",
      visualDescription: "Ánh nắng sớm chiếu qua cửa sổ, phủ lên căn phòng một lớp sáng vàng dịu.",
      sceneType: "ENVIRONMENT",
      mediaType: "image",
      notes: "Giữ bảng màu ấm và nhịp kể chậm.",
      assetSlots: [
        {
          order: 1,
          mediaType: "image",
          prompt: "Warm morning room, soft sunlight through a window, calm cinematic atmosphere",
          required: true,
        },
        {
          order: 2,
          mediaType: "video",
          prompt: "Slow camera movement across a quiet room at sunrise, subtle natural motion",
          required: false,
        },
      ],
    },
  ],
} satisfies ScenesImportDocument

export const scenesJsonV1Sample = JSON.stringify(scenesJsonV1SampleDocument, null, 2)
