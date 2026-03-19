import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Debug = () => {
  const { user } = useAuth();
  const [imei, setImei] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  // Debug log after every fetch
  React.useEffect(() => {
    console.log('Debug data:', data);
  }, [data]);

  const handleFetch = async (append = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/debug/data-packets?imei=${imei}&deviceType=${deviceType}&limit=20&skip=${append ? skip : 0}`);
      const packets = Array.isArray(res) ? res : [];
      if (append) {
        setData(prev => [...prev, ...packets]);
      } else {
        setData(packets);
      }
      setHasMore(packets.length === 20);
      setSkip(prev => (append ? prev + packets.length : packets.length));
    } catch (err) {
      setData([]);
      setHasMore(false);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Debug Data Packets</h2>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="IMEI"
          value={imei}
          onChange={e => setImei(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <select
          value={deviceType}
          onChange={e => setDeviceType(e.target.value)}
          style={{ marginRight: 8 }}
        >
          <option value="">Select Device Type</option>
          <option value="gt06">GT06</option>
          <option value="fmb125">FMB125</option>
        </select>
        <button onClick={() => { setSkip(0); handleFetch(false); }} disabled={loading || !imei || !deviceType}>
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>IMEI</th>
            <th>Device Type</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(data) && data.map((row, idx) => (
            <tr key={idx}>
              <td>{row.date ? new Date(row.date).toLocaleString() : ''}</td>
              <td>{row.data?.imei || row.imei || imei}</td>
              <td>{row.data?.deviceType || row.deviceType || deviceType}</td>
              <td><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(row.data, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && !loading && data.length > 0 && (
        <button style={{ marginTop: 16 }} onClick={() => handleFetch(true)}>
          Load More
        </button>
      )}
      {loading && <div style={{ marginTop: 16 }}>Loading...</div>}
    </div>
  );
};

export default Debug;
