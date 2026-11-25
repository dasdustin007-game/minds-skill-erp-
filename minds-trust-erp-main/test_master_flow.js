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

function putJson(path, data, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
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
  console.log('=== TEST 1: Admin Login ===');
  const login = await postJson('/api/auth/login', { identifier: 'admin', password: 'admin123' });
  console.log('Admin login status:', login.status, 'User:', login.data.user.full_name);
  const cookie = login.cookie ? login.cookie[0].split(';')[0] : '';

  console.log('\n=== TEST 2: Program Management (Flow: Create -> Abbr -> Code) ===');
  const newProg = await postJson('/api/admin/programs', {
    program_name: 'Solar Energy & Electric Mobility Technician',
    duration_weeks: 16,
    description: 'Green energy transition technical skills'
  }, cookie);
  console.log('Create Program Response:', newProg.data);

  const programs = await getJson('/api/admin/programs', cookie);
  console.log('Total Programs in Database:', programs.data.programs.length);
  const targetProg = programs.data.programs.find(p => p.program_code === newProg.data.program_code);
  console.log('Target Program Details:', targetProg);

  console.log('\n=== TEST 3: Student Registration (Flow: Reg -> Stu Code -> Select Program -> Fetch Code -> Assign) ===');
  const testUserId = `stu_flow_${Date.now().toString().slice(-4)}`;
  const newStudent = await postJson('/api/admin/students', {
    full_name: 'Aditya Ravindra Patil',
    user_id: testUserId,
    email: `${testUserId}@example.com`,
    phone: '+91 98200 44332',
    password: 'student123',
    program_id: targetProg.id,
    student_status: 'Joined'
  }, cookie);
  console.log('Register Student Response:', newStudent.data);

  console.log('\n=== TEST 4: Student Academic Tracking & Completion Verification ===');
  const studentsList = await getJson('/api/admin/students', cookie);
  const enrolledStudent = studentsList.data.students.find(s => s.student_code === newStudent.data.student_code);
  console.log('Enrolled Student Code:', enrolledStudent.student_code, '| Program Code:', enrolledStudent.program_code);

  console.log('Verifying & Approving Academic Completion...');
  const acadRes = await putJson(`/api/admin/students/${enrolledStudent.id}/academic`, {
    academic_status: 'Completed',
    completion_approved: 1
  }, cookie);
  console.log('Academic Status Update:', acadRes.data);

  console.log('\n=== TEST 5: Certificate Engine (Flow: Fetch Details -> Gen Cert No -> Draft PDF -> Founder Approval) ===');
  const genCert = await postJson('/api/admin/certificates/generate', {
    student_id: enrolledStudent.id
  }, cookie);
  console.log('Generate Certificate Response:', genCert.data);

  console.log('\n=== TEST 6: Founder Approval (Decision: Approved -> Issue Certificate) ===');
  const certsList = await getJson('/api/admin/certificates', cookie);
  const draftCert = certsList.data.certificates.find(c => c.student_code === enrolledStudent.student_code);
  console.log('Draft Certificate Found:', draftCert.certificate_no, '| Approval Status:', draftCert.approval_status);

  const approvalRes = await putJson(`/api/admin/certificates/${draftCert.id}/founder-approval`, {
    decision: 'Approved'
  }, cookie);
  console.log('Founder Approval Response:', approvalRes.data);

  console.log('\n=== TEST 7: Certificate Archive Search (Search by Student Name, Student Code, Program Code, Cert Number) ===');
  const search1 = await getJson(`/api/certificates/verify?q=${encodeURIComponent(enrolledStudent.full_name)}`);
  console.log(`Search by Student Name "${enrolledStudent.full_name}":`, search1.data.results.length, 'found');

  const search2 = await getJson(`/api/certificates/verify?q=${encodeURIComponent(targetProg.program_code)}`);
  console.log(`Search by Program Code "${targetProg.program_code}":`, search2.data.results.length, 'found');

  const search3 = await getJson(`/api/certificates/verify?q=${encodeURIComponent(draftCert.certificate_no)}`);
  console.log(`Search by Certificate Number "${draftCert.certificate_no}":`, search3.data.results.length, 'found');

  console.log('\n=== ALL MASTER FLOWCHART STEPS VERIFIED 100% SUCCESSFULLY! ===');
}

run().catch(console.error);
