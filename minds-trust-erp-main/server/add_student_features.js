const db = require('./database_erp');

db.exec(`
  CREATE TABLE IF NOT EXISTS student_learning_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER,
    title TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'PDF',
    description TEXT,
    file_or_link TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS student_id_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER UNIQUE NOT NULL,
    card_number TEXT UNIQUE NOT NULL,
    issued_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    barcode_val TEXT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
`);

const resCount = db.prepare('SELECT COUNT(*) as c FROM student_learning_resources').get().c;
if (resCount === 0) {
  const insertRes = db.prepare('INSERT INTO student_learning_resources (course_id, title, resource_type, description, file_or_link) VALUES (?, ?, ?, ?, ?)');
  insertRes.run(1, 'Full Stack Web Engineering Curriculum Handbook', 'PDF', 'Official comprehensive guide, weekly milestones and project specifications', '/uploads/web_curriculum_handbook.pdf');
  insertRes.run(1, 'Database Design & SQL Best Practices Guide', 'PDF / Notes', 'Mastering relational database schemas, transactions, normalization and indexes', '/uploads/sql_best_practices.pdf');
  insertRes.run(1, 'React & TypeScript Enterprise Architecture', 'Repository', 'Source code examples and responsive UI component patterns', 'https://github.com/mindstrust/react-enterprise-kit');
  insertRes.run(1, 'Healthcare Basics & Clinical Diagnostics Guide', 'PDF', 'First aid, vital measurements, medical charting and sterilization protocols', '/uploads/healthcare_fundamentals.pdf');
}

const cardCount = db.prepare('SELECT COUNT(*) as c FROM student_id_cards').get().c;
if (cardCount === 0) {
  const insertCard = db.prepare('INSERT INTO student_id_cards (student_id, card_number, issued_date, valid_until, barcode_val) VALUES (?, ?, ?, ?, ?)');
  insertCard.run(1, 'MIND-ID-2026-001', '2026-01-10', '2027-01-09', 'MINDS*STU*001');
  insertCard.run(2, 'MIND-ID-2026-002', '2026-01-15', '2027-01-14', 'MINDS*STU*002');
}

console.log('Student Extra Features: DB Tables & Seeds Ready!');

