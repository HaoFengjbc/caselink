/** Browser-only identities: bytes stay in File objects; never serialize them into drafts. */
export type MaterialFileState = 'selected' | 'checking' | 'reading' | 'organizing' | 'review' | 'error' | 'cancelled';
export type SelectedMaterial = { id: string; file: File; state: MaterialFileState; pageCount?: number; message?: string; processed?: boolean };
export const MAX_CLIENT_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_CLIENT_BODY_BYTES = 4_000_000;
export const MAX_CLIENT_FILES = 3;
/** Leave bounded space for metadata and multipart framing; final exact size is checked before fetch. */
export function selectionError(files: Array<{size: number; name: string}>, existingCount = 0): 'count' | 'size' | 'total' | 'type' | null {
  if (files.length + existingCount > MAX_CLIENT_FILES) return 'count';
  if (files.some(file => !file.name.toLowerCase().endsWith('.pdf'))) return 'type';
  if (files.some(file => file.size > MAX_CLIENT_FILE_BYTES || file.size === 0)) return 'size';
  if (files.reduce((sum, file) => sum + file.size, 0) > 3_900_000) return 'total';
  return null;
}
export function setFileStage(files: SelectedMaterial[], ids: string[], state: MaterialFileState): SelectedMaterial[] {
  return files.map(file => ids.includes(file.id) ? {...file, state, message: undefined} : file);
}
/** Changes invalidate an in-flight result even if fetch has already finished before AbortSignal fires. */
export function currentMaterialResponse(captured: string, active: string | null, requestedIds: string[], files: Array<{id:string}>): boolean {
  return active === captured && requestedIds.every(id => files.some(file => file.id === id));
}
