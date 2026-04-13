import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  getSpeedViolationReport,
  getVehicleViolationSummary,
  acknowledgeViolation,
  exportSpeedViolations,
  analyzeSpeedViolations,
  getTripReport,
  analyzeTrips,
  exportTrips,
  getStopReport,
  analyzeStops,
  exportStops,
  getEngineHoursReport
} from '../services/report.service.jsx';
import {
  getVehicles,
  getVehicleReportSummary, getVehicleReportDaily,
  getVehicleReportEngineHours, getVehicleReportTrips,
  getVehicleReportFuelFillings, exportVehicleReportExcel,
  reprocessVehicleDataBg, getReprocessStatus,
} from '../services/vehicle.service.jsx';
import { getSettings } from '../services/settings.service.jsx';
import { toISTString } from '../utils/dateFormat';
import './Reports.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDuration = (sec) => {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const fmtDT = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const PAGE = 20;

const Reports = () => {
  const [activeTab, setActiveTab] = useState('speed-violations');
  const [vehicles, setVehicles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Speed Violations State
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);
  
  // Trips State
  const [trips, setTrips] = useState([]);
  const [tripStats, setTripStats] = useState(null);
  
  // Stops State
  const [stops, setStops] = useState([]);
  const [stopStats, setStopStats] = useState(null);
  
  // Engine Hours State
  const [engineHours, setEngineHours] = useState([]);

  // ── Vehicle-specific reports (new) ──────────────────────────────────────────
  const [vr, setVr] = useState({
    vehicleId: '',
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    to:   new Date().toISOString().slice(0, 16),
    tab:  'summary',
    data: null,
    loading: false,
    page: 0,
    bgRunning: false,
  });

  // Common Filters
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    vehicleIds: [],
    severity: '',
    acknowledged: '',
    stopType: ''
  });

  useEffect(() => {
    fetchVehicles();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'speed-violations') {
      fetchSpeedViolationReport();
      fetchVehicleSummary();
    } else if (activeTab === 'trip-reports') {
      fetchTripReport();
    } else if (activeTab === 'stops-parking') {
      fetchStopReport();
    } else if (activeTab === 'engine-hours') {
      fetchEngineHoursReport();
    }
  }, [activeTab]);

  const fetchVehicles = async () => {
    try {
      const response = await getVehicles();
      setVehicles(response.data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    }
  };

  // ── Vehicle-report helpers ───────────────────────────────────────────────────
  const loadVehicleReport = async (overrides = {}) => {
    const state = { ...vr, ...overrides };
    if (!state.vehicleId) return toast.error('Select a vehicle first');
    setVr(p => ({ ...p, ...overrides, loading: true, data: null }));
    try {
      const off = (state.page || 0) * PAGE;
      let res;
      if (state.tab === 'summary')      res = await getVehicleReportSummary(state.vehicleId, state.from, state.to);
      else if (state.tab === 'daily')   res = await getVehicleReportDaily(state.vehicleId, state.from, state.to);
      else if (state.tab === 'trips')   res = await getVehicleReportTrips(state.vehicleId, state.from, state.to, PAGE, off);
      else if (state.tab === 'engine')  res = await getVehicleReportEngineHours(state.vehicleId, state.from, state.to, PAGE, off);
      else if (state.tab === 'fuel')    res = await getVehicleReportFuelFillings(state.vehicleId, state.from, state.to);
      setVr(p => ({ ...p, loading: false, data: res?.data?.data ?? res?.data ?? null }));
    } catch { toast.error('Failed to load report'); setVr(p => ({ ...p, loading: false })); }
  };

  const startBgReprocess = async () => {
    if (!vr.vehicleId) return;
    setVr(p => ({ ...p, bgRunning: true }));
    try {
      await reprocessVehicleDataBg(vr.vehicleId, vr.from, vr.to);
      const poll = setInterval(async () => {
        try {
          const r = await getReprocessStatus(vr.vehicleId, vr.from, vr.to);
          const job = r?.data?.data || r?.data;
          if (job?.status === 'done') {
            clearInterval(poll);
            setVr(p => ({ ...p, bgRunning: false }));
            toast.success('Reprocess complete — reloading…');
            loadVehicleReport();
          } else if (job?.status === 'error' || job?.status === 'idle') {
            clearInterval(poll); setVr(p => ({ ...p, bgRunning: false }));
          }
        } catch { clearInterval(poll); setVr(p => ({ ...p, bgRunning: false })); }
      }, 3000);
    } catch { setVr(p => ({ ...p, bgRunning: false })); }
  };

  const exportVehicleExcel = async () => {
    if (!vr.vehicleId) return;
    try {
      const blob = await exportVehicleReportExcel(vr.vehicleId, vr.from, vr.to);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `report_${vr.vehicleId}_${vr.from.slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const fetchSettings = async () => {
    try {
      const response = await getSettings();
      const data = response.success && response.data ? response.data : response;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use default if settings fail to load
      setSettings({ speedThreshold: 80 });
    }
  };

  const fetchSpeedViolationReport = async () => {
    setLoading(true);
    try {
      const response = await getSpeedViolationReport(filters);
      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      setViolations(data.violations || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching speed violations:', error);
      toast.error('Failed to load speed violations report');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleSummary = async () => {
    try {
      const response = await getVehicleViolationSummary({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      setSummary(data || []);
    } catch (error) {
      console.error('Error fetching vehicle summary:', error);
    }
  };

  const handleAnalyzeViolations = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error('Please select date range');
      return;
    }

    setLoading(true);
    try {
      // Get all vehicle IDs if none are specifically selected
      const vehicleIdsToAnalyze = filters.vehicleIds.length > 0 
        ? filters.vehicleIds 
        : vehicles.map(v => v.id);

      // Use speed threshold from settings or default to 80
      const speedThreshold = settings?.speedThreshold || 80;

      const response = await analyzeSpeedViolations({
        vehicleIds: vehicleIdsToAnalyze,
        startDate: filters.startDate,
        endDate: filters.endDate,
        speedLimit: speedThreshold,
        minDuration: 3,
        autoSave: true
      });

      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      toast.success(`Detected ${data.count || 0} violations, saved ${data.saved || 0} new records`);
      fetchSpeedViolationReport();
      fetchVehicleSummary();
    } catch (error) {
      console.error('Error analyzing violations:', error);
      toast.error('Failed to analyze speed violations');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (violationId) => {
    try {
      await acknowledgeViolation(violationId, 'Reviewed and acknowledged');
      toast.success('Violation acknowledged');
      fetchSpeedViolationReport();
    } catch (error) {
      console.error('Error acknowledging violation:', error);
      toast.error('Failed to acknowledge violation');
    }
  };

  const handleExport = () => {
    exportSpeedViolations(filters);
    toast.success('Exporting report...');
  };

  // Trip Report Functions
  const fetchTripReport = async () => {
    setLoading(true);
    try {
      const response = await getTripReport(filters);
      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      setTrips(data.trips || []);
      setTripStats(data.stats);
    } catch (error) {
      console.error('Error fetching trip report:', error);
      toast.error('Failed to load trip report');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeTrips = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error('Please select date range');
      return;
    }

    setLoading(true);
    try {
      const response = await analyzeTrips({
        vehicleIds: filters.vehicleIds.length > 0 ? filters.vehicleIds : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        minTripDuration: 60,
        minDistance: 0.1,
        autoSave: true
      });

      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      toast.success(`Detected ${data.count || 0} trips, saved ${data.saved || 0} new records`);
      fetchTripReport();
    } catch (error) {
      console.error('Error analyzing trips:', error);
      toast.error('Failed to analyze trips');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTrips = () => {
    exportTrips(filters);
    toast.success('Exporting trip report...');
  };

  // Stop Report Functions
  const fetchStopReport = async () => {
    setLoading(true);
    try {
      const response = await getStopReport(filters);
      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      setStops(data.stops || []);
      setStopStats(data.stats);
    } catch (error) {
      console.error('Error fetching stop report:', error);
      toast.error('Failed to load stop report');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeStops = async () => {
    if (!filters.startDate || !filters.endDate) {
      toast.error('Please select date range');
      return;
    }

    setLoading(true);
    try {
      const response = await analyzeStops({
        vehicleIds: filters.vehicleIds.length > 0 ? filters.vehicleIds : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        minStopDuration: 300,
        autoSave: true
      });

      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      toast.success(`Detected ${data.count || 0} stops, saved ${data.saved || 0} new records`);
      fetchStopReport();
    } catch (error) {
      console.error('Error analyzing stops:', error);
      toast.error('Failed to analyze stops');
    } finally {
      setLoading(false);
    }
  };

  const handleExportStops = () => {
    exportStops(filters);
    toast.success('Exporting stop report...');
  };

  // Engine Hours Report Functions
  const fetchEngineHoursReport = async () => {
    setLoading(true);
    try {
      const response = await getEngineHoursReport(filters);
      // Handle wrapped response
      const data = response.success && response.data ? response.data : response;
      setEngineHours(data.engineHours || data || []);
    } catch (error) {
      console.error('Error fetching engine hours report:', error);
      toast.error('Failed to load engine hours report');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#dc2626';
      case 'HIGH': return '#ea580c';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const getSeverityBadge = (severity) => {
    const color = getSeverityColor(severity);
    return (
      <span style={{
        background: `${color}20`,
        color: color,
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        border: `1px solid ${color}40`
      }}>
        {severity}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">📊 Reports & Analytics</h2>
          <p className="page-subtitle">Comprehensive fleet performance and violation reports</p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="card" style={{ marginBottom: '20px', padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0' }}>
          <button
            onClick={() => setActiveTab('speed-violations')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'speed-violations' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'speed-violations' ? '#fff' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'speed-violations' ? '3px solid #667eea' : 'none'
            }}
          >
            🚨 Speed Violations
          </button>
          <button
            onClick={() => setActiveTab('trip-reports')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'trip-reports' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'trip-reports' ? '#fff' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'trip-reports' ? '3px solid #667eea' : 'none'
            }}
          >
            🗺️ Trip Reports
          </button>
          <button
            onClick={() => setActiveTab('stops-parking')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'stops-parking' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'stops-parking' ? '#fff' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'stops-parking' ? '3px solid #667eea' : 'none'
            }}
          >
            🅿️ Stops & Parking
          </button>
          <button
            onClick={() => setActiveTab('engine-hours')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'engine-hours' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent',
              color: activeTab === 'engine-hours' ? '#fff' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'engine-hours' ? '3px solid #667eea' : 'none'
            }}
          >
            ⚙️ Engine Hours
          </button>
          <button
            onClick={() => setActiveTab('vehicle-reports')}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: activeTab === 'vehicle-reports' ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' : 'transparent',
              color: activeTab === 'vehicle-reports' ? '#fff' : '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s',
              borderBottom: activeTab === 'vehicle-reports' ? '3px solid #0ea5e9' : 'none'
            }}
          >
            📋 Vehicle Reports
          </button>
        </div>
      </div>

      {/* Speed Violations Report */}
      {activeTab === 'speed-violations' && (
        <>
          {/* Statistics Cards */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.total}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Violations</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.unacknowledged}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Pending Review</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.bySeverity.critical + stats.bySeverity.high}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Critical + High</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stats.maxSpeed}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Max Speed (km/h)</div>
              </div>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>
              🔍 Filters & Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Severity
                </label>
                <select
                  className="form-control"
                  value={filters.severity}
                  onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Status
                </label>
                <select
                  className="form-control"
                  value={filters.acknowledged}
                  onChange={(e) => setFilters({ ...filters, acknowledged: e.target.value })}
                >
                  <option value="">All Status</option>
                  <option value="false">Pending Review</option>
                  <option value="true">Acknowledged</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={fetchSpeedViolationReport}
                disabled={loading}
              >
                {loading ? '⏳ Loading...' : '🔍 Search'}
              </button>
              <button
                className="btn btn-outline"
                onClick={handleAnalyzeViolations}
                disabled={loading}
              >
                🔄 Detect New Violations
              </button>
              <button
                className="btn btn-outline"
                onClick={handleExport}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Vehicle Summary */}
          {summary.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>
                🚗 Top Violators
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {summary.slice(0, 6).map((item, index) => {
                  // Handle both Sequelize dataValues and plain objects
                  const data = item.dataValues || item;
                  return (
                    <div
                      key={item.vehicleId || index}
                      style={{
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '2px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 700, color: '#1e3a5f' }}>
                          #{index + 1} {item.vehicle?.vehicleNumber || 'N/A'}
                        </div>
                        <div style={{
                          background: '#dc2626',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '12px'
                        }}>
                          {data.violationCount || 0} violations
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Max Speed: <strong>{parseFloat(data.maxSpeed || 0).toFixed(0)} km/h</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Violations Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e3a5f' }}>
                🚨 Speed Violations ({violations.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <div>Loading violations...</div>
                </div>
              ) : violations.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>✅</div>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>No speed violations found</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Try adjusting your filters or click "Detect New Violations"</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 14px)' }}>
                  <thead>
                    <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)', borderBottom: '2px solid var(--theme-table-border, #e2e8f0)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Date & Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Limit
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Excess
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Severity
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Status
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--theme-table-border, #e2e8f0)', transition: 'background 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-hover-bg').trim() || '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f' }}>
                          {toISTString(v.timestamp)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f', fontWeight: 600 }}>
                          {v.vehicle?.vehicleNumber || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                          {parseFloat(v.speed || 0).toFixed(1)} km/h
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(v.speedLimit || 0).toFixed(1)} km/h
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#ea580c' }}>
                          +{parseFloat(v.excessSpeed || 0).toFixed(1)} km/h
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {v.duration || 0}s
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(v.latitude || 0).toFixed(4)}, {parseFloat(v.longitude || 0).toFixed(4)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getSeverityBadge(v.severity)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {v.acknowledged ? (
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ✓ Acknowledged
                            </span>
                          ) : (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {!v.acknowledged && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleAcknowledge(v.id)}
                              style={{ fontSize: '11px' }}
                            >
                              ✓ Acknowledge
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Trip Reports */}
      {activeTab === 'trip-reports' && (
        <>
          {/* Statistics Cards */}
          {tripStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{tripStats.totalTrips}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Trips</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{parseFloat(tripStats.totalDistance || 0).toFixed(1)} km</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Distance</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{Math.floor(tripStats.totalDuration / 3600)}h {Math.floor((tripStats.totalDuration % 3600) / 60)}m</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Duration</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{parseFloat(tripStats.avgSpeed || 0).toFixed(1)} km/h</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Avg Speed</div>
              </div>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>
              🔍 Filters & Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={fetchTripReport}
                disabled={loading}
              >
                {loading ? '⏳ Loading...' : '🔍 Search'}
              </button>
              <button
                className="btn btn-outline"
                onClick={handleAnalyzeTrips}
                disabled={loading}
              >
                🔄 Analyze New Trips
              </button>
              <button
                className="btn btn-outline"
                onClick={handleExportTrips}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Trips Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e3a5f' }}>
                🗺️ Trip History ({trips.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <div>Loading trips...</div>
                </div>
              ) : trips.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>🗺️</div>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>No trips found</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Try adjusting your filters or click "Analyze New Trips"</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 14px)' }}>
                  <thead>
                    <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)', borderBottom: '2px solid var(--theme-table-border, #e2e8f0)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Start Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        End Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Distance
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Avg Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Max Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Start Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        End Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id} style={{ borderBottom: '1px solid var(--theme-table-border, #e2e8f0)', transition: 'background 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-hover-bg').trim() || '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f' }}>
                          {toISTString(trip.startTime)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f' }}>
                          {toISTString(trip.endTime)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f', fontWeight: 600 }}>
                          {trip.vehicle?.vehicleNumber || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {Math.floor(trip.duration / 3600)}h {Math.floor((trip.duration % 3600) / 60)}m
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                          {parseFloat(trip.distance || 0).toFixed(2)} km
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(trip.avgSpeed || 0).toFixed(1)} km/h
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#dc2626' }}>
                          {parseFloat(trip.maxSpeed || 0).toFixed(1)} km/h
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(trip.startLatitude || 0).toFixed(4)}, {parseFloat(trip.startLongitude || 0).toFixed(4)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(trip.endLatitude || 0).toFixed(4)}, {parseFloat(trip.endLongitude || 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Stops & Parking Report */}
      {activeTab === 'stops-parking' && (
        <>
          {/* Statistics Cards */}
          {stopStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stopStats.totalStops}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Total Stops</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stopStats.byType.PARKING || 0}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Parking</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{stopStats.byType.IDLE || 0}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Idling</div>
              </div>
              <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#fff' }}>{Math.floor(stopStats.avgDuration / 60)}m</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '4px' }}>Avg Duration</div>
              </div>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>
              🔍 Filters & Actions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Stop Type
                </label>
                <select
                  className="form-control"
                  value={filters.stopType}
                  onChange={(e) => setFilters({ ...filters, stopType: e.target.value })}
                >
                  <option value="">All Types</option>
                  <option value="PARKING">Parking</option>
                  <option value="IDLE">Idling</option>
                  <option value="TRAFFIC">Traffic</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={fetchStopReport}
                disabled={loading}
              >
                {loading ? '⏳ Loading...' : '🔍 Search'}
              </button>
              <button
                className="btn btn-outline"
                onClick={handleAnalyzeStops}
                disabled={loading}
              >
                🔄 Analyze New Stops
              </button>
              <button
                className="btn btn-outline"
                onClick={handleExportStops}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Stops Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e3a5f' }}>
                🅿️ Stop & Parking History ({stops.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <div>Loading stops...</div>
                </div>
              ) : stops.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>🅿️</div>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>No stops found</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Try adjusting your filters or click "Analyze New Stops"</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 14px)' }}>
                  <thead>
                    <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)', borderBottom: '2px solid var(--theme-table-border, #e2e8f0)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Start Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        End Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Type
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Engine Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stops.map((stop) => (
                      <tr key={stop.id} style={{ borderBottom: '1px solid var(--theme-table-border, #e2e8f0)', transition: 'background 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-hover-bg').trim() || '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f' }}>
                          {toISTString(stop.startTime)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f' }}>
                          {toISTString(stop.endTime)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f', fontWeight: 600 }}>
                          {stop.vehicle?.vehicleNumber || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {Math.floor(stop.duration / 3600)}h {Math.floor((stop.duration % 3600) / 60)}m
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {parseFloat(stop.latitude || 0).toFixed(4)}, {parseFloat(stop.longitude || 0).toFixed(4)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {stop.stopType === 'PARKING' && (
                            <span style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              🅿️ Parking
                            </span>
                          )}
                          {stop.stopType === 'IDLE' && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              ⏸️ Idling
                            </span>
                          )}
                          {stop.stopType === 'TRAFFIC' && (
                            <span style={{
                              background: '#fee2e2',
                              color: '#991b1b',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600
                            }}>
                              🚦 Traffic
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#64748b' }}>
                          {stop.engineStatus === 'ON' ? '🟢 On' : '🔴 Off'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Engine Hours Report */}
      {activeTab === 'engine-hours' && (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a5f', marginBottom: '16px' }}>
              🔍 Filters
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={fetchEngineHoursReport}
              disabled={loading}
            >
              {loading ? '⏳ Loading...' : '🔍 Generate Report'}
            </button>
          </div>

          {/* Engine Hours Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e3a5f' }}>
                ⚙️ Engine Hours Summary ({engineHours.length} vehicles)
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <div>Loading engine hours...</div>
                </div>
              ) : engineHours.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚙️</div>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>No engine hours data found</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Make sure you have analyzed trips and stops first</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--theme-table-body-font-size, 14px)' }}>
                  <thead>
                    <tr style={{ background: 'var(--theme-table-header-bg, #f8fafc)', borderBottom: '2px solid var(--theme-table-border, #e2e8f0)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Running Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Idle Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Total Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: 'var(--theme-table-header-font-size, 12px)', fontWeight: 700, color: 'var(--theme-table-header-text, #64748b)', textTransform: 'uppercase', background: 'var(--theme-table-header-bg, #f8fafc)', position: 'sticky', top: 0, zIndex: 1 }}>
                        Idle %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineHours.map((record, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--theme-table-border, #e2e8f0)', transition: 'background 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = getComputedStyle(document.documentElement).getPropertyValue('--theme-table-hover-bg').trim() || '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e3a5f', fontWeight: 600 }}>
                          {record.vehicle?.vehicleNumber || 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#10b981' }}>
                          {parseFloat(record.runningHours || 0).toFixed(2)} h
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                          {parseFloat(record.idleHours || 0).toFixed(2)} h
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#3b82f6' }}>
                          {parseFloat(record.totalHours || 0).toFixed(2)} h
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              flex: 1,
                              height: '8px',
                              background: '#e2e8f0',
                              borderRadius: '4px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${record.idlePercentage}%`,
                                height: '100%',
                                background: record.idlePercentage > 30 ? '#f59e0b' : '#10b981',
                                transition: 'width 0.3s'
                              }}></div>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', minWidth: '45px' }}>
                              {parseFloat(record.idlePercentage || 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
      {/* ── Vehicle Reports ─────────────────────────────────────────────────── */}
      {activeTab === 'vehicle-reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Controls bar */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={lbl}>Vehicle</label>
                <select style={sel} value={vr.vehicleId}
                  onChange={e => setVr(p => ({ ...p, vehicleId: e.target.value, data: null, page: 0 }))}>
                  <option value="">— Select vehicle —</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleName || v.vehicleNumber || `Vehicle #${v.id}`}
                      {v.vehicleName && v.vehicleNumber ? ` (${v.vehicleNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={lbl}>From</label>
                <input type="datetime-local" style={sel} value={vr.from}
                  onChange={e => setVr(p => ({ ...p, from: e.target.value, data: null, page: 0 }))} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={lbl}>To</label>
                <input type="datetime-local" style={sel} value={vr.to}
                  onChange={e => setVr(p => ({ ...p, to: e.target.value, data: null, page: 0 }))} />
              </div>
              <button onClick={() => loadVehicleReport({ page: 0 })} disabled={vr.loading || !vr.vehicleId}
                style={pb('#2563eb', vr.loading || !vr.vehicleId)}>
                {vr.loading ? '⏳ Loading…' : '🔍 Load'}
              </button>
              <button onClick={startBgReprocess} disabled={vr.bgRunning || !vr.vehicleId}
                style={pb('#d97706', vr.bgRunning || !vr.vehicleId)} title="Re-calculate trips & engine sessions from raw packets">
                {vr.bgRunning ? '⏳ Syncing…' : '🔄 Reprocess'}
              </button>
              <button onClick={exportVehicleExcel} disabled={!vr.vehicleId}
                style={pb('#059669', !vr.vehicleId)}>
                📥 Excel
              </button>
            </div>
            {vr.bgRunning && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 12px' }}>
                Background reprocess running — report will auto-reload when complete.
              </div>
            )}

            {/* Sub-tab pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {[
                { id: 'summary', label: '📊 Summary' },
                { id: 'daily',   label: '📅 Daily' },
                { id: 'trips',   label: '🗺️ Trips' },
                { id: 'engine',  label: '⚙️ Engine Hours' },
                { id: 'fuel',    label: '⛽ Fuel Fills' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => { setVr(p => ({ ...p, tab: t.id, data: null, page: 0 })); loadVehicleReport({ tab: t.id, page: 0 }); }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${vr.tab === t.id ? '#2563eb' : '#e2e8f0'}`,
                    background: vr.tab === t.id ? '#eff6ff' : '#fff', color: vr.tab === t.id ? '#1d4ed8' : '#64748b',
                    fontWeight: vr.tab === t.id ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {vr.loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>}
          {!vr.loading && !vr.data && !vr.vehicleId && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              Select a vehicle and click Load to view reports.
            </div>
          )}
          {!vr.loading && !vr.data && vr.vehicleId && (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              Click Load to fetch the report.
            </div>
          )}

          {/* Summary */}
          {!vr.loading && vr.data && vr.tab === 'summary' && (() => {
            const s = vr.data;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Total Distance',  value: `${Number(s.mileage || 0).toFixed(1)} km`,            color: '#2563eb' },
                  { label: 'Engine Hours',    value: s.engineHours || '—',                                  color: '#0891b2' },
                  { label: 'Total Trips',     value: String(s.tripsCount ?? 0),                              color: '#7c3aed' },
                  { label: 'Max Speed',       value: `${Math.round(s.maxSpeedInTrips || 0)} km/h`,          color: '#dc2626' },
                  { label: 'Avg Speed',       value: `${parseFloat(s.avgSpeedInTrips || 0).toFixed(1)} km/h`, color: '#0891b2' },
                  { label: 'Parking Time',    value: s.parkingTime || '—',                                  color: '#475569' },
                  { label: 'Parking Stops',   value: String(s.parkingsCount ?? 0),                          color: '#475569' },
                  { label: 'Fuel Consumed',   value: `${Number(s.consumedByFls || 0).toFixed(1)} L`,        color: '#d97706' },
                  { label: 'Fuel Fills',      value: String(s.totalFillings ?? 0),                          color: '#059669' },
                ].map(c => (
                  <div key={c.label} className="card" style={{ padding: '16px', borderLeft: `4px solid ${c.color}` }}>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Daily */}
          {!vr.loading && vr.data && vr.tab === 'daily' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Date', 'Distance', 'Engine Hrs', 'Fuel (L)', 'km/L', 'Parking'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(vr.data?.rows) ? vr.data.rows : []).map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 600 }}>{row.date}</td>
                      <td style={{ padding: '9px 14px' }}>{Number(row.distance || 0).toFixed(1)} km</td>
                      <td style={{ padding: '9px 14px' }}>{row.engineHours || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>{Number(row.consFls || 0).toFixed(2)}</td>
                      <td style={{ padding: '9px 14px' }}>{row.kmpl ?? '—'}</td>
                      <td style={{ padding: '9px 14px' }}>{row.parkingDuration || '—'} ({row.parkingCount || 0})</td>
                    </tr>
                  ))}
                  {!(vr.data?.rows?.length) && (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Trips */}
          {!vr.loading && vr.data && vr.tab === 'trips' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#', 'Start', 'End', 'Distance', 'Duration', 'Avg Speed', 'Idle', 'Fuel'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#64748b', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(vr.data?.rows) ? vr.data.rows : []).map((trip, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '9px 14px', color: '#94a3b8', fontWeight: 600 }}>{trip.no || vr.page * PAGE + i + 1}</td>
                      <td style={{ padding: '9px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDT(trip.beginning)}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>{fmtDT(trip.end)}</td>
                      <td style={{ padding: '9px 14px' }}>{Number(trip.mileage || 0).toFixed(2)} km</td>
                      <td style={{ padding: '9px 14px' }}>{trip.duration || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>{trip.avgSpeed ? `${parseFloat(trip.avgSpeed).toFixed(1)} km/h` : '—'}</td>
                      <td style={{ padding: '9px 14px' }}>{trip.idleTime ? fmtDuration(trip.idleTime) : '—'}</td>
                      <td style={{ padding: '9px 14px' }}>{trip.consFls ? `${Number(trip.consFls).toFixed(2)} L` : '—'}</td>
                    </tr>
                  ))}
                  {!(vr.data?.rows?.length) && (
                    <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No trips found</td></tr>
                  )}
                </tbody>
              </table>
              {(vr.data?.total ?? 0) > PAGE && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '12px 0' }}>
                  <button disabled={vr.page === 0} onClick={() => loadVehicleReport({ page: vr.page - 1 })}
                    style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>← Prev</button>
                  <span style={{ padding: '5px 10px', fontSize: 13, color: '#64748b' }}>Page {vr.page + 1} / {Math.ceil(vr.data.total / PAGE)}</span>
                  <button disabled={(vr.page + 1) * PAGE >= vr.data.total} onClick={() => loadVehicleReport({ page: vr.page + 1 })}
                    style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Next →</button>
                </div>
              )}
            </div>
          )}

          {/* Engine Hours */}
          {!vr.loading && vr.data && vr.tab === 'engine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Array.isArray(vr.data?.rows) ? vr.data.rows : []).map((s, i) => (
                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                    {vr.page * PAGE + i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {fmtDT(s.beginning)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>→ {s.end ? new Date(s.end).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : '—'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>⏱ {s.engineHours || '—'}</span>
                      <span>🛣 {Number(s.mileage || 0).toFixed(1)} km</span>
                      <span>⛽ {Number(s.consFls || 0).toFixed(2)} L</span>
                    </div>
                  </div>
                </div>
              ))}
              {!(vr.data?.rows?.length) && (
                <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>No engine sessions found</div>
              )}
            </div>
          )}

          {/* Fuel Fills */}
          {!vr.loading && vr.data && vr.tab === 'fuel' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Array.isArray(vr.data?.rows) ? vr.data.rows : vr.data || []).map((ev, i) => (
                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⛽</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtDT(ev.time)}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      {ev.fuelBefore}% → {ev.fuelAfter}%
                      <span style={{ color: '#059669', fontWeight: 700, marginLeft: 8 }}>+{ev.filled}% added</span>
                    </div>
                    {ev.location && ev.location !== '—' && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{ev.location}</div>}
                  </div>
                </div>
              ))}
              {!((Array.isArray(vr.data?.rows) ? vr.data.rows : vr.data || []).length) && (
                <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>No fuel fill events found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Shared style helpers (scoped to Reports) ─────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
const sel = { width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none' };
const pb  = (bg, disabled) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: disabled ? '#e5e7eb' : bg, color: disabled ? '#9ca3af' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' });

export default Reports;
