import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { addVehicle } from '../services/vehicle.service';

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px', color: '#1e293b',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const fieldStyle = { marginBottom: '18px' };

const AddVehicle = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    vehicleNumber: '',
    chasisNumber: '',
    engineNumber: '',
    imei: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.vehicleNumber) payload.vehicleNumber = payload.vehicleNumber.toUpperCase();
      await addVehicle(payload);
      toast.success('Vehicle registered successfully!');
      navigate('/my-fleet');
    } catch (err) {
      toast.error(err.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => setForm({ vehicleNumber: '', chasisNumber: '', engineNumber: '', imei: '' });

  const filled = Object.values(form).filter(Boolean).length;
  const total = Object.keys(form).length;
  const progress = Math.round((filled / total) * 100);

  return (
    <div style={{ minHeight: '100%' }}>

      {/* ── Hero Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #3b82f6 100%)',
        borderRadius: '16px', padding: '32px', marginBottom: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '160px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', flexShrink: 0,
          }}>
            🚗
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>Register New Vehicle</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', marginTop: '4px' }}>
              Add a vehicle to your fleet — fill in identification and tracker details
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px' }}>
                🔒 Secure Registration
              </span>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px' }}>
                📡 GPS Enabled
              </span>
            </div>
          </div>

          {/* Progress pill */}
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.12)', borderRadius: '14px', padding: '16px 24px', flexShrink: 0 }}>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{progress}%</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>Form Filled</div>
            <div style={{ marginTop: '8px', width: '80px', height: '5px', background: 'rgba(255,255,255,0.25)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: '#22c55e', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

        {/* ── Form Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Section: Vehicle Identification */}
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🪪</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Vehicle Identification</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Registration, chassis & engine details</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 24px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Registration Number <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  name="vehicleNumber"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 600, fontSize: '15px', letterSpacing: '0.05em' }}
                  placeholder="e.g. MH12AB1234"
                  value={form.vehicleNumber}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Enter exactly as printed on the RC book</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Chassis Number</label>
                  <input
                    name="chasisNumber"
                    style={inputStyle}
                    placeholder="e.g. MA3FJEB1S00100001"
                    value={form.chasisNumber}
                    onChange={handleChange}
                  />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Engine Number</label>
                  <input
                    name="engineNumber"
                    style={inputStyle}
                    placeholder="e.g. K10BN1234567"
                    value={form.engineNumber}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Section divider: GPS Tracker */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ background: '#dcfce7', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>📡</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>GPS Tracker</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>IMEI number of the installed tracking device</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>IMEI Number</label>
                <input
                  name="imei"
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '15px', letterSpacing: '0.08em' }}
                  placeholder="15-digit IMEI — e.g. 354651095987601"
                  value={form.imei}
                  onChange={handleChange}
                  maxLength={20}
                />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Dial *#06# on the tracker SIM phone to get the IMEI
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button
                  type="submit"
                  disabled={loading || !form.vehicleNumber}
                  style={{
                    flex: 1, padding: '12px', background: (!form.vehicleNumber || loading) ? '#93c5fd' : '#2563eb',
                    color: '#fff', border: 'none', borderRadius: '10px',
                    fontWeight: 700, fontSize: '14px', cursor: (!form.vehicleNumber || loading) ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? '⏳ Registering...' : '✅ Register Vehicle'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    padding: '12px 20px', background: '#f8fafc', color: '#64748b',
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Field checklist */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              📋 Field Status
            </div>
            {[
              { key: 'vehicleNumber', label: 'Registration Number', required: true },
              { key: 'chasisNumber', label: 'Chassis Number', required: false },
              { key: 'engineNumber', label: 'Engine Number', required: false },
              { key: 'imei', label: 'IMEI Number', required: false },
            ].map(({ key, label, required }) => {
              const done = !!form[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{done ? '✅' : '⬜'}</span>
                    <span style={{ fontSize: '13px', color: done ? '#1e293b' : '#94a3b8', fontWeight: done ? 600 : 400 }}>{label}</span>
                  </div>
                  {required && !done && (
                    <span style={{ fontSize: '10px', background: '#fee2e2', color: '#dc2626', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Required</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
              💡 Where to Find These
            </div>
            {[
              { icon: '🪪', title: 'Reg. Number', desc: 'Front/rear number plate & RC book cover page' },
              { icon: '🔩', title: 'Chassis No.', desc: 'RC book & stamped on the vehicle chassis frame' },
              { icon: '⚙️', title: 'Engine No.', desc: 'RC book & engraved on the engine block' },
              { icon: '📡', title: 'IMEI', desc: 'GPS device label or dial *#06# on tracker phone' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Info banner */}
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '14px', border: '1px solid #bfdbfe', padding: '18px 20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>ℹ️ After Registration</div>
            <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
              The vehicle will appear in <strong>My Fleet</strong> immediately. You can then assign RTO data, check challans, and configure GPS tracker settings from the fleet page.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddVehicle;
