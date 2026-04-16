/**
 * Storage configuration constants.
 * Centralized so validation rules are consistent between client and server.
 */

export const STORAGE_CONSTANTS = {
  /** Allowed MIME types for image uploads (Phase 2: cover images + prize images) */
  ALLOWED_IMAGE_TYPES: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ] as const,

  /** Maximum image file size: 5MB */
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,

  /** Cover image aspect ratio (width / height) */
  COVER_IMAGE_ASPECT_RATIO: 16 / 9,

  /** Storage path builders */
  paths: {
    coverImage: (hackathonId: string, ext: string) =>
      `hackathons/${hackathonId}/cover.${ext}`,
    prizeImage: (hackathonId: string, prizeId: string, ext: string) =>
      `hackathons/${hackathonId}/prizes/${prizeId}.${ext}`,
  },
} as const;
