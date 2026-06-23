import React, { useState, useEffect } from 'react';
import { Box, Header, Text, Button } from '@adminjs/design-system';

const LogViewer = () => {
  const [logs, setLogs] = useState<string>('Loading logs...');

  const fetchLogs = async () => {
    try {
      const res = await fetch('/bma_ocsc_circular/internal-admin/api/logs');
      const data = await res.json();
      setLogs(data.logs);
    } catch (e) {
      setLogs('Error loading logs');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Box variant="grey">
      <Box variant="white" flex flexDirection="row" justifyContent="space-between" mb="lg">
        <Header>System Logs (PM2)</Header>
        <Button onClick={fetchLogs}>Refresh</Button>
      </Box>
      <Box style={{ background: '#111', color: '#0f0', padding: '1rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '600px', overflowY: 'auto' }}>
        <Text>{logs}</Text>
      </Box>
    </Box>
  );
};

export default LogViewer;
