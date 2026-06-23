import React, { useState } from 'react';
import { Box, Header, Button, Text } from '@adminjs/design-system';

const Maintenance = () => {
  const [status, setStatus] = useState<string>('');

  const runMigration = async () => {
    setStatus('Running migration...');
    try {
      const res = await fetch('/bma_ocsc_circular/internal-admin/api/migrate', { method: 'POST' });
      const data = await res.json();
      setStatus(data.message || 'Done');
    } catch (e) {
      setStatus('Failed to run migration');
    }
  };

  return (
    <Box variant="grey">
      <Box variant="white" mb="lg">
        <Header>Maintenance & Migrations</Header>
        <Text mb="lg">Use these tools to manually trigger database maintenance operations.</Text>
        <Button variant="primary" onClick={runMigration}>Run Database Migrations</Button>
        {status && <Box mt="lg"><Text>{status}</Text></Box>}
      </Box>
    </Box>
  );
};

export default Maintenance;
