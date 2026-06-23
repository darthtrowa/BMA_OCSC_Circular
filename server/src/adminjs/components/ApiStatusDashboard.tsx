import React, { useEffect, useState } from 'react';
import { Box, H2, Text, Badge, Icon, Button } from '@adminjs/design-system';

const ApiStatusDashboard = () => {
  const [status, setStatus] = useState({
    dbStatus: 'Loading...',
    env: 'Loading...',
    time: 'Loading...',
    dbHealth: false
  });

  useEffect(() => {
    fetch('/bma_ocsc_circular/internal-admin/api/server-status')
      .then(res => res.json())
      .then(data => {
        setStatus(data);
      })
      .catch(err => {
        setStatus(s => ({ ...s, dbStatus: 'Error', dbHealth: false }));
      });
  }, []);

  return (
    <Box variant="grey" style={{ minHeight: '100vh', padding: '40px' }}>
      <Box 
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          textAlign: 'center'
        }}
      >
        <Box mb="xl">
          <Icon icon="Activity" size={48} color="primary100" />
          <H2 mt="lg">CSC Circular API Status</H2>
          
          <Badge 
            variant={status.dbHealth ? 'success' : 'danger'} 
            size="lg" 
            mt="md"
          >
            {status.dbHealth ? '🟢 API Server Online' : '🔴 API Server Offline'}
          </Badge>
        </Box>

        <Box 
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            textAlign: 'left',
            marginTop: '40px'
          }}
        >
          <Box p="lg" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
            <Text variant="sm" color="grey60">Database Status</Text>
            <Text variant="lg" fontWeight="bold" mt="sm">
              <Icon icon="Database" /> {status.dbStatus}
            </Text>
          </Box>
          <Box p="lg" style={{ background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
            <Text variant="sm" color="grey60">Environment</Text>
            <Text variant="lg" fontWeight="bold" mt="sm">
              <Icon icon="Code" /> {status.env}
            </Text>
          </Box>
          <Box p="lg" style={{ gridColumn: 'span 2', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
            <Text variant="sm" color="grey60">Server Time</Text>
            <Text variant="lg" fontWeight="bold" mt="sm">
              <Icon icon="Clock" /> {status.time}
            </Text>
          </Box>
        </Box>

        <Box style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '40px' }}>
          <Button as="a" href="http://localhost/bma_ocsc_circular" target="_blank" variant="secondary">
            <Icon icon="ExternalLink" /> Public Portal
          </Button>
          <Button as="a" href="/api-docs" target="_blank" variant="primary">
            <Icon icon="BookOpen" /> Swagger API Docs
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ApiStatusDashboard;
