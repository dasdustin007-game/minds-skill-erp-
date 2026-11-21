const db = require('./server/database_erp.js');

console.log('Migrating database for Program Management & Advanced Certificate Engine Flow...');

db.exec(`
  -- 1. Programs Table
  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_name TEXT NOT NULL,
    program_abbreviation TEXT NOT NULL,
    program_code TEXT UNIQUE NOT NULL, -- e.g. PRG-FSD-01
    description TEXT,
    duration_weeks INTEGER DEFAULT 12,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Enhanced Students table columns check & addition
  -- (student_status, academic_status, archive_reason, enrolled_date, program_id, program_code)
`);

// Alter students table with safe column addition
const studentCols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);

if (!studentCols.includes('program_id')) {
  db.exec("ALTER TABLE students ADD COLUMN program_id INTEGER REFERENCES programs(id)");
}
if (!studentCols.includes('program_code')) {
  db.exec("ALTER TABLE students ADD COLUMN program_code TEXT");
}
if (!studentCols.includes('student_status')) {
  db.exec("ALTER TABLE students ADD COLUMN student_status TEXT DEFAULT 'Enrolled'"); // Drafted, Enrolled, Joined, Archived
}
if (!studentCols.includes('completion_approved')) {
  db.exec("ALTER TABLE students ADD COLUMN completion_approved INTEGER DEFAULT 0"); // 0: No, 1: Yes
}
if (!studentCols.includes('archive_reason')) {
  db.exec("ALTER TABLE students ADD COLUMN archive_reason TEXT");
}
if (!studentCols.includes('joined_date')) {
  db.exec("ALTER TABLE students ADD COLUMN joined_date DATE");
}
if (!studentCols.includes('notification_sent')) {
  db.exec("ALTER TABLE students ADD COLUMN notification_sent INTEGER DEFAULT 0");
}

// 3. Certificates Table enhancement
const certCols = db.prepare("PRAGMA table_info(certificates)").all().map(c => c.name);

if (!certCols.includes('program_id')) {
  db.exec("ALTER TABLE certificates ADD COLUMN program_id INTEGER REFERENCES programs(id)");
}
if (!certCols.includes('program_name')) {
  db.exec("ALTER TABLE certificates ADD COLUMN program_name TEXT");
}
if (!certCols.includes('program_code')) {
  db.exec("ALTER TABLE certificates ADD COLUMN program_code TEXT");
}
if (!certCols.includes('founder_signature')) {
  db.exec("ALTER TABLE certificates ADD COLUMN founder_signature TEXT DEFAULT 'Dr. Ramesh Narayan (Founder & Managing Trustee)'");
}
if (!certCols.includes('qr_verification_code')) {
  db.exec("ALTER TABLE certificates ADD COLUMN qr_verification_code TEXT");
}
if (!certCols.includes('approval_status')) {
  db.exec("ALTER TABLE certificates ADD COLUMN approval_status TEXT DEFAULT 'Approved'"); // Pending, Approved, Rejected
}
if (!certCols.includes('rejection_reason')) {
  db.exec("ALTER TABLE certificates ADD COLUMN rejection_reason TEXT");
}

// Seed default Programs if none exist
const progCount = db.prepare("SELECT COUNT(*) as c FROM programs").get().c;
if (progCount === 0) {
  const insertProg = db.prepare(`
    INSERT INTO programs (program_name, program_abbreviation, program_code, description, duration_weeks)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertProg.run('Full Stack Digital Skills', 'FSD', 'PRG-FSD-01', 'Complete Full Stack Web Engineering & Cloud Deployment', 16);
  insertProg.run('Community Healthcare Assistant', 'CHA', 'PRG-CHA-02', 'Clinical Diagnostics, Patient Triage & Community Health Services', 20);
  insertProg.run('Digital Accounting & Taxation Masterclass', 'DAT', 'PRG-DAT-03', 'ERP Systems, GST Filing, and Balance Sheet Auditing', 12);
  console.log('Seeded 3 standard Programs.');
}

// Update existing students to link to Program 1
const p1 = db.prepare("SELECT * FROM programs WHERE program_code = 'PRG-FSD-01'").get();
if (p1) {
  db.prepare(`
    UPDATE students 
    SET program_id = ?, program_code = ?, student_status = 'Joined', academic_status = 'In Progress'
    WHERE program_id IS NULL
  `).run(p1.id, p1.program_code);
}

// Update existing certificates with QR code and Program info
const existingCerts = db.prepare("SELECT * FROM certificates WHERE qr_verification_code IS NULL").all();
for (const c of existingCerts) {
  const qrCode = `QR-MINDS-${c.certificate_no.replace(/\//g, '-')}`;
  db.prepare(`
    UPDATE certificates 
    SET program_name = COALESCE(program_name, event_title),
        program_code = COALESCE(program_code, 'PRG-FSD-01'),
        founder_signature = 'Dr. Ramesh Narayan (Founder & Managing Trustee)',
        qr_verification_code = ?,
        approval_status = 'Approved'
    WHERE id = ?
  `).run(qrCode, c.id);
}

console.log('Database schema successfully updated to match the exact Master Flow Diagram!');
