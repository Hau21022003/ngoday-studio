import { randomUUID } from "node:crypto"

import type { PersistenceFoundation } from "../../src/main/persistence/foundation"

export function seedSceneTemplate(foundation: PersistenceFoundation) {
  return foundation.services.templates.create({
    name: "Scene Template mặc định",
    description: "Template tạo JSON Scenes có cấu trúc cho Episode.",
    purpose: "scene",
    status: "active",
    content: "Tạo scenes cho {{episode_title}}. Nguồn: {{source_content}}",
    variables: [
      {
        id: randomUUID(),
        name: "episode_title",
        label: "Tiêu đề Episode",
        description: "Tiêu đề dùng khi render prompt.",
        type: "text",
        required: true,
        defaultValue: "Episode mới",
        options: [],
      },
      {
        id: randomUUID(),
        name: "source_content",
        label: "Nội dung nguồn",
        description: "Outline tùy chọn.",
        type: "multiline",
        required: false,
        defaultValue: "",
        options: [],
      },
    ],
    changeNote: "Khởi tạo Scene Template.",
    createdByName: "Test",
  })
}

export function seedEpisode(foundation: PersistenceFoundation, title = "Bình yên từ những điều nhỏ bé") {
  return foundation.services.episodes.create({
    title,
    topic: "psychology",
    description: "Episode thử nghiệm cho persistence foundation.",
    notes: "",
    createdByName: "Test",
  })
}

export function sceneJson(title = "Hook") {
  return JSON.stringify({
    schemaVersion: 1,
    scenes: [
      {
        order: 1,
        title,
        narration: "Một lời dẫn đủ nội dung để Scene có thể được duyệt.",
        visualDescription: "Khung cảnh bình minh ấm áp trên một ngôi làng nhỏ.",
        sceneType: "MAIN_CHARACTER",
        mediaType: "image",
      },
    ],
  })
}
