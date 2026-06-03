import React, { useEffect, useState } from 'react';
import { Box, H3, Text, Icon, Button, Input, Table, TableHead, TableRow, TableCell, TableBody } from '@adminjs/design-system';

const AuditViewer = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchLogs = (p = 1, q = search) => {
    setLoading(true);
    fetch(`/internal-admin/api/audit-logs?page=${p}&limit=${limit}&search=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, search);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Box variant="grey" p="xl" style={{ minHeight: '100vh' }}>
      <Box style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Box mb="xl" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Icon icon="Shield" size={32} color="primary100" />
          <H3 m={0}>Audit Logs</H3>
        </Box>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <Input 
            placeholder="Search action, resource, or username..." 
            value={search} 
            onChange={(e: any) => setSearch(e.target.value)}
            style={{ width: '300px' }}
          />
          <Button variant="contained" type="submit">Search</Button>
        </form>

        <Box style={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Target ID</TableCell>
                <TableCell>IP / Agent</TableCell>
                <TableCell>Payload Preview</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7}><Text textAlign="center">Loading...</Text></TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={7}><Text textAlign="center">No logs found.</Text></TableCell></TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                    <TableCell>{log.user_name || 'System / Unknown'} (ID: {log.user_id})</TableCell>
                    <TableCell>
                      <Box style={{ 
                        background: log.action.includes('DELETE') ? '#fee2e2' : log.action.includes('CREATE') ? '#d1fae5' : '#e0e7ff', 
                        color: log.action.includes('DELETE') ? '#b91c1c' : log.action.includes('CREATE') ? '#047857' : '#4338ca', 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' 
                      }}>
                        {log.action}
                      </Box>
                    </TableCell>
                    <TableCell>{log.target_resource}</TableCell>
                    <TableCell>{log.target_id || '-'}</TableCell>
                    <TableCell>
                      <Text fontSize="12px" color="grey60">{log.ip_address}</Text>
                      <Text fontSize="10px" color="grey40" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.user_agent}>
                        {log.user_agent}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Box style={{ maxWidth: '250px', maxHeight: '100px', overflowY: 'auto', fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {log.payload ? JSON.stringify(log.payload, null, 2) : '-'}
                        </pre>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        <Box mt="xl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>Total: {total} records</Text>
          <Box style={{ display: 'flex', gap: '10px' }}>
            <Button disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>Prev</Button>
            <Text style={{ alignSelf: 'center' }}>Page {page} of {totalPages || 1}</Text>
            <Button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>Next</Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AuditViewer;
