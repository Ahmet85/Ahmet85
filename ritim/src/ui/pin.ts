// Profiller arası isteğe bağlı PIN. Yalnızca özet (SHA-256) saklanır. Bu,
// aynı cihazı paylaşanlar için basit bir kilittir; verileri şifrelemez.
const unlocked = new Set<string>();

export async function hashPin(profileId: string, pin: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ritim:${profileId}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const isUnlocked = (id: string) => {
  if (unlocked.has(id)) return true;
  try {
    return sessionStorage.getItem(`ritim.unlocked.${id}`) === '1';
  } catch {
    return false;
  }
};

export function markUnlocked(id: string) {
  unlocked.add(id);
  try {
    sessionStorage.setItem(`ritim.unlocked.${id}`, '1');
  } catch {
    /* yok say */
  }
}

export async function checkPin(profileId: string, pinHash: string, pin: string) {
  return (await hashPin(profileId, pin)) === pinHash;
}
