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
import { getVehicles } from '../services/vehicle.service.jsx';
import { getSettings } from '../services/settings.service.jsx';
import { toISTString } from '../utils/dateFormat';
import './Reports.css';

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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Date & Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Limit
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Excess
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Severity
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Status
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Start Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        End Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Distance
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Avg Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Max Speed
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Start Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        End Location
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((trip) => (
                      <tr key={trip.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Start Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        End Time
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Duration
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Location
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Type
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Engine Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stops.map((stop) => (
                      <tr key={stop.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
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
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Vehicle
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Running Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Idle Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Total Hours
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Idle %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineHours.map((record, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
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
    </div>
  );
};

export default Reports;
