import React, { useEffect, useState } from 'react';
import { getParentContact } from '../../services/user.service';

/**
 * ServiceGate — wraps a page with a subscription-unavailable screen.
 *
 * Usage:
 *   <ServiceGate
 *     enabled={import.meta.env.VITE_RTO_SERVICE_ENABLED !== 'false'}
 *     message={import.meta.env.VITE_RTO_UNAVAILABLE_MSG}
 *     serviceName="RTO Details"
 *     icon="📋"
 *   >
 *     <RtoPage />
 *   </ServiceGate>
 *
 * When `enabled` is false, renders the subscription message + dealer contact
 * instead of the children.  `message` comes from the .env file so ops can
 * update the copy without a code deploy.
 */
const ServiceGate = ({ enabled, message, serviceName, icon = '🔒', children }) => {
  const [contact, setContact]   = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (enabled) return;
    setLoading(true);
    getParentContact()
      .then(res => setContact(res?.data || null))
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  }, [enabled]);

  if (enabled) return children;

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        maxWidth: 560, width: '100%',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)',
      }}>
        {/* Header gradient */}
        <div style={{
          background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
          padding: '32px 36px 28px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', right: -30, top: -30,
            width: 140, height: 140, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>{icon}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            Service Unavailable
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            {serviceName}
          </div>
        </div>

        {/* Message body */}
        <div style={{ padding: '28px 36px' }}>
          <p style={{
            fontSize: 15, lineHeight: 1.7, color: '#374151',
            margin: '0 0 24px', textAlign: 'center', fontWeight: 500,
          }}>
            {message || `You are currently not subscribed for ${serviceName}. Please contact your dealer to subscribe your fleet.`}
          </p>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
              Contact Your Dealer
            </span>
            <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          </div>

          {/* Dealer contact card */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: 13 }}>
              Loading dealer details…
            </div>
          ) : contact ? (
            <div style={{
              background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
              border: '1px solid #BFDBFE',
              borderRadius: 12,
              padding: '20px 24px',
            }}>
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 18, fontWeight: 800, flexShrink: 0,
                  boxShadow: '0 2px 10px rgba(30,64,175,0.30)',
                }}>
                  {(contact.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                    {contact.name || 'Your Dealer'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginTop: 1 }}>
                    Authorized Dealer
                  </div>
                </div>
              </div>

              {/* Contact rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contact.email && (
                  <a href={`mailto:${contact.email}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '9px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                    <span style={{ fontSize: 17 }}>✉️</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Email</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1D4ED8' }}>{contact.email}</div>
                    </div>
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '9px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                    <span style={{ fontSize: 17 }}>📞</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Phone</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>{contact.phone}</div>
                    </div>
                  </a>
                )}
                {!contact.email && !contact.phone && (
                  <div style={{ textAlign: 'center', padding: '12px', fontSize: 13, color: '#94A3B8' }}>
                    Contact details not available. Please reach out through your account manager.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: '#94A3B8' }}>
              Unable to load dealer contact. Please reach out to your account manager.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceGate;
