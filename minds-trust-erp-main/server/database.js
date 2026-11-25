const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'trust_data.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- 1. Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id INTEGER,
      department TEXT DEFAULT 'Administration',
      platform TEXT NOT NULL DEFAULT 'Main Trust', -- 'Main Trust', 'Main SPA', or 'Both'
      status TEXT NOT NULL DEFAULT 'Active', -- 'Active' or 'Inactive'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Roles table
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      default_modules TEXT -- JSON array of default module codes
    );

    -- 3. User Modules with 6 permissions
    CREATE TABLE IF NOT EXISTS user_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module_code TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_add INTEGER NOT NULL DEFAULT 0,
      can_edit INTEGER NOT NULL DEFAULT 0,
      can_delete INTEGER NOT NULL DEFAULT 0,
      can_approve INTEGER NOT NULL DEFAULT 0,
      can_export INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, module_code)
    );

    -- 4. Trustees table
    CREATE TABLE IF NOT EXISTS trustees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role_or_position TEXT NOT NULL,
      responsibilities TEXT,
      term_start DATE NOT NULL,
      term_end DATE NOT NULL,
      phone TEXT,
      email TEXT,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Donors table
    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_code TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      address TEXT,
      pan_number TEXT,
      donor_category TEXT NOT NULL DEFAULT 'Individual', -- Individual, Corporate, Foundation, Foreign
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Donation Categories
    CREATE TABLE IF NOT EXISTS donation_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    -- 7. Donations
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      donor_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'Bank Transfer', -- Cash, Cheque, Bank Transfer, UPI
      reference_no TEXT,
      donation_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES donation_categories(id) ON DELETE RESTRICT
    );

    -- 8. Beneficiaries
    CREATE TABLE IF NOT EXISTS beneficiaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiary_code TEXT UNIQUE,
      full_name TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      phone TEXT,
      address TEXT,
      category TEXT DEFAULT 'Education', -- Education, Medical, Food/Nutrition, Disaster Relief, Housing
      annual_income REAL,
      application_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Applied', -- Applied, Under Review, Approved, Rejected
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Assistance Records
    CREATE TABLE IF NOT EXISTS assistance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      beneficiary_id INTEGER NOT NULL,
      assistance_type TEXT NOT NULL,
      amount REAL NOT NULL,
      disbursement_date DATE NOT NULL,
      authorized_by TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (beneficiary_id) REFERENCES beneficiaries(id) ON DELETE CASCADE
    );

    -- 10. Projects
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      budget REAL NOT NULL DEFAULT 0.0,
      spent REAL NOT NULL DEFAULT 0.0,
      start_date DATE NOT NULL,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'Running', -- Planning, Running, Ended, On Hold
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Activities (linked to projects)
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      activity_date DATE NOT NULL,
      location TEXT,
      participants_count INTEGER DEFAULT 0,
      cost REAL DEFAULT 0.0,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 12. Volunteers
    CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      skills TEXT,
      availability TEXT DEFAULT 'Weekends',
      status TEXT DEFAULT 'Active',
      joined_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Volunteer Assignments
    CREATE TABLE IF NOT EXISTS volunteer_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteer_id INTEGER NOT NULL,
      project_id INTEGER,
      activity_id INTEGER,
      role_assigned TEXT,
      assignment_status TEXT DEFAULT 'Assigned', -- Assigned, In Progress, Completed, Cancelled
      assigned_date DATE NOT NULL,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
    );

    -- 14. Visitors
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      whom_to_meet TEXT,
      check_in_time DATETIME NOT NULL,
      check_out_time DATETIME,
      badge_number TEXT,
      status TEXT DEFAULT 'Checked In' -- Checked In, Checked Out
    );

    -- 15. Enquiries
    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT,
      subject TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT,
      status TEXT NOT NULL DEFAULT 'New', -- New, Contacted, Converted, Closed
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Activity Log
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL, -- e.g. 'Add', 'Edit', 'Delete', 'Approve', 'Login', etc.
      module TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Trust Settings
    CREATE TABLE IF NOT EXISTS trust_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trust_name TEXT NOT NULL,
      registration_no TEXT NOT NULL,
      founded_year INTEGER,
      email TEXT,
      phone TEXT,
      address TEXT,
      logo_url TEXT,
      pan_80g_info TEXT,
      dashboard_preferences TEXT
    );
  `);
}

function seedInitialData() {
  // Check if roles exist
  const existingRole = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (existingRole.count === 0) {
    const rolesList = [
      {
        name: 'Trust Owner',
        desc: 'Supreme administrator with access to all modules and all permissions.',
        modules: JSON.stringify(['dashboard', 'reception', 'trustees', 'donors', 'donations', 'beneficiaries', 'projects', 'volunteers', 'reports', 'users', 'settings'])
      },
      {
        name: 'Trust Manager',
        desc: 'General management across trust operations.',
        modules: JSON.stringify(['dashboard', 'reception', 'donors', 'donations', 'beneficiaries', 'projects', 'volunteers', 'reports'])
      },
      {
        name: 'Receptionist',
        desc: 'Front desk operations and visitor logs.',
        modules: JSON.stringify(['dashboard', 'reception'])
      },
      {
        name: 'Trustee',
        desc: 'Trustee executive overview and reports.',
        modules: JSON.stringify(['dashboard', 'trustees', 'projects', 'reports'])
      },
      {
        name: 'Volunteer',
        desc: 'Ground activities and volunteer execution.',
        modules: JSON.stringify(['dashboard', 'projects'])
      },
      {
        name: 'Donor Manager',
        desc: 'Manages donor relations and donations.',
        modules: JSON.stringify(['dashboard', 'donors', 'donations', 'reports'])
      },
      {
        name: 'Reports Viewer',
        desc: 'Read-only statistical and compliance reports.',
        modules: JSON.stringify(['dashboard', 'reports'])
      }
    ];

    const insertRole = db.prepare('INSERT INTO roles (name, description, default_modules) VALUES (?, ?, ?)');
    for (const r of rolesList) {
      insertRole.run(r.name, r.desc, r.modules);
    }
  }

  // Seed Trust Settings
  const existingSettings = db.prepare('SELECT COUNT(*) as count FROM trust_settings').get();
  if (existingSettings.count === 0) {
    db.prepare(`
      INSERT INTO trust_settings (trust_name, registration_no, founded_year, email, phone, address, logo_url, pan_80g_info, dashboard_preferences)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Care & Hope Charitable Trust',
      'TRUST/REG/2014/MH/7891',
      2014,
      'contact@carehopecharity.org',
      '+91 98200 12345',
      '402, Seva Bhavan, Mahatma Gandhi Road, Fort, Mumbai - 400001, India',
      '/logo.svg',
      '80G Exemption No: CIT(E)/80G/2016-17/DEL-102 | PAN: AABTC8821K',
      JSON.stringify({ defaultCurrency: 'INR', fiscalYearStart: '04-01', refreshInterval: 60 })
    );
  }

  // Seed Donation Categories
  const existingCat = db.prepare('SELECT COUNT(*) as count FROM donation_categories').get();
  if (existingCat.count === 0) {
    const cats = [
      { name: 'General Welfare', desc: 'Unrestricted trust general operational fund' },
      { name: 'Child Education & Scholarships', desc: 'School fees, books, uniforms, and computers' },
      { name: 'Healthcare & Medical Relief', desc: 'Surgery assistance, dialysis support, medical camps' },
      { name: 'Food & Nutrition Support', desc: 'Daily meal drives and ration kits for homeless' },
      { name: 'Disaster Relief Fund', desc: 'Emergency relief, floods, earthquakes rehabilitation' }
    ];
    const insertCat = db.prepare('INSERT INTO donation_categories (name, description) VALUES (?, ?)');
    for (const c of cats) insertCat.run(c.name, c.desc);
  }

  // Seed Users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('admin123', salt);
    const donorPass = bcrypt.hashSync('donor123', salt);
    const testMultiPass = bcrypt.hashSync('multi123', salt);
    const deniedPass = bcrypt.hashSync('denied123', salt);

    // 1. Admin user (Platform: 'Both', has all modules and full permissions)
    const adminRes = db.prepare(`
      INSERT INTO users (user_id, full_name, email, password_hash, role_id, department, platform, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('admin', 'Dr. Ramesh Narayan', 'admin@carehopecharity.org', adminPass, 1, 'Executive Board', 'Both', 'Active');
    const adminId = adminRes.lastInsertRowid;

    const allModules = ['dashboard', 'reception', 'trustees', 'donors', 'donations', 'beneficiaries', 'projects', 'volunteers', 'reports', 'users', 'settings'];
    const insertUserModule = db.prepare(`
      INSERT INTO user_modules (user_id, module_code, can_view, can_add, can_edit, can_delete, can_approve, can_export)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const mod of allModules) {
      insertUserModule.run(adminId, mod, 1, 1, 1, 1, 1, 1);
    }

    // 2. Donor Manager test user: ONLY Dashboard, Donor Management, Donation Management
    const donorRes = db.prepare(`
      INSERT INTO users (user_id, full_name, email, password_hash, role_id, department, platform, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('donormgr', 'Sunita Sharma', 'sunita@carehopecharity.org', donorPass, 6, 'Donor Relations', 'Main Trust', 'Active');
    const donorUserId = donorRes.lastInsertRowid;

    // Permissions for restricted user:
    insertUserModule.run(donorUserId, 'dashboard', 1, 0, 0, 0, 0, 1);
    insertUserModule.run(donorUserId, 'donors', 1, 1, 1, 0, 0, 1);
    insertUserModule.run(donorUserId, 'donations', 1, 1, 1, 0, 0, 1);

    // 3. Multi-platform test user: Access to 'Both' (Main Trust + Main SPA) with all modules
    const multiRes = db.prepare(`
      INSERT INTO users (user_id, full_name, email, password_hash, role_id, department, platform, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('multimanager', 'Vikramaditya Rao', 'vikram@carehopecharity.org', testMultiPass, 2, 'Operations', 'Both', 'Active');
    const multiId = multiRes.lastInsertRowid;
    for (const mod of allModules) {
      insertUserModule.run(multiId, mod, 1, 1, 1, 1, 1, 1);
    }

    // 4. Test user with NO Main Trust access (Only 'Main SPA') to test Access Denied page
    const deniedRes = db.prepare(`
      INSERT INTO users (user_id, full_name, email, password_hash, role_id, department, platform, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('spaviewer', 'Aakash Verma', 'aakash@mainspa.org', deniedPass, 7, 'External Auditor', 'Main SPA', 'Active');
  }

  // Seed sample Trustees
  const trusteeCount = db.prepare('SELECT COUNT(*) as count FROM trustees').get();
  if (trusteeCount.count === 0) {
    const insertTrustee = db.prepare(`
      INSERT INTO trustees (name, role_or_position, responsibilities, term_start, term_end, phone, email, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTrustee.run('Justice (Retd.) B. N. Srikrishna', 'Chief Managing Trustee', 'Overall legal governance and trust deed compliance', '2022-01-01', '2027-12-31', '+91 98201 55432', 'bns@carehopecharity.org', 'Active');
    insertTrustee.run('Dr. Arvind Sen', 'Trustee & Medical Advisor', 'Head of Healthcare Sub-Committee and Mobile Clinic operations', '2021-04-01', '2026-03-31', '+91 98202 77112', 'dr.sen@carehopecharity.org', 'Active');
    insertTrustee.run('Mrs. Ananya Roy Mehta', 'Trustee & Treasurer', 'Financial audit, tax exemptions (80G/12A), investments', '2023-07-01', '2028-06-30', '+91 98203 99401', 'ananya.mehta@carehopecharity.org', 'Active');
    insertTrustee.run('Prof. K. R. Namboodiri', 'Honorary Trustee', 'Educational mentorship and student scholarship selection board', '2020-01-01', '2025-12-31', '+91 98204 11200', 'kr.namboodiri@carehopecharity.org', 'Active');
  }

  // Seed sample Donors
  const donorCount = db.prepare('SELECT COUNT(*) as count FROM donors').get();
  if (donorCount.count === 0) {
    const insertDonor = db.prepare(`
      INSERT INTO donors (donor_code, full_name, email, phone, address, pan_number, donor_category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertDonor.run('DNR-001', 'Rajeshwari Singhania', 'rajeshwari.s@singhania.com', '+91 98210 99887', 'Flat 14A, Malabar Hill, Mumbai', 'ABCPS1234D', 'Individual');
    insertDonor.run('DNR-002', 'Tata Memorial Philanthropic Fund', 'grants@tataphilanthropy.org', '+91 22 6665 8282', 'Bombay House, Homi Mody Street, Mumbai', 'AABCT1992E', 'Corporate');
    insertDonor.run('DNR-003', 'Dr. Farhan Qureshi', 'dr.farhan@apollohospitals.org', '+91 98334 22119', '12, Bandra West, Mumbai', 'AAAPQ7721L', 'Individual');
    insertDonor.run('DNR-004', 'Global Relief USA Foundation', 'info@globalreliefusa.org', '+1 415 555 0192', '750 Battery St, San Francisco, CA', 'FORGN9928X', 'Foreign');
    insertDonor.run('DNR-005', 'Kalyani Tech CSR Trust', 'csr@kalyanitech.in', '+91 80 4112 3000', 'Electronic City, Bengaluru', 'AAACK5512N', 'Corporate');
  }

  // Seed sample Donations
  const donationCount = db.prepare('SELECT COUNT(*) as count FROM donations').get();
  if (donationCount.count === 0) {
    const insertDonation = db.prepare(`
      INSERT INTO donations (receipt_no, donor_id, category_id, amount, payment_mode, reference_no, donation_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const today = new Date().toISOString().slice(0, 10);
    insertDonation.run('REC-2026-0001', 1, 2, 250000, 'Bank Transfer', 'NEFT-AXIS-992144', today, 'Sponsorship for 25 high school girl scholarships');
    insertDonation.run('REC-2026-0002', 2, 3, 500000, 'Bank Transfer', 'RTGS-HDFC-882110', today, 'Mobile Health Clinic medicine replenishment');
    insertDonation.run('REC-2026-0003', 3, 4, 50000, 'UPI', 'UPI/26110992384/HDFC', today, 'Weekly food grain distribution drive');
    insertDonation.run('REC-2026-0004', 4, 5, 350000, 'Bank Transfer', 'SWIFT-CHASUS33-887', today, 'Disaster relief readiness kits');
    insertDonation.run('REC-2026-0005', 5, 1, 100000, 'Cheque', 'CHQ#441209 SBI', today, 'General Trust annual maintenance support');
  }

  // Seed sample Beneficiaries
  const benCount = db.prepare('SELECT COUNT(*) as count FROM beneficiaries').get();
  if (benCount.count === 0) {
    const insertBen = db.prepare(`
      INSERT INTO beneficiaries (beneficiary_code, full_name, gender, age, phone, address, category, annual_income, application_date, status, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const ben1 = insertBen.run('BEN-2026-001', 'Pooja Sanjay Kamble', 'Female', 17, '+91 97680 11223', 'Dharavi Slum Cluster 5, Mumbai', 'Education', 45000, '2026-11-01', 'Approved', 'Cleared Class 10 with 89%; requires college admission assistance');
    const ben2 = insertBen.run('BEN-2026-002', 'Mohammed Irfan Sheikh', 'Male', 42, '+91 98211 44556', 'Govandi Shivaji Nagar, Mumbai', 'Medical', 36000, '2026-11-05', 'Approved', 'Requires urgent cardiac stent surgery assistance');
    const ben3 = insertBen.run('BEN-2026-003', 'Kavita Suresh Patil', 'Female', 34, '+91 99300 77889', 'Ghatkopar East, Mumbai', 'Food/Nutrition', 24000, '2026-11-10', 'Under Review', 'Widow with 3 school-going children; ration kits applied');
    const ben4 = insertBen.run('BEN-2026-004', 'Dinesh Babu Chauhan', 'Male', 19, '+91 91677 33445', 'Kurla West, Mumbai', 'Education', 50000, '2026-11-14', 'Applied', 'Applied for vocational electrician certification course fee');

    // Seed Assistance records
    const insertAssist = db.prepare(`
      INSERT INTO assistance_records (beneficiary_id, assistance_type, amount, disbursement_date, authorized_by, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertAssist.run(ben1.lastInsertRowid, 'College Admission Fee & Books', 22000, '2026-11-08', 'Dr. Ramesh Narayan', 'Direct cheque to St. Xavier Junior College');
    insertAssist.run(ben2.lastInsertRowid, 'Surgery Financial Support', 75000, '2026-11-12', 'Dr. Arvind Sen', 'Payment release order to KEM Hospital charity counter');
  }

  // Seed sample Projects & Activities
  const projCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
  if (projCount.count === 0) {
    const insertProj = db.prepare(`
      INSERT INTO projects (code, title, description, budget, spent, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const p1 = insertProj.run('PRJ-2026-01', 'Project Vidya: Girl Child Literacy Mission', 'Full scholarship, counseling and coaching for 100 underprivileged girls across urban slums.', 750000, 280000, '2026-01-01', '2026-12-31', 'Running');
    const p2 = insertProj.run('PRJ-2026-02', 'Sanjeevani: Mobile Healthcare Vans', 'Equipped mobile clinical vans providing free diagnostics, primary medicines and doctor visits.', 1200000, 620000, '2026-03-01', '2026-12-31', 'Running');
    const p3 = insertProj.run('PRJ-2026-03', 'Annapurna: Zero-Hunger Community Kitchen', 'Nutritious daily lunch packets distributed to daily wage workers and homeless seniors.', 600000, 410000, '2026-01-15', '2026-08-31', 'Running');
    const p4 = insertProj.run('PRJ-2026-04', 'Winter Warmth Blanket Drive 2025', 'Distribution of 2,500 insulated winter blankets across railway stations and pavements.', 200000, 195000, '2025-11-01', '2026-02-15', 'Ended');

    // Activities
    const insertAct = db.prepare(`
      INSERT INTO activities (project_id, title, activity_date, location, participants_count, cost, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAct.run(p1.lastInsertRowid, 'Vidya Scholarship Felicitation & Laptop Handover', '2026-10-15', 'Mumbai Town Hall', 85, 95000, 'Awarded merit certificates and subsidized laptops to 85 students.');
    insertAct.run(p2.lastInsertRowid, 'Free Eye & Diabetes Screening Camp', '2026-11-08', 'Dharavi Community Center', 320, 42000, '320 elders screened; 48 spectacles distributed free of cost.');
    insertAct.run(p3.lastInsertRowid, 'Diwali Mega Ration Kit Distribution', '2026-10-28', 'Mankhurd Transit Colony', 450, 125000, 'Provided 1-month grocery rations to 450 struggling families.');
  }

  // Seed sample Volunteers & Assignments
  const volCount = db.prepare('SELECT COUNT(*) as count FROM volunteers').get();
  if (volCount.count === 0) {
    const insertVol = db.prepare(`
      INSERT INTO volunteers (full_name, email, phone, skills, availability, status, joined_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const v1 = insertVol.run('Tanmay Joshi', 'tanmay.j@gmail.com', '+91 98205 33441', 'Teaching, Mathematics, Youth Mentorship', 'Weekends', 'Active', '2025-06-15');
    const v2 = insertVol.run('Dr. Sneha Pillai', 'dr.sneha.p@gmail.com', '+91 98206 44552', 'General Medicine, First Aid, Nursing', 'Saturdays', 'Active', '2025-08-20');
    const v3 = insertVol.run('Amit Deshmukh', 'amit.desh@outlook.com', '+91 98207 55663', 'Logistics, Event Management, Driving', 'Flexible', 'Active', '2026-01-10');
    const v4 = insertVol.run('Ritu Kapoor', 'ritu.kapoor@gmail.com', '+91 98208 66774', 'Graphic Design, Social Media, Photography', 'Evenings', 'Active', '2026-02-01');

    const insertAssign = db.prepare(`
      INSERT INTO volunteer_assignments (volunteer_id, project_id, activity_id, role_assigned, assignment_status, assigned_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertAssign.run(v1.lastInsertRowid, 1, 1, 'Maths Workshop Tutor', 'In Progress', '2026-10-01');
    insertAssign.run(v2.lastInsertRowid, 2, 2, 'Attending Medical Officer', 'Completed', '2026-11-05');
    insertAssign.run(v3.lastInsertRowid, 3, 3, 'Logistics & Van Fleet In-charge', 'Completed', '2026-10-25');
  }

  // Seed Reception Visitors & Enquiries
  const visCount = db.prepare('SELECT COUNT(*) as count FROM visitors').get();
  if (visCount.count === 0) {
    const insertVis = db.prepare(`
      INSERT INTO visitors (name, phone, purpose, whom_to_meet, check_in_time, check_out_time, badge_number, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const today = new Date().toISOString().slice(0, 10);
    insertVis.run('Sanjay G. Gupta', '+91 98190 22334', 'Discuss CSR Partnership with Tech firm', 'Dr. Ramesh Narayan', `${today} 10:15:00`, `${today} 11:30:00`, 'VIS-101', 'Checked Out');
    insertVis.run('Meera Nambiar', '+91 98191 33445', 'Submit Medical Aid Application documents', 'Reception Desk', `${today} 11:45:00`, null, 'VIS-102', 'Checked In');
    insertVis.run('Kishore Kumar Jha', '+91 98192 44556', 'Deliver donated textbooks & stationery', 'Tanmay Joshi', `${today} 12:10:00`, null, 'VIS-103', 'Checked In');

    const insertEnq = db.prepare(`
      INSERT INTO enquiries (visitor_name, contact_number, email, subject, description, assigned_to, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertEnq.run('Godrej Good & Green Foundation', '+91 22 2518 8010', 'csr@godrej.com', 'Partnership for Urban Tree Plantation', 'Inquiry on joint funding for urban afforestation projects in eastern suburbs', 'Dr. Ramesh Narayan', 'Contacted');
    insertEnq.run('Sharada Vidya Mandir Trust', '+91 98212 99001', 'sharadaschool@gmail.com', 'Request for student health checkup camp', 'Requesting mobile health clinic visit for 450 school students next month', 'Dr. Arvind Sen', 'New');
    insertEnq.run('Anil Chawla', '+91 98200 44332', 'anil.c@gmail.com', 'Corpus Fund Donation procedure', 'Wants to establish an endowment in memory of his late mother', 'Sunita Sharma', 'Converted');
  }

  // Seed Activity Log
  const logCount = db.prepare('SELECT COUNT(*) as count FROM activity_log').get();
  if (logCount.count === 0) {
    const insertLog = db.prepare(`
      INSERT INTO activity_log (user_id, user_name, action, module, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    insertLog.run(1, 'Dr. Ramesh Narayan', 'System Initialized', 'Settings', 'Database and Master configuration established successfully', now);
    insertLog.run(1, 'Dr. Ramesh Narayan', 'Add', 'Trustees', 'Added Justice (Retd.) B. N. Srikrishna as Chief Managing Trustee', now);
    insertLog.run(2, 'Sunita Sharma', 'Add', 'Donations', 'Generated receipt REC-2026-0001 for ₹2,50,000 (Rajeshwari Singhania)', now);
    insertLog.run(1, 'Dr. Ramesh Narayan', 'Approve', 'Beneficiaries', 'Approved educational assistance application for Pooja Kamble', now);
  }
}

initSchema();
seedInitialData();

module.exports = db;

