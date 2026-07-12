import http from 'http';

http.get('http://localhost:5000/api/admin/users/by-role?roles=GRP_LEADER', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (err) => {
  console.error('Error:', err.message);
});
