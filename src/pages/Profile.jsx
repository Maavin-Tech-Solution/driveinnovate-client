import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getProfile, updateProfile, updatePassword, updateNotifications } from '../services/user.service';
import { useAuth } from '../context/AuthContext';
import { toISTMonthYear } from '../utils/dateFormat';

const Toggle = ({ checked, onChange, label, description }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', background: '#fff', borderRadius: '10px',
    border: '1px solid #e2e8f0', marginBottom: '10px',
  }}>
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{label}</div>
      {description && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{description}</div>}
    </div>
    <div
      onClick={onChange}
      style={{
        width: '48px', height: '26px', borderRadius: '13px', flexShrink: 0, marginLeft: '16px',
        background: checked ? '#2563eb' : '#e2e8f0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '3px',
        left: checked ? '25px' : '3px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </div>
  </div>
);

const inputStyle = {
  width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
  borderRadius: '8px', fontSize: '14px', color: '#1e293b',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const fieldStyle = { marginBottom: '18px' };

const Profile = () => {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notifs, setNotifs] = useState({ emailNotifications: true, smsNotifications: false, marketingNotifications: false });
  const [loading, setLoading] = useState({ profile: false, password: false, notifs: false });
  const [tab, setTab] = useState('info');

  useEffect(() => {
    getProfile()
      .then((res) => {
        const u = res.data;
        setProfile({ name: u.name || '', phone: u.phone || '' });
        setNotifs({
          emailNotifications: u.emailNotifications ?? true,
          smsNotifications: u.smsNotifications ?? false,
          marketingNotifications: u.marketingNotifications ?? false,
        });
      })
      .catch(console.error);
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading((l) => ({ ...l, profile: true }));
    try {
      const res = await updateProfile(profile);
      updateUser(res.data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setLoading((l) => ({ ...l, profile: false }));
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match');
    setLoading((l) => ({ ...l, password: true }));
    try {
      await updatePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password updated successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading((l) => ({ ...l, password: false }));
    }
  };

  const handleNotifSave = async () => {
    setLoading((l) => ({ ...l, notifs: true }));
    try {
      await updateNotifications(notifs);
      toast.success('Notification preferences saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setLoading((l) => ({ ...l, notifs: false }));
    }
  };

  const initials = user?.name?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <div style={{ minHeight: '100%' }}>

      {/* ── Profile Header ── */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#dbeafe', border: '3px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 800, color: '#2563eb', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>{user?.name || 'User'}</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>{user?.email}</div>
          <div style={{ marginTop: '7px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {user?.role || 'user'}
            </span>
            <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
              ● Active
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: '4px', background: '#fff', borderBottom: '1px solid #e2e8f0', paddingLeft: '8px' }}>
        {[
          { key: 'info', icon: '👤', label: 'Personal Info' },
          { key: 'password', icon: '🔒', label: 'Security' },
          { key: 'notifications', icon: '🔔', label: 'Notifications' },
        ].map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              borderBottom: tab === key ? '2px solid #2563eb' : '2px solid transparent',
              background: 'transparent', fontSize: '13px', fontWeight: tab === key ? 700 : 500,
              color: tab === key ? '#2563eb' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Stat Strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
        background: '#e2e8f0', borderRadius: '0 0 12px 12px',
        overflow: 'hidden', marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        {[
          { label: 'Account Status', value: 'Active', color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Role', value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Phone', value: user?.phone || '—', color: '#64748b', bg: '#fff' },
          { label: 'Member Since', value: toISTMonthYear(user?.createdAt), color: '#64748b', bg: '#fff' },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Edit form */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#dbeafe', borderRadius: '8px', padding: '6px 8px', fontSize: '16px' }}>✏️</span>
              Edit Information
            </div>
            <form onSubmit={handleProfileSave}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Full Name</label>
                <input style={inputStyle} type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required placeholder="Your full name" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Email Address</label>
                <input style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }} type="email" value={user?.email || ''} disabled />
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Email address cannot be changed</span>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Phone Number</label>
                <input style={inputStyle} type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+91 9876543210" />
              </div>
              <button
                type="submit"
                disabled={loading.profile}
                style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: loading.profile ? 0.7 : 1 }}
              >
                {loading.profile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Account summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Account Details</div>
              {[
                { label: 'User ID', value: `#${user?.id || '—'}` },
                { label: 'Name', value: user?.name || '—' },
                { label: 'Email', value: user?.email || '—' },
                { label: 'Phone', value: user?.phone || '—' },
                { label: 'Role', value: user?.role || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderRadius: '14px', border: '1px solid #bfdbfe', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>💡 Profile Tip</div>
              <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.6 }}>
                Keep your contact details up to date to receive timely challan alerts and RTO reminders for your fleet.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#fee2e2', borderRadius: '8px', padding: '6px 8px', fontSize: '16px' }}>🔒</span>
              Change Password
            </div>
            <form onSubmit={handlePasswordSave}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Current Password</label>
                <input style={inputStyle} type="password" placeholder="Enter current password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>New Password</label>
                <input style={inputStyle} type="password" placeholder="Minimum 6 characters" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Confirm New Password</label>
                <input style={inputStyle} type="password" placeholder="Re-enter new password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
              </div>
              <button
                type="submit"
                disabled={loading.password}
                style={{ padding: '10px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: loading.password ? 0.7 : 1 }}
              >
                {loading.password ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '✅', title: 'Minimum 6 characters', desc: 'Use at least 6 characters in your password.' },
              { icon: '🔠', title: 'Mix cases & numbers', desc: 'Combine uppercase, lowercase letters, and numbers.' },
              { icon: '🚫', title: 'Avoid obvious passwords', desc: 'Don\'t use "password", "123456", or your name.' },
              { icon: '🔁', title: 'Change periodically', desc: 'Update your password every 3–6 months for better security.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '28px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#fef9c3', borderRadius: '8px', padding: '6px 8px', fontSize: '16px' }}>🔔</span>
              Notification Preferences
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px' }}>
              Choose how and when you want to be notified.
            </p>
            <Toggle
              checked={notifs.emailNotifications}
              onChange={() => setNotifs({ ...notifs, emailNotifications: !notifs.emailNotifications })}
              label="📧 Email Notifications"
              description="Receive alerts, renewal reminders and reports via email"
            />
            <Toggle
              checked={notifs.smsNotifications}
              onChange={() => setNotifs({ ...notifs, smsNotifications: !notifs.smsNotifications })}
              label="📱 SMS Notifications"
              description="Get critical alerts and OTPs via SMS"
            />
            <Toggle
              checked={notifs.marketingNotifications}
              onChange={() => setNotifs({ ...notifs, marketingNotifications: !notifs.marketingNotifications })}
              label="📣 Marketing & Updates"
              description="Product updates, tips and promotional content"
            />
            <button
              onClick={handleNotifSave}
              disabled={loading.notifs}
              style={{ marginTop: '8px', padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: loading.notifs ? 0.7 : 1 }}
            >
              {loading.notifs ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Current Status</div>
              {[
                { label: '📧 Email', value: notifs.emailNotifications },
                { label: '📱 SMS', value: notifs.smsNotifications },
                { label: '📣 Marketing', value: notifs.marketingNotifications },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>{label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: value ? '#dcfce7' : '#fee2e2', color: value ? '#16a34a' : '#dc2626' }}>
                    {value ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef9c3)', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '6px' }}>⚠️ Stay Informed</div>
              <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
                We recommend keeping email notifications enabled to receive important challan and RTO expiry alerts for your fleet vehicles.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
