/**
 * Single source of truth for the device types a user can pick when registering
 * or editing a vehicle, and the server port each type connects on.
 *
 * The port is derived purely from the device type — the user never picks it
 * manually. GT06-protocol family devices (incl. WeTrack2 / TK103) share the
 * GT06 port; Teltonika FMB units share the Teltonika port; AIS-140 has its own.
 */

// label is what the dropdown shows; value is what gets stored on the vehicle.
export const DEVICE_TYPE_OPTIONS = [
  { value: 'GT06',     label: 'GT06' },
  { value: 'GT06N',    label: 'GT06N' },
  { value: 'FMB125',   label: 'FMB125' },
  { value: 'FMB920',   label: 'FMB920' },
  { value: 'FMB130',   label: 'FMB130' },
  { value: 'AIS140',   label: 'AIS140 (VLTD)' },
  { value: 'WeTrack2', label: 'WeTrack2' },
  { value: 'TK103',    label: 'TK103' },
  { value: 'other',    label: 'Other' },
];

// deviceType → server port. Keep in sync with the listening TCP servers.
export const PORT_BY_TYPE = {
  GT06:     '5023',
  GT06N:    '5023',
  WeTrack2: '5023',
  TK103:    '5023',
  FMB125:   '5024',
  FMB920:   '5024',
  FMB130:   '5024',
  AIS140:   '5025',
};

/** Resolve the port for a device type. Returns '' when unknown (e.g. "other"). */
export const portForDeviceType = (deviceType) => PORT_BY_TYPE[deviceType] || '';

/** A human label describing which protocol family a port belongs to. */
export const PORT_LABELS = {
  '5023': '5023 (GT06)',
  '5024': '5024 (FMB)',
  '5025': '5025 (AIS140)',
};
