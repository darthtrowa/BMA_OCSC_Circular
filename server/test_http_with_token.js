import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const token = jwt.sign(
  { id: 8, role: 'COORDINATOR' },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

http.get('http://localhost:3000/api/admin/users/by-role?roles=GRP_LEADER', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('DATA:', data);
    setTimeout(() => process.exit(0), 1000);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
