import type { StorageProvider } from './types';
import { SupabaseStorageProvider } from './adapters/supabase-adapter';

let providerInstance: StorageProvider | null = null;

/**
 * Factory function that returns the configured StorageProvider.
 *
 * Currently returns SupabaseStorageProvider.
 * To swap providers, change this factory — no other code changes needed.
 *
 * Uses singleton pattern to avoid creating multiple Supabase clients.
 */
export function getStorageProvider(): StorageProvider {
  if (!providerInstance) {
    providerInstance = new SupabaseStorageProvider();
  }
  return providerInstance;
}

export type { StorageProvider, StorageObject, UploadResult, UploadOptions } from './types';
export { StorageValidationError } from './adapters/supabase-adapter';
