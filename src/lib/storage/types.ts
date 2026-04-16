/**
 * StorageProvider — abstraction over file storage backends.
 *
 * V1: Supabase Storage
 * Future: S3, Cloudflare R2, local disk, etc.
 *
 * All file references in the database store the `key` (not the URL).
 * URLs are generated on-demand via getSignedUrl().
 */

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface UploadResult {
  key: string;
  url: string;
}

export interface UploadOptions {
  /** MIME type of the file */
  contentType: string;
  /** Maximum file size in bytes. Validated before upload. */
  maxSize?: number;
  /** Allowed MIME types. Validated before upload. */
  allowedTypes?: string[];
}

export interface StorageProvider {
  /**
   * Upload a file to storage.
   * @param file - File buffer or Blob
   * @param path - Storage path (e.g., 'hackathons/{id}/cover.png')
   * @param options - Upload options (content type, validation)
   * @returns The storage key and a public/signed URL
   */
  upload(file: Buffer | Blob, path: string, options: UploadOptions): Promise<UploadResult>;

  /**
   * Generate a signed URL for a stored file.
   * @param key - Storage key returned from upload()
   * @param expiresIn - Expiry in seconds (default: 3600 = 1 hour)
   * @returns Signed URL string
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Delete a file from storage.
   * @param key - Storage key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * List files under a given prefix.
   * @param prefix - Path prefix (e.g., 'hackathons/{id}/')
   * @returns Array of StorageObject metadata
   */
  list(prefix: string): Promise<StorageObject[]>;
}
