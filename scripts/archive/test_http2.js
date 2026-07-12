import http from 'http';

http.get('http://localhost:3000/api/admin/users/by-role?roles=GRP_LEADER', {
  headers: {
    // We don't have a token, but let's see if we get 401 or if we can bypass.
    // If it requires a token, we might need to login first.
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, '\nDATA:', data));
}).on('error', (err) => {
  console.error('Error:', err.message);
});
