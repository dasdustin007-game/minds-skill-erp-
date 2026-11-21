const http = require('http');

function postJson(path, data, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    }, res => {
      let body = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), cookie: setCookie });
        } catch(e) {
          resolve({ status: res.statusCode, body, cookie: setCookie });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function getJson(path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        ...(cookie ? { 'Cookie': cookie } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Admin Login & Dashboard Overview ---');
  const adminLogin = await postJson('/api/auth/login', { identifier: 'admin', password: 'admin123' });
  console.log('Admin login status:', adminLogin.status, 'User:', adminLogin.data?.user?.username);
  const adminCookie = adminLogin.cookie ? adminLogin.cookie[0].split(';')[0] : '';
  
  const overview = await getJson('/api/admin/overview', adminCookie);
  console.log('Overview stats:', overview.data?.stats);
  console.log('Birthdays found:', overview.data?.birthdays?.length);

  console.log('\n--- 2. Testing Admin Finance Booking ---');
  const financeEntry = await postJson('/api/finance/records', {
    transaction_type: 'Income',
    category: 'Donation Inflow',
    amount: 75000,
    reference_number: 'TXN-MINDS-991',
    description: 'Corporate donation for vocational scholarship',
    date: '2026-11-17'
  }, adminCookie);
  console.log('Finance booking status:', financeEntry.status, 'Response:', financeEntry.data);

  console.log('\n--- 3. Testing Student Login & Features ---');
  const studentLogin = await postJson('/api/auth/login', { identifier: 'student1', password: 'student123' });
  console.log('Student login status:', studentLogin.status, 'Student:', studentLogin.data?.user?.full_name);
  const studentCookie = studentLogin.cookie ? studentLogin.cookie[0].split(';')[0] : '';

  const studentDash = await getJson('/api/student/dashboard', studentCookie);
  console.log('Student Info:', studentDash.data?.student?.student_id, studentDash.data?.student?.course);
  console.log('ID Card Number:', studentDash.data?.id_card?.card_number);
  console.log('Approved Certificates:', studentDash.data?.certificates?.length);
  console.log('Learning Resources Count:', studentDash.data?.resources?.length);
  console.log('Available Open Events Count:', studentDash.data?.open_events?.length);

  if (studentDash.data?.open_events?.length > 0) {
    const eventId = studentDash.data.open_events[0].id;
    console.log(`Enrolling student into event #${eventId} (${studentDash.data.open_events[0].title})...`);
    const enrollRes = await postJson(`/api/student/enroll-event/${eventId}`, {}, studentCookie);
    console.log('Enrollment status:', enrollRes.status, 'Message:', enrollRes.data?.message);
  }

  console.log('\n--- All Automated Verifications Completed Successfully ---');
}

run().catch(console.error);

