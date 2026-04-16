import { createClient } from '@supabase/supabase-js';

import type { StorageProvider, StorageObject, UploadResult, UploadOptions } from '../types';

const BUCKET_NAME = 'hackforge';

/**
 * Supabase Storage implementation of StorageProvider.
 *
 * Uses the Supabase service role key for server-side operations.
 * Files are stored in the 'hackforge' bucket.
 */
export class SupabaseStorageProvider implements StorageProvider {
  private client;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_STORAGE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing SUPABASE_STORAGE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      );
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  async upload(file: Buffer | Blob, path: string, options: UploadOptions): Promise<UploadResult> {
    console.log('[storage] upload:', { path, contentType: options.contentType });

    // Validate file type
    if (options.allowedTypes && !options.allowedTypes.includes(options.contentType)) {
      throw new StorageValidationError(
        `File type '${options.contentType}' is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`
      );
    }

    // Validate file size
    const size = file instanceof Blob ? file.size : file.byteLength;
    if (options.maxSize && size > options.maxSize) {
      const maxMB = (options.maxSize / (1024 * 1024)).toFixed(1);
      throw new StorageValidationError(
        `File size (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (${maxMB}MB)`
      );
    }

    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        contentType: options.contentType,
        upsert: true, // overwrite if exists (e.g., re-uploading cover image)
      });

    if (error) {
      console.error('[storage] upload failed:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const url = await this.getSignedUrl(data.path);
    console.log('[storage] upload success:', { key: data.path });

    return { key: data.path, url };
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .createSignedUrl(key, expiresIn);

    if (error) {
      console.error('[storage] getSignedUrl failed:', { key, error });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async delete(key: string): Promise<void> {
    console.log('[storage] delete:', { key });

    const { error } = await this.client.storage
      .from(BUCKET_NAME)
      .remove([key]);

    if (error) {
      console.error('[storage] delete failed:', { key, error });
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async list(prefix: string): Promise<StorageObject[]> {
    const { data, error } = await this.client.storage
      .from(BUCKET_NAME)
      .list(prefix);

    if (error) {
      console.error('[storage] list failed:', { prefix, error });
      throw new Error(`Storage list failed: ${error.message}`);
    }

    return (data || []).map((item) => ({
      key: `${prefix}/${item.name}`,
      size: item.metadata?.size ?? 0,
      contentType: item.metadata?.mimetype ?? 'application/octet-stream',
      lastModified: new Date(item.updated_at || item.created_at || Date.now()),
    }));
  }
}

/**
 * Typed error for file validation failures (type, size).
 * Consumers can catch this specifically to return 400 vs 500.
 */
export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}
