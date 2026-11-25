# Care & Hope Charitable Trust - Operational Portal

A full-stack, enterprise-grade charitable trust web application with role-based access control, modular permission enforcement, dual-platform switching, and complete audit logging.

---

## 🛠️ Technology Stack & Folder Structure

- **Backend**: Node.js + Express.js
- **Database**: SQLite3 via `better-sqlite3` (single-file relational database with foreign key cascades)
- **Security & Session**: `bcryptjs` for salted password hashing, `express-session` for stateful cookie management, and server-side RBAC middleware.
- **Frontend**: Clean Vanilla JavaScript SPA architecture with CSS design inspired by high-productivity modern dashboards (Donezo design pattern), interactive modal workflows, and responsive views.

### Directory Structure
```
trust-dashboard/
├── package.json               # Dependencies and scripts
├── server/
│   ├── database.js            # SQLite schema initialization, table creation & seeding
│   ├── index.js               # Express server, authentication & REST API controllers
│   ├── test_suite.js          # Automated validation test suite
│   └── trust_data.db          # Embedded database file
└── public/
    ├── index.html             # Single-page HTML shell
    ├── styles.css             # Modern responsive styling & printable receipt styles
    ├── app.js                 # Frontend routing, module controllers & API client
    └── logo.svg               # Trust identity branding logo
```

---

## 🚀 Getting Started

### 1. Installation
In the project directory:
```bash
npm install
```

### 2. Run the Application
```bash
npm start
```
The server will start at: **`http://localhost:3000`**

---

## 👥 Seeded User Accounts for Testing

| Role / Scenario | User ID | Password | Platform Access | Assigned Modules & Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Trust Owner (Admin)** | `admin` | `admin123` | **Both** (Main Trust + Main SPA) | **All 11 modules** with View, Add, Edit, Delete, Approve, Export |
| **Donor Manager** | `donormgr` | `donor123` | **Main Trust** | **Only 3 modules**: Dashboard, Donor Management, Donation Management (Add/Edit enabled, Delete disabled) |
| **Multi-Platform Mgr** | `multimanager` | `multi123` | **Both** | All modules + **"Switch Platform"** button in top bar |
| **External User (Denied)**| `spaviewer` | `denied123` | **Main SPA** (No Trust access) | Triggers **Access Denied** page on login |

---

## 📋 Core Modules Implemented

1. **Trust Dashboard**: Monthly & all-time donations, active donors, active projects, beneficiaries helped, pending applications, pending tasks, category-wise funding chart, and live activity audit feed.
2. **Reception**: Front desk visitor check-in/out timestamps, badge generation, and enquiry tracking across four statuses (*New*, *Contacted*, *Converted*, *Closed*).
3. **Trustee Management**: Trustee profiles, positions, portfolio responsibilities, and term start/end dates.
4. **Donor Management**: Individual, corporate, foundation, and foreign benefactor profiles, PAN cards, and donation histories.
5. **Donation Management**: Automated receipt numbering (`REC-YYYY-XXXX`), printable 80G tax receipt dialog, category totals, and payment modes.
6. **Beneficiary Management**: Welfare applications, multi-tier review flow (*Applied* -> *Under Review* -> *Approved* / *Rejected*), and assistance disbursement tracking.
7. **Projects & Activities**: Budget utilization tracking, linked welfare activities, participant headcounts, and costs.
8. **Volunteer Management**: Volunteer registration, skills database, and project task assignments.
9. **Reports & Analytics**: Date range filters, category summaries, and export to CSV/Excel and printable PDF.
10. **User & Access Management**: Full administrator user provisioning with individual module assignments and 6-point granular permissions (`can_view`, `can_add`, `can_edit`, `can_delete`, `can_approve`, `can_export`).
11. **Trust Settings**: Statutory details (Registration number, 80G/12A certificate numbers, address), and user password changes.

