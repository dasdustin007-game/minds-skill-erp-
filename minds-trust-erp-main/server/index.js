const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cron = require('node-cron');
const db = require('./database_erp');


try {
  db.prepare("ALTER TABLE programs ADD COLUMN trainer_name TEXT").run();
} catch (e) {}

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Storage for Supporting Documents
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    const uniqueName = `doc_${Date.now()}_${uniqueSuffix}${ext}`;
    cb(null, uniqueName);
  }
});
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB safe limit for receipts and identity verification documents

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  secret: 'minds-trust-erp-secret-token-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 12 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Helper: Audit Logging
function logAudit(userId, userName, portal, action, details, ip = '127.0.0.1') {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, portal, action, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `).run(userId, userName, portal, action, details, ip);
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

// Helper: Email Automation Queue
function queueEmail(recipientEmail, recipientName, subject, eventType) {
  try {
    db.prepare(`
      INSERT INTO email_logs (recipient_email, recipient_name, subject, event_type, status, sent_at)
      VALUES (?, ?, ?, ?, 'Sent', datetime('now', 'localtime'))
    `).run(recipientEmail, recipientName, subject, eventType);
  } catch (err) {
    console.error('Email Queue Error:', err);
  }
}

// Authentication Middleware
function requireAuth(portalExpected) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or not logged in' });
    }
    // Super Admin profile has master access to everything
    if (req.session.user.role === 'Super Admin' || req.session.user.portal_type === 'ADMIN') {
      return next();
    }
    if (portalExpected && req.session.user.portal_type !== portalExpected) {
      return res.status(403).json({ error: `Access Denied: Requires ${portalExpected} portal credentials` });
    }
    next();
  };
}

// Admin / Finance access middleware: Admin profile can access all things including finance
function requireAdminOrFinance(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  const hasAccess = req.session.user.portal_type === 'ADMIN' || req.session.user.role === 'Super Admin';
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access Denied: Administrative authorization privilege required' });
  }
  next();
}

// =========================================================================
// AUTOMATION A: SCHEDULED AUTOMATED CERTIFICATE GENERATION ENGINE
// =========================================================================
function runCertificateAutomationJob() {
  const today = new Date().toISOString().slice(0, 10);

  const candidateEvents = db.prepare(`
    SELECT * FROM events 
    WHERE last_date <= ? AND auto_cert_processed = 0
  `).all(today);

  for (const ev of candidateEvents) {
    const attendees = db.prepare(`
      SELECT er.*, s.id as student_tbl_id, s.student_code, u.full_name as student_name, u.email as student_email
      FROM event_registrations er
      JOIN students s ON er.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE er.event_id = ? AND er.completion_status = 'Completed'
    `).all(ev.id);

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    for (const att of attendees) {
      const existing = db.prepare('SELECT id FROM certificates WHERE event_id = ? AND student_id = ?').get(ev.id, att.student_tbl_id);
      if (!existing) {
        const count = db.prepare('SELECT COUNT(*) as c FROM certificates').get().c + 1;
        const certNo = `EVT/${day}/${month}/${year}/${String(count).padStart(4, '0')}`;

        db.prepare(`
          INSERT INTO certificates (certificate_no, event_id, student_id, student_name, student_code, event_title, event_start, event_completion, issue_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Issued')
        `).run(certNo, ev.id, att.student_tbl_id, att.student_name, att.student_code, ev.title, ev.start_date, ev.last_date, today);

        logAudit(null, 'Automated Engine', 'SYSTEM', 'Certificate Generated', `Generated certificate ${certNo} for student ${att.student_name} (${ev.title})`);
        queueEmail(att.student_email, att.student_name, `Certificate Available: ${ev.title}`, 'CERTIFICATE_READY');
      }
    }

    db.prepare('UPDATE events SET auto_cert_processed = 1, status = "Completed" WHERE id = ?').run(ev.id);
  }
}

cron.schedule('*/10 * * * *', runCertificateAutomationJob);
runCertificateAutomationJob();

// =========================================================================
// 1. AUTHENTICATION & SESSION ENDPOINTS
// =========================================================================

app.post('/api/auth/login', (req, res) => {
  const { identifier, password, expected_portal } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please provide User ID / Email and Password.' });
  }

  const user = db.prepare(`
    SELECT * FROM users 
    WHERE LOWER(user_id) = LOWER(?) OR LOWER(email) = LOWER(?)
  `).get(identifier, identifier);

  if (!user) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  if (user.status !== 'Active') {
    return res.status(403).json({ error: `Account is currently ${user.status}. Please contact administrator.` });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid login credentials.' });
  }

  // Admin profile can access all portals and all features
  if (expected_portal && expected_portal !== user.portal_type && user.portal_type !== 'ADMIN' && user.role !== 'Super Admin') {
    return res.status(403).json({
      error: `Access Denied: This account belongs to ${user.portal_type} Portal, not ${expected_portal} Portal.`
    });
  }

  let linkedId = null;
  if (user.portal_type === 'STUDENT') {
    const s = db.prepare('SELECT id, student_code FROM students WHERE user_id = ?').get(user.id);
    linkedId = s ? s.id : null;
  } else if (user.portal_type === 'DONOR') {
    const d = db.prepare('SELECT id, donor_code FROM donors WHERE user_id = ?').get(user.id);
    linkedId = d ? d.id : null;
  } else if (user.portal_type === 'TRAINER') {
    const t = db.prepare('SELECT id, trainer_code FROM trainers WHERE user_id = ?').get(user.id);
    linkedId = t ? t.id : null;
  }

  req.session.user = {
    id: user.id,
    user_id: user.user_id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    portal_type: user.portal_type,
    role: user.role,
    linked_id: linkedId
  };

  logAudit(user.id, user.full_name, user.portal_type, 'Login', `User signed into ${user.portal_type} Portal`);

  res.json({
    message: 'Login successful',
    user: req.session.user
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session.user) {
    logAudit(req.session.user.id, req.session.user.full_name, req.session.user.portal_type, 'Logout', 'User signed out');
  }
  req.session.destroy(() => res.json({ message: 'Logged out successfully' }));
});

// =========================================================================
// 2. ACCOUNT CREATION
// =========================================================================

app.post('/api/auth/register-student', (req, res) => {
  const { user_id, full_name, email, phone, password, enrolled_program, dob } = req.body;
  if (!user_id || !full_name || !email || !password || !enrolled_program) {
    return res.status(400).json({ error: 'All marked fields are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(user_id) = LOWER(?) OR LOWER(email) = LOWER(?)').get(user_id, email);
  if (existing) return res.status(400).json({ error: 'User ID or Email already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const uRes = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'STUDENT', 'Student', 'Active', ?)
  `).run(user_id, full_name, email, phone || null, hash, dob || null);

  const count = db.prepare('SELECT COUNT(*) as c FROM students').get().c + 1;
  const studentCode = `STU-2026-${String(count).padStart(3, '0')}`;

  db.prepare(`
    INSERT INTO students (user_id, student_code, enrolled_program, batch, academic_status, finance_clearance, dob)
    VALUES (?, ?, ?, 'Cohort 2026', 'Enrolled', 1, ?)
  `).run(uRes.lastInsertRowid, studentCode, enrolled_program, dob || null);

  logAudit(uRes.lastInsertRowid, full_name, 'STUDENT', 'Registration', `Student registered with code: ${studentCode}`);
  queueEmail(email, full_name, 'Student Account Created - MINDS TRUST ERP', 'REGISTRATION');

  res.json({ message: 'Student account created successfully! You can now log in.', student_code: studentCode });
});

app.post('/api/auth/register-donor', (req, res) => {
  const { user_id, full_name, email, phone, password, address, pan_number, donor_category, dob } = req.body;
  if (!user_id || !full_name || !email || !phone || !password) {
    return res.status(400).json({ error: 'All marked fields are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(user_id) = LOWER(?) OR LOWER(email) = LOWER(?)').get(user_id, email);
  if (existing) return res.status(400).json({ error: 'User ID or Email already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const uRes = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'DONOR', 'Donor', 'Active', ?)
  `).run(user_id, full_name, email, phone, hash, dob || null);

  const randomSuffix = crypto.randomInt(1000, 10000);
  const donorCode = `DNR-${randomSuffix}`;

  db.prepare(`
    INSERT INTO donors (user_id, donor_code, full_name, email, phone, address, pan_number, donor_category, dob)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uRes.lastInsertRowid, donorCode, full_name, email, phone, address || '', (pan_number || '').toUpperCase(), donor_category || 'Individual', dob || null);

  logAudit(uRes.lastInsertRowid, full_name, 'DONOR', 'Registration', `Donor registered with ID: ${donorCode}`);
  queueEmail(email, full_name, 'Welcome to Donor Portal - MINDS TRUST ERP', 'REGISTRATION');

  res.json({ message: 'Donor registered successfully! Your Donor ID is: ' + donorCode, donor_code: donorCode });
});

// =========================================================================
// 3. ADMIN PORTAL APIS
// =========================================================================

// Fixed string literals in SQLite queries to resolve any syntax issues
app.get('/api/admin/overview', requireAuth('ADMIN'), (req, res) => {
  try {
    const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    const activeStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status != 'Archived'").get().c;
    const joinedStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status = 'Joined'").get().c;
    const totalDonors = db.prepare('SELECT COUNT(*) as c FROM donors').get().c;
    const totalTrainers = db.prepare('SELECT COUNT(*) as c FROM trainers').get().c;
    const totalEvents = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
    const certsGenerated = db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status = 'Issued'").get().c;
    const certsPending = db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status != 'Issued'").get().c;
    const totalFinanceInflow = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM finance_records WHERE category = 'Donation Inflow'").get().s;

    const upcomingEvents = db.prepare('SELECT * FROM events ORDER BY start_date ASC LIMIT 5').all();
    const pendingApprovals = db.prepare("SELECT * FROM donations WHERE payment_status = 'Pending' OR doc_status = 'Pending Review' LIMIT 5").all();

    res.json({
      stats: {
        totalStudents,
        activeStudents,
        joinedStudents,
        totalDonors,
        totalTrainers,
        totalEvents,
        certsGenerated,
        certsPending,
        totalFinanceInflow,
        pendingApprovalsCount: pendingApprovals.length
      },
      upcomingEvents,
      pendingApprovals
    });
  } catch (err) {
    console.error('Error in /api/admin/overview:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/special-dates', requireAuth('ADMIN'), (req, res) => {
  const usersWithDob = db.prepare(`
    SELECT u.id, u.full_name, u.portal_type, u.role, u.dob, u.email, u.phone 
    FROM users u 
    WHERE u.dob IS NOT NULL
  `).all();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  const birthdayList = usersWithDob.map(u => {
    const dob = new Date(u.dob);
    const bMonth = dob.getMonth() + 1;
    const bDay = dob.getDate();

    let nextBday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBday < now && nextBday.toDateString() !== now.toDateString()) {
      nextBday = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
    }
    const diffTime = nextBday - now;
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      id: u.id,
      name: u.full_name,
      category: u.portal_type,
      role: u.role,
      dob: u.dob,
      month: bMonth,
      day: bDay,
      days_remaining: daysRemaining,
      is_current_month: bMonth === currentMonth,
      contact: u.email
    };
  }).sort((a, b) => a.days_remaining - b.days_remaining);

  res.json({ birthdayList });
});

app.get('/api/admin/students/counts', requireAuth('ADMIN'), (req, res) => {
  const all = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
  const drafted = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status = 'Drafted'").get().c;
  const enrolled = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status = 'Enrolled'").get().c;
  const joined = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status = 'Joined'").get().c;
  const completed = db.prepare("SELECT COUNT(*) as c FROM students WHERE academic_status = 'Completed'").get().c;
  const archived = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status = 'Archived'").get().c;
  res.json({ counts: { all, drafted, enrolled, joined, completed, archived } });
});

// Student Calendar & Enrollment Tracking Endpoint
app.get('/api/admin/students/calendar-events', requireAuth('ADMIN'), (req, res) => {
  try {
    // Gather enrollments with student profile and course information
    const enrollments = db.prepare(`
      SELECT 
        sce.id as enrollment_id,
        sce.student_id,
        sce.program_id,
        sce.course_name,
        sce.course_code,
        COALESCE(sce.enrolled_date, s.joined_date, '2026-11-01') as enrollment_date,
        sce.academic_status,
        sce.completion_approved,
        sce.completion_date,
        sce.certificate_id,
        s.student_code,
        s.student_status,
        s.batch,
        s.joined_date,
        u.full_name as student_name,
        u.email,
        u.phone,
        p.program_name as canonical_prog_name,
        p.program_code as canonical_prog_code,
        c.certificate_no,
        c.approval_status as cert_approval_status
      FROM student_course_enrollments sce
      JOIN students s ON sce.student_id = s.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN programs p ON sce.program_id = p.id
      LEFT JOIN certificates c ON sce.certificate_id = c.id
      ORDER BY enrollment_date ASC, s.student_code ASC
    `).all();

    // Map each student's full list of courses for the detail popup
    const studentMap = {};
    for (const e of enrollments) {
      if (!studentMap[e.student_id]) {
        studentMap[e.student_id] = {
          id: e.student_id,
          student_code: e.student_code,
          full_name: e.student_name,
          email: e.email,
          phone: e.phone,
          student_status: e.student_status,
          batch: e.batch,
          joined_date: e.joined_date,
          courses: []
        };
      }
      studentMap[e.student_id].courses.push({
        id: e.enrollment_id,
        course_name: e.course_name,
        course_code: e.course_code,
        enrolled_date: e.enrollment_date,
        academic_status: e.academic_status,
        completion_approved: e.completion_approved,
        completion_date: e.completion_date,
        certificate_id: e.certificate_id,
        certificate_no: e.certificate_no
      });
    }

    // Attach student_obj to each enrollment record for instant popup invocation
    const records = enrollments.map(e => ({
      ...e,
      student_obj: studentMap[e.student_id]
    }));

    // Group by enrollment_date YYYY-MM-DD
    const dateMap = {};
    for (const r of records) {
      const d = r.enrollment_date;
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(r);
    }

    res.json({ success: true, records, dateMap });
  } catch (err) {
    console.error('Error fetching student calendar events:', err);
    res.status(500).json({ error: 'Failed to load calendar events', details: err.message });
  }
});

// -------------------------------------------------------------------------
// PROGRAM MANAGEMENT ENDPOINTS (Master Flow: Create Program -> Generate Abbr -> Generate Unique Program Code)
// -------------------------------------------------------------------------
app.get('/api/admin/programs', requireAuth('ADMIN'), (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : null;
  let query = `
    SELECT p.*,
    (SELECT COUNT(*) FROM students WHERE program_id = p.id) as student_count
    FROM programs p
  `;
  const params = [];
  if (search) {
    query += ` WHERE (p.program_name LIKE ? OR p.program_code LIKE ? OR p.program_abbreviation LIKE ?)`;
    params.push(search, search, search);
  }
  query += ` ORDER BY p.id DESC`;
  const programs = db.prepare(query).all(...params);
  
  // Attach enrolled students list for interactive modal inspection
  programs.forEach(p => {
    p.enrolled_student_list = db.prepare(`
      SELECT s.id, s.student_code, u.full_name, u.email, u.phone, s.student_status, s.academic_status
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.program_id = ?
    `).all(p.id);
  });

  res.json({ programs });
});

app.post('/api/admin/programs', requireAuth('ADMIN'), (req, res) => {
  const { program_name, duration_weeks, description, trainer_name } = req.body;
  if (!program_name) return res.status(400).json({ error: 'Program Name is required.' });

  // Generate Program Abbreviation automatically (e.g. "Full Stack Development" -> "FSD")
  const words = program_name.trim().split(/\s+/);
  let abbr = '';
  if (words.length === 1) {
    abbr = words[0].substring(0, 3).toUpperCase();
  } else {
    abbr = words.map(w => w.charAt(0).toUpperCase()).slice(0, 4).join('');
  }

  // Generate Unique Program Code (e.g. PRG-FSD-01)
  const count = db.prepare('SELECT COUNT(*) as c FROM programs').get().c + 1;
  const program_code = `PRG-${abbr}-${String(count).padStart(2, '0')}`;

  const result = db.prepare(`
    INSERT INTO programs (program_name, program_abbreviation, program_code, description, duration_weeks, trainer_name, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Active')
  `).run(program_name, abbr, program_code, description || '', Number.parseInt(duration_weeks, 10) || 12, trainer_name || '');

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Create Program', `Created Program ${program_name} with Unique Code ${program_code}`);
  res.json({ message: 'Program created successfully', program_code, program_id: result.lastInsertRowid, abbreviation: abbr });
});

// -------------------------------------------------------------------------
// STUDENT MANAGEMENT ENDPOINTS (Master Flow: Registration -> Student Code -> Select Program -> Fetch Code -> Assign)
// -------------------------------------------------------------------------
app.get('/api/admin/students', requireAuth('ADMIN'), (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : '%';
  const statusFilter = req.query.status;

  let query = `
    SELECT s.*, u.full_name, u.email, u.phone, u.status as user_status, p.program_name,
      c.id as certificate_id, c.certificate_no, c.approval_status as cert_approval_status, c.issue_date as cert_issue_date,
      (SELECT COUNT(*) FROM certificates WHERE student_id = s.id) as cert_count,
      (SELECT COUNT(*) FROM event_registrations WHERE student_id = s.id) as event_count
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN programs p ON s.program_id = p.id
    LEFT JOIN certificates c ON c.student_id = s.id
    WHERE (u.full_name LIKE ? OR s.student_code LIKE ? OR u.email LIKE ? OR s.program_code LIKE ?)
  `;
  const params = [search, search, search, search];

  if (statusFilter && statusFilter !== 'ALL') {
    query += ` AND (s.student_status = ? OR s.academic_status = ?)`;
    params.push(statusFilter, statusFilter);
  }

  query += ` ORDER BY s.id DESC`;

  const students = db.prepare(query).all(...params);

  // Fetch all enrolled courses for each student from student_course_enrollments
  for (const st of students) {
    try {
      const enrollments = db.prepare(`
        SELECT sce.*, p.program_name as canonical_prog_name, p.program_abbreviation,
               c.certificate_no, c.approval_status as cert_approval_status, c.status as cert_status
        FROM student_course_enrollments sce
        LEFT JOIN programs p ON sce.program_id = p.id
        LEFT JOIN certificates c ON sce.certificate_id = c.id
        WHERE sce.student_id = ?
        ORDER BY sce.id ASC
      `).all(st.id);

      if (enrollments && enrollments.length > 0) {
        st.courses = enrollments;
      } else {
        // Fallback to default enrolled program if table has no entry
        st.courses = [{
          id: 0,
          student_id: st.id,
          program_id: st.program_id,
          course_name: st.program_name || st.enrolled_program,
          course_code: st.program_code || 'PRG-FSD-01',
          academic_status: st.academic_status || 'In Progress',
          completion_approved: st.completion_approved || 0,
          certificate_id: st.certificate_id || null,
          certificate_no: st.certificate_no || null
        }];
      }
    } catch (err) {
      console.debug('Failed to fetch student enrolled courses:', err?.message || err);
      st.courses = [];
    }
  }

  res.json({ students });
});

app.post('/api/admin/students', requireAuth('ADMIN'), (req, res) => {
  const { full_name, user_id, email, phone, password, program_id, batch, dob, student_status } = req.body;
  if (!full_name || !user_id || !email || !password || !program_id) {
    return res.status(400).json({ error: 'Full name, User ID, email, password, and Program are required.' });
  }

  // Fetch Existing Program Code
  const prog = db.prepare('SELECT id, program_name, program_code FROM programs WHERE id = ?').get(program_id);
  if (!prog) return res.status(400).json({ error: 'Selected program not found' });

  // Check unique user
  const existUser = db.prepare('SELECT id FROM users WHERE LOWER(user_id) = LOWER(?) OR LOWER(email) = LOWER(?)').get(user_id, email);
  if (existUser) return res.status(400).json({ error: 'User ID or Email already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const u = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'STUDENT', 'Student', 'Active', ?)
  `).run(user_id, full_name, email, phone, hash, dob || null);

  // Generate Unique Student Code: STU-2026-XXX
  const count = db.prepare('SELECT COUNT(*) as c FROM students').get().c + 1;
  const studentCode = `STU-2026-${String(count).padStart(3, '0')}`;
  const initialStatus = student_status || 'Drafted'; // Drafted or Enrolled or Joined
  const initialAcademic = initialStatus === 'Joined' ? 'In Progress' : 'Pending';

  const sResult = db.prepare(`
    INSERT INTO students (user_id, student_code, enrolled_program, program_id, program_code, batch, student_status, academic_status, finance_clearance, dob, joined_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(u.lastInsertRowid, studentCode, prog.program_name, prog.id, prog.program_code, batch || 'Cohort 2026', initialStatus, initialAcademic, dob || null, initialStatus === 'Joined' ? new Date().toISOString().slice(0, 10) : null);

  // Create Student ID Card automatically
  const cardNo = `MIND-ID-2026-${String(count).padStart(3, '0')}`;
  db.prepare(`
    INSERT INTO student_id_cards (student_id, card_number, issued_date, valid_until, barcode_val)
    VALUES (?, ?, ?, '2027-12-31', ?)
  `).run(sResult.lastInsertRowid, cardNo, new Date().toISOString().slice(0, 10), `MINDS*${studentCode}`);

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Register Student', `Registered student ${full_name} (${studentCode}) assigned to ${prog.program_name} (${prog.program_code})`);
  res.json({ message: 'Student registered successfully', student_code: studentCode, program_code: prog.program_code });
});

// Update Student Status (e.g. Drafted -> Enrolled -> Joined, or Archive)
app.put('/api/admin/students/:id/status', requireAuth('ADMIN'), (req, res) => {
  const { id } = req.params;
  const { student_status, archive_reason } = req.body; // 'Enrolled', 'Joined', 'Archived'

  const student = db.prepare('SELECT s.*, u.full_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  let academicStatus = student.academic_status;
  let joinedDate = student.joined_date;

  if (student_status === 'Joined') {
    academicStatus = 'In Progress';
    joinedDate = joinedDate || new Date().toISOString().slice(0, 10);
  } else if (student_status === 'Archived') {
    academicStatus = 'Archived';
  }

  db.prepare(`
    UPDATE students 
    SET student_status = ?, academic_status = ?, archive_reason = ?, joined_date = ?
    WHERE id = ?
  `).run(student_status, academicStatus, archive_reason || null, joinedDate, id);

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Update Student Status', `Changed status of ${student.full_name} to ${student_status}`);
  res.json({ message: `Student status successfully updated to ${student_status}` });
});

// Update Student Academic Status (In Progress -> Completed Verification -> Completion Approved)
app.put('/api/admin/students/:id/academic', requireAuth('ADMIN'), (req, res) => {
  const { id } = req.params;
  const { academic_status, completion_approved } = req.body;

  const student = db.prepare('SELECT s.*, u.full_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  db.prepare(`
    UPDATE students 
    SET academic_status = ?, completion_approved = ?
    WHERE id = ?
  `).run(academic_status, completion_approved ? 1 : 0, id);

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Student Academic Tracking', `Updated academic status for ${student.full_name} to ${academic_status} (Approved: ${completion_approved ? 'Yes' : 'No'})`);
  res.json({ message: `Student academic status set to ${academic_status}` });
});

// 7-Day Notification Automation Simulation (Flow: 7 Day Notification Automation -> Student Joined? -> Yes: Joined Students / No: Expired Student Archive)
app.post('/api/admin/students/run-7day-automation', requireAuth('ADMIN'), (req, res) => {
  // Finds drafted/enrolled students where joined = 0
  const pendingStudents = db.prepare(`
    SELECT s.id, u.full_name, s.student_code, s.student_status
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.student_status IN ('Drafted', 'Enrolled')
  `).all();

  let notifiedCount = 0;

  for (const st of pendingStudents) {
    if (st.student_status === 'Drafted') {
      // Transition to Enrolled and trigger 7-day notification
      db.prepare("UPDATE students SET student_status = 'Enrolled', notification_sent = 1 WHERE id = ?").run(st.id);
      notifiedCount++;
    }
  }

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', '7-Day Automation', `Executed 7-Day Notification Automation: ${notifiedCount} notifications sent.`);
  res.json({ message: `7-Day Notification Automation Executed: ${notifiedCount} enrolled students notified.` });
});

// -------------------------------------------------------------------------
// ADVANCED CERTIFICATE ENGINE ENDPOINTS (Master Flow: Fetch Details -> Generate Unique Cert No -> Generate PDF -> Founder Approval -> Issue/Reject -> Public Search)
// -------------------------------------------------------------------------

// Generate Certificate for a verified/completed student
app.post('/api/admin/certificates/generate', requireAuth('ADMIN'), (req, res) => {
  const { student_id, event_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Student ID is required.' });

  const student = db.prepare(`
    SELECT s.*, u.full_name, u.email, p.program_name as prog_title, p.program_code as prog_cd
    FROM students s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN programs p ON s.program_id = p.id
    WHERE s.id = ?
  `).get(student_id);

  if (!student) return res.status(404).json({ error: 'Student record not found' });
  if (student.academic_status !== 'Completed' && student.completion_approved !== 1) {
    return res.status(400).json({ error: 'Student academic status must be "Completed" with Completion Approved = Yes to generate certificate.' });
  }

  // Check if certificate already exists
  const existing = db.prepare('SELECT * FROM certificates WHERE student_id = ? AND program_code = ?').get(student_id, student.program_code || student.prog_cd);
  if (existing) {
    return res.status(400).json({ error: `Certificate already generated (${existing.certificate_no}) with status ${existing.approval_status}.` });
  }

  // Generate Unique Certificate Number: EVT/DD/MM/YYYY/XXXX
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const count = db.prepare('SELECT COUNT(*) as c FROM certificates').get().c + 1;
  const certNo = `EVT/${day}/${month}/${year}/${String(count).padStart(4, '0')}`;
  const qrVerificationCode = `QR-MINDS-${certNo.replaceAll('/', '-')}`;
  const today = now.toISOString().slice(0, 10);

  // Link to event if provided or find linked event
  let evId = event_id;
  let evStart = '2026-01-15';
  let evLast = today;
  let evTitle = student.enrolled_program || student.prog_title;

  if (evId) {
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(evId);
    if (ev) {
      evStart = ev.start_date;
      evLast = ev.last_date;
      evTitle = ev.title;
    }
  } else {
    // Default fallback event ID 1
    const defaultEv = db.prepare('SELECT id, title, start_date, last_date FROM events LIMIT 1').get();
    if (defaultEv) {
      evId = defaultEv.id;
      evStart = defaultEv.start_date;
      evLast = defaultEv.last_date;
    } else {
      evId = 1;
    }
  }

  db.prepare(`
    INSERT INTO certificates (
      certificate_no, event_id, student_id, student_name, student_code,
      event_title, program_id, program_name, program_code,
      event_start, event_completion, issue_date, status, approval_status,
      founder_signature, qr_verification_code
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Approval', 'Pending', 'Dr. Ramesh Narayan (Founder & Managing Trustee)', ?)
  `).run(
    certNo, evId, student.id, student.full_name, student.student_code,
    evTitle, student.program_id, student.prog_title || student.enrolled_program, student.program_code || student.prog_cd,
    evStart, evLast, today, qrVerificationCode
  );

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Certificate Engine', `Generated certificate draft ${certNo} for student ${student.full_name} awaiting Founder Approval.`);
  res.json({ message: 'Certificate PDF drafted! Sent to Founder Approval step.', certificate_no: certNo });
});

// Founder Approval Decision: Approved -> Issue Certificate / Rejected -> Return for Correction
app.put('/api/admin/certificates/:id/founder-approval', requireAuth('ADMIN'), (req, res) => {
  const { id } = req.params;
  const { decision, rejection_reason } = req.body; // 'Approved' or 'Rejected'

  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  if (!cert) return res.status(404).json({ error: 'Certificate not found' });

  if (decision === 'Approved') {
    db.prepare(`
      UPDATE certificates
      SET approval_status = 'Approved', status = 'Issued', rejection_reason = NULL
      WHERE id = ?
    `).run(id);

    // Queue congratulations email
    const student = db.prepare('SELECT u.email, u.full_name FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(cert.student_id);
    if (student) {
      queueEmail(student.email, student.full_name, `Official Certificate Issued: ${cert.program_name || cert.event_title}`, 'CERTIFICATE_READY');
    }

    logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Founder Approval', `Approved and Issued Certificate ${cert.certificate_no} for ${cert.student_name}`);
    res.json({ message: `Certificate ${cert.certificate_no} approved and officially issued! Saved to Certificate Archive.` });
  } else {
    db.prepare(`
      UPDATE certificates
      SET approval_status = 'Rejected', status = 'Draft', rejection_reason = ?
      WHERE id = ?
    `).run(rejection_reason || 'Certificate returned for correction', id);

    logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Founder Approval', `Rejected Certificate ${cert.certificate_no} - Returned for Correction`);
    res.json({ message: `Certificate ${cert.certificate_no} rejected and returned for correction.` });
  }
});

// Public / Archive Certificate Verification Search (Search by Student Name, Student Code, Program Name, Program Code, Certificate Number)
app.get('/api/certificates/verify', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ results: [] });

  const term = `%${q.trim()}%`;
  const results = db.prepare(`
    SELECT c.*, p.program_name as canonical_program_name, p.program_abbreviation
    FROM certificates c
    LEFT JOIN programs p ON c.program_id = p.id
    WHERE (
      c.certificate_no LIKE ? OR 
      c.student_name LIKE ? OR 
      c.student_code LIKE ? OR 
      c.program_code LIKE ? OR 
      c.program_name LIKE ? OR
      c.event_title LIKE ? OR
      p.program_name LIKE ? OR
      c.qr_verification_code LIKE ?
    )
    ORDER BY c.id DESC
  `).all(term, term, term, term, term, term, term, term);

  res.json({ results });
});

// Get single certificate by ID
app.get('/api/certificates/:id', (req, res) => {
  const cert = db.prepare(`
    SELECT c.*, p.program_name as canonical_program_name, p.program_abbreviation
    FROM certificates c
    LEFT JOIN programs p ON c.program_id = p.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!cert) return res.status(404).json({ error: 'Certificate not found' });
  res.json({ certificate: cert });
});

app.get('/api/admin/donors', requireAuth('ADMIN'), (req, res) => {
  const search = req.query.search ? `% ${ req.query.search.trim() } % ` : null;
  let query = `
    SELECT d.*,
    (SELECT COUNT(*) FROM donations WHERE donor_id = d.id) as donation_count,
  (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE donor_id = d.id) as total_contributed
    FROM donors d
  `;
const params = [];
if (search) {
  query += ` WHERE (d.full_name LIKE ? OR d.donor_code LIKE ? OR d.email LIKE ? OR d.phone LIKE ? OR d.pan_number LIKE ?)`;
  params.push(search, search, search, search, search);
}
query += ` ORDER BY d.id DESC`;
const donors = db.prepare(query).all(...params);
res.json({ donors });
});

app.get('/api/admin/donations', requireAuth('ADMIN'), (req, res) => {
  const donations = db.prepare(`
    SELECT don.*, d.donor_code, d.full_name as donor_name, d.phone as donor_phone, d.pan_number,
      tc.cert_number as tax_cert_number, tc.financial_year, tc.issue_date as cert_issue_date
    FROM donations don
    JOIN donors d ON don.donor_id = d.id
    LEFT JOIN donor_tax_certificates tc ON tc.donation_id = don.id
    ORDER BY don.id DESC
  `).all();
  res.json({ donations });
});

app.put('/api/admin/donations/:id/review', requireAuth('ADMIN'), (req, res) => {
  const { id } = req.params;
  let { payment_status, doc_status, admin_comments } = req.body;
  if (payment_status === 'Approved') payment_status = 'Verified';

  db.prepare(`
    UPDATE donations 
    SET payment_status = ?, doc_status = ?, admin_comments = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(payment_status, doc_status, admin_comments, id);

  const don = db.prepare('SELECT d.full_name, d.email, don.receipt_no FROM donations don JOIN donors d ON don.donor_id = d.id WHERE don.id = ?').get(id);
  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Donation Review', `Reviewed donation #${id} (${payment_status})`);
  queueEmail(don.email, don.full_name, `Donation Status Update - Receipt ${don.receipt_no}`, 'DONATION_ACK');

  res.json({ message: 'Donation status updated and donor notified' });
});

app.get('/api/admin/trainers', requireAuth('ADMIN'), (req, res) => {
  const trainers = db.prepare(`
    SELECT t.*, u.full_name, u.email, u.phone, u.status as user_status,
      (SELECT COUNT(*) FROM events WHERE trainer_id = t.id) as event_count,
      (SELECT COUNT(*) FROM courses WHERE trainer_id = t.id) as course_count
    FROM trainers t
    JOIN users u ON t.user_id = u.id
    ORDER BY t.id DESC
  `).all();

  // Attach assigned events list for modal inspection
  trainers.forEach(t => {
    t.assigned_events = db.prepare(`
      SELECT id, event_code, title, start_date, last_date, status, venue
      FROM events
      WHERE trainer_id = ?
      ORDER BY id DESC
    `).all(t.id);
  });

  res.json({ trainers });
});

app.post('/api/admin/trainers', requireAuth('ADMIN'), (req, res) => {
  const { full_name, user_id, email, phone, password, specialization, qualification, dob } = req.body;
  if (!full_name || !user_id || !email || !password || !specialization) {
    return res.status(400).json({ error: 'All core trainer fields required.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const u = db.prepare(`
    INSERT INTO users (user_id, full_name, email, phone, password_hash, portal_type, role, status, dob)
    VALUES (?, ?, ?, ?, ?, 'TRAINER', 'Trainer', 'Active', ?)
  `).run(user_id, full_name, email, phone, hash, dob || null);

  const count = db.prepare('SELECT COUNT(*) as c FROM trainers').get().c + 1;
  const code = `TRN-${100 + count}`;

  db.prepare(`
    INSERT INTO trainers (user_id, trainer_code, specialization, qualification, dob)
    VALUES (?, ?, ?, ?, ?)
  `).run(u.lastInsertRowid, code, specialization, qualification || '', dob || null);

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Add Trainer', `Created trainer ${full_name} (${code})`);
  res.json({ message: 'Trainer enrolled successfully', trainer_code: code });
});

app.get('/api/admin/events', requireAuth('ADMIN'), (req, res) => {
  const events = db.prepare(`
    SELECT ev.*, t.trainer_code, u.full_name as trainer_name,
      (SELECT COUNT(*) FROM event_registrations WHERE event_id = ev.id) as attendee_count,
      (SELECT COUNT(*) FROM certificates WHERE event_id = ev.id) as cert_count
    FROM events ev
    LEFT JOIN trainers t ON ev.trainer_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    ORDER BY ev.id DESC
  `).all();

  const totalEnrolled = db.prepare("SELECT COUNT(*) as c FROM students WHERE student_status IN ('Joined', 'Enrolled')").get().c;
  const totalCompleted = db.prepare("SELECT COUNT(*) as c FROM students WHERE academic_status = 'Completed'").get().c;

  events.forEach(ev => {
    if (ev.status === 'Completed') {
      ev.attendee_count = totalCompleted || ev.attendee_count || 12;
      ev.attendee_type = 'Completed';
    } else {
      ev.attendee_count = totalEnrolled || ev.attendee_count || 18;
      ev.attendee_type = 'Enrolled';
    }
  });

  res.json({ events });
});

app.post('/api/admin/events', requireAuth('ADMIN'), (req, res) => {
  const { title, description, start_date, last_date, trainer_id, venue } = req.body;
  if (!title || !start_date || !last_date) {
    return res.status(400).json({ error: 'Title, Start Date, and Last Date are required.' });
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM events').get().c + 1;
  const eventCode = `EVT-2026-${String(count).padStart(2, '0')}`;

  db.prepare(`
    INSERT INTO events (event_code, title, description, start_date, last_date, trainer_id, venue, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Scheduled')
  `).run(eventCode, title, description, start_date, last_date, trainer_id || null, venue || 'Main Campus');

  logAudit(req.session.user.id, req.session.user.full_name, 'ADMIN', 'Create Event', `Created event ${title} (${eventCode})`);
  res.json({ message: 'Event scheduled successfully', event_code: eventCode });
});

app.post('/api/admin/certificates/trigger-engine', requireAuth('ADMIN'), (req, res) => {
  runCertificateAutomationJob();
  res.json({ message: 'Certificate generation automation run completed.' });
});

app.get('/api/admin/certificates', requireAuth('ADMIN'), (req, res) => {
  const certs = db.prepare(`
    SELECT c.*, ev.title as event_title, ev.event_code 
    FROM certificates c
    JOIN events ev ON c.event_id = ev.id
    ORDER BY c.id DESC
  `).all();
  res.json({ certificates: certs });
});

app.get('/api/admin/email-logs', requireAuth('ADMIN'), (req, res) => {
  const logs = db.prepare('SELECT * FROM email_logs ORDER BY id DESC LIMIT 50').all();
  const templates = db.prepare('SELECT * FROM email_templates').all();
  res.json({ logs, templates });
});

app.get('/api/admin/audit-logs', requireAuth('ADMIN'), (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  res.json({ logs });
});

// =========================================================================
// 4. STUDENT PORTAL APIS (ENHANCED WITH EXTRA FEATURES)
// =========================================================================
app.get('/api/student/dashboard', requireAuth('STUDENT'), (req, res) => {
  const student = db.prepare(`
    SELECT s.*, u.full_name, u.email, u.phone, u.dob 
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE u.id = ?
  `).get(req.session.user.id);

  if (!student) return res.status(404).json({ error: 'Student record not found' });

  // Student registered events
  const registeredEvents = db.prepare(`
    SELECT er.*, ev.title, ev.event_code, ev.start_date, ev.last_date, ev.venue, ev.status as event_status
    FROM event_registrations er
    JOIN events ev ON er.event_id = ev.id
    WHERE er.student_id = ?
    ORDER BY ev.start_date DESC
  `).all(student.id);

  // Student approved certificates
  const certificates = db.prepare(`
    SELECT * FROM certificates 
    WHERE student_id = ? AND status = 'Issued'
    ORDER BY issue_date DESC
  `).all(student.id);

  // EXTRA FEATURE 1: Official Student ID Card with Barcode
  const idCard = db.prepare(`
    SELECT * FROM student_id_cards WHERE student_id = ?
  `).get(student.id);

  // EXTRA FEATURE 2: Learning Resources Library (Course notes, PDFs, guides)
  const resources = db.prepare(`
    SELECT * FROM student_learning_resources ORDER BY id ASC
  `).all();

  // EXTRA FEATURE 3: Available Upcoming Events for 1-Click Enrollment
  const availableEvents = db.prepare(`
    SELECT ev.*, u.full_name as trainer_name
    FROM events ev
    LEFT JOIN trainers t ON ev.trainer_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE ev.status = 'Scheduled'
      AND ev.id NOT IN (SELECT event_id FROM event_registrations WHERE student_id = ?)
    ORDER BY ev.start_date ASC
  `).all(student.id);

  res.json({
    student,
    registeredEvents,
    certificates,
    idCard,
    resources,
    availableEvents
  });
});

// EXTRA FEATURE: 1-Click Event Enrollment by Student
app.post('/api/student/enroll-event/:eventId', requireAuth('STUDENT'), (req, res) => {
  const { eventId } = req.params;
  const student = db.prepare('SELECT s.id as student_id, u.full_name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?').get(req.session.user.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const existing = db.prepare('SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?').get(eventId, student.student_id);
  if (existing) return res.status(400).json({ error: 'Already registered for this event.' });

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO event_registrations (event_id, student_id, registration_date, attendance_status, completion_status, marks_or_grade, trainer_remarks)
    VALUES (?, ?, ?, 'Present', 'In Progress', 'Enrolled', 'Self-enrolled via Student Portal')
  `).run(eventId, student.student_id, today);

  const ev = db.prepare('SELECT title FROM events WHERE id = ?').get(eventId);
  logAudit(req.session.user.id, student.full_name, 'STUDENT', 'Event Enrollment', `Enrolled in event: ${ev?.title}`);
  queueEmail(student.email, student.full_name, `Enrollment Confirmed: ${ev?.title}`, 'EVENT_NOTIFICATION');

  res.json({ message: `Successfully enrolled in ${ev?.title}!` });
});

// EXTRA FEATURE: Profile and Contact Update by Student
app.put('/api/student/profile', requireAuth('STUDENT'), (req, res) => {
  const { phone, email, current_password, new_password } = req.body;
  const userId = req.session.user.id;

  if (new_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password is required to change password.' });
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!bcrypt.compareSync(current_password, u.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET phone = ?, email = ?, password_hash = ? WHERE id = ?').run(phone, email, hash, userId);
  } else {
    db.prepare('UPDATE users SET phone = ?, email = ? WHERE id = ?').run(phone, email, userId);
  }

  logAudit(userId, req.session.user.full_name, 'STUDENT', 'Profile Update', 'Updated contact details or password');
  res.json({ message: 'Student profile updated successfully.' });
});

// =========================================================================
// 5. DONOR PORTAL APIS (with 20-Day Update Window Logic & 80G Tax Exemption)
// =========================================================================
app.get('/api/donor/dashboard', requireAuth('DONOR'), (req, res) => {
  const donor = db.prepare(`
    SELECT d.*, u.user_id, u.email, u.phone, u.dob
    FROM donors d
    JOIN users u ON d.user_id = u.id
    WHERE u.id = ?
  `).get(req.session.user.id);

  if (!donor) return res.status(404).json({ error: 'Donor record not found' });

  const donations = db.prepare(`
    SELECT don.*, 
      ROUND((julianday('now', 'localtime') - julianday(don.created_at))) as days_since_created
    FROM donations don
    WHERE don.donor_id = ?
    ORDER BY don.id DESC
  `).all(donor.id);

  for (const d of donations) {
    d.window_remaining = Math.max(0, d.update_window_days - (d.days_since_created || 0));
    d.can_edit = d.window_remaining > 0 && d.is_locked === 0;
  }

  const purposes = db.prepare('SELECT * FROM donation_purposes ORDER BY id ASC').all();

  // Donor Tax Exemption Certificates (80G)
  const taxCertificates = db.prepare(`
    SELECT tc.*, don.receipt_no, don.purpose_name, don.donation_date
    FROM donor_tax_certificates tc
    JOIN donations don ON tc.donation_id = don.id
    WHERE tc.donor_id = ?
    ORDER BY tc.issue_date DESC
  `).all(donor.id);

  // Beneficiary and Project Impact Updates
  const impactUpdates = db.prepare(`
    SELECT di.*, don.receipt_no
    FROM donor_impact_updates di
    JOIN donations don ON di.donation_id = don.id
    WHERE di.donor_id = ?
    ORDER BY di.update_date DESC
  `).all(donor.id);

  res.json({
    donor,
    donations,
    purposes,
    taxCertificates,
    impactUpdates
  });
});

app.post('/api/donor/donations', requireAuth('DONOR'), upload.single('supporting_document'), (req, res) => {
  const { amount, purpose_name, beneficiary_target, payment_method, payment_reference, reason_description } = req.body;
  if (!amount || !purpose_name) {
    return res.status(400).json({ error: 'Donation amount and purpose are required.' });
  }

  const donor = db.prepare('SELECT id, full_name, email FROM donors WHERE user_id = ?').get(req.session.user.id);
  const count = db.prepare('SELECT COUNT(*) as c FROM donations').get().c + 1;
  const receiptNo = `REC-2026-${String(count).padStart(4, '0')}`;
  const today = new Date().toISOString().slice(0, 10);
  const docPath = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO donations (receipt_no, donor_id, amount, purpose_name, beneficiary_target, donation_date, payment_method, payment_reference, payment_status, reason_description, supporting_doc_path, doc_status, update_window_days, is_locked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, 'Verified', 20, 0)
  `).run(receiptNo, donor.id, Number.parseFloat(amount), purpose_name, beneficiary_target || 'General Welfare', today, payment_method || 'Bank Transfer', payment_reference || '', reason_description || '', docPath);

  const donId = result.lastInsertRowid;

  db.prepare(`
    INSERT INTO donation_updates (donation_id, updated_by_user, update_notes, previous_data)
    VALUES (?, ?, 'Initial donation contribution submitted', ?)
  `).run(donId, donor.full_name, `Amount: ${amount}, Purpose: ${purpose_name}`);

  // Auto-generate 80G Tax Exemption Certificate
  const taxCertNo = `80G/MINDS/2026-27/${String(count).padStart(4, '0')}`;
  const hash = `HASH80G-MINDS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  db.prepare(`
    INSERT INTO donor_tax_certificates (cert_number, donor_id, donation_id, financial_year, eligible_amount, exemption_section, pan_number, issue_date, verification_hash)
    VALUES (?, ?, ?, '2026-2027', ?, 'Section 80G(5)(vi) of Income Tax Act 1961', 'AAACT2026P', ?, ?)
  `).run(taxCertNo, donor.id, donId, Number.parseFloat(amount), today, hash);

  // Link to Finance records for Central Admin visibility
  const txnCount = db.prepare('SELECT COUNT(*) as c FROM finance_records').get().c + 1;
  const txnId = `TXN-2026-${String(txnCount).padStart(3, '0')}`;
  db.prepare(`
    INSERT INTO finance_records (transaction_id, category, amount, transaction_date, payment_status, reference_no, related_donor_id, approved_by, notes)
    VALUES (?, 'Donation Inflow', ?, ?, 'Completed', ?, ?, 'Automated Bank Reconciliation', ?)
  `).run(txnId, Number.parseFloat(amount), today, payment_reference || receiptNo, donor.id, `Contribution from ${donor.full_name} for ${purpose_name}`);

  // Create an automated impact tracking milestone
  db.prepare(`
    INSERT INTO donor_impact_updates (donation_id, donor_id, project_title, milestone_summary, beneficiaries_served, impact_metrics, update_date)
    VALUES (?, ?, ?, 'Funds allocated toward welfare execution and beneficiary aid enrollment.', 15, 'Deployment in progress', ?)
  `).run(donId, donor.id, purpose_name, today);

  logAudit(req.session.user.id, donor.full_name, 'DONOR', 'Donation Submit', `Submitted donation of INR ${amount} (Receipt: ${receiptNo}) with 80G Tax Certificate ${taxCertNo}`);
  queueEmail(donor.email, donor.full_name, `Donation Contribution Received - ${receiptNo}`, 'DONATION_ACK');

  res.json({ message: 'Donation submitted successfully! 80G Tax Certificate generated.', receipt_no: receiptNo, cert_no: taxCertNo });
});

app.put('/api/donor/donations/:id', requireAuth('DONOR'), upload.single('supporting_document'), (req, res) => {
  const { id } = req.params;
  const { reason_description, beneficiary_target } = req.body;

  const don = db.prepare(`
    SELECT don.*, d.user_id, ROUND(julianday('now', 'localtime') - julianday(don.created_at)) as days_elapsed
    FROM donations don
    JOIN donors d ON don.donor_id = d.id
    WHERE don.id = ?
  `).get(id);

  if (!don || don.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'Donation not found or access unauthorized.' });
  }

  if (don.days_elapsed > don.update_window_days || don.is_locked === 1) {
    return res.status(403).json({ error: '20-day update window for this donation has expired. Editing is locked.' });
  }

  let docPath = don.supporting_doc_path;
  if (req.file) {
    docPath = `/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE donations
    SET reason_description = ?, beneficiary_target = ?, supporting_doc_path = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(reason_description, beneficiary_target, docPath, id);

  db.prepare(`
    INSERT INTO donation_updates (donation_id, updated_by_user, update_notes, previous_data)
    VALUES (?, ?, 'Updated beneficiary target and supporting notes within 20-day window', ?)
  `).run(id, req.session.user.full_name, `Previous Target: ${don.beneficiary_target}`);

  logAudit(req.session.user.id, req.session.user.full_name, 'DONOR', 'Update Donation', `Updated donation #${id} within active window`);
  res.json({ message: 'Donation details updated successfully.' });
});

// Self-service Donor Profile and Password update
app.put('/api/donor/profile', requireAuth('DONOR'), (req, res) => {
  const { phone, email, current_password, new_password, pan_number, address } = req.body;
  const userId = req.session.user.id;

  if (new_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password is required to change password.' });
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!bcrypt.compareSync(current_password, u.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET phone = ?, email = ?, password_hash = ? WHERE id = ?').run(phone, email, hash, userId);
  } else {
    db.prepare('UPDATE users SET phone = ?, email = ? WHERE id = ?').run(phone, email, userId);
  }

  const donor = db.prepare('SELECT id FROM donors WHERE user_id = ?').get(userId);
  if (donor && (pan_number || address)) {
    db.prepare('UPDATE donors SET pan_number = COALESCE(?, pan_number), address = COALESCE(?, address) WHERE id = ?').run(pan_number || null, address || null, donor.id);
  }

  logAudit(userId, req.session.user.full_name, 'DONOR', 'Profile Update', 'Updated donor profile settings or password');
  res.json({ message: 'Donor profile updated successfully.' });
});

// =========================================================================
// 6. TRAINER PORTAL APIS
// =========================================================================
app.get('/api/trainer/dashboard', requireAuth('TRAINER'), (req, res) => {
  const trainer = db.prepare(`
    SELECT t.*, u.full_name, u.email, u.phone 
    FROM trainers t
    JOIN users u ON t.user_id = u.id
    WHERE u.id = ?
  `).get(req.session.user.id);

  if (!trainer) return res.status(404).json({ error: 'Trainer profile not found' });

  const events = db.prepare(`
    SELECT ev.*, (SELECT COUNT(*) FROM event_registrations WHERE event_id = ev.id) as student_count
    FROM events ev
    WHERE ev.trainer_id = ?
    ORDER BY ev.start_date DESC
  `).all(trainer.id);

  const students = db.prepare(`
    SELECT DISTINCT er.id as reg_id, er.event_id, ev.title as event_title, s.id as student_id, s.student_code, u.full_name, u.email, er.attendance_status, er.completion_status, er.marks_or_grade, er.trainer_remarks
    FROM event_registrations er
    JOIN events ev ON er.event_id = ev.id
    JOIN students s ON er.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE ev.trainer_id = ?
    ORDER BY ev.id DESC
  `).all(trainer.id);

  // Trainer Course Modules & Curriculum Syllabus
  const modules = db.prepare(`
    SELECT * FROM trainer_course_modules
    WHERE trainer_id = ?
    ORDER BY id ASC
  `).all(trainer.id);

  // Trainer Session Delivery Logs
  const sessionLogs = db.prepare(`
    SELECT sl.*, ev.title as event_title, ev.event_code
    FROM trainer_session_logs sl
    JOIN events ev ON sl.event_id = ev.id
    WHERE sl.trainer_id = ?
    ORDER BY sl.session_date DESC
  `).all(trainer.id);

  res.json({ trainer, events, students, modules, sessionLogs });
});

app.put('/api/trainer/evaluate-student/:regId', requireAuth('TRAINER'), (req, res) => {
  const { regId } = req.params;
  const { attendance_status, completion_status, marks_or_grade, trainer_remarks } = req.body;

  db.prepare(`
    UPDATE event_registrations
    SET attendance_status = ?, completion_status = ?, marks_or_grade = ?, trainer_remarks = ?
    WHERE id = ?
  `).run(attendance_status, completion_status, marks_or_grade, trainer_remarks, regId);

  logAudit(req.session.user.id, req.session.user.full_name, 'TRAINER', 'Evaluate Student', `Graded registration #${regId} (${completion_status})`);
  res.json({ message: 'Student evaluation & attendance saved successfully.' });
});

// Trainer logs class session delivery & topic hours
app.post('/api/trainer/session-logs', requireAuth('TRAINER'), (req, res) => {
  const { event_id, session_title, session_date, hours_delivered, topics_covered, attendance_headcount, notes } = req.body;
  if (!event_id || !session_title || !hours_delivered || !topics_covered) {
    return res.status(400).json({ error: 'Event, session title, hours delivered, and topics covered are required.' });
  }

  const trainer = db.prepare('SELECT id FROM trainers WHERE user_id = ?').get(req.session.user.id);
  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

  db.prepare(`
    INSERT INTO trainer_session_logs (trainer_id, event_id, session_title, session_date, hours_delivered, topics_covered, attendance_headcount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trainer.id, event_id, session_title, session_date || new Date().toISOString().slice(0, 10), Number.parseFloat(hours_delivered), topics_covered, Number.parseInt(attendance_headcount, 10) || 0, notes || '');

  logAudit(req.session.user.id, req.session.user.full_name, 'TRAINER', 'Log Session', `Logged class session "${session_title}" (${hours_delivered} hrs)`);
  res.json({ message: 'Training session log recorded successfully!' });
});

// Trainer publishes new course syllabus module
app.post('/api/trainer/course-modules', requireAuth('TRAINER'), (req, res) => {
  const { course_name, module_title, duration_hours, learning_outcomes, materials_url } = req.body;
  if (!course_name || !module_title || !duration_hours) {
    return res.status(400).json({ error: 'Course name, module title, and duration are required.' });
  }

  const trainer = db.prepare('SELECT id FROM trainers WHERE user_id = ?').get(req.session.user.id);
  if (!trainer) return res.status(404).json({ error: 'Trainer not found' });

  db.prepare(`
    INSERT INTO trainer_course_modules (trainer_id, course_name, module_title, duration_hours, learning_outcomes, materials_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(trainer.id, course_name, module_title, Number.parseInt(duration_hours, 10), learning_outcomes || '', materials_url || '');

  logAudit(req.session.user.id, req.session.user.full_name, 'TRAINER', 'Add Module', `Published course module: ${module_title}`);
  res.json({ message: 'Curriculum module published successfully!' });
});

// Self-service Trainer Profile and Password update
app.put('/api/trainer/profile', requireAuth('TRAINER'), (req, res) => {
  const { phone, email, current_password, new_password, specialization, bio } = req.body;
  const userId = req.session.user.id;

  if (new_password) {
    if (!current_password) return res.status(400).json({ error: 'Current password is required to change password.' });
    const u = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!bcrypt.compareSync(current_password, u.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET phone = ?, email = ?, password_hash = ? WHERE id = ?').run(phone, email, hash, userId);
  } else {
    db.prepare('UPDATE users SET phone = ?, email = ? WHERE id = ?').run(phone, email, userId);
  }

  const trainer = db.prepare('SELECT id FROM trainers WHERE user_id = ?').get(userId);
  if (trainer && (specialization || bio)) {
    db.prepare('UPDATE trainers SET specialization = COALESCE(?, specialization), bio = COALESCE(?, bio) WHERE id = ?').run(specialization || null, bio || null, trainer.id);
  }

  logAudit(userId, req.session.user.full_name, 'TRAINER', 'Profile Update', 'Updated trainer profile or password');
  res.json({ message: 'Trainer profile updated successfully.' });
});

// =========================================================================
// 7. FINANCE MANAGEMENT (Admin Profile Can Access Directly)
// =========================================================================
app.get('/api/finance/records', requireAdminOrFinance, (req, res) => {
  try {
    const records = db.prepare(`
      SELECT f.*, s.student_code, d.donor_code
      FROM finance_records f
      LEFT JOIN students s ON f.related_student_id = s.id
      LEFT JOIN donors d ON f.related_donor_id = d.id
      ORDER BY f.id DESC
    `).all();

    const totalInflow = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM finance_records WHERE category = 'Donation Inflow'").get().s;
    const totalOutflow = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM finance_records WHERE category != 'Donation Inflow'").get().s;

    res.json({
      records,
      summary: { totalInflow, totalOutflow, netBalance: totalInflow - totalOutflow }
    });
  } catch (err) {
    console.error('Error in /api/finance/records:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/finance/records', requireAdminOrFinance, (req, res) => {
  const { category, amount, reference_no, notes } = req.body;
  if (!category || !amount) return res.status(400).json({ error: 'Category and amount are required.' });

  const count = db.prepare('SELECT COUNT(*) as c FROM finance_records').get().c + 1;
  const txnId = `TXN-2026-${String(count).padStart(3, '0')}`;
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(`
    INSERT INTO finance_records (transaction_id, category, amount, transaction_date, payment_status, reference_no, approved_by, notes)
    VALUES (?, ?, ?, ?, 'Completed', ?, ?, ?)
  `).run(txnId, category, Number.parseFloat(amount), today, reference_no || '', req.session.user.full_name, notes || '');

  logAudit(req.session.user.id, req.session.user.full_name, 'FINANCE', 'Add Record', `Created finance transaction ${txnId} for INR ${amount}`);
  res.json({ message: 'Finance transaction booked successfully', transaction_id: txnId });
});

// Global Search Across Entire Ecosystem
app.get('/api/admin/global-search', requireAuth('ADMIN'), (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  if (!q) return res.json({ results: [] });

  const term = `%${q}%`;
  const results = [];

  try {
    // 1. Search Students
    const students = db.prepare(`
      SELECT s.id, s.student_code, u.full_name, u.email, s.enrolled_program, s.student_status, s.academic_status
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE u.full_name LIKE ? OR s.student_code LIKE ? OR u.email LIKE ? OR s.program_code LIKE ?
      LIMIT 5
    `).all(term, term, term, term);

    students.forEach(st => {
      results.push({
        type: 'Student',
        icon: 'groups',
        title: `${st.full_name} (${st.student_code})`,
        subtitle: `${st.enrolled_program} • Status: ${st.student_status} • Academic: ${st.academic_status}`,
        view: 'students',
        id: st.id
      });
    });

    // 2. Search Certificates
    const certs = db.prepare(`
      SELECT id, certificate_no, student_name, student_code, program_name, program_code, approval_status, status
      FROM certificates
      WHERE certificate_no LIKE ? OR student_name LIKE ? OR student_code LIKE ? OR program_name LIKE ? OR program_code LIKE ?
      LIMIT 5
    `).all(term, term, term, term, term);

    certs.forEach(c => {
      results.push({
        type: 'Certificate',
        icon: 'workspace_premium',
        title: `Certificate: ${c.certificate_no}`,
        subtitle: `${c.student_name} (${c.student_code}) • ${c.program_name || c.program_code} • ${c.approval_status}`,
        view: 'certificates',
        id: c.id
      });
    });

    // 3. Search Programs
    const programs = db.prepare(`
      SELECT id, program_name, program_code, program_abbreviation, duration_weeks
      FROM programs
      WHERE program_name LIKE ? OR program_code LIKE ? OR program_abbreviation LIKE ?
      LIMIT 5
    `).all(term, term, term);

    programs.forEach(p => {
      results.push({
        type: 'Program',
        icon: 'school',
        title: `${p.program_name} [${p.program_code}]`,
        subtitle: `Abbreviation: ${p.program_abbreviation} • Duration: ${p.duration_weeks} Weeks`,
        view: 'programs',
        id: p.id
      });
    });

    // 4. Search Donors
    const donors = db.prepare(`
      SELECT id, full_name, donor_code, email, phone, donor_category
      FROM donors
      WHERE full_name LIKE ? OR donor_code LIKE ? OR email LIKE ? OR phone LIKE ? OR pan_number LIKE ?
      LIMIT 5
    `).all(term, term, term, term, term);

    donors.forEach(d => {
      results.push({
        type: 'Donor',
        icon: 'volunteer_activism',
        title: `${d.full_name} (${d.donor_code})`,
        subtitle: `${d.donor_category} • ${d.email} • ${d.phone}`,
        view: 'donors',
        id: d.id
      });
    });

    // 5. Search Events
    const events = db.prepare(`
      SELECT id, title, event_code, venue, start_date, last_date, status
      FROM events
      WHERE title LIKE ? OR event_code LIKE ? OR venue LIKE ?
      LIMIT 5
    `).all(term, term, term);

    events.forEach(ev => {
      results.push({
        type: 'Event',
        icon: 'event',
        title: `${ev.title} (${ev.event_code})`,
        subtitle: `Venue: ${ev.venue} • ${ev.start_date} to ${ev.last_date} • ${ev.status}`,
        view: 'events',
        id: ev.id
      });
    });

    // 6. Search Finance Records
    const finances = db.prepare(`
      SELECT id, transaction_id, category, amount, transaction_date, reference_no, approved_by
      FROM finance_records
      WHERE transaction_id LIKE ? OR category LIKE ? OR reference_no LIKE ? OR approved_by LIKE ?
      LIMIT 5
    `).all(term, term, term, term);

    finances.forEach(f => {
      results.push({
        type: 'Finance',
        icon: 'account_balance_wallet',
        title: `${f.transaction_id} - ${f.category} (₹${f.amount})`,
        subtitle: `Date: ${f.transaction_date} • Ref: ${f.reference_no || 'N/A'} • Approved by: ${f.approved_by}`,
        view: 'finance',
        id: f.id
      });
    });

  } catch (err) {
    console.error('Global search error:', err);
  }

  res.json({ results });
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MINDS TRUST ERP Multi-Portal Management System active at http://localhost:${PORT}`);
  });
}

module.exports = app;
