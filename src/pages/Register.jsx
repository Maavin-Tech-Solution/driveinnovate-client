import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { register as registerApi } from '../services/auth.service';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    companyName: '', address: '', state: '', city: '', zip: '', country: '', businessCategory: '', gtin: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
      const res = await registerApi(payload);
      if (res.success) {
        login(res.data.user, res.data.token);
        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151' };
  const sectionLabel = { fontSize: '13px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '20px 0 14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2040 50%, #1e3a5f 100%)',
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#fff',
      }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>🚀</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, margin: 0 }}>DriveInnovate</h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)', marginTop: '12px', textAlign: 'center', maxWidth: '320px' }}>
          Join thousands of fleet managers who trust DriveInnovate.
        </p>
      </div>

      {/* Right panel */}
      <div style={{
        width: '520px',
        flexShrink: 0,
        background: '#fff',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 40px',
        overflowY: 'auto',
        maxHeight: '100vh',
      }}>
        <div style={{ width: '100%' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>Create account</h2>
          <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#64748b' }}>Start managing your fleet today</p>

          <form onSubmit={handleSubmit}>
            {/* --- Account Info --- */}
            <p style={sectionLabel}>Account Info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Full Name *</label>
                <input type="text" name="name" style={inputStyle} placeholder="John Doe" value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Email *</label>
                <input type="email" name="email" style={inputStyle} placeholder="you@example.com" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Phone *</label>
                <input type="tel" name="phone" style={inputStyle} placeholder="+91 9876543210" value={form.phone} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Password *</label>
                <input type="password" name="password" style={inputStyle} placeholder="Min. 6 characters" value={form.password} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Confirm Password *</label>
                <input type="password" name="confirmPassword" style={inputStyle} placeholder="Re-enter password" value={form.confirmPassword} onChange={handleChange} required />
              </div>
            </div>

            {/* --- Business Info --- */}
            <p style={sectionLabel}>Business Info</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Company Name</label>
                <input type="text" name="companyName" style={inputStyle} placeholder="Acme Logistics Pvt. Ltd." value={form.companyName} onChange={handleChange} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Address</label>
                <input type="text" name="address" style={inputStyle} placeholder="123, MG Road" value={form.address} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>City</label>
                <input type="text" name="city" style={inputStyle} placeholder="Mumbai" value={form.city} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>State</label>
                <input type="text" name="state" style={inputStyle} placeholder="Maharashtra" value={form.state} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>ZIP / PIN Code</label>
                <input type="text" name="zip" style={inputStyle} placeholder="400001" value={form.zip} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Country</label>
                <input type="text" name="country" style={inputStyle} placeholder="India" value={form.country} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Business Category</label>
                <input type="text" name="businessCategory" style={inputStyle} placeholder="Transport, Logistics..." value={form.businessCategory} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label style={labelStyle}>GSTIN</label>
                <input type="text" name="gtin" style={inputStyle} placeholder="22AAAAA0000A1Z5" value={form.gtin} onChange={handleChange} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
