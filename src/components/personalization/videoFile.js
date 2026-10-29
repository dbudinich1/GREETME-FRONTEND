// src/components/personalization/videoFile.js — LANE 3: greeting-video file rules (reuses validateFile).
import { validateFile } from "../../utils/helpers.js";

export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export function validateVideoFile(file) {
  if (!file) return { valid: false, error: "Choose a video file." };
  return validateFile(file, { maxSize: VIDEO_MAX_BYTES, allowedTypes: VIDEO_TYPES });
}
