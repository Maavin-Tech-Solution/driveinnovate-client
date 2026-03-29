import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { createClient } from '../services/user.service';

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const fieldStyle = { marginBottom: '18px' };

const initialForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  address: '',
  state: '',
  city: '',
  zip: '',
  country: '',
  businessCategory: '',
  gtin: '',
};

const AddClient = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const progress = useMemo(() => {
    const required = ['name', 'email', 'phone', 'password', 'confirmPassword'];
    const requiredDone = required.filter((key) => !!form[key]).length;
    const allDone = Object.values(form).filter(Boolean).length;
    return {
      requiredPct: Math.round((requiredDone / required.length) * 100),
      totalPct: Math.round((allDone / Object.keys(form).length) * 100),
    };
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const { confirmPassword, ...payload } = form;
      const res = await createClient(payload);
      if (res.success) {
        toast.success('Client created successfully');
        setForm(initialForm);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🧾</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Account Information</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Basic identity and login details</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ padding: '20px 24px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Full Name *</label>
                <input type="text" name="name" style={inputStyle} placeholder="Client full name" value={form.name} onChange={handleChange} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email *</label>
                  <input type="email" name="email" style={inputStyle} placeholder="client@example.com" value={form.email} onChange={handleChange} required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Phone *</label>
                  <input type="tel" name="phone" style={inputStyle} placeholder="+91 9876543210" value={form.phone} onChange={handleChange} required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Password *</label>
                  <input type="password" name="password" style={inputStyle} placeholder="Minimum 6 characters" value={form.password} onChange={handleChange} required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Confirm Password *</label>
                  <input type="password" name="confirmPassword" style={inputStyle} placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <span style={{ background: '#dcfce7', borderRadius: '8px', padding: '7px 9px', fontSize: '16px' }}>🏢</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Business Information</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Company and address details</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Company Name</label>
                <input type="text" name="companyName" style={inputStyle} placeholder="Acme Logistics Pvt. Ltd." value={form.companyName} onChange={handleChange} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Address</label>
                <input type="text" name="address" style={inputStyle} placeholder="123, MG Road" value={form.address} onChange={handleChange} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>City</label>
                  <input type="text" name="city" style={inputStyle} placeholder="Mumbai" value={form.city} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>State</label>
                  <input type="text" name="state" style={inputStyle} placeholder="Maharashtra" value={form.state} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>ZIP / PIN Code</label>
                  <input type="text" name="zip" style={inputStyle} placeholder="400001" value={form.zip} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Country</label>
                  <input type="text" name="country" style={inputStyle} placeholder="India" value={form.country} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Business Category</label>
                  <input type="text" name="businessCategory" style={inputStyle} placeholder="Transport, Logistics..." value={form.businessCategory} onChange={handleChange} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>GSTIN</label>
                  <input type="text" name="gtin" style={inputStyle} placeholder="22AAAAA0000A1Z5" value={form.gtin} onChange={handleChange} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: loading ? '#93c5fd' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '⏳ Creating client...' : '✅ Create Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(initialForm)}
                  style={{
                    padding: '12px 20px',
                    background: '#f8fafc',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '14px',
              }}
            >
              📋 Completion Status
            </div>
            {[
              { key: 'name', label: 'Client Name', required: true },
              { key: 'email', label: 'Email', required: true },
              { key: 'phone', label: 'Phone', required: true },
              { key: 'password', label: 'Password', required: true },
              { key: 'confirmPassword', label: 'Confirm Password', required: true },
              { key: 'companyName', label: 'Company Name', required: false },
              { key: 'address', label: 'Address', required: false },
              { key: 'businessCategory', label: 'Business Category', required: false },
            ].map(({ key, label, required }) => {
              const done = !!form[key];
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: '1px solid #f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{done ? '✅' : '⬜'}</span>
                    <span style={{ fontSize: '13px', color: done ? '#1e293b' : '#94a3b8', fontWeight: done ? 600 : 400 }}>{label}</span>
                  </div>
                  {required && !done && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontWeight: 600,
                      }}
                    >
                      Required
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 22px' }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '14px',
              }}
            >
              💡 Onboarding Notes
            </div>
            {[
              { icon: '👤', title: 'Client account owner', desc: 'This client is created under your logged-in parent account.' },
              { icon: '🔐', title: 'Login credentials', desc: 'Client can login immediately after this account is created.' },
              { icon: '📊', title: 'Dashboard visibility', desc: 'You can manage this client and their vehicles from your dashboard.' },
              { icon: '✉️', title: 'Use valid email', desc: 'Use an active email to receive OTP and reset-password communication.' },
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

          <div
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              borderRadius: '14px',
              border: '1px solid #bfdbfe',
              padding: '18px 20px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>ℹ️ What happens next?</div>
            <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
              After creation, the client can sign in, add vehicles, and manage compliance data. All records remain linked to your parent account.
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#1d4ed8' }}>Overall form completion: {progress.totalPct}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddClient;
