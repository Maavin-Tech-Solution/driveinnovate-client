/**
 * Evaluates vehicle state definitions against live device status.
 *
 * @param {object} deviceStatus  - The deviceStatus object from getVehicles (speed, ignition, etc.)
 * @param {Array}  stateDefinitions - StateDefinition rows for this device type, sorted by priority ASC
 * @returns {{ stateName, stateColor, stateIcon } | null}
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

/**
 * Extract a named field value from the deviceStatus payload.
 *
 * deviceStatus shape (from fetchComprehensiveDeviceStatus / fetchFMB125Status):
 *   { status: { ignition, movement, battery, gsmSignal, ... },
 *     gpsData: { latitude, longitude, speed, satellites, ... },
 *     lastUpdate: Date, ... }
 *
 * GPS coordinates and speed live in gpsData, not status — so both must be
 * checked to avoid false "No GPS" or zero-speed readings.
 */
function getFieldValue(deviceStatus, field) {
  if (!deviceStatus) return undefined;
  const s = deviceStatus.status ?? deviceStatus;   // ignition, movement, battery, etc.
  const g = deviceStatus.gpsData ?? {};            // latitude, longitude, speed, satellites

  switch (field) {
    case 'ignition':       return s.ignition ?? s.engineOn ?? null;
    case 'movement':       return s.movement ?? g.movement ?? null;
    case 'speed':          return g.speed ?? s.speed ?? 0;
    case 'battery':        return s.battery ?? s.batteryLevel ?? null;
    case 'gsmSignal':      return s.gsmSignal ?? s.rssi ?? null;
    case 'satellites':     return g.satellites ?? s.satellites ?? s.gpsCount ?? null;
    case 'hasLocation':    return !!((g.latitude || s.latitude) && (g.longitude || s.longitude));
    case 'lastSeenSeconds': {
      const ts = s.lastSeen ?? deviceStatus.lastUpdate ?? null;
      return ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 1000) : null;
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
  return fn(actual, value);
}

function evaluateState(deviceStatus, stateDefinition) {
  const { conditions, conditionLogic, isDefault } = stateDefinition;

  // Default state only matches when nothing else does
  if (isDefault) return false;

  // No conditions → always matches (unless isDefault handles it)
  if (!conditions || conditions.length === 0) return true;

  if (conditionLogic === 'OR') {
    return conditions.some(c => evaluateCondition(deviceStatus, c));
  }
  // AND (default)
  return conditions.every(c => evaluateCondition(deviceStatus, c));
}

/**
 * Returns the first matching state for the given deviceStatus and sorted definitions.
 * Falls back to the isDefault state if no condition match found.
 */
export function getVehicleState(deviceStatus, stateDefinitions) {
  if (!stateDefinitions || stateDefinitions.length === 0) return null;

  // Sort by priority ascending (should already be sorted from API, but be safe)
  const sorted = [...stateDefinitions].sort((a, b) => a.priority - b.priority);

  // Find first non-default match
  const match = sorted.find(s => !s.isDefault && evaluateState(deviceStatus, s));
  if (match) return { stateName: match.stateName, stateColor: match.stateColor, stateIcon: match.stateIcon };

  // Fall back to default state
  const fallback = sorted.find(s => s.isDefault);
  if (fallback) return { stateName: fallback.stateName, stateColor: fallback.stateColor, stateIcon: fallback.stateIcon };

  return null;
}
