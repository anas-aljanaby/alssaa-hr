import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { activeMockSupabase as sb } from '@/test/mocks/active-supabase-mock';

vi.mock('../supabase');

describe('storage.service', () => {
  beforeEach(() => {
    sb.clearQueue();
    vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-0000-0000-00000000abcd' });
    sb.storageBucket.upload.mockResolvedValue({ data: { path: 'x' }, error: null });
    sb.storageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/file' },
      error: null,
    });
    sb.storageBucket.remove.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploadAttachment uploads to request-attachments and returns path', async () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const { uploadAttachment } = await import('./storage.service');
    const path = await uploadAttachment('user-1', file);
    expect(sb.storage.from).toHaveBeenCalledWith('request-attachments');
    expect(path).toMatch(/^user-1\/\d+-00000000\.pdf$/);
    expect(sb.storageBucket.upload).toHaveBeenCalled();
  });

  it('uploadAttachment propagates upload error', async () => {
    sb.storageBucket.upload.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const file = new File(['x'], 'a.bin');
    const { uploadAttachment } = await import('./storage.service');
    await expect(uploadAttachment('u1', file)).rejects.toEqual({ message: 'fail' });
  });

  it('getAttachmentUrl returns signed URL', async () => {
    const { getAttachmentUrl } = await import('./storage.service');
    const url = await getAttachmentUrl('user-1/file.pdf');
    expect(url).toBe('https://signed.example/file');
    expect(sb.storageBucket.createSignedUrl).toHaveBeenCalledWith('user-1/file.pdf', 3600);
  });

  it('deleteAttachment calls remove with path', async () => {
    const { deleteAttachment } = await import('./storage.service');
    await deleteAttachment('p/a');
    expect(sb.storageBucket.remove).toHaveBeenCalledWith(['p/a']);
  });
});
