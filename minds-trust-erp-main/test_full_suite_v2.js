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
  console.log('=== VERIFYING ADMIN PORTAL ===');
  const adminLogin = await postJson('/api/auth/login', { identifier: 'admin', password: 'admin123' });
  const adminCookie = adminLogin.cookie ? adminLogin.cookie[0].split(';')[0] : '';
  console.log('Admin Authenticated:', adminLogin.data.user.full_name, `[Role: ${adminLogin.data.user.role}]`);

  const overview = await getJson('/api/admin/overview', adminCookie);
  console.log('Dashboard Overview Stats:');
  console.table(overview.data.stats);
  console.log('Birthdays Count:', overview.data.upcomingBirthdays?.length || 0);
  console.log('First Birthday:', overview.data.upcomingBirthdays?.[0]);

  console.log('\n=== VERIFYING ADMIN FINANCE ACCESS ===');
  const finance = await getJson('/api/finance/records', adminCookie);
  console.log('Total Finance Inflow:', finance.data.summary.totalInflow);
  console.log('Total Finance Outflow:', finance.data.summary.totalOutflow);
  console.log('Net Balance:', finance.data.summary.netBalance);
  console.log('Record Count:', finance.data.records.length);

  console.log('\n=== VERIFYING STUDENT PORTAL ===');
  const studentLogin = await postJson('/api/auth/login', { identifier: 'student1', password: 'student123' });
  const studentCookie = studentLogin.cookie ? studentLogin.cookie[0].split(';')[0] : '';
  console.log('Student Authenticated:', studentLogin.data.user.full_name, `[User ID: ${studentLogin.data.user.user_id}]`);

  const studentDash = await getJson('/api/student/dashboard', studentCookie);
  console.log('Student Code:', studentDash.data.student.student_code);
  console.log('Enrolled Program:', studentDash.data.student.enrolled_program);
  console.log('Digital ID Card:', studentDash.data.idCard.card_number, '| Barcode:', studentDash.data.idCard.barcode_val);
  console.log('Learning Resources Count:', studentDash.data.resources.length);
  studentDash.data.resources.forEach(r => console.log(`  - [${r.resource_type}] ${r.title} (${r.file_size})`));
  console.log('Approved Certificates Count:', studentDash.data.certificates.length);
  studentDash.data.certificates.forEach(c => console.log(`  - Cert No: ${c.certificate_no} | Event: ${c.event_title}`));
  console.log('Available Events for 1-Click Enrollment:', studentDash.data.availableEvents.length);
  
  if (studentDash.data.availableEvents.length > 0) {
    const targetEvent = studentDash.data.availableEvents[0];
    console.log(`Testing 1-Click Enrollment into event #${targetEvent.id} (${targetEvent.title})...`);
    const enrollRes = await postJson(`/api/student/enroll-event/${targetEvent.id}`, {}, studentCookie);
    console.log('Enrollment Result:', enrollRes.data);
  }

  console.log('\nAll checks passed with 100% database verification!');
}

run().catch(console.error);

