const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('====================================================');
console.log('RUNNING COMPREHENSIVE TESTS FOR CARE & HOPE TRUST APP');
console.log('====================================================');

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

// 1. Test Seeded Users
const admin = db.prepare('SELECT * FROM users WHERE user_id = ?').get('admin');
assert(admin !== undefined, 'Admin user (admin) exists in database');
assert(admin && admin.platform === 'Both', 'Admin has dual platform access ("Both")');
assert(bcrypt.compareSync('admin123', admin.password_hash), 'Admin password validates correctly');

// 2. Test Admin Permissions (Should have 11 modules with all permissions)
const adminModules = db.prepare('SELECT * FROM user_modules WHERE user_id = ?').all(admin.id);
assert(adminModules.length === 11, `Admin has all 11 modules assigned (Found ${adminModules.length})`);
const allAdminCanAdd = adminModules.every(m => m.can_add === 1 && m.can_delete === 1 && m.can_export === 1);
assert(allAdminCanAdd, 'Admin has Add, Delete, Export permissions enabled on all assigned modules');

// 3. Test Restricted Donor Manager User (donormgr)
const donorUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get('donormgr');
assert(donorUser !== undefined, 'Donor Manager user (donormgr) exists');
const donorModules = db.prepare('SELECT * FROM user_modules WHERE user_id = ?').all(donorUser.id);
assert(donorModules.length === 3, `Donor Manager has exactly 3 modules assigned (Found ${donorModules.length})`);
const modCodes = donorModules.map(m => m.module_code).sort();
assert(JSON.stringify(modCodes) === JSON.stringify(['dashboard', 'donations', 'donors'].sort()), 'Donor Manager assigned ONLY dashboard, donors, donations');

// Check that donor manager CANNOT delete
const donorDeletePerms = donorModules.some(m => m.can_delete === 1);
assert(!donorDeletePerms, 'Donor manager has can_delete = 0 across all modules');

// 4. Test Access Denied user (spaviewer - Only has 'Main SPA' platform access)
const spaUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get('spaviewer');
assert(spaUser !== undefined, 'External SPA user exists');
assert(spaUser.platform === 'Main SPA', 'External SPA user has platform = "Main SPA"');
const spaTrustAllowed = spaUser.platform === 'Main Trust' || spaUser.platform === 'Both';
assert(!spaTrustAllowed, 'Access to Main Trust is strictly blocked for spaviewer (Triggers Access Denied page)');

// 5. Test Reception Visitors & Enquiries tables
const visitorCount = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
assert(visitorCount >= 3, `Visitor check-in logs populated (${visitorCount} records)`);
const enquiryCount = db.prepare('SELECT COUNT(*) as c FROM enquiries').get().c;
assert(enquiryCount >= 3, `Reception enquiries populated (${enquiryCount} records)`);

// 6. Test Trustees table
const trusteeCount = db.prepare('SELECT COUNT(*) as c FROM trustees').get().c;
assert(trusteeCount >= 4, `Trustee governance profiles populated (${trusteeCount} records)`);

// 7. Test Donors & Donations & 80G Receipt Number Generation
const donorCount = db.prepare('SELECT COUNT(*) as c FROM donors').get().c;
assert(donorCount >= 5, `Donors registered (${donorCount} records)`);
const donationCount = db.prepare('SELECT COUNT(*) as c FROM donations').get().c;
assert(donationCount >= 5, `Donation receipts registered (${donationCount} records)`);

// Test auto-receipt number formatting
const sampleDonation = db.prepare('SELECT receipt_no FROM donations LIMIT 1').get();
assert(/^REC-\d{4}-\d{4}$/.test(sampleDonation.receipt_no), `Receipt format matches REC-YYYY-XXXX: ${sampleDonation.receipt_no}`);

// 8. Test Beneficiaries & Assistance records
const benCount = db.prepare('SELECT COUNT(*) as c FROM beneficiaries').get().c;
assert(benCount >= 4, `Beneficiary applications registered (${benCount} records)`);
const assistCount = db.prepare('SELECT COUNT(*) as c FROM assistance_records').get().c;
assert(assistCount >= 2, `Assistance disbursements recorded (${assistCount} records)`);

// 9. Test Projects & Activities
const projCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
assert(projCount >= 4, `Welfare projects created (${projCount} records)`);
const actCount = db.prepare('SELECT COUNT(*) as c FROM activities').get().c;
assert(actCount >= 3, `Welfare activities logged (${actCount} records)`);

// 10. Test Volunteers & Assignments
const volCount = db.prepare('SELECT COUNT(*) as c FROM volunteers').get().c;
assert(volCount >= 4, `Volunteers registered (${volCount} records)`);
const assignCount = db.prepare('SELECT COUNT(*) as c FROM volunteer_assignments').get().c;
assert(assignCount >= 3, `Volunteer project assignments recorded (${assignCount} records)`);

// 11. Test Activity Logging (Audit Trail)
const logCount = db.prepare('SELECT COUNT(*) as c FROM activity_log').get().c;
assert(logCount >= 4, `Activity log writes functioning (${logCount} audit entries)`);

// 12. Test Trust Organization Legal Profile
const settings = db.prepare('SELECT * FROM trust_settings WHERE id = 1').get();
assert(settings && settings.registration_no === 'TRUST/REG/2014/MH/7891', 'Trust statutory settings and 80G profile intact');

console.log('====================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) process.exit(1);

