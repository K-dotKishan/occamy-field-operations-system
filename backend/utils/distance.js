/**
 * Haversine distance between two GPS coordinates.
 * Returns distance in kilometres (full float precision).
 *
 * Hardened against:
 *  - String inputs   (explicit Number() coercion)
 *  - null/undefined  (!isFinite check)
 *  - 0,0 default     (common fallback when GPS unavailable)
 *  - Out-of-range    (lat outside ±90, lng outside ±180)
 *  - Float drift     (clamp `a` to [0,1] so sqrt never gets negative)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {

  // 1. Coerce — guards against string inputs like "28.7041"
  const a1 = Number(lat1)
  const o1 = Number(lon1)
  const a2 = Number(lat2)
  const o2 = Number(lon2)

  // 2. Reject NaN / null / undefined
  if (!isFinite(a1) || !isFinite(o1) || !isFinite(a2) || !isFinite(o2)) {
    console.warn("[calculateDistance] Non-finite input:", { lat1, lon1, lat2, lon2 })
    return 0
  }

  // 3. Reject out-of-range coordinates
  if (Math.abs(a1) > 90  || Math.abs(a2) > 90 ||
      Math.abs(o1) > 180 || Math.abs(o2) > 180) {
    console.warn("[calculateDistance] Out-of-range:", { a1, o1, a2, o2 })
    return 0
  }

  // 4. Reject 0,0 — common GPS unavailable fallback, never a real field location
  if ((a1 === 0 && o1 === 0) || (a2 === 0 && o2 === 0)) {
    console.warn("[calculateDistance] 0,0 default location — skipping")
    return 0
  }

  // 5. Same-point shortcut
  if (a1 === a2 && o1 === o2) return 0

  const R      = 6371000  // Earth radius in metres
  const toRad  = (deg) => (deg * Math.PI) / 180

  const dLat   = toRad(a2 - a1)
  const dLon   = toRad(o2 - o1)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)

  const rawA =
    sinDLat * sinDLat +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * sinDLon * sinDLon

  // 6. Clamp rawA to [0,1] — float drift can push it slightly outside,
  //    which makes Math.sqrt(1 - rawA) return NaN
  const clampedA = Math.min(1, Math.max(0, rawA))

  const c              = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA))
  const distanceMetres = R * c

  // 7. Final NaN safety net
  if (!isFinite(distanceMetres)) {
    console.warn("[calculateDistance] Non-finite result — returning 0:", { a1, o1, a2, o2 })
    return 0
  }

  return distanceMetres / 1000  // km
}
