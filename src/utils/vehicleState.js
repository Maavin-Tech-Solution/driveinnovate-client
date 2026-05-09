/**
 * Evaluates vehicle state definitions against live device status.
 *
 * deviceStatus shape (merged from initial load + live poll):
 *   {
 *     status:    { ignition, movement, battery, gsmSignal,
 *                  speedZeroSince, engineOffSince, runningStreak,
 *                  // legacy pre-computed (initial load only):
 *                  speedZeroSeconds, ignitionOffSeconds },
 *     gpsData:   { latitude, longitude, speed, satellites, timestamp },
 *     lastUpdate: <ISO string — real server UTC from VehicleDeviceState.updatedAt>
 *   }
 *
 * Duration fields (speedZeroSeconds, ignitionOffSeconds) are computed
 * dynamically from their timestamp counterparts so they auto-increment with
 * the 30-second stateTick even without a live-poll update.
 */

const OPERATORS = {
  eq:         (a, b) => a === b,
  neq:        (a, b) => a !== b,
  gt:         (a, b) => a > b,
  lt:         (a, b) => a < b,
  gte:        (a, b) => a >= b,
  lte:        (a, b) => a <= b,
  exists:     (a)    => a !== null && a !== undefined,
  notexists:  (a)    => a === null || a === undefined,
};

function secsSince(ts) {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 0) return null; // future timestamp (device clock wrong) — treat as "just seen"
  return Math.floor(ms / 1000);
}

function getFieldValue(deviceStatus, field) {
  if (!deviceStatus) return undefined;
  const s = deviceStatus.status ?? deviceStatus;
  const g = deviceStatus.gpsData ?? {};

  switch (field) {
    case 'ignition':    return s.ignition ?? s.engineOn ?? null;
    case 'movement':    return s.movement ?? g.movement ?? null;
    case 'speed':       return g.speed ?? s.speed ?? 0;
    case 'battery':     return s.battery ?? s.batteryLevel ?? null;
    case 'gsmSignal':   return s.gsmSignal ?? s.rssi ?? null;
    case 'satellites':  return g.satellites ?? s.satellites ?? s.gpsCount ?? null;
    case 'hasLocation': return !!((g.latitude || s.latitude) && (g.longitude || s.longitude));

    case 'lastSeenSeconds': {
      // Use real server updatedAt (set by live poll) — not device lastPacketTime which
      // may be in wrong timezone. Negative means device clock is ahead → treat as "live".
      const ts = deviceStatus.lastUpdate ?? null;
      return secsSince(ts);
    }

    case 'speedZeroSeconds': {
      // Prefer dynamic computation from timestamp (auto-increments with stateTick).
      // Fall back to server-precomputed value from initial load.
      const ts = s.speedZeroSince ?? null;
      if (ts) return secsSince(ts);
      return s.speedZeroSeconds ?? null;
    }

    case 'ignitionOffSeconds': {
      const ts = s.engineOffSince ?? null;
      if (ts) return secsSince(ts);
      return s.ignitionOffSeconds ?? null;
    }

    case 'runningStreak': {
      // runningStreak is a persistent DB counter reset only when a new packet
      // is processed.  Treat it as 0 if no live data has arrived in 90 s so a
      // stale high-streak value doesn't keep a parked vehicle in Running.
      // Use lastUpdate (= lastSeenAt from server when available, else updatedAt).
      const streak = s.runningStreak ?? 0;
      if (streak === 0) return 0;
      const ts = deviceStatus.lastUpdate;
      if (!ts) return streak; // no timestamp at all — trust the DB value
      const staleSecs = secsSince(ts);
      if (staleSecs === null) return streak; // future timestamp (tz issue) — trust DB
      if (staleSecs > 90) return 0;          // genuinely stale — clear it
      return streak;
    }

    default:
      return s[field] ?? g[field] ?? null;
  }
}

function evaluateCondition(deviceStatus, condition) {
  const { field, operator, value } = condition;
  const actual = getFieldValue(deviceStatus, field);
  const fn = OPERATORS[operator];
  if (!fn) return false;
  // Numeric coercion: the DB stores condition values as JSON — they may be
  // strings. JavaScript's comparison operators coerce strings to numbers for
  // numeric comparisons, so "80" > 79 works correctly.
  return fn(actual, value);
}

function evaluateState(deviceStatus, stateDefinition) {
  const { conditions, conditionLogic, isDefault } = stateDefinition;
  if (isDefault) return false;
  if (!conditions || conditions.length === 0) return true;
  if (conditionLogic === 'OR') return conditions.some(c => evaluateCondition(deviceStatus, c));
  return conditions.every(c => evaluateCondition(deviceStatus, c));
}

export function getVehicleState(deviceStatus, stateDefinitions) {
  if (!stateDefinitions || stateDefinitions.length === 0) return null;
  const sorted = [...stateDefinitions].sort((a, b) => a.priority - b.priority);
  const match = sorted.find(s => !s.isDefault && evaluateState(deviceStatus, s));
  if (match) return { stateName: match.stateName, stateColor: match.stateColor, stateIcon: match.stateIcon };
  const fallback = sorted.find(s => s.isDefault);
  if (fallback) return { stateName: fallback.stateName, stateColor: fallback.stateColor, stateIcon: fallback.stateIcon };
  return null;
}
