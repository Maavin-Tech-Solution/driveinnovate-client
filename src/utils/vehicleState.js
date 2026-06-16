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

// A value usable in a numeric comparison (not null/undefined/'' and parses to a
// finite number). Guards against JS coercing null→0, which would make
// `lastSeenSeconds < 600` TRUE for a no-data vehicle (lastSeenSeconds === null)
// and wrongly classify it as "Online".
const isNumeric = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));

const OPERATORS = {
  eq:         (a, b) => a === b,
  neq:        (a, b) => a !== b,
  gt:         (a, b) => isNumeric(a) && isNumeric(b) && Number(a) >  Number(b),
  lt:         (a, b) => isNumeric(a) && isNumeric(b) && Number(a) <  Number(b),
  gte:        (a, b) => isNumeric(a) && isNumeric(b) && Number(a) >= Number(b),
  lte:        (a, b) => isNumeric(a) && isNumeric(b) && Number(a) <= Number(b),
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
    case 'movement': {
      // Physical movement sensor (AIS140). Two guards keep a stationary vehicle
      // from flickering into "Running" via a jittery sensor:
      //  1. Staleness — only trust it if a recent packet confirmed it (≤ 90 s);
      //     a frozen movement=true would otherwise stick a silent vehicle.
      //  2. GPS corroboration — a movement=true with NO GPS-confirmed motion
      //     (zero speed AND runningStreak 0, both of which the server derives
      //     from real displacement) is treated as sensor noise → false.
      const mv = s.movement ?? g.movement ?? null;
      if (mv == null) return null;
      const ts = deviceStatus.lastUpdate;
      if (!ts) return null;
      const staleSecs = secsSince(ts);
      if (staleSecs === null || staleSecs > 90) return null;
      if (mv === true || mv === 1) {
        const spd = Number(g.speed ?? s.speed ?? 0) || 0;
        if (spd <= 5) return false; // stationary by GPS speed → ignore sensor jitter
      }
      return mv;
    }
    case 'speed':       return g.speed ?? s.speed ?? 0;
    case 'battery':     return s.battery ?? s.batteryLevel ?? null;
    case 'gsmSignal':   return s.gsmSignal ?? s.rssi ?? null;
    case 'satellites':  return g.satellites ?? s.satellites ?? s.gpsCount ?? null;
    case 'hasLocation': return !!((g.latitude || s.latitude) && (g.longitude || s.longitude));

    case 'lastSeenSeconds': {
      const ts = deviceStatus.lastUpdate ?? null;
      if (!ts) return null;         // no timestamp yet → can't determine → Offline won't fire
      const secs = secsSince(ts);
      // secsSince returns null for future timestamps (GT06 with wrong timezone).
      // A future lastUpdate means the clock is ahead, so the device IS "live" —
      // returning null means Offline won't fire which is the safest assumption.
      return secs;
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
      // runningStreak is a persistent DB counter. Several guards ensure a parked
      // vehicle can never appear "Running":
      // - 0 stays 0.
      // - CURRENT GPS speed ≤ 5 km/h → 0. This is the ground truth: a vehicle
      //   that isn't moving right now is not running, no matter what the stored
      //   counter says (handles a device that keeps reporting while parked).
      // - No timestamp / future timestamp / age > 90 s → 0 (stale, can't trust).
      const streak = Number(s.runningStreak ?? 0) || 0;
      if (streak === 0) return 0;
      const spd = Number(g.speed ?? s.speed ?? 0) || 0;
      if (spd <= 5) return 0;                         // not moving by GPS → no streak
      const ts = deviceStatus.lastUpdate;
      if (!ts) return 0;                              // no anchor → assume stale
      const staleSecs = secsSince(ts);
      if (staleSecs === null || staleSecs > 90) return 0; // future ts or stale → clear
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
  if (match) return {
    stateName:  match.stateName,
    stateColor: match.stateColor,
    stateIcon:  match.stateIcon,
    // Debug: matched conditions with their live values
    matchedConditions: (match.conditions || []).map(c => ({
      field:    c.field,
      operator: c.operator,
      expected: c.value,
      actual:   getFieldValue(deviceStatus, c.field),
    })),
  };
  const fallback = sorted.find(s => s.isDefault);
  if (fallback) return {
    stateName:  fallback.stateName,
    stateColor: fallback.stateColor,
    stateIcon:  fallback.stateIcon,
    matchedConditions: [],
  };
  return null;
}
