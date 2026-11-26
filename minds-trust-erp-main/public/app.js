
function getCalCellBorder(isSelected, hasEvents) {
  if (isSelected) return '#0284c7';
  if (hasEvents) return '#10b981';
  return '#e2e8f0';
}
function getCalCellBg(isSelected, hasEvents) {
  if (isSelected) return '#e0f2fe';
  if (hasEvents) return '#f0fdf4';
  return '#ffffff';
}


function getDaysRemainingBadgeClass(days) {
  if (days === 0) return 'badge-green';
  if (days <= 7) return 'badge-yellow';
  return 'badge-gray';
}

function getCategoryBadgeClass(cat) {
  if (cat === 'STUDENT') return 'badge-blue';
  if (cat === 'DONOR') return 'badge-yellow';
  if (cat === 'TRAINER') return 'badge-purple';
  return 'badge-green';
}

function getStudentStatusBadgeClass(status) {
  if (status === 'Joined') return 'badge-green';
  if (status === 'Enrolled') return 'badge-blue';
  if (status === 'Archived') return 'badge-red';
  return 'badge-yellow';
}

// =========================================================================
// MINDS TRUST ERP – UNIFIED MULTI-PORTAL MANAGEMENT SYSTEM
// Portals: 1. Admin Portal (Full Access including Finance) | 2. Student Portal | 3. Donor Portal | 4. Trainer Portal
// =========================================================================

const state = {
  currentUser: null,
  activePortal: 'ADMIN',
  currentView: 'dashboard',
  selectedLoginOption: 'ADMIN'
};

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let toastIcon = 'ℹ';
  if (type === 'success') toastIcon = '✓';
  else if (type === 'error') toastIcon = '⚠';
  toast.innerHTML = `<span>${toastIcon}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

async function api(url, options = {}) {
  try {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

    const res = await fetch(url, {
      headers: defaultHeaders,
      ...options
    });
    
    // Check if response is valid JSON from backend
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }

    // If server returned error JSON, check if it's 404 or backend down
    if (!res.ok && contentType.includes('application/json')) {
      const errorData = await res.json();
      // If deployed on Vercel static where backend is offline, route to mock api
      if (res.status === 404 && typeof window.handleMockApiRequest === 'function') {
        return await window.handleMockApiRequest(url, options);
      }
      throw new Error(errorData.error || 'Request failed');
    }

    // If response is HTML (Vercel rewrite to index.html on missing API) or non-JSON
    if (typeof window.handleMockApiRequest === 'function') {
      return await window.handleMockApiRequest(url, options);
    }

    throw new Error('Server returned non-JSON response');
  } catch (err) {
    // If network error / offline on Vercel, fallback to mock API
    if (typeof window.handleMockApiRequest === 'function') {
      try {
        return await window.handleMockApiRequest(url, options);
      } catch (mockErr) {
        showToast(mockErr.message, 'error');
        throw mockErr;
      }
    }
    showToast(err.message, 'error');
    throw err;
  }
}

// -------------------------------------------------------------
// APP INITIALIZATION & ROUTING
// -------------------------------------------------------------
async function initApp() {
  try {
    const data = await api('/api/auth/me');
    if (data.user) {
      state.currentUser = data.user;
      state.activePortal = data.user.portal_type;
    }
  } catch (err) {
    console.debug('No active login session found on app init:', err?.message || err);
    state.currentUser = null;
  }

  renderApp();
}

function renderApp() {
  const app = document.getElementById('app');
  if (!state.currentUser) {
    renderMultiPortalLanding(app);
  } else {
    renderPortalShell(app);
  }
}

// -------------------------------------------------------------
// 1. PROFESSIONAL LANDING PAGE WITH 4 DISTINCT LOGIN OPTIONS
// -------------------------------------------------------------
function renderMultiPortalLanding(container) {
  const portalOptions = [
    { type: 'ADMIN', label: 'Admin Portal', icon: 'admin_panel_settings', color: '#154d34', desc: 'Complete governance across Students, Donors, Trainers, Events & Finance' },
    { type: 'STUDENT', label: 'Student Portal', icon: 'school', color: '#0369a1', desc: 'Registered courses, event attendance & automated certificates' },
    { type: 'DONOR', label: 'Donor Portal', icon: 'volunteer_activism', color: '#b45309', desc: 'Direct contributions, supporting receipts & 20-day update tracking' },
    { type: 'TRAINER', label: 'Trainer Portal', icon: 'co_present', color: '#7e22ce', desc: 'Assigned cohorts, attendance evaluation & completion remarks' }
  ];

  container.innerHTML = `
    <div class="auth-container">
      <div style="width:100%; max-width:980px; background:#ffffff; border-radius:24px; box-shadow:0 30px 70px rgba(0,0,0,0.3); overflow:hidden; display:flex; flex-direction:column;">
        
        <!-- Top Banner: MINDS TRUST Branding -->
        <div style="background:radial-gradient(circle at top left, #1d6143, #0b2d1e); padding:32px 40px; color:#ffffff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <div style="display:inline-block; background:rgba(255,255,255,0.15); padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.8px; margin-bottom:8px;">
              MINDS TRUST • ENTERPRISE RESOURCE PLANNING (ERP v1.0)
            </div>
            <h1 style="font-size:26px; font-weight:800; letter-spacing:-0.5px;">MINDS TRUST Multi-Portal ERP</h1>
            <p style="font-size:13px; color:#d1fae5; margin-top:4px;">Unified charitable trust management ecosystem for Admin, Students, Donors and Trainers</p>
          </div>
          <img src="/logo.svg" alt="MINDS TRUST Logo" style="width:54px; height:54px;">
        </div>

        <!-- 4-Portal Selection Tabs -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; padding:24px 32px 0;">
          ${portalOptions.map(p => {
            const isSelected = state.selectedLoginOption === p.type;
            const borderStyle = isSelected ? p.color : '#e2e8f0';
            const bgStyle = isSelected ? '#f8fafc' : '#ffffff';
            const selectedBadge = isSelected ? `<span class="badge" style="background:${p.color}; color:#fff; font-size:10px;">SELECTED</span>` : '';
            return `
            <div onclick="selectLoginOption('${p.type}')" style="cursor:pointer; padding:18px; border-radius:16px; border:2px solid ${borderStyle}; background:${bgStyle}; transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                <span class="material-icons-round" style="font-size:28px; color:${p.color};">${p.icon}</span>
                ${selectedBadge}
              </div>
              <div style="font-weight:800; font-size:15px; color:#0f172a;">${p.label}</div>
              <div style="font-size:11.5px; color:#64748b; margin-top:4px; line-height:1.4;">${p.desc}</div>
            </div>`;
          }).join('')}
        </div>

        <!-- Main Login / Register Area -->
        <div style="padding:28px 36px 36px; display:grid; grid-template-columns:1fr 1fr; gap:32px; align-items:start;">
          
          <!-- Left: Dedicated Portal Login Form -->
          <div style="background:#f8fafc; padding:26px; border-radius:18px; border:1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
              <span class="material-icons-round" style="font-size:26px; color:#154d34;">lock</span>
              <div>
                <h3 style="font-size:17px; font-weight:800; color:#0f172a;">Authenticate as ${state.selectedLoginOption}</h3>
                <p style="font-size:12px; color:#64748b;">Sign in with User ID or Email Address</p>
              </div>
            </div>

            <form id="portal-login-form">
              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">User ID or Email</label>
                <input type="text" id="login-identifier" class="form-control" placeholder="e.g. admin or student1" required>
              </div>
              <div class="form-group" style="margin-bottom:20px;">
                <label class="form-label">Password</label>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
              </div>

              <button type="submit" class="btn btn-primary" style="width:100%; border-radius:12px; padding:12px; font-size:14px;">
                Enter ${state.selectedLoginOption} Portal
              </button>
            </form>
          </div>

          <!-- Right: Self-Registration & Quick Test Credentials -->
          <div>
            ${(() => {
              const opt = state.selectedLoginOption;
              if (opt === 'STUDENT') {
                return `<div style="border:1px dashed #0284c7; background:#f0f9ff; padding:20px; border-radius:16px; margin-bottom:20px;">
                  <h4 style="font-size:15px; font-weight:800; color:#0369a1; margin-bottom:4px; display:flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:18px;">school</span> New Student? Register Account</h4>
                  <p style="font-size:12px; color:#0c4a6e; margin-bottom:12px;">Create your student account with instant Student Code generation.</p>
                  <button class="btn btn-primary" style="background:#0284c7; width:100%;" onclick="openStudentRegistrationModal()">Create Student Profile</button>
                </div>`;
              }
              if (opt === 'DONOR') {
                return `<div style="border:1px dashed #b45309; background:#fffbeb; padding:20px; border-radius:16px; margin-bottom:20px;">
                  <h4 style="font-size:15px; font-weight:800; color:#b45309; margin-bottom:4px; display:flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:18px;">volunteer_activism</span> New Benefactor? Register Donor ID</h4>
                  <p style="font-size:12px; color:#78350f; margin-bottom:12px;">Register directly to receive your unique Donor ID and contribute to welfare causes.</p>
                  <button class="btn btn-primary" style="background:#b45309; width:100%;" onclick="openDonorRegistrationModal()">Register as Donor</button>
                </div>`;
              }
              if (opt === 'ADMIN') {
                return `<div style="border:1px solid #e2e8f0; background:#f8fafc; padding:16px; border-radius:14px; margin-bottom:18px; font-size:12px; color:#475569;">
                  <strong>Admin Security Policy:</strong> Admin accounts have complete access to all modules including Finance. Public registration is restricted to authorized personnel.
                </div>`;
              }
              return `<div style="border:1px solid #e2e8f0; background:#f8fafc; padding:16px; border-radius:14px; margin-bottom:18px; font-size:12px; color:#475569;">
                <strong>Trainer Onboarding:</strong> Trainer profiles are provisioned and assigned courses via Admin control.
              </div>`;
            })()}

            <!-- Clickable Demo Credentials (Without separate finance staff) -->
            <div class="login-demo-pills">
              <div style="font-weight:800; color:#0f172a; margin-bottom:8px;">Instant Test Logins (Click to autofill):</div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div>
                  <span class="pill" onclick="prefillMulti('admin', 'admin123', 'ADMIN')"><span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">shield</span> Super Admin</span>
                  <span style="font-size:11px; color:#64748b;">(Full access to Dashboard, Finance & all modules)</span>
                </div>
                <div>
                  <span class="pill" onclick="prefillMulti('student1', 'student123', 'STUDENT')"><span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">school</span> Student</span>
                  <span style="font-size:11px; color:#64748b;">(student1 / student123)</span>
                </div>
                <div>
                  <span class="pill" onclick="prefillMulti('donor1', 'donor123', 'DONOR')"><span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">volunteer_activism</span> Donor</span>
                  <span style="font-size:11px; color:#64748b;">(donor1 / donor123)</span>
                </div>
                <div>
                  <span class="pill" onclick="prefillMulti('trainer1', 'trainer123', 'TRAINER')"><span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">co_present</span> Trainer</span>
                  <span style="font-size:11px; color:#64748b;">(trainer1 / trainer123)</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('portal-login-form').onsubmit = async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, expected_portal: state.selectedLoginOption })
      });
      state.currentUser = res.user;
      state.activePortal = res.user.portal_type;
      state.currentView = 'dashboard';
      showToast(`Welcome back, ${res.user.full_name}! Signed into MINDS TRUST ERP.`);
      renderApp();
    } catch (err) {
      // handled by api toast
    }
  };
}

window.selectLoginOption = function (portalType) {
  state.selectedLoginOption = portalType;
  renderApp();
};

window.prefillMulti = function (id, pass, portal) {
  state.selectedLoginOption = portal;
  renderApp();
  setTimeout(() => {
    const idEl = document.getElementById('login-identifier');
    const passEl = document.getElementById('login-password');
    if (idEl) idEl.value = id;
    if (passEl) passEl.value = pass;
  }, 50);
};

// -------------------------------------------------------------
// 2. MAIN APPLICATION SHELL FOR LOGGED-IN PORTAL
// -------------------------------------------------------------
function renderPortalShell(container) {
  const user = state.currentUser;
  const portal = state.activePortal;

  // Determine Sidebar Menu Items based on active portal
  let menuItems = [];
  if (portal === 'ADMIN') {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard Overview', icon: 'dashboard' },
      { id: 'tasks', label: 'Employee Management', icon: 'badge' },
      { id: 'hierarchy', label: 'Admin Task Workflow', icon: 'account_tree' },
      { id: 'programs', label: 'Program Management', icon: 'school' },
      { id: 'students', label: 'Student Management', icon: 'groups' },
      { id: 'certificates', label: 'Certificate Engine', icon: 'workspace_premium' },
      { id: 'special_dates', label: 'Birthdays & Special Days', icon: 'cake' },
      { id: 'donors', label: 'Donor Management', icon: 'volunteer_activism' },
      { id: 'trainers', label: 'Trainer Management', icon: 'psychology' },
      { id: 'events', label: 'Event Management', icon: 'event' },
      { id: 'finance', label: 'Finance Management', icon: 'account_balance_wallet' },
      { id: 'emails', label: 'Email Automation', icon: 'mark_email_read' },
      { id: 'audit', label: 'Audit Logs', icon: 'manage_history' }
    ];
  } else if (portal === 'STUDENT') {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard Overview', icon: 'dashboard' },
      { id: 'my_tasks', label: 'My Personal Tasks & To-Do', icon: 'task' },
      { id: 'certificates', label: 'My Approved Certificates', icon: 'workspace_premium' },
      { id: 'events', label: 'Events & Participation', icon: 'event' },
      { id: 'resources', label: 'Learning Resources & PDFs', icon: 'menu_book' },
      { id: 'profile', label: 'Profile & Password Settings', icon: 'settings' }
    ];
  } else if (portal === 'DONOR') {
    menuItems = [
      { id: 'dashboard', label: 'Donor Overview', icon: 'dashboard' },
      { id: 'my_tasks', label: 'My Assigned Action Items', icon: 'task' },
      { id: 'contribute', label: 'Submit Donation', icon: 'payments' },
      { id: 'history', label: 'Donation History & Window', icon: 'history' },
      { id: 'tax_certs', label: '80G Tax Exemption', icon: 'receipt_long' },
      { id: 'impact', label: 'Welfare Impact Updates', icon: 'eco' },
      { id: 'profile', label: 'Profile & Security', icon: 'settings' }
    ];
  } else if (portal === 'TRAINER') {
    menuItems = [
      { id: 'dashboard', label: 'Trainer Dashboard', icon: 'dashboard' },
      { id: 'my_tasks', label: 'Faculty Tasks & To-Do', icon: 'task' },
      { id: 'evaluations', label: 'Student Evaluation & Grading', icon: 'rate_review' },
      { id: 'session_logs', label: 'Class Sessions & Hours Log', icon: 'schedule' },
      { id: 'curriculum', label: 'Course Curriculum & Modules', icon: 'menu_book' },
      { id: 'events', label: 'Assigned Events & Cohorts', icon: 'event' },
      { id: 'profile', label: 'Faculty Profile & Security', icon: 'settings' }
    ];
  }

  container.innerHTML = `
    <div class="app-layout">
      <!-- SIDEBAR (Auto-expand on hover, minimized by default) -->
      <aside class="sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-header-brand">
            <div class="sidebar-logo-icon">
              <span class="material-icons-round" style="color:#154d34; font-size:24px;">spa</span>
            </div>
            <div>
              <div class="sidebar-brand-name">MINDS TRUST</div>
              <div class="sidebar-brand-sub">${portal} WORKSPACE</div>
            </div>
          </div>
          <button class="sidebar-collapse-btn" onclick="toggleSidebar()" title="Toggle Menu">
            <span class="material-icons-round">menu</span>
          </button>
        </div>

        <nav class="sidebar-menu">
          <div class="sidebar-category">${portal} MODULES</div>
          ${menuItems.map(m => `
            <a href="javascript:void(0)" class="nav-item ${state.currentView === m.id ? 'active' : ''}" onclick="switchView('${m.id}')" title="${m.label}">
              <span class="material-icons-round">${m.icon}</span>
              <span>${m.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-card-promo">
            <span class="cert-pill">MINDS TRUST ERP</span>
            <div style="font-weight:800; font-size:13px; margin-bottom:2px;">Enterprise Ecosystem</div>
            <div style="font-size:11px; opacity:0.85;">Connected to Master Relational Database</div>
          </div>
        </div>
      </aside>

      <!-- Sidebar Backdrop for Mobile/Tablet -->
      <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebar()"></div>

      <!-- MAIN CONTENT WRAPPER -->
      <div class="main-wrapper" id="app-main-wrapper">
        <header class="topbar">
          <div class="topbar-left" style="display:flex; align-items:center; gap:10px; position:relative;">
            <button class="mobile-menu-toggle" onclick="toggleSidebar()" title="Open Navigation Menu">
              <span class="material-icons-round">menu</span>
            </button>
            <div class="topbar-search-box">
              <span class="material-icons-round" style="font-size:18px; color:#64748b;">search</span>
              <input type="text" id="global-search-input" placeholder="Search by name, student, donor, or event..." oninput="handleGlobalSearch(this.value)" onfocus="handleGlobalSearch(this.value)" onkeydown="handleGlobalSearchKeydown(event)" autocomplete="off">
              <span class="key-badge">⌘ F</span>
            </div>
            <!-- Google-Style Global Search Dropdown Results -->
            <div id="global-search-dropdown" class="google-search-dropdown" style="display:none; position:absolute; top:calc(100% + 8px); left:0; width:520px; max-width:92vw; background:#ffffff; border-radius:18px; box-shadow:0 20px 45px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06); border:1px solid #e2e8f0; z-index:999; max-height:460px; overflow-y:auto;"></div>
          </div>

          <div class="topbar-right">
            <div class="user-badge">
              <div class="user-avatar">${user.full_name ? user.full_name.charAt(0) : 'U'}</div>
              <div>
                <div class="user-meta-name">${user.full_name}</div>
                <div class="user-meta-role">${user.role} (${portal})</div>
              </div>
            </div>

            <button class="topbar-icon-btn" onclick="handleLogout()" title="Logout">
              <span class="material-icons-round" style="font-size:20px;">logout</span>
            </button>
          </div>
        </header>

        <main class="page-container" id="portal-content-mount">
          <!-- Active view loads here -->
        </main>
      </div>
    </div>
  `;

  renderPortalView();
}

window.toggleSidebarCollapse = function () {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const sidebar = document.getElementById('app-sidebar');
  const mainWrapper = document.getElementById('app-main-wrapper');
  if (sidebar) {
    if (state.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
      if (mainWrapper) mainWrapper.classList.add('sidebar-collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      if (mainWrapper) mainWrapper.classList.remove('sidebar-collapsed');
    }
  }
};

window.toggleSidebar = function () {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
      if (isOpen) {
        backdrop.classList.add('active');
      } else {
        backdrop.classList.remove('active');
      }
    }
  }
};

window.switchView = function (viewId) {
  state.currentView = viewId;
  renderPortalShell(document.getElementById('app'));
};

window.handleLogout = async function () {
  await api('/api/auth/logout', { method: 'POST' });
  state.currentUser = null;
  showToast('Logged out of MINDS TRUST session');
  renderApp();
};

function renderPortalView() {
  const mount = document.getElementById('portal-content-mount');
  const portal = state.activePortal;
  const view = state.currentView;

  const portalRoutes = {
    ADMIN: {
      dashboard: renderAdminDashboard,
      tasks: renderAdminTasksView,
      hierarchy: renderAdminHierarchyView,
      programs: renderAdminPrograms,
      students: renderAdminStudents,
      certificates: renderAdminCertificates,
      special_dates: renderSpecialDatesView,
      donors: renderAdminDonors,
      trainers: renderAdminTrainers,
      events: renderAdminEvents,
      finance: renderAdminFinance,
      emails: renderAdminEmails,
      audit: renderAdminAudit
    },
    STUDENT: {
      dashboard: renderStudentDashboard,
      my_tasks: renderPersonalTasksView,
      certificates: renderStudentCertificatesView,
      events: renderStudentEventsView,
      resources: renderStudentResourcesView,
      profile: renderStudentProfileSettingsView
    },
    DONOR: {
      dashboard: renderDonorDashboard,
      my_tasks: renderPersonalTasksView,
      contribute: renderDonorContributeView,
      history: renderDonorHistoryView,
      tax_certs: renderDonorTaxCertsView,
      impact: renderDonorImpactView,
      profile: renderDonorProfileSettingsView
    },
    TRAINER: {
      dashboard: renderTrainerDashboard,
      my_tasks: renderPersonalTasksView,
      evaluations: renderTrainerEvaluationsView,
      session_logs: renderTrainerSessionLogsView,
      curriculum: renderTrainerCurriculumView,
      events: renderTrainerEventsView,
      profile: renderTrainerProfileSettingsView
    }
  };

  const routes = portalRoutes[portal] || portalRoutes.ADMIN;
  const renderFn = routes[view] || routes.dashboard;
  void renderFn(mount);
}

// =========================================================================
// 3. ADMIN PORTAL VIEWS (Fully Functional & Reliable)
// =========================================================================

// 3.1 & 3.2 Dashboard Overview & Birthdays
async function renderAdminDashboard(mount) {
  mount.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Loading MINDS TRUST ERP Dashboard Overview...</div>`;
  try {
    let res = { stats: {}, pendingApprovals: [] };
    let bRes = { birthdayList: [] };

    try {
      res = await api('/api/admin/overview');
    } catch (e) {
      console.warn('Overview API fetch issue:', e);
    }

    try {
      bRes = await api('/api/admin/special-dates');
    } catch (e) {
      console.warn('Special dates API fetch issue:', e);
    }

    const s = res?.stats || {};
    const approvals = res?.pendingApprovals || [];
    const bdays = Array.isArray(bRes?.birthdayList) ? bRes.birthdayList.filter(b => b.category !== 'DONOR' && b.role !== 'Donor').slice(0, 5) : [];

    mount.innerHTML = `
      <div class="page-header-row">
        <div>
          <h1 class="page-header-title">MINDS TRUST ERP Dashboard Overview</h1>
          <p class="page-header-desc">Complete multi-portal operational intelligence across Students, Donors, Trainers & Finance.</p>
        </div>
        <div class="page-actions" style="display:flex; gap:10px;">
          <button class="btn btn-secondary" onclick="void renderAdminDashboard(document.getElementById('portal-content-mount'))">
            <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">refresh</span> Refresh
          </button>
          <button class="btn btn-primary" onclick="void triggerCertEngine()">
            <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">bolt</span> Run Certificate Engine
          </button>
        </div>
      </div>

      <!-- Donezo 4-Card Primary Metrics Grid -->
      <div class="stats-grid">
        <div class="stat-card hero-card">
          <div class="stat-card-top">
            <span class="stat-title">Active Students</span>
            <span class="stat-icon-pill"><span class="material-icons-round" style="font-size:16px;">trending_up</span></span>
          </div>
          <div class="stat-value">${s.activeStudents || 0}</div>
          <div class="stat-footer-badge">Total Enrolled: ${s.totalStudents || 0}</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-title">Registered Donors</span>
            <span class="stat-icon-pill"><span class="material-icons-round" style="font-size:16px;">trending_up</span></span>
          </div>
          <div class="stat-value">${s.totalDonors || 0}</div>
          <div class="stat-footer-badge" style="background:#fef3c7; color:#b45309;">Verified Donors</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-title">Certificates Issued</span>
            <span class="stat-icon-pill"><span class="material-icons-round" style="font-size:16px;">trending_up</span></span>
          </div>
          <div class="stat-value">${s.certsGenerated || 0}</div>
          <div class="stat-footer-badge" style="background:#e0f2fe; color:#0369a1;">Automated Gen</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-top">
            <span class="stat-title">Finance Inflow</span>
            <span class="stat-icon-pill"><span class="material-icons-round" style="font-size:16px;">trending_up</span></span>
          </div>
          <div class="stat-value">₹${Number(s.totalFinanceInflow || 0).toLocaleString('en-IN')}</div>
          <div class="stat-footer-badge" style="background:#dcfce7; color:#15803d;">Admin Monitored</div>
        </div>
      </div>

      <!-- 2-Column Section: Birthdays / Special Days & Pending Approvals -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:20px; margin-bottom:24px;">
        
        <!-- Birthday and Special-Day Management Directly on Overview -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons-round" style="color:#e11d48; font-size:20px;">cake</span>
              Upcoming Birthdays & Special Days
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="switchView('special_dates')">View All</button>
          </div>
          <div class="card-body" style="padding:14px 20px;">
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${bdays.length === 0 ? `<div class="empty-state" style="text-align:center; padding:20px; color:#64748b;">No upcoming birthdays recorded this week.</div>` :
        bdays.map(b => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                    <div>
                      <div style="font-weight:700; font-size:13.5px; color:#0f172a;">${b.name || 'User'}</div>
                      <div style="font-size:11.5px; color:#64748b;">DOB: ${b.dob || 'N/A'} • Role: <strong>${b.role || 'Staff'}</strong> (${b.category || 'User'})</div>
                    </div>
                    <div>
                      <span class="badge ${getDaysRemainingBadgeClass(b.days_remaining)}">
                        ${b.days_remaining === 0 ? '<span class="material-icons-round" style="font-size:13px; vertical-align:middle; margin-right:2px;">celebration</span> Today' : `In ${b.days_remaining} day(s)`}
                      </span>
                    </div>
                  </div>
                `).join('')
      }
            </div>
          </div>
        </div>

        <!-- Pending Reviews & Donation Approvals -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons-round" style="color:#d97706; font-size:20px;">pending_actions</span>
              Pending Reviews & Approvals
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="switchView('donors')">Open Review</button>
          </div>
          <div class="card-body" style="padding:14px 20px;">
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${approvals.length === 0 ? `<div class="empty-state" style="text-align:center; padding:20px; color:#64748b;">All donation contributions verified!</div>` :
        approvals.map(a => `
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                    <div>
                      <div style="font-weight:700; font-size:13.5px; color:#0f172a;">Receipt ${a.receipt_no || ''} - ₹${Number(a.amount || 0).toLocaleString('en-IN')}</div>
                      <div style="font-size:11.5px; color:#64748b;">Cause: ${a.purpose_name || 'General Donation'} • Payment: <strong>${a.payment_status || 'Pending'}</strong></div>
                    </div>
                    <span class="badge badge-yellow">${a.doc_status || 'Pending'}</span>
                  </div>
                `).join('')
      }
            </div>
          </div>
        </div>

      </div>

      <!-- Quick Shortcuts to All Integrated Modules -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="color:#154d34; font-size:20px;">rocket_launch</span>
            Fast Navigation Hub
          </h3>
        </div>
        <div class="card-body" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
          <button class="btn btn-secondary" onclick="void switchView('tasks')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">assignment_turned_in</span>Task Workflow</button>
          <button class="btn btn-secondary" onclick="void switchView('hierarchy')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">account_tree</span>User Hierarchy</button>
          <button class="btn btn-secondary" onclick="switchView('students')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">school</span>Student Records</button>
          <button class="btn btn-secondary" onclick="switchView('donors')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">volunteer_activism</span>Donor Audits</button>
          <button class="btn btn-secondary" onclick="switchView('trainers')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">co_present</span>Trainer Cohorts</button>
          <button class="btn btn-secondary" onclick="switchView('events')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">event</span>Event Schedules</button>
          <button class="btn btn-secondary" onclick="switchView('certificates')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">verified</span>Certificate Engine</button>
          <button class="btn btn-secondary" onclick="switchView('finance')"><span class="material-icons-round" style="font-size:17px; vertical-align:middle; margin-right:5px;">account_balance_wallet</span>Finance Management</button>
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `
      <div style="padding:40px; text-align:center; color:#dc2626;">
        <span class="material-icons-round" style="font-size:48px; color:#ef4444; margin-bottom:12px;">error_outline</span>
        <div style="font-weight:700; font-size:16px; margin-bottom:8px;">Failed to load dashboard overview</div>
        <div style="font-size:13px; color:#64748b; margin-bottom:16px;">${err.message}</div>
        <button class="btn btn-primary" onclick="void renderAdminDashboard(document.getElementById('portal-content-mount'))">
          <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">refresh</span> Retry Loading
        </button>
      </div>
    `;
  }
}

window.triggerCertEngine = async function () {
  const res = await api('/api/admin/certificates/trigger-engine', { method: 'POST' });
  showToast(res.message);
  void renderAdminDashboard(document.getElementById('portal-content-mount'));
};

// 3.2 Special Days Detailed View
async function renderSpecialDatesView(mount) {
  const res = await api('/api/admin/special-dates');
  const rawList = res.birthdayList || [];
  const list = rawList.filter(b => b.category !== 'DONOR' && b.role !== 'Donor');

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Birthday & Special-Day Management</h1>
        <p class="page-header-desc">Configurable records across Students and Trainers with days remaining calculations.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" onclick="exportTableToCSV('birthday-table', 'special-days-report.csv')">Export CSV Report</button>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table" id="birthday-table">
          <thead>
            <tr>
              <th>Person's Name</th>
              <th>User Category</th>
              <th>Role</th>
              <th>Birthday</th>
              <th>Status / Days Remaining</th>
              <th>Contact</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(b => `
              <tr>
                <td style="font-weight:800; color:#0f172a;">${b.name}</td>
                <td><span class="badge ${getCategoryBadgeClass(b.category)}">${b.category}</span></td>
                <td>${b.role}</td>
                <td>${b.dob}</td>
                <td>
                  <span class="badge ${getDaysRemainingBadgeClass(b.days_remaining)}">
                    ${b.days_remaining === 0 ? '<span class="material-icons-round" style="font-size:13px; vertical-align:middle; margin-right:2px;">celebration</span> Today' : `${b.days_remaining} day(s) remaining`}
                  </span>
                </td>
                <td>${b.contact}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =========================================================================
// 3. PROGRAM MANAGEMENT MODULE (Master Flowchart Step 1: Create -> Abbr -> Code)
// =========================================================================
async function renderAdminPrograms(mount) {
  const res = await api('/api/admin/programs');
  const programs = res.programs || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Program Management Module</h1>
        <p class="page-header-desc">Define academic welfare programs with automated Abbreviation and Unique Program Code generation.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="void openCreateProgramModal()">+ Create New Program</button>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Program Code</th>
              <th>Program Name</th>
              <th>Abbreviation</th>
              <th>Duration</th>
              <th>Enrolled Students</th>
              <th>Status</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            ${programs.length === 0 ? `<tr><td colspan="7" class="empty-state">No programs created yet. Click 'Create New Program' above.</td></tr>` :
      programs.map(p => `
                <tr>
                  <td><span class="badge" style="background:#154d34; color:#fff; font-weight:800; letter-spacing:0.5px;">${p.program_code}</span></td>
                  <td style="font-weight:800; color:#0f172a;">${p.program_name}</td>
                  <td><span class="badge badge-blue">${p.program_abbreviation}</span></td>
                  <td>${p.duration_weeks} Weeks</td>
                  <td><span class="badge badge-green">${p.student_count || 0} Students</span></td>
                  <td><span class="badge badge-green">${p.status}</span></td>
                  <td>${p.created_at ? p.created_at.slice(0, 10) : '2026-11-18'}</td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openCreateProgramModal = function () {
  showModal('Create New Program (Master Flow)', `
    <form id="create-prog-form">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Enter Program Name *</label>
          <input type="text" id="cp-name" class="form-control" placeholder="e.g. Advanced Digital Skills & AI Literacy" required oninput="previewProgramAbbr(this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">Auto-Generated Abbreviation</label>
          <input type="text" id="cp-abbr-preview" class="form-control" placeholder="ADSAIL" readonly style="background:#f1f5f9; font-weight:800; color:#154d34;">
        </div>
        <div class="form-group">
          <label class="form-label">Course Duration (Weeks) *</label>
          <input type="number" id="cp-duration" class="form-control" value="12" required min="1">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Program Description</label>
          <textarea id="cp-desc" class="form-control" rows="2" placeholder="Course syllabus, target beneficiaries, career outcomes..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Generate Code & Save to Database</button>
      </div>
    </form>
  `);

  window.previewProgramAbbr = function (val) {
    if (!val) { document.getElementById('cp-abbr-preview').value = ''; return; }
    const words = val.trim().split(/\s+/);
    let abbr = '';
    if (words.length === 1) abbr = words[0].substring(0, 3).toUpperCase();
    else abbr = words.map(w => w.charAt(0).toUpperCase()).slice(0, 4).join('');
    document.getElementById('cp-abbr-preview').value = abbr;
  };

  document.getElementById('create-prog-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/admin/programs', {
      method: 'POST',
      body: JSON.stringify({
        program_name: document.getElementById('cp-name').value,
        duration_weeks: document.getElementById('cp-duration').value,
        description: document.getElementById('cp-desc').value
      })
    });
    closeModal();
    showToast(`Program saved! Generated Code: ${res.program_code}`);
    void renderAdminPrograms(document.getElementById('portal-content-mount'));
  };
};

// =========================================================================
// 3.3 STUDENT MANAGEMENT MODULE (Full Master Flow Execution + Calendar Tracking)
// =========================================================================
if (!state.studentSubTab) state.studentSubTab = 'list'; // 'list' or 'calendar'
if (!state.studentCalYear) state.studentCalYear = 2026;
if (!state.studentCalMonth) state.studentCalMonth = 11; // 1-indexed (November 2026)
if (!state.studentCalFilter) {
  state.studentCalFilter = {
    course: 'ALL',
    status: 'ALL',
    search: '',
    selectedDate: null
  };
}

async function renderAdminStudents(mount) {
  const currentSubTab = state.studentSubTab || 'list';
  const filter = state.studentFilter || 'ALL';
  const search = state.studentSearch || '';

  const [res, countsRes] = await Promise.all([
    api(`/api/admin/students?search=${encodeURIComponent(search)}&status=${filter}`),
    api('/api/admin/students/counts')
  ]);
  const students = res.students || [];
  const c = countsRes.counts || { all: students.length, drafted: 0, enrolled: 0, joined: 0, completed: 0, archived: 0 };

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Student Management Module</h1>
        <p class="page-header-desc">Registration ➔ Unique Student Code ➔ Program Code Link ➔ Student Status & 7-Day Notification ➔ Academic Tracking</p>
      </div>
      <div class="page-actions" style="display:flex; gap:10px; align-items:center;">
        <button class="btn btn-secondary" onclick="void run7DayNotificationAutomation()">
          <span class="material-icons-round" style="font-size:18px;">bolt</span> Run 7-Day Notification Job
        </button>
        <button class="btn btn-primary" onclick="void openAddStudentModal()">
          <span class="material-icons-round" style="font-size:18px;">person_add</span> Student Registration
        </button>
      </div>
    </div>

    <!-- Student Module Sub-navigation: Student Directory List vs. Calendar Enrollment Tracker -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:2px solid #e2e8f0; padding-bottom:12px; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; gap:10px;">
        <button class="btn ${currentSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentSubTab('list')" style="font-weight:700; border-radius:20px; padding:6px 16px;">
          <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">format_list_bulleted</span>
          Student Directory (${c.all})
        </button>
        <button class="btn ${currentSubTab === 'calendar' ? 'btn-primary' : 'btn-secondary'}" onclick="switchStudentSubTab('calendar')" style="font-weight:700; border-radius:20px; padding:6px 16px;">
          <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">calendar_month</span>
          Enrollment & Joining Calendar
        </button>
      </div>
      <div style="font-size:12.5px; color:#64748b; font-weight:600;">
        ${currentSubTab === 'calendar' ? '<span class="badge badge-green" style="font-size:11px;">● Dynamic Enrollment Tracking Active</span>' : 'Showing Enrolled Cohorts & Academic Status'}
      </div>
    </div>

    <div id="student-module-subview-mount">
      ${currentSubTab === 'calendar' ? '<div style="text-align:center; padding:30px; color:#64748b;">Loading Enrollment Calendar...</div>' : ''}
    </div>
  `;

  const subMount = document.getElementById('student-module-subview-mount');
  if (currentSubTab === 'calendar') {
    await renderStudentCalendarView(subMount);
  } else {
    renderStudentListView(subMount, students, c, filter);
  }
}

window.switchStudentSubTab = function (subTab) {
  state.studentSubTab = subTab;
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

function renderStudentCourseAcademicBadges(hasMultiple, courses, completedCount, inProgressCount) {
  if (hasMultiple) {
    const badges = [];
    if (completedCount > 0) {
      badges.push(`<span class="badge badge-green" style="font-size:10.5px; padding:2px 8px;">${completedCount} Completed</span>`);
    }
    if (inProgressCount > 0) {
      badges.push(`<span class="badge badge-blue" style="font-size:10.5px; padding:2px 8px;">${inProgressCount} In Progress</span>`);
    }
    return `<div style="display:flex; flex-direction:column; gap:3px;">${badges.join('')}</div>`;
  }
  const isComp = courses[0]?.academic_status === 'Completed';
  return `<span class="badge ${isComp ? 'badge-green' : 'badge-blue'}">${courses[0]?.academic_status || 'In Progress'}</span>`;
}

function renderStudentActionButtons(s, courses, isStudentCompleted, verifiedCerts) {
  if (s.certificate_id || verifiedCerts > 0) {
    const certId = s.certificate_id || courses.find(c => c.certificate_id)?.certificate_id;
    return `
      <button class="btn btn-primary btn-sm" style="font-weight:700; padding:4px 10px; font-size:11.5px;" onclick="void viewStudentCertificateById(${certId})">
        <span class="material-icons-round" style="font-size:14px;">workspace_premium</span> Certificate
      </button>
    `;
  }
  if (isStudentCompleted) {
    return `
      <button class="btn btn-primary btn-sm" style="font-weight:700; padding:4px 10px; font-size:11.5px;" onclick="void generateCertFromStudent(${s.id}, '${s.full_name}')">
        <span class="material-icons-round" style="font-size:14px;">add_task</span> Generate
      </button>
    `;
  }
  return `
    <span style="display:inline-flex; align-items:center; gap:4px; font-weight:700; color:#0284c7; background:#e0f2fe; padding:3px 8px; border-radius:14px; font-size:11px;">
      <span style="font-size:6px;">●</span> In Progress
    </span>
  `;
}

function renderStudentTableRow(s) {
  const defaultCourse = {
    id: 0,
    course_name: s.program_name || s.enrolled_program,
    course_code: s.program_code || 'PRG-FSD-01',
    academic_status: s.academic_status || 'In Progress',
    completion_approved: s.completion_approved || 0,
    certificate_id: s.certificate_id || null,
    certificate_no: s.certificate_no || null
  };
  const courses = s.courses?.length ? s.courses : [defaultCourse];

  const hasMultiple = courses.length > 1;
  const completedCount = courses.filter(c => c.academic_status === 'Completed').length;
  const inProgressCount = courses.length - completedCount;
  const verifiedCerts = courses.filter(c => c.certificate_id).length;
  const isStudentCompleted = s.academic_status === 'Completed' || (completedCount > 0 && inProgressCount === 0);
  const studentJson = JSON.stringify(s).replaceAll('"', '&quot;');

  return `
    <tr style="cursor:pointer; transition:background 0.15s ease;" onclick="openStudentDetailsModal(${studentJson})" title="Click to view full student & course details">
      <td style="font-weight:800; color:#154d34;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="material-icons-round" style="font-size:16px; color:#154d34;">badge</span>
          <span>${s.student_code}</span>
        </div>
      </td>
      <td>
        <div style="font-weight:800; color:#0f172a; font-size:13.5px;">${s.full_name}</div>
        <div style="color:#64748b; font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${s.email}
        </div>
      </td>
      <td>
        <button class="btn btn-sm ${hasMultiple ? 'btn-primary' : 'btn-secondary'}" style="font-size:11px; padding:4px 10px; border-radius:14px; gap:4px; font-weight:700;" onclick="event.stopPropagation(); openStudentDetailsModal(${studentJson})">
          <span class="material-icons-round" style="font-size:14px;">school</span>
          <span>${courses.length} ${courses.length === 1 ? 'Course' : 'Courses'}</span>
          ${hasMultiple ? '<span class="material-icons-round" style="font-size:14px;">open_in_new</span>' : ''}
        </button>
      </td>
      <td>
        <span class="badge ${getStudentStatusBadgeClass(s.student_status)}">
          ${s.student_status || 'Enrolled'}
        </span>
      </td>
      <td>
        ${renderStudentCourseAcademicBadges(hasMultiple, courses, completedCount, inProgressCount)}
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation()">
          ${renderStudentActionButtons(s, courses, isStudentCompleted, verifiedCerts)}
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="void openStudentStatusModal(${studentJson})" title="Change Student Status">
            <span class="material-icons-round" style="font-size:15px;">tune</span>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderStudentListView(mount, students, c, filter) {
  mount.innerHTML = `
    <!-- Status Tabs according to Flowchart with Accurate Live Counts -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('ALL')">All Students (${c.all})</button>
        <button class="btn ${filter === 'Drafted' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('Drafted')"><span class="material-icons-round" style="font-size:15px;">edit_note</span> Drafted (${c.drafted})</button>
        <button class="btn ${filter === 'Enrolled' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('Enrolled')"><span class="material-icons-round" style="font-size:15px;">hourglass_top</span> Enrolled (${c.enrolled})</button>
        <button class="btn ${filter === 'Joined' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('Joined')"><span class="material-icons-round" style="font-size:15px;">check_circle</span> Joined Students (${c.joined})</button>
        <button class="btn ${filter === 'Completed' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('Completed')"><span class="material-icons-round" style="font-size:15px;">school</span> Completed (${c.completed})</button>
        <button class="btn ${filter === 'Archived' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="void filterStudents('Archived')"><span class="material-icons-round" style="font-size:15px;">archive</span> Expired Archive (${c.archived})</button>
      </div>

      <!-- Live Search in Student Module -->
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="position:relative; width:260px;">
          <input type="text" id="student-search-input" class="form-control" style="padding-left:34px; border-radius:24px; font-size:12.5px; height:36px;" placeholder="Search by name, code, email..." value="${state.studentSearch || ''}" oninput="searchStudentsLive(this.value)">
          <span class="material-icons-round" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:16px; color:#94a3b8;">search</span>
        </div>
        ${state.studentSearch ? `
          <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="clearStudentSearch()" title="Clear Search">✕</button>
        ` : ''}
      </div>
    </div>

    <div class="card" style="box-shadow: var(--shadow-subtle);">
      <div style="width:100%; overflow:hidden;">
        <table class="data-table" style="width:100%; table-layout:fixed;">
          <thead>
            <tr>
              <th style="width:14%;">Student Code</th>
              <th style="width:24%;">Student Name & Info</th>
              <th style="width:14%;">Enrolled Courses</th>
              <th style="width:14%;">Student Status</th>
              <th style="width:16%;">Academic Status</th>
              <th style="width:18%;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `<tr><td colspan="6" class="empty-state">No student records found matching this status filter.</td></tr>` :
      students.map(s => renderStudentTableRow(s)).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCalMonthCell(year, month, dayNum, currentMonthDateCounts, filter) {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  const dayEvents = currentMonthDateCounts[dateStr] || [];
  const isSelected = filter.selectedDate === dateStr;
  const hasEvents = dayEvents.length > 0;
  const countBadge = hasEvents
    ? `<span style="background:#15803d; color:#ffffff; font-size:9.5px; font-weight:800; padding:1px 5px; border-radius:10px;">${dayEvents.length}</span>`
    : '';

  let eventSummary = '';
  if (hasEvents) {
    const firstName = dayEvents[0].student_name.split(' ')[0];
    const moreSuffix = dayEvents.length > 1 ? ` +${dayEvents.length - 1}` : '';
    eventSummary = `
      <div style="margin-top:4px;">
        <div style="font-size:9.5px; font-weight:700; color:#166534; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${firstName}${moreSuffix}
        </div>
      </div>
    `;
  }

  let numColor = '#334155';
  if (isSelected) {
    numColor = '#0369a1';
  } else if (hasEvents) {
    numColor = '#15803d';
  }

  return `
    <div onclick="selectCalDate('${dateStr}')" 
         style="min-height:56px; padding:6px; border-radius:10px; cursor:pointer; transition:all 0.15s ease; border: 1.5px solid ${getCalCellBorder(isSelected, hasEvents)}; background:${getCalCellBg(isSelected, hasEvents)}; position:relative; display:flex; flex-direction:column; justify-content:space-between;"
         title="${hasEvents ? `${dayEvents.length} student(s) joined/enrolled on ${dateStr}. Click to view details.` : `Date: ${dateStr}`}">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:${hasEvents || isSelected ? '800' : '600'}; font-size:12px; color:${numColor};">
          ${dayNum}
        </span>
        ${countBadge}
      </div>
      ${eventSummary}
    </div>
  `;
}

function renderCalEnrollmentCard(rec) {
  const sObj = rec.student_obj || {
    id: rec.student_id,
    student_code: rec.student_code,
    full_name: rec.student_name,
    email: rec.email,
    phone: rec.phone,
    student_status: rec.student_status,
    courses: [{
      id: rec.enrollment_id,
      course_name: rec.course_name,
      course_code: rec.course_code,
      enrolled_date: rec.enrollment_date,
      academic_status: rec.academic_status,
      completion_approved: rec.completion_approved,
      certificate_id: rec.certificate_id,
      certificate_no: rec.certificate_no
    }]
  };

  const isCompleted = rec.academic_status === 'Completed';
  const certBadge = rec.certificate_no ? `
    <span style="color:#047857; font-size:11px; display:flex; align-items:center; gap:3px;">
      <span class="material-icons-round" style="font-size:13px;">workspace_premium</span> Cert: ${rec.certificate_no}
    </span>
  ` : '';

  return `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; cursor:pointer; transition:all 0.15s ease; box-shadow:0 1px 3px rgba(0,0,0,0.02);"
         onmouseover="this.style.borderColor='#10b981'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.06)'"
         onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.02)'"
         onclick="openStudentDetailsModal(${JSON.stringify(sObj).replaceAll('"', '&quot;')})"
         title="Click to view complete student dossier and course verification details">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
        <div>
          <div style="font-weight:800; font-size:13.5px; color:#0f172a; display:flex; align-items:center; gap:6px;">
            <span>${rec.student_name}</span>
            <span class="badge" style="background:#154d34; color:#fff; font-size:10px; font-weight:800; padding:1px 6px;">${rec.student_code}</span>
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
            <span class="material-icons-round" style="font-size:12px; vertical-align:middle;">email</span> ${rec.email} &bull; 
            <span class="material-icons-round" style="font-size:12px; vertical-align:middle;">call</span> ${rec.phone || 'N/A'}
          </div>
        </div>
        <div>
          <span class="badge ${getStudentStatusBadgeClass(rec.student_status)}" style="font-size:10.5px;">
            ${rec.student_status}
          </span>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:8px 10px; margin-top:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
        <div>
          <span style="font-weight:700; color:#154d34;">${rec.course_name}</span>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">
            Enrolled: <strong>${rec.enrollment_date}</strong> &bull; Batch: <strong>${rec.batch || 'Cohort 2026'}</strong>
          </div>
        </div>
        <div>
          <span class="badge ${isCompleted ? 'badge-green' : 'badge-blue'}" style="font-size:10.5px;">
            ${rec.academic_status}
          </span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11.5px; color:#0284c7; font-weight:700;">
        <span style="display:flex; align-items:center; gap:4px;">
          <span class="material-icons-round" style="font-size:14px;">open_in_new</span> View Student Dossier
        </span>
        ${certBadge}
      </div>
    </div>
  `;
}
function filterCalendarRecords(records, year, month, filter) {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  let filtered = records.filter(r => r.enrollment_date?.startsWith(monthPrefix));

  if (filter.course && filter.course !== 'ALL') {
    filtered = filtered.filter(r => r.course_name === filter.course);
  }
  if (filter.status && filter.status !== 'ALL') {
    filtered = filtered.filter(r => r.student_status === filter.status);
  }
  if (filter.search?.trim()) {
    const q = filter.search.toLowerCase().trim();
    filtered = filtered.filter(r => 
      (r.student_name?.toLowerCase().includes(q)) ||
      (r.student_code?.toLowerCase().includes(q)) ||
      (r.email?.toLowerCase().includes(q)) ||
      (r.course_name?.toLowerCase().includes(q))
    );
  }
  if (filter.selectedDate) {
    filtered = filtered.filter(r => r.enrollment_date === filter.selectedDate);
  }
  return filtered;
}

async function renderStudentCalendarView(mount) {
  try {
    const res = await api('/api/admin/students/calendar-events');
    const records = res.records || [];

    const year = state.studentCalYear || 2026;
    const month = state.studentCalMonth || 11; // 1 to 12
    const filter = state.studentCalFilter || { course: 'ALL', status: 'ALL', search: '', selectedDate: null };

    // Format month title
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthLabel = `${monthNames[month - 1]} ${year}`;

    // Get unique courses for filter dropdown
    const courseSet = new Set();
    records.forEach(r => {
      if (r.course_name) courseSet.add(r.course_name);
    });
    const uniqueCourses = Array.from(courseSet).sort((a, b) => a.localeCompare(b));

    // Filter records for this month, year, and search/status criteria
    const monthRecords = filterCalendarRecords(records, year, month, filter);

    // Days in current month & first day index (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Map month records by date
    const currentMonthDateCounts = {};
    monthRecords.forEach(r => {
      const d = r.enrollment_date;
      if (!currentMonthDateCounts[d]) currentMonthDateCounts[d] = [];
      currentMonthDateCounts[d].push(r);
    });

    mount.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Calendar Controls & Filter Toolbar -->
        <div class="card" style="padding:16px 20px; box-shadow:var(--shadow-subtle);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:14px;">
            <!-- Month & Year Navigation -->
            <div style="display:flex; align-items:center; gap:10px;">
              <button class="btn btn-secondary btn-sm" onclick="navStudentCalMonth(-1)" title="Previous Month" style="padding:6px 10px;">
                <span class="material-icons-round" style="font-size:18px;">chevron_left</span>
              </button>
              
              <div style="display:flex; align-items:center; gap:8px;">
                <select id="cal-select-month" class="form-control" style="font-weight:800; font-size:14px; width:140px; height:36px; padding:4px 10px;" onchange="changeStudentCalMonth(this.value)">
                  ${monthNames.map((name, i) => `
                    <option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${name}</option>
                  `).join('')}
                </select>
                <select id="cal-select-year" class="form-control" style="font-weight:800; font-size:14px; width:95px; height:36px; padding:4px 10px;" onchange="changeStudentCalYear(this.value)">
                  ${[2024, 2025, 2026, 2027, 2028].map(y => `
                    <option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>
                  `).join('')}
                </select>
              </div>

              <button class="btn btn-secondary btn-sm" onclick="navStudentCalMonth(1)" title="Next Month" style="padding:6px 10px;">
                <span class="material-icons-round" style="font-size:18px;">chevron_right</span>
              </button>

              <button class="btn btn-secondary btn-sm" onclick="resetStudentCalToday()" style="font-size:11.5px; font-weight:700;">
                Today
              </button>
            </div>

            <!-- Summary Stats for Month & Export PDF Action -->
            <div style="display:flex; align-items:center; gap:12px; font-size:12px; flex-wrap:wrap;">
              <div style="background:#eaf5ee; color:#154d34; padding:6px 14px; border-radius:20px; font-weight:800; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:16px;">school</span>
                <span>${monthRecords.length} Enrollments in ${monthNames[month - 1]}</span>
              </div>
              ${filter.selectedDate ? `
                <div style="background:#e0f2fe; color:#0369a1; padding:6px 12px; border-radius:20px; font-weight:700; display:flex; align-items:center; gap:6px;">
                  <span>Date: <strong>${filter.selectedDate}</strong></span>
                  <span class="material-icons-round" style="font-size:15px; cursor:pointer;" onclick="clearCalSelectedDate()">close</span>
                </div>
              ` : ''}
              <button class="btn btn-primary btn-sm" onclick="exportStudentCalendarReportPDF(${JSON.stringify(monthRecords).replaceAll('"', '&quot;')}, '${currentMonthLabel}', '${filter.selectedDate || ''}')" style="display:flex; align-items:center; gap:6px; font-weight:700; padding:6px 14px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.08);" title="Export enrollment report to PDF">
                <span class="material-icons-round" style="font-size:16px;">picture_as_pdf</span>
                <span>Export into PDF</span>
              </button>
            </div>
          </div>

          <!-- Multi-Criteria Filter Bar -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:center; border-top:1px solid #f1f5f9; padding-top:14px;">
            <!-- Filter by Course -->
            <div>
              <label style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px; display:block;">Course Name</label>
              <select class="form-control" style="font-size:12px; height:34px;" onchange="filterCalByCourse(this.value)">
                <option value="ALL">All Enrolled Courses</option>
                ${uniqueCourses.map(c => `
                  <option value="${c}" ${filter.course === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>

            <!-- Filter by Status -->
            <div>
              <label style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px; display:block;">Student Status</label>
              <select class="form-control" style="font-size:12px; height:34px;" onchange="filterCalByStatus(this.value)">
                <option value="ALL" ${filter.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
                <option value="Joined" ${filter.status === 'Joined' ? 'selected' : ''}>Joined</option>
                <option value="Enrolled" ${filter.status === 'Enrolled' ? 'selected' : ''}>Enrolled</option>
                <option value="Drafted" ${filter.status === 'Drafted' ? 'selected' : ''}>Drafted</option>
                <option value="Archived" ${filter.status === 'Archived' ? 'selected' : ''}>Archived</option>
              </select>
            </div>

            <!-- Search by Student Name / ID -->
            <div style="grid-column: span 2;">
              <label style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px; display:block;">Search Student / Code</label>
              <div style="position:relative;">
                <input type="text" class="form-control" style="padding-left:32px; font-size:12px; height:34px; border-radius:8px;" placeholder="Search by student name, code, or email..." value="${filter.search || ''}" oninput="searchCalStudentsLive(this.value)">
                <span class="material-icons-round" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:16px; color:#94a3b8;">search</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Calendar & Day Inspection Layout Grid -->
        <div style="display:grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap:20px; align-items:start;">
          <!-- Monthly Calendar View -->
          <div class="card" style="box-shadow:var(--shadow-subtle); padding:18px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="font-size:15px; font-weight:800; color:#154d34; margin:0; display:flex; align-items:center; gap:6px;">
                <span class="material-icons-round" style="font-size:20px;">calendar_month</span>
                ${currentMonthLabel}
              </h3>
              <div style="display:flex; align-items:center; gap:12px; font-size:11.5px; color:#64748b;">
                <span style="display:flex; align-items:center; gap:4px;">
                  <span style="width:10px; height:10px; background:#10b981; border-radius:50%; display:inline-block;"></span> Enrolled / Joined
                </span>
                <span style="display:flex; align-items:center; gap:4px;">
                  <span style="width:10px; height:10px; background:#0284c7; border-radius:50%; display:inline-block;"></span> Selected
                </span>
              </div>
            </div>

            <!-- Calendar Days Header (Sun - Sat) -->
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; text-align:center; font-weight:800; font-size:11.5px; color:#64748b; margin-bottom:8px;">
              <div>SUN</div>
              <div>MON</div>
              <div>TUE</div>
              <div>WED</div>
              <div>THU</div>
              <div>FRI</div>
              <div>SAT</div>
            </div>

            <!-- Calendar Month Grid Cells -->
            <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:6px;">
              ${Array.from({ length: firstDayIndex }).map(() => `
                <div style="min-height:54px; background:#f8fafc; border-radius:8px; opacity:0.35;"></div>
              `).join('')}

              ${Array.from({ length: daysInMonth }).map((_, idx) => 
                renderCalMonthCell(year, month, idx + 1, currentMonthDateCounts, filter)
              ).join('')}
            </div>
          </div>

          <!-- Date Inspection & Student Enrollment Panel -->
          <div class="card" style="box-shadow:var(--shadow-subtle); padding:18px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:14px;">
              <div>
                <h3 style="font-size:15px; font-weight:800; color:#0f172a; margin:0;">
                  ${filter.selectedDate ? `Enrollments on ${filter.selectedDate}` : `All Enrollments in ${monthNames[month - 1]}`}
                </h3>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
                  Showing <strong>${monthRecords.length}</strong> matching student record(s)
                </div>
              </div>
              ${filter.selectedDate ? `
                <button class="btn btn-secondary btn-sm" onclick="clearCalSelectedDate()" style="font-size:11px; padding:4px 8px;">
                  View All Month
                </button>
              ` : ''}
            </div>

            <!-- Student Enrollment Records List -->
            <div style="display:flex; flex-direction:column; gap:10px; max-height:480px; overflow-y:auto; padding-right:4px;">
              ${monthRecords.length === 0 ? `
                <div style="text-align:center; padding:40px 10px; color:#94a3b8;">
                  <span class="material-icons-round" style="font-size:36px; opacity:0.6; display:block; margin-bottom:8px;">event_busy</span>
                  <div style="font-weight:700; font-size:13px; color:#64748b;">No enrollments on this date or month</div>
                  <div style="font-size:11.5px; margin-top:4px;">Try selecting another date or switching the month navigation above.</div>
                </div>
              ` : monthRecords.map(rec => renderCalEnrollmentCard(rec)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Failed to load student calendar: ${err.message}</div>`;
  }
}

// Calendar Navigation Handlers
window.navStudentCalMonth = function (delta) {
  let m = state.studentCalMonth + delta;
  let y = state.studentCalYear;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }
  state.studentCalMonth = m;
  state.studentCalYear = y;
  state.studentCalFilter.selectedDate = null;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.changeStudentCalMonth = function (m) {
  state.studentCalMonth = Number.parseInt(m, 10);
  state.studentCalFilter.selectedDate = null;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.changeStudentCalYear = function (y) {
  state.studentCalYear = Number.parseInt(y, 10);
  state.studentCalFilter.selectedDate = null;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.resetStudentCalToday = function () {
  const now = new Date();
  state.studentCalYear = now.getFullYear();
  state.studentCalMonth = now.getMonth() + 1;
  state.studentCalFilter.selectedDate = null;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.selectCalDate = function (dateStr) {
  state.studentCalFilter.selectedDate = dateStr;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.clearCalSelectedDate = function () {
  state.studentCalFilter.selectedDate = null;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.filterCalByCourse = function (course) {
  state.studentCalFilter.course = course;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

window.filterCalByStatus = function (status) {
  state.studentCalFilter.status = status;
  void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
};

let calSearchTimer = null;
window.searchCalStudentsLive = function (q) {
  clearTimeout(calSearchTimer);
  calSearchTimer = setTimeout(() => {
    state.studentCalFilter.search = q;
    void renderStudentCalendarView(document.getElementById('student-module-subview-mount'));
  }, 200);
};

function getReportStatusBadgeStyle(status) {
  if (status === 'Joined') {
    return 'background:#dcfce7; color:#15803d;';
  }
  if (status === 'Enrolled') {
    return 'background:#e0f2fe; color:#0369a1;';
  }
  return 'background:#f1f5f9; color:#475569;';
}

function renderCalendarReportRow(r, idx) {
  return `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:9px 12px; font-weight:700; color:#64748b;">${idx + 1}</td>
      <td style="padding:9px 12px; font-weight:700; color:#0f172a; white-space:nowrap;">${r.enrollment_date}</td>
      <td style="padding:9px 12px;">
        <strong style="color:#0f172a;">${r.student_name}</strong><br>
        <code style="font-weight:700; color:#154d34; font-size:10.5px;">${r.student_code}</code>
      </td>
      <td style="padding:9px 12px; color:#475569;">
        <div>${r.email}</div>
        <small style="color:#64748b;">${r.phone || '-'}</small>
      </td>
      <td style="padding:9px 12px;">
        <strong style="color:#154d34;">${r.course_name}</strong><br>
        <span style="font-size:10px; color:#64748b;">${r.course_code || 'PRG-FSD-01'} &bull; ${r.batch || 'Cohort 2026'}</span>
      </td>
      <td style="padding:9px 12px;">
        <span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:10.5px; font-weight:700; ${getReportStatusBadgeStyle(r.student_status)}">
          ${r.student_status}
        </span>
      </td>
      <td style="padding:9px 12px;">
        <span style="font-weight:700; color:${r.academic_status === 'Completed' ? '#166534' : '#0284c7'};">
          ${r.academic_status || 'In Progress'}
        </span>
      </td>
      <td style="padding:9px 12px; font-family:monospace; font-size:10.5px; color:#047857; font-weight:700;">
        ${r.certificate_no || '<span style="color:#94a3b8; font-family:sans-serif;">Pending</span>'}
      </td>
    </tr>
  `;
}

// -------------------------------------------------------------------------
// EXPORT STUDENT CALENDAR ENROLLMENT DECLARATION REPORT TO PDF
// -------------------------------------------------------------------------
window.exportStudentCalendarReportPDF = function (records, monthLabel, selectedDate) {
  const title = selectedDate 
    ? `Student Enrollment Declaration Report (${selectedDate})` 
    : `Student Enrollment & Calendar Declaration Report (${monthLabel})`;

  const dateGenerated = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const joinedCount = records.filter(r => r.student_status === 'Joined').length;
  const enrolledCount = records.filter(r => r.student_status === 'Enrolled').length;
  const completedCount = records.filter(r => r.academic_status === 'Completed').length;

  showModal(title, `
    <div class="printable-area" style="font-family:'Plus Jakarta Sans', sans-serif; color:#0f172a; padding:10px;">
      <!-- Report Header -->
      <div style="border-bottom:3px solid #154d34; padding-bottom:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:36px; height:36px; background:#154d34; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:18px;">
              M
            </div>
            <div>
              <h2 style="font-size:20px; font-weight:900; color:#154d34; margin:0;">MINDS TRUST</h2>
              <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                Empowerment Through Skills & Education &bull; Registered Trust (Section 80G Certified)
              </div>
            </div>
          </div>
          <div style="margin-top:10px; font-size:12.5px; color:#334155;">
            <strong>Declaration Title:</strong> Official Student Enrollment & Cohort Allocation Report
          </div>
        </div>

        <div style="text-align:right;">
          <div style="background:#154d34; color:#ffffff; font-size:11px; font-weight:800; padding:4px 10px; border-radius:6px; display:inline-block; text-transform:uppercase;">
            Audited ERP Statement
          </div>
          <div style="font-size:11.5px; color:#64748b; margin-top:4px;">
            Period: <strong>${selectedDate || monthLabel}</strong>
          </div>
          <div style="font-size:11px; color:#94a3b8;">
            Generated: ${dateGenerated}
          </div>
        </div>
      </div>

      <!-- Executive Metric Summary -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:22px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Total Enrollments</div>
          <div style="font-size:22px; font-weight:900; color:#0f172a; margin-top:2px;">${records.length}</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase;">Active Joined</div>
          <div style="font-size:22px; font-weight:900; color:#15803d; margin-top:2px;">${joinedCount}</div>
        </div>
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#1e40af; text-transform:uppercase;">Enrolled</div>
          <div style="font-size:22px; font-weight:900; color:#2563eb; margin-top:2px;">${enrolledCount}</div>
        </div>
        <div style="background:#fefce8; border:1px solid #fef08a; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#854d0e; text-transform:uppercase;">Completed Courses</div>
          <div style="font-size:22px; font-weight:900; color:#a16207; margin-top:2px;">${completedCount}</div>
        </div>
      </div>

      <!-- Official Records Table -->
      <div style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:20px;">
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; text-align:left;">
          <thead>
            <tr style="background:#154d34; color:#ffffff; font-weight:800;">
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Sl.</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Date</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Student Code & Name</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Contact / Email</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Enrolled Course</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Status</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Academic</th>
              <th style="padding:10px 12px; border-bottom:1px solid #cbd5e1;">Certificate No</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr>
                <td colspan="8" style="padding:24px; text-align:center; color:#64748b;">No student enrollment records found for the selected timeframe.</td>
              </tr>
            ` : records.map((r, idx) => renderCalendarReportRow(r, idx)).join('')}
          </tbody>
        </table>
      </div>

      <!-- Trust Official Declaration & Verification Seal -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:20px; font-size:11.5px; color:#475569; line-height:1.6;">
        <strong>Official Declaration:</strong> This report is digitally generated by MINDS TRUST ERP Student Enrollment & Academic Module. All student records, enrollment dates, course allotments, and certification data have been reconciled against the centralized database registers.
      </div>

      <!-- Signatures Footer -->
      <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:20px;">
        <div>
          <div style="border:2px solid #154d34; color:#154d34; padding:6px 14px; border-radius:6px; font-weight:900; font-size:11px; display:inline-block; letter-spacing:1px; text-transform:uppercase;">
            MINDS TRUST &bull; VERIFIED ENROLLMENT RECORD
          </div>
        </div>
        <div style="text-align:right;">
          <div style="border-top:1.5px solid #64748b; width:180px; padding-top:6px; font-weight:800; font-size:12px; color:#0f172a;">
            Academic Dean & Registrar
          </div>
          <div style="font-size:11px; color:#64748b;">MINDS TRUST Educational Council</div>
        </div>
      </div>
    </div>

    <!-- Print / Export Actions -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:16px; margin-top:20px;">
      <div style="font-size:12px; color:#64748b;">
        <span class="material-icons-round" style="font-size:15px; vertical-align:middle; color:#154d34;">info</span> Tip: In the print dialog, select <strong>"Save as PDF"</strong> as the printer destination.
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary" onclick="window.print()" style="display:flex; align-items:center; gap:6px; font-weight:700;">
          <span class="material-icons-round" style="font-size:18px;">print</span>
          <span>Print / Save as PDF</span>
        </button>
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

window.toggleStudentCoursesExpand = function (studentId) {
  if (!state.expandedStudents) state.expandedStudents = {};
  state.expandedStudents[studentId] = !state.expandedStudents[studentId];
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

function renderCourseCertificateAction(s, c, isCompleted, hasCert) {
  if (hasCert) {
    return `
      <button class="btn btn-primary btn-sm" style="font-weight:700; padding:6px 12px; font-size:11.5px;" onclick="void viewStudentCertificateById(${c.certificate_id})">
        <span class="material-icons-round" style="font-size:14px;">workspace_premium</span> View Certificate
      </button>
    `;
  }
  if (isCompleted) {
    return `
      <button class="btn btn-primary btn-sm" style="font-weight:700; padding:6px 12px; font-size:11.5px;" onclick="void generateCertFromStudent(${s.id}, '${s.full_name}')">
        <span class="material-icons-round" style="font-size:14px;">add_task</span> Generate Cert
      </button>
    `;
  }
  return `<span class="badge badge-gray" style="font-size:11px;">Cert Pending</span>`;
}

window.openStudentDetailsModal = function (s) {
  const courses = s.courses?.length ? s.courses : [{
    id: 0,
    course_name: s.program_name || s.enrolled_program,
    course_code: s.program_code || 'PRG-FSD-01',
    academic_status: s.academic_status || 'In Progress',
    completion_approved: s.completion_approved || 0,
    certificate_id: s.certificate_id || null,
    certificate_no: s.certificate_no || null
  }];

  const completedCourses = courses.filter(c => c.academic_status === 'Completed');
  const verifiedCerts = courses.filter(c => c.certificate_id);

  showModal(`Student Profile & Course Dossier`, `
    <div style="padding-bottom:10px;">
      <!-- Header Info Banner -->
      <div style="background:linear-gradient(135deg, #154d34, #1b6343); border-radius:14px; padding:18px 20px; color:#ffffff; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="font-size:24px; color:#a7f3d0;">account_circle</span>
            <span style="font-size:18px; font-weight:800; letter-spacing:-0.3px;">${s.full_name}</span>
            <span class="badge" style="background:#ffffff; color:#154d34; font-weight:800; font-size:11px;">${s.student_code}</span>
          </div>
          <div style="font-size:12.5px; opacity:0.9; margin-top:5px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <span><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">email</span> ${s.email}</span>
            <span><span class="material-icons-round" style="font-size:14px; vertical-align:middle;">call</span> ${s.phone || 'No phone registered'}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <span class="badge ${s.student_status === 'Joined' ? 'badge-green' : 'badge-yellow'}" style="font-size:12px; font-weight:800;">
            ${s.student_status || 'Enrolled'}
          </span>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:20px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">Total Courses</div>
          <div style="font-size:22px; font-weight:800; color:#0f172a; margin-top:2px;">${courses.length}</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:12px 14px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#166534; text-transform:uppercase;">Completed</div>
          <div style="font-size:22px; font-weight:800; color:#15803d; margin-top:2px;">${completedCourses.length}</div>
        </div>
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px 14px; text-align:center;">
          <div style="font-size:11px; font-weight:700; color:#1e40af; text-transform:uppercase;">Verified Certificates</div>
          <div style="font-size:22px; font-weight:800; color:#2563eb; margin-top:2px;">${verifiedCerts.length}</div>
        </div>
      </div>

      <!-- Individual Enrolled Courses Breakdown -->
      <div style="margin-bottom:18px;">
        <h4 style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
          <span class="material-icons-round" style="font-size:18px; color:#154d34;">library_books</span>
          Enrolled Course Breakdown & Certificate Verification
        </h4>

        <div style="display:flex; flex-direction:column; gap:10px;">
          ${courses.map((c, i) => {
    const isCompleted = c.academic_status === 'Completed';
    const hasCert = !!c.certificate_id;

    return `
              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                <div style="flex:1; min-width:220px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="badge" style="background:#154d34; color:#ffffff; font-size:10.5px; font-weight:800;">
                      ${c.course_code || 'PRG-FSD-01'}
                    </span>
                    <span style="font-weight:800; color:#0f172a; font-size:13.5px;">${c.course_name}</span>
                  </div>
                  <div style="font-size:12px; color:#64748b; margin-top:6px; display:flex; gap:12px; flex-wrap:wrap;">
                    <span><strong>Enrolled:</strong> ${c.enrolled_date || '2026-10-15'}</span>
                    <span><strong>Batch:</strong> ${s.batch || 'Cohort 2026'}</span>
                  </div>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="badge ${isCompleted ? 'badge-green' : 'badge-blue'}" style="font-size:11.5px;">
                    <span class="material-icons-round" style="font-size:14px;">${isCompleted ? 'verified' : 'pending'}</span>
                    ${c.academic_status || 'In Progress'}
                  </span>

                  ${renderCourseCertificateAction(s, c, isCompleted, hasCert)}
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>

      <div style="text-align:right; border-top:1px solid #f1f5f9; padding-top:14px; margin-top:16px;">
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

window.viewStudentCertificateById = async function (certId) {
  try {
    const res = await api(`/api/certificates/${certId}`);
    if (res?.certificate) {
      printOfficialCertificate(res.certificate);
    } else {
      showToast('Certificate details could not be retrieved.');
    }
  } catch (err) {
    showToast('Failed to load certificate: ' + (err.message || err));
  }
};

let studentSearchTimeout = null;
window.searchStudentsLive = function (query) {
  clearTimeout(studentSearchTimeout);
  studentSearchTimeout = setTimeout(() => {
    state.studentSearch = query.trim();
    void renderAdminStudents(document.getElementById('portal-content-mount'));
  }, 250);
};

window.clearStudentSearch = function () {
  state.studentSearch = '';
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

window.filterStudents = function (st) {
  state.studentFilter = st;
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

window.run7DayNotificationAutomation = async function () {
  const res = await api('/api/admin/students/run-7day-automation', { method: 'POST' });
  showToast(res.message);
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

window.openAddStudentModal = async function () {
  const pRes = await api('/api/admin/programs');
  const programs = pRes.programs || [];

  showModal('Student Registration (Master Flow)', `
    <form id="add-student-flow-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" id="as-name" class="form-control" required placeholder="e.g. Pooja Sanjay Kamble">
        </div>
        <div class="form-group">
          <label class="form-label">User ID (Login Username) *</label>
          <input type="text" id="as-uid" class="form-control" required placeholder="e.g. pooja_k">
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input type="email" id="as-email" class="form-control" required placeholder="pooja@gmail.com">
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone</label>
          <input type="tel" id="as-phone" class="form-control" placeholder="+91 98200 12345">
        </div>
        <div class="form-group">
          <label class="form-label">Initial Password *</label>
          <input type="password" id="as-pass" class="form-control" required value="student123">
        </div>
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" id="as-dob" class="form-control" value="2005-06-15">
        </div>

        <!-- Master Flow: Select Program -> Fetch Existing Program Code -> Assign Program Code to Student -->
        <div class="form-group full-width">
          <label class="form-label">Select Program (Fetch Existing Program Code) *</label>
          <select id="as-prog-select" class="form-control" required onchange="updateSelectedProgramCode(this)">
            <option value="">-- Select Program to Fetch Code --</option>
            ${programs.map(p => `
              <option value="${p.id}" data-code="${p.program_code}">${p.program_name} [${p.program_code}]</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Fetched Program Code</label>
          <input type="text" id="as-prog-code-display" class="form-control" readonly placeholder="Auto-fetched" style="background:#f1f5f9; font-weight:800; color:#154d34;">
        </div>

        <div class="form-group">
          <label class="form-label">Initial Student Status</label>
          <select id="as-status-select" class="form-control">
            <option value="Joined">Joined (Active in Class)</option>
            <option value="Enrolled">Enrolled (7-Day Notice)</option>
            <option value="Drafted">Drafted</option>
          </select>
        </div>
      </div>

      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Generate Student Code & Assign</button>
      </div>
    </form>
  `);

  window.updateSelectedProgramCode = function (selectEl) {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const code = selectedOption?.dataset?.code || '';
    document.getElementById('as-prog-code-display').value = code;
  };

  document.getElementById('add-student-flow-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify({
        full_name: document.getElementById('as-name').value,
        user_id: document.getElementById('as-uid').value,
        email: document.getElementById('as-email').value,
        phone: document.getElementById('as-phone').value,
        password: document.getElementById('as-pass').value,
        dob: document.getElementById('as-dob').value,
        program_id: document.getElementById('as-prog-select').value,
        student_status: document.getElementById('as-status-select').value
      })
    });
    closeModal();
    showToast(`Registered! Student Code: ${res.student_code} assigned to ${res.program_code}`);
    void renderAdminStudents(document.getElementById('portal-content-mount'));
  };
};

window.openStudentStatusModal = function (s) {
  showModal(`Manage Student: ${s.full_name} (${s.student_code})`, `
    <div style="font-size:13px; margin-bottom:16px; color:#475569;">
      Assigned Program: <strong>${s.program_code} - ${s.program_name || s.enrolled_program}</strong>
    </div>

    <!-- Student Status & 7-Day Notification Section -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:16px;">
      <h4 style="font-size:14px; font-weight:800; color:#154d34; margin-bottom:10px;">1. Student Status Transition (Master Flow)</h4>
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Student Status</label>
          <select id="mss-status" class="form-control" onchange="toggleArchiveReason(this.value)">
            <option value="Drafted" ${s.student_status === 'Drafted' ? 'selected' : ''}>Drafted</option>
            <option value="Enrolled" ${s.student_status === 'Enrolled' ? 'selected' : ''}>Enrolled (7-Day Notice)</option>
            <option value="Joined" ${s.student_status === 'Joined' ? 'selected' : ''}>Joined Students</option>
            <option value="Archived" ${s.student_status === 'Archived' ? 'selected' : ''}>Expired Student Archive</option>
          </select>
        </div>
        <div class="form-group full-width" id="mss-archive-box" style="display:${s.student_status === 'Archived' ? 'block' : 'none'};">
          <label class="form-label">Archive Reason (Did not join within 7-Day notification)</label>
          <input type="text" id="mss-archive-reason" class="form-control" value="${s.archive_reason || 'Did not join after 7-Day notification window'}" placeholder="Reason...">
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="saveStudentStatus(${s.id})">Save Student Status</button>
    </div>

    <!-- Academic Status & Completion Approval Section -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
      <h4 style="font-size:14px; font-weight:800; color:#154d34; margin-bottom:10px;">2. Student Academic Tracking & Verification</h4>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Academic Status</label>
          <select id="mss-academic" class="form-control">
            <option value="In Progress" ${s.academic_status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Completed" ${s.academic_status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Completion Approved?</label>
          <select id="mss-approved" class="form-control">
            <option value="0" ${s.completion_approved !== 1 ? 'selected' : ''}>No (Verification Pending / Incomplete)</option>
            <option value="1" ${s.completion_approved === 1 ? 'selected' : ''}>Yes (Completion Verified & Approved)</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="saveAcademicStatus(${s.id})">Save Academic Verification</button>
    </div>
  `);

  window.toggleArchiveReason = function (val) {
    document.getElementById('mss-archive-box').style.display = val === 'Archived' ? 'block' : 'none';
  };
};

window.saveStudentStatus = async function (id) {
  const status = document.getElementById('mss-status').value;
  const reason = document.getElementById('mss-archive-reason') ? document.getElementById('mss-archive-reason').value : '';
  const res = await api(`/api/admin/students/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ student_status: status, archive_reason: reason })
  });
  closeModal();
  showToast(res.message);
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

window.saveAcademicStatus = async function (id) {
  const academic = document.getElementById('mss-academic').value;
  const approved = document.getElementById('mss-approved').value === '1';
  const res = await api(`/api/admin/students/${id}/academic`, {
    method: 'PUT',
    body: JSON.stringify({ academic_status: academic, completion_approved: approved })
  });
  closeModal();
  showToast(res.message);
  void renderAdminStudents(document.getElementById('portal-content-mount'));
};

window.generateCertFromStudent = async function (studentId, studentName) {
  const res = await api('/api/admin/certificates/generate', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId })
  });
  showToast(res.message);
  switchView('certificates');
};

function getFounderApprovalBadge(approvalStatus) {
  if (approvalStatus === 'Approved') {
    return '<span class="badge badge-green">✓ Founder Approved</span>';
  }
  if (approvalStatus === 'Rejected') {
    return '<span class="badge badge-red">Returned for Correction</span>';
  }
  return '<span class="badge badge-yellow">Pending Founder Approval</span>';
}

function getFounderDecisionBadge(approvalStatus) {
  if (approvalStatus === 'Approved') {
    return '<span class="badge badge-green">✓ Founder Approved</span>';
  }
  if (approvalStatus === 'Rejected') {
    return '<span class="badge badge-red">Correction Requested</span>';
  }
  return '<span class="badge badge-yellow">Pending Founder Approval</span>';
}

// =========================================================================
// 3.5 UNIFIED CERTIFICATE ENGINE & VERIFICATION ARCHIVE
// =========================================================================
async function renderAdminCertificates(mount) {
  const res = await api('/api/admin/certificates');
  const certs = res.certificates || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Certificate Automation Engine</h1>
        <p class="page-header-desc">Automated batch generation, authentic certificate verification archive, and Founder Approval.</p>
      </div>
      <div class="page-actions" style="display:flex; gap:10px;">
        <button class="btn btn-primary" onclick="void triggerCertEngine()">
          <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">bolt</span> Run Automated Batch Job
        </button>
      </div>
    </div>

    <!-- Search Bar Section -->
    <div style="display:flex; justify-content:center; margin-bottom:24px;">
      <div style="display:flex; gap:10px; width:100%; max-width:680px;">
        <input type="text" id="cert-verify-input" class="form-control" placeholder="Search Certificate No, Student Name/Code, or Program Name/Code..." onkeyup="if(event.key==='Enter') executeCertSearch()">
        <button class="btn btn-primary" onclick="executeCertSearch()" style="min-width:140px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px;">
          <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">search</span> Search
        </button>
        <button class="btn btn-secondary" onclick="resetCertSearch()" style="min-width:90px;">
          Reset
        </button>
      </div>
    </div>

    <!-- Live Search Results (shown if active search) -->
    <div id="cert-search-results-container" style="display:none; margin-bottom:24px;">
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="display:flex; align-items:center; gap:6px;"><span class="material-icons-round" style="font-size:18px; color:#154d34;">search</span> Certificate Search Results</h3>
          <button class="btn btn-secondary btn-sm" onclick="resetCertSearch()">Clear Results</button>
        </div>
        <div class="table-responsive" id="cert-search-results-mount"></div>
      </div>
    </div>

    <!-- All Issued & Pending Certificates Ledger -->
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 class="card-title">Issued & Pending Certificates (${certs.length})</h3>
        <span style="font-size:12px; color:#64748b;">Central Credential Registry</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Certificate No</th>
              <th>Student & Code</th>
              <th>Program & Code</th>
              <th>Issue Date</th>
              <th>Founder Approval</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${certs.length === 0 ? `<tr><td colspan="7" class="empty-state">No certificates generated yet. Certify an approved completed student from Student Management.</td></tr>` :
      certs.map(c => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${c.certificate_no}</td>
                  <td><strong>${c.student_name}</strong><br><small style="color:#64748b;">${c.student_code}</small></td>
                  <td>${c.program_name || c.event_title}<br><span class="badge badge-blue" style="font-size:10px;">${c.program_code || 'PRG-FSD-01'}</span></td>
                  <td>${c.issue_date}</td>
                  <td>
                    ${getFounderApprovalBadge(c.approval_status)}
                  </td>
                  <td><span class="badge ${c.status === 'Issued' ? 'badge-green' : 'badge-gray'}">${c.status}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-primary btn-sm" onclick="printOfficialCertificate(${JSON.stringify(c).replaceAll('"', '&quot;')})">🖨️ View PDF</button>
                      ${c.approval_status !== 'Approved' ? `
                        <button class="btn btn-secondary btn-sm" onclick="openFounderApprovalModal(${JSON.stringify(c).replaceAll('"', '&quot;')})">⚖️ Decision</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;

  window.resetCertSearch = function () {
    const input = document.getElementById('cert-verify-input');
    if (input) input.value = '';
    const container = document.getElementById('cert-search-results-container');
    if (container) container.style.display = 'none';
  };

  window.executeCertSearch = async function () {
    const q = document.getElementById('cert-verify-input').value.trim();
    const container = document.getElementById('cert-search-results-container');
    const resMount = document.getElementById('cert-search-results-mount');
    if (!q) {
      if (container) container.style.display = 'none';
      showToast('Please enter a certificate number, student name, or code.');
      return;
    }
    container.style.display = 'block';
    resMount.innerHTML = `<div style="text-align:center; padding:30px;">Querying certificate archive...</div>`;
    const res = await api(`/api/certificates/verify?q=${encodeURIComponent(q)}`);
    const results = res.results || [];

    if (results.length === 0) {
      resMount.innerHTML = `
        <div style="text-align:center; padding:32px 20px;">
          <div style="font-size:36px; margin-bottom:8px; color:#dc2626;"><span class="material-icons-round" style="font-size:48px;">cancel</span></div>
          <div style="font-weight:800; font-size:16px; color:#0f172a;">No Certificate Records Found</div>
          <div style="font-size:12.5px; color:#64748b; margin-top:4px;">No verified record exists matching query "<strong>${q}</strong>". Please verify the code and try again.</div>
        </div>
      `;
      return;
    }

    resMount.innerHTML = `
      <div style="background:#eaf5ee; border:1px solid #c2e2d0; border-radius:10px; padding:12px 16px; margin:16px; display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px; color:#16a34a;"><span class="material-icons-round" style="font-size:36px;">check_circle</span></span>
        <div style="font-size:13px; color:#154d34;"><strong>Authenticity Verified:</strong> Found ${results.length} authenticated record(s) matching your query.</div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Certificate Number</th>
            <th>Student Name & Code</th>
            <th>Program Name & Code</th>
            <th>Issue Date</th>
            <th>Founder Approval</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td style="font-weight:800; color:#154d34;">${r.certificate_no}</td>
              <td><strong>${r.student_name}</strong><br><small style="color:#64748b;">${r.student_code}</small></td>
              <td>${r.canonical_program_name || r.event_title}<br><span class="badge badge-blue" style="font-size:10px;">${r.program_code || 'PRG-FSD-01'}</span></td>
              <td>${r.issue_date}</td>
              <td>
                ${getFounderDecisionBadge(r.approval_status)}
              </td>
              <td><span class="badge ${r.status === 'Issued' ? 'badge-green' : 'badge-gray'}">${r.status}</span></td>
              <td>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-primary btn-sm" onclick="printOfficialCertificate(${JSON.stringify(r).replaceAll('"', '&quot;')})">🖨️ View PDF</button>
                  ${r.approval_status !== 'Approved' ? `
                    <button class="btn btn-secondary btn-sm" onclick="openFounderApprovalModal(${JSON.stringify(r).replaceAll('"', '&quot;')})">⚖️ Decision</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };
}

window.openFounderApprovalModal = function (c) {
  showModal(`Founder Approval: ${c.certificate_no}`, `
    <div style="font-size:13.5px; line-height:1.6; margin-bottom:18px;">
      <div><strong>Student Name:</strong> ${c.student_name} (${c.student_code})</div>
      <div><strong>Program:</strong> ${c.program_name || c.event_title} (${c.program_code || 'PRG-FSD-01'})</div>
      <div><strong>QR Verification Code:</strong> <code>${c.qr_verification_code || 'QR-MINDS'}</code></div>
      <div><strong>Signatory Authority:</strong> ${c.founder_signature || 'Dr. Ramesh Narayan'}</div>
    </div>

    <div style="border-top:1px dashed #cbd5e1; padding-top:16px;">
      <h4 style="font-size:14px; font-weight:800; color:#154d34; margin-bottom:8px;">Founder Approval Decision</h4>
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Decision</label>
        <select id="fa-decision" class="form-control" onchange="toggleRejectionBox(this.value)">
          <option value="Approved">Approved (Issue Certificate & Save to Archive)</option>
          <option value="Rejected">Rejected (Return for Correction)</option>
        </select>
      </div>
      <div class="form-group" id="fa-reject-box" style="display:none; margin-bottom:14px;">
        <label class="form-label">Correction Notes / Reason for Rejection</label>
        <textarea id="fa-reason" class="form-control" placeholder="Specify corrections required in attendance or student details..."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="submitFounderDecision(${c.id})">Confirm Decision</button>
      </div>
    </div>
  `);

  window.toggleRejectionBox = function (val) {
    document.getElementById('fa-reject-box').style.display = val === 'Rejected' ? 'block' : 'none';
  };
};

window.submitFounderDecision = async function (id) {
  const decision = document.getElementById('fa-decision').value;
  const reason = document.getElementById('fa-reason') ? document.getElementById('fa-reason').value : '';
  const res = await api(`/api/admin/certificates/${id}/founder-approval`, {
    method: 'PUT',
    body: JSON.stringify({ decision, rejection_reason: reason })
  });
  closeModal();
  showToast(res.message);
  void renderAdminCertificates(document.getElementById('portal-content-mount'));
};

// 3.4 Donor & Donation Management (Admin)
async function renderAdminDonors(mount) {
  const dRes = await api('/api/admin/donors');
  const donRes = await api('/api/admin/donations');
  const donors = dRes.donors || [];
  const donations = donRes.donations || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Donor & Donation Verification</h1>
        <p class="page-header-desc">Review submitted donor payments, inspect 80G tax certificates, approve documents, and audit update logs.</p>
      </div>
    </div>

    <!-- Donors Directory with 80G PAN Info -->
    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <h3 class="card-title">Registered Donors & Tax Profiles</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Donor Code</th>
              <th>Full Name</th>
              <th>Contact</th>
              <th>80G Tax PAN</th>
              <th>Category</th>
              <th>Total Contributions</th>
              <th>Donations</th>
            </tr>
          </thead>
          <tbody>
            ${donors.length === 0 ? `<tr><td colspan="7" class="empty-state">No donors registered.</td></tr>` :
      donors.map(d => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${d.donor_code}</td>
                  <td style="font-weight:700;">${d.full_name}</td>
                  <td>${d.phone}<br><small style="color:#64748b;">${d.email || '-'}</small></td>
                  <td><code style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-weight:700;">${d.pan_number || 'AAACT2026P'}</code></td>
                  <td><span class="badge badge-blue">${d.donor_category || 'Individual'}</span></td>
                  <td style="font-weight:800; color:#0f172a;">₹${Number(d.total_contributed || 0).toLocaleString('en-IN')}</td>
                  <td><strong>${d.donation_count || 0}</strong></td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <h3 class="card-title">Donation Submissions Ledger & 80G Certificates</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Donor</th>
              <th>80G Tax Cert No / PAN</th>
              <th>Amount</th>
              <th>Purpose & Beneficiary</th>
              <th>Payment Status</th>
              <th>Document</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${donations.map(don => `
              <tr>
                <td style="font-weight:800; color:#154d34;">${don.receipt_no}</td>
                <td style="font-weight:700;">${don.donor_name}<br><small style="color:#64748b;">${don.donor_code}</small></td>
                <td>
                  ${don.tax_cert_number ? `
                    <div style="font-weight:700; color:#047857; font-size:12px; display:flex; align-items:center; gap:4px;"><span class="material-icons-round" style="font-size:15px;">description</span> ${don.tax_cert_number}</div>
                    <small style="color:#64748b;">PAN: <code style="font-size:11px;">${don.pan_number || 'AAACT2026P'}</code></small>
                  ` : `
                    <div style="font-size:12px; color:#64748b;">PAN: <code>${don.pan_number || 'AAACT2026P'}</code></div>
                    <span class="badge badge-yellow" style="font-size:10px;">Pending Cert</span>
                  `}
                </td>
                <td style="font-weight:800; color:#0f172a;">₹${Number(don.amount).toLocaleString('en-IN')}</td>
                <td><strong>${don.purpose_name}</strong><br><small style="color:#64748b;">Target: ${don.beneficiary_target || 'General'}</small></td>
                <td><span class="badge ${don.payment_status === 'Verified' ? 'badge-green' : 'badge-yellow'}">${don.payment_status}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="openDonorDocumentViewer(${JSON.stringify(don).replaceAll('"', '&quot;')})">
                    <span class="material-icons-round" style="font-size:15px; vertical-align:middle; margin-right:4px;">description</span>View Document
                  </button>
                </td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="openReviewDonationModal(${JSON.stringify(don).replaceAll('"', '&quot;')})">Review / Approve</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openDonorDocumentViewer = function (don) {
  let docUrl = null;
  if (don.supporting_doc_path) {
    docUrl = don.supporting_doc_path.endsWith('.pdf') ? '/uploads/sample_tax_pan_receipt.html' : don.supporting_doc_path;
  }

  showModal(`Donation Document: ${don.receipt_no}`, `
    <div style="font-family:'Plus Jakarta Sans', sans-serif;">
      <!-- Document Summary Header -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <h3 style="font-size:16px; font-weight:800; color:#154d34; margin:0 0 4px 0;">${don.receipt_no} - Official Donation Document</h3>
            <div style="font-size:12.5px; color:#64748b;">Donor: <strong>${don.donor_name || 'Rajeshwari Singhania'}</strong> (${don.donor_code || 'DNR-8891'}) &bull; PAN: <code>${don.pan_number || 'ABCPS1234D'}</code></div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${don.payment_status === 'Verified' ? 'badge-green' : 'badge-yellow'}" style="font-size:12px; font-weight:700;">
              ${don.payment_status === 'Verified' ? '✓ Payment Verified' : don.payment_status}
            </span>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; font-size:12px; border-top:1px dashed #cbd5e1; padding-top:10px; margin-top:8px;">
          <div><span style="color:#64748b;">Amount:</span><br><strong style="font-size:14px; color:#0f172a;">₹${Number(don.amount).toLocaleString('en-IN')}</strong></div>
          <div><span style="color:#64748b;">Method / Ref:</span><br><strong>${don.payment_method || 'NEFT'} - ${don.payment_reference || 'N/A'}</strong></div>
          <div><span style="color:#64748b;">80G Tax Cert:</span><br><strong style="color:#047857;">${don.tax_cert_number || '80G/MINDS/2026-27/0042'}</strong></div>
          <div><span style="color:#64748b;">Doc Status:</span><br><strong style="color:#15803d;">${don.doc_status || 'Verified'}</strong></div>
        </div>
      </div>

      <!-- Document Preview Frame / Voucher Render -->
      <div style="border:2px solid #0f766e; border-radius:12px; background:#fff; overflow:hidden; margin-bottom:18px; box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <div style="background:#0f766e; color:#fff; padding:10px 16px; font-size:12.5px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
          <span>Official Tax Exemption & Payment Verification Record</span>
          <span style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:6px; font-size:11px;">MINDS TRUST ERP Audit Certified</span>
        </div>
        <div style="padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e2e8f0; padding-bottom:14px; margin-bottom:16px;">
            <div>
              <h2 style="font-size:20px; font-weight:900; color:#154d34; margin:0;">MINDS TRUST</h2>
              <div style="font-size:11px; color:#64748b; margin-top:3px;">Registered Charitable Trust • Under Section 80G(5)(vi) Income Tax Act 1961</div>
              <div style="font-size:11px; color:#64748b;">Trust PAN: <strong>AAACT2026P</strong> • Central Registration: CIT/MUM/80G/2026</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px; font-weight:800; color:#0f172a;">DONATION VOUCHER</div>
              <div style="font-size:12px; font-weight:700; color:#154d34;">${don.receipt_no}</div>
              <div style="font-size:11px; color:#64748b;">Date: ${don.donation_date || '2026-11-17'}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:12.5px; margin-bottom:16px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
              <strong style="color:#0f172a; display:block; margin-bottom:6px;">Donor Details:</strong>
              <div><strong>Name:</strong> ${don.donor_name || 'Rajeshwari Singhania'}</div>
              <div><strong>Donor ID:</strong> ${don.donor_code || 'DNR-8891'}</div>
              <div><strong>PAN Number:</strong> <code style="font-weight:700; background:#e0f2fe; color:#0369a1; padding:1px 5px; border-radius:4px;">${don.pan_number || 'ABCPS1234D'}</code></div>
              <div><strong>Contact:</strong> ${don.donor_phone || '+91 98210 99887'}</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
              <strong style="color:#0f172a; display:block; margin-bottom:6px;">Donation & Bank Details:</strong>
              <div><strong>Payment Mode:</strong> ${don.payment_method || 'NEFT / Net Banking'}</div>
              <div><strong>Transaction Ref:</strong> <code>${don.payment_reference || 'NEFT-AXIS-992144'}</code></div>
              <div><strong>Cause / Purpose:</strong> ${don.purpose_name || 'Student Education Support'}</div>
              <div><strong>Beneficiary:</strong> ${don.beneficiary_target || 'Batch A-2026 Youth Cohort'}</div>
            </div>
          </div>

          <div style="background:#f0fdf4; border:1.5px dashed #16a34a; border-radius:10px; padding:16px; text-align:center; margin-bottom:16px;">
            <div style="font-size:11px; font-weight:700; color:#15803d; letter-spacing:0.5px; text-transform:uppercase;">Verified Contribution Amount</div>
            <div style="font-size:28px; font-weight:900; color:#0f766e; margin:4px 0;">₹${Number(don.amount).toLocaleString('en-IN')}</div>
            <div style="font-size:12px; color:#475569;">Donation eligible for 50% deduction under Section 80G of Income Tax Act</div>
          </div>

          <div style="font-size:12px; color:#475569; line-height:1.6; margin-bottom:16px;">
            <strong>Supporting Verification Remarks:</strong> ${don.reason_description || 'Direct sponsorship credited to MINDS TRUST Student Scholarship Fund.'}<br>
            ${don.supporting_doc_path ? `<strong>Document File Upload:</strong> <span style="color:#0f766e;">${don.supporting_doc_path}</span> (Signed Bank Deposit Slip)` : `<strong>Document Proof:</strong> Verified via Official Bank UTR Settlement Reference.`}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:14px;">
            <div>
              <div style="border:2px solid #0f766e; color:#0f766e; padding:6px 12px; border-radius:6px; font-weight:900; font-size:11px; display:inline-block; letter-spacing:1px;">
                MINDS TRUST • AUDITED & VERIFIED
              </div>
            </div>
            <div style="text-align:right; font-size:11px; color:#64748b;">
              <div style="border-top:1px solid #94a3b8; width:150px; padding-top:4px; font-weight:700; color:#0f172a;">Authorized Signatory</div>
              Chartered Accountant & Finance Desk
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <div>
          <button class="btn btn-secondary" onclick="printOfficialDonationReceipt(${JSON.stringify(don).replaceAll('"', '&quot;')})">
            <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">receipt_long</span>Official Receipt
          </button>
          ${docUrl ? `
            <a href="${docUrl}" target="_blank" class="btn btn-secondary" style="margin-left:6px;">
              <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">open_in_new</span>Open File in New Tab
            </a>
          ` : ''}
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-primary" onclick="window.print()">
            <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">print</span>Print / Save PDF
          </button>
          <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `);
};

window.openReviewDonationModal = function (don) {
  showModal(`Review Donation: ${don.receipt_no}`, `
    <div style="background:#f1f5f9; padding:12px 16px; border-radius:10px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:800; font-size:14px; color:#154d34;">${don.donor_name || 'Rajeshwari Singhania'} &bull; ₹${Number(don.amount).toLocaleString('en-IN')}</div>
        <div style="font-size:12px; color:#64748b;">Ref: <code>${don.payment_reference || 'N/A'}</code> &bull; Tax PAN: <code>${don.pan_number || 'AAACT2026P'}</code></div>
      </div>
      <div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="openDonorDocumentViewer(${JSON.stringify(don).replaceAll('"', '&quot;')})">
          <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">description</span>Inspect Document
        </button>
      </div>
    </div>
    <form id="review-don-form">
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Payment Verification Status</label>
        <select id="rv-pay" class="form-control">
          <option value="Verified" ${don.payment_status === 'Verified' ? 'selected' : ''}>Verified (Bank Verified)</option>
          <option value="Processing" ${don.payment_status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Pending" ${don.payment_status === 'Pending' ? 'selected' : ''}>Pending Verification</option>
          <option value="Failed" ${don.payment_status === 'Failed' ? 'selected' : ''}>Failed</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Supporting Document Status</label>
        <select id="rv-doc" class="form-control">
          <option value="Verified" ${don.doc_status === 'Verified' ? 'selected' : ''}>Verified & Approved</option>
          <option value="Pending Review" ${don.doc_status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
          <option value="Rejected" ${don.doc_status === 'Rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>

      <div class="form-group full-width">
        <label class="form-label">Admin Remarks / Notification to Donor</label>
        <textarea id="rv-comments" class="form-control" placeholder="Add verified tax reference or reason...">${don.admin_comments || ''}</textarea>
      </div>

      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Review & Send Email</button>
      </div>
    </form>
  `);

  document.getElementById('review-don-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api(`/api/admin/donations/${don.id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
        payment_status: document.getElementById('rv-pay').value,
        doc_status: document.getElementById('rv-doc').value,
        admin_comments: document.getElementById('rv-comments').value
      })
    });
    closeModal();
    showToast(res.message);
    void renderAdminDonors(document.getElementById('portal-content-mount'));
  };
};


// 3.6 Finance Management Module (Directly Accessible by Admin Profile)
async function renderAdminFinance(mount) {
  try {
    const res = await api('/api/finance/records');
    const records = res.records || [];
    const sum = res.summary || {};

    mount.innerHTML = `
      <div class="page-header-row">
        <div>
          <h1 class="page-header-title">MINDS TRUST Finance Management</h1>
          <p class="page-header-desc">Complete financial records, grant dispersement, and donation inflows managed directly under Admin profile.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="openAddFinanceModal()">+ Book Transaction</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">Donation Inflows</div>
          <div class="stat-value" style="color:#15803d;">₹${Number(sum.totalInflow || 0).toLocaleString('en-IN')}</div>
          <div class="stat-footer-badge">Audited Income</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Grants & Expenses</div>
          <div class="stat-value" style="color:#b91c1c;">₹${Number(sum.totalOutflow || 0).toLocaleString('en-IN')}</div>
          <div class="stat-footer-badge">Disbursements</div>
        </div>
        <div class="stat-card hero-card">
          <div class="stat-title">Net Balance</div>
          <div class="stat-value">₹${Number(sum.netBalance || 0).toLocaleString('en-IN')}</div>
          <div class="stat-footer-badge">Available Surplus</div>
        </div>
      </div>

      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Txn ID</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Reference</th>
                <th>Approved By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${r.transaction_id}</td>
                  <td style="font-weight:700;">${r.category}</td>
                  <td style="font-weight:800; color:#0f172a;">₹${Number(r.amount).toLocaleString('en-IN')}</td>
                  <td>${r.transaction_date}</td>
                  <td><code>${r.reference_no || 'N/A'}</code></td>
                  <td>${r.approved_by || 'Admin'}</td>
                  <td><span class="badge badge-green">${r.payment_status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div style="padding:40px; text-align:center; color:#dc2626;">Failed to load finance records: ${err.message}</div>`;
  }
}

window.openAddFinanceModal = function () {
  showModal('Book Finance Transaction', `
    <form id="add-finance-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Transaction Category *</label>
          <select id="af-cat" class="form-control" required>
            <option value="Donation Inflow">Donation Inflow</option>
            <option value="Student Fee Grant">Student Fee Grant</option>
            <option value="Medical Assistance Disbursal">Medical Assistance Disbursal</option>
            <option value="Training Operational Expense">Training Operational Expense</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₹ INR) *</label>
          <input type="number" id="af-amt" class="form-control" required min="1" placeholder="25000">
        </div>
        <div class="form-group">
          <label class="form-label">Reference / Cheque / UTR #</label>
          <input type="text" id="af-ref" class="form-control" placeholder="NEFT-HDFC-9912">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Notes / Description</label>
          <textarea id="af-notes" class="form-control" placeholder="Details of the financial transaction..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Book Transaction</button>
      </div>
    </form>
  `);

  document.getElementById('add-finance-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/finance/records', {
      method: 'POST',
      body: JSON.stringify({
        category: document.getElementById('af-cat').value,
        amount: document.getElementById('af-amt').value,
        reference_no: document.getElementById('af-ref').value,
        notes: document.getElementById('af-notes').value
      })
    });
    closeModal();
    showToast(res.message);
    void renderAdminFinance(document.getElementById('portal-content-mount'));
  };
};

// 3.7 Email Automation Logs (Admin)
async function renderAdminEmails(mount) {
  const res = await api('/api/admin/email-logs');
  const logs = res.logs || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Automated Email Engine Logs</h1>
        <p class="page-header-desc">Automated transactional email notifications triggered by registrations, donations, and certificate generation.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Recipient</th>
              <th>Event Trigger</th>
              <th>Email Subject</th>
              <th>Delivery Status</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${l.sent_at}</td>
                <td style="font-weight:700;">${l.recipient_name || ''}<br><small style="color:#64748b;">${l.recipient_email}</small></td>
                <td><span class="badge badge-purple">${l.event_type}</span></td>
                <td><strong>${l.subject}</strong></td>
                <td><span class="badge badge-green">${l.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3.8 Audit Logs (Admin)
async function renderAdminAudit(mount) {
  const res = await api('/api/admin/audit-logs');
  const logs = res.logs || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">System Audit Trails</h1>
        <p class="page-header-desc">Tamper-evident logs of every state change across all 4 portals.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Portal</th>
              <th>Action</th>
              <th>Audit Details</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td>${l.timestamp}</td>
                <td style="font-weight:700;">${l.user_name}</td>
                <td><span class="badge badge-gray">${l.portal}</span></td>
                <td><span class="badge badge-blue">${l.action}</span></td>
                <td style="font-size:12px; color:#475569;">${l.details || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Trainer Management (Admin)
async function renderAdminTrainers(mount) {
  const res = await api('/api/admin/trainers');
  const trainers = res.trainers || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Trainer Management</h1>
        <p class="page-header-desc">Manage trainer accounts, specializations, and monitored cohorts.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Full Name</th>
              <th>Specialization</th>
              <th>Qualification</th>
              <th>Assigned Events</th>
            </tr>
          </thead>
          <tbody>
            ${trainers.map(t => `
              <tr>
                <td style="font-weight:800; color:#154d34;">${t.trainer_code}</td>
                <td style="font-weight:700;">${t.full_name}</td>
                <td>${t.specialization}</td>
                <td>${t.qualification || 'N/A'}</td>
                <td><strong>${t.event_count}</strong> events</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Event Management (Admin)
async function renderAdminEvents(mount) {
  const res = await api('/api/admin/events');
  const events = res.events || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Event & Course Schedules</h1>
        <p class="page-header-desc">Events trigger automatic certificate issuance upon their last_date.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Event Code</th>
              <th>Title</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Trainer</th>
              <th>Status</th>
              <th>Attendees</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(ev => `
              <tr>
                <td style="font-weight:800; color:#154d34;">${ev.event_code}</td>
                <td style="font-weight:700;">${ev.title}</td>
                <td>${ev.start_date}</td>
                <td>${ev.last_date}</td>
                <td>${ev.trainer_name || 'Unassigned'}</td>
                <td><span class="badge ${ev.status === 'Completed' ? 'badge-green' : 'badge-blue'}">${ev.status}</span></td>
                <td><strong>${ev.attendee_count}</strong> students</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =========================================================================
// 4. STUDENT PORTAL DASHBOARD VIEW (ENHANCED SUITE)
// =========================================================================
async function renderStudentDashboard(mount) {
  mount.innerHTML = `<div style="text-align:center; padding:40px; color:#64748b;">Loading Student Profile & Academic Records...</div>`;
  const res = await api('/api/student/dashboard');
  const s = res.student;
  const events = res.registeredEvents || [];
  const certs = res.certificates || [];
  const resources = res.resources || [];
  const availableEvents = res.availableEvents || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Student Academic Dashboard</h1>
        <p class="page-header-desc">Welcome back, <strong>${s.full_name}</strong> • Student Code: <strong>${s.student_code}</strong></p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="switchView('resources')">
          <span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">menu_book</span>Learning Library
        </button>
      </div>
    </div>

    <!-- Donezo Metric Cards -->
    <div class="stats-grid">
      <div class="stat-card hero-card">
        <div class="stat-card-top">
          <span class="stat-title">Issued Certificates</span>
          <span class="stat-icon-pill">
            <span class="material-icons-round" style="font-size:18px;">workspace_premium</span>
          </span>
        </div>
        <div class="stat-value">${certs.length}</div>
        <div class="stat-footer-badge">Verified by MINDS TRUST</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-title">Registered Cohorts</span>
          <span class="stat-icon-pill">
            <span class="material-icons-round" style="font-size:18px;">event</span>
          </span>
        </div>
        <div class="stat-value">${events.length}</div>
        <div class="stat-footer-badge" style="background:#eaf5ee; color:#154d34;">Status: ${s.academic_status}</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-title">Study Resources</span>
          <span class="stat-icon-pill">
            <span class="material-icons-round" style="font-size:18px;">menu_book</span>
          </span>
        </div>
        <div class="stat-value">${resources.length}</div>
        <div class="stat-footer-badge">Available to Download</div>
      </div>

      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-title">Student Status</span>
          <span class="stat-icon-pill">
            <span class="material-icons-round" style="font-size:18px;">verified_user</span>
          </span>
        </div>
        <div class="stat-value" style="font-size:20px; margin:16px 0 10px; color:#154d34;">${s.student_status || 'Joined'}</div>
        <div class="stat-footer-badge" style="background:#dcfce7; color:#15803d;">Validated Active</div>
      </div>
    </div>

    <!-- 2-Column Section: Approved Certificates & Available Upcoming Events -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:20px; margin-bottom:24px;">
      
      <!-- Approved Certificates Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#0284c7; font-size:20px;">workspace_premium</span>
            My Official Issued Certificates
          </h3>
          <button class="btn btn-secondary btn-sm" onclick="switchView('certificates')">View All</button>
        </div>
        <div class="card-body" style="padding:0;">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Certificate No</th>
                  <th>Program Completed</th>
                  <th>Issue Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${certs.length === 0 ? `<tr><td colspan="4" class="empty-state">No certificates issued yet. Complete an event to earn your certificate!</td></tr>` :
      certs.map(c => `
                    <tr>
                      <td style="font-weight:800; color:#154d34;">${c.certificate_no}</td>
                      <td style="font-weight:700;">${c.event_title}</td>
                      <td>${c.issue_date}</td>
                      <td>
                        <button class="btn btn-primary btn-sm" onclick="printOfficialCertificate(${JSON.stringify(c).replaceAll('"', '&quot;')})">🖨️ PDF</button>
                      </td>
                    </tr>
                  `).join('')
    }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Available Upcoming Events for 1-Click Enrollment -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" style="display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="color:#154d34; font-size:20px;">campaign</span>
            Open Events Available for Enrollment
          </h3>
        </div>
        <div class="card-body" style="padding:16px 20px;">
          ${availableEvents.length === 0 ? `<div class="empty-state">You are enrolled in all current events!</div>` :
      `<div style="display:flex; flex-direction:column; gap:12px;">
              ${availableEvents.map(ev => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                  <div>
                    <div style="font-weight:800; font-size:14px; color:#0f172a;">${ev.title}</div>
                    <div style="font-size:11.5px; color:#64748b; display:flex; align-items:center; gap:4px;"><span class="material-icons-round" style="font-size:14px;">calendar_today</span> ${ev.start_date} to ${ev.last_date} • <span class="material-icons-round" style="font-size:14px;">location_on</span> ${ev.venue} • Faculty: ${ev.trainer_name || 'Prof. Deshmukh'}</div>
                  </div>
                  <button class="btn btn-primary btn-sm" onclick="enrollInEvent(${ev.id}, '${ev.title}')">Enroll Now</button>
                </div>
              `).join('')}
            </div>`
    }
        </div>
      </div>

    </div>

    <!-- Active Registered Cohorts with Attendance Records -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title" style="display:flex; align-items:center; gap:6px;">
          <span class="material-icons-round" style="color:#0284c7; font-size:20px;">event_note</span>
          Enrolled Programs, Attendance & Academic Performance
        </h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Event Code</th>
              <th>Program Title</th>
              <th>Schedule</th>
              <th>Venue</th>
              <th>Attendance</th>
              <th>Completion Status</th>
              <th>Academic Grade</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(e => `
              <tr>
                <td style="font-weight:800; color:#154d34;">${e.event_code}</td>
                <td style="font-weight:700;">${e.title}</td>
                <td>${e.start_date} to ${e.last_date}</td>
                <td>${e.venue}</td>
                <td><span class="badge badge-green">${e.attendance_status}</span></td>
                <td><span class="badge ${e.completion_status === 'Completed' ? 'badge-green' : 'badge-blue'}">${e.completion_status}</span></td>
                <td><strong>${e.marks_or_grade || 'A'}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 1-Click Enrollment Action
window.enrollInEvent = async function (eventId, eventTitle) {
  const res = await api(`/api/student/enroll-event/${eventId}`, { method: 'POST' });
  showToast(res.message);
  void renderStudentDashboard(document.getElementById('portal-content-mount'));
};

function getResourceIcon(type) {
  if (type === 'PDF') return 'picture_as_pdf';
  if (type === 'Repository') return 'code';
  return 'menu_book';
}

function escapeJsArg(str) {
  return encodeURIComponent(String(str || ''));
}
async function renderStudentResourcesView(mount) {
  const res = await api('/api/student/dashboard');
  const resources = res.resources || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Learning Resources & Course PDFs</h1>
        <p class="page-header-desc">Download study materials, curriculum handbooks, and reference guides assigned by your instructors.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Resource Title</th>
              <th>Format</th>
              <th>Description</th>
              <th>Date Added</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${resources.map(r => `
              <tr>
                <td style="font-weight:800; color:#154d34;">
                  <span class="material-icons-round" style="font-size:16px; vertical-align:middle; color:#154d34; margin-right:4px;">
                    ${getResourceIcon(r.resource_type)}
                  </span>
                  ${r.title}
                </td>
                <td><span class="badge ${r.resource_type === 'PDF' ? 'badge-red' : 'badge-blue'}">${r.resource_type}</span></td>
                <td style="font-size:12.5px; color:#475569; max-width:320px;">${r.description}</td>
                <td>${r.uploaded_at ? r.uploaded_at.slice(0, 10) : '2026-11-17'}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="openResourceViewer(${JSON.stringify(r).replaceAll('"', '&quot;')})">
                    <span class="material-icons-round" style="font-size:14px;">download</span> Access Resource
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openResourceViewer = function(r) {
  if (r.file_or_link?.startsWith('http://') || r.file_or_link?.startsWith('https://')) {
    window.open(r.file_or_link, '_blank');
    return;
  }

  showModal(`Learning Resource: ${r.title}`, `
    <div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <span class="badge ${r.resource_type === 'PDF' ? 'badge-red' : 'badge-blue'}">${r.resource_type}</span>
          <span style="font-size:11.5px; color:#64748b;">Uploaded: ${r.uploaded_at ? r.uploaded_at.slice(0, 10) : '2026-11-17'}</span>
        </div>
        <p style="font-size:13.5px; color:#334155; line-height:1.5;">${r.description}</p>
      </div>

      <div style="background:#ffffff; border:2px dashed #cbd5e1; border-radius:16px; padding:28px 20px; text-align:center; margin-bottom:20px;">
        <span class="material-icons-round" style="font-size:48px; color:#154d34; margin-bottom:8px;">menu_book</span>
        <h4 style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:4px;">${r.title}</h4>
        <div style="font-size:12.5px; color:#64748b; margin-bottom:18px;">Official Course Material • MINDS TRUST Academic Council</div>
        
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="downloadLearningResource('${escapeJsArg(r.title)}', '${r.resource_type}', '${escapeJsArg(r.description)}')">
            <span class="material-icons-round" style="font-size:16px;">download</span> Download Document / Notes
          </button>
          <button class="btn btn-secondary" onclick="previewLearningDocument('${escapeJsArg(r.title)}', '${r.resource_type}', '${escapeJsArg(r.description)}')">
            <span class="material-icons-round" style="font-size:16px;">visibility</span> Read In-Browser
          </button>
        </div>
      </div>

      <div class="modal-footer" style="padding-top:14px; margin:16px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

window.downloadLearningResource = function(titleEncoded, type, descEncoded) {
  const title = decodeURIComponent(titleEncoded);
  const desc = decodeURIComponent(descEncoded);
  const content = `MINDS TRUST ERP - OFFICIAL LEARNING RESOURCE & SYLLABUS GUIDE
================================================================================
Document Title: ${title}
Format: ${type}
Published By: MINDS TRUST Academic Council & Department of Social Welfare
Date Issued: November 2026
Verified Hash: MINDS-LR-${Math.random().toString(36).substring(2, 9).toUpperCase()}

SYNOPSIS & LEARNING OUTCOMES:
${desc}

CORE TOPICS COVERED:
1. Introduction & Foundational Concepts
2. Core Methodology and Technical Standards
3. Practical Laboratory Exercises & Field Case Studies
4. Continuous Assessment and Progress Milestones
5. Final Examination Preparation and Certification Standards

--------------------------------------------------------------------------------
CONFIDENTIAL & PROPRIETARY TO MINDS TRUST REGISTERED STUDENTS.
For student support, contact academic@mindstrust.org
================================================================================
`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Downloading: ${title}`);
};

window.previewLearningDocument = function(titleEncoded, type, descEncoded) {
  const title = decodeURIComponent(titleEncoded);
  const desc = decodeURIComponent(descEncoded);
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Popup blocked. Please allow popups to read the document.');
    return;
  }
  win.document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - MINDS TRUST ERP</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px 20px; margin: 0; }
        .doc-container { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { border-bottom: 2px solid #154d34; padding-bottom: 20px; margin-bottom: 30px; }
        .badge { background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 14px; font-weight: 700; font-size: 12px; }
        h1 { color: #154d34; margin: 10px 0; font-size: 24px; }
        .section { margin: 24px 0; }
        .section h3 { font-size: 16px; color: #0f172a; border-left: 4px solid #154d34; padding-left: 10px; }
        p { line-height: 1.6; font-size: 14px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="doc-container">
        <div class="header">
          <span class="badge">MINDS TRUST ACADEMIC RESOURCE • ${type}</span>
          <h1>${title}</h1>
          <div style="font-size:12px; color:#64748b;">Authenticated Course Curriculum Document</div>
        </div>
        <div class="section">
          <h3>Description & Syllabus Scope</h3>
          <p>${desc}</p>
        </div>
        <div class="section">
          <h3>Curriculum Modules & Outcomes</h3>
          <p>• Module 1: Comprehensive Foundations and Industry Fundamentals</p>
          <p>• Module 2: Applied Skills, Real-world Projects, and Practice Laboratories</p>
          <p>• Module 3: Review, Evaluation, and Certification Criteria</p>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
          MINDS TRUST ERP Central Academic Platform • All Rights Reserved
        </div>
      </div>
    </body>
    </html>
  `;
  win.document.close();
};

// Standalone Approved Certificates View for Student
async function renderStudentCertificatesView(mount) {
  const res = await api('/api/student/dashboard');
  const certs = res.certificates || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">My Approved Certificates</h1>
        <p class="page-header-desc">Officially issued certificates with verifiable date-stamped serial numbers (EVT/DD/MM/YYYY/XXXX).</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Certificate Serial Number</th>
              <th>Program Completed</th>
              <th>Issue Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${certs.length === 0 ? `<tr><td colspan="5" class="empty-state">No certificates available yet.</td></tr>` :
      certs.map(c => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${c.certificate_no}</td>
                  <td style="font-weight:700;">${c.event_title}</td>
                  <td>${c.issue_date}</td>
                  <td><span class="badge badge-green">${c.status}</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="printOfficialCertificate(${JSON.stringify(c).replaceAll('"', '&quot;')})">🖨️ View & Download PDF</button>
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Standalone Events View for Student
async function renderStudentEventsView(mount) {
  const res = await api('/api/student/dashboard');
  const events = res.registeredEvents || [];
  const available = res.availableEvents || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Events & Cohort Participation</h1>
        <p class="page-header-desc">Track attendance, completion status, and browse open events.</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header">
        <h3 class="card-title">Enrolled Programs & Attendance Record</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Event Code</th>
              <th>Program Title</th>
              <th>Schedule</th>
              <th>Venue</th>
              <th>Attendance</th>
              <th>Status</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${events.map(e => `
              <tr>
                <td style="font-weight:800; color:#154d34;">${e.event_code}</td>
                <td style="font-weight:700;">${e.title}</td>
                <td>${e.start_date} to ${e.last_date}</td>
                <td>${e.venue}</td>
                <td><span class="badge badge-green">${e.attendance_status}</span></td>
                <td><span class="badge ${e.completion_status === 'Completed' ? 'badge-green' : 'badge-blue'}">${e.completion_status}</span></td>
                <td><strong>${e.marks_or_grade || 'A'}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Available Upcoming Programs for Enrollment</h3>
      </div>
      <div class="card-body" style="padding:16px 20px;">
        ${available.length === 0 ? `<div class="empty-state">No other events currently open.</div>` :
      `<div style="display:flex; flex-direction:column; gap:12px;">
            ${available.map(ev => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
                <div>
                  <div style="font-weight:800; font-size:14px; color:#0f172a;">${ev.title}</div>
                  <div style="font-size:11.5px; color:#64748b; display:flex; align-items:center; gap:4px;"><span class="material-icons-round" style="font-size:14px;">calendar_today</span> ${ev.start_date} to ${ev.last_date} • <span class="material-icons-round" style="font-size:14px;">location_on</span> ${ev.venue}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="enrollInEvent(${ev.id}, '${ev.title}')">Enroll Now</button>
              </div>
            `).join('')}
          </div>`
    }
      </div>
    </div>
  `;
}

// EXTRA FEATURE: Profile and Password Settings for Student
async function renderStudentProfileSettingsView(mount) {
  const res = await api('/api/student/dashboard');
  const s = res.student;

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Student Profile & Security Settings</h1>
        <p class="page-header-desc">Update your mobile number, email address, or update your login password.</p>
      </div>
    </div>

    <div class="card" style="max-width:640px;">
      <div class="card-body">
        <form id="student-profile-settings-form">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label">Full Name (Registered by Admin)</label>
              <input type="text" class="form-control" value="${s.full_name}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Student Code (Permanent)</label>
              <input type="text" class="form-control" value="${s.student_code}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Enrolled Program</label>
              <input type="text" class="form-control" value="${s.enrolled_program}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="tel" id="sp-phone" class="form-control" value="${s.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="sp-email" class="form-control" value="${s.email}" required>
            </div>

            <div class="form-group full-width" style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:14px;">
              <div style="font-weight:800; font-size:13.5px; color:#154d34; margin-bottom:8px;">Change Password</div>
            </div>

            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" id="sp-curr-pass" class="form-control" placeholder="Leave blank if not changing">
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" id="sp-new-pass" class="form-control" placeholder="New secure password">
            </div>
          </div>

          <div style="margin-top:24px; display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Save Profile Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('student-profile-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/student/profile', {
      method: 'PUT',
      body: JSON.stringify({
        phone: document.getElementById('sp-phone').value,
        email: document.getElementById('sp-email').value,
        current_password: document.getElementById('sp-curr-pass').value,
        new_password: document.getElementById('sp-new-pass').value
      })
    });
    showToast(res.message);
  };
}

// =========================================================================
// 5. DONOR PORTAL DASHBOARD (with 20-Day Update Window)
// =========================================================================
async function renderDonorDashboard(mount) {
  mount.innerHTML = `<div style="text-align:center; padding:40px;">Loading Donor Portfolio...</div>`;
  const res = await api('/api/donor/dashboard');
  const d = res.donor;
  const donations = res.donations || [];
  const purposes = res.purposes || [];

  const totalDonated = donations.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
          <h1 class="page-header-title" style="display:flex; align-items:center; gap:8px;">
            Welcome, ${d.full_name}
            <span class="material-icons-round" style="color:#b45309; font-size:28px;">volunteer_activism</span>
          </h1>
        <p class="page-header-desc">Unique Donor ID: <strong>${d.donor_code}</strong> • MINDS TRUST Benefactor</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openSubmitDonationModal(${JSON.stringify(purposes).replaceAll('"', '&quot;')})">
          <span>+</span> Submit New Donation
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card hero-card">
        <div class="stat-title">Total Contributed</div>
        <div class="stat-value">₹${Number(totalDonated).toLocaleString('en-IN')}</div>
        <div class="stat-footer-badge">Welfare Impact</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Active Contributions</div>
        <div class="stat-value">${donations.length}</div>
        <div class="stat-footer-badge">Verified 80G Eligible</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">My Contributions & 20-Day Update Tracking</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Amount</th>
              <th>Cause / Purpose</th>
              <th>Target Beneficiary</th>
              <th>Payment Status</th>
              <th>20-Day Window</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${donations.length === 0 ? `<tr><td colspan="7" class="empty-state">No donations registered yet. Click 'Submit New Donation' above.</td></tr>` :
      donations.map(don => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${don.receipt_no}</td>
                  <td style="font-weight:800; color:#0f172a;">₹${Number(don.amount).toLocaleString('en-IN')}</td>
                  <td style="font-weight:700;">${don.purpose_name}</td>
                  <td>${don.beneficiary_target || 'General Fund'}</td>
                  <td><span class="badge ${don.payment_status === 'Verified' ? 'badge-green' : 'badge-yellow'}">${don.payment_status}</span></td>
                  <td>
                    ${don.can_edit ? `
                      <span class="badge badge-green">Open (${don.window_remaining} days left)</span>
                    ` : `
                      <span class="badge badge-gray">Locked (Expired)</span>
                    `}
                  </td>
                  <td>
                    ${don.can_edit ? `
                      <button class="btn btn-secondary btn-sm" onclick="openUpdateDonationModal(${JSON.stringify(don).replaceAll('"', '&quot;')})">✏️ Update</button>
                    ` : `
                      <span style="font-size:11px; color:#94a3b8;">Locked</span>
                    `}
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openSubmitDonationModal = function (purposes) {
  showModal('Submit Donation Contribution', `
    <form id="submit-donation-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Contribution Amount (₹ INR) *</label>
          <input type="number" id="sd-amount" class="form-control" required min="100" placeholder="e.g. 50000">
        </div>
        <div class="form-group">
          <label class="form-label">Donation Purpose *</label>
          <select id="sd-purpose" class="form-control" required>
            ${purposes.map(p => `<option value="${p.purpose_name}">${p.purpose_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Person or Cause You Wish to Support</label>
          <input type="text" id="sd-target" class="form-control" placeholder="e.g. Underprivileged Students Scholarship / Medical Aid">
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select id="sd-method" class="form-control">
            <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
            <option value="UPI">UPI / QR Transfer</option>
            <option value="Cheque">Cheque Deposit</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Reference / UTR Number</label>
          <input type="text" id="sd-ref" class="form-control" placeholder="NEFT-AXIS-XXXX">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Supporting Document (Bank Cheque / Transfer Slip)</label>
          <input type="file" id="sd-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Reason / Notes for Donating</label>
          <textarea id="sd-notes" class="form-control" placeholder="Special dedication or purpose instructions..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit Donation</button>
      </div>
    </form>
  `);

  document.getElementById('submit-donation-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('amount', document.getElementById('sd-amount').value);
    formData.append('purpose_name', document.getElementById('sd-purpose').value);
    formData.append('beneficiary_target', document.getElementById('sd-target').value);
    formData.append('payment_method', document.getElementById('sd-method').value);
    formData.append('payment_reference', document.getElementById('sd-ref').value);
    formData.append('reason_description', document.getElementById('sd-notes').value);
    const file = document.getElementById('sd-file').files[0];
    if (file) formData.append('supporting_document', file);

    const res = await api('/api/donor/donations', { method: 'POST', body: formData });
    closeModal();
    showToast(res.message);
    void renderDonorDashboard(document.getElementById('portal-content-mount'));
  };
};

window.openUpdateDonationModal = function (don) {
  showModal(`Update Donation #${don.receipt_no} (20-Day Window Active)`, `
    <form id="update-donation-form">
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Beneficiary Target / Person Supported</label>
        <input type="text" id="ud-target" class="form-control" value="${don.beneficiary_target || ''}" required>
      </div>
      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Updated Description & Reason</label>
        <textarea id="ud-reason" class="form-control" required>${don.reason_description || ''}</textarea>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Upload New / Replacement Supporting Document</label>
        <input type="file" id="ud-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg">
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Updates</button>
      </div>
    </form>
  `);

  document.getElementById('update-donation-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('beneficiary_target', document.getElementById('ud-target').value);
    formData.append('reason_description', document.getElementById('ud-reason').value);
    const file = document.getElementById('ud-file').files[0];
    if (file) formData.append('supporting_document', file);

    const res = await api(`/api/donor/donations/${don.id}`, { method: 'PUT', body: formData });
    closeModal();
    showToast(res.message || 'Donation updated');
    void renderDonorDashboard(document.getElementById('portal-content-mount'));
  };
};

// DONOR PORTAL EXTRA VIEWS

// 1. Submit Donation Dedicated View
async function renderDonorContributeView(mount) {
  const res = await api('/api/donor/dashboard');
  const purposes = res.purposes || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Make a Contribution</h1>
        <p class="page-header-desc">Empower underprivileged students and charitable welfare initiatives with instant 80G tax receipt generation.</p>
      </div>
    </div>

    <div class="card" style="max-width:760px;">
      <div class="card-header">
        <h3 class="card-title">Donation Contribution Form</h3>
      </div>
      <div class="card-body">
        <form id="standalone-donor-submit-form">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Contribution Amount (₹ INR) *</label>
              <input type="number" id="sds-amount" class="form-control" required min="100" placeholder="e.g. 25000">
            </div>
            <div class="form-group">
              <label class="form-label">Donation Purpose *</label>
              <select id="sds-purpose" class="form-control" required>
                ${purposes.map(p => `<option value="${p.purpose_name}">${p.purpose_name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group full-width">
              <label class="form-label">Person or Cause You Wish to Support</label>
              <input type="text" id="sds-target" class="form-control" placeholder="e.g. Rural Girls STEM Scholarship / Medical Rehabilitation">
            </div>
            <div class="form-group">
              <label class="form-label">Payment Method</label>
              <select id="sds-method" class="form-control">
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI / QR Transfer</option>
                <option value="Cheque">Cheque Deposit</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Payment Reference / UTR Number</label>
              <input type="text" id="sds-ref" class="form-control" placeholder="NEFT-HDFC-99124">
            </div>
            <div class="form-group full-width">
              <label class="form-label">Supporting Document (Payment Receipt / Cheque Copy)</label>
              <input type="file" id="sds-file" class="form-control" accept=".pdf,.png,.jpg,.jpeg">
            </div>
            <div class="form-group full-width">
              <label class="form-label">Special Dedication / Reason for Donating</label>
              <textarea id="sds-notes" class="form-control" rows="3" placeholder="Notes or instructions..."></textarea>
            </div>
          </div>
          <div style="margin-top:24px; display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px;">Submit Contribution</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('standalone-donor-submit-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('amount', document.getElementById('sds-amount').value);
    formData.append('purpose_name', document.getElementById('sds-purpose').value);
    formData.append('beneficiary_target', document.getElementById('sds-target').value);
    formData.append('payment_method', document.getElementById('sds-method').value);
    formData.append('payment_reference', document.getElementById('sds-ref').value);
    formData.append('reason_description', document.getElementById('sds-notes').value);
    const file = document.getElementById('sds-file').files[0];
    if (file) formData.append('supporting_document', file);

    const res = await api('/api/donor/donations', { method: 'POST', body: formData });
    showToast(res.message);
    switchView('history');
  };
}

// 2. Donation History & 20-Day Window Dedicated View
async function renderDonorHistoryView(mount) {
  const res = await api('/api/donor/dashboard');
  const donations = res.donations || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Donation History & 20-Day Edit Window</h1>
        <p class="page-header-desc">Review your historic contributions. Donations remain open for 20 days to edit purpose, target, or documents.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="switchView('contribute')">+ New Contribution</button>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Purpose</th>
              <th>Beneficiary Target</th>
              <th>Status</th>
              <th>20-Day Window</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${donations.length === 0 ? `<tr><td colspan="8" class="empty-state">No donations registered yet.</td></tr>` :
      donations.map(don => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${don.receipt_no}</td>
                  <td>${don.donation_date}</td>
                  <td style="font-weight:800; color:#0f172a;">₹${Number(don.amount).toLocaleString('en-IN')}</td>
                  <td style="font-weight:700;">${don.purpose_name}</td>
                  <td>${don.beneficiary_target || 'General Welfare'}</td>
                  <td><span class="badge ${don.payment_status === 'Verified' ? 'badge-green' : 'badge-yellow'}">${don.payment_status}</span></td>
                  <td>
                    ${don.can_edit ? `
                      <span class="badge badge-green">Open (${don.window_remaining} days left)</span>
                    ` : `
                      <span class="badge badge-gray">Locked (Expired)</span>
                    `}
                  </td>
                  <td>
                    ${don.can_edit ? `
                      <button class="btn btn-secondary btn-sm" onclick="openUpdateDonationModal(${JSON.stringify(don).replaceAll('"', '&quot;')})">✏️ Update</button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="printOfficialDonationReceipt(${JSON.stringify(don).replaceAll('"', '&quot;')})">🖨️ Receipt</button>
                    `}
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 3. 80G Tax Exemption Certificates View
async function renderDonorTaxCertsView(mount) {
  const res = await api('/api/donor/dashboard');
  const d = res.donor;
  const certs = res.taxCertificates || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">80G Income Tax Exemption Certificates</h1>
        <p class="page-header-desc">Official 80G tax certificates for claiming deductions under Section 80G of the Income Tax Act.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Certificate No</th>
              <th>Receipt Ref</th>
              <th>Financial Year</th>
              <th>Eligible Amount</th>
              <th>PAN Number</th>
              <th>Issue Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${certs.length === 0 ? `<tr><td colspan="7" class="empty-state">No tax certificates issued yet.</td></tr>` :
      certs.map(c => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${c.cert_number}</td>
                  <td style="font-weight:700;">${c.receipt_no}</td>
                  <td>${c.financial_year}</td>
                  <td style="font-weight:800; color:#0f172a;">₹${Number(c.eligible_amount).toLocaleString('en-IN')}</td>
                  <td><code>${c.pan_number || 'AAACT2026P'}</code></td>
                  <td>${c.issue_date}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="print80GTaxCert(${JSON.stringify(c).replaceAll('"', '&quot;')}, ${JSON.stringify(d).replaceAll('"', '&quot;')})">🖨️ View & Print 80G</button>
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.printOfficialDonationReceipt = function (don) {
  showModal(`Donation Receipt: ${don.receipt_no}`, `
    <div class="printable-area">
      <div style="border:3px solid #154d34; padding:35px; border-radius:16px; background:#fff; max-width:640px; margin:0 auto; font-family:'Plus Jakarta Sans', sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
          <div>
            <h2 style="font-size:20px; font-weight:800; color:#154d34;">MINDS TRUST</h2>
            <div style="font-size:12px; color:#64748b;">Registered Charitable Trust • PAN: AAACT2026P</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px; font-weight:800; color:#0f172a;">DONATION RECEIPT</div>
            <div style="font-size:12px; color:#154d34; font-weight:700;">#${don.receipt_no}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:13px; margin-bottom:20px;">
          <div><span style="color:#64748b;">Date:</span><br><strong>${don.donation_date}</strong></div>
          <div><span style="color:#64748b;">Payment Method:</span><br><strong>${don.payment_method || 'Bank Transfer'}</strong></div>
          <div><span style="color:#64748b;">Purpose:</span><br><strong>${don.purpose_name}</strong></div>
          <div><span style="color:#64748b;">Beneficiary Target:</span><br><strong>${don.beneficiary_target || 'General Welfare'}</strong></div>
        </div>

        <div style="background:#eaf5ee; border-radius:12px; padding:18px; text-align:center; margin-bottom:20px;">
          <div style="font-size:12px; color:#154d34; font-weight:700;">AMOUNT RECEIVED</div>
          <div style="font-size:32px; font-weight:800; color:#154d34;">₹${Number(don.amount).toLocaleString('en-IN')}</div>
        </div>

        <div style="font-size:12px; color:#64748b; text-align:center; border-top:1px dashed #cbd5e1; padding-top:14px;">
          Eligible for tax exemption under Section 80G of Income Tax Act 1961. Thank you for empowering MINDS TRUST beneficiaries!
        </div>
      </div>
    </div>
    <div style="text-align:center; margin-top:20px;">
      <button class="btn btn-primary" onclick="window.print()"><span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">print</span> Print Receipt</button>
    </div>
  `);
};

window.print80GTaxCert = function (c, d) {
  showModal(`80G Exemption Certificate: ${c.cert_number}`, `
    <div class="printable-area">
      <div style="border:5px double #154d34; padding:35px; border-radius:16px; background:#fff; max-width:680px; margin:0 auto; font-family:'Plus Jakarta Sans', sans-serif;">
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="font-size:22px; font-weight:800; color:#154d34;">MINDS TRUST</h2>
          <div style="font-size:12px; color:#64748b;">Certificate of Exemption under Section 80G(5)(vi) of the Income Tax Act, 1961</div>
          <div style="font-size:13px; font-weight:800; color:#0f172a; margin-top:4px;">CERTIFICATE NO: ${c.cert_number}</div>
        </div>

        <p style="font-size:13.5px; color:#334155; line-height:1.7;">
          This is to certify that MINDS TRUST has received a charitable contribution of <strong>₹${Number(c.eligible_amount).toLocaleString('en-IN')}</strong> from <strong>${d.full_name}</strong> (Donor ID: ${d.donor_code}) on date <strong>${c.issue_date}</strong>.
        </p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin:18px 0; font-size:12.5px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div><strong>Financial Year:</strong> ${c.financial_year}</div>
          <div><strong>Trust PAN:</strong> AAACT2026P</div>
          <div><strong>Donor PAN:</strong> ${c.pan_number || 'AAACT2026P'}</div>
          <div><strong>Verification Hash:</strong> <code>${c.verification_hash}</code></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed #cbd5e1; padding-top:20px; font-size:12px;">
          <div>
            <div>Date of Issue: <strong>${c.issue_date}</strong></div>
            <div style="color:#15803d; font-weight:700; margin-top:4px;">✓ Verified by Central ERP</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800; color:#154d34;">Managing Trustee</div>
            <div style="font-size:11px; color:#64748b;">MINDS TRUST Board</div>
          </div>
        </div>
      </div>
    </div>
    <div style="text-align:center; margin-top:20px;">
      <button class="btn btn-primary" onclick="window.print()"><span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">print</span> Print 80G Certificate</button>
    </div>
  `);
};

// 4. Welfare Impact Updates Dedicated View
async function renderDonorImpactView(mount) {
  const res = await api('/api/donor/dashboard');
  const updates = res.impactUpdates || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Charitable Welfare Impact & Milestones</h1>
        <p class="page-header-desc">Direct field reports showing how your contributions transform student livelihoods and healthcare access.</p>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:18px; max-width:820px;">
      ${updates.length === 0 ? `<div class="card"><div class="empty-state">No impact reports posted yet. Check back soon!</div></div>` :
      updates.map(u => `
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title" style="color:#154d34; display:flex; align-items:center; gap:6px;"><span class="material-icons-round" style="color:#15803d; font-size:20px;">spa</span> ${u.project_title}</h3>
                <div style="font-size:12px; color:#64748b;">Receipt Reference: <strong>${u.receipt_no}</strong> • Field Update: ${u.update_date}</div>
              </div>
              <span class="badge badge-green">${u.beneficiaries_served} Beneficiaries Helped</span>
            </div>
            <div class="card-body">
              <p style="font-size:14px; color:#334155; line-height:1.6; margin-bottom:12px;">${u.milestone_summary}</p>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:12px; color:#0f172a;">
                <strong>Impact Metrics:</strong> ${u.impact_metrics || 'Direct student placement & kit distributions achieved.'}
              </div>
            </div>
          </div>
        `).join('')
    }
    </div>
  `;
}

// 5. Donor Profile & Security Settings View
async function renderDonorProfileSettingsView(mount) {
  const res = await api('/api/donor/dashboard');
  const d = res.donor;

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Donor Profile & Security Settings</h1>
        <p class="page-header-desc">Manage your contact details, PAN number for 80G filing, and login credentials.</p>
      </div>
    </div>

    <div class="card" style="max-width:640px;">
      <div class="card-body">
        <form id="donor-profile-settings-form">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label">Full Name</label>
              <input type="text" class="form-control" value="${d.full_name}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Unique Donor ID (Permanent)</label>
              <input type="text" class="form-control" value="${d.donor_code}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Income Tax PAN (For 80G Receipts)</label>
              <input type="text" id="dp-pan" class="form-control" value="${d.pan_number || 'AAACT2026P'}" placeholder="ABCDE1234F">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="tel" id="dp-phone" class="form-control" value="${d.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="dp-email" class="form-control" value="${d.email}" required>
            </div>
            <div class="form-group full-width">
              <label class="form-label">Postal Address (For Official Physical Receipts)</label>
              <textarea id="dp-address" class="form-control" rows="2">${d.address || '74 Marine Drive, Nariman Point, Mumbai'}</textarea>
            </div>

            <div class="form-group full-width" style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:14px;">
              <div style="font-weight:800; font-size:13.5px; color:#154d34; margin-bottom:8px;">Change Login Password</div>
            </div>

            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" id="dp-curr-pass" class="form-control" placeholder="Leave blank if not changing">
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" id="dp-new-pass" class="form-control" placeholder="New secure password">
            </div>
          </div>

          <div style="margin-top:24px; display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('donor-profile-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/donor/profile', {
      method: 'PUT',
      body: JSON.stringify({
        phone: document.getElementById('dp-phone').value,
        email: document.getElementById('dp-email').value,
        pan_number: document.getElementById('dp-pan').value,
        address: document.getElementById('dp-address').value,
        current_password: document.getElementById('dp-curr-pass').value,
        new_password: document.getElementById('dp-new-pass').value
      })
    });
    showToast(res.message);
  };
}

// =========================================================================
// 6. TRAINER PORTAL DASHBOARD & SUB-MODULES
// =========================================================================

// Dedicated Evaluations View for Trainer
async function renderTrainerEvaluationsView(mount) {
  const res = await api('/api/trainer/dashboard');
  const students = res.students || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Student Evaluation & Grading</h1>
        <p class="page-header-desc">Record attendance, assess project completions, and grant certificate clearance.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Student Name & Code</th>
              <th>Program / Workshop</th>
              <th>Attendance Status</th>
              <th>Completion Status</th>
              <th>Score / Grade</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `<tr><td colspan="6" class="empty-state">No student records available for grading.</td></tr>` :
      students.map(st => `
                <tr>
                  <td style="font-weight:700;">${st.full_name}<br><small style="color:#64748b;">${st.student_code}</small></td>
                  <td>${st.event_title}</td>
                  <td><span class="badge ${st.attendance_status === 'Present' ? 'badge-green' : 'badge-yellow'}">${st.attendance_status}</span></td>
                  <td><span class="badge ${st.completion_status === 'Completed' ? 'badge-green' : 'badge-blue'}">${st.completion_status}</span></td>
                  <td><strong>${st.marks_or_grade || 'A'}</strong></td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEvaluateStudentModal(${JSON.stringify(st).replaceAll('"', '&quot;')})">Evaluate / Grade</button>
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Dedicated Class Sessions & Delivery Hours Log View
async function renderTrainerSessionLogsView(mount) {
  const res = await api('/api/trainer/dashboard');
  const logs = res.sessionLogs || [];
  const events = res.events || [];

  const totalHours = logs.reduce((acc, l) => acc + (l.hours_delivered || 0), 0);

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Class Sessions & Teaching Hours Log</h1>
        <p class="page-header-desc">Log lecture deliveries, topics taught, and batch attendance headcounts.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openAddSessionModal(${JSON.stringify(events).replaceAll('"', '&quot;')})">
          <span>+</span> Log New Session
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card hero-card">
        <div class="stat-title">Delivered Hours</div>
        <div class="stat-value">${totalHours} hrs</div>
        <div class="stat-footer-badge">Academic Curriculum</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Logged Sessions</div>
        <div class="stat-value">${logs.length}</div>
        <div class="stat-footer-badge">Audited Delivery</div>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Program</th>
              <th>Session Topic</th>
              <th>Hours</th>
              <th>Attendance Headcount</th>
              <th>Faculty Notes</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `<tr><td colspan="6" class="empty-state">No teaching session logs recorded yet.</td></tr>` :
      logs.map(l => `
                <tr>
                  <td>${l.session_date}</td>
                  <td style="font-weight:700;">${l.event_title}</td>
                  <td style="font-weight:800; color:#154d34;">${l.session_title}</td>
                  <td><strong>${l.hours_delivered} hrs</strong></td>
                  <td><span class="badge badge-green">${l.attendance_headcount} Students</span></td>
                  <td style="font-size:12.5px; color:#475569; max-width:280px;">${l.notes || l.topics_covered}</td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openAddSessionModal = function (events) {
  showModal('Log Class Session & Hours', `
    <form id="add-session-log-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Select Program / Cohort *</label>
          <select id="as-event" class="form-control" required>
            ${events.map(ev => `<option value="${ev.id}">${ev.title} (${ev.event_code})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Session Date *</label>
          <input type="date" id="as-date" class="form-control" value="${new Date().toISOString().slice(0, 10)}" required>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Session Title / Topic Name *</label>
          <input type="text" id="as-title" class="form-control" placeholder="e.g. Session 3: Enterprise Database Normalization" required>
        </div>
        <div class="form-group">
          <label class="form-label">Hours Delivered *</label>
          <input type="number" step="0.5" id="as-hours" class="form-control" placeholder="e.g. 3.5" required min="0.5">
        </div>
        <div class="form-group">
          <label class="form-label">Student Headcount Present</label>
          <input type="number" id="as-headcount" class="form-control" placeholder="e.g. 20" value="18">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Topics Covered *</label>
          <textarea id="as-topics" class="form-control" required placeholder="Detailed breakdown of syllabus covered in this session..."></textarea>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Session Observations & Remarks</label>
          <textarea id="as-notes" class="form-control" placeholder="Student performance, lab completions..."></textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Session Log</button>
      </div>
    </form>
  `);

  document.getElementById('add-session-log-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/trainer/session-logs', {
      method: 'POST',
      body: JSON.stringify({
        event_id: document.getElementById('as-event').value,
        session_date: document.getElementById('as-date').value,
        session_title: document.getElementById('as-title').value,
        hours_delivered: document.getElementById('as-hours').value,
        attendance_headcount: document.getElementById('as-headcount').value,
        topics_covered: document.getElementById('as-topics').value,
        notes: document.getElementById('as-notes').value
      })
    });
    closeModal();
    showToast(res.message);
    void renderTrainerSessionLogsView(document.getElementById('portal-content-mount'));
  };
};

// Dedicated Course Curriculum & Modules View
async function renderTrainerCurriculumView(mount) {
  const res = await api('/api/trainer/dashboard');
  const modules = res.modules || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Course Curriculum & Syllabus Modules</h1>
        <p class="page-header-desc">Publish and organize syllabus modules, expected learning outcomes, and references.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openAddModuleModal()">
          <span>+</span> Publish New Module
        </button>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Course Name</th>
              <th>Module Title</th>
              <th>Duration</th>
              <th>Learning Outcomes</th>
              <th>Status</th>
              <th>Reference Link</th>
            </tr>
          </thead>
          <tbody>
            ${modules.length === 0 ? `<tr><td colspan="6" class="empty-state">No syllabus modules published yet.</td></tr>` :
      modules.map(m => `
                <tr>
                  <td style="font-weight:700;">${m.course_name}</td>
                  <td style="font-weight:800; color:#154d34;"><span class="material-icons-round" style="font-size:15px; vertical-align:middle; margin-right:4px; color:#0284c7;">menu_book</span>${m.module_title}</td>
                  <td><strong>${m.duration_hours} hrs</strong></td>
                  <td style="font-size:12.5px; color:#475569; max-width:320px;">${m.learning_outcomes}</td>
                  <td><span class="badge badge-green">${m.status}</span></td>
                  <td>
                    ${m.materials_url ? `<a href="${m.materials_url}" target="_blank" class="btn btn-secondary btn-sm">PDF Link</a>` : `<span style="color:#94a3b8;">None</span>`}
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openAddModuleModal = function () {
  showModal('Publish Course Curriculum Module', `
    <form id="add-module-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Course Name *</label>
          <input type="text" id="am-course" class="form-control" value="Full Stack Digital Skills" required>
        </div>
        <div class="form-group">
          <label class="form-label">Module Duration (Hours) *</label>
          <input type="number" id="am-duration" class="form-control" placeholder="e.g. 15" required min="1">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Module Title *</label>
          <input type="text" id="am-title" class="form-control" placeholder="e.g. Module 4: Cloud Deployment & Docker Essentials" required>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Learning Outcomes & Competencies *</label>
          <textarea id="am-outcomes" class="form-control" required placeholder="What students will be able to demonstrate..."></textarea>
        </div>
        <div class="form-group full-width">
          <label class="form-label">Study Materials / PDF Link</label>
          <input type="url" id="am-url" class="form-control" placeholder="https://minds-trust.org/handbooks/module4.pdf">
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Publish Module</button>
      </div>
    </form>
  `);

  document.getElementById('add-module-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/trainer/course-modules', {
      method: 'POST',
      body: JSON.stringify({
        course_name: document.getElementById('am-course').value,
        module_title: document.getElementById('am-title').value,
        duration_hours: document.getElementById('am-duration').value,
        learning_outcomes: document.getElementById('am-outcomes').value,
        materials_url: document.getElementById('am-url').value
      })
    });
    closeModal();
    showToast(res.message);
    void renderTrainerCurriculumView(document.getElementById('portal-content-mount'));
  };
};

// Dedicated Assigned Events View for Trainer
async function renderTrainerEventsView(mount) {
  const res = await api('/api/trainer/dashboard');
  const events = res.events || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Assigned Programs & Cohorts</h1>
        <p class="page-header-desc">Review your scheduled courses, assigned classroom venues, and student counts.</p>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Event Code</th>
              <th>Program Title</th>
              <th>Start Date</th>
              <th>Completion Date</th>
              <th>Venue</th>
              <th>Students Enrolled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${events.length === 0 ? `<tr><td colspan="7" class="empty-state">No events assigned yet.</td></tr>` :
      events.map(ev => `
                <tr>
                  <td style="font-weight:800; color:#154d34;">${ev.event_code}</td>
                  <td style="font-weight:700;">${ev.title}</td>
                  <td>${ev.start_date}</td>
                  <td>${ev.last_date}</td>
                  <td>${ev.venue}</td>
                  <td><span class="badge badge-green">${ev.student_count || 0} Students</span></td>
                  <td><span class="badge ${ev.status === 'Completed' ? 'badge-green' : 'badge-blue'}">${ev.status}</span></td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Dedicated Faculty Profile Settings for Trainer
async function renderTrainerProfileSettingsView(mount) {
  const res = await api('/api/trainer/dashboard');
  const t = res.trainer;

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
        <h1 class="page-header-title">Faculty Profile & Security Settings</h1>
        <p class="page-header-desc">Update contact coordinates, academic specialization, and your login password.</p>
      </div>
    </div>

    <div class="card" style="max-width:640px;">
      <div class="card-body">
        <form id="trainer-profile-settings-form">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label">Full Name (Registered by Admin)</label>
              <input type="text" class="form-control" value="${t.full_name}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Trainer Code (Permanent)</label>
              <input type="text" class="form-control" value="${t.trainer_code}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Academic Specialization</label>
              <input type="text" id="tp-spec" class="form-control" value="${t.specialization || 'Full Stack Software Engineering'}">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="tel" id="tp-phone" class="form-control" value="${t.phone || ''}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="tp-email" class="form-control" value="${t.email}" required>
            </div>
            <div class="form-group full-width">
              <label class="form-label">Professional Bio / Academic Background</label>
              <textarea id="tp-bio" class="form-control" rows="2">${t.bio || 'Senior instructor specializing in enterprise software development and database engineering.'}</textarea>
            </div>

            <div class="form-group full-width" style="margin-top:10px; border-top:1px dashed #e2e8f0; padding-top:14px;">
              <div style="font-weight:800; font-size:13.5px; color:#154d34; margin-bottom:8px;">Change Password</div>
            </div>

            <div class="form-group">
              <label class="form-label">Current Password</label>
              <input type="password" id="tp-curr-pass" class="form-control" placeholder="Leave blank if not changing">
            </div>
            <div class="form-group">
              <label class="form-label">New Password</label>
              <input type="password" id="tp-new-pass" class="form-control" placeholder="New secure password">
            </div>
          </div>

          <div style="margin-top:24px; display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Save Profile Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('trainer-profile-settings-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/trainer/profile', {
      method: 'PUT',
      body: JSON.stringify({
        phone: document.getElementById('tp-phone').value,
        email: document.getElementById('tp-email').value,
        specialization: document.getElementById('tp-spec').value,
        bio: document.getElementById('tp-bio').value,
        current_password: document.getElementById('tp-curr-pass').value,
        new_password: document.getElementById('tp-new-pass').value
      })
    });
    showToast(res.message);
  };
}

// =========================================================================
// 6. TRAINER PORTAL DASHBOARD VIEW
// =========================================================================
async function renderTrainerDashboard(mount) {
  mount.innerHTML = `<div style="text-align:center; padding:40px;">Loading Trainer Cohorts & Students...</div>`;
  const res = await api('/api/trainer/dashboard');
  const t = res.trainer;
  const events = res.events || [];
  const students = res.students || [];

  mount.innerHTML = `
    <div class="page-header-row">
      <div>
          <h1 class="page-header-title" style="display:flex; align-items:center; gap:8px;">
            Welcome, ${t.full_name}
            <span class="material-icons-round" style="color:#7e22ce; font-size:28px;">co_present</span>
          </h1>
        <p class="page-header-desc">Trainer Code: <strong>${t.trainer_code}</strong> • MINDS TRUST Faculty</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card hero-card">
        <div class="stat-title">Assigned Students</div>
        <div class="stat-value">${students.length}</div>
        <div class="stat-footer-badge">Across Cohorts</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Assigned Events</div>
        <div class="stat-value">${events.length}</div>
        <div class="stat-footer-badge">Curriculum Schedule</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Student Evaluation & Attendance Grading</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Event / Cohort</th>
              <th>Attendance</th>
              <th>Completion Status</th>
              <th>Grade</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${students.length === 0 ? `<tr><td colspan="6" class="empty-state">No students assigned to your current cohorts.</td></tr>` :
      students.map(st => `
                <tr>
                  <td style="font-weight:700;">${st.full_name}<br><small style="color:#64748b;">${st.student_code}</small></td>
                  <td>${st.event_title}</td>
                  <td><span class="badge ${st.attendance_status === 'Present' ? 'badge-green' : 'badge-yellow'}">${st.attendance_status}</span></td>
                  <td><span class="badge ${st.completion_status === 'Completed' ? 'badge-green' : 'badge-blue'}">${st.completion_status}</span></td>
                  <td><strong>${st.marks_or_grade || 'A'}</strong></td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEvaluateStudentModal(${JSON.stringify(st).replaceAll('"', '&quot;')})">Evaluate / Grade</button>
                  </td>
                </tr>
              `).join('')
    }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openEvaluateStudentModal = function (st) {
  showModal(`Evaluate Student: ${st.full_name}`, `
    <form id="eval-student-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Attendance Status</label>
          <select id="es-att" class="form-control">
            <option value="Present" ${st.attendance_status === 'Present' ? 'selected' : ''}>Present</option>
            <option value="Absent" ${st.attendance_status === 'Absent' ? 'selected' : ''}>Absent</option>
            <option value="Excused" ${st.attendance_status === 'Excused' ? 'selected' : ''}>Excused</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Completion Status (Cert Eligible if Completed)</label>
          <select id="es-comp" class="form-control">
            <option value="Completed" ${st.completion_status === 'Completed' ? 'selected' : ''}>Completed (Eligible)</option>
            <option value="In Progress" ${st.completion_status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Incomplete" ${st.completion_status === 'Incomplete' ? 'selected' : ''}>Incomplete</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Grade / Performance Score</label>
          <input type="text" id="es-grade" class="form-control" value="${st.marks_or_grade || 'A'}">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Trainer Evaluation Remarks</label>
          <textarea id="es-remarks" class="form-control">${st.trainer_remarks || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Evaluation</button>
      </div>
    </form>
  `);

  document.getElementById('eval-student-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api(`/api/trainer/evaluate-student/${st.reg_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        attendance_status: document.getElementById('es-att').value,
        completion_status: document.getElementById('es-comp').value,
        marks_or_grade: document.getElementById('es-grade').value,
        trainer_remarks: document.getElementById('es-remarks').value
      })
    });
    closeModal();
    showToast(res.message);
    void renderTrainerDashboard(document.getElementById('portal-content-mount'));
  };
};

// =========================================================================
// 7. PRINTABLE OFFICIAL CERTIFICATE VIEW (Populating All Master Flow Parameters)
// Parameters: Student Name • Student Code • Program Name • Program Code • Certificate Number • Issue Date • Founder Signature • QR Verification Code
// =========================================================================
window.printOfficialCertificate = function (c) {
  const qrCodeText = c.qr_verification_code || `QR-MINDS-${c.certificate_no ? c.certificate_no.replaceAll('/', '-') : '2026'}`;
  const programName = c.program_name || c.event_title || 'Certificate of Excellence';
  const programCode = c.program_code || 'PRG-FSD-01';
  const founderSign = c.founder_signature || 'Dr. Ramesh Narayan (Founder & Managing Trustee)';

  showModal(`Official Certificate: ${c.certificate_no}`, `
    <div class="printable-area">
      <div style="border:12px double #154d34; padding:45px 35px; border-radius:24px; background:#ffffff; text-align:center; max-width:780px; margin:0 auto; font-family:'Plus Jakarta Sans', sans-serif; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.08);">
        
        <!-- Header Seals -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #e2e8f0; padding-bottom:14px;">
          <div style="display:flex; align-items:center; gap:12px; text-align:left;">
            <img src="/logo.svg" alt="Seal" style="width:56px; height:56px;">
            <div>
              <div style="font-size:18px; font-weight:900; color:#154d34; letter-spacing:-0.5px;">MINDS TRUST</div>
              <div style="font-size:10px; color:#64748b; font-weight:700; letter-spacing:0.8px;">CHARITABLE EDUCATIONAL FOUNDATION</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-block; background:#eaf5ee; border:1px solid #c2e2d0; color:#154d34; font-size:11px; font-weight:800; padding:4px 10px; border-radius:20px;">
              PROGRAM CODE: ${programCode}
            </div>
            <div style="font-size:11px; color:#64748b; margin-top:3px;">Serial: <strong>${c.certificate_no}</strong></div>
          </div>
        </div>

        <h3 style="font-size:12px; font-weight:800; letter-spacing:1.5px; color:#475569; text-transform:uppercase; margin-top:10px;">ENTERPRISE RESOURCE PLANNING • CERTIFICATE ENGINE</h3>
        <h1 style="font-size:28px; font-weight:900; color:#154d34; margin:8px 0 16px; letter-spacing:-0.5px;">Certificate of Merit & Completion</h1>
        
        <p style="font-size:14px; color:#64748b; margin-top:14px;">This is proudly presented and certified to</p>
        <div style="font-size:26px; font-weight:900; color:#0f172a; margin:6px 0; border-bottom:2px solid #154d34; display:inline-block; padding:0 36px 4px;">
          ${c.student_name}
        </div>
        <p style="font-size:13px; color:#475569; font-weight:700; margin-top:4px;">Unique Student Code: <span style="color:#154d34;">${c.student_code}</span></p>

        <p style="font-size:14.5px; color:#334155; line-height:1.7; max-width:620px; margin:20px auto 26px;">
          for demonstrating academic dedication, high attendance compliance, and successfully completing all curriculum competencies for the certified program
          <br><strong style="font-size:16px; color:#0f172a;">${programName}</strong>
          <br><span style="font-size:12.5px; color:#64748b;">(Academic Program Code: <strong>${programCode}</strong> • Schedule: ${c.event_start || '2026-01-15'} to ${c.event_completion || c.issue_date})</span>
        </p>

        <!-- Master Flow: QR Verification Code & Founder Signature Display -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; align-items:flex-end; padding-top:24px; border-top:1px dashed #cbd5e1; font-size:11.5px; text-align:left;">
          
          <!-- Column 1: Certificate Audit Details -->
          <div>
            <div><strong>Certificate Number:</strong><br><span style="color:#154d34; font-weight:800;">${c.certificate_no}</span></div>
            <div style="margin-top:6px;"><strong>Issue Date:</strong><br>${c.issue_date}</div>
            <div style="color:#15803d; font-weight:700; margin-top:6px;">✓ Verified Master Record</div>
          </div>

          <!-- Column 2: QR Verification Code -->
          <div style="text-align:center;">
            <div style="background:#ffffff; border:1px solid #cbd5e1; padding:8px 10px; border-radius:10px; display:inline-block; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
              <div style="font-family:monospace; font-size:16px; font-weight:900; letter-spacing:3px; color:#0f172a;">[QR-CODE]</div>
              <div style="font-size:9.5px; color:#64748b; margin-top:3px; font-weight:700;">${qrCodeText}</div>
            </div>
            <div style="font-size:10px; color:#64748b; margin-top:4px;">Scan or Query Archive to Verify</div>
          </div>

          <!-- Column 3: Founder Signature & Approval -->
          <div style="text-align:right;">
            <div style="font-family:'Brush Script MT', cursive, sans-serif; font-size:22px; color:#154d34; margin-bottom:2px;">
              Ramesh Narayan
            </div>
            <div style="border-top:1px solid #0f172a; display:inline-block; min-width:180px; padding-top:4px;">
              <div style="font-weight:900; color:#0f172a; font-size:12px;">Founder Approval</div>
              <div style="color:#475569; font-size:10px;">${founderSign}</div>
              <div style="color:#15803d; font-size:10px; font-weight:800; margin-top:2px;">Status: ${c.approval_status || 'Approved'}</div>
            </div>
          </div>

        </div>

      </div>
    </div>
    <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="window.print()"><span class="material-icons-round" style="font-size:16px; vertical-align:middle; margin-right:4px;">print</span> Print / Save PDF</button>
    </div>
  `);
};

// -------------------------------------------------------------
// SELF-REGISTRATION MODALS
// -------------------------------------------------------------
window.openStudentRegistrationModal = function () {
  showModal('Student Self-Registration', `
    <form id="reg-student-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" id="rs-name" class="form-control" required placeholder="Full Name">
        </div>
        <div class="form-group">
          <label class="form-label">Choose User ID *</label>
          <input type="text" id="rs-uid" class="form-control" required placeholder="Desired username">
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input type="email" id="rs-email" class="form-control" required placeholder="email@domain.com">
        </div>
        <div class="form-group">
          <label class="form-label">Mobile Number</label>
          <input type="tel" id="rs-phone" class="form-control" placeholder="+91 ...">
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input type="password" id="rs-pass" class="form-control" required placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" id="rs-dob" class="form-control" value="2005-01-01">
        </div>
        <div class="form-group full-width">
          <label class="form-label">Program of Interest *</label>
          <input type="text" id="rs-prog" class="form-control" required placeholder="e.g. Healthcare Assistant / Web Engineering">
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Complete Registration</button>
      </div>
    </form>
  `);

  document.getElementById('reg-student-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/auth/register-student', {
      method: 'POST',
      body: JSON.stringify({
        full_name: document.getElementById('rs-name').value,
        user_id: document.getElementById('rs-uid').value,
        email: document.getElementById('rs-email').value,
        phone: document.getElementById('rs-phone').value,
        password: document.getElementById('rs-pass').value,
        dob: document.getElementById('rs-dob').value,
        enrolled_program: document.getElementById('rs-prog').value
      })
    });
    closeModal();
    showToast(res.message);
  };
};

window.openDonorRegistrationModal = function () {
  showModal('Donor Self-Registration', `
    <form id="reg-donor-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Full Name / Corporate Entity *</label>
          <input type="text" id="rd-name" class="form-control" required placeholder="Donor Name">
        </div>
        <div class="form-group">
          <label class="form-label">Choose User ID *</label>
          <input type="text" id="rd-uid" class="form-control" required placeholder="Desired username">
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input type="email" id="rd-email" class="form-control" required placeholder="donor@domain.com">
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone *</label>
          <input type="tel" id="rd-phone" class="form-control" required placeholder="+91 ...">
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input type="password" id="rd-pass" class="form-control" required placeholder="••••••••">
        </div>
        <div class="form-group">
          <label class="form-label">Donor Category</label>
          <select id="rd-cat" class="form-control">
            <option value="Individual">Individual Benefactor</option>
            <option value="Corporate">Corporate / CSR</option>
            <option value="Foundation">Philanthropic Foundation</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">PAN Number (for 80G Tax Exemption)</label>
          <input type="text" id="rd-pan" class="form-control" placeholder="ABCDE1234F" style="text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label class="form-label">Date of Birth / Inception Date</label>
          <input type="date" id="rd-dob" class="form-control" value="1980-01-01">
        </div>
      </div>
      <div class="modal-footer" style="padding-top:20px; margin:20px -24px -24px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Donor Account</button>
      </div>
    </form>
  `);

  document.getElementById('reg-donor-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await api('/api/auth/register-donor', {
      method: 'POST',
      body: JSON.stringify({
        full_name: document.getElementById('rd-name').value,
        user_id: document.getElementById('rd-uid').value,
        email: document.getElementById('rd-email').value,
        phone: document.getElementById('rd-phone').value,
        password: document.getElementById('rd-pass').value,
        donor_category: document.getElementById('rd-cat').value,
        pan_number: document.getElementById('rd-pan').value,
        dob: document.getElementById('rd-dob').value
      })
    });
    closeModal();
    showToast(res.message);
  };
};

function showModal(title, html) {
  let m = document.getElementById('erp-modal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'erp-modal';
    m.className = 'modal-overlay';
    document.body.appendChild(m);
  }
  m.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="close-btn" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${html}</div>
    </div>
  `;
}

window.closeModal = function () {
  const m = document.getElementById('erp-modal');
  if (m) m.remove();
};

function exportTableToCSV(tableId, filename = 'export.csv') {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = table.querySelectorAll('tr');
  const csv = [];
  for (const row of rows) {
    const cols = row.querySelectorAll('th, td');
    const rowData = [];
    for (const col of cols) {
      let text = col.innerText.replaceAll('"', '""').trim();
      rowData.push(`"${text}"`);
    }
    if (rowData.length > 0) csv.push(rowData.join(','));
  }
  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${filename}`);
}

// Google-Style Global Live Autocomplete Search Handler across all ERP modules
let globalSearchTimeout = null;
let currentSearchResults = [];
let searchSelectedIndex = -1;

function highlightMatch(text, query) {
  if (!text || !query) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark style="background:#fef08a; color:#854d0e; padding:0 2px; border-radius:3px; font-weight:800;">$1</mark>');
}

function moveSearchSelection(delta, items) {
  searchSelectedIndex = (searchSelectedIndex + delta + items.length) % items.length;
  updateSearchSelection(items);
}

function selectCurrentSearchResult() {
  if (searchSelectedIndex >= 0 && searchSelectedIndex < currentSearchResults.length) {
    const r = currentSearchResults[searchSelectedIndex];
    selectGlobalSearchResult(r.view, r.type, r.id, encodeURIComponent(r.title));
  }
}

function isSearchDropdownActive(dropdown) {
  return dropdown && dropdown.style.display !== 'none' && currentSearchResults.length > 0;
}

function handleSearchNavKey(key, items) {
  if (key === 'ArrowDown') {
    moveSearchSelection(1, items);
    return true;
  }
  if (key === 'ArrowUp') {
    moveSearchSelection(-1, items);
    return true;
  }
  return false;
}

window.handleGlobalSearchKeydown = function (e) {
  const dropdown = document.getElementById('global-search-dropdown');
  if (!isSearchDropdownActive(dropdown)) return;

  const items = dropdown.querySelectorAll('.search-result-item');
  if (handleSearchNavKey(e.key, items)) {
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    selectCurrentSearchResult();
    return;
  }
  if (e.key === 'Escape') {
    dropdown.style.display = 'none';
  }
};

function updateSearchSelection(items) {
  items.forEach((item, idx) => {
    if (idx === searchSelectedIndex) {
      item.style.background = '#f1f5f9';
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.background = 'transparent';
    }
  });
}

window.handleGlobalSearch = function (query) {
  clearTimeout(globalSearchTimeout);
  const dropdown = document.getElementById('global-search-dropdown');
  if (!dropdown) return;

  const q = (query || '').trim();
  searchSelectedIndex = -1;
  currentSearchResults = [];

  if (!q) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }

  dropdown.style.display = 'block';
  dropdown.innerHTML = `
    <div style="padding:16px; text-align:center; font-size:13px; color:#64748b; display:flex; align-items:center; justify-content:center; gap:8px;">
      <span class="material-icons-round" style="animation:spin 1s linear infinite; font-size:20px; color:#154d34;">sync</span>
      <span>Searching for <strong>"${q}"</strong>...</span>
    </div>
  `;

  globalSearchTimeout = setTimeout(async () => {
    try {
      const res = await api(`/api/admin/global-search?q=${encodeURIComponent(q)}`);
      const results = res.results || [];
      currentSearchResults = results;

      if (results.length === 0) {
        dropdown.innerHTML = `
          <div style="padding:24px 20px; text-align:center; color:#64748b; font-size:13px;">
            <span class="material-icons-round" style="font-size:36px; color:#cbd5e1; margin-bottom:6px; display:block;">search_off</span>
            <div style="font-weight:700; color:#334155; margin-bottom:4px; font-size:14px;">No matching results</div>
            <div>We couldn't find any person, student, donor, or event matching "<strong>${q}</strong>".</div>
          </div>
        `;
        return;
      }

      dropdown.innerHTML = `
        <div style="padding:10px 16px 8px; font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; background:#fafafa; border-top-left-radius:18px; border-top-right-radius:18px;">
          <span style="display:flex; align-items:center; gap:6px;">
            <span class="material-icons-round" style="font-size:15px; color:#154d34;">manage_search</span>
            Matching People & Records (${results.length})
          </span>
          <span style="font-size:11px; color:#94a3b8; cursor:pointer;" onclick="document.getElementById('global-search-dropdown').style.display='none'">✕ Close (Esc)</span>
        </div>
        <div style="display:flex; flex-direction:column; padding:6px 0;">
          ${results.map((r, idx) => `
            <div class="search-result-item" style="padding:11px 16px; border-bottom:1px solid #f8fafc; cursor:pointer; display:flex; align-items:center; gap:12px; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="selectGlobalSearchResult('${r.view || ''}', '${r.type || ''}', ${r.id}, '${escapeJsArg(r.title)}')">
              <span class="material-icons-round" style="color:#154d34; font-size:20px; padding:8px; background:#eaf5ee; border-radius:10px; flex-shrink:0;">${r.icon || 'person'}</span>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:800; font-size:13.5px; color:#0f172a;">${highlightMatch(r.title, q)}</span>
                  <span class="badge" style="font-size:10px; padding:2px 7px; background:#e2e8f0; color:#334155; font-weight:700;">${r.type}</span>
                </div>
                <div style="font-size:11.5px; color:#64748b; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${highlightMatch(r.subtitle, q)}
                </div>
              </div>
              <span class="material-icons-round" style="font-size:18px; color:#cbd5e1; flex-shrink:0;">arrow_forward</span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      dropdown.innerHTML = `<div style="padding:14px; color:#ef4444; font-size:12px; text-align:center;">Search error: ${err.message}</div>`;
    }
  }, 120);
};

window.selectGlobalSearchResult = function (view, type, id, titleEncoded) {
  const title = decodeURIComponent(titleEncoded);
  const dropdown = document.getElementById('global-search-dropdown');
  const searchInput = document.getElementById('global-search-input');
  if (dropdown) dropdown.style.display = 'none';
  if (searchInput) searchInput.value = title;

  if (view) {
    if (view === 'students') {
      state.studentSearch = title.split('(')[0].trim();
    } else if (view === 'donors') {
      state.donorSearch = title.split('(')[0].trim();
    }
    switchView(view);
  }
};

// Close global search dropdown when clicking outside
document.addEventListener('click', (e) => {
  const box = document.querySelector('.topbar-search-box');
  const dropdown = document.getElementById('global-search-dropdown');
  if (dropdown && !box?.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});


// =========================================================================
// 8. HIERARCHY-BASED STUDENT/USER MANAGEMENT & TASK GOVERNANCE
// =========================================================================

// =========================================================================
// 8.1 ADMIN TASK MANAGEMENT & EMPLOYEE WORKFLOW MODULE
// =========================================================================

async function renderAdminHierarchyView(mount) {
  mount.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">Loading Admin Task Workflow...</div>';
  try {
    const [usersRes, tasksRes] = await Promise.all([
      api('/api/admin/users-hierarchy'),
      api('/api/admin/tasks')
    ]);

    const allUsers = usersRes.users || [];
    const allTasks = tasksRes.tasks || [];

    // Only Managers, Team Leaders, and Staff are operational employees for task management
    const allowedTiers = ['Manager', 'Team Leader', 'Staff'];
    const roleOrder = ['Manager', 'Team Leader', 'Staff'];

    const grouped = {};
    roleOrder.forEach(r => { grouped[r] = []; });

    allUsers.forEach(u => {
      const hRole = u.hierarchy_role;
      if (allowedTiers.includes(hRole)) {
        grouped[hRole].push(u);
      }
    });

    // Employees to display: all users belonging to Manager, Team Leader, or Staff
    const employees = allUsers.filter(u => allowedTiers.includes(u.hierarchy_role));

    // Map each employee with their active tasks and task status overview
    const employeesWithTasks = employees.map(u => {
      const userTasks = allTasks.filter(t => t.assigned_to_user_id === u.id);
      const activeTasks = userTasks.filter(t => {
        const s = mapTaskStatus(t.status, t.deadline);
        return s === 'In Progress' || s === 'Overdue';
      });

      // Determine composite status for employee
      let currentStatus = 'Not Assigned';
      if (userTasks.length > 0) {
        const hasOverdue = userTasks.some(t => mapTaskStatus(t.status, t.deadline) === 'Overdue');
        const hasInProgress = userTasks.some(t => mapTaskStatus(t.status, t.deadline) === 'In Progress');
        const allCompleted = userTasks.every(t => mapTaskStatus(t.status, t.deadline) === 'Completed');

        if (hasOverdue) {
          currentStatus = 'Overdue';
        } else if (hasInProgress) {
          currentStatus = 'In Progress';
        } else if (allCompleted) {
          currentStatus = 'Completed';
        }
      }

      return {
        ...u,
        allUserTasks: userTasks,
        activeTasksList: activeTasks,
        activeTasksCount: activeTasks.length,
        currentStatus
      };
    });

    mount.innerHTML = `
      <div class="page-header-row" style="margin-bottom:16px;">
        <div>
          <h1 class="page-header-title">Admin Task Workflow</h1>
          <p class="page-header-desc">Centralized monitoring of employee task assignments, deadlines, completion rates, and audit logs.</p>
        </div>
      </div>

      <!-- Hierarchy Tiers: Only Manager, Team Leader, Staff -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom:24px;">
        ${roleOrder.map(r => `
          <div style="background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; padding:16px 18px; border-left:4px solid ${getRoleColor(r)}; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">${r} Tier</div>
            <div style="font-size:24px; font-weight:800; color:#0f172a; margin-top:6px;">${grouped[r]?.length || 0}</div>
            <div style="font-size:11.5px; color:#94a3b8; margin-top:3px;">Operational Team Members</div>
          </div>
        `).join('')}
      </div>

      <!-- Employee Information Table -->
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="color:#154d34; font-size:20px;">badge</span>
            Assigned Employees & Task Performance Overview
          </h3>
          <span class="badge badge-green">${employeesWithTasks.length} Active Employees</span>
        </div>
        <div class="table-responsive">
          <table class="data-table" style="min-width:1000px; width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                <th style="padding:14px 18px; min-width:230px;">User Name</th>
                <th style="padding:14px 18px; width:140px;">Hierarchy Role</th>
                <th style="padding:14px 18px; width:120px;">Portal Type</th>
                <th style="padding:14px 18px; min-width:180px;">Reporting To</th>
                <th style="padding:14px 18px; width:130px; text-align:center;">Active Tasks</th>
                <th style="padding:14px 18px; width:140px; text-align:center;">Status</th>
                <th style="padding:14px 18px; width:120px; text-align:center;">History</th>
              </tr>
            </thead>
            <tbody>
              ${employeesWithTasks.map(u => {
                const manager = allUsers.find(m => m.id === u.reports_to_user_id);
                
                // Status badge styling
                let statusBadgeCls = 'badge-gray';
                let statusStyle = 'background:#f1f5f9; color:#64748b;';
                if (u.currentStatus === 'Completed') {
                  statusBadgeCls = 'badge-green';
                  statusStyle = '';
                } else if (u.currentStatus === 'Overdue') {
                  statusBadgeCls = 'badge-red';
                  statusStyle = 'background:#fee2e2; color:#991b1b;';
                } else if (u.currentStatus === 'In Progress') {
                  statusBadgeCls = 'badge-blue';
                  statusStyle = '';
                }

                return `
                  <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;">
                    <!-- 1. User Name (Clickable to view full employee task history) -->
                    <td style="padding:14px 18px; vertical-align:middle;">
                      <div 
                        onclick="void openEmployeeTaskHistoryModal(${u.id})" 
                        style="font-weight:800; color:#0f172a; font-size:14px; cursor:pointer;"
                        onmouseover="this.style.color='#154d34'; this.style.textDecoration='underline';" 
                        onmouseout="this.style.color='#0f172a'; this.style.textDecoration='none';"
                        title="Click to view complete employee task history"
                      >
                        ${u.full_name}
                      </div>
                      <div style="font-size:11.5px; color:#64748b; margin-top:2px;">
                        User ID: <strong>${u.user_id}</strong> • ${u.email}
                      </div>
                    </td>

                    <!-- 2. Hierarchy Role -->
                    <td style="padding:14px 18px; vertical-align:middle;">
                      <span class="badge" style="background:${getRoleBg(u.hierarchy_role)}; color:${getRoleColor(u.hierarchy_role)}; font-weight:700; padding:4px 10px;">
                        ${u.hierarchy_role}
                      </span>
                    </td>

                    <!-- 3. Portal Type -->
                    <td style="padding:14px 18px; vertical-align:middle;">
                      <span class="badge" style="background:#f1f5f9; color:#475569;">${u.portal_type}</span>
                    </td>

                    <!-- 4. Reporting To -->
                    <td style="padding:14px 18px; vertical-align:middle; font-size:12.5px; color:#334155;">
                      ${manager ? `${manager.full_name} <span style="font-size:10.5px; color:#64748b;">(${manager.hierarchy_role})</span>` : '<em>Admin / Managing Trustee</em>'}
                    </td>

                    <!-- 5. Active Tasks (Clickable count to view specific active tasks) -->
                    <td style="padding:14px 18px; vertical-align:middle; text-align:center;">
                      ${u.activeTasksCount > 0 ? `
                        <button 
                          class="btn btn-sm" 
                          onclick="void openEmployeeActiveTasksModal(${u.id})" 
                          style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-weight:800; padding:4px 12px; border-radius:12px; cursor:pointer;"
                          title="Click to view ${u.activeTasksCount} active tasks for ${u.full_name}"
                        >
                          ${u.activeTasksCount} Active
                        </button>
                      ` : `
                        <span style="font-size:12px; color:#94a3b8; font-weight:500;">0 Tasks</span>
                      `}
                    </td>

                    <!-- 6. Status Column -->
                    <td style="padding:14px 18px; vertical-align:middle; text-align:center;">
                      <span class="badge ${statusBadgeCls}" style="${statusStyle} padding:4px 10px; font-weight:700; font-size:11.5px;">
                        ${u.currentStatus}
                      </span>
                    </td>

                    <!-- 7. History Column (Replaced Actions) -->
                    <td style="padding:14px 18px; vertical-align:middle; text-align:center;">
                      <button 
                        class="btn btn-secondary btn-sm" 
                        onclick="void openEmployeeTaskHistoryModal(${u.id})" 
                        style="padding:5px 12px; font-size:12px; white-space:nowrap;"
                        title="View complete task & performance history"
                      >
                        <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:2px;">history</span> History
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div style="padding:40px; text-align:center; color:#dc2626;">Failed to load task management: ${err.message}</div>`;
  }
}

// Modal: Display specific active tasks for a chosen employee
window.openEmployeeActiveTasksModal = async function (userId) {
  const [usersRes, tasksRes] = await Promise.all([
    api('/api/admin/users-hierarchy'),
    api('/api/admin/tasks')
  ]);
  const user = (usersRes.users || []).find(u => u.id === userId);
  if (!user) return;

  const allTasks = tasksRes.tasks || [];
  const activeTasks = allTasks.filter(t => {
    if (t.assigned_to_user_id !== userId) return false;
    const s = mapTaskStatus(t.status, t.deadline);
    return s === 'In Progress' || s === 'Overdue';
  });

  showModal(`Active Tasks: ${user.full_name} (${user.hierarchy_role})`, `
    <div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
        <div style="font-weight:700; font-size:14px; color:#0f172a;">${user.full_name}</div>
        <div style="font-size:12px; color:#64748b; margin-top:2px;">User ID: ${user.user_id} • Hierarchy Role: <strong>${user.hierarchy_role}</strong></div>
      </div>

      ${activeTasks.length === 0 ? `
        <div style="padding:30px; text-align:center; color:#64748b; font-size:13px;">No active tasks currently assigned.</div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; padding-right:4px;">
          ${activeTasks.map(t => {
            const status = mapTaskStatus(t.status, t.deadline);
            const isOverdue = status === 'Overdue';
            return `
              <div style="background:#ffffff; border:1px solid ${isOverdue ? '#fca5a5' : '#e2e8f0'}; border-left:4px solid ${isOverdue ? '#dc2626' : '#0284c7'}; border-radius:10px; padding:12px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                  <div>
                    <div style="font-weight:700; font-size:13.5px; color:#0f172a;">${t.title}</div>
                    <div style="font-size:11.5px; color:#64748b; margin-top:3px;">
                      Code: <strong>${t.task_code}</strong> • Type: ${t.task_type || 'General'} • Priority: <span class="badge ${getPriorityBadgeClass(t.priority)}" style="font-size:10px; padding:1px 6px;">${t.priority}</span>
                    </div>
                  </div>
                  <span class="badge ${getTaskStatusBadgeClass(status)}" style="padding:3px 8px; font-size:11px;">
                    ${status}
                  </span>
                </div>
                <div style="margin-top:8px; font-size:12px; color:#334155; display:flex; justify-content:space-between;">
                  <span>Assigned: ${formatDisplayDate(t.start_date || t.created_at)}</span>
                  <span style="font-weight:700; color:${isOverdue ? '#dc2626' : '#334155'};">Deadline: ${formatDisplayDate(t.deadline)}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
      <div style="display:flex; justify-content:flex-end; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:12px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

// Modal: Complete Employee Task Performance & Audit History
window.openEmployeeTaskHistoryModal = async function (userId) {
  const [usersRes, tasksRes] = await Promise.all([
    api('/api/admin/users-hierarchy'),
    api('/api/admin/tasks')
  ]);
  const user = (usersRes.users || []).find(u => u.id === userId);
  if (!user) return;

  const allTasks = tasksRes.tasks || [];
  
  // All tasks ever assigned to this user
  const userTasks = allTasks.filter(t => t.assigned_to_user_id === userId);
  
  // Task statistics
  const totalAssigned = userTasks.length;
  let completedWithinDeadline = 0;
  let completedAfterDeadline = 0;
  let overdueTasksCount = 0;
  let reassignedByAdminCount = 0;

  userTasks.forEach(t => {
    const s = mapTaskStatus(t.status, t.deadline);
    if (s === 'Completed') {
      const dead = new Date(t.deadline);
      const subDate = t.submission_date ? new Date(t.submission_date) : new Date(t.updated_at);
      if (!isNaN(dead.getTime()) && !isNaN(subDate.getTime()) && subDate > dead) {
        completedAfterDeadline++;
      } else {
        completedWithinDeadline++;
      }
    } else if (s === 'Overdue') {
      overdueTasksCount++;
    }

    if (t.status === 'Reassigned' || (t.instructions && t.instructions.includes('Reassigned'))) {
      reassignedByAdminCount++;
    }
  });

  showModal(`Employee Task History: ${user.full_name}`, `
    <div>
      <!-- Employee Profile Summary -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:800; font-size:16px; color:#0f172a;">${user.full_name}</div>
            <div style="font-size:12px; color:#64748b; margin-top:2px;">
              Role: <strong>${user.hierarchy_role}</strong> • User ID: <strong>${user.user_id}</strong> • Email: ${user.email}
            </div>
          </div>
          <span class="badge" style="background:${getRoleBg(user.hierarchy_role)}; color:${getRoleColor(user.hierarchy_role)}; font-weight:700; padding:4px 12px; font-size:12px;">
            ${user.hierarchy_role} Tier
          </span>
        </div>
      </div>

      <!-- Performance Analytics Cards -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom:20px;">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:11px; color:#64748b; font-weight:700;">TOTAL ASSIGNED</div>
          <div style="font-size:20px; font-weight:800; color:#0f172a; margin-top:4px;">${totalAssigned}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center; border-top:3px solid #16a34a;">
          <div style="font-size:11px; color:#166534; font-weight:700;">ON-TIME COMPLETED</div>
          <div style="font-size:20px; font-weight:800; color:#16a34a; margin-top:4px;">${completedWithinDeadline}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center; border-top:3px solid #ca8a04;">
          <div style="font-size:11px; color:#854d0e; font-weight:700;">LATE COMPLETED</div>
          <div style="font-size:20px; font-weight:800; color:#ca8a04; margin-top:4px;">${completedAfterDeadline}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center; border-top:3px solid #dc2626;">
          <div style="font-size:11px; color:#991b1b; font-weight:700;">OVERDUE</div>
          <div style="font-size:20px; font-weight:800; color:#dc2626; margin-top:4px;">${overdueTasksCount}</div>
        </div>
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:12px; text-align:center; border-top:3px solid #7c3aed;">
          <div style="font-size:11px; color:#5b21b6; font-weight:700;">REASSIGNED / SWITCHED</div>
          <div style="font-size:20px; font-weight:800; color:#7c3aed; margin-top:4px;">${reassignedByAdminCount}</div>
        </div>
      </div>

      <!-- Historical Assignments List -->
      <div style="font-size:13px; font-weight:700; color:#0f172a; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
        <span class="material-icons-round" style="font-size:18px; color:#154d34;">history_edu</span>
        Task History & Completion Records
      </div>

      ${userTasks.length === 0 ? `
        <div style="padding:24px; text-align:center; color:#64748b; font-size:12.5px; background:#f8fafc; border-radius:8px;">No task assignment history recorded for this employee.</div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto; padding-right:4px;">
          ${userTasks.map(t => {
            const status = mapTaskStatus(t.status, t.deadline);
            return `
              <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:700; font-size:13px; color:#0f172a;">${t.title}</span>
                  <span class="badge ${getTaskStatusBadgeClass(status)}" style="padding:2px 8px; font-size:11px;">${status}</span>
                </div>
                <div style="font-size:11.5px; color:#64748b; margin-top:4px;">
                  Code: <strong>${t.task_code}</strong> • Assigned: ${formatDisplayDate(t.start_date || t.created_at)} • Deadline: ${formatDisplayDate(t.deadline)}
                </div>
                ${t.instructions ? `<div style="font-size:11px; color:#475569; margin-top:4px; font-style:italic;">Instructions: ${t.instructions}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `}

      <div style="display:flex; justify-content:flex-end; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:12px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

function getRoleColor(r) {
  if (r === 'Admin') return '#154d34';
  if (r === 'Manager') return '#0284c7';
  if (r === 'Team Leader') return '#7c3aed';
  if (r === 'Staff') return '#0d9488';
  if (r === 'Student') return '#d97706';
  if (r === 'Donor') return '#ea580c';
  return '#475569';
}

function getRoleBg(r) {
  if (r === 'Admin') return '#eaf5ee';
  if (r === 'Manager') return '#e0f2fe';
  if (r === 'Team Leader') return '#f3e8ff';
  if (r === 'Staff') return '#ccfbf1';
  if (r === 'Student') return '#fef3c7';
  if (r === 'Donor') return '#ffedd5';
  return '#f1f5f9';
}

function getPriorityBadgeClass(p) {
  if (p === 'Urgent') return 'badge-red';
  if (p === 'High') return 'badge-yellow';
  if (p === 'Medium') return 'badge-blue';
  return '';
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function mapTaskStatus(status, deadline) {
  if (status === 'Approved' || status === 'Completed') return 'Completed';
  if (status === 'Revision Required' || status === 'Rejected') return 'Overdue';
  if (deadline) {
    const dead = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isNaN(dead.getTime()) && dead < today && status !== 'Completed' && status !== 'Approved') {
      return 'Overdue';
    }
  }
  return 'In Progress';
}

function getTaskStatusBadgeClass(s) {
  if (s === 'Completed') return 'badge-green';
  if (s === 'Overdue') return 'badge-red';
  return 'badge-blue';
}

// 8.2 Admin Task Management & Minimal Workflow View
async function renderAdminTasksView(mount) {
  mount.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">Loading Employee Management...</div>';
  try {
    const tasksRes = await api('/api/admin/tasks');
    const rawTasks = tasksRes.tasks || [];

    // Map each task to the 3 canonical statuses: In Progress, Completed, Overdue
    const tasks = rawTasks.map(t => {
      const simplifiedStatus = mapTaskStatus(t.status, t.deadline);
      return {
        ...t,
        display_status: simplifiedStatus,
        formatted_assigned_date: formatDisplayDate(t.start_date || t.created_at),
        formatted_deadline: formatDisplayDate(t.deadline)
      };
    });

    const filterStatus = state.taskFilterStatus || 'ALL';
    const search = (state.taskSearch || '').trim().toLowerCase();

    // Calculate Middle Section: Overall Task Summary Counts
    const overallTaskCount = tasks.length;
    const inProgressCount = tasks.filter(t => t.display_status === 'In Progress').length;
    const completedCount = tasks.filter(t => t.display_status === 'Completed').length;
    const overdueCount = tasks.filter(t => t.display_status === 'Overdue').length;

    // Filter tasks based on Search and Status Filter
    const filtered = tasks.filter(t => {
      if (filterStatus !== 'ALL' && t.display_status !== filterStatus) return false;
      if (search) {
        const text = `${t.title} ${t.assigned_to_name} ${t.formatted_assigned_date} ${t.display_status}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    mount.innerHTML = `
      <!-- TOP: Heading Section -->
      <div class="page-header-row" style="margin-bottom:12px;">
        <div>
          <h1 class="page-header-title">Employee Management</h1>
          <p class="page-header-desc">Manage, track, and review hierarchy-assigned tasks.</p>
        </div>
        <div class="page-actions" style="display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="void openCreateTaskModal()">
            <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">add_task</span> Create & Assign Task
          </button>
        </div>
      </div>

      <!-- TOP: Modern Rounded Search Bar directly under heading -->
      <div style="margin: 12px 0 20px 0;">
        <div style="position:relative; width:100%; max-width:540px;">
          <span class="material-icons-round" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:22px; color:#64748b; pointer-events:none;">search</span>
          <input 
            type="text" 
            id="admin-task-search-input"
            class="form-control" 
            style="padding-left:44px; padding-right:${state.taskSearch ? '40px' : '16px'}; height:44px; border-radius:24px; font-size:14px; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.05); width:100%;" 
            placeholder="Search assigned tasks..." 
            value="${state.taskSearch || ''}" 
            oninput="state.taskSearch=this.value; void renderAdminTasksView(document.getElementById('portal-content-mount'));"
          >
          ${state.taskSearch ? `
            <button 
              type="button" 
              onclick="state.taskSearch=''; void renderAdminTasksView(document.getElementById('portal-content-mount'));" 
              style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px; padding:0; display:flex; align-items:center;"
              title="Clear search"
            >
              <span class="material-icons-round" style="font-size:20px;">close</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- MIDDLE: Overall Task Summary Section (Overall Task, In Progress, Completed, Overdue) -->
      <div class="stats-grid" style="margin-bottom:20px;">
        <div class="stat-card hero-card" style="cursor:pointer;" onclick="state.taskFilterStatus='ALL'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
          <div class="stat-title">Overall Task</div>
          <div class="stat-value">${overallTaskCount}</div>
          <div class="stat-footer-badge" style="background:#e0f2fe; color:#0369a1;">All Assigned Records</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="state.taskFilterStatus='In Progress'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
          <div class="stat-title">In Progress</div>
          <div class="stat-value" style="color:#0284c7;">${inProgressCount}</div>
          <div class="stat-footer-badge" style="background:#e0f2fe; color:#0284c7;">Active & Under Review</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="state.taskFilterStatus='Completed'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
          <div class="stat-title">Completed</div>
          <div class="stat-value" style="color:#16a34a;">${completedCount}</div>
          <div class="stat-footer-badge" style="background:#dcfce7; color:#166534;">Finalized Tasks</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="state.taskFilterStatus='Overdue'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
          <div class="stat-title">Overdue</div>
          <div class="stat-value" style="color:#dc2626;">${overdueCount}</div>
          <div class="stat-footer-badge" style="background:#fee2e2; color:#991b1b;">Past Deadline / Revisions</div>
        </div>
      </div>

      <!-- Status Filter Tabs -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px;">
          <button class="btn ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:20px; padding:5px 14px; font-size:12.5px;" onclick="state.taskFilterStatus='ALL'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
            All (${tasks.length})
          </button>
          <button class="btn ${filterStatus === 'In Progress' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:20px; padding:5px 14px; font-size:12.5px;" onclick="state.taskFilterStatus='In Progress'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
            In Progress (${inProgressCount})
          </button>
          <button class="btn ${filterStatus === 'Completed' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:20px; padding:5px 14px; font-size:12.5px;" onclick="state.taskFilterStatus='Completed'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
            Completed (${completedCount})
          </button>
          <button class="btn ${filterStatus === 'Overdue' ? 'btn-primary' : 'btn-secondary'}" style="border-radius:20px; padding:5px 14px; font-size:12.5px;" onclick="state.taskFilterStatus='Overdue'; void renderAdminTasksView(document.getElementById('portal-content-mount'));">
            Overdue (${overdueCount})
          </button>
        </div>
        <div style="font-size:12px; color:#64748b;">
          Showing <strong>${filtered.length}</strong> of ${tasks.length} tasks
        </div>
      </div>

      <!-- BOTTOM: 6-Column Task Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                <th style="width:70px; padding:14px 18px; text-align:center;">S.No</th>
                <th style="min-width:280px; padding:14px 18px;">Task Assigned</th>
                <th style="width:170px; padding:14px 18px;">Assigned Date</th>
                <th style="width:170px; padding:14px 18px;">Deadline</th>
                <th style="width:140px; padding:14px 18px; text-align:center;">Status</th>
                <th style="width:120px; padding:14px 18px; text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:48px 20px; color:#64748b;">
                    <span class="material-icons-round" style="font-size:36px; color:#cbd5e1; display:block; margin-bottom:8px;">search_off</span>
                    No tasks found matching your criteria.
                  </td>
                </tr>
              ` :
              filtered.map((t, idx) => `
                <tr style="border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;">
                  <td style="padding:14px 18px; text-align:center; font-weight:700; color:#64748b;">
                    ${idx + 1}
                  </td>
                  <td style="padding:14px 18px; vertical-align:middle;">
                    <div 
                      onclick="void openViewTaskHistoryModal(${t.id})" 
                      style="font-weight:700; color:#0f172a; font-size:14px; cursor:pointer; text-decoration:none;" 
                      onmouseover="this.style.color='#154d34'; this.style.textDecoration='underline';" 
                      onmouseout="this.style.color='#0f172a'; this.style.textDecoration='none';"
                      title="Click to view task details & history"
                    >
                      ${t.title}
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-top:3px;">
                      Assigned to: <strong>${t.assigned_to_name}</strong> (${t.hierarchy_role})
                    </div>
                  </td>
                  <td style="padding:14px 18px; vertical-align:middle; font-size:13px; color:#334155;">
                    ${t.formatted_assigned_date}
                  </td>
                  <td style="padding:14px 18px; vertical-align:middle; font-size:13px; color:#334155;">
                    ${t.formatted_deadline}
                  </td>
                  <td style="padding:14px 18px; vertical-align:middle; text-align:center;">
                    <span class="badge ${getTaskStatusBadgeClass(t.display_status)}" style="padding:4px 12px; font-size:11.5px; font-weight:700;">
                      ${t.display_status}
                    </span>
                  </td>
                  <td style="padding:14px 18px; vertical-align:middle; text-align:center;">
                    ${t.display_status === 'Overdue' ? `
                      <button class="btn btn-sm" onclick="void openViewTaskHistoryModal(${t.id})" style="padding:5px 14px; font-size:12px; background:#dc2626; color:#ffffff; border:1px solid #dc2626; border-radius:6px; font-weight:600; display:inline-flex; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(220,38,38,0.25);" title="Overdue task: Click to view, reassign, or switch">
                        <span class="material-icons-round" style="font-size:14px;">visibility</span> View
                      </button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="void openViewTaskHistoryModal(${t.id})" style="padding:5px 12px; font-size:12px;">
                        <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:2px;">visibility</span> View
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `
      <div style="padding:40px; text-align:center; color:#dc2626;">
        <div style="font-weight:700; margin-bottom:8px;">Failed to load task management</div>
        <div style="font-size:13px; color:#64748b; margin-bottom:12px;">${err.message}</div>
        <button class="btn btn-primary" onclick="void renderAdminTasksView(document.getElementById('portal-content-mount'))">Retry</button>
      </div>
    `;
  }
}

// 8.3 Personal Task / To-Do Management Dashboard for Logged-In User
async function renderPersonalTasksView(mount) {
  mount.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;">Loading your personal To-Do tasks...</div>';
  try {
    const res = await api('/api/tasks/my-tasks');
    const tasks = res.tasks || [];
    const user = state.currentUser;

    const inProgress = tasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned' || t.status === 'Reassigned');
    const revisionReq = tasks.filter(t => t.status === 'Revision Required');
    const submitted = tasks.filter(t => t.status === 'Submitted for Review');
    const approved = tasks.filter(t => t.status === 'Approved' || t.status === 'Completed');

    mount.innerHTML = `
      <div class="page-header-row">
        <div>
          <h1 class="page-header-title">My Personal To-Do & Task Management</h1>
          <p class="page-header-desc">Exclusive task queue for <strong>${user.full_name}</strong> (${user.role} • ${user.hierarchy_role || state.activePortal}). Only authorized tasks assigned specifically to you appear here.</p>
        </div>
      </div>

      <!-- Status Summary Cards -->
      <div class="stats-grid">
        <div class="stat-card hero-card">
          <div class="stat-title">Action Needed</div>
          <div class="stat-value">${inProgress.length + revisionReq.length}</div>
          <div class="stat-footer-badge" style="background:#fee2e2; color:#991b1b;">Pending Execution</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Revision Required</div>
          <div class="stat-value">${revisionReq.length}</div>
          <div class="stat-footer-badge" style="background:#fef3c7; color:#92400e;">Corrections Requested</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Submitted for Review</div>
          <div class="stat-value">${submitted.length}</div>
          <div class="stat-footer-badge" style="background:#e0f2fe; color:#0369a1;">Awaiting Admin Review</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">Approved & Completed</div>
          <div class="stat-value">${approved.length}</div>
          <div class="stat-footer-badge" style="background:#dcfce7; color:#166534;">Verified by Admin</div>
        </div>
      </div>

      <!-- If there are Revision Required tasks, alert banner -->
      ${revisionReq.length > 0 ? `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; gap:12px;">
          <span class="material-icons-round" style="color:#dc2626; font-size:28px;">error_outline</span>
          <div style="flex:1;">
            <div style="font-weight:800; color:#991b1b; font-size:14px;">Urgent: ${revisionReq.length} Task(s) Require Corrections & Resubmission</div>
            <div style="font-size:12px; color:#b91c1c;">Admin Dr. Ramesh Narayan has reviewed your submission and requested mandatory revisions. Please inspect the feedback below.</div>
          </div>
        </div>
      ` : ''}

      <!-- Personal Tasks List -->
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons-round" style="color:#154d34; font-size:20px;">checklist</span>
            Assigned Tasks (${tasks.length})
          </h3>
          <span style="font-size:12px; color:#64748b;">Strict Role-Based Privacy: Isolated to your ID</span>
        </div>
        <div class="card-body" style="padding:16px 20px;">
          ${tasks.length === 0 ? `
            <div class="empty-state" style="padding:40px; text-align:center;">
              <span class="material-icons-round" style="font-size:48px; color:#cbd5e1; display:block; margin-bottom:8px;">assignment_late</span>
              <div style="font-weight:700; font-size:15px; color:#334155;">No Tasks Assigned Currently</div>
              <div style="font-size:12.5px; color:#64748b; margin-top:4px;">When Admin delegates a project, certificate processing, or academic task to you, it will appear here.</div>
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:16px;">
              ${tasks.map(t => {
                const isRevision = t.status === 'Revision Required';
                const cardBorder = isRevision ? '#fca5a5' : '#e2e8f0';
                const cardBg = isRevision ? '#fffbfb' : '#ffffff';
                return `
                <div style="border:1px solid ${cardBorder}; border-radius:14px; padding:18px 20px; background:${cardBg}; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                    <div>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-weight:800; font-size:15.5px; color:#0f172a;">${t.title}</span>
                        <span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span>
                        <span class="badge ${getTaskStatusBadgeClass(t.status)}">${t.status}</span>
                      </div>
                      <div style="font-size:12px; color:#64748b; margin-top:4px;">
                        Task Code: <strong>${t.task_code}</strong> • Project Reference: <strong>${t.project_ref || 'General'}</strong>
                      </div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:11.5px; color:#64748b;">Assigned by: <strong>${t.assigned_by_name}</strong></div>
                      <div style="font-size:12.5px; font-weight:800; color:${new Date(t.deadline) < new Date() && t.status !== 'Approved' ? '#dc2626' : '#047857'}; margin-top:2px;">
                        Deadline: ${t.deadline}
                      </div>
                    </div>
                  </div>

                  <!-- Task Instructions -->
                  <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; padding:12px 14px; margin-top:14px; font-size:12.5px; color:#334155;">
                    <div style="font-weight:700; color:#1e293b; margin-bottom:4px; font-size:11.5px; text-transform:uppercase; letter-spacing:0.5px;">Task Description & Instructions:</div>
                    <div>${t.description || t.instructions || 'Follow organizational guidelines and submit completed documentation.'}</div>
                    ${t.instructions && t.instructions !== t.description ? `<div style="margin-top:6px; font-style:italic; color:#0369a1;">Note: ${t.instructions}</div>` : ''}
                  </div>

                  <!-- Rejection & Mandatory Corrections Alert if Revision Required -->
                  ${t.status === 'Revision Required' && t.rejection_reason ? `
                    <div style="background:#fee2e2; border-left:4px solid #dc2626; border-radius:8px; padding:12px 14px; margin-top:12px; font-size:12.5px;">
                      <div style="font-weight:800; color:#991b1b; display:flex; align-items:center; gap:6px;">
                        <span class="material-icons-round" style="font-size:16px;">warning</span> Rejection Reason & Required Corrections:
                      </div>
                      <div style="color:#7f1d1d; margin-top:4px;"><strong>Reason:</strong> ${t.rejection_reason}</div>
                      <div style="color:#7f1d1d; margin-top:2px;"><strong>Action Required:</strong> ${t.required_corrections}</div>
                    </div>
                  ` : ''}

                  <!-- Submission Information -->
                  ${t.submission_date ? `
                    <div style="margin-top:12px; font-size:12px; color:#166534; background:#f0fdf4; border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
                      <div>
                        <strong>Submitted Deliverable:</strong> ${t.submission_file_name || 'project_deliverable.pdf'}
                        <span style="color:#64748b; margin-left:8px;">(${t.submission_date})</span>
                      </div>
                      <span class="badge badge-green">Under Review</span>
                    </div>
                  ` : ''}

                  <!-- Action Buttons -->
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px solid #f1f5f9;">
                    <button class="btn btn-secondary btn-sm" onclick="void openViewTaskHistoryModal(${t.id})">
                      <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">history</span> Revision & Audit History
                    </button>
                    ${t.status !== 'Approved' && t.status !== 'Completed' ? `
                      <button class="btn btn-primary btn-sm" onclick="void openSubmitWorkModal(${t.id}, '${escapeJsArg(t.title)}')">
                        <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:4px;">upload_file</span>
                        ${t.status === 'Revision Required' ? 'Resubmit Corrected Work' : 'Submit Work for Review'}
                      </button>
                    ` : '<span class="badge badge-green" style="font-size:11px;">✓ Finalized & Approved</span>'}
                  </div>
                </div>
              `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    mount.innerHTML = `<div style="padding:40px; text-align:center; color:#dc2626;">Failed to load tasks: ${err.message}</div>`;
  }
}

// =========================================================================
// 8.4 TASK MODALS & DIALOG WORKFLOWS (Admin Task Create, Review, Reassign)
// =========================================================================

function filterUsersByRole(role) {
  const userSelect = document.getElementById('ct-user-id');
  if (!userSelect) return;
  Array.from(userSelect.options).forEach(opt => {
    const uRole = opt.dataset.role;
    opt.style.display = (role === 'ALL' || uRole === role) ? 'block' : 'none';
  });
}

function getCreateTaskFormData() {
  return {
    title: document.getElementById('ct-title').value,
    assigned_to_user_id: document.getElementById('ct-user-id').value,
    task_type: document.getElementById('ct-type').value,
    priority: document.getElementById('ct-priority').value,
    start_date: document.getElementById('ct-start-date').value,
    deadline: document.getElementById('ct-deadline').value,
    project_ref: document.getElementById('ct-project-ref').value,
    description: document.getElementById('ct-desc').value,
    instructions: document.getElementById('ct-instructions').value
  };
}

function renderCreateTaskUserOptions(users, prefillUserId) {
  return users.map(u => {
    const isSelected = prefillUserId === u.id;
    const roleDisplay = u.hierarchy_role || u.role;
    return `
      <option value="${u.id}" data-role="${u.hierarchy_role}" ${isSelected ? 'selected' : ''}>
        ${u.full_name} (${roleDisplay} - ID: ${u.user_id})
      </option>
    `;
  }).join('');
}

function renderRoleFilterOptions(prefillRole) {
  const roles = [
    { value: 'Manager', label: 'Manager' },
    { value: 'Team Leader', label: 'Team Leader' },
    { value: 'Staff', label: 'Staff / Faculty' }
  ];
  return roles.map(r => `
    <option value="${r.value}" ${prefillRole === r.value ? 'selected' : ''}>${r.label}</option>
  `).join('');
}

async function handleCreateTaskSubmit(e) {
  e.preventDefault();
  try {
    const payload = getCreateTaskFormData();
    const res = await api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    showToast(res.message || 'Task assigned successfully.');
    if (state.currentView === 'tasks') {
      void renderAdminTasksView(document.getElementById('portal-content-mount'));
    } else if (state.currentView === 'hierarchy') {
      void renderAdminHierarchyView(document.getElementById('portal-content-mount'));
    }
  } catch (err) {
    alert('Error assigning task: ' + err.message);
  }
}

// 1. Admin Create Task Modal
window.openCreateTaskModal = async function (prefillUserId = null, prefillUserName = null, prefillRole = null) {
  const usersRes = await api('/api/admin/users-hierarchy');
  // Strict Filter: Only Managers, Team Leaders, and Staff can receive tasks (Admin, Donors, Students excluded)
  const allowedRoles = ['Manager', 'Team Leader', 'Staff'];
  const users = (usersRes.users || []).filter(u => allowedRoles.includes(u.hierarchy_role));

  showModal('Admin Task Assignment & Delegation', `
    <form id="admin-create-task-form">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Task Title *</label>
          <input type="text" id="ct-title" class="form-control" required placeholder="e.g. Conduct Stage-2 Capstone Review / Generate 80G Receipt">
        </div>

        <div class="form-group">
          <label class="form-label">Hierarchy Role Filter *</label>
          <select id="ct-role" class="form-control" onchange="filterUsersByRole(this.value)">
            <option value="ALL">All Roles</option>
            ${renderRoleFilterOptions(prefillRole)}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Specific Recipient User *</label>
          <select id="ct-user-id" class="form-control" required>
            ${renderCreateTaskUserOptions(users, prefillUserId)}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Task Type *</label>
          <select id="ct-type" class="form-control" required>
            <option value="Project Review">Project Review</option>
            <option value="Academic Assessment">Academic Assessment</option>
            <option value="Verification Audit">Verification Audit</option>
            <option value="General Task">General Task</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Priority *</label>
          <select id="ct-priority" class="form-control" required>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Start Date *</label>
          <input type="date" id="ct-start-date" class="form-control" required value="${new Date().toISOString().substring(0, 10)}">
        </div>

        <div class="form-group">
          <label class="form-label">Completion Deadline *</label>
          <input type="date" id="ct-deadline" class="form-control" required value="${new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10)}">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Project / Application Reference</label>
          <input type="text" id="ct-project-ref" class="form-control" placeholder="e.g. PRG-FSD-01 Batch 2026 / Donation REC-2026-0004">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Detailed Description & Objectives</label>
          <textarea id="ct-desc" class="form-control" rows="3" placeholder="Provide background context and expected deliverables."></textarea>
        </div>

        <div class="form-group full-width">
          <label class="form-label">Mandatory Instructions & Requirements</label>
          <textarea id="ct-instructions" class="form-control" rows="2" placeholder="Specific guidelines, format rules, or checklist items."></textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Assign Task to User</button>
      </div>
    </form>
  `);

  document.getElementById('admin-create-task-form').onsubmit = handleCreateTaskSubmit;
};

function updateReviewDecisionUI(decision) {
  const btnApprove = document.getElementById('btn-choice-approve');
  const btnReject = document.getElementById('btn-choice-reject');
  const appSection = document.getElementById('approve-section');
  const rejSection = document.getElementById('reject-section');
  const submitBtn = document.getElementById('submit-review-btn');

  submitBtn.disabled = false;
  if (decision === 'APPROVE') {
    btnApprove.style.background = '#15803d';
    btnApprove.style.color = '#fff';
    btnReject.style.background = '#f1f5f9';
    btnReject.style.color = '#64748b';
    appSection.style.display = 'block';
    rejSection.style.display = 'none';
    submitBtn.innerText = 'Approve & Finalize Task';
  } else {
    btnReject.style.background = '#dc2626';
    btnReject.style.color = '#fff';
    btnApprove.style.background = '#f1f5f9';
    btnApprove.style.color = '#64748b';
    rejSection.style.display = 'block';
    appSection.style.display = 'none';
    submitBtn.innerText = 'Reject & Issue Revision Task';
  }
}

function getReviewSubmissionPayload(decision) {
  const payload = { action: decision };
  if (decision === 'APPROVE') {
    payload.comments = document.getElementById('app-comments').value;
    return payload;
  }
  const reason = document.getElementById('rej-reason').value.trim();
  const corrections = document.getElementById('rej-corrections').value.trim();
  if (!reason || !corrections) {
    alert('Both Rejection Reason and Required Corrections are strictly mandatory.');
    return null;
  }
  payload.rejection_reason = reason;
  payload.required_corrections = corrections;
  payload.new_deadline = document.getElementById('rej-new-deadline').value;
  payload.reassign_to_user_id = document.getElementById('rej-reassign-user').value;
  return payload;
}

async function handleReviewDecisionSubmit(taskId, decision) {
  if (!decision) return;
  try {
    const payload = getReviewSubmissionPayload(decision);
    if (!payload) return;
    const res = await api('/api/admin/tasks/' + taskId + '/review', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    showToast(res.message);
    void renderAdminTasksView(document.getElementById('portal-content-mount'));
  } catch (err) {
    alert('Error submitting review: ' + err.message);
  }
}

// 2. Admin Review Modal: Approve or Reject
window.openReviewTaskModal = async function (taskId) {
  const res = await api('/api/tasks/' + taskId);
  const t = res.task;
  const usersRes = await api('/api/admin/users-hierarchy');
  const users = (usersRes.users || []).filter(u => u.hierarchy_role !== 'Donor' && u.portal_type !== 'DONOR');

  showModal('Review Submission: ' + t.task_code, `
    <div>
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:18px;">
        <div style="font-weight:800; font-size:16px; color:#0f172a;">${t.title}</div>
        <div style="font-size:12px; color:#64748b; margin-top:2px;">
          Submitted by: <strong>${t.assigned_to_name}</strong> (${t.hierarchy_role}) • Project: ${t.project_ref || 'General'}
        </div>
        <div style="margin-top:12px; padding:10px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
          <div style="font-size:11px; font-weight:800; color:#166534; text-transform:uppercase;">Submitted Deliverable:</div>
          <div style="font-size:13px; font-weight:700; color:#14532d; margin-top:2px;">
            <span class="material-icons-round" style="font-size:16px; vertical-align:middle;">attach_file</span> ${t.submission_file_name || 'project_deliverable.pdf'}
          </div>
          <div style="font-size:12px; color:#334155; margin-top:4px;">${t.submission_text || 'Deliverables submitted for review.'}</div>
        </div>
      </div>

      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <button type="button" id="btn-choice-approve" class="btn btn-primary" style="flex:1; background:#16a34a; border-color:#16a34a;" onclick="selectReviewDecision('APPROVE')">
          <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">check_circle</span> Approve Submission
        </button>
        <button type="button" id="btn-choice-reject" class="btn btn-secondary" style="flex:1; color:#dc2626; border-color:#fca5a5;" onclick="selectReviewDecision('REJECT')">
          <span class="material-icons-round" style="font-size:18px; vertical-align:middle; margin-right:4px;">cancel</span> Reject / Request Revision
        </button>
      </div>

      <div id="approve-section" style="display:none; border:1px solid #bbf7d0; background:#f0fdf4; border-radius:12px; padding:16px; margin-bottom:18px;">
        <label class="form-label" style="color:#166534;">Approval Remarks (Optional)</label>
        <textarea id="app-comments" class="form-control" rows="2" placeholder="e.g. Work verified and meets MINDS TRUST standards."></textarea>
      </div>

      <div id="reject-section" style="display:none; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; padding:16px; margin-bottom:18px;">
        <div style="font-weight:800; color:#991b1b; font-size:13px; margin-bottom:8px;">Mandatory Revision & Rejection Details:</div>
        
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="color:#991b1b;">Rejection Reason * (Mandatory)</label>
          <input type="text" id="rej-reason" class="form-control" placeholder="e.g. Missing practical lab reports / Incomplete PAN reconciliation">
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label" style="color:#991b1b;">Required Corrections & Actions * (Mandatory)</label>
          <textarea id="rej-corrections" class="form-control" rows="2" placeholder="Specify exact changes the recipient must make before resubmission."></textarea>
        </div>

        <div class="form-grid" style="margin-top:10px;">
          <div class="form-group">
            <label class="form-label">New Revision Deadline *</label>
            <input type="date" id="rej-new-deadline" class="form-control" value="${new Date(Date.now() + 4 * 86400000).toISOString().substring(0, 10)}">
          </div>
          <div class="form-group">
            <label class="form-label">Reassign Recipient (Optional)</label>
            <select id="rej-reassign-user" class="form-control">
              <option value="${t.assigned_to_user_id}">Keep Current Recipient (${t.assigned_to_name})</option>
              ${users.filter(u => u.id !== t.assigned_to_user_id).map(u => `
                <option value="${u.id}">${u.full_name} (${u.hierarchy_role})</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" id="submit-review-btn" class="btn btn-primary" disabled onclick="submitTaskReviewDecision(${t.id})">Confirm Review Decision</button>
      </div>
    </div>
  `);

  let currentDecision = null;
  window.selectReviewDecision = function (decision) {
    currentDecision = decision;
    updateReviewDecisionUI(decision);
  };

  window.submitTaskReviewDecision = function (reviewTaskId) {
    void handleReviewDecisionSubmit(reviewTaskId, currentDecision);
  };
};

// 3. Admin-Only Task Movement (Reassign to Same Member or Switch to Another User)
window.openReassignTaskModal = async function (taskId) {
  const res = await api('/api/tasks/' + taskId);
  const t = res.task;

  showModal('Reassign Task to Current Owner: ' + t.task_code, `
    <form id="admin-reassign-form">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:18px;">
        <div style="font-weight:800; font-size:15px; color:#0f172a;">${t.title}</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">
          Assigned Member: <strong style="color:#0f172a;">${t.assigned_to_name}</strong> (${t.hierarchy_role}) • Current Deadline: ${t.deadline}
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Assigned Member</label>
          <input type="text" class="form-control" value="${t.assigned_to_name} (${t.hierarchy_role})" disabled style="background:#f1f5f9; cursor:not-allowed;">
          <small style="color:#64748b; font-size:11px; margin-top:4px; display:block;">Reassign keeps the task with the same member.</small>
        </div>

        <div class="form-group">
          <label class="form-label">New Deadline *</label>
          <input type="date" id="re-deadline" class="form-control" required value="${t.deadline}">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Updated Priority</label>
          <select id="re-priority" class="form-control">
            <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
            <option value="Urgent" ${t.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label class="form-label">Reassign Reason *</label>
          <textarea id="re-reason" class="form-control" rows="3" required placeholder="Explain why the task is being reassigned with a new deadline to the same member."></textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" style="background:#154d34; border-color:#154d34;">Reassign Task</button>
      </div>
    </form>
  `);

  document.getElementById('admin-reassign-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        new_assigned_to_user_id: t.assigned_to_user_id,
        deadline: document.getElementById('re-deadline').value,
        priority: document.getElementById('re-priority').value,
        transfer_reason: document.getElementById('re-reason').value
      };
      const res = await api('/api/admin/tasks/' + t.id + '/reassign', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      showToast(res.message);
      void renderAdminTasksView(document.getElementById('portal-content-mount'));
    } catch (err) {
      alert('Error reassigning task: ' + err.message);
    }
  };
};

window.openSwitchTaskModal = async function (taskId) {
  const res = await api('/api/tasks/' + taskId);
  const t = res.task;
  const usersRes = await api('/api/admin/users-hierarchy');
  const users = (usersRes.users || []).filter(u => u.hierarchy_role !== 'Donor' && u.portal_type !== 'DONOR');

  showModal('Switch Task to Another Person: ' + t.task_code, `
    <form id="admin-switch-form">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:18px;">
        <div style="font-weight:800; font-size:15px; color:#0f172a;">${t.title}</div>
        <div style="font-size:12px; color:#64748b; margin-top:4px;">
          Current Owner: <strong>${t.assigned_to_name}</strong> (${t.hierarchy_role}) • Current Deadline: ${t.deadline}
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Switch To User & Role *</label>
          <select id="sw-user-id" class="form-control" required>
            <option value="">-- Select Person & Role --</option>
            ${users.map(u => `
              <option value="${u.id}" ${u.id === t.assigned_to_user_id ? 'disabled' : ''}>
                ${u.full_name} (${u.hierarchy_role} - ID: ${u.user_id}) ${u.id === t.assigned_to_user_id ? ' [CURRENT OWNER]' : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">New Due Date (Deadline) *</label>
          <input type="date" id="sw-deadline" class="form-control" required value="${t.deadline}">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Updated Priority</label>
          <select id="sw-priority" class="form-control">
            <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
            <option value="Urgent" ${t.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label class="form-label">Switch Reason *</label>
          <textarea id="sw-reason" class="form-control" rows="3" required placeholder="State reason for switching this task to another person."></textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" style="background:#dc2626; border-color:#dc2626;">Switch Task</button>
      </div>
    </form>
  `);

  document.getElementById('admin-switch-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedUserId = document.getElementById('sw-user-id').value;
      if (!selectedUserId) {
        alert('Please select a user to switch the task to.');
        return;
      }
      const payload = {
        new_assigned_to_user_id: selectedUserId,
        deadline: document.getElementById('sw-deadline').value,
        priority: document.getElementById('sw-priority').value,
        transfer_reason: document.getElementById('sw-reason').value
      };
      const res = await api('/api/admin/tasks/' + t.id + '/reassign', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      showToast(res.message);
      void renderAdminTasksView(document.getElementById('portal-content-mount'));
    } catch (err) {
      alert('Error switching task: ' + err.message);
    }
  };
};

// 4. Admin Edit Task Parameters Modal
window.openEditTaskModal = async function (taskId) {
  const res = await api('/api/tasks/' + taskId);
  const t = res.task;

  showModal('Edit Task Details: ' + t.task_code, `
    <form id="admin-edit-task-form">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Task Title *</label>
          <input type="text" id="et-title" class="form-control" required value="${t.title}">
        </div>

        <div class="form-group">
          <label class="form-label">Priority</label>
          <select id="et-priority" class="form-control">
            <option value="Medium" ${t.priority === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="High" ${t.priority === 'High' ? 'selected' : ''}>High</option>
            <option value="Urgent" ${t.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
            <option value="Low" ${t.priority === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Deadline *</label>
          <input type="date" id="et-deadline" class="form-control" required value="${t.deadline}">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Project / Application Reference</label>
          <input type="text" id="et-project-ref" class="form-control" value="${t.project_ref || ''}">
        </div>

        <div class="form-group full-width">
          <label class="form-label">Description</label>
          <textarea id="et-desc" class="form-control" rows="3">${t.description || ''}</textarea>
        </div>

        <div class="form-group full-width">
          <label class="form-label">Instructions</label>
          <textarea id="et-instructions" class="form-control" rows="2">${t.instructions || ''}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  `);

  document.getElementById('admin-edit-task-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: document.getElementById('et-title').value,
        priority: document.getElementById('et-priority').value,
        deadline: document.getElementById('et-deadline').value,
        project_ref: document.getElementById('et-project-ref').value,
        description: document.getElementById('et-desc').value,
        instructions: document.getElementById('et-instructions').value
      };
      const r = await api('/api/admin/tasks/' + t.id + '/edit', { method: 'PUT', body: JSON.stringify(payload) });
      closeModal();
      showToast(r.message);
      void renderAdminTasksView(document.getElementById('portal-content-mount'));
    } catch (err) {
      alert('Error updating task: ' + err.message);
    }
  };
};

// 5. User Submit Work Modal (Personal To-Do)
window.openSubmitWorkModal = function (taskId, taskTitle) {
  showModal('Submit Deliverables: ' + taskTitle, `
    <form id="user-submit-work-form">
      <div style="font-size:12.5px; color:#475569; margin-bottom:14px;">
        Upload your completed deliverables and provide detailed remarks. Once submitted, Admin Dr. Ramesh Narayan will be notified for governance review.
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label">Deliverable File Name / Document Reference *</label>
        <input type="text" id="sw-file" class="form-control" required placeholder="e.g. Capstone_Final_Report_v2.pdf / 80G_Draft_Reconciliation.xlsx">
      </div>

      <div class="form-group" style="margin-bottom:18px;">
        <label class="form-label">Submission Summary & Comments *</label>
        <textarea id="sw-remarks" class="form-control" rows="3" required placeholder="Describe what was completed, repository links, or specific corrections made."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Confirm & Submit for Review</button>
      </div>
    </form>
  `);

  document.getElementById('user-submit-work-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        submission_file_name: document.getElementById('sw-file').value.trim(),
        submission_text: document.getElementById('sw-remarks').value.trim()
      };
      const res = await api('/api/tasks/' + taskId + '/submit', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      showToast(res.message);
      void renderPersonalTasksView(document.getElementById('portal-content-mount'));
    } catch (err) {
      alert('Submission error: ' + err.message);
    }
  };
};

// 6. View Complete Audit & Revision History Modal
window.openViewTaskHistoryModal = async function (taskId) {
  const res = await api('/api/tasks/' + taskId);
  const t = res.task;
  const history = res.history || [];

  const displayStatus = mapTaskStatus(t.status, t.deadline);
  const formattedAssigned = formatDisplayDate(t.start_date || t.created_at);
  const formattedDeadline = formatDisplayDate(t.deadline);

  showModal('Task Details & Audit History', `
    <div>
      <!-- Clean Minimal Header / Summary Details -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:20px;">
        <div style="font-weight:800; font-size:16px; color:#0f172a; margin-bottom:10px;">${t.title}</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:12.5px;">
          <div><span style="color:#64748b;">Current Assigned User:</span> <strong style="color:#0f172a;">${t.assigned_to_name}</strong> <span class="badge" style="background:${getRoleBg(t.hierarchy_role)}; color:${getRoleColor(t.hierarchy_role)}; font-size:10px; padding:2px 6px;">${t.hierarchy_role}</span></div>
          <div><span style="color:#64748b;">Current Status:</span> <span class="badge ${getTaskStatusBadgeClass(displayStatus)}" style="padding:3px 10px; font-weight:700;">${displayStatus}</span></div>
          <div><span style="color:#64748b;">Assigned Date:</span> <strong style="color:#0f172a;">${formattedAssigned}</strong></div>
          <div><span style="color:#64748b;">Deadline:</span> <strong style="color:#0f172a;">${formattedDeadline}</strong></div>
        </div>
        ${t.description ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:12.5px; color:#334155;">
            <strong style="color:#0f172a;">Description:</strong> ${t.description}
          </div>
        ` : ''}
        ${t.instructions ? `
          <div style="margin-top:6px; font-size:12.5px; color:#334155;">
            <strong style="color:#0f172a;">Instructions:</strong> ${t.instructions}
          </div>
        ` : ''}
      </div>

      <!-- Vertical Audit & Revision Timeline -->
      <div style="font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span class="material-icons-round" style="font-size:16px; color:#154d34;">timeline</span>
        Task Lifecycle & Audit History (${history.length} Events)
      </div>

      <div style="display:flex; flex-direction:column; gap:12px; max-height:360px; overflow-y:auto; padding-right:6px;">
        ${history.length === 0 ? '<div style="font-size:12.5px; color:#64748b; padding:12px; text-align:center;">No task history available.</div>' :
        history.map((h) => `
          <div style="border-left:3px solid #154d34; padding:10px 14px; background:#f8fafc; border-radius:0 8px 8px 0; border:1px solid #e2e8f0; border-left-width:3px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; color:#0f172a; font-size:13px;">${h.action}</span>
              <span style="font-size:11px; color:#64748b;">${formatDisplayDate(h.created_at)} ${h.created_at ? h.created_at.substring(11, 16) : ''}</span>
            </div>
            <div style="color:#334155; margin-top:4px; font-size:12px; line-height:1.4;">${h.details}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px; display:flex; justify-content:space-between;">
              <span>Performed By: <strong style="color:#0f172a;">${h.performed_by_name}</strong></span>
              ${h.previous_value || h.new_value ? `<span style="font-size:10.5px; color:#0284c7;">${h.previous_value ? `Prev: ${h.previous_value} ` : ''}${h.new_value ? `➔ New: ${h.new_value}` : ''}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Quick Action Controls for Admin inside modal -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:14px; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${t.status === 'Submitted for Review' ? `
            <button class="btn btn-primary btn-sm" onclick="closeModal(); void openReviewTaskModal(${t.id})">
              <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:2px;">rate_review</span> Review Deliverables
            </button>
          ` : ''}
          ${displayStatus === 'Overdue' ? `
            <button class="btn btn-secondary btn-sm" onclick="closeModal(); void openReassignTaskModal(${t.id})" style="border-color:#154d34; color:#154d34; font-weight:600;">
              <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:2px;">schedule</span> Reassign
            </button>
            <button class="btn btn-secondary btn-sm" onclick="closeModal(); void openSwitchTaskModal(${t.id})" style="border-color:#dc2626; color:#dc2626; font-weight:600;">
              <span class="material-icons-round" style="font-size:14px; vertical-align:middle; margin-right:2px;">swap_horiz</span> Switch
            </button>
          ` : ''}
        </div>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
      </div>
    </div>
  `);
};

// 7. Conditional 80G Certificate Processing Workflow Modal
window.openCreate80GWorkflowModal = async function () {
  const [donRes, usersRes] = await Promise.all([
    api('/api/admin/donations'),
    api('/api/admin/users-hierarchy')
  ]);

  const donations = donRes.donations || [];
  const users = (usersRes.users || []).filter(u => u.hierarchy_role !== 'Donor' && u.portal_type !== 'DONOR');

  const eligibleDonations = donations.filter(d => d.payment_status === 'Verified' || d.doc_status === 'Verified');

  showModal('Generate 80G Certificate Task Workflow', `
    <form id="admin-80g-task-form">
      <div style="font-size:12.5px; color:#475569; margin-bottom:14px;">
        Trigger Section 80G tax exemption processing for officially verified donations. Assign the workflow to any eligible hierarchy role (Manager, Finance, or Staff).
      </div>

      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Select Verified Donor Contribution *</label>
          <select id="g80-donation-id" class="form-control" required>
            ${eligibleDonations.length === 0 ? '<option value="">No verified donations available</option>' :
            eligibleDonations.map(d => `
              <option value="${d.id}">
                ${d.receipt_no} — ₹${Number(d.amount).toLocaleString('en-IN')} (${d.purpose_name} • ${d.payment_method}) [Verified]
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Assign Responsible User *</label>
          <select id="g80-user-id" class="form-control" required>
            ${users.map(u => `
              <option value="${u.id}" ${u.hierarchy_role === 'Manager' ? 'selected' : ''}>
                ${u.full_name} (${u.hierarchy_role} - ID: ${u.user_id})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Processing Deadline *</label>
          <input type="date" id="g80-deadline" class="form-control" required value="${new Date(Date.now() + 5 * 86400000).toISOString().substring(0, 10)}">
        </div>

        <div class="form-group">
          <label class="form-label">Workflow Priority *</label>
          <select id="g80-priority" class="form-control" required>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label class="form-label">Compliance Instructions & PAN Guidelines</label>
          <textarea id="g80-instructions" class="form-control" rows="2" placeholder="e.g. Verify IT PAN format, ensure digital stamp is affixed, and calculate 50% eligible exemption."></textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" ${eligibleDonations.length === 0 ? 'disabled' : ''}>Dispatch 80G Task</button>
      </div>
    </form>
  `);

  document.getElementById('admin-80g-task-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        donation_id: document.getElementById('g80-donation-id').value,
        assigned_to_user_id: document.getElementById('g80-user-id').value,
        deadline: document.getElementById('g80-deadline').value,
        priority: document.getElementById('g80-priority').value,
        instructions: document.getElementById('g80-instructions').value
      };
      const res = await api('/api/admin/tasks/80g', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      showToast(res.message);
      void renderAdminTasksView(document.getElementById('portal-content-mount'));
    } catch (err) {
      alert('Error creating 80G task: ' + err.message);
    }
  };
};


window.addEventListener('DOMContentLoaded', initApp);
