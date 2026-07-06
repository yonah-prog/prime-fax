const MEDPLUM_BASE = process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com'

export async function validateMedplumToken(authHeader: string): Promise<boolean> {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return false
  try {
    const res = await fetch(`${MEDPLUM_BASE}/auth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
