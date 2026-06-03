import React, { useState, useEffect } from 'react';
import { Box, Header, Text, Badge } from '@adminjs/design-system';

const BotMonitor = () => {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch('/internal-admin/api/bot-status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(() => setStatus({ error: 'Failed to load' }));
  }, []);

  return (
    <Box variant="grey">
      <Box variant="white" mb="lg">
        <Header>Bot & Queue Monitor</Header>
        {!status ? <Text>Loading...</Text> : (
          <Box>
            <Text mb="default">Bot Status: <Badge>{status.status || 'Unknown'}</Badge></Text>
            <Text>Last Run: {status.lastRun || 'N/A'}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BotMonitor;
