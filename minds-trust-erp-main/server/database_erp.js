const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'minds_trust_erp.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    -- 1. Users table (Centralized for all Portals: ADMIN, STUDENT, DONOR, TRAINER)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      portal_type TEXT NOT NULL, -- 'ADMIN', 'STUDENT', 'DONOR', 'TRAINER'
      role TEXT NOT NULL DEFAULT 'User', -- 'Super Admin', 'Student', 'Donor', 'Trainer'
      status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Pending Approval', 'Inactive'
      dob DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Students profile & course linkages
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      student_code TEXT UNIQUE NOT NULL, -- e.g. STU-2026-001
      enrolled_program TEXT NOT NULL,
      batch TEXT,
      academic_status TEXT DEFAULT 'Enrolled', -- Enrolled, Graduated, On Leave
      finance_clearance INTEGER DEFAULT 1,
      dob DATE,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 3. Trainers profile
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      trainer_code TEXT UNIQUE NOT NULL, -- e.g. TRN-101
      specialization TEXT NOT NULL,
      qualification TEXT,
      dob DATE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 4. Donors profile & unique Donor ID
    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      donor_code TEXT UNIQUE NOT NULL, -- e.g. DNR-8891
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      address TEXT,
      pan_number TEXT,
      donor_category TEXT DEFAULT 'Individual', -- Individual, Corporate, Foundation
      dob DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 5. Courses / Curriculum
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      duration_weeks INTEGER DEFAULT 8,
      trainer_id INTEGER,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    );

    -- 6. Events (with automated end_date certificate trigger)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      last_date DATE NOT NULL,
      trainer_id INTEGER,
      venue TEXT,
      status TEXT DEFAULT 'Scheduled', -- Scheduled, Ongoing, Completed, Cancelled
      auto_cert_processed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    );

    -- 7. Event Registrations & Student Participation
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      registration_date DATE NOT NULL,
      attendance_status TEXT DEFAULT 'Present', -- Present, Absent, Excused
      completion_status TEXT DEFAULT 'Completed', -- In Progress, Completed, Incomplete
      marks_or_grade TEXT DEFAULT 'A',
      trainer_remarks TEXT,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(event_id, student_id)
    );

    -- 8. Certificate Templates
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name TEXT NOT NULL,
      header_title TEXT DEFAULT 'Certificate of Merit & Completion',
      organization_name TEXT DEFAULT 'MINDS TRUST ERP',
      signatory_name TEXT DEFAULT 'Managing Trustee & Academic Director',
      body_text TEXT DEFAULT 'This is to certify that [Student Name] has successfully completed the program [Event Title].'
    );

    -- 9. Certificates (Unique numbering: EVT/DD/MM/YYYY/XXXX)
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_no TEXT UNIQUE NOT NULL, -- EVT/17/11/2026/0001
      event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_code TEXT NOT NULL,
      event_title TEXT NOT NULL,
      event_start DATE NOT NULL,
      event_completion DATE NOT NULL,
      issue_date DATE NOT NULL,
      status TEXT DEFAULT 'Issued',
      pdf_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
      UNIQUE(event_id, student_id)
    );

    -- 10. Donation Purposes
    CREATE TABLE IF NOT EXISTS donation_purposes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purpose_name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    -- 11. Donations & 20-Day Update Window
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      donor_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      purpose_id INTEGER,
      purpose_name TEXT NOT NULL,
      beneficiary_target TEXT,
      donation_date DATE NOT NULL,
      payment_method TEXT DEFAULT 'Bank Transfer',
      payment_reference TEXT,
      payment_status TEXT DEFAULT 'Verified',
      reason_description TEXT,
      supporting_doc_path TEXT,
      doc_status TEXT DEFAULT 'Verified',
      update_window_days INTEGER DEFAULT 20,
      is_locked INTEGER DEFAULT 0,
      admin_comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE RESTRICT,
      FOREIGN KEY (purpose_id) REFERENCES donation_purposes(id) ON DELETE SET NULL
    );

    -- 12. Donation Updates (History Audit for 20-Day Window)
    CREATE TABLE IF NOT EXISTS donation_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donation_id INTEGER NOT NULL,
      updated_by_user TEXT NOT NULL,
      update_notes TEXT NOT NULL,
      previous_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE
    );

    -- 13. Finance Management Records (Fully Accessible by Admin Profile)
    CREATE TABLE IF NOT EXISTS finance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL, -- Student Fee, Donation Inflow, Welfare Grant, Training Expense
      amount REAL NOT NULL,
      transaction_date DATE NOT NULL,
      payment_status TEXT DEFAULT 'Completed',
      reference_no TEXT,
      related_student_id INTEGER,
      related_donor_id INTEGER,
      approved_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_student_id) REFERENCES students(id) ON DELETE SET NULL,
      FOREIGN KEY (related_donor_id) REFERENCES donors(id) ON DELETE SET NULL
    );

    -- 14. Email Templates & Email Automation Logs
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      body_content TEXT NOT NULL
    );

    -- 15. Email Logs
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'Sent',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT
    );

    -- 16. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT NOT NULL,
      portal TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. System Settings
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_name TEXT NOT NULL,
      support_email TEXT,
      phone TEXT,
      address TEXT,
      birthday_categories TEXT DEFAULT '["STUDENT", "TRAINER", "DONOR"]',
      update_window_days INTEGER DEFAULT 20,
      auto_cert_generation INTEGER DEFAULT 1
    );

    -- 18. Hierarchy Roles & Task Workflow Engine
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_ref TEXT,
      task_type TEXT DEFAULT 'General',
      hierarchy_role TEXT NOT NULL, -- 'Manager', 'Team Leader', 'Staff', 'Student'
      assigned_to_user_id INTEGER NOT NULL,
      assigned_to_name TEXT NOT NULL,
      assigned_to_role TEXT NOT NULL,
      assigned_by_user_id INTEGER NOT NULL,
      assigned_by_name TEXT NOT NULL,
      priority TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Urgent'
      status TEXT DEFAULT 'Assigned', -- 'Assigned', 'In Progress', 'Submitted for Review', 'Revision Required', 'Reassigned', 'Approved', 'Completed', 'Overdue'
      start_date DATE NOT NULL,
      deadline DATE NOT NULL,
      instructions TEXT,
      donor_id INTEGER,
      donation_id INTEGER,
      cert_id INTEGER,
      submission_text TEXT,
      submission_file_name TEXT,
      submission_date DATETIME,
      revision_count INTEGER DEFAULT 0,
      rejection_reason TEXT,
      required_corrections TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL, -- 'Task Assigned', 'Reassigned', 'Submitted for Review', 'Rejected', 'Approved', 'Deadline Changed', etc.
      performed_by_id INTEGER NOT NULL,
      performed_by_name TEXT NOT NULL,
      from_user_id INTEGER,
      to_user_id INTEGER,
      details TEXT,
      rejection_reason TEXT,
      required_corrections TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  
  // Alter users table to add hierarchy columns if not present
  try { db.exec(`ALTER TABLE users ADD COLUMN hierarchy_role TEXT DEFAULT 'Staff';`); } catch (e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN reports_to_user_id INTEGER;`); } catch (e) {}
}

function seedData() {
  const existingUser = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUser.count > 0) return;

  const salt = bcrypt.genSaltSync(10);
  const passAdmin = bcrypt.hashSync('admin123', salt);
  const passStudent = bcrypt.hashSync('student123', salt);
  const passDonor = bcrypt.hashSync('donor123', salt);
  const passTrainer = bcrypt.hashSync('trainer123', salt);

  // 1. Admin Profile (Access to ALL modules including Finance)
  const adminRes = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', 'Super Admin', 'Active', '1978-05-14')
  `).run('admin', 'Dr. Ramesh Narayan', 'admin@mindstrust.org', '+91 98200 12345', passAdmin);

  // 2. Trainer Profile
  const trnRes = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'TRAINER', 'Trainer', 'Active', '1982-11-25')
  `).run('trainer1', 'Prof. Arvind Deshmukh', 'arvind.trainer@mindstrust.org', '+91 98200 77889', passTrainer);
  
  const trainerId = db.prepare(`
    INSERT INTO trainers (user_id, trainer_code, specialization, qualification, dob)
    VALUES (?, ?, ?, ?, ?)
  `).run(trnRes.lastInsertRowid, 'TRN-101', 'Vocational Web & Data Literacy', 'M.Tech, B.Ed', '1982-11-25').lastInsertRowid;

  // 3. Students
  const stu1Res = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'STUDENT', 'Student', 'Active', '2005-11-19')
  `).run('student1', 'Pooja Sanjay Kamble', 'pooja.kamble@student.mindstrust.org', '+91 97680 11223', passStudent);
  
  const student1Id = db.prepare(`
    INSERT INTO students (user_id, student_code, enrolled_program, batch, academic_status, finance_clearance, dob)
    VALUES (?, ?, ?, 'Cohort 2026', 'Enrolled', 1, '2005-11-19')
  `).run(stu1Res.lastInsertRowid, 'STU-2026-001', 'Certificate in Full Stack Digital Skills').lastInsertRowid;

  const stu2Res = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'STUDENT', 'Student', 'Active', '2004-12-05')
  `).run('student2', 'Rahul Suresh Verma', 'rahul.verma@student.mindstrust.org', '+91 97680 99887', passStudent);
  
  const student2Id = db.prepare(`
    INSERT INTO students (user_id, student_code, enrolled_program, batch, academic_status, finance_clearance, dob)
    VALUES (?, ?, ?, 'Cohort 2026', 'Enrolled', 1, '2004-12-05')
  `).run(stu2Res.lastInsertRowid, 'STU-2026-002', 'Healthcare Assistant & Diagnostics').lastInsertRowid;

  // 4. Donor
  const dnrRes = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'DONOR', 'Donor', 'Active', '1980-11-18')
  `).run('donor1', 'Rajeshwari Singhania', 'rajeshwari@singhania.com', '+91 98210 99887', passDonor);
  
  const donorId = db.prepare(`
    INSERT INTO donors (user_id, donor_code, full_name, email, phone, address, pan_number, donor_category, dob)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(dnrRes.lastInsertRowid, 'DNR-8891', 'Rajeshwari Singhania', 'rajeshwari@singhania.com', '+91 98210 99887', 'Flat 14A, Malabar Hill, Mumbai', 'ABCPS1234D', 'Individual', '1980-11-18').lastInsertRowid;

  // 5. Courses
  db.prepare(`
    INSERT INTO courses (course_code, title, description, duration_weeks, trainer_id, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('CRS-101', 'Enterprise Web Application Engineering', 'Full lifecycle web development, databases & security', 12, trainerId, 'Active');

  // 6. Events
  const today = new Date().toISOString().slice(0, 10);
  const ev1 = db.prepare(`
    INSERT INTO events (event_code, title, description, start_date, last_date, trainer_id, venue, status, auto_cert_processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('EVT-2026-01', 'Winter Youth Tech Bootcamp 2026', 'Intensive digital skills and coding workshop.', '2026-11-01', today, trainerId, 'MINDS Main Auditorium', 'Completed', 1).lastInsertRowid;

  const ev2 = db.prepare(`
    INSERT INTO events (event_code, title, description, start_date, last_date, trainer_id, venue, status, auto_cert_processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('EVT-2026-02', 'Community Healthcare Assistant Masterclass', 'Practical first aid, patient management and vital monitoring.', '2026-11-20', '2026-12-05', trainerId, 'MINDS Medical Center', 'Scheduled', 0).lastInsertRowid;

  // Event Registrations
  db.prepare(`
    INSERT INTO event_registrations (event_id, student_id, registration_date, attendance_status, completion_status, marks_or_grade, trainer_remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(ev1, student1Id, '2026-11-01', 'Present', 'Completed', 'A+', 'Distinction performance in final evaluation');

  db.prepare(`
    INSERT INTO event_registrations (event_id, student_id, registration_date, attendance_status, completion_status, marks_or_grade, trainer_remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(ev2, student2Id, '2026-11-15', 'Present', 'In Progress', 'A', 'Enrolled and ready');

  // 7. Certificates (Pre-generated for student1)
  const now = new Date();
  const certDay = String(now.getDate()).padStart(2, '0');
  const certMonth = String(now.getMonth() + 1).padStart(2, '0');
  const certYear = now.getFullYear();
  const certNo = `EVT/${certDay}/${certMonth}/${certYear}/0001`;

  db.prepare(`
    INSERT INTO certificates (certificate_no, event_id, student_id, student_name, student_code, event_title, event_start, event_completion, issue_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(certNo, ev1, student1Id, 'Pooja Sanjay Kamble', 'STU-2026-001', 'Winter Youth Tech Bootcamp 2026', '2026-11-01', today, today, 'Issued');

  // 8. Donation Purposes
  const purposes = [
    { name: 'Student Education Support', desc: 'Direct scholarship funding for textbooks and course tuition' },
    { name: 'Scholarship Support', desc: 'Merit scholarship funding for underprivileged students' },
    { name: 'Medical Assistance', desc: 'Subsidies for diagnostic tests and healthcare treatments' },
    { name: 'Community Development', desc: 'Community center infrastructure and computer labs' }
  ];
  for (const p of purposes) {
    db.prepare('INSERT INTO donation_purposes (purpose_name, description) VALUES (?, ?)').run(p.name, p.desc);
  }

  // 9. Donations (with 20-day window active)
  const donRes = db.prepare(`
    INSERT INTO donations (receipt_no, donor_id, amount, purpose_id, purpose_name, beneficiary_target, donation_date, payment_method, payment_reference, payment_status, reason_description, supporting_doc_path, doc_status, update_window_days, is_locked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('REC-2026-0001', donorId, 150000, 1, 'Student Education Support', 'Batch A-2026 Youth Cohort (Pooja Kamble & peers)', today, 'Bank Transfer', 'NEFT-AXIS-992144', 'Verified', 'Sponsorship for 10 vocational students', '/uploads/sample_tax_pan_receipt.pdf', 'Verified', 20, 0);

  db.prepare(`
    INSERT INTO donation_updates (donation_id, updated_by_user, update_notes, previous_data)
    VALUES (?, ?, ?, ?)
  `).run(donRes.lastInsertRowid, 'Rajeshwari Singhania', 'Initial donation submission and supporting bank transfer receipt attached.', 'Amount: 150000');

  // 10. Finance Records (Admin Accessible)
  db.prepare(`
    INSERT INTO finance_records (transaction_id, category, amount, transaction_date, payment_status, reference_no, related_student_id, related_donor_id, approved_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('TXN-2026-001', 'Donation Inflow', 150000, today, 'Completed', 'NEFT-AXIS-992144', null, donorId, 'Admin (Dr. Ramesh Narayan)', 'Verified in MINDS TRUST ledger');

  db.prepare(`
    INSERT INTO finance_records (transaction_id, category, amount, transaction_date, payment_status, reference_no, related_student_id, related_donor_id, approved_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('TXN-2026-002', 'Student Fee Grant', 25000, today, 'Completed', 'GRANT-STU-001', student1Id, null, 'Admin (Dr. Ramesh Narayan)', 'Disbursed for STU-2026-001 tuition fees');

  // 11. Email Templates
  db.prepare(`
    INSERT INTO email_templates (event_type, subject, body_content)
    VALUES (?, ?, ?)
  `).run('REGISTRATION', 'Welcome to MINDS TRUST ERP Management Platform', 'Dear {{name}}, your account has been created in MINDS TRUST ERP.');

  db.prepare(`
    INSERT INTO email_templates (event_type, subject, body_content)
    VALUES (?, ?, ?)
  `).run('DONATION_ACK', 'Donation Received - MINDS TRUST', 'Dear {{donorName}}, we gratefully acknowledge your contribution of INR {{amount}} for {{purpose}}.');

  db.prepare(`
    INSERT INTO email_templates (event_type, subject, body_content)
    VALUES (?, ?, ?)
  `).run('CERTIFICATE_READY', 'Certificate Available - MINDS TRUST', 'Dear {{studentName}}, your certificate for {{eventTitle}} is approved and available for download.');

  // 12. Seed Email Log
  db.prepare(`
    INSERT INTO email_logs (recipient_email, recipient_name, subject, event_type, status)
    VALUES (?, ?, ?, ?, ?)
  `).run('pooja.kamble@student.mindstrust.org', 'Pooja Kamble', 'Certificate Available: Winter Youth Tech Bootcamp', 'CERTIFICATE_READY', 'Sent');

  // 13. System Settings
  db.prepare(`
    INSERT INTO system_settings (org_name, support_email, phone, address, birthday_categories, update_window_days, auto_cert_generation)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('MINDS TRUST Unified Multi-Portal ERP', 'contact@mindstrust.org', '+91 22 2400 9000', 'MINDS TRUST Tower, Mahatma Gandhi Road, Mumbai 400001', '["STUDENT", "TRAINER", "DONOR"]', 20, 1);

  // 14. Initial Audit Log
  db.prepare(`
    INSERT INTO audit_logs (user_id, user_name, portal, action, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminRes.lastInsertRowid, 'Dr. Ramesh Narayan', 'ADMIN', 'System Initialized', 'MINDS TRUST Unified Multi-Portal ERP database configured');
}

initSchema();
seedData();

module.exports = db;
