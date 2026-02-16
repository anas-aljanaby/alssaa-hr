import { supabase } from '../supabase';

const BUCKET = 'request-attachments';

/**
 * Upload a file to the request-attachments bucket under the user's folder.
 * Returns the storage path (not a full URL) to store in `leave_requests.attachment_url`.
 */
export async function uploadAttachment(
  userId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const path = `${userId}/${uniqueName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Get a short-lived signed URL so the file can be viewed / downloaded.
 * Expires in 1 hour by default.
 */
export async function getAttachmentUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Delete a previously uploaded attachment by its storage path.
 */
export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
