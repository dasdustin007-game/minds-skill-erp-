const db = require('./server/database_erp.js');

// 1. Donor Tax Exemption Certificates (80G Certificates)
db.exec(`
  CREATE TABLE IF NOT EXISTS donor_tax_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cert_number TEXT UNIQUE NOT NULL,
    donor_id INTEGER NOT NULL,
    donation_id INTEGER NOT NULL,
    financial_year TEXT NOT NULL,
    eligible_amount REAL NOT NULL,
    exemption_section TEXT DEFAULT 'Section 80G(5)(vi) of Income Tax Act 1961',
    pan_number TEXT,
    issue_date DATE NOT NULL,
    verification_hash TEXT NOT NULL,
    status TEXT DEFAULT 'Generated',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE RESTRICT,
    FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE RESTRICT
  );

  -- 2. Donor Beneficiary & Project Impact Updates
  CREATE TABLE IF NOT EXISTS donor_impact_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donation_id INTEGER NOT NULL,
    donor_id INTEGER NOT NULL,
    project_title TEXT NOT NULL,
    milestone_summary TEXT NOT NULL,
    beneficiaries_served INTEGER DEFAULT 0,
    impact_metrics TEXT,
    update_date DATE NOT NULL,
    media_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE,
    FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE
  );

  -- 3. Trainer Course Syllabus & Study Modules
  CREATE TABLE IF NOT EXISTS trainer_course_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    course_name TEXT NOT NULL,
    module_title TEXT NOT NULL,
    duration_hours INTEGER NOT NULL,
    status TEXT DEFAULT 'Published',
    learning_outcomes TEXT,
    materials_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
  );

  -- 4. Trainer Event Session Logs & Topic Delivery Tracking
  CREATE TABLE IF NOT EXISTS trainer_session_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trainer_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    session_title TEXT NOT NULL,
    session_date DATE NOT NULL,
    hours_delivered REAL NOT NULL,
    topics_covered TEXT NOT NULL,
    attendance_headcount INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
`);

console.log('Donor and Trainer extended tables created successfully.');

// Seed sample 80G tax certificate for donor 1
const don1 = db.prepare('SELECT id FROM donors LIMIT 1').get();
const donation1 = db.prepare('SELECT id, amount, receipt_no, donor_id FROM donations LIMIT 1').get();

if (don1 && donation1) {
  const existingTax = db.prepare('SELECT id FROM donor_tax_certificates WHERE donation_id = ?').get(donation1.id);
  if (!existingTax) {
    db.prepare(`
      INSERT INTO donor_tax_certificates (cert_number, donor_id, donation_id, financial_year, eligible_amount, exemption_section, pan_number, issue_date, verification_hash)
      VALUES (?, ?, ?, '2026-2027', ?, 'Section 80G of Income Tax Act', 'AAACT2026P', '2026-11-17', 'HASH80G-MINDS-99281726')
    `).run('80G/MINDS/2026-27/0042', donation1.donor_id, donation1.id, donation1.amount);
    console.log('Seeded 80G certificate.');
  }

  const existingImpact = db.prepare('SELECT id FROM donor_impact_updates WHERE donation_id = ?').get(donation1.id);
  if (!existingImpact) {
    db.prepare(`
      INSERT INTO donor_impact_updates (donation_id, donor_id, project_title, milestone_summary, beneficiaries_served, impact_metrics, update_date)
      VALUES (?, ?, 'Vocational IT Labs for Underprivileged Youth', 'Hardware workstations deployed and 40 students enrolled into digital skill certifications.', 40, '100% attendance, 12 projects completed', '2026-11-17')
    `).run(donation1.id, donation1.donor_id);
    console.log('Seeded donor impact update.');
  }
}

// Seed sample trainer modules and session logs for trainer 1
const trainer1 = db.prepare('SELECT id FROM trainers LIMIT 1').get();
const event1 = db.prepare('SELECT id, title FROM events LIMIT 1').get();

if (trainer1) {
  const modCount = db.prepare('SELECT COUNT(*) as c FROM trainer_course_modules WHERE trainer_id = ?').get(trainer1.id).c;
  if (modCount === 0) {
    db.prepare(`
      INSERT INTO trainer_course_modules (trainer_id, course_name, module_title, duration_hours, learning_outcomes, materials_url)
      VALUES 
      (?, 'Full Stack Digital Skills', 'Module 1: Enterprise Web Architecture & API Foundations', 12, 'Master REST standards, auth workflows, and database integration', 'https://minds-trust.org/resources/module1-api.pdf'),
      (?, 'Full Stack Digital Skills', 'Module 2: Relational Schema Design & SQLite Masterclass', 15, 'Master normalization, foreign key integrity, and subqueries', 'https://minds-trust.org/resources/module2-db.pdf'),
      (?, 'Full Stack Digital Skills', 'Module 3: Front-End UI Components & Responsive Layouts', 18, 'Build enterprise dashboard shells with real-time feedback', 'https://minds-trust.org/resources/module3-ui.pdf')
    `).run(trainer1.id, trainer1.id, trainer1.id);
    console.log('Seeded trainer course modules.');
  }

  if (event1) {
    const logCount = db.prepare('SELECT COUNT(*) as c FROM trainer_session_logs WHERE trainer_id = ?').get(trainer1.id).c;
    if (logCount === 0) {
      db.prepare(`
        INSERT INTO trainer_session_logs (trainer_id, event_id, session_title, session_date, hours_delivered, topics_covered, attendance_headcount, notes)
        VALUES 
        (?, ?, 'Session 1: Orientation & Modern Architecture Hands-on', '2026-11-15', 3.5, 'Introduced ERP workflow, database design principles, and role permissions', 18, 'Excellent student enthusiasm; all students set up their environments.'),
        (?, ?, 'Session 2: Full Stack REST API & Session Management', '2026-11-16', 4.0, 'Express routing, session cookies, input validation, and security sanitization', 19, 'Practical labs completed on time.')
      `).run(trainer1.id, event1.id, trainer1.id, event1.id);
      console.log('Seeded trainer session logs.');
    }
  }
}

console.log('Done migrating database for Donor and Trainer portals.');

