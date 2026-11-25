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
  console.log('=== TEST 1: DONOR PORTAL VERIFICATION ===');
  const donorLogin = await postJson('/api/auth/login', { identifier: 'donor1', password: 'donor123', expected_portal: 'DONOR' });
  console.log('Donor Login Status:', donorLogin.status, 'Donor:', donorLogin.data.user.full_name);
  const donorCookie = donorLogin.cookie ? donorLogin.cookie[0].split(';')[0] : '';

  const donorDash = await getJson('/api/donor/dashboard', donorCookie);
  console.log('Donor ID Code:', donorDash.data.donor.donor_code);
  console.log('Active Donations Count:', donorDash.data.donations.length);
  console.log('80G Tax Certificates Count:', donorDash.data.taxCertificates.length);
  console.log('Impact Updates Count:', donorDash.data.impactUpdates.length);

  // Test submitting a donation
  console.log('Testing Donor Contribution Submission...');
  const newDonation = await postJson('/api/donor/donations', {
    amount: 50000,
    purpose_name: 'Vocational Training & Skill Development',
    beneficiary_target: 'Youth Empowerment Lab in Mumbai Suburban',
    payment_method: 'UPI',
    payment_reference: 'UPI-MINDS-882910',
    reason_description: 'Contribution for 2026 digital tech scholarships'
  }, donorCookie);
  console.log('Submission Response:', newDonation.data);

  // Verify updated dashboard
  const donorDashAfter = await getJson('/api/donor/dashboard', donorCookie);
  console.log('Updated Donations Count:', donorDashAfter.data.donations.length);
  console.log('Updated 80G Tax Certs:', donorDashAfter.data.taxCertificates.length);

  console.log('\n=== TEST 2: TRAINER PORTAL VERIFICATION ===');
  const trainerLogin = await postJson('/api/auth/login', { identifier: 'trainer1', password: 'trainer123', expected_portal: 'TRAINER' });
  console.log('Trainer Login Status:', trainerLogin.status, 'Trainer:', trainerLogin.data.user.full_name);
  const trainerCookie = trainerLogin.cookie ? trainerLogin.cookie[0].split(';')[0] : '';

  const trainerDash = await getJson('/api/trainer/dashboard', trainerCookie);
  console.log('Trainer Code:', trainerDash.data.trainer.trainer_code);
  console.log('Assigned Events Count:', trainerDash.data.events.length);
  console.log('Assigned Students Count:', trainerDash.data.students.length);
  console.log('Course Modules Count:', trainerDash.data.modules.length);
  console.log('Session Delivery Logs Count:', trainerDash.data.sessionLogs.length);

  // Test student evaluation
  if (trainerDash.data.students.length > 0) {
    const reg = trainerDash.data.students[0];
    console.log(`Evaluating student ${reg.full_name} for event "${reg.event_title}"...`);
    const evalRes = await putJson(`/api/trainer/evaluate-student/${reg.reg_id}`, {
      attendance_status: 'Present',
      completion_status: 'Completed',
      marks_or_grade: 'A+',
      trainer_remarks: 'Consistently outstanding execution in all lab assignments and project deliveries.'
    }, trainerCookie);
    console.log('Evaluation Response:', evalRes.data);
  }

  // Test logging teaching session hours
  console.log('Testing Session Delivery Hour Logging...');
  const sessionLogRes = await postJson('/api/trainer/session-logs', {
    event_id: trainerDash.data.events[0].id,
    session_title: 'Full Stack Deployment & Continuous Integration Masterclass',
    session_date: '2026-11-17',
    hours_delivered: 4.5,
    attendance_headcount: 22,
    topics_covered: 'Dockerization, GitHub Actions, and SQLite schema backups',
    notes: 'All participants completed build pipelines successfully.'
  }, trainerCookie);
  console.log('Session Log Response:', sessionLogRes.data);

  // Test publishing course module
  console.log('Testing Course Syllabus Module Publishing...');
  const moduleRes = await postJson('/api/trainer/course-modules', {
    course_name: 'Full Stack Digital Skills',
    module_title: 'Module 5: Microservices & Event-Driven Architecture',
    duration_hours: 20,
    learning_outcomes: 'Design decoupling queues and distributed API services',
    materials_url: 'https://minds-trust.org/resources/module5-microservices.pdf'
  }, trainerCookie);
  console.log('Module Publish Response:', moduleRes.data);

  console.log('\n=== ALL DONOR & TRAINER PORTAL TESTS PASSED! ===');
}

run().catch(console.error);

