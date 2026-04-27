/**
 * Per-vehicle ring buffer of recent GPS packets, used by the smooth-marker
 * animator on the map view. The animator reads `displayTime = now - LAG`
 * and linearly interpolates between two surrounding buffered packets, so the
 * marker is always moving toward a *known* future position rather than
 * extrapolating past the latest packet.
 *
 * Push from the live-poll handler. Read from the requestAnimationFrame loop.
 */

const BUFFER_SIZE = 10;          // last 10 packets (50 s at 5 s polling)
export const DISPLAY_LAG_MS = 25_000;  // 25 s — see plan; trades latency for smoothness
export const RUNNING_SPEED_KMPH = 5;   // ≥ this on last 2 packets ⇒ "moving"
export const STATIONARY_DRIFT_M = 8;   // ignore sub-jitter when not moving

const buffers = new Map();       // vehicleId -> Array<Sample>

/** Push one packet's position into the vehicle's buffer. */
export function pushPosition(vehicleId, sample) {
  if (sample == null || sample.lat == null || sample.lng == null) return;
  let buf = buffers.get(vehicleId);
  if (!buf) { buf = []; buffers.set(vehicleId, buf); }

  const t = Number(sample.packetTime) || Date.now();
  // De-dup: same packet time = same packet, ignore
  if (buf.length && buf[buf.length - 1].packetTime === t) return;

  buf.push({
    packetTime: t,
    lat:   Number(sample.lat),
    lng:   Number(sample.lng),
    speed: Number(sample.speed) || 0,
  });
  if (buf.length > BUFFER_SIZE) buf.shift();
}

/** Drop everything (used when switching client / on logout). */
export function clearBuffers() { buffers.clear(); }

/** Drop a single vehicle's buffer (e.g. when removed from the fleet). */
export function clearBuffer(vehicleId) { buffers.delete(vehicleId); }

/**
 * Lerp between the two buffered samples surrounding `displayTime`.
 *   - If buffer has < 2 samples → returns the latest (no animation possible).
 *   - If displayTime < oldest → returns oldest sample.
 *   - If displayTime ≥ newest → returns newest sample (we caught up; happens
 *     when the device stops sending packets).
 *
 * Returns { lat, lng, animating } or null if no data at all.
 */
export function getInterpolated(vehicleId, displayTime) {
  const buf = buffers.get(vehicleId);
  if (!buf || buf.length === 0) return null;
  if (buf.length === 1) {
    return { lat: buf[0].lat, lng: buf[0].lng, animating: false };
  }

  // Before the buffer's earliest packet — display the earliest.
  if (displayTime <= buf[0].packetTime) {
    return { lat: buf[0].lat, lng: buf[0].lng, animating: false };
  }

  // Past the latest — display the latest (no future data to lerp toward).
  const last = buf[buf.length - 1];
  if (displayTime >= last.packetTime) {
    return { lat: last.lat, lng: last.lng, animating: false };
  }

  // Find the pair (i, i+1) whose times bracket displayTime.
  for (let i = 0; i < buf.length - 1; i++) {
    const a = buf[i], b = buf[i + 1];
    if (a.packetTime <= displayTime && displayTime < b.packetTime) {
      const span = b.packetTime - a.packetTime;
      const progress = span > 0 ? (displayTime - a.packetTime) / span : 0;
      return {
        lat: a.lat + (b.lat - a.lat) * progress,
        lng: a.lng + (b.lng - a.lng) * progress,
        animating: true,
      };
    }
  }
  // Shouldn't fall through, but be safe.
  return { lat: last.lat, lng: last.lng, animating: false };
}

/**
 * "Is this vehicle moving fast enough to bother animating?"
 * Look at the last 2 buffered packets — both must have speed ≥ threshold.
 * Two packets in a row avoids flapping when GPS speed momentarily drops.
 */
export function isMoving(vehicleId) {
  const buf = buffers.get(vehicleId);
  if (!buf || buf.length < 2) return false;
  const a = buf[buf.length - 2], b = buf[buf.length - 1];
  return (a.speed >= RUNNING_SPEED_KMPH) && (b.speed >= RUNNING_SPEED_KMPH);
}

/** Latest buffered position (for cold start / non-moving snap). */
export function getLatest(vehicleId) {
  const buf = buffers.get(vehicleId);
  if (!buf || buf.length === 0) return null;
  return buf[buf.length - 1];
}
