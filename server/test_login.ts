import axios from 'axios';

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:3000/api/admin/auth/login', {
      loginUsername: 'admin',
      loginPassword: 'password', // Try default or standard passwords or we can't test this easily without password.
      login_submit_hidden: 'Save'
    });
    console.log(res.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.log(err.response?.data || err.message);
    } else {
      console.log(err);
    }
  }
}

testLogin();
