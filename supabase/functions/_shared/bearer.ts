/** Parse JWT from Authorization (Bearer, bearer, or raw token). */

export function parseBearerToken(req: Request): string | undefined {
  const rawAuthHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const bearerMatch = rawAuthHeader?.match(/^Bearer\s+(.+)$/i);
  const tokenFromBearer = bearerMatch?.[1]?.trim();

  const tokenFromRaw = rawAuthHeader && !bearerMatch ? rawAuthHeader.trim() : undefined;

  return (
    (tokenFromBearer && tokenFromBearer.includes('.') && tokenFromBearer.length > 20
      ? tokenFromBearer
      : undefined) ??
    (tokenFromRaw && tokenFromRaw.includes('.') && tokenFromRaw.length > 20 ? tokenFromRaw : undefined)
  );
}
