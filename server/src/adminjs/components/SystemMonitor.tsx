import React, { useEffect, useState } from 'react';
import { Box, H3, Text, Icon } from '@adminjs/design-system';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SystemMonitor = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      fetch('/bma_ocsc_circular/internal-admin/api/metrics')
        .then(res => res.json())
        .then(resData => {
          // Data comes back ordered by timestamp DESC (newest first).
          // We need it ordered ascending for the chart (left to right).
          const formatted = resData.reverse().map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString('th-TH'),
            cpu: d.cpu_usage_percent,
            ram: d.ram_usage_mb,
            latency: d.db_response_time_ms
          }));
          setData(formatted);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading) return <Box p="xl"><Text>Loading metrics...</Text></Box>;

  return (
    <Box variant="grey" style={{ minHeight: '100vh', padding: '40px' }}>
      <Box style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Box mb="xl" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Icon icon="Activity" size={32} color="primary100" />
          <H3 m={0}>System Health & Monitoring Dashboard</H3>
        </Box>

        <Box style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
          {/* CPU Usage */}
          <Box p="xl" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <H3 mb="lg">CPU Usage (%)</H3>
            <Box style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="cpu" stroke="#6366f1" fill="#e0e7ff" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {/* RAM Usage */}
          <Box p="xl" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <H3 mb="lg">RAM Allocation (MB)</H3>
            <Box style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="ram" stroke="#10b981" fill="#d1fae5" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {/* Database Latency */}
          <Box p="xl" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <H3 mb="lg">Database Response Time (ms)</H3>
            <Box style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="latency" stroke="#f59e0b" fill="#fef3c7" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>

        </Box>
      </Box>
    </Box>
  );
};

export default SystemMonitor;
