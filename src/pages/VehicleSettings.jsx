import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getSettings, updateSettings, resetSettings } from '../services/settings.service';

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

const VehicleSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [speedRanges, setSpeedRanges] = useState([]);
  const [speedThreshold, setSpeedThreshold] = useState(80);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getSettings();
      
      // Handle response - check if it has the wrapper or is direct data
      let settingsData;
      if (res.data.success && res.data.data) {
        // Wrapped response: { success: true, data: {...} }
        settingsData = res.data.data;
      } else if (res.data.speedRanges !== undefined) {
        // Direct response: { id: 1, speedRanges: [...], ... }
        settingsData = res.data;
      } else {
        throw new Error('Invalid response format');
      }
      
      setSpeedRanges(settingsData.speedRanges || []);
      setSpeedThreshold(settingsData.speedThreshold || 80);
    } catch (error) {
      toast.error('Failed to load settings');
      console.error('Settings fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate ranges
      for (let i = 0; i < speedRanges.length; i++) {
        const range = speedRanges[i];
        if (!range.label || !range.color || range.min === '' || range.max === '') {
          toast.error(`Range ${i + 1}: All fields are required`);
          return;
        }
        if (range.min >= range.max) {
          toast.error(`Range ${i + 1}: Min must be less than Max`);
          return;
        }
      }
      
      const res = await updateSettings({ speedRanges, speedThreshold });
      if (res.data.success) {
        toast.success('Settings saved successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset to default settings?')) return;
    
    try {
      setSaving(true);
      const res = await resetSettings();
      
      // Handle response - check if it has the wrapper or is direct data
      let settingsData;
      if (res.data.success && res.data.data) {
        settingsData = res.data.data;
      } else if (res.data.speedRanges !== undefined) {
        settingsData = res.data;
      } else {
        throw new Error('Invalid response format');
      }
      
      setSpeedRanges(settingsData.speedRanges || []);
      setSpeedThreshold(settingsData.speedThreshold || 80);
      toast.success('Settings reset to defaults');
    } catch (error) {
      toast.error('Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const addRange = () => {
    setSpeedRanges([
      ...speedRanges,
      { min: 0, max: 10, color: '#3b82f6', label: 'New Range' },
    ]);
  };

  const removeRange = (index) => {
    setSpeedRanges(speedRanges.filter((_, i) => i !== index));
  };

  const updateRange = (index, field, value) => {
    const updated = [...speedRanges];
    updated[index][field] = field === 'min' || field === 'max' ? Number(value) : value;
    setSpeedRanges(updated);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <div style={{ marginTop: '16px', color: '#64748b' }}>Loading settings...</div>
      </div>
    );
  }

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
            ⚙️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>Vehicle Settings</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', marginTop: '4px' }}>
              Configure speed ranges, colors, and alert thresholds for all vehicles in your account
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px' }}>
                🎨 Custom Colors
              </span>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px' }}>
                🚨 Speed Alerts
              </span>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '3px 12px', borderRadius: '20px' }}>
                📊 Path Visualization
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: 'grid', gap: '20px' }}>
        
        {/* ── Speed Alert Threshold Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ background: '#fee2e2', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🚨</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Speed Alert Threshold</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Set maximum speed limit for overspeed alerts</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Maximum Speed Limit (km/h)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="number"
                  value={speedThreshold}
                  onChange={(e) => setSpeedThreshold(Number(e.target.value))}
                  style={{ ...inputStyle, width: '140px', fontSize: '16px', fontWeight: 600 }}
                  min="0"
                  max="300"
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>km/h</span>
                <div
                  style={{
                    padding: '6px 14px',
                    background: speedThreshold > 100 ? '#fee2e2' : '#fef3c7',
                    color: speedThreshold > 100 ? '#dc2626' : '#f59e0b',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {speedThreshold > 100 ? '⚠️ High Speed Limit' : '✓ Normal Range'}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'block' }}>
                Vehicles exceeding this speed will show overspeed alerts on dashboard
              </span>
            </div>
          </div>
        </div>

        {/* ── Speed Range Color Coding Card ── */}
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🎨</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Speed Range Color Coding</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Define speed ranges with colors for path visualization</div>
                </div>
              </div>
              <button 
                onClick={addRange}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '14px' }}>➕</span> Add Range
              </button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {speedRanges.map((range, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 110px 80px 40px',
                    gap: '12px',
                    alignItems: 'end',
                    padding: '16px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {/* Label */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Range Label</label>
                    <input
                      type="text"
                      value={range.label}
                      onChange={(e) => updateRange(index, 'label', e.target.value)}
                      style={inputStyle}
                      placeholder="e.g., Normal"
                    />
                  </div>

                  {/* Min Speed */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Min (km/h)</label>
                    <input
                      type="number"
                      value={range.min}
                      onChange={(e) => updateRange(index, 'min', e.target.value)}
                      style={inputStyle}
                      min="0"
                    />
                  </div>

                  {/* Max Speed */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Max (km/h)</label>
                    <input
                      type="number"
                      value={range.max}
                      onChange={(e) => updateRange(index, 'max', e.target.value)}
                      style={inputStyle}
                      min="0"
                    />
                  </div>

                  {/* Color */}
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Color</label>
                    <input
                      type="color"
                      value={range.color}
                      onChange={(e) => updateRange(index, 'color', e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: range.color,
                      }}
                    />
                  </div>

                  {/* Remove Button */}
                  <div style={{ marginBottom: '18px' }}>
                    <button
                      onClick={() => removeRange(index)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        padding: '10px',
                        fontSize: '16px',
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      title="Remove range"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

              {speedRanges.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#94a3b8',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>No speed ranges defined</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "Add Range" to create your first speed range</div>
                </div>
              )}
            </div>

            {/* Preview */}
            {speedRanges.length > 0 && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#f1f5f9', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🎨 Color Preview
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {speedRanges.map((range, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        background: '#fff',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: range.color,
                          border: '2px solid #fff',
                          boxShadow: '0 0 0 1px #e2e8f0',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                        {range.label}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ({range.min}-{range.max} km/h)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleReset} 
            disabled={saving}
            style={{
              background: '#fff',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🔄 Reset to Defaults
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleSettings;
