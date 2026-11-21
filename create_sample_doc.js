const fs = require('fs');
const path = require('path');

const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MINDS TRUST - Official Donation Tax & Payment Voucher</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 30px; margin: 0; }
    .doc-container { max-width: 720px; margin: 0 auto; background: #ffffff; border: 2px solid #0f766e; border-radius: 12px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #0f766e; margin: 0; }
    .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .badge { background: #dcfce7; color: #15803d; font-weight: 700; padding: 6px 12px; border-radius: 999px; font-size: 13px; display: inline-block; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; font-size: 14px; }
    .box { background: #f1f5f9; padding: 14px; border-radius: 8px; }
    .amount-box { background: #f0fdf4; border: 1.5px dashed #16a34a; padding: 18px; border-radius: 10px; text-align: center; margin: 24px 0; }
    .stamp { border: 2px solid #0f766e; color: #0f766e; padding: 8px 16px; border-radius: 6px; display: inline-block; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="doc-container">
    <div class="header">
      <div>
        <h1 class="title">MINDS TRUST</h1>
        <div class="sub">Official Bank Deposit & Donation Voucher Verification</div>
        <div class="sub">Registered Charitable Trust • Section 80G Certified</div>
      </div>
      <div style="text-align: right;">
        <div class="badge">VERIFIED DOCUMENT</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Ref: NEFT-AXIS-992144</div>
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <strong>Donor Name:</strong> Rajeshwari Singhania<br>
        <strong>Donor Code:</strong> DNR-8891<br>
        <strong>Donor PAN:</strong> ABCPS1234D
      </div>
      <div class="box">
        <strong>Receipt No:</strong> REC-2026-0001<br>
        <strong>Transaction Date:</strong> 17-Nov-2026<br>
        <strong>Payment Mode:</strong> NEFT / Bank Transfer
      </div>
    </div>
    <div class="amount-box">
      <div style="font-size: 13px; color: #15803d; font-weight: 700;">OFFICIALLY VERIFIED CONTRIBUTION AMOUNT</div>
      <div style="font-size: 32px; font-weight: 900; color: #0f766e; margin: 8px 0;">₹1,50,000.00</div>
      <div style="font-size: 13px; color: #475569;">Rupees One Lakh Fifty Thousand Only</div>
    </div>
    <div style="font-size: 13.5px; line-height: 1.6; color: #334155;">
      <strong>Purpose & Beneficiary:</strong> Student Education Support & Batch A-2026 Youth Cohort (Pooja Kamble & peers).<br>
      <strong>Audit Reference:</strong> AXIS-BK-0091823901-UTR. Bank credit confirmed to MINDS TRUST Central Operational Account.
    </div>
    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div class="stamp">MINDS TRUST • AUDITED & VERIFIED</div>
      <div style="text-align: right; font-size: 12px; color: #64748b;">
        <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; width: 160px; font-weight: 700;">Authorized Signatory</div>
        Finance & Audit Desk
      </div>
    </div>
  </div>
</body>
</html>`;

const basePaths = [
  path.join('C:', 'Users', 'abiram', '.gemini', 'antigravity', 'scratch', 'trust-dashboard', 'uploads'),
  path.join('C:', 'Users', 'abiram', '.gemini', 'antigravity', 'scratch', 'mind-trust-erp', 'uploads'),
  path.join('C:', 'Users', 'abiram', 'OneDrive', 'mind trust erp', 'uploads')
];

basePaths.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'sample_tax_pan_receipt.html'), sampleHtml, 'utf8');
  fs.writeFileSync(path.join(dir, 'sample_tax_pan_receipt.pdf'), sampleHtml, 'utf8');
});

console.log('Sample documents successfully created in uploads directories.');
