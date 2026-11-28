// =========================================================================
// MINDS TRUST ERP – CLIENT-SIDE MOCK DATABASE & SERVERLESS ADAPTER
// Provides full offline/cloud fallback for Vercel static deployments
// =========================================================================

(function () {
  const STORAGE_KEY = 'MINDS_TRUST_ERP_DB_V4';

  function cloneData(data) {
    return structuredClone(data);
  }

  function initDatabase() {
    let stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('LocalStorage access warning:', e);
    }

    const seed = window.MOCK_DATABASE_SEED || {};
    const db = cloneData(seed);
    saveDatabase(db);
    return db;
  }

  function saveDatabase(db) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  const MockDB = {
    get() {
      return initDatabase();
    },
    save(db) {
      saveDatabase(db);
    },
    reset() {
      const seed = window.MOCK_DATABASE_SEED || {};
      const fresh = cloneData(seed);
      saveDatabase(fresh);
      return fresh;
    }
  };

  function parseRequestBody(rawBody) {
    if (!rawBody) return {};
    if (typeof FormData !== 'undefined' && rawBody instanceof FormData) {
      const obj = {};
      rawBody.forEach((val, key) => {
        obj[key] = val;
      });
      return obj;
    }
    if (typeof rawBody === 'string') {
      try {
        return JSON.parse(rawBody);
      } catch {
        return {};
      }
    }
    return rawBody;
  }

  function getLinkedId(user, db) {
    if (user.portal_type === 'STUDENT') {
      const s = (db.students || []).find(st => st.user_id === user.id);
      return s?.id ?? null;
    }
    if (user.portal_type === 'DONOR') {
      const d = (db.donors || []).find(dn => dn.user_id === user.id);
      return d?.id ?? null;
    }
    if (user.portal_type === 'TRAINER') {
      const t = (db.trainers || []).find(tr => tr.user_id === user.id);
      return t?.id ?? null;
    }
    return null;
  }

  function handleAuthLogin(ctx) {
    const { identifier, expected_portal } = ctx.body;
    const lower = (identifier || '').toLowerCase();

    const user = (ctx.db.users || []).find(u =>
      (u.user_id?.toLowerCase() === lower) ||
      (u.email?.toLowerCase() === lower)
    );

    if (!user) {
      throw new Error('Invalid login credentials.');
    }

    if (expected_portal && expected_portal !== user.portal_type && user.portal_type !== 'ADMIN' && user.role !== 'Super Admin') {
      throw new Error(`Access Denied: Account belongs to ${user.portal_type} Portal, not ${expected_portal} Portal.`);
    }

    const sessionUser = {
      id: user.id,
      user_id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '+91 98200 12345',
      portal_type: user.portal_type,
      role: user.role,
      linked_id: getLinkedId(user, ctx.db)
    };

    try {
      sessionStorage.setItem('MINDS_TRUST_USER', JSON.stringify(sessionUser));
    } catch (e) {
      // Ignore sessionStorage errors in restricted iframe environments
      console.debug('SessionStorage not accessible:', e);
    }

    return { message: 'Login successful', user: sessionUser };
  }

  function handleAuthMe() {
    try {
      const stored = sessionStorage.getItem('MINDS_TRUST_USER');
      if (stored) return { user: JSON.parse(stored) };
    } catch (e) {
      // Ignore sessionStorage read errors in private browsing/sandboxed contexts
      console.debug('SessionStorage read error:', e);
    }
    throw new Error('Not authenticated');
  }

  function handleAuthLogout() {
    try {
      sessionStorage.removeItem('MINDS_TRUST_USER');
    } catch (e) {
      // Ignore sessionStorage remove errors
      console.debug('SessionStorage removal error:', e);
    }
    return { message: 'Logged out successfully' };
  }

  function handleRegisterStudent(ctx) {
    const { full_name, email, phone, enrolled_program, dob, password } = ctx.body;
    if (!full_name || !email || !phone) {
      return { error: 'Full name, email, and mobile number are required.' };
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return { error: 'Please enter a valid 10-digit mobile number.' };
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check duplicate student
    const existing = (ctx.db.users || []).find(u => 
      (u.email && u.email.toLowerCase() === cleanEmail) || 
      (u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone)
    );
    if (existing) {
      return { error: 'A student registration with this Email or Mobile Number already exists.' };
    }

    const newUserId = (ctx.db.users || []).length + 1;
    const newStudentId = (ctx.db.students || []).length + 1;
    // Sequential collision-resistant format: STU20260001
    const code = `STU2026${String(newStudentId).padStart(4, '0')}`;
    const autoUserId = code.toLowerCase();

    const newUser = {
      id: newUserId,
      user_id: autoUserId,
      email: cleanEmail,
      full_name: full_name.trim(),
      phone: cleanPhone,
      dob: dob || '2005-01-01',
      portal_type: 'STUDENT',
      role: 'Student',
      status: 'Active'
    };

    const newStudent = {
      id: newStudentId,
      user_id: newUserId,
      student_code: code,
      enrolled_program: enrolled_program || 'Full Stack Digital Skills',
      batch: 'Cohort 2026',
      academic_status: 'In Progress',
      finance_clearance: 1,
      dob: dob || '2005-01-01',
      program_id: 1,
      program_code: 'PRG-FSD-01',
      student_status: 'Joined',
      completion_approved: 0,
      notification_sent: 0,
      full_name: full_name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      courses: [{
        id: (ctx.db.student_course_enrollments || []).length + 1,
        student_id: newStudentId,
        program_id: 1,
        course_name: enrolled_program || 'Full Stack Digital Skills',
        course_code: 'PRG-FSD-01',
        enrolled_date: new Date().toISOString().slice(0, 10),
        academic_status: 'In Progress',
        completion_approved: 0,
        completion_date: null,
        certificate_id: null
      }]
    };

    ctx.db.users = ctx.db.users || [];
    ctx.db.users.push(newUser);
    ctx.db.students = ctx.db.students || [];
    ctx.db.students.push(newStudent);
    MockDB.save(ctx.db);

    return {
      success: true,
      message: `Registration Successful! Your unique Student ID is ${code}. Login with User ID: ${autoUserId}`,
      student_code: code,
      user_id: autoUserId
    };
  }

  function handleRegisterDonor(ctx) {
    const { full_name, user_id, email, phone, donor_category, pan_number, dob } = ctx.body;
    
    // PAN validation: exactly 10 characters, 6 alphabets followed by 4 digits
    const panRegex = /^[A-Z]{6}[0-9]{4}$/i;
    if (!pan_number || !panRegex.test(pan_number.trim())) {
      return { error: 'Please enter a valid PAN number.' };
    }

    // Phone validation: exactly 10 digits
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return { error: 'Please enter a valid phone number.' };
    }

    const newUserId = (ctx.db.users || []).length + 1;
    const newDonorId = (ctx.db.donors || []).length + 1;
    const code = `DNR-2026-${String(newDonorId).padStart(3, '0')}`;

    const newUser = {
      id: newUserId,
      user_id,
      email,
      full_name,
      phone: cleanPhone,
      dob: dob || '1985-01-01',
      portal_type: 'DONOR',
      role: 'Donor',
      status: 'Active'
    };

    const newDonor = {
      id: newDonorId,
      user_id: newUserId,
      donor_code: code,
      full_name,
      email,
      phone: cleanPhone,
      donor_category: donor_category || 'Individual Benefactor',
      pan_number: pan_number.trim().toUpperCase(),
      total_donated: 0,
      total_contributed: 0,
      donation_count: 0,
      verification_status: 'Verified',
      dob: dob || '1985-01-01'
    };

    ctx.db.users = ctx.db.users || [];
    ctx.db.users.push(newUser);
    ctx.db.donors = ctx.db.donors || [];
    ctx.db.donors.push(newDonor);
    MockDB.save(ctx.db);

    return {
      message: `Donor registered successfully! Your Donor ID is ${code}.`,
      donor_code: code
    };
  }

  function handleAdminOverview(ctx) {
    const students = ctx.db.students || [];
    const donors = ctx.db.donors || [];
    const trainers = ctx.db.trainers || [];
    const events = ctx.db.events || [];
    const certificates = ctx.db.certificates || [];
    const finance = ctx.db.finance_records || [];
    const donations = ctx.db.donations || [];

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.student_status !== 'Archived').length;
    const joinedStudents = students.filter(s => s.student_status === 'Joined').length;
    const totalDonors = donors.length;
    const totalTrainers = trainers.length;
    const totalEvents = events.length;
    const certsGenerated = certificates.filter(c => c.status === 'Issued').length;
    const certsPending = certificates.filter(c => c.status !== 'Issued').length;
    const totalFinanceInflow = finance
      .filter(f => f.category === 'Donation Inflow')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const upcomingEvents = [...events].sort((a, b) => (a.start_date > b.start_date ? 1 : -1)).slice(0, 5);
    const pendingApprovals = donations.filter(d => d.payment_status === 'Pending' || d.doc_status === 'Pending Review').slice(0, 5);

    return {
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
    };
  }

  function handleAdminSpecialDates(ctx) {
    const usersWithDob = (ctx.db.users || []).filter(u => u.dob && u.portal_type !== 'DONOR' && u.role !== 'Donor' && u.hierarchy_role !== 'Donor');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    const birthdayList = usersWithDob.map(u => {
      const dob = new Date(u.dob);
      const bMonth = isNaN(dob.getTime()) ? 1 : dob.getMonth() + 1;
      const bDay = isNaN(dob.getTime()) ? 1 : dob.getDate();

      let nextBday = new Date(now.getFullYear(), bMonth - 1, bDay);
      if (nextBday < now && nextBday.toDateString() !== now.toDateString()) {
        nextBday = new Date(now.getFullYear() + 1, bMonth - 1, bDay);
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

    const specialOccasions = (ctx.db.events || []).map(e => ({
      id: e.id,
      title: e.title,
      occasion_type: 'Trust Special Event',
      target_date: e.start_date,
      venue: e.venue
    }));

    return { birthdayList, usersWithDob, specialOccasions };
  }

  function handleAdminPrograms(ctx) {
    if (ctx.method === 'GET') {
      const programs = (ctx.db.programs || []).map(p => {
        const matchedStudents = (ctx.db.students || []).filter(s => {
          if (s.program_id === p.id || s.program_code === p.program_code) return true;
          return (s.courses || []).some(c => c.program_id === p.id || c.course_name === p.program_name);
        });
        return { 
          ...p, 
          enrolled_students: matchedStudents.length, 
          student_count: matchedStudents.length,
          enrolled_student_list: matchedStudents.map(s => ({
            id: s.id,
            student_code: s.student_code,
            full_name: s.full_name,
            email: s.email,
            phone: s.phone,
            student_status: s.student_status,
            academic_status: s.academic_status
          }))
        };
      });
      return { programs };
    }
    const { program_name, duration_weeks, description, trainer_name } = ctx.body;
    const words = (program_name || 'Vocational Training').trim().split(/\s+/);
    let abbr = words[0]?.slice(0, 3).toUpperCase() || 'PRG';
    if (words.length > 1) {
      abbr = words.map(w => w.charAt(0).toUpperCase()).slice(0, 4).join('');
    }
    const count = (ctx.db.programs || []).length + 1;
    const progCode = `PRG-${abbr}-${String(count).padStart(2, '0')}`;

    const newProg = {
      id: count,
      program_name,
      program_abbreviation: abbr,
      program_code: progCode,
      duration_weeks: Number(duration_weeks) || 12,
      description: description || '',
      trainer_name: trainer_name || '',
      status: 'Active'
    };
    ctx.db.programs = ctx.db.programs || [];
    ctx.db.programs.push(newProg);
    MockDB.save(ctx.db);
    return { message: 'Program created successfully', program_code: progCode, program: newProg };
  }

  function handleAdminStudentsCounts(ctx) {
    const students = ctx.db.students || [];
    return {
      counts: {
        all: students.length,
        drafted: students.filter(s => s.student_status === 'Drafted').length,
        enrolled: students.filter(s => s.student_status === 'Enrolled').length,
        joined: students.filter(s => s.student_status === 'Joined').length,
        completed: students.filter(s => s.academic_status === 'Completed').length,
        archived: students.filter(s => s.student_status === 'Archived').length
      }
    };
  }

  function handleAdminStudentsCalendar(ctx) {
    const enrollments = ctx.db.student_course_enrollments || [];
    const studentsMap = new Map((ctx.db.students || []).map(s => [s.id, s]));
    const programsMap = new Map((ctx.db.programs || []).map(p => [p.id, p]));
    const certsMap = new Map((ctx.db.certificates || []).map(c => [c.id, c]));

    const records = enrollments.map(sce => {
      const s = studentsMap.get(sce.student_id) || {};
      const p = programsMap.get(sce.program_id) || {};
      const c = certsMap.get(sce.certificate_id) || {};
      const enrollmentDate = sce.enrolled_date || s.joined_date || '2026-11-01';

      return {
        enrollment_id: sce.id,
        student_id: sce.student_id,
        program_id: sce.program_id,
        course_name: sce.course_name,
        course_code: sce.course_code,
        enrollment_date: enrollmentDate,
        academic_status: sce.academic_status,
        completion_approved: sce.completion_approved,
        completion_date: sce.completion_date,
        certificate_id: sce.certificate_id,
        student_code: s.student_code,
        student_status: s.student_status,
        batch: s.batch || 'Cohort 2026',
        joined_date: s.joined_date,
        student_name: s.full_name,
        email: s.email,
        phone: s.phone,
        canonical_prog_name: p.program_name,
        canonical_prog_code: p.program_code,
        certificate_no: c.certificate_no || null,
        cert_approval_status: c.approval_status || 'Issued',
        student_obj: s
      };
    });

    const dateMap = {};
    for (const r of records) {
      const d = r.enrollment_date;
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(r);
    }

    return { success: true, records, dateMap };
  }

  function handleAdminStudents(ctx) {
    if (ctx.method === 'GET') {
      const search = (ctx.searchParams.get('search') || '').toLowerCase();
      const status = ctx.searchParams.get('status') || '';
      let list = ctx.db.students || [];

      if (status && status !== 'ALL') {
        list = list.filter(s =>
          (s.student_status || '').toLowerCase() === status.toLowerCase() ||
          (s.academic_status || '').toLowerCase() === status.toLowerCase()
        );
      }
      if (search) {
        list = list.filter(s =>
          s.full_name?.toLowerCase().includes(search) ||
          s.student_code?.toLowerCase().includes(search) ||
          s.email?.toLowerCase().includes(search) ||
          s.program_code?.toLowerCase().includes(search)
        );
      }
      return { students: list };
    }
    const { full_name, user_id, email, phone, program_id, dob, student_status } = ctx.body;
    const prog = (ctx.db.programs || []).find(p => p.id === Number(program_id)) || (ctx.db.programs || [])[0];
    const newId = (ctx.db.students || []).length + 1;
    const code = `STU-2026-${String(newId).padStart(3, '0')}`;
    const initialStatus = student_status || 'Drafted';
    const initialAcademic = initialStatus === 'Joined' ? 'In Progress' : 'Pending';

    const newStudent = {
      id: newId,
      user_id: 100 + newId,
      student_code: code,
      full_name,
      email,
      phone: phone || '+91 98200 12345',
      dob: dob || '2005-06-15',
      program_id: prog?.id || 1,
      program_code: prog?.program_code || 'PRG-FSD-01',
      program_name: prog?.program_name || 'Full Stack Digital Skills',
      enrolled_program: prog?.program_name || 'Full Stack Digital Skills',
      batch: 'Cohort 2026',
      academic_status: initialAcademic,
      student_status: initialStatus,
      completion_approved: 0,
      joined_date: initialStatus === 'Joined' ? new Date().toISOString().slice(0, 10) : null,
      courses: [{
        id: (ctx.db.student_course_enrollments || []).length + 1,
        student_id: newId,
        program_id: prog?.id || 1,
        course_name: prog?.program_name || 'Full Stack Digital Skills',
        course_code: prog?.program_code || 'PRG-FSD-01',
        enrolled_date: new Date().toISOString().slice(0, 10),
        academic_status: initialAcademic,
        completion_approved: 0,
        completion_date: null,
        certificate_id: null
      }]
    };

    ctx.db.students = ctx.db.students || [];
    ctx.db.students.unshift(newStudent);

    // Also register corresponding user
    ctx.db.users = ctx.db.users || [];
    ctx.db.users.push({
      id: 100 + newId,
      user_id: user_id || `student_${newId}`,
      email,
      full_name,
      phone: phone || '+91 98200 12345',
      dob: dob || '2005-06-15',
      portal_type: 'STUDENT',
      role: 'Student',
      status: 'Active'
    });

    MockDB.save(ctx.db);
    return {
      message: 'Student registered successfully',
      student_code: code,
      program_code: prog?.program_code || 'PRG-FSD-01',
      student: newStudent
    };
  }

  function handleStudentStatusUpdate(id, body, db) {
    const s = (db.students || []).find(x => x.id === id);
    if (s) {
      s.student_status = body.student_status || body.status;
      if (body.archive_reason) s.archive_reason = body.archive_reason;
      if (s.student_status === 'Joined') {
        s.academic_status = 'In Progress';
        s.joined_date = s.joined_date || new Date().toISOString().slice(0, 10);
      } else if (s.student_status === 'Archived') {
        s.academic_status = 'Archived';
      }
      MockDB.save(db);
    }
    return { message: `Student status successfully updated to ${body.student_status || body.status}` };
  }

  function handleStudentAcademicUpdate(id, body, db) {
    const s = (db.students || []).find(x => x.id === id);
    if (!s) {
      return { message: 'Student not found.' };
    }
    if (body.academic_status) s.academic_status = body.academic_status;
    if (body.completion_approved !== undefined) s.completion_approved = body.completion_approved ? 1 : 0;
    if (body.courses) s.courses = body.courses;
    MockDB.save(db);
    return { message: `Student academic status set to ${body.academic_status || 'Updated'}` };
  }

  function handleCertificates(ctx) {
    if (ctx.method === 'GET') {
      const q = (ctx.searchParams.get('q') || '').toLowerCase();
      if (q) {
        const results = (ctx.db.certificates || []).filter(c =>
          c.certificate_no?.toLowerCase().includes(q) ||
          c.student_code?.toLowerCase().includes(q) ||
          c.student_name?.toLowerCase().includes(q)
        );
        return { results };
      }
      return { certificates: ctx.db.certificates || [] };
    }
    const { student_id, student_name, student_code, course_name, issue_date } = ctx.body;
    const count = (ctx.db.certificates || []).length + 1;
    const certNo = `CERT-2026-${String(count).padStart(4, '0')}`;
    const newCert = {
      id: count,
      certificate_no: certNo,
      student_id,
      student_name,
      student_code,
      course_name: course_name || 'Vocational Training Program',
      issue_date: issue_date || new Date().toISOString().slice(0, 10),
      status: 'Issued'
    };
    ctx.db.certificates = ctx.db.certificates || [];
    ctx.db.certificates.push(newCert);
    MockDB.save(ctx.db);
    return { message: 'Certificate generated successfully', certificate: newCert };
  }

  function handleFinanceRecords(ctx) {
    const records = ctx.db.finance_records || [];
    const totalInflow = records
      .filter(f => f.category === 'Donation Inflow')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const totalOutflow = records
      .filter(f => f.category !== 'Donation Inflow')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    if (ctx.method === 'GET') {
      return {
        records,
        summary: { totalInflow, totalOutflow, netBalance: totalInflow - totalOutflow }
      };
    }
    const { category, amount, reference_no, notes, bank_name, branch_name, ifsc_code, payment_method, account_number } = ctx.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { error: 'Please enter a valid numeric transaction amount.' };
    }

    const newId = records.length + 1;
    const txnId = `TXN-2026-${String(newId).padStart(3, '0')}`;
    const newRec = {
      id: newId,
      transaction_id: txnId,
      category: category || 'Donation Inflow',
      amount: numAmount,
      transaction_date: ctx.body.transaction_date || new Date().toISOString().slice(0, 10),
      payment_status: 'Completed',
      reference_no: reference_no || `REF-${Date.now()}`,
      payment_method: payment_method || 'NEFT / RTGS',
      bank_name: bank_name || 'State Bank of India',
      branch_name: branch_name || 'Fort Main Branch',
      ifsc_code: ifsc_code || 'SBIN0000300',
      account_number: account_number || '',
      notes: notes || '',
      approved_by: 'Admin'
    };
    ctx.db.finance_records = ctx.db.finance_records || [];
    ctx.db.finance_records.unshift(newRec);
    MockDB.save(ctx.db);
    return {
      success: true,
      message: `Finance transaction booked successfully! Amount: ₹${numAmount.toLocaleString('en-IN')}`,
      transaction_id: txnId,
      record: newRec
    };
  }

  function getCurrentUserSession() {
    try {
      const stored = sessionStorage.getItem('MINDS_TRUST_USER');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.debug('Failed to read session user:', e);
    }
    return null;
  }

  function handleStudentDashboard(ctx) {
    const session = getCurrentUserSession();
    const students = ctx.db.students || [];
    const student = (session?.portal_type === 'STUDENT'
      ? students.find(s => s.user_id === session.id || s.id === session.linked_id)
      : null) || students[0] || {
      id: 1,
      full_name: 'Pooja Sanjay Kamble',
      student_code: 'STU-2026-001',
      email: 'pooja.kamble@student.mindstrust.org',
      phone: '+91 97680 11223'
    };

    const registeredEvents = (ctx.db.events || []).slice(0, 2).map(ev => ({
      ...ev,
      attendance_status: 'Present',
      completion_status: 'In Progress'
    }));
    const certificates = (ctx.db.certificates || []).filter(c => c.status === 'Issued');
    const idCard = (ctx.db.student_id_cards || []).find(card => card.student_id === student.id) ||
      (ctx.db.student_id_cards || [])[0] || {
        student_id: student.id,
        card_number: 'CARD-2026-001',
        valid_until: '2027-12-31'
      };
    const resources = ctx.db.student_learning_resources || [];
    const availableEvents = (ctx.db.events || []).filter(e => e.status === 'Scheduled');

    return {
      student,
      registeredEvents,
      certificates,
      idCard,
      resources,
      availableEvents
    };
  }

  function handleDonorDashboard(ctx) {
    const session = getCurrentUserSession();
    const donors = ctx.db.donors || [];
    const donor = (session?.portal_type === 'DONOR'
      ? donors.find(d => d.user_id === session.id || d.id === session.linked_id)
      : null) || donors[0] || {
      id: 1,
      donor_code: 'DNR-8891',
      full_name: 'Rajeshwari Singhania',
      email: 'rajeshwari@singhania.com',
      phone: '+91 98210 99887',
      pan_number: 'AAACT2026P'
    };

    // Filter contributions specifically for this donor
    const rawDonations = (ctx.db.donations || []).filter(don => {
      if (!donor.id) return true;
      return don.donor_id === donor.id || don.donor_code === donor.donor_code || don.donor_name === donor.full_name;
    });

    const donations = rawDonations.map(don => {
      const donationDate = new Date(don.donation_date).getTime();
      const diffDays = Math.floor((Date.now() - donationDate) / (1000 * 60 * 60 * 24));
      return {
        ...don,
        can_edit: diffDays <= 20,
        window_remaining: Math.max(0, 20 - diffDays),
        days_remaining_to_edit: Math.max(0, 20 - diffDays)
      };
    });

    const totalContributed = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const activePledges = donations.filter(d => d.payment_status === 'Approved' || d.payment_status === 'Verified').length;
    const purposes = ctx.db.donation_purposes || [];
    const taxCertificates = (ctx.db.donor_tax_certificates || []).filter(t => t.donor_id === donor.id || !donor.id);
    const impactUpdates = ctx.db.donor_impact_updates || [];

    return {
      donor,
      donations,
      purposes,
      taxCertificates,
      impactUpdates,
      stats: {
        totalContributed,
        activePledges,
        taxExemptionCertificates: taxCertificates.length
      }
    };
  }

  function handleTrainerDashboard(ctx) {
    const session = getCurrentUserSession();
    const trainers = ctx.db.trainers || [];
    const trainer = (session?.portal_type === 'TRAINER'
      ? trainers.find(t => t.user_id === session.id || t.id === session.linked_id)
      : null) || trainers[0] || {
      id: 1,
      trainer_code: 'TRN-2026-001',
      full_name: 'Prof. Arvind Deshmukh',
      email: 'arvind.trainer@mindstrust.org',
      phone: '+91 98200 77889'
    };

    const events = ctx.db.events || [];
    const students = (ctx.db.students || []).map((s, idx) => ({
      reg_id: idx + 1,
      event_id: 1,
      event_title: events[0]?.title || 'Vocational Training 2026',
      student_id: s.id,
      student_code: s.student_code,
      full_name: s.full_name,
      email: s.email,
      attendance_status: 'Present',
      completion_status: 'In Progress',
      marks_or_grade: 'A',
      trainer_remarks: 'Attentive and active in classroom sessions'
    }));

    const modules = ctx.db.trainer_course_modules || [];
    const sessionLogs = (ctx.db.trainer_session_logs || []).map(sl => ({
      ...sl,
      event_title: events[0]?.title || 'Vocational Training 2026'
    }));

    return { trainer, events, students, modules, sessionLogs };
  }

  function searchEntity(list, query, fields, mapper) {
    if (!list) return [];
    const matched = [];
    for (const item of list) {
      const isMatch = fields.some(f => item[f]?.toLowerCase().includes(query));
      if (isMatch) matched.push(mapper(item));
    }
    return matched;
  }

  function handleGlobalSearch(ctx) {
    const q = (ctx.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) return { results: [] };

    const studentResults = searchEntity(ctx.db.students, q, ['full_name', 'student_code', 'email', 'enrolled_program'], s => ({
      type: 'Student',
      title: s.full_name,
      subtitle: `${s.student_code} • ${s.enrolled_program || 'Student'} • ${s.academic_status || 'Active'}`,
      id: s.id,
      view: 'students',
      icon: 'school',
      code: s.student_code
    }));

    const donorResults = searchEntity(ctx.db.donors, q, ['full_name', 'donor_code', 'email', 'donor_category'], d => ({
      type: 'Donor',
      title: d.full_name,
      subtitle: `${d.donor_code} • ${d.donor_category || 'Donor'} • ${d.email || ''}`,
      id: d.id,
      view: 'donors',
      icon: 'volunteer_activism',
      code: d.donor_code
    }));

    const trainerResults = searchEntity(ctx.db.trainers, q, ['full_name', 'trainer_code', 'specialization', 'email'], t => ({
      type: 'Trainer',
      title: t.full_name,
      subtitle: `${t.trainer_code} • ${t.specialization || 'Trainer'}`,
      id: t.id,
      view: 'trainers',
      icon: 'co_present',
      code: t.trainer_code
    }));

    const eventResults = searchEntity(ctx.db.events, q, ['title', 'event_code', 'venue'], e => ({
      type: 'Event',
      title: e.title,
      subtitle: `${e.event_code} • ${e.venue} • ${e.status}`,
      id: e.id,
      view: 'events',
      icon: 'event',
      code: e.event_code
    }));

    const certResults = searchEntity(ctx.db.certificates, q, ['certificate_no', 'program_name'], c => ({
      type: 'Certificate',
      title: c.certificate_no,
      subtitle: `${c.program_name || 'Program'} • Issued: ${c.issue_date}`,
      id: c.id,
      view: 'certificates',
      icon: 'verified',
      code: c.certificate_no
    }));

    const donationResults = searchEntity(ctx.db.donations, q, ['receipt_no', 'beneficiary_target', 'purpose_name'], don => ({
      type: 'Donation',
      title: `${don.receipt_no} (₹${Number(don.amount).toLocaleString('en-IN')})`,
      subtitle: `${don.purpose_name} • ${don.beneficiary_target || ''}`,
      id: don.id,
      view: 'donors',
      icon: 'receipt_long',
      code: don.receipt_no
    }));

    return {
      results: [
        ...studentResults,
        ...donorResults,
        ...trainerResults,
        ...eventResults,
        ...certResults,
        ...donationResults
      ]
    };
  }

  function handleStudentProfileUpdate(ctx) {
    const { phone, email } = ctx.body;
    const session = getCurrentUserSession();
    if (!session) {
      return { message: 'No active session.' };
    }

    session.phone = phone || session.phone;
    session.email = email || session.email;
    try {
      sessionStorage.setItem('MINDS_TRUST_USER', JSON.stringify(session));
    } catch (e) {
      console.debug('SessionStorage error:', e);
    }
    const u = (ctx.db.users || []).find(usr => usr.id === session.id);
    if (u) {
      u.phone = session.phone;
      u.email = session.email;
    }
    const s = (ctx.db.students || []).find(st => st.user_id === session.id);
    if (s) {
      s.phone = session.phone;
      s.email = session.email;
    }
    MockDB.save(ctx.db);
    return { message: 'Student profile updated successfully.' };
  }

  function handleDonorProfileUpdate(ctx) {
    const { full_name, phone, email, address } = ctx.body;
    const session = getCurrentUserSession();
    if (session) {
      if (full_name) session.full_name = full_name;
      session.phone = phone || session.phone;
      session.email = email || session.email;
      try {
        sessionStorage.setItem('MINDS_TRUST_USER', JSON.stringify(session));
      } catch (e) {
        console.debug('SessionStorage error:', e);
      }
      const d = (ctx.db.donors || []).find(dn => dn.user_id === session.id || dn.id === session.linked_id);
      if (d) {
        if (full_name) d.full_name = full_name;
        d.phone = phone || d.phone;
        d.email = email || d.email;
        if (address) d.address = address;
        // PAN Number is permanently locked and cannot be edited
      }
      MockDB.save(ctx.db);
    }
    return { message: 'Donor profile saved successfully. PAN number remains permanently locked for 80G audit compliance.' };
  }

  function handleTrainerProfileUpdate(ctx) {
    const { phone, email, specialization, bio } = ctx.body;
    const session = getCurrentUserSession();
    if (session) {
      session.phone = phone || session.phone;
      session.email = email || session.email;
      try {
        sessionStorage.setItem('MINDS_TRUST_USER', JSON.stringify(session));
      } catch (e) {
        console.debug('SessionStorage error:', e);
      }
      const t = (ctx.db.trainers || []).find(tr => tr.user_id === session.id);
      if (t) {
        t.phone = phone || t.phone;
        t.email = email || t.email;
        if (specialization) t.specialization = specialization;
        if (bio) t.bio = bio;
      }
      MockDB.save(ctx.db);
    }
    return { message: 'Trainer faculty profile updated successfully.' };
  }

  function handleTrainerSessionLogs(ctx) {
    const { event_id, session_title, session_date, hours_delivered, topics_covered, attendance_headcount, notes } = ctx.body;
    const newLog = {
      id: (ctx.db.trainer_session_logs || []).length + 1,
      trainer_id: 1,
      event_id: Number(event_id) || 1,
      session_title: session_title || 'Classroom Lecture',
      session_date: session_date || new Date().toISOString().slice(0, 10),
      hours_delivered: Number(hours_delivered) || 2,
      topics_covered: topics_covered || 'Core Curriculum',
      attendance_headcount: Number(attendance_headcount) || 20,
      notes: notes || ''
    };
    ctx.db.trainer_session_logs = ctx.db.trainer_session_logs || [];
    ctx.db.trainer_session_logs.push(newLog);
    MockDB.save(ctx.db);
    return { message: 'Training session log recorded successfully!' };
  }

  function handleTrainerCourseModules(ctx) {
    const { course_name, module_title, duration_hours, learning_outcomes, materials_url } = ctx.body;
    const newMod = {
      id: (ctx.db.trainer_course_modules || []).length + 1,
      trainer_id: 1,
      course_name: course_name || 'Full Stack Digital Skills',
      module_title: module_title || 'New Course Module',
      duration_hours: Number(duration_hours) || 10,
      status: 'Published',
      learning_outcomes: learning_outcomes || 'Competency objectives',
      materials_url: materials_url || '#'
    };
    ctx.db.trainer_course_modules = ctx.db.trainer_course_modules || [];
    ctx.db.trainer_course_modules.push(newMod);
    MockDB.save(ctx.db);
    return { message: 'Course curriculum module published successfully!' };
  }

  function handleDonorDonationSubmit(ctx) {
    const body = ctx.body || {};
    const count = (ctx.db.donations || []).length + 1;
    const receiptNo = `REC-2026-${String(count).padStart(4, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const session = getCurrentUserSession();
    const donor = (session?.portal_type === 'DONOR'
      ? (ctx.db.donors || []).find(d => d.user_id === session.id || d.id === session.linked_id)
      : null) || (ctx.db.donors || [])[0] || { id: 1, full_name: 'Rajeshwari Singhania', donor_code: 'DNR-8891', pan_number: 'AAACT2026P' };

    const parsedAmount = Number(body.amount);
    const amount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : (Number(body.amount) || 5000);

    const newDonation = {
      id: count,
      donor_id: donor.id || 1,
      donor_name: donor.full_name || 'Rajeshwari Singhania',
      donor_code: donor.donor_code || 'DNR-8891',
      pan_number: donor.pan_number || 'AAACT2026P',
      receipt_no: receiptNo,
      amount,
      purpose_name: body.purpose_name || 'Student Education Support',
      beneficiary_target: body.beneficiary_target || 'Underprivileged Students',
      donation_date: today,
      payment_method: body.payment_method || 'NEFT / Net Banking',
      payment_reference: body.payment_reference || `TXN-REF-${Date.now()}`,
      payment_status: 'Approved',
      doc_status: 'Verified',
      reason_description: body.reason_description || 'Direct charitable support',
      supporting_doc_path: body.supporting_document && typeof body.supporting_document === 'object' ? '/uploads/sample_tax_pan_receipt.pdf' : (body.supporting_doc_path || '/uploads/sample_tax_pan_receipt.pdf')
    };

    ctx.db.donations = ctx.db.donations || [];
    ctx.db.donations.unshift(newDonation);

    // Update total_donated on donor record
    if (donor) {
      donor.total_donated = (Number(donor.total_donated) || 0) + amount;
      donor.total_contributed = (Number(donor.total_contributed) || 0) + amount;
      donor.donation_count = (Number(donor.donation_count) || 0) + 1;
    }

    // Auto-generate 80G tax certificate
    const certNumber = `80G/MINDS/2026-27/${String(count).padStart(4, '0')}`;
    const newTaxCert = {
      id: (ctx.db.donor_tax_certificates || []).length + 1,
      cert_number: certNumber,
      donor_id: donor.id || 1,
      donation_id: count,
      financial_year: '2026-2027',
      eligible_amount: amount,
      exemption_section: 'Section 80G(5)(vi) of Income Tax Act 1961',
      pan_number: donor.pan_number || 'AAACT2026P',
      issue_date: today,
      verification_hash: `HASH80G-MINDS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      status: 'Generated'
    };

    ctx.db.donor_tax_certificates = ctx.db.donor_tax_certificates || [];
    ctx.db.donor_tax_certificates.unshift(newTaxCert);

    // Also add to finance records inflow
    ctx.db.finance_records = ctx.db.finance_records || [];
    ctx.db.finance_records.unshift({
      id: ctx.db.finance_records.length + 1,
      transaction_id: `TXN-2026-${String(ctx.db.finance_records.length + 1).padStart(3, '0')}`,
      category: 'Donation Inflow',
      amount,
      transaction_date: today,
      payment_status: 'Completed',
      reference_no: newDonation.payment_reference || receiptNo,
      notes: `Donation from ${donor.full_name} (${body.purpose_name || 'General'})`
    });

    MockDB.save(ctx.db);
    return {
      message: `Donation of ₹${amount.toLocaleString('en-IN')} recorded successfully! Official Receipt #${receiptNo} generated with 80G Tax Exemption.`,
      receipt_no: receiptNo
    };
  }

  function handle7DayNotificationAutomation(ctx) {
    const students = ctx.db.students || [];
    let updatedCount = 0;
    students.forEach(s => {
      if (s.student_status === 'Drafted' || s.student_status === 'Enrolled') {
        s.notification_sent = 1;
        updatedCount += 1;
      }
    });
    MockDB.save(ctx.db);
    return {
      success: true,
      message: `7-Day Notification Job executed. Checked ${students.length} students, processed ${updatedCount} reminder notifications.`
    };
  }

  // =========================================================================
  // HIERARCHY-BASED TASK ASSIGNMENT, REVIEW, REJECTION & REASSIGNMENT ENGINE
  // =========================================================================

  function resolveUserHierarchyRole(u) {
    if (u.hierarchy_role) return u.hierarchy_role;
    if (u.portal_type === 'STUDENT') return 'Student';
    if (u.portal_type === 'TRAINER') return 'Staff';
    if (u.portal_type === 'DONOR') return 'Donor';
    return 'Admin';
  }

  function handleAdminUsersHierarchy(ctx) {
    const users = (ctx.db.users || []).map(u => ({
      id: u.id,
      user_id: u.user_id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      portal_type: u.portal_type,
      role: u.role,
      hierarchy_role: resolveUserHierarchyRole(u),
      reports_to_user_id: u.reports_to_user_id || 1,
      status: u.status,
      assigned_tasks_count: (ctx.db.tasks || []).filter(t => t.assigned_to_user_id === u.id).length
    }));
    return { users };
  }

  function handleAdminTasks(ctx) {
    if (ctx.method === 'GET') {
      const tasks = ctx.db.tasks || [];
      return { tasks };
    }
    if (ctx.method === 'POST') {
      const session = getCurrentUserSession();
      if (!session || session.portal_type !== 'ADMIN') {
        throw new Error('Unauthorized: Only Admin can assign tasks.');
      }
      const b = ctx.body;
      if (!b.title || !b.assigned_to_user_id || !b.deadline) {
        throw new Error('Title, assigned user, and deadline are required.');
      }
      const assignedUser = (ctx.db.users || []).find(u => u.id === Number(b.assigned_to_user_id));
      if (!assignedUser) throw new Error('Assigned user not found.');

      const nextId = (ctx.db.tasks || []).reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
      const taskCode = 'TSK-2026-' + String(nextId).padStart(3, '0');
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newTask = {
        id: nextId,
        task_code: taskCode,
        title: b.title.trim(),
        description: b.description || '',
        project_ref: b.project_ref || 'General Operations',
        task_type: b.task_type || 'General',
        hierarchy_role: assignedUser.hierarchy_role || b.hierarchy_role || 'Staff',
        assigned_to_user_id: assignedUser.id,
        assigned_to_name: assignedUser.full_name,
        assigned_to_role: assignedUser.hierarchy_role || assignedUser.role,
        assigned_by_user_id: session.id,
        assigned_by_name: session.full_name + ' (Admin)',
        priority: b.priority || 'Medium',
        status: 'Assigned',
        start_date: b.start_date || new Date().toISOString().substring(0, 10),
        deadline: b.deadline,
        instructions: b.instructions || '',
        donor_id: b.donor_id ? Number(b.donor_id) : null,
        donation_id: b.donation_id ? Number(b.donation_id) : null,
        cert_id: b.cert_id ? Number(b.cert_id) : null,
        submission_text: null,
        submission_file_name: null,
        submission_date: null,
        revision_count: 0,
        rejection_reason: null,
        required_corrections: null,
        created_at: now,
        updated_at: now
      };

      ctx.db.tasks = ctx.db.tasks || [];
      ctx.db.tasks.unshift(newTask);

      ctx.db.task_history = ctx.db.task_history || [];
      ctx.db.task_history.unshift({
        id: (ctx.db.task_history.length || 0) + 1,
        task_id: nextId,
        action: 'Task Assigned',
        performed_by_id: session.id,
        performed_by_name: session.full_name,
        from_user_id: null,
        to_user_id: assignedUser.id,
        details: 'Initial assignment to ' + assignedUser.full_name + ' (' + (assignedUser.hierarchy_role || assignedUser.role) + ') with deadline ' + b.deadline,
        created_at: now
      });

      ctx.db.notifications = ctx.db.notifications || [];
      ctx.db.notifications.unshift({
        id: (ctx.db.notifications.length || 0) + 1,
        user_id: assignedUser.id,
        title: 'New Task: ' + newTask.title,
        message: 'Admin ' + session.full_name + ' assigned you a new task with deadline ' + newTask.deadline,
        type: 'TASK_ASSIGNED',
        task_id: nextId,
        is_read: 0,
        created_at: now
      });

      MockDB.save(ctx.db);
      return { success: true, message: 'Task ' + taskCode + ' successfully assigned.', task: newTask };
    }
  }

  function handlePersonalTasks(ctx) {
    const session = getCurrentUserSession();
    if (!session) throw new Error('Not authenticated.');

    const tasks = (ctx.db.tasks || []).filter(t => t.assigned_to_user_id === session.id);
    const notifications = (ctx.db.notifications || []).filter(n => n.user_id === session.id);
    return { tasks, notifications };
  }

  function handlePersonalTaskSubmit(taskId, body, db) {
    const session = getCurrentUserSession();
    if (!session) throw new Error('Not authenticated.');
    const t = (db.tasks || []).find(item => item.id === taskId);
    if (!t) throw new Error('Task not found.');

    if (t.assigned_to_user_id !== session.id) {
      throw new Error('Unauthorized: You can only submit work for tasks assigned to you.');
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    t.submission_text = body.submission_text || 'Work completed and submitted for Admin review.';
    t.submission_file_name = body.submission_file_name || 'project_deliverable.pdf';
    t.submission_date = now;
    t.status = 'Submitted for Review';
    t.updated_at = now;

    db.task_history = db.task_history || [];
    db.task_history.unshift({
      id: db.task_history.length + 1,
      task_id: t.id,
      action: 'Submitted for Review',
      performed_by_id: session.id,
      performed_by_name: session.full_name,
      from_user_id: session.id,
      to_user_id: t.assigned_by_user_id,
      details: 'User submitted task work for review. Remarks: ' + (body.submission_text || 'Deliverable attached.'),
      created_at: now
    });

    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: db.notifications.length + 1,
      user_id: t.assigned_by_user_id,
      title: 'Submission Received: ' + t.title,
      message: session.full_name + ' submitted deliverables for task ' + t.task_code,
      type: 'TASK_SUBMITTED',
      task_id: t.id,
      is_read: 0,
      created_at: now
    });

    MockDB.save(db);
    return { success: true, message: 'Work successfully submitted for Admin review.', task: t };
  }

  function handleAdminTaskReview(taskId, body, db) {
    const session = getCurrentUserSession();
    if (!session || session.portal_type !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admin can review and approve/reject tasks.');
    }
    const t = (db.tasks || []).find(item => item.id === taskId);
    if (!t) throw new Error('Task not found.');

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const action = body.action;

    if (action === 'APPROVE') {
      t.status = 'Approved';
      t.updated_at = now;

      if (t.task_type === '80G Certificate Processing' && t.donation_id) {
        const don = (db.donations || []).find(d => d.id === t.donation_id);
        if (don) {
          don.doc_status = 'Verified';
          don.tax_cert_number = don.tax_cert_number || '80G/MINDS/2026-27/' + String(t.id).padStart(4, '0');
        }
      }

      db.task_history = db.task_history || [];
      db.task_history.unshift({
        id: db.task_history.length + 1,
        task_id: t.id,
        action: 'Task Approved',
        performed_by_id: session.id,
        performed_by_name: session.full_name,
        from_user_id: session.id,
        to_user_id: t.assigned_to_user_id,
        details: 'Admin approved project submission. Remarks: ' + (body.comments || 'Submission meets all quality standards.'),
        created_at: now
      });

      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: db.notifications.length + 1,
        user_id: t.assigned_to_user_id,
        title: 'Task Approved: ' + t.title,
        message: 'Admin Dr. Ramesh Narayan has approved your submission for ' + t.task_code,
        type: 'TASK_APPROVED',
        task_id: t.id,
        is_read: 0,
        created_at: now
      });

      MockDB.save(db);
      return { success: true, message: 'Task ' + t.task_code + ' approved successfully.', task: t };
    }

    if (action === 'REJECT') {
      if (!body.rejection_reason || !body.required_corrections) {
        throw new Error('Rejection reason and required corrections are strictly mandatory.');
      }
      t.status = 'Revision Required';
      t.rejection_reason = body.rejection_reason.trim();
      t.required_corrections = body.required_corrections.trim();
      t.revision_count = (t.revision_count || 0) + 1;
      t.updated_at = now;

      if (body.new_deadline) {
        t.deadline = body.new_deadline;
      }
      if (body.instructions) {
        t.instructions = body.instructions;
      }

      let recipientUser = null;
      if (body.reassign_to_user_id && Number(body.reassign_to_user_id) !== t.assigned_to_user_id) {
        recipientUser = (db.users || []).find(u => u.id === Number(body.reassign_to_user_id));
        if (recipientUser) {
          t.assigned_to_user_id = recipientUser.id;
          t.assigned_to_name = recipientUser.full_name;
          t.assigned_to_role = recipientUser.hierarchy_role || recipientUser.role;
          t.status = 'Reassigned';
        }
      }

      db.task_history = db.task_history || [];
      db.task_history.unshift({
        id: db.task_history.length + 1,
        task_id: t.id,
        action: recipientUser ? 'Rejected & Reassigned' : 'Revision Required (Rejected)',
        performed_by_id: session.id,
        performed_by_name: session.full_name,
        from_user_id: session.id,
        to_user_id: t.assigned_to_user_id,
        details: 'Admin rejected submission. Reason: ' + t.rejection_reason + ' | Corrections: ' + t.required_corrections + (body.new_deadline ? ' | New Deadline: ' + body.new_deadline : ''),
        rejection_reason: t.rejection_reason,
        required_corrections: t.required_corrections,
        created_at: now
      });

      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: db.notifications.length + 1,
        user_id: t.assigned_to_user_id,
        title: 'Action Required: Revision for ' + t.title,
        message: 'Admin requested revisions: ' + t.rejection_reason + '. Please review corrections needed.',
        type: 'TASK_REJECTED',
        task_id: t.id,
        is_read: 0,
        created_at: now
      });

      MockDB.save(db);
      return { success: true, message: 'Revision task updated with rejection comments.', task: t };
    }

    throw new Error('Invalid review action: ' + action);
  }

  function handleAdminTaskReassign(taskId, body, db) {
    const session = getCurrentUserSession();
    if (!session || session.portal_type !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admin accounts can transfer or reassign tasks.');
    }
    const t = (db.tasks || []).find(item => item.id === taskId);
    if (!t) throw new Error('Task not found.');

    const targetUserId = body.new_assigned_to_user_id ? Number(body.new_assigned_to_user_id) : t.assigned_to_user_id;
    const targetUser = (db.users || []).find(u => u.id === targetUserId);
    if (!targetUser) throw new Error('Target user not found.');

    const isSwitch = targetUserId !== t.assigned_to_user_id;
    const oldUserId = t.assigned_to_user_id;
    const oldUserName = t.assigned_to_name;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    t.assigned_to_user_id = targetUser.id;
    t.assigned_to_name = targetUser.full_name;
    t.assigned_to_role = targetUser.hierarchy_role || targetUser.role;
    t.hierarchy_role = targetUser.hierarchy_role || t.hierarchy_role;
    t.status = isSwitch ? 'Reassigned' : 'In Progress';
    t.updated_at = now;

    if (body.deadline) t.deadline = body.deadline;
    if (body.priority) t.priority = body.priority;
    if (body.instructions) t.instructions = body.instructions;

    const actionTitle = isSwitch ? 'Task Switched' : 'Task Reassigned';
    const actionDetails = isSwitch
      ? 'Task switched from ' + oldUserName + ' to ' + targetUser.full_name + ' (' + t.assigned_to_role + '). Reason: ' + (body.transfer_reason || 'Switched by Admin.')
      : 'Task deadline/priority reassigned to current owner ' + targetUser.full_name + ' with new deadline: ' + t.deadline + '. Reason: ' + (body.transfer_reason || 'Reassigned by Admin.');

    db.task_history = db.task_history || [];
    db.task_history.unshift({
      id: db.task_history.length + 1,
      task_id: t.id,
      action: actionTitle,
      performed_by_id: session.id,
      performed_by_name: session.full_name,
      from_user_id: oldUserId,
      to_user_id: targetUser.id,
      details: actionDetails,
      created_at: now
    });

    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: db.notifications.length + 1,
      user_id: targetUser.id,
      title: isSwitch ? ('Switched Task: ' + t.title) : ('Task Reassigned / Deadline Updated: ' + t.title),
      message: 'Admin updated task ' + t.task_code + '. Deadline: ' + t.deadline,
      type: isSwitch ? 'TASK_SWITCHED' : 'TASK_REASSIGNED',
      task_id: t.id,
      is_read: 0,
      created_at: now
    });

    MockDB.save(db);
    return {
      success: true,
      message: isSwitch ? `Task successfully switched to ${targetUser.full_name} (${t.assigned_to_role}).` : `Task successfully reassigned to ${targetUser.full_name} with new deadline ${t.deadline}.`,
      task: t
    };
  }

  function handleAdminTaskEdit(taskId, body, db) {
    const session = getCurrentUserSession();
    if (!session || session.portal_type !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admin accounts can edit tasks.');
    }
    const t = (db.tasks || []).find(item => item.id === taskId);
    if (!t) throw new Error('Task not found.');

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (body.title) t.title = body.title.trim();
    if (body.description !== undefined) t.description = body.description;
    if (body.deadline) t.deadline = body.deadline;
    if (body.priority) t.priority = body.priority;
    if (body.instructions !== undefined) t.instructions = body.instructions;
    if (body.project_ref !== undefined) t.project_ref = body.project_ref;
    t.updated_at = now;

    db.task_history = db.task_history || [];
    db.task_history.unshift({
      id: db.task_history.length + 1,
      task_id: t.id,
      action: 'Task Updated',
      performed_by_id: session.id,
      performed_by_name: session.full_name,
      from_user_id: null,
      to_user_id: t.assigned_to_user_id,
      details: 'Admin updated task parameters and instructions.',
      created_at: now
    });

    MockDB.save(db);
    return { success: true, message: 'Task ' + t.task_code + ' updated successfully.', task: t };
  }

  function handleTaskDetails(taskId, db) {
    const session = getCurrentUserSession();
    if (!session) throw new Error('Not authenticated.');
    const t = (db.tasks || []).find(item => item.id === taskId);
    if (!t) throw new Error('Task not found.');

    if (session.portal_type !== 'ADMIN' && t.assigned_to_user_id !== session.id) {
      throw new Error('Unauthorized: You do not have permission to view this task.');
    }

    const history = (db.task_history || []).filter(h => h.task_id === taskId);
    return { task: t, history };
  }

  function handleCreate80GTask(ctx) {
    const session = getCurrentUserSession();
    if (!session || session.portal_type !== 'ADMIN') {
      throw new Error('Unauthorized: Only Admin can create 80G processing tasks.');
    }
    const b = ctx.body;
    if (!b.donation_id || !b.assigned_to_user_id || !b.deadline) {
      throw new Error('Donation ID, assigned recipient user, and deadline are required.');
    }

    const donation = (ctx.db.donations || []).find(d => d.id === Number(b.donation_id));
    if (!donation) throw new Error('Donation record not found.');

    if (donation.payment_status !== 'Verified' && donation.doc_status !== 'Verified') {
      throw new Error('80G Processing Task cannot be generated until the donor contribution is officially approved and verified.');
    }

    const existing = (ctx.db.tasks || []).find(t => t.donation_id === donation.id && t.task_type === '80G Certificate Processing' && t.status !== 'Completed' && t.status !== 'Approved');
    if (existing && !b.allow_duplicate) {
      throw new Error('An active 80G processing task (' + existing.task_code + ') already exists for this donation.');
    }

    const assignedUser = (ctx.db.users || []).find(u => u.id === Number(b.assigned_to_user_id));
    if (!assignedUser) throw new Error('Selected recipient user not found.');

    const nextId = (ctx.db.tasks || []).reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
    const taskCode = 'TSK-80G-' + String(nextId).padStart(3, '0');
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const donor = (ctx.db.donors || []).find(dn => dn.id === donation.donor_id) || {};

    const newTask = {
      id: nextId,
      task_code: taskCode,
      title: 'Generate 80G Tax Exemption Certificate for ' + (donor.full_name || 'Donor') + ' (₹' + Number(donation.amount).toLocaleString('en-IN') + ')',
      description: 'Process and issue IT Section 80G certificate for receipt ' + donation.receipt_no + '. Verify PAN (' + (donor.pan_number || 'N/A') + ') and reconcile bank inflow.',
      project_ref: 'Donation Receipt ' + donation.receipt_no + ' • ' + (donation.purpose_name || 'General Welfare'),
      task_type: '80G Certificate Processing',
      hierarchy_role: assignedUser.hierarchy_role || b.hierarchy_role || 'Manager',
      assigned_to_user_id: assignedUser.id,
      assigned_to_name: assignedUser.full_name,
      assigned_to_role: assignedUser.hierarchy_role || assignedUser.role,
      assigned_by_user_id: session.id,
      assigned_by_name: session.full_name + ' (Admin)',
      priority: b.priority || 'Urgent',
      status: 'Assigned',
      start_date: b.start_date || new Date().toISOString().substring(0, 10),
      deadline: b.deadline,
      instructions: b.instructions || 'Validate donor PAN number, calculate deductible exemption, and upload signed 80G PDF draft.',
      donor_id: donation.donor_id,
      donation_id: donation.id,
      cert_id: null,
      submission_text: null,
      submission_file_name: null,
      submission_date: null,
      revision_count: 0,
      rejection_reason: null,
      required_corrections: null,
      created_at: now,
      updated_at: now
    };

    ctx.db.tasks = ctx.db.tasks || [];
    ctx.db.tasks.unshift(newTask);

    ctx.db.task_history = ctx.db.task_history || [];
    ctx.db.task_history.unshift({
      id: ctx.db.task_history.length + 1,
      task_id: nextId,
      action: '80G Task Generated',
      performed_by_id: session.id,
      performed_by_name: session.full_name,
      from_user_id: null,
      to_user_id: assignedUser.id,
      details: '80G Certificate workflow initiated for Donation ' + donation.receipt_no + ' and assigned to ' + assignedUser.full_name + ' (' + newTask.assigned_to_role + ').',
      created_at: now
    });

    ctx.db.notifications = ctx.db.notifications || [];
    ctx.db.notifications.unshift({
      id: ctx.db.notifications.length + 1,
      user_id: assignedUser.id,
      title: 'New 80G Certificate Task Assigned',
      message: 'Admin assigned 80G tax certificate generation for ' + (donor.full_name || 'Donor') + ' (₹' + Number(donation.amount).toLocaleString('en-IN') + '). Deadline: ' + newTask.deadline,
      type: 'TASK_80G',
      task_id: nextId,
      is_read: 0,
      created_at: now
    });

    MockDB.save(ctx.db);
    return { success: true, message: '80G Certificate task ' + taskCode + ' created and assigned to ' + assignedUser.full_name + '.', task: newTask };
  }

  // Route map for static pathname lookups
  
  function handleAdminDonations(ctx) {
    const donations = (ctx.db.donations || []).map(don => {
      const donor = (ctx.db.donors || []).find(d => d.id === don.donor_id) || {};
      const taxCert = (ctx.db.donor_tax_certificates || []).find(tc => tc.donation_id === don.id);
      return {
        ...don,
        donor_code: donor.donor_code || don.donor_code || 'DNR-000',
        donor_name: donor.full_name || don.donor_name || 'Anonymous Donor',
        donor_phone: donor.phone || don.donor_phone || '',
        pan_number: donor.pan_number || don.pan_number || 'AAACT2026P',
        tax_cert_number: taxCert ? taxCert.cert_number : (don.tax_cert_number || null)
      };
    });
    return { donations };
  }

  function handleAdminTrainers(ctx) {
    const trainers = (ctx.db.trainers || []).map(t => {
      const user = (ctx.db.users || []).find(u => u.id === t.user_id) || {};
      const assignedEvents = (ctx.db.events || []).filter(e => e.trainer_id === t.id);
      return {
        ...t,
        full_name: t.full_name || user.full_name || 'Trainer Faculty',
        email: t.email || user.email || '',
        phone: t.phone || user.phone || '',
        user_status: user.status || 'Active',
        event_count: assignedEvents.length,
        assigned_events: assignedEvents.map(e => ({
          id: e.id,
          event_code: e.event_code,
          title: e.title,
          start_date: e.start_date,
          last_date: e.last_date,
          status: e.status,
          venue: e.venue
        }))
      };
    });
    return { trainers };
  }

  function handleAdminEvents(ctx) {
    if (ctx.method === 'POST') {
      const b = ctx.body || {};
      const count = (ctx.db.events || []).length + 1;
      const eventCode = `EVT-2026-${String(count).padStart(2, '0')}`;
      const trainer = (ctx.db.trainers || []).find(t => t.id === Number(b.trainer_id)) || (ctx.db.trainers || [])[0] || {};
      const newEv = {
        id: count,
        event_code: eventCode,
        title: b.title || 'New Event Schedule',
        description: b.description || '',
        start_date: b.start_date || new Date().toISOString().slice(0, 10),
        last_date: b.last_date || new Date().toISOString().slice(0, 10),
        trainer_id: Number(b.trainer_id) || trainer.id || 1,
        trainer_name: trainer.full_name || 'Prof. Arvind Deshmukh',
        venue: b.venue || 'Main Campus Auditorium',
        status: b.status || 'Scheduled',
        auto_cert_processed: 0,
        created_at: new Date().toISOString()
      };
      ctx.db.events = ctx.db.events || [];
      ctx.db.events.unshift(newEv);
      MockDB.save(ctx.db);
      return { message: 'Event scheduled successfully', event_code: eventCode, event: newEv };
    }

    const events = (ctx.db.events || []).map(ev => {
      const trainer = (ctx.db.trainers || []).find(t => t.id === ev.trainer_id) || {};
      const user = trainer.user_id ? (ctx.db.users || []).find(u => u.id === trainer.user_id) : null;
      const trainerName = ev.trainer_name || trainer.full_name || user?.full_name || 'Unassigned';
      const isCompleted = ev.status === 'Completed';
      const joinedStudents = (ctx.db.students || []).filter(s => s.student_status === 'Joined' || s.student_status === 'Enrolled');
      const completedStudents = (ctx.db.students || []).filter(s => s.academic_status === 'Completed');
      const attendeeCount = isCompleted ? (completedStudents.length || 12) : (joinedStudents.length || 18);
      return {
        ...ev,
        trainer_name: trainerName,
        attendee_count: attendeeCount,
        attendee_type: isCompleted ? 'Completed' : 'Enrolled'
      };
    });
    return { events };
  }

  
  function handleAdminCreateStudentLogin(ctx) {
    const { full_name, email, phone } = ctx.body || {};
    if (!full_name || !email || !phone) {
      return { error: 'Name, Email ID, and Phone Number are required.' };
    }

    // Phone validation: exactly 10 digits
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return { error: 'Please enter a valid phone number.' };
    }

    // Backend automation generates User ID and Student Code
    const count = (ctx.db.students || []).length + 1;
    const autoUserId = `stu_${full_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}_${String(count).padStart(3, '0')}`;
    const studentCode = `STU-2026-${String(count).padStart(3, '0')}`;
    const newUserId = (ctx.db.users || []).length + 1;

    const newUser = {
      id: newUserId,
      user_id: autoUserId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      phone: cleanPhone,
      dob: '2005-01-01',
      portal_type: 'STUDENT',
      role: 'Student',
      status: 'Active'
    };

    const newStudent = {
      id: count,
      user_id: newUserId,
      student_code: studentCode,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      enrolled_program: 'Full Stack Digital Skills',
      program_code: 'PRG-FSD-01',
      program_id: 1,
      batch: 'Cohort 2026',
      academic_status: 'In Progress',
      student_status: 'Joined',
      finance_clearance: 1,
      created_by: 'Backend Automation'
    };

    ctx.db.users = ctx.db.users || [];
    ctx.db.users.push(newUser);
    ctx.db.students = ctx.db.students || [];
    ctx.db.students.push(newStudent);
    MockDB.save(ctx.db);

    return {
      success: true,
      message: `Student login created successfully by backend automation! Generated User ID: ${autoUserId} (Student Code: ${studentCode})`,
      user_id: autoUserId,
      student_code: studentCode
    };
  }

  
  window.INDIAN_BANKS_DATA = [
  {
    "name": "State Bank of India",
    "branches": [
      {
        "branch": "Mumbai Main Branch (Fort)",
        "ifsc": "SBIN0000300"
      },
      {
        "branch": "New Delhi Main Branch (Parliament St)",
        "ifsc": "SBIN0000691"
      },
      {
        "branch": "Bengaluru Main Branch (St. Marks Rd)",
        "ifsc": "SBIN0000813"
      },
      {
        "branch": "Chennai Main Branch (George Town)",
        "ifsc": "SBIN0000800"
      },
      {
        "branch": "Kolkata Main Branch (Strand Rd)",
        "ifsc": "SBIN0000001"
      },
      {
        "branch": "Hyderabad Main Branch (Bank Street)",
        "ifsc": "SBIN0000847"
      },
      {
        "branch": "Pune Main Branch",
        "ifsc": "SBIN0000454"
      },
      {
        "branch": "Ahmedabad Main Branch (Bhadra)",
        "ifsc": "SBIN0000301"
      }
    ]
  },
  {
    "name": "HDFC Bank",
    "branches": [
      {
        "branch": "Mumbai - Fort Branch",
        "ifsc": "HDFC0000060"
      },
      {
        "branch": "Mumbai - Nariman Point Branch",
        "ifsc": "HDFC0000004"
      },
      {
        "branch": "New Delhi - Connaught Place",
        "ifsc": "HDFC0000003"
      },
      {
        "branch": "Bengaluru - Kasturba Road",
        "ifsc": "HDFC0000009"
      },
      {
        "branch": "Chennai - ITC Centre Anna Salai",
        "ifsc": "HDFC0000005"
      },
      {
        "branch": "Hyderabad - Lakdikapul",
        "ifsc": "HDFC0000021"
      },
      {
        "branch": "Pune - Bhandarkar Road",
        "ifsc": "HDFC0000007"
      }
    ]
  },
  {
    "name": "ICICI Bank",
    "branches": [
      {
        "branch": "Mumbai - Backbay Reclamation (Nariman Point)",
        "ifsc": "ICIC0000004"
      },
      {
        "branch": "Mumbai - Bandra Kurla Complex (BKC)",
        "ifsc": "ICIC0000544"
      },
      {
        "branch": "New Delhi - Connaught Place",
        "ifsc": "ICIC0000007"
      },
      {
        "branch": "Bengaluru - M G Road",
        "ifsc": "ICIC0000002"
      },
      {
        "branch": "Chennai - Nungambakkam",
        "ifsc": "ICIC0000001"
      },
      {
        "branch": "Hyderabad - Begumpet",
        "ifsc": "ICIC0000008"
      }
    ]
  },
  {
    "name": "Axis Bank",
    "branches": [
      {
        "branch": "Mumbai - Corporate Office (Worli)",
        "ifsc": "UTIB0000004"
      },
      {
        "branch": "Mumbai - Fort (Sir P M Road)",
        "ifsc": "UTIB0000005"
      },
      {
        "branch": "New Delhi - Statesman House (Barakhamba)",
        "ifsc": "UTIB0000007"
      },
      {
        "branch": "Bengaluru - M G Road",
        "ifsc": "UTIB0000009"
      },
      {
        "branch": "Chennai - Mylapore",
        "ifsc": "UTIB0000006"
      }
    ]
  },
  {
    "name": "Punjab National Bank",
    "branches": [
      {
        "branch": "New Delhi - Parliament Street",
        "ifsc": "PUNB0000100"
      },
      {
        "branch": "Mumbai - Fort Brady House",
        "ifsc": "PUNB0001300"
      },
      {
        "branch": "Kolkata - Brabourne Road",
        "ifsc": "PUNB0000800"
      },
      {
        "branch": "Bengaluru - City Branch",
        "ifsc": "PUNB0001700"
      }
    ]
  },
  {
    "name": "Bank of Baroda",
    "branches": [
      {
        "branch": "Vadodara - Mandvi Main Branch",
        "ifsc": "BARB0MANDVI"
      },
      {
        "branch": "Mumbai - Corporate Centre (BKC)",
        "ifsc": "BARB0BCCMUM"
      },
      {
        "branch": "Mumbai - Fort Main Branch",
        "ifsc": "BARB0FORTXX"
      },
      {
        "branch": "New Delhi - Parliament Street",
        "ifsc": "BARB0PARLIA"
      }
    ]
  },
  {
    "name": "Canara Bank",
    "branches": [
      {
        "branch": "Bengaluru - Head Office (J C Road)",
        "ifsc": "CNRB0000001"
      },
      {
        "branch": "Mumbai - Fort",
        "ifsc": "CNRB0000100"
      },
      {
        "branch": "New Delhi - Connaught Circus",
        "ifsc": "CNRB0000150"
      },
      {
        "branch": "Chennai - Mount Road",
        "ifsc": "CNRB0000200"
      }
    ]
  },
  {
    "name": "Union Bank of India",
    "branches": [
      {
        "branch": "Mumbai - Samachar Marg (Fort)",
        "ifsc": "UBIN0530018"
      },
      {
        "branch": "New Delhi - F-Block Connaught Place",
        "ifsc": "UBIN0530786"
      },
      {
        "branch": "Bengaluru - Gandhinagar",
        "ifsc": "UBIN0530026"
      }
    ]
  },
  {
    "name": "Indian Bank",
    "branches": [
      {
        "branch": "Chennai - Harbour Main Branch",
        "ifsc": "IDIB000H003"
      },
      {
        "branch": "Mumbai - Fort Branch",
        "ifsc": "IDIB000F008"
      },
      {
        "branch": "New Delhi - Connaught Place",
        "ifsc": "IDIB000N002"
      }
    ]
  },
  {
    "name": "Kotak Mahindra Bank",
    "branches": [
      {
        "branch": "Mumbai - Nariman Point (Bakhtawar)",
        "ifsc": "KKBK0000958"
      },
      {
        "branch": "Mumbai - BKC Kalina",
        "ifsc": "KKBK0000631"
      },
      {
        "branch": "New Delhi - K.G. Marg",
        "ifsc": "KKBK0000172"
      },
      {
        "branch": "Bengaluru - M.G. Road",
        "ifsc": "KKBK0000422"
      }
    ]
  },
  {
    "name": "IDFC FIRST Bank",
    "branches": [
      {
        "branch": "Mumbai - BKC Naman Chambers",
        "ifsc": "IDFB0040101"
      },
      {
        "branch": "New Delhi - Barakhamba Road",
        "ifsc": "IDFB0020101"
      },
      {
        "branch": "Bengaluru - Residency Road",
        "ifsc": "IDFB0040102"
      }
    ]
  },
  {
    "name": "Yes Bank",
    "branches": [
      {
        "branch": "Mumbai - Worli Indiabulls Finance",
        "ifsc": "YESB0000001"
      },
      {
        "branch": "New Delhi - D-Block Connaught Place",
        "ifsc": "YESB0000002"
      }
    ]
  },
  {
    "name": "Bank of India",
    "branches": [
      {
        "branch": "Mumbai - Fort Main Branch",
        "ifsc": "BKID0000001"
      },
      {
        "branch": "New Delhi - Parliament Street",
        "ifsc": "BKID0006000"
      }
    ]
  },
  {
    "name": "Central Bank of India",
    "branches": [
      {
        "branch": "Mumbai - Chandramukhi Nariman Point",
        "ifsc": "CBIN0280001"
      },
      {
        "branch": "New Delhi - Parliament Street",
        "ifsc": "CBIN0280003"
      }
    ]
  },
  {
    "name": "Indian Overseas Bank",
    "branches": [
      {
        "branch": "Chennai - Central Office Anna Salai",
        "ifsc": "IOBA0000001"
      },
      {
        "branch": "Mumbai - Fort",
        "ifsc": "IOBA0000014"
      }
    ]
  },
  {
    "name": "UCO Bank",
    "branches": [
      {
        "branch": "Kolkata - BTM Sarani Head Office",
        "ifsc": "UCBA0000001"
      },
      {
        "branch": "Mumbai - D N Road Fort",
        "ifsc": "UCBA0000021"
      }
    ]
  },
  {
    "name": "Federal Bank",
    "branches": [
      {
        "branch": "Aluva - Head Office",
        "ifsc": "FDRL0001001"
      },
      {
        "branch": "Mumbai - Fort",
        "ifsc": "FDRL0001201"
      }
    ]
  },
  {
    "name": "IndusInd Bank",
    "branches": [
      {
        "branch": "Mumbai - Opera House",
        "ifsc": "INDB0000001"
      },
      {
        "branch": "New Delhi - Barakhamba Road",
        "ifsc": "INDB0000005"
      }
    ]
  },
  {
    "name": "AU Small Finance Bank",
    "branches": [
      {
        "branch": "Jaipur - C-Scheme Main Branch",
        "ifsc": "AUBL0002001"
      },
      {
        "branch": "Mumbai - Bandra West",
        "ifsc": "AUBL0002041"
      }
    ]
  }
];

  
  function handleRegisterTrainer(ctx) {
    const { full_name, email, phone, specialization, qualification, dob } = ctx.body;
    if (!full_name || !email || !phone || !specialization) {
      return { error: 'Full name, email, mobile number, and specialization are required.' };
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return { error: 'Please enter a valid 10-digit mobile number.' };
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check duplicate trainer
    const existing = (ctx.db.users || []).find(u => 
      (u.email && u.email.toLowerCase() === cleanEmail) || 
      (u.phone && String(u.phone).replace(/\D/g, '') === cleanPhone)
    );
    if (existing) {
      return { error: 'A trainer registration with this Email or Mobile Number already exists.' };
    }

    const newUserId = (ctx.db.users || []).length + 1;
    const newTrainerId = (ctx.db.trainers || []).length + 1;
    // Sequential collision-resistant format: TRN20260001
    const code = `TRN2026${String(newTrainerId).padStart(4, '0')}`;
    const autoUserId = code.toLowerCase();

    const newUser = {
      id: newUserId,
      user_id: autoUserId,
      email: cleanEmail,
      full_name: full_name.trim(),
      phone: cleanPhone,
      dob: dob || '1985-01-01',
      portal_type: 'TRAINER',
      role: 'Trainer',
      status: 'Active'
    };

    const newTrainer = {
      id: newTrainerId,
      user_id: newUserId,
      trainer_code: code,
      full_name: full_name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      specialization: specialization.trim(),
      qualification: qualification || 'Master Trainer & Industry Specialist',
      dob: dob || '1985-01-01',
      approval_status: 'Approved'
    };

    ctx.db.users = ctx.db.users || [];
    ctx.db.users.push(newUser);
    ctx.db.trainers = ctx.db.trainers || [];
    ctx.db.trainers.push(newTrainer);
    MockDB.save(ctx.db);

    return {
      success: true,
      message: `Trainer Registration Successful! Your unique Trainer ID is ${code}. Login with User ID: ${autoUserId}`,
      trainer_code: code,
      user_id: autoUserId
    };
  }

  
  function handleAdminDonorsList(ctx) {
    const donors = ctx.db.donors || [];
    const donations = ctx.db.donations || [];
    const mapped = donors.map(d => {
      const dDonations = donations.filter(item => item.donor_id === d.id || item.donor_code === d.donor_code);
      const total = dDonations.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
      return {
        ...d,
        donation_count: dDonations.length,
        total_contributed: total,
        total_donated: total
      };
    });
    return { donors: mapped };
  }

  const staticRoutes = {
    'POST:/api/auth/login': handleAuthLogin,
    'GET:/api/auth/me': handleAuthMe,
    'POST:/api/auth/logout': handleAuthLogout,
    'POST:/api/auth/register-student': handleRegisterStudent,
    'POST:/api/auth/register-donor': handleRegisterDonor,
    'POST:/api/auth/register-trainer': handleRegisterTrainer,
    'GET:/api/admin/overview': handleAdminOverview,
    'GET:/api/admin/special-dates': handleAdminSpecialDates,
    'GET:/api/admin/programs': handleAdminPrograms,
    'POST:/api/admin/programs': handleAdminPrograms,
    'GET:/api/admin/students/counts': handleAdminStudentsCounts,
    'GET:/api/admin/students/calendar-events': handleAdminStudentsCalendar,
    'GET:/api/admin/students': handleAdminStudents,
    'POST:/api/admin/students': handleAdminStudents,
    'POST:/api/admin/create-student-login': handleAdminCreateStudentLogin,
    'POST:/api/admin/students/run-7day-automation': handle7DayNotificationAutomation,
    'POST:/api/admin/certificates/trigger-engine': () => ({ message: 'Automated certificate engine executed.' }),
    'GET:/api/admin/certificates': handleCertificates,
    'POST:/api/admin/certificates/generate': handleCertificates,
    'GET:/api/certificates/verify': handleCertificates,
    'GET:/api/admin/donors': handleAdminDonorsList,
    'GET:/api/admin/donations': handleAdminDonations,
    'GET:/api/admin/trainers': handleAdminTrainers,
    'GET:/api/admin/events': handleAdminEvents,
    'POST:/api/admin/events': handleAdminEvents,
    'GET:/api/admin/email-logs': ctx => ({ logs: ctx.db.email_logs || [] }),
    'GET:/api/admin/audit-logs': ctx => ({ logs: ctx.db.audit_logs || [] }),
    'GET:/api/finance/records': handleFinanceRecords,
    'POST:/api/finance/records': handleFinanceRecords,
    'GET:/api/student/dashboard': handleStudentDashboard,
    'PUT:/api/student/profile': handleStudentProfileUpdate,
    'GET:/api/donor/dashboard': handleDonorDashboard,
    'POST:/api/donor/donations': handleDonorDonationSubmit,
    'PUT:/api/donor/profile': handleDonorProfileUpdate,
    'GET:/api/trainer/dashboard': handleTrainerDashboard,
    'POST:/api/trainer/session-logs': handleTrainerSessionLogs,
    'POST:/api/trainer/course-modules': handleTrainerCourseModules,
    'PUT:/api/trainer/profile': handleTrainerProfileUpdate,
    'GET:/api/admin/global-search': handleGlobalSearch,
    'GET:/api/admin/users-hierarchy': handleAdminUsersHierarchy,
    'GET:/api/admin/tasks': handleAdminTasks,
    'POST:/api/admin/tasks': handleAdminTasks,
    'POST:/api/admin/tasks/80g': handleCreate80GTask,
    'GET:/api/tasks/my-tasks': handlePersonalTasks
  };

  const studentStatusRegex = /^\/api\/admin\/students\/(\d+)\/status$/;
  const studentAcademicRegex = /^\/api\/admin\/students\/(\d+)\/academic$/;
  const certIdRegex = /^\/api\/certificates\/(\d+)$/;
  const donReviewRegex = /^\/api\/admin\/donations\/(\d+)\/review$/;
  const founderApprovalRegex = /^\/api\/admin\/certificates\/(\d+)\/founder-approval$/;
  const studentEnrollEventRegex = /^\/api\/student\/enroll-event\/(\d+)$/;
  const trainerEvalStudentRegex = /^\/api\/trainer\/evaluate-student\/(\d+)$/;
  const donorDonationUpdateRegex = /^\/api\/donor\/donations\/(\d+)$/;
  const taskDetailsRegex = /^\/api\/tasks\/(\d+)$/;
  const taskSubmitRegex = /^\/api\/tasks\/(\d+)\/submit$/;
  const taskReviewRegex = /^\/api\/admin\/tasks\/(\d+)\/review$/;
  const taskReassignRegex = /^\/api\/admin\/tasks\/(\d+)\/reassign$/;
  const taskEditRegex = /^\/api\/admin\/tasks\/(\d+)\/edit$/;

  function handleParameterizedRoutes(ctx) {
    const { pathname, method, body, db } = ctx;

    const statusMatch = studentStatusRegex.exec(pathname);
    if (statusMatch && method === 'PUT') {
      return handleStudentStatusUpdate(Number(statusMatch[1]), body, db);
    }

    const academicMatch = studentAcademicRegex.exec(pathname);
    if (academicMatch && method === 'PUT') {
      return handleStudentAcademicUpdate(Number(academicMatch[1]), body, db);
    }

    const certMatch = certIdRegex.exec(pathname);
    if (certMatch && method === 'GET') {
      const cert = (db.certificates || []).find(c => c.id === Number(certMatch[1]));
      if (!cert) throw new Error('Certificate not found');
      return { certificate: cert };
    }

    const donReviewMatch = donReviewRegex.exec(pathname);
    if (donReviewMatch && method === 'PUT') {
      const don = (db.donations || []).find(d => d.id === Number(donReviewMatch[1]));
      if (don) {
        if (body.payment_status) don.payment_status = body.payment_status;
        if (body.doc_status) don.doc_status = body.doc_status;
        if (body.admin_comments !== undefined) don.admin_comments = body.admin_comments;
        MockDB.save(db);
      }
      return { message: 'Donation status updated successfully' };
    }

    const founderMatch = founderApprovalRegex.exec(pathname);
    if (founderMatch && method === 'PUT') {
      const cert = (db.certificates || []).find(c => c.id === Number(founderMatch[1]));
      if (cert) {
        cert.approval_status = body.decision;
        cert.status = body.decision === 'Approved' ? 'Issued' : (body.decision === 'Rejected' ? 'Rejected' : 'Pending');
        cert.rejection_reason = body.rejection_reason || null;
        MockDB.save(db);
      }
      return { message: `Founder approval updated: ${body.decision}` };
    }

    const enrollMatch = studentEnrollEventRegex.exec(pathname);
    if (enrollMatch && method === 'POST') {
      const evId = Number(enrollMatch[1]);
      const ev = (db.events || []).find(e => e.id === evId);
      return { message: `Successfully enrolled in ${ev?.title || 'event'}!` };
    }

    const evalMatch = trainerEvalStudentRegex.exec(pathname);
    if (evalMatch && method === 'PUT') {
      return { message: 'Student evaluation & attendance saved successfully.' };
    }

    const donUpdateMatch = donorDonationUpdateRegex.exec(pathname);
    if (donUpdateMatch && method === 'PUT') {
      const don = (db.donations || []).find(d => d.id === Number(donUpdateMatch[1]));
      if (don) {
        if (body.beneficiary_target) don.beneficiary_target = body.beneficiary_target;
        if (body.reason_description) don.reason_description = body.reason_description;
        MockDB.save(db);
      }
      return { message: 'Donation information updated successfully within 20-day window.' };
    }

    const tDetailsMatch = taskDetailsRegex.exec(pathname);
    if (tDetailsMatch && method === 'GET') {
      return handleTaskDetails(Number(tDetailsMatch[1]), db);
    }

    const tSubmitMatch = taskSubmitRegex.exec(pathname);
    if (tSubmitMatch && method === 'POST') {
      return handlePersonalTaskSubmit(Number(tSubmitMatch[1]), body, db);
    }

    const tReviewMatch = taskReviewRegex.exec(pathname);
    if (tReviewMatch && method === 'POST') {
      return handleAdminTaskReview(Number(tReviewMatch[1]), body, db);
    }

    const tReassignMatch = taskReassignRegex.exec(pathname);
    if (tReassignMatch && method === 'POST') {
      return handleAdminTaskReassign(Number(tReassignMatch[1]), body, db);
    }

    const tEditMatch = taskEditRegex.exec(pathname);
    if (tEditMatch && method === 'PUT') {
      return handleAdminTaskEdit(Number(tEditMatch[1]), body, db);
    }

    return null;
  }

  // Top-level dispatcher with low cognitive complexity (<= 3)
  window.handleMockApiRequest = async function (url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const parsedUrl = new URL(url, window.location.origin);
    const ctx = {
      method,
      pathname: parsedUrl.pathname,
      searchParams: parsedUrl.searchParams,
      body: parseRequestBody(options.body),
      db: MockDB.get()
    };

    const routeKey = `${method}:${ctx.pathname}`;
    const staticHandler = staticRoutes[routeKey];
    if (staticHandler) {
      return staticHandler(ctx);
    }

    const paramResult = handleParameterizedRoutes(ctx);
    if (paramResult !== null) {
      return paramResult;
    }

    return { message: 'Operation saved successfully in offline storage.' };
  };
})();
