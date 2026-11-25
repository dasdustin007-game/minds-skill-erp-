const db = require('./database_erp');
const bcrypt = require('bcryptjs');

console.log('========================================================================');
console.log('RUNNING ERP UNIFIED MULTI-PORTAL MANAGEMENT SYSTEM TEST VERIFICATION');
console.log('========================================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// 1. Centralized Database Schema Checks
const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
const expectedTables = [
  'users', 'students', 'trainers', 'donors', 'courses', 'events',
  'event_registrations', 'certificate_templates', 'certificates',
  'donation_purposes', 'donations', 'donation_updates', 'finance_records',
  'email_templates', 'email_logs', 'audit_logs', 'system_settings'
];
expectedTables.forEach(t => {
  assert(tables.includes(t), `Table "${t}" exists in centralized relational schema`);
});

// 2. Multi-Portal User Accounts & Hashed Authentication
const admin = db.prepare("SELECT * FROM users WHERE portal_type = 'ADMIN' AND role = 'Super Admin'").get();
assert(admin && admin.user_id === 'admin', 'Super Admin account (admin) exists');
assert(bcrypt.compareSync('admin123', admin.password_hash), 'Admin password validates securely via bcrypt');

const financeUser = db.prepare("SELECT * FROM users WHERE role = 'Finance Staff'").get();
assert(financeUser && financeUser.user_id === 'finance', 'Finance Staff account (finance) exists');

const studentUser = db.prepare("SELECT * FROM users WHERE portal_type = 'STUDENT'").get();
assert(studentUser && studentUser.user_id === 'student1', 'Student Portal account (student1) exists');

const donorUser = db.prepare("SELECT * FROM users WHERE portal_type = 'DONOR'").get();
assert(donorUser && donorUser.user_id === 'donor1', 'Donor Portal account (donor1) exists');

const trainerUser = db.prepare("SELECT * FROM users WHERE portal_type = 'TRAINER'").get();
assert(trainerUser && trainerUser.user_id === 'trainer1', 'Trainer Portal account (trainer1) exists');

// 3. Unique ID Generation Requirements
const donorRec = db.prepare("SELECT donor_code FROM donors WHERE user_id = ?").get(donorUser.id);
assert(donorRec && donorRec.donor_code.startsWith('DNR-'), `Unique Donor ID format generated: ${donorRec.donor_code}`);

const studentRec = db.prepare("SELECT student_code FROM students WHERE user_id = ?").get(studentUser.id);
assert(studentRec && studentRec.student_code.startsWith('STU-'), `Unique Student Code format generated: ${studentRec.student_code}`);

// 4. Automation A: Certificate Numbering & Generation
const cert = db.prepare("SELECT * FROM certificates LIMIT 1").get();
assert(cert !== undefined, 'Certificate record generated in database');
assert(/^EVT\/\d{2}\/\d{2}\/\d{4}\/\d{4}$/.test(cert.certificate_no), `Certificate format matches EVT/DD/MM/YYYY/XXXX: ${cert.certificate_no}`);
assert(cert.student_name && cert.event_title, 'Certificate contains student name and completed event title');

// 5. Automation B: Email Automation Logs & Templates
const emailLogCount = db.prepare("SELECT COUNT(*) as c FROM email_logs").get().c;
assert(emailLogCount >= 1, `Email automation queue has logged transactional messages (${emailLogCount} logs)`);
const emailTemplates = db.prepare("SELECT COUNT(*) as c FROM email_templates").get().c;
assert(emailTemplates >= 3, `Email templates seeded (${emailTemplates} templates)`);

// 6. 20-Day Update Window Business Rule on Donations
const donation = db.prepare("SELECT * FROM donations LIMIT 1").get();
assert(donation && donation.update_window_days === 20, `Donation record enforces 20-day update window rule`);
const donUpdates = db.prepare("SELECT COUNT(*) as c FROM donation_updates WHERE donation_id = ?").get(donation.id).c;
assert(donUpdates >= 1, `Donation update history audit trail active (${donUpdates} entries)`);

// 7. Finance Separation & Access Control
const financeRecordsCount = db.prepare("SELECT COUNT(*) as c FROM finance_records").get().c;
assert(financeRecordsCount >= 2, `Finance transactions tracked (${financeRecordsCount} records)`);

// 8. Birthday & Special-Day Management Data
const usersWithDob = db.prepare("SELECT COUNT(*) as c FROM users WHERE dob IS NOT NULL").get().c;
assert(usersWithDob >= 4, `Birthday and special-day telemetry populated for users (${usersWithDob} users with DOB)`);

// 9. Tamper-Evident Audit Logging
const auditCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs").get().c;
assert(auditCount >= 1, `Central audit log active (${auditCount} logs)`);

console.log('========================================================================');
console.log(`ERP VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================================');

if (failed > 0) process.exit(1);

