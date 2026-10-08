const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoUint8Array } = require('@simplewebauthn/server/helpers');
require('dotenv').config();

const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const RP_NAME = 'HVEL Security';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || `http://${RP_ID}:3000`;

const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ─── SMTP CONFIGURATION & HIGH-DELIVERABILITY MAILER ────────────────────────
const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.EMAIL_PORT || '465');
const smtpSecure = process.env.EMAIL_SECURE === 'false' ? false : (process.env.EMAIL_SECURE === 'true' ? true : smtpPort === 465);

const mainTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100
});

const hrmsTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: process.env.EMAIL_USER, pass: process.env.HRMS_EMAIL_PASS || process.env.EMAIL_PASS },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100
});

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mainTransporter.verify((error) => {
    if (error) console.error('[HVEL API] Main SMTP Error:', error);
    else console.log(`[HVEL API] ✅ Main SMTP ready — ${process.env.EMAIL_USER}`);
  });
}
if (process.env.HRMS_EMAIL_PASS) {
  hrmsTransporter.verify((error) => {
    if (error) console.error('[HVEL API] HRMS SMTP Error:', error);
    else console.log(`[HVEL API] ✅ HRMS SMTP ready — ${process.env.EMAIL_USER}`);
  });
}

// Transactional mail sender designed to prevent spam classification
async function sendTransactionalMail({ to, subject, preheader, title, mainContent, code, buttonText, buttonUrl, footerNote }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[MAILER] ⚠️ SMTP unconfigured. Simulated mail to ${to}: ${subject}`);
    return;
  }

  const senderEmail = process.env.EMAIL_USER.trim();
  const domain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'attest.page';
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const cleanTo = (to || '').toLowerCase().trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B;">
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader || subject}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color: #004D40; padding: 24px 32px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Attest</span>
                    <span style="font-size: 12px; font-weight: 600; color: #80CBC4; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Identity Security</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0F172A; line-height: 1.3;">${title}</h1>
              <div style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
                ${mainContent}
              </div>

              ${code ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0 24px 0;">
                <tr>
                  <td align="center" style="background-color: #F0FDF4; border: 1.5px dashed #007A5E; border-radius: 8px; padding: 18px 24px;">
                    <div style="font-size: 11px; font-weight: 700; color: #004D40; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Security Verification Code</div>
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #004D40;">${code}</div>
                    <div style="font-size: 12px; color: #64748B; margin-top: 6px;">Valid for 10 minutes · Single-use authorization</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${buttonText && buttonUrl ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${buttonUrl}" target="_blank" style="display: inline-block; background-color: #007A5E; color: #FFFFFF; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px;">${buttonText}</a>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${footerNote ? `
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #64748B;">
                ${footerNote}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                This transactional email was sent to <strong>${cleanTo}</strong> for account security verification on Attest.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                © ${new Date().getFullYear()} Attest Technologies Inc. · Cryptographic Identity Protection · https://attest.page
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const plainText = `
${title}

${mainContent.replace(/<[^>]*>?/gm, '')}

${code ? `Verification Code: ${code}\n(Valid for 10 minutes)\n` : ''}
${buttonText && buttonUrl ? `${buttonText}: ${buttonUrl}\n` : ''}
${footerNote ? footerNote.replace(/<[^>]*>?/gm, '') + '\n' : ''}

This email was sent to ${cleanTo} for account security on Attest (https://attest.page).
© ${new Date().getFullYear()} Attest Technologies Inc.
  `.trim();

  const mailOptions = {
    from: `"Attest Security" <${senderEmail}>`,
    sender: senderEmail,
    replyTo: senderEmail,
    to: cleanTo,
    subject: subject,
    text: plainText,
    html: html,
    messageId: messageId,
    headers: {
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
      'Feedback-ID': 'auth:security:attest',
      'MIME-Version': '1.0'
    }
  };

  return new Promise((resolve, reject) => {
    mainTransporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error(`[MAILER] ❌ Error sending email to ${cleanTo}:`, err.message);
        reject(err);
      } else {
        console.log(`[MAILER] ✅ Email successfully delivered to ${cleanTo} | Subject: "${subject}" | MsgID: ${info?.messageId || messageId}`);
        resolve(info);
      }
    });
  });
}

// Raw parser for Stripe Webhook signature validation
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (stripe && endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for testing without signature verification if secret is not set
      console.log('[STRIPE WEBHOOK] ⚠️ Warning: Processing unverified webhook event.');
      const bodyStr = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
      event = JSON.parse(bodyStr);
    }
  } catch (err) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Received event type: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      if (email) {
        console.log(`[STRIPE WEBHOOK] Upgrading user ${email} to professional`);
        await pool.query(
          `INSERT INTO users (email, plan, stripe_customer_id)
           VALUES ($1, 'professional', $2)
           ON CONFLICT (email) DO UPDATE
           SET plan = 'professional', stripe_customer_id = COALESCE($2, users.stripe_customer_id)`,
          [email.toLowerCase(), session.customer]
        );
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      console.log(`[STRIPE WEBHOOK] Subscription deleted for customer: ${customerId}`);
      await pool.query(
        `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE stripe_customer_id = $1`,
        [customerId]
      );
    }
  } catch (dbErr) {
    console.error('[STRIPE WEBHOOK] Database update failed:', dbErr);
  }

  res.json({ received: true });
});

app.use(express.json());
app.use(express.static('public'));

// Global Activity Logger
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[ACTIVITY] 📥 ${req.method} ${req.path} | Time: ${new Date().toLocaleTimeString()}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`           Payload:`, JSON.stringify(req.body));
    }
  }
  next();
});

app.get('/auth', (req, res) => {
  res.sendFile(__dirname + '/public/auth.html');
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'hvel-backend', message: 'HVEL Backend is running' });
});

const net = require('net');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: false
});

// ─── PLAN DEFINITIONS ───────────────────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free',
    totp_daily_limit: 3,
    gmail_accounts_limit: 1,
    audit_dashboard: false,
    trust_badges: false,
    webauthn_enabled: false,
  },
  professional: {
    name: 'Professional',
    totp_daily_limit: Infinity, // Unlimited verifications
    gmail_accounts_limit: 5,   // Up to 5 Gmail accounts
    audit_dashboard: true,
    trust_badges: true,
    webauthn_enabled: true,
  }
};

// ─── PLAN GUARD MIDDLEWARE ───────────────────────────────────────────────────
async function planGuard(feature, req, res, next) {
  const email = (req.body?.email || req.query?.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email required for plan check' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    
    // Check if the requested email is either authEmail itself or a linked alias of authEmail
    let isIdentityMatch = authEmail === email;
    if (!isIdentityMatch) {
      const aliasCheck = await pool.query(
        'SELECT 1 FROM user_aliases WHERE LOWER(primary_email) = $1 AND LOWER(alias_email) = $2',
        [authEmail, email]
      );
      if (aliasCheck.rows.length > 0) {
        isIdentityMatch = true;
      }
    }

    if (!isIdentityMatch) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

    // Resolve email to primary_email if it is an alias
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [email]);
    let targetEmail = email;
    if (aliasRes.rows.length > 0) {
      targetEmail = aliasRes.rows[0].primary_email.toLowerCase();
    }

    // Ensure user row exists (auto-create as free)
    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free')
       ON CONFLICT (email) DO NOTHING`,
      [targetEmail]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count FROM users WHERE email = $1', [targetEmail]);
    const user = userRes.rows[0];
    const plan = PLANS[user.plan] || PLANS.free;

    // ── Feature-specific quota checks ──────────────────────────────────────
    if (feature === 'gmail_account') {
      const currentCount = parseInt(user.gmail_accounts_count) || 0;
      if (currentCount >= plan.gmail_accounts_limit) {
        console.log(`[PLAN GUARD] 🚫 Gmail account limit for ${email} (${currentCount}/${plan.gmail_accounts_limit}) — Plan: ${user.plan}`);
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          feature: 'gmail_account',
          plan: user.plan,
          used: currentCount,
          limit: plan.gmail_accounts_limit,
          message: `Your ${user.plan} plan allows up to ${plan.gmail_accounts_limit} Gmail account(s). Upgrade to add more.`,
          upgrade_url: 'https://attest.page/pricing'
        });
      }
    }

    if (feature === 'audit_dashboard') {
      if (!plan.audit_dashboard) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          feature: 'audit_dashboard',
          plan: user.plan,
          message: 'Advanced audit dashboard requires the Professional plan.',
          upgrade_url: 'https://attest.page/pricing'
        });
      }
    }

    // Attach user + plan info to request for downstream use
    req.hvelUser = user;
    req.hvelPlan = plan;
    next();
  } catch (err) {
    console.error('[PLAN GUARD] Error:', err);
    res.status(500).json({ error: 'Plan check failed' });
  }
}

// Helper: increment quota counter for a feature
async function incrementQuota(email, feature) {
  const today = new Date().toISOString().split('T')[0];
  try {
    await pool.query(
      `INSERT INTO plan_quota_log (email, feature, log_date, count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (email, feature, log_date)
       DO UPDATE SET count = plan_quota_log.count + 1`,
      [email, feature, today]
    );
  } catch (err) {
    console.error('[QUOTA] Increment error:', err);
  }
}

async function initDB() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      email VARCHAR(255) PRIMARY KEY,
      plan VARCHAR(50) DEFAULT 'free' NOT NULL,
      gmail_accounts_count INTEGER DEFAULT 1,
      stripe_customer_id VARCHAR(255),
      plan_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS plan_quota_log (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      feature VARCHAR(100) NOT NULL,
      log_date DATE NOT NULL,
      count INTEGER DEFAULT 1,
      UNIQUE(email, feature, log_date)
    );
    CREATE TABLE IF NOT EXISTS verifications (
      id VARCHAR(50) PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255),
      type VARCHAR(50) NOT NULL,
      content_hash VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS nudge_log (
      id SERIAL PRIMARY KEY,
      hvel_user VARCHAR(255) NOT NULL,
      no_extension_user VARCHAR(255) NOT NULL,
      nudge_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hvel_user, no_extension_user)
    );
    CREATE TABLE IF NOT EXISTS invite_log (
      id SERIAL PRIMARY KEY,
      sender_email VARCHAR(255) NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      invite_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sender_email, recipient_email)
    );
    CREATE TABLE IF NOT EXISTS profiles (
      email VARCHAR(255) PRIMARY KEY,
      full_name VARCHAR(255),
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS security_alert_log (
      id SERIAL PRIMARY KEY,
      recipient_email VARCHAR(255) NOT NULL,
      attacker_email VARCHAR(255) NOT NULL,
      alert_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recipient_email, attacker_email)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_aliases (
      id SERIAL PRIMARY KEY,
      primary_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      alias_email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_otps (
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(10) NOT NULL,
      type VARCHAR(50) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (email, type)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    await pool.query('CREATE INDEX IF NOT EXISTS audit_logs_user_email_idx ON audit_logs (user_email)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)');
    const colCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='verifications' AND column_name='recipient_email'
    `);
    if (colCheck.rows.length === 0) {
      await pool.query('ALTER TABLE verifications ADD COLUMN recipient_email VARCHAR(255)');
    }
    const auditColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='audit_logs' AND column_name='metadata'
    `);
    if (auditColCheck.rows.length === 0) {
      await pool.query('ALTER TABLE audit_logs ADD COLUMN metadata JSONB');
    }
    console.log("✅ Database tables ensured (including plan and auth system).");
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}
initDB();

app.get('/health', (req, res) => res.json({ success: true, status: 'ok', service: 'hvel-backend', message: 'HVEL Backend is running' }));
app.post('/api/heartbeat', (req, res) => res.json({ success: true }));

// ─── AUTHENTICATION CRYPTO HELPERS ──────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(':')) return false;
  const [salt, hash] = storedValue.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
  }
  return { valid: true };
}

// ─── AUTHENTICATION ENDPOINTS ────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and password are required' });
  }
  const policyCheck = validatePasswordPolicy(password);
  if (!policyCheck.valid) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: policyCheck.message });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // 1. Check if the email is already linked as an alias to ANY existing account
    const aliasCheck = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
    if (aliasCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'EMAIL_ALREADY_LINKED',
        message: `This email is already linked to an existing account (${aliasCheck.rows[0].primary_email}). Please sign in to your primary account or unlink this email first.`
      });
    }

    // 2. Check if user exists and already has a password set
    const userRes = await pool.query('SELECT password_hash FROM users WHERE LOWER(email) = $1', [emailLower]);

    if (userRes.rows.length > 0) {
      if (userRes.rows[0].password_hash) {
        return res.status(400).json({ error: 'USER_EXISTS', message: 'An account with this email address already exists. Please sign in.' });
      }

      // If user exists (e.g. from Stripe checkout or auto-created free), but has no password hash set yet
      const passwordHash = hashPassword(password);
      await pool.query(
        `UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2`,
        [passwordHash, emailLower]
      );
    } else {
      // New user registration
      const passwordHash = hashPassword(password);
      await pool.query(
        `INSERT INTO users (email, plan, password_hash) VALUES ($1, 'free', $2)`,
        [emailLower, passwordHash]
      );
    }

    // Auto log in on signup
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [emailLower, token]
    );

    const userDetails = await pool.query('SELECT plan, plan_expires_at FROM users WHERE LOWER(email) = $1', [emailLower]);
    const plan = userDetails.rows[0]?.plan || 'free';
    const plan_expires_at = userDetails.rows[0]?.plan_expires_at || null;

    console.log(`[AUTH] 👤 User signed up and logged in: ${emailLower} | Plan: ${plan}`);
    res.json({ success: true, email: emailLower, token, plan, plan_expires_at });
  } catch (err) {
    console.error('[AUTH SIGNUP] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Signup failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and password are required' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    let effectiveEmail = emailLower;
    let linkedAliasUsed = null;

    let userRes = await pool.query('SELECT email, password_hash, plan, plan_expires_at FROM users WHERE LOWER(email) = $1', [emailLower]);
    
    // If not found as primary user, check if this email is a linked alias of a primary account
    if (userRes.rows.length === 0 || !userRes.rows[0].password_hash) {
      const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
      if (aliasRes.rows.length > 0) {
        effectiveEmail = aliasRes.rows[0].primary_email.toLowerCase();
        linkedAliasUsed = emailLower;
        userRes = await pool.query('SELECT email, password_hash, plan, plan_expires_at FROM users WHERE LOWER(email) = $1', [effectiveEmail]);
      }
    }

    if (userRes.rows.length === 0 || !userRes.rows[0].password_hash) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [effectiveEmail, token]
    );

    const plan = userRes.rows[0].plan || 'free';
    const plan_expires_at = userRes.rows[0].plan_expires_at || null;

    console.log(`[AUTH] 🔑 User logged in: ${effectiveEmail}${linkedAliasUsed ? ` (via linked alias: ${linkedAliasUsed})` : ''} | Plan: ${plan}`);
    res.json({ success: true, email: effectiveEmail, token, plan, plan_expires_at, linkedAliasUsed });
  } catch (err) {
    console.error('[AUTH LOGIN] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'MISSING_EMAIL', message: 'Email address is required.' });
  }

  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address.' });
  }

  try {
    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.query(
      `INSERT INTO user_otps (email, otp, type, expires_at)
       VALUES ($1, $2, 'login', $3)
       ON CONFLICT (email, type)
       DO UPDATE SET otp = $2, expires_at = $3`,
      [emailLower, otp, expiresAt]
    );

    await sendTransactionalMail({
      to: emailLower,
      subject: `Your Attest verification code is ${otp}`,
      title: 'Sign in to Attest',
      mainContent: `We received a request to verify your email address (<strong>${emailLower}</strong>) to access your Attest dashboard.`,
      code: otp,
      footerNote: `If you didn't request this code, you can safely ignore this email. Your account remains protected.`
    }).catch(err => console.error('[AUTH OTP] Send error:', err.message));

    res.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('[AUTH OTP] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send verification code.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and verification code are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const otpRes = await pool.query(
      'SELECT otp, expires_at FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [emailLower, 'login']
    );

    if (otpRes.rows.length === 0 || otpRes.rows[0].otp !== otp.trim()) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'The verification code entered is incorrect.' });
    }

    if (new Date() > new Date(otpRes.rows[0].expires_at)) {
      return res.status(400).json({ error: 'EXPIRED_OTP', message: 'The verification code has expired. Please request a new one.' });
    }

    // Delete used OTP
    await pool.query(
      'DELETE FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [emailLower, 'login']
    );

    // Auto-create user if not exists
    await pool.query(
      `INSERT INTO users (email, plan)
       VALUES ($1, 'free')
       ON CONFLICT (email) DO NOTHING`,
      [emailLower]
    );

    // Create session
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [emailLower, token]
    );

    console.log(`[AUTH OTP] ✅ User logged in successfully via OTP: ${emailLower}`);
    res.json({ success: true, email: emailLower, token });
  } catch (err) {
    console.error('[AUTH OTP VERIFY] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to verify OTP.' });
  }
});


// POST /api/auth/forgot-password/send-otp
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'MISSING_EMAIL', message: 'Email address is required.' });
  }

  const emailLower = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address.' });
  }

  try {
    // 1. Check if the email exists in the users table
    const userRes = await pool.query('SELECT email FROM users WHERE LOWER(email) = $1', [emailLower]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_REGISTERED',
        message: 'This email is not registered yet. Please check your email or sign up.'
      });
    }

    // 2. Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      `INSERT INTO user_otps (email, otp, type, expires_at)
       VALUES ($1, $2, 'password_reset', $3)
       ON CONFLICT (email, type)
       DO UPDATE SET otp = $2, expires_at = $3`,
      [emailLower, otp, expiresAt]
    );

    await sendTransactionalMail({
      to: emailLower,
      subject: `Your Attest password reset code is ${otp}`,
      title: 'Reset your Attest password',
      mainContent: `We received a request to reset the password for your Attest account (<strong>${emailLower}</strong>). Use the verification code below to complete the process:`,
      code: otp,
      footerNote: `If you didn't request a password reset, no changes have been made. You can safely ignore this email.`
    }).catch(err => console.error('[FORGOT PASSWORD] Send error:', err.message));

    res.json({ success: true, message: 'OTP has been sent to your registered email address.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process password reset request.' });
  }
});

// POST /api/auth/forgot-password/verify-otp
app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email and OTP are required.' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    const otpRes = await pool.query(
      'SELECT otp, expires_at FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [emailLower, 'password_reset']
    );

    if (otpRes.rows.length === 0 || otpRes.rows[0].otp !== otp.trim()) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'The verification code entered is incorrect.' });
    }

    if (new Date() > new Date(otpRes.rows[0].expires_at)) {
      return res.status(400).json({ error: 'EXPIRED_OTP', message: 'The verification code has expired. Please request a new one.' });
    }

    res.json({ success: true, message: 'OTP verified successfully.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD VERIFY] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to verify OTP.' });
  }
});

// POST /api/auth/forgot-password/reset-password
app.post('/api/auth/forgot-password/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Email, OTP, and new password are required.' });
  }

  const policyCheck = validatePasswordPolicy(newPassword);
  if (!policyCheck.valid) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: policyCheck.message });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    // 1. Verify OTP again
    const otpRes = await pool.query(
      'SELECT otp, expires_at FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [emailLower, 'password_reset']
    );

    if (otpRes.rows.length === 0 || otpRes.rows[0].otp !== otp.trim()) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'The verification code entered is invalid or expired.' });
    }

    if (new Date() > new Date(otpRes.rows[0].expires_at)) {
      return res.status(400).json({ error: 'EXPIRED_OTP', message: 'The verification code has expired.' });
    }

    // 2. Hash new password
    const newPasswordHash = hashPassword(newPassword);

    // 3. Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2',
      [newPasswordHash, emailLower]
    );

    // 4. Invalidate used OTP
    await pool.query(
      'DELETE FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [emailLower, 'password_reset']
    );

    // 5. Invalidate existing sessions for security
    await pool.query('DELETE FROM user_sessions WHERE LOWER(email) = $1', [emailLower]);

    console.log(`[FORGOT PASSWORD] 🔒 Password successfully reset for: ${emailLower}`);
    res.json({ success: true, message: 'Your password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[FORGOT PASSWORD RESET] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reset password.' });
  }
});


app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'NO_TOKEN', message: 'No active session token provided' });
  }

  try {
    await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('[AUTH LOGOUT] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to logout' });
  }
});

// GET /api/auth/google — Direct redirect to official Google Login / Create page
app.get('/api/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  if (clientId) {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
    return res.redirect(authUrl);
  }
  res.redirect('https://accounts.google.com/signin');
});

// GET /api/auth/microsoft — Direct redirect to official Microsoft 365 Login / Create page
app.get('/api/auth/microsoft', (req, res) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;
  if (clientId) {
    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile%20User.Read&prompt=select_account`;
    return res.redirect(authUrl);
  }
  res.redirect('https://login.microsoftonline.com/');
});

// GET /api/auth/sso/config — returns available OAuth provider configurations
app.get('/api/auth/sso/config', (req, res) => {
  const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const msRedirectUri = process.env.MICROSOFT_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/microsoft/callback`;

  res.json({
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      authUrl: process.env.GOOGLE_CLIENT_ID ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=openid%20email%20profile&prompt=select_account` : `${req.protocol}://${req.get('host')}/api/auth/google`
    },
    microsoft: {
      enabled: !!process.env.MICROSOFT_CLIENT_ID,
      clientId: process.env.MICROSOFT_CLIENT_ID || null,
      authUrl: process.env.MICROSOFT_CLIENT_ID ? `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&redirect_uri=${encodeURIComponent(msRedirectUri)}&response_type=code&scope=openid%20email%20profile%20User.Read&prompt=select_account` : `${req.protocol}://${req.get('host')}/api/auth/microsoft`
    }
  });
});

// POST /api/auth/sso/login — Direct enterprise SSO authentication for Google & Microsoft
app.post('/api/auth/sso/login', async (req, res) => {
  const { email, provider, name } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'A valid email is required for SSO.' });
  }

  const emailLower = email.toLowerCase().trim();

  try {
    let effectiveEmail = emailLower;
    let linkedAliasUsed = null;

    // Check if the SSO email is an alias of an existing primary account
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
    if (aliasRes.rows.length > 0) {
      effectiveEmail = aliasRes.rows[0].primary_email.toLowerCase();
      linkedAliasUsed = emailLower;
    }

    // 1. Auto-create primary user in database if they don't exist
    await pool.query(
      `INSERT INTO users (email, plan) 
       VALUES ($1, 'free') 
       ON CONFLICT (email) DO NOTHING`,
      [effectiveEmail]
    );

    // 2. Generate secure session token for primary account
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [effectiveEmail, token]
    );

    // 3. Retrieve user plan details
    const userRes = await pool.query('SELECT plan, plan_expires_at FROM users WHERE LOWER(email) = $1', [effectiveEmail]);
    const userRow = userRes.rows[0] || { plan: 'free' };

    console.log(`[AUTH SSO] 🚀 User signed in via ${provider || 'Enterprise SSO'}: ${effectiveEmail}${linkedAliasUsed ? ` (via linked alias: ${linkedAliasUsed})` : ''}`);

    res.json({
      success: true,
      email: effectiveEmail,
      token,
      provider: provider || 'google',
      plan: userRow.plan || 'free',
      plan_expires_at: userRow.plan_expires_at || null,
      name: name || effectiveEmail.split('@')[0],
      linkedAliasUsed
    });
  } catch (err) {
    console.error('[AUTH SSO] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'SSO Authentication failed.' });
  }
});

// GET /api/auth/google/callback — Google OAuth 2.0 Web Callback
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.ORIGIN || 'http://localhost:3000';

  if (!code || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${frontendUrl}/portal?error=google_oauth_unconfigured`);
  }

  try {
    // Exchange authorization code with Google token endpoint
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(`${frontendUrl}/portal?error=google_token_failed`);
    }

    // Fetch user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();
    const emailLower = (userData.email || '').toLowerCase().trim();

    if (!emailLower) {
      return res.redirect(`${frontendUrl}/portal?error=google_email_missing`);
    }

    let effectiveEmail = emailLower;
    let linkedAlias = '';
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
    if (aliasRes.rows.length > 0) {
      effectiveEmail = aliasRes.rows[0].primary_email.toLowerCase();
      linkedAlias = emailLower;
    }

    // Ensure user in database with default 'free' plan
    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [effectiveEmail]
    );

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [effectiveEmail, sessionToken]
    );

    console.log(`[AUTH GOOGLE] ✅ OAuth callback authenticated: ${effectiveEmail}${linkedAlias ? ` (via alias: ${linkedAlias})` : ''}`);
    res.redirect(`${frontendUrl}/portal?token=${sessionToken}&email=${encodeURIComponent(effectiveEmail)}&linkedAlias=${encodeURIComponent(linkedAlias)}&provider=google&name=${encodeURIComponent(userData.name || '')}`);
  } catch (err) {
    console.error('[AUTH GOOGLE CALLBACK] Error:', err);
    res.redirect(`${frontendUrl}/portal?error=oauth_internal_error`);
  }
});

// GET /api/auth/microsoft/callback — Microsoft Entra ID Web Callback
app.get('/api/auth/microsoft/callback', async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.ORIGIN || 'http://localhost:3000';

  if (!code || !process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
    return res.redirect(`${frontendUrl}/portal?error=microsoft_oauth_unconfigured`);
  }

  try {
    const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/api/auth/microsoft/callback',
        grant_type: 'authorization_code',
        scope: 'openid email profile User.Read'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.redirect(`${frontendUrl}/portal?error=microsoft_token_failed`);
    }

    // Fetch user profile from Microsoft Graph
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const graphData = await graphResponse.json();
    const emailLower = (graphData.mail || graphData.userPrincipalName || '').toLowerCase().trim();

    if (!emailLower) {
      return res.redirect(`${frontendUrl}/portal?error=microsoft_email_missing`);
    }

    let effectiveEmail = emailLower;
    let linkedAlias = '';
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
    if (aliasRes.rows.length > 0) {
      effectiveEmail = aliasRes.rows[0].primary_email.toLowerCase();
      linkedAlias = emailLower;
    }

    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [effectiveEmail]
    );

    const sessionToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (email, token) VALUES ($1, $2)`,
      [effectiveEmail, sessionToken]
    );

    console.log(`[AUTH MICROSOFT] ✅ OAuth callback authenticated: ${effectiveEmail}${linkedAlias ? ` (via alias: ${linkedAlias})` : ''}`);
    res.redirect(`${frontendUrl}/portal?token=${sessionToken}&email=${encodeURIComponent(effectiveEmail)}&linkedAlias=${encodeURIComponent(linkedAlias)}&provider=microsoft&name=${encodeURIComponent(graphData.displayName || '')}`);
  } catch (err) {
    console.error('[AUTH MICROSOFT CALLBACK] Error:', err);
    res.redirect(`${frontendUrl}/portal?error=oauth_internal_error`);
  }
});


// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'MISSING_EMAIL', message: 'Email is required' });

  const emailLower = email.toLowerCase().trim();

  try {
    // Always return success to avoid user enumeration attacks
    const userRes = await pool.query('SELECT email FROM users WHERE email = $1', [emailLower]);
    if (userRes.rows.length === 0) {
      return res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });
    }

    // Delete any old unused tokens for this email
    await pool.query('DELETE FROM password_reset_tokens WHERE email = $1', [emailLower]);

    // Generate a secure token, expires in 1 hour
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
      [emailLower, resetToken, expiresAt]
    );

    const host = req.get('host') || 'api.attest.page';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const resetUrl = `${proto}://${host}/reset-password?token=${resetToken}`;

    await sendTransactionalMail({
      to: emailLower,
      subject: 'Reset your Attest password',
      title: 'Password Reset Request',
      mainContent: `Hi,<br/><br/>You recently requested to reset the password for your Attest account (<strong>${emailLower}</strong>). Click the button below to choose a new password. This link will expire in 1 hour.`,
      buttonText: 'Reset My Password',
      buttonUrl: resetUrl,
      footerNote: `If you did not request a password reset, you can safely ignore this email — your password will not change.`
    }).catch(err => console.error('[AUTH FORGOT] Send error:', err.message));

    console.log(`[AUTH FORGOT] 📧 Reset link generated for: ${emailLower}`);
    res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('[AUTH FORGOT] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process request.' });
  }
});

// ─── RESET PASSWORD PAGE ──────────────────────────────────────────────────────
app.get('/reset-password', (req, res) => {
  res.sendFile(__dirname + '/public/reset-password.html');
});

// ─── RESET PASSWORD SUBMIT ────────────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Token and new password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' });
  }

  try {
    const tokenRes = await pool.query(
      `SELECT email, expires_at, used FROM password_reset_tokens WHERE token = $1`,
      [token]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ error: 'INVALID_TOKEN', message: 'This reset link is invalid or has already been used.' });
    }

    const { email, expires_at, used } = tokenRes.rows[0];

    if (used) {
      return res.status(400).json({ error: 'TOKEN_USED', message: 'This reset link has already been used. Please request a new one.' });
    }

    if (new Date() > new Date(expires_at)) {
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'TOKEN_EXPIRED', message: 'This reset link has expired. Please request a new one.' });
    }

    // Update password
    const passwordHash = hashPassword(password);
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);

    // Invalidate all active sessions (security best practice)
    await pool.query('DELETE FROM user_sessions WHERE email = $1', [email]);

    // Mark token as used
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE token = $1', [token]);

    console.log(`[AUTH RESET] ✅ Password successfully reset for: ${email}`);
    res.json({ success: true, message: 'Password successfully updated! You can now sign in with your new password.' });
  } catch (err) {
    console.error('[AUTH RESET] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reset password.' });
  }
});

// Shared domain/email block helper
const IGNORED_DOMAINS = [
  'vercel.com', 'google.com', 'microsoft.com', 'github.com', 'github.io',
  'aws.com', 'amazon.com', 'netflix.com', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com'
];
function isBlockedEmail(email) {
  if (!email || !email.includes('@')) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  const internalEmails = [process.env.EMAIL_USER?.toLowerCase()].filter(Boolean);
  return internalEmails.includes(email.toLowerCase()) || IGNORED_DOMAINS.includes(domain);
}



// ─────────────────────────────────────────────────────────────────────────────
// /api/verify — Save verification record + send one-time invite email
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  const { senderEmail, recipientEmail, type, contentHash } = req.body;
  console.log(`[HVEL API] 🛡️ Verification Start — Sender: ${senderEmail} | Recipient: ${recipientEmail || 'N/A'}`);
  if (!senderEmail || !type) return res.status(400).json({ error: 'senderEmail and type are required' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    
    // Check if senderEmail is either authEmail itself or a linked alias of authEmail
    let isIdentityMatch = authEmail === senderEmail.toLowerCase();
    if (!isIdentityMatch) {
      const aliasCheck = await pool.query(
        'SELECT 1 FROM user_aliases WHERE LOWER(primary_email) = $1 AND LOWER(alias_email) = $2',
        [authEmail, senderEmail.toLowerCase()]
      );
      if (aliasCheck.rows.length > 0) {
        isIdentityMatch = true;
      }
    }

    if (!isIdentityMatch) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match the sender email (${senderEmail}).` });
    }

    // Resolve senderEmail to primary account for logging/quota tracking if it's an alias
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [senderEmail.toLowerCase()]);
    const quotaOwnerEmail = aliasRes.rows.length > 0 ? aliasRes.rows[0].primary_email.toLowerCase() : senderEmail.toLowerCase();

    const verificationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const result = await pool.query(
      `INSERT INTO verifications (id, sender_email, recipient_email, type, content_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [verificationId, senderEmail, recipientEmail || null, type, contentHash || null]
    );

    // Automatically record in audit_logs table so portal immediately reflects this sent email
    try {
      const logType = (type === 'human' || type === 'verified') ? 'sent_stamped_link' : 'sent_unstamped';
      const auditMeta = {
        verificationId,
        contentHash,
        sender: senderEmail,
        recipient: recipientEmail || 'Recipient',
        subject: req.body.subject || 'Outgoing Attested Communication',
        status: (type === 'human' || type === 'verified') ? 'VERIFIED' : 'WARNING',
        proof: (type === 'human' || type === 'verified') ? 'Level 3 · Cryptographic Human Verification' : 'Standard Unsigned Message'
      };
      await pool.query(
        `INSERT INTO audit_logs (user_email, type, email, timestamp, metadata) 
         VALUES ($1, $2, $3, NOW(), $4)`,
        [
          quotaOwnerEmail,
          logType,
          (recipientEmail || 'recipient@verified.com').toLowerCase(),
          JSON.stringify(auditMeta)
        ]
      );
      console.log(`[HVEL API] 📝 Auto-inserted audit log for ${quotaOwnerEmail} -> ${recipientEmail}`);
    } catch (auditErr) {
      console.warn('[HVEL API] ⚠️ Audit log auto-insert notice:', auditErr.message);
    }

    // Log / increment the user's daily verification quota
    await incrementQuota(quotaOwnerEmail, 'totp_verify');

    const host = req.get('host') || 'api.attest.page';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const verificationUrl = `${proto}://${host}/v/${verificationId}`;

    // Send invite email — only once per sender→recipient pair
    if (recipientEmail && !isBlockedEmail(recipientEmail) &&
      senderEmail.toLowerCase() !== recipientEmail.toLowerCase() &&
      process.env.EMAIL_USER && process.env.EMAIL_PASS) {

      const alreadyInvited = await pool.query(
        `SELECT id FROM invite_log WHERE LOWER(sender_email) = LOWER($1) AND LOWER(recipient_email) = LOWER($2) LIMIT 1`,
        [senderEmail, recipientEmail]
      );

      if (alreadyInvited.rows.length === 0) {
        await sendTransactionalMail({
          to: recipientEmail,
          subject: `Verified Email Received from ${senderEmail}`,
          title: 'Human Verified Email Received',
          mainContent: `You have just received an email from <strong>${senderEmail}</strong> that has been <strong>Human Verified</strong> via the Attest Security Layer.<br/><br/>Attest validates physical human intent in real time, confirming this email was composed by a physical human rather than an automated script or AI phishing tool.`,
          buttonText: 'Install Attest Extension — Free',
          buttonUrl: 'https://chromewebstore.google.com/detail/emgidilonchdpmibbcjlbgkddmpcfmpa',
          footerNote: `Verification Reference: ${verificationId}`
        }).then(() => {
          console.log(`[HVEL API] ✅ Invite sent to ${recipientEmail} from ${senderEmail}`);
          return pool.query(`INSERT INTO invite_log (sender_email, recipient_email) VALUES ($1, $2)`, [senderEmail.toLowerCase(), recipientEmail.toLowerCase()]);
        }).catch(err => {
          console.error("[HVEL API] ❌ Invite email error:", err.message);
        });
      } else {
        console.log(`[HVEL API] ⏭️ Invite skipped — already sent to ${recipientEmail} from ${senderEmail}`);
      }
    }

    res.status(201).json({ success: true, data: { record: result.rows[0], verificationUrl } });
  } catch (err) { console.error("Error saving verification:", err); res.status(500).json({ error: 'Database error' }); }
});

// /api/validate
app.post('/api/validate', async (req, res) => {
  const { id, senderEmail, recipientEmail } = req.body;
  if (!id) return res.status(400).json({ error: 'Verification ID is required' });
  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [id]);
    const record = result.rows[0];
    if (!record) return res.json({ status: 'invalid', message: 'Verification record not found' });
    const senderMatch = record.sender_email.toLowerCase() === senderEmail?.toLowerCase();
    const recipientMatch = !record.recipient_email || record.recipient_email.toLowerCase() === recipientEmail?.toLowerCase();
    if (senderMatch && recipientMatch) return res.json({ status: 'verified', type: record.type, timestamp: record.timestamp });
    else return res.json({ status: 'tampered', message: 'Security Alert: ID mismatch.' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/notify-unverified-reply — Send nudge email when non-extension user replies
// GATE: Only sends if extension user previously sent a verified email to them
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/notify-unverified-reply', async (req, res) => {
  const hvelUserEmail = (req.body.hvelUserEmail || req.body.senderEmail || '').trim().toLowerCase();
  const noExtUserEmail = (req.body.noExtensionEmail || req.body.recipientEmail || '').trim().toLowerCase();

  console.log('----------------------------------------------------------------');
  console.log(`[HVEL API] 📥 Nudge Request — ext-user: ${hvelUserEmail} | target: ${noExtUserEmail}`);
  console.log('----------------------------------------------------------------');

  if (!hvelUserEmail || !noExtUserEmail) return res.status(400).json({ error: 'hvelUserEmail and noExtensionEmail are required' });
  if (!noExtUserEmail.includes('@') || noExtUserEmail === 'unknown-sender@gmail.com') return res.status(400).json({ success: false, message: 'Invalid recipient email' });
  if (isBlockedEmail(noExtUserEmail)) { console.log(`[HVEL API] ⛔ Blocked — whitelisted: ${noExtUserEmail}`); return res.status(200).json({ success: false, message: 'Ignored' }); }
  if (hvelUserEmail === noExtUserEmail) { console.log(`[HVEL API] ⛔ Self-nudge blocked`); return res.status(200).json({ success: false, message: 'Ignored: self-nudge' }); }

  try {
    // 24-hour database gate
    const alreadyNudged = await pool.query(
      `SELECT id FROM nudge_log 
       WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2 
       AND nudge_sent_at > NOW() - INTERVAL '24 hours' 
       LIMIT 1`,
      [hvelUserEmail, noExtUserEmail]
    );
    if (alreadyNudged.rows.length > 0) {
      console.log(`[HVEL API] ⛔ Nudged recently. Skipping.`);
      return res.status(200).json({ success: true, message: 'Already notified recently.' });
    }
  } catch (err) { return res.status(500).json({ error: 'Server error during gate checks' }); }

  try {
    const details = req.body.details || {};
    const timestamp = details.timestamp || new Date().toLocaleString();

    // Always insert or update timestamp
    try {
      const existing = await pool.query(
        `SELECT id FROM nudge_log WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2 LIMIT 1`,
        [hvelUserEmail, noExtUserEmail]
      );
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE nudge_log SET nudge_sent_at = NOW() WHERE LOWER(hvel_user) = $1 AND LOWER(no_extension_user) = $2`,
          [hvelUserEmail, noExtUserEmail]
        );
      } else {
        await pool.query(
          `INSERT INTO nudge_log (hvel_user, no_extension_user) VALUES ($1, $2)`,
          [hvelUserEmail, noExtUserEmail]
        );
      }
    } catch (dbErr) {
      console.error('[HVEL API] Database error logging nudge:', dbErr);
    }

    // Get sender profile for personalization
    const profileRes = await pool.query('SELECT full_name FROM profiles WHERE email = $1', [hvelUserEmail]);
    const senderName = profileRes.rows[0]?.full_name || hvelUserEmail;

    console.log(`[SMTP] 📤 Sending security notification to ${noExtUserEmail}...`);
    const info = await sendTransactionalMail({
      to: noExtUserEmail,
      subject: `Security notice regarding your email to ${hvelUserEmail}`,
      title: 'Attest Security Notice',
      mainContent: `An email sent from your address to <strong>${senderName}</strong> was received without a cryptographic human verification stamp.<br/><br/>To protect against automated phishing and AI impersonation, ${senderName} uses the Attest Security Layer.`,
      buttonText: 'Get Attest Extension — Free',
      buttonUrl: 'https://chromewebstore.google.com/detail/emgidilonchdpmibbcjlbgkddmpcfmpa',
      footerNote: `This notification was automatically sent for communication with ${hvelUserEmail}.`
    });
    console.log(`[SMTP] ✅ Security notice sent`);



    console.log('================================================================');
    console.log(`[HVEL API] ✅ NUDGE EMAIL SENT`);
    console.log(`           HVEL User:    ${hvelUserEmail}`);
    console.log(`           Target:       ${noExtUserEmail}`);
    console.log(`           Sent At:      ${new Date().toISOString()}`);
    console.log('================================================================');

    res.json({ success: true, message: `Nudge email sent to ${noExtUserEmail}` });
  } catch (err) { console.error('[HVEL API] ❌ Nudge error:', err.message); res.status(500).json({ error: 'Server error' }); }
});

// Trust record page
app.get('/v/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM verifications WHERE id = $1', [req.params.id]);
    const record = result.rows[0];
    if (!record) return res.status(404).send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px;">404 - Verification Record Not Found</h1>');
    const badgeColor = record.type === 'ai' ? '#8b5cf6' : (record.type === 'automated' || record.type === 'robotic') ? '#ef4444' : '#007A5E';
    const badgeTitle = record.type === 'ai' ? 'AI Assisted' : (record.type === 'automated' || record.type === 'robotic') ? 'Robotic Sender' : 'Approved';
    
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attest Trust Record - ${badgeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    
    body {
      min-height: 100vh;
      background: #f8fafc;
      background-image: 
        radial-gradient(at 50% 0%, rgba(0, 122, 94, 0.05) 0px, transparent 60%),
        linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #0f172a;
    }

    /* Main Verification Card */
    .card {
      width: 100%;
      max-width: 500px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
    }

    .status-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 24px;
    }

    /* Logo inside circle */
    .badge-icon-circle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .badge-logo-img {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }

    .status-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }

    .status-subtitle {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
    }

    /* Key-Value Details Table */
    .detail-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 28px;
    }

    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .detail-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* Unified Code Box Styling for ALL data fields */
    .code-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .code-box:hover {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }

    .code-text {
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      font-weight: 600;
    }

    .code-text::-webkit-scrollbar {
      display: none;
    }

    .copy-icon {
      flex-shrink: 0;
      color: #94a3b8;
      transition: color 0.15s ease;
    }

    .code-box:hover .copy-icon {
      color: ${badgeColor};
    }

    /* Two Buttons Area */
    .btn-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    @media (max-width: 480px) {
      .btn-container {
        grid-template-columns: 1fr;
      }
      .card {
        padding: 28px 20px;
      }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      text-align: center;
      height: 44px;
    }

    .btn-verify {
      background: ${badgeColor};
      color: #ffffff;
      border: 1px solid ${badgeColor};
      box-shadow: 0 2px 8px rgba(0, 122, 94, 0.2);
    }

    .btn-verify:hover {
      filter: brightness(0.92);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0, 122, 94, 0.3);
    }

    .btn-info {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
    }

    .btn-info:hover {
      background: #f8fafc;
      color: #0f172a;
      border-color: #94a3b8;
      transform: translateY(-1px);
    }

    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: center;
    }

    .footer a {
      color: ${badgeColor};
      text-decoration: none;
      font-weight: 600;
    }

    /* Toast Alert */
    .toast {
      position: fixed;
      bottom: 24px;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s ease;
      pointer-events: none;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      z-index: 100;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>

  <div class="card">
    <div class="status-header">
      <!-- LOGO INSIDE THE CIRCLE -->
      <div class="badge-icon-circle">
        <img src="/icon-symbol.png" alt="Attest Logo" class="badge-logo-img" />
      </div>

      <!-- TITLE: APPROVED -->
      <h1 class="status-title">${badgeTitle}</h1>
      <p class="status-subtitle">This email carries an authentic trust signal cryptographically verified by Attest.</p>
    </div>

    <div class="detail-group">
      <!-- SENDER ADDRESS IN BOX AS REQUESTED -->
      <div class="detail-row">
        <div class="detail-label">Sender Address</div>
        <div class="code-box" onclick="copyToClipboard('${record.sender_email}', 'Sender Address')">
          <span class="code-text" style="font-family: 'Plus Jakarta Sans', sans-serif;">${record.sender_email}</span>
          <svg class="copy-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </div>
      </div>

      <!-- VERIFICATION ID IN BOX -->
      <div class="detail-row">
        <div class="detail-label">Verification ID</div>
        <div class="code-box" onclick="copyToClipboard('${record.id}', 'Verification ID')">
          <span class="code-text">${record.id}</span>
          <svg class="copy-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </div>
      </div>

      <!-- CONTENT SHA-256 HASH IN BOX -->
      <div class="detail-row">
        <div class="detail-label">Content SHA-256 Hash</div>
        <div class="code-box" onclick="copyToClipboard('${record.content_hash || 'N/A'}', 'Content Hash')">
          <span class="code-text" style="font-size: 12px; color: #475569;">${record.content_hash || 'N/A'}</span>
          <svg class="copy-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </div>
      </div>

      <!-- TIMESTAMP (UTC) IN BOX -->
      <div class="detail-row">
        <div class="detail-label">Timestamp (UTC)</div>
        <div class="code-box" style="cursor: default;">
          <span class="code-text" style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13.5px; color: #475569; font-weight: 500;">${new Date(record.timestamp).toUTCString()}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
      </div>
    </div>

    <!-- TWO BUTTONS REQUIRED BY USER -->
    <div class="btn-container">
      <a href="https://attest.page/verify" target="_blank" class="btn btn-verify">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 11l2 2 4-4"></path></svg>
        Verify Portal
      </a>

      <a href="https://attest.page" target="_blank" class="btn btn-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        More Information
      </a>
    </div>
  </div>

  <div class="footer">
    <img src="/icon-symbol.png" alt="Attest Logo" style="width: 16px; height: 16px; object-fit: contain;" />
    Verified by <a href="https://attest.page" target="_blank">Attest Security Protocol</a> · FIDO2 & SHA-256
  </div>

  <div id="toast" class="toast">Copied to clipboard</div>

  <script>
    function copyToClipboard(text, label) {
      if (!text || text === 'N/A') return;
      navigator.clipboard.writeText(text).then(() => {
        const toast = document.getElementById('toast');
        toast.innerText = label + ' copied!';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
      });
    }
  </script>

</body>
</html>`);
  } catch (err) { res.status(500).send('<h1 style="font-family:sans-serif;text-align:center;margin-top:50px;">500 - Server Error</h1>'); }
});

// Utility endpoints
app.post('/api/check-sent-verified', async (req, res) => {
  const { senderEmail, recipientEmail } = req.body;
  if (!senderEmail || !recipientEmail) return res.status(400).json({ verified: false, error: 'Both emails required' });
  try {
    const result = await pool.query(`SELECT id FROM verifications WHERE LOWER(sender_email) = LOWER($1) AND LOWER(recipient_email) = LOWER($2) LIMIT 1`, [senderEmail, recipientEmail]);
    const verified = result.rows.length > 0;
    console.log(`[HVEL API] 🔎 check-sent-verified: ${senderEmail} → ${recipientEmail} = ${verified}`);
    res.json({ verified });
  } catch (err) { res.status(500).json({ verified: false, error: 'Server error' }); }
});

app.post('/api/check-user-verified', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ verified: false, error: 'Email required' });

  const emailLower = email.toLowerCase().trim();

  try {
    // 1. Check primary users table
    const userResult = await pool.query(`SELECT email FROM users WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    if (userResult.rows.length > 0) {
      console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = true (users table)`);
      return res.json({ verified: true });
    }

    // 2. Check linked email aliases table (multi-account linking)
    const aliasResult = await pool.query(`SELECT alias_email FROM user_aliases WHERE LOWER(alias_email) = $1 OR LOWER(primary_email) = $1 LIMIT 1`, [emailLower]);
    if (aliasResult.rows.length > 0) {
      console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = true (user_aliases table)`);
      return res.json({ verified: true });
    }

    // 3. Check active user sessions table
    const sessionResult = await pool.query(`SELECT email FROM user_sessions WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    if (sessionResult.rows.length > 0) {
      console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = true (user_sessions table)`);
      return res.json({ verified: true });
    }

    // 4. Check profiles table
    const profileResult = await pool.query(`SELECT email FROM profiles WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    if (profileResult.rows.length > 0) {
      console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = true (profiles table)`);
      return res.json({ verified: true });
    }

    // 5. Check totp_secrets and passkeys tables
    const totpResult = await pool.query(`SELECT is_verified FROM totp_secrets WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    const passkeyResult = await pool.query(`SELECT id FROM passkeys WHERE LOWER(email) = $1 LIMIT 1`, [emailLower]);
    const isTotpPasskeyVerified = (totpResult.rows.length > 0 && totpResult.rows[0].is_verified) || (passkeyResult.rows.length > 0);

    if (isTotpPasskeyVerified) {
      console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = true (totp/passkey table)`);
      return res.json({ verified: true });
    }

    console.log(`[HVEL API] 👤 check-user-verified: ${emailLower} = false`);
    res.json({ verified: false });
  } catch (err) {
    console.error('Error checking user verification:', err);
    res.status(500).json({ verified: false, error: 'Server error' });
  }
});

app.get('/api/nudge-log', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, hvel_user, no_extension_user, nudge_sent_at FROM nudge_log ORDER BY nudge_sent_at DESC`);
    res.json({ success: true, total: result.rows.length, records: result.rows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/clear-nudge-log', async (req, res) => {
  try { await pool.query(`DELETE FROM nudge_log`); res.json({ success: true, message: 'Nudge log cleared' }); }
  catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/test-smtp', async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'to email required' });
  try {
    await hrmsTransporter.sendMail({ from: `"HVEL Test" <${process.env.EMAIL_USER}>`, to, subject: 'HVEL SMTP Test', text: `SMTP working. ${new Date().toISOString()}` });
    console.log(`[HVEL API] ✅ Test email sent to ${to}`);
    res.json({ success: true, message: `Test email sent to ${to}` });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/profile/update', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    if (authEmail !== email.toLowerCase()) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

    await pool.query(
      `INSERT INTO profiles (email, full_name, last_active) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (email) DO UPDATE SET full_name = COALESCE($2, profiles.full_name), last_active = NOW()`,
      [email.toLowerCase(), name]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/verify-hash', async (req, res) => {
  const { hash } = req.body;
  if (!hash) return res.status(400).json({ error: 'Hash required' });
  try {
    const result = await pool.query(`
      SELECT v.sender_email, v.timestamp, v.type, p.full_name, p.last_active
      FROM verifications v
      LEFT JOIN profiles p ON v.sender_email = p.email
      WHERE v.content_hash = $1
      ORDER BY v.timestamp DESC
      LIMIT 1
    `, [hash]);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'No verification found for this hash.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/report-security-alert', async (req, res) => {
  const { email, attacker, reason } = req.body;
  if (!email || !attacker) return res.status(400).json({ error: 'Data missing' });

  try {
    // NEW: Atomic Block - Insert BEFORE sending alerts
    try {
      const alreadyAlerted = await pool.query(
        `SELECT id FROM security_alert_log 
         WHERE LOWER(recipient_email) = $1 AND LOWER(attacker_email) = $2 
         AND alert_sent_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [email.toLowerCase(), attacker.toLowerCase()]
      );

      if (alreadyAlerted.rows.length > 0) {
        console.log(`[HVEL API] ⛔ Alerted recently. Skipping.`);
        return res.json({ success: true, message: 'Already notified recently.' });
      }

      await pool.query(
        `INSERT INTO security_alert_log (recipient_email, attacker_email) VALUES ($1, $2)
         ON CONFLICT (recipient_email, attacker_email) 
         DO UPDATE SET alert_sent_at = NOW() 
         WHERE security_alert_log.alert_sent_at < NOW() - INTERVAL '24 hours'`,
        [email.toLowerCase(), attacker.toLowerCase()]
      );
    } catch (dbErr) {
      console.error("[HVEL API] DB Error in security lock:", dbErr);
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error during security lock' });
  }

  console.log(`[HVEL API] 🚨 SECURITY ALERT for ${email}: ${reason} by ${attacker}`);

  // 1. Alert to the RECIPIENT (The Attest User)
  const recipientMailOptions = {
    from: `"Attest Security" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `⚠️ Security Alert: Identity Mismatch Detected`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden;">
        <div style="background: #ef4444; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Security Alert: ID Mismatch</h2>
        </div>
        <div style="padding: 20px; color: #1f2937;">
          <p>Hello,</p>
          <p>Attest has detected a potential identity mismatch in your conversation with <strong>${attacker}</strong>.</p>
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #991b1b;">Issue: ${reason}</p>
          </div>
          <p>This occurs when a sender uses a verification badge that doesn't belong to them or has been modified.</p>
          <p>We have automatically sent <strong>${attacker}</strong> the instructions to get properly human-verified.</p>
        </div>
      </div>
    `
  };

  // 2. Instructions to the SENDER (The suspicious user)
  const senderMailOptions = {
    from: `"Attest Identity Service" <${process.env.EMAIL_USER}>`,
    to: attacker,
    subject: `⚠️ Verification Required: 3 Steps to Human Identity`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #007A5E; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Verify Your Human Identity</h2>
            <p style="margin: 8px 0 0; opacity: 0.9;">Follow these 3 steps to secure your emails</p>
        </div>
        <div style="padding: 30px; color: #1f2937;">
            <p>Hello,</p>
            <p>Your recent email to <strong>${email}</strong> could not be verified as human. Please complete these 3 steps to get your Attest Approved Stamp:</p>
            
            <table style="width:100%; margin-top:20px; border-collapse:collapse;">
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#007A5E; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">1</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Install HVEL Extension</strong>
                        <span style="font-size:14px; color:#6b7280;">Install the HVEL extension from the <a href="https://chromewebstore.google.com/detail/emgidilonchdpmibbcjlbgkddmpcfmpa?utm_source=item-share-cb" style="color:#007A5E;text-decoration:none;font-weight:600;">Chrome Web Store</a>.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top; padding-bottom:20px;"><div style="width:28px; height:28px; background:#007A5E; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">2</div></td>
                    <td style="padding-bottom:20px;">
                        <strong style="display:block; margin-bottom:4px;">Link Your Account</strong>
                        <span style="font-size:14px; color:#6b7280;">Click the Attest toolbar icon and sign in with your email to link your account.</span>
                    </td>
                </tr>
                <tr>
                    <td style="width:40px; vertical-align:top;"><div style="width:28px; height:28px; background:#059669; color:white; border-radius:50%; text-align:center; line-height:28px; font-weight:bold;">3</div></td>
                    <td>
                        <strong style="display:block; margin-bottom:4px;">Verify Every Email</strong>
                        <span style="font-size:14px; color:#6b7280;">Before clicking "Send", click the <strong>"Verify"</strong> button in your Gmail compose window to attach your Attest Approved Stamp.</span>
                    </td>
                </tr>
            </table>

            <div style="margin-top:30px; text-align:center;">
                <a href="https://attest.page/verify" style="display:inline-block; background:#007A5E; color:white; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:bold;">Open Attest Portal</a>
            </div>
        </div>
      </div>
    `
  };
  try {
    console.log(`[SMTP] 📤 Sending security alerts for ${email}...`);
    // Send both emails
    const info1 = await mainTransporter.sendMail(recipientMailOptions);
    console.log(`[SMTP] ✅ Alert sent to recipient: ${info1.messageId}`);

    const info2 = await mainTransporter.sendMail(senderMailOptions);
    console.log(`[SMTP] ✅ Alert sent to attacker: ${info2.messageId}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[HVEL API] ❌ Error sending security alerts:', err);
    res.status(500).json({ error: 'Failed to send alerts', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Proof of Humanity — Mouse Tracking Bot Detection Analyzer
// ─────────────────────────────────────────────────────────────────────────────
function verifyHumanBehavior(points) {
  if (!points || points.length < 20) {
    // If a human clicks without moving their mouse much, we still pass them
    console.log(`[HUMAN VERIFIED] 🧑 Trigger: Few points (${points ? points.length : 0}), assuming stationary human.`);
    return { success: true };
  }

  const start = points[0];
  const end = points[points.length - 1];

  // Calculate straight-line distance (displacement)
  const displacement = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
  if (displacement < 150) {
    // Small movements are allowed to pass immediately
    console.log(`[HUMAN VERIFIED] 🧑 Trigger: Low displacement (${displacement.toFixed(2)}px), assuming short human click path.`);
    return { success: true };
  }

  // 1. Straightness test (Linear deviation)
  const A = end.y - start.y;
  const B = start.x - end.x;
  const C = end.x * start.y - start.x * end.y;
  const denom = Math.sqrt(A * A + B * B);

  let totalDeviation = 0;
  for (let p of points) {
    const dist = denom > 0 ? Math.abs(A * p.x + B * p.y + C) / denom : 0;
    totalDeviation += dist;
  }
  const avgDeviation = totalDeviation / points.length;

  // 2. Velocity variance check (Standard deviation of speed)
  let speeds = [];
  let prevPoint = points[0];
  for (let i = 1; i < points.length; i++) {
    const curr = points[i];
    const dx = curr.x - prevPoint.x;
    const dy = curr.y - prevPoint.y;
    const dt = curr.t - prevPoint.t || 1; // avoid division by 0
    const dist = Math.sqrt(dx * dx + dy * dy);
    speeds.push(dist / dt);
    prevPoint = curr;
  }

  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  const variance = speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeed, 2), 0) / speeds.length;
  const stdDev = Math.sqrt(variance);

  // 3. Collinearity / Direction changes (Angles between segments)
  let angles = [];
  for (let i = 2; i < points.length; i++) {
    const p1 = points[i - 2];
    const p2 = points[i - 1];
    const p3 = points[i];
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    if (len1 > 0 && len2 > 0) {
      const cos = dot / (len1 * len2);
      const boundedCos = Math.max(-1, Math.min(1, cos));
      angles.push(Math.acos(boundedCos));
    }
  }
  const angleChanges = angles.reduce((sum, a) => sum + a, 0);

  console.log(`[PROOF OF HUMANITY] Points: ${points.length} | Avg Dev: ${avgDeviation.toFixed(3)}px | Speed StdDev: ${stdDev.toFixed(4)}px/ms | Angles: ${angleChanges.toFixed(3)}`);

  // BOT DETECTION thresholds (Extremely permissive so humans never fail):
  // - Perfectly straight line: avgDeviation < 0.1 pixels
  // - Uniform velocity: stdDev < 0.01 px/ms
  // - Collinear movement: angleChanges < 0.01 radians
  if (avgDeviation < 0.1) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Perfect straight line (Avg Dev: ${avgDeviation.toFixed(3)})`);
    return { success: false, error: 'Automated bot movement detected (Linear path).' };
  }
  if (stdDev < 0.01) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Constant velocity (Speed StdDev: ${stdDev.toFixed(4)})`);
    return { success: false, error: 'Automated bot movement detected (Uniform speed).' };
  }
  if (angleChanges < 0.01) {
    console.log(`[BOT DETECTED] 🤖 Trigger: Perfect collinear movement (Angle changes: ${angleChanges.toFixed(3)})`);
    return { success: false, error: 'Automated bot movement detected (Robotic steering).' };
  }

  console.log(`[HUMAN VERIFIED] 🧑 Validation passed successfully.`);
  return { success: true };
}

app.post('/api/verify-human', (req, res) => {
  const { points } = req.body;
  const result = verifyHumanBehavior(points);
  if (result.success) {
    res.json({ success: true, message: 'Identity confirmed as Human' });
  } else {
    res.status(403).json({ success: false, error: result.error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/contact — Contact form submission → forwards to noreply.hvel@gmail.com
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, company, subject, message, type } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  const subjectLine = subject || `[Attest Contact] ${type || 'General Inquiry'} from ${name}`;
  const receivedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'long' });

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:32px 28px;">
        <h2 style="margin:0;color:white;font-size:20px;font-weight:800;letter-spacing:-0.02em;">📬 New Contact Form Submission</h2>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Attest Website — ${receivedAt}</p>
      </div>
      <div style="padding:28px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;width:120px;">Name</td>
            <td style="padding:10px 0;color:#0F172A;font-weight:700;">${name}</td>
          </tr>
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Email</td>
            <td style="padding:10px 0;"><a href="mailto:${email}" style="color:#2563EB;font-weight:700;">${email}</a></td>
          </tr>
          ${company ? `<tr style="border-bottom:1px solid #F1F5F9;"><td style="padding:10px 0;color:#94A3B8;font-weight:600;">Company</td><td style="padding:10px 0;color:#0F172A;font-weight:700;">${company}</td></tr>` : ''}
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Type</td>
            <td style="padding:10px 0;"><span style="background:#EFF6FF;color:#2563EB;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;">${type || 'General Inquiry'}</span></td>
          </tr>
          <tr style="border-bottom:1px solid #F1F5F9;">
            <td style="padding:10px 0;color:#94A3B8;font-weight:600;">Subject</td>
            <td style="padding:10px 0;color:#0F172A;font-weight:600;">${subject || '—'}</td>
          </tr>
        </table>
        <div style="margin-top:20px;">
          <p style="font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Message</p>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:18px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${message}</div>
        </div>
      </div>
      <div style="background:#F8FAFC;padding:16px 28px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:11px;color:#94A3B8;">Reply directly to this email to respond to ${name} at ${email}</p>
      </div>
    </div>`;

  try {
    await mainTransporter.sendMail({
      from: `"Attest Contact" <${process.env.EMAIL_USER}>`,
      to: 'noreply.hvel@gmail.com',
      replyTo: email,
      subject: subjectLine,
      html,
      text: `New contact from ${name} (${email})\nCompany: ${company || 'N/A'}\nType: ${type || 'General'}\nSubject: ${subject || 'N/A'}\n\nMessage:\n${message}\n\nReceived: ${receivedAt}`,
    });

    console.log(`[CONTACT] ✅ Contact form submitted by ${name} <${email}> — forwarded to noreply.hvel@gmail.com`);
    res.json({ success: true, message: 'Message received. We will get back to you within 24 hours.' });
  } catch (err) {
    console.error('[CONTACT] ❌ Failed to send contact email:', err);
    res.status(500).json({ success: false, error: 'Failed to send message. Please try again or email us directly.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLAN MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/plan/status — returns current plan, usage, and limits for a user
app.get('/api/plan/status', async (req, res) => {
  const email = (req.query.email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'email query param required' });

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    
    // Check identity (matches or is linked alias)
    let isIdentityMatch = authEmail === email;
    if (!isIdentityMatch) {
      const aliasCheck = await pool.query(
        'SELECT 1 FROM user_aliases WHERE LOWER(primary_email) = $1 AND LOWER(alias_email) = $2',
        [authEmail, email]
      );
      if (aliasCheck.rows.length > 0) {
        isIdentityMatch = true;
      }
    }

    if (!isIdentityMatch) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${email}).` });
    }

    // Resolve targetEmail to primary account if it is an alias
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [email]);
    let targetEmail = email;
    if (aliasRes.rows.length > 0) {
      targetEmail = aliasRes.rows[0].primary_email.toLowerCase();
    }

    // Auto-create user as free if not exists
    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [targetEmail]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count, plan_expires_at FROM users WHERE email = $1', [targetEmail]);
    const user = userRes.rows[0];
    const planKey = user.plan || 'free';
    const plan = PLANS[planKey] || PLANS.free;

    // Get today's verification quota usage
    const today = new Date().toISOString().split('T')[0];
    const quotaRes = await pool.query(
      `SELECT count FROM plan_quota_log WHERE email = $1 AND feature = 'totp_verify' AND log_date = $2`,
      [targetEmail, today]
    );
    const usedToday = quotaRes.rows.length > 0 ? parseInt(quotaRes.rows[0].count) : 0;

    console.log(`[PLAN API] 📊 Status check — ${email} | Plan: ${planKey} | Used Today: ${usedToday}`);

    res.json({
      success: true,
      email,
      isAlias: aliasRes.rows.length > 0,
      primaryEmail: aliasRes.rows.length > 0 ? aliasRes.rows[0].primary_email.toLowerCase() : null,
      plan: planKey,
      planDetails: {
        name: plan.name,
        totp_daily_limit: plan.totp_daily_limit === Infinity ? 'unlimited' : plan.totp_daily_limit,
        gmail_accounts_limit: plan.gmail_accounts_limit,
        webauthn_enabled: !!plan.webauthn_enabled,
        audit_dashboard: plan.audit_dashboard,
        trust_badges: plan.trust_badges,
      },
      usage: {
        totp_used_today: usedToday,
        totp_remaining_today: plan.totp_daily_limit === Infinity ? 'unlimited' : Math.max(0, plan.totp_daily_limit - usedToday),
        gmail_accounts_count: parseInt(user.gmail_accounts_count) || 1,
      },
      plan_expires_at: user.plan_expires_at || null,
      upgrade_url: planKey === 'free' ? 'https://attest.page/pricing' : null
    });
  } catch (err) {
    console.error('[PLAN API] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── EMAIL ALIAS MANAGEMENT ENDPOINTS ───────────────────────────────────────

// Authentication helper that checks user_sessions, header fallbacks, and auto-restores valid sessions
async function getAuthEmail(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const userEmailHeader = (req.headers['x-user-email'] || req.query.email || req.body?.primaryEmail || req.body?.userEmail || '').trim().toLowerCase();

  // 1. Direct check in user_sessions
  if (token) {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length > 0) {
      return sessionRes.rows[0].email.toLowerCase();
    }
  }

  // 2. Check by X-User-Email header or body email if user exists in database
  if (userEmailHeader && userEmailHeader.includes('@')) {
    const userRes = await pool.query('SELECT email FROM users WHERE LOWER(email) = $1', [userEmailHeader]);
    if (userRes.rows.length > 0) {
      const foundEmail = userRes.rows[0].email.toLowerCase();
      if (token) {
        await pool.query(
          'INSERT INTO user_sessions (email, token) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [foundEmail, token]
        ).catch(() => {});
      }
      return foundEmail;
    }
  }

  // 3. Check if token itself matches a registered user email
  if (token && token.includes('@')) {
    const userRes = await pool.query('SELECT email FROM users WHERE LOWER(email) = $1', [token.toLowerCase()]);
    if (userRes.rows.length > 0) {
      return userRes.rows[0].email.toLowerCase();
    }
  }

  return null;
}

// GET /api/aliases — list all linked email aliases for the logged-in user
app.get('/api/aliases', async (req, res) => {
  try {
    const authEmail = await getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }

    const aliasesRes = await pool.query(
      'SELECT alias_email, created_at FROM user_aliases WHERE LOWER(primary_email) = $1 ORDER BY created_at ASC',
      [authEmail]
    );

    res.json({
      success: true,
      aliases: aliasesRes.rows.map(r => r.alias_email)
    });
  } catch (err) {
    console.error('[ALIASES API] GET Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/aliases/request-otp', async (req, res) => {
  const aliasEmail = (req.body.aliasEmail || req.body.alias_email || '').trim().toLowerCase();
  if (!aliasEmail || !aliasEmail.includes('@')) {
    return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED', message: 'A valid email address is required.' });
  }

  try {
    const authEmail = await getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }

    // Check if the primary account is on the Professional plan
    const userRes = await pool.query('SELECT plan FROM users WHERE email = $1', [authEmail]);
    const planKey = userRes.rows[0]?.plan || 'free';
    if (planKey !== 'professional' && planKey !== 'enterprise') {
      return res.status(403).json({
        error: 'UPGRADE_REQUIRED',
        message: 'Only Professional plan users can link email aliases to share their plan. Please upgrade your plan.'
      });
    }

    // Check current count of aliases (max 5 accounts total = 1 primary + 4 aliases)
    const countRes = await pool.query('SELECT COUNT(*) FROM user_aliases WHERE LOWER(primary_email) = $1', [authEmail]);
    const currentCount = parseInt(countRes.rows[0].count);
    if (currentCount >= 4) {
      return res.status(400).json({
        error: 'ALIAS_LIMIT_REACHED',
        message: 'You have reached the maximum limit of 5 total accounts (1 primary + 4 linked aliases) on your Professional plan.'
      });
    }

    // Check if the alias email is already registered as a primary email or linked alias
    const existingUser = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [aliasEmail]);
    const existingAlias = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [aliasEmail]);
    if (existingUser.rows.length > 0 && aliasEmail !== authEmail) {
      return res.status(400).json({
        error: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email is already registered as a separate primary Attest account.'
      });
    }
    if (existingAlias.rows.length > 0 && existingAlias.rows[0].primary_email.toLowerCase() === authEmail) {
      return res.status(400).json({
        error: 'ALIAS_ALREADY_LINKED',
        message: 'This email is already linked to your account.'
      });
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.query(
      `INSERT INTO user_otps (email, otp, type, expires_at)
       VALUES ($1, $2, 'link_alias', $3)
       ON CONFLICT (email, type)
       DO UPDATE SET otp = $2, expires_at = $3`,
      [aliasEmail, otp, expiresAt]
    );

    await sendTransactionalMail({
      to: aliasEmail,
      subject: `Authorize linked inbox on Attest: ${otp}`,
      title: 'Link Email Inbox Authorization',
      mainContent: `<strong>${authEmail}</strong> has requested to link this email address (<strong>${aliasEmail}</strong>) to their Attest account to share verified email capacity.<br/><br/>Use the verification code below to authorize linking:`,
      code: otp,
      footerNote: `If you did not authorize this request, you can safely ignore this message.`
    }).catch(err => console.error('[ALIAS OTP] Send error:', err.message));

    res.json({ success: true, message: 'Verification code sent to alias email.' });
  } catch (err) {
    console.error('[ALIAS OTP REQUEST] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send verification code.' });
  }
});

// POST /api/aliases — link a new email alias (limit: 5 accounts total for Professional users)
app.post('/api/aliases', async (req, res) => {
  const aliasEmail = (req.body.aliasEmail || req.body.alias_email || '').trim().toLowerCase();
  const otp = (req.body.otp || '').trim();
  if (!aliasEmail || !aliasEmail.includes('@')) {
    return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED', message: 'A valid email address is required.' });
  }
  if (!otp) {
    return res.status(400).json({ error: 'OTP_REQUIRED', message: 'Verification code is required.' });
  }

  try {
    const authEmail = await getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }

    // Check if the primary account is on the Professional plan
    const userRes = await pool.query('SELECT plan FROM users WHERE email = $1', [authEmail]);
    const planKey = userRes.rows[0]?.plan || 'free';
    if (planKey !== 'professional' && planKey !== 'enterprise') {
      return res.status(403).json({
        error: 'UPGRADE_REQUIRED',
        message: 'Only Professional plan users can link email aliases to share their plan. Please upgrade your plan.'
      });
    }

    // Check current count of aliases (max 5 accounts total = 1 primary + 4 aliases)
    const countRes = await pool.query('SELECT COUNT(*) FROM user_aliases WHERE LOWER(primary_email) = $1', [authEmail]);
    const currentCount = parseInt(countRes.rows[0].count);
    if (currentCount >= 4) {
      return res.status(400).json({
        error: 'ALIAS_LIMIT_REACHED',
        message: 'You have reached the maximum limit of 5 total accounts (1 primary + 4 linked aliases) on your Professional plan.'
      });
    }

    // Check if the alias email is already registered as a primary email
    const existingUser = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [aliasEmail]);
    if (existingUser.rows.length > 0 && aliasEmail !== authEmail) {
      return res.status(400).json({
        error: 'EMAIL_ALREADY_REGISTERED',
        message: 'This email is already registered as a separate primary Attest account.'
      });
    }

    // Verify OTP
    const otpRes = await pool.query(
      'SELECT otp, expires_at FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [aliasEmail, 'link_alias']
    );

    if (otpRes.rows.length === 0 || otpRes.rows[0].otp !== otp) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'The verification code entered is incorrect.' });
    }

    if (new Date() > new Date(otpRes.rows[0].expires_at)) {
      return res.status(400).json({ error: 'EXPIRED_OTP', message: 'The verification code has expired. Please request a new one.' });
    }

    // Delete used OTP
    await pool.query(
      'DELETE FROM user_otps WHERE LOWER(email) = $1 AND type = $2',
      [aliasEmail, 'link_alias']
    );

    // Upsert the alias
    await pool.query(
      `INSERT INTO user_aliases (primary_email, alias_email) VALUES ($1, $2)
       ON CONFLICT (alias_email) DO UPDATE SET primary_email = $1`,
      [authEmail, aliasEmail]
    );

    // Update count in users table
    await pool.query(
      'UPDATE users SET gmail_accounts_count = gmail_accounts_count + 1 WHERE email = $1',
      [authEmail]
    );

    res.json({ success: true, message: `Successfully linked ${aliasEmail} as an alias.` });
  } catch (err) {
    console.error('[ALIASES API] POST Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/aliases — unlink/delete an email alias
app.delete('/api/aliases', async (req, res) => {
  const aliasEmail = (req.body.aliasEmail || req.body.alias_email || '').trim().toLowerCase();
  if (!aliasEmail) {
    return res.status(400).json({ error: 'EMAIL_REQUIRED', message: 'Email address is required to unlink.' });
  }

  try {
    const authEmail = await getAuthEmail(req);
    if (!authEmail) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }

    const deleteRes = await pool.query(
      'DELETE FROM user_aliases WHERE LOWER(primary_email) = $1 AND LOWER(alias_email) = $2',
      [authEmail, aliasEmail]
    );

    if (deleteRes.rowCount > 0) {
      await pool.query(
        'UPDATE users SET gmail_accounts_count = GREATEST(1, gmail_accounts_count - 1) WHERE email = $1',
        [authEmail]
      );
      res.json({ success: true, message: `Successfully unlinked ${aliasEmail}.` });
    } else {
      res.status(404).json({ error: 'ALIAS_NOT_FOUND', message: 'This alias was not found linked to your account.' });
    }
  } catch (err) {
    console.error('[ALIASES API] DELETE Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── AUDIT LOG ENDPOINTS ─────────────────────────────────────────────────────

// GET /api/audit-logs — returns all audit logs and aggregated stats for the user
app.get('/api/audit-logs', async (req, res) => {
  try {
    const email = await getAuthEmail(req);
    if (!email) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }

    // Collect all primary & alias emails for this user
    const aliasRes = await pool.query('SELECT alias_email FROM user_aliases WHERE LOWER(primary_email) = $1', [email]);
    const userEmails = [email, ...aliasRes.rows.map(r => r.alias_email.toLowerCase())];

    // Backfill any existing verifications from verifications table into audit_logs
    try {
      const verifRes = await pool.query(
        `SELECT id, sender_email, recipient_email, type, content_hash, timestamp 
         FROM verifications 
         WHERE LOWER(sender_email) = ANY($1) OR LOWER(recipient_email) = ANY($1)
         ORDER BY timestamp DESC LIMIT 100`,
        [userEmails]
      );

      for (const v of verifRes.rows) {
        const vId = v.id;
        const existsCheck = await pool.query(
          `SELECT 1 FROM audit_logs WHERE LOWER(user_email) = ANY($1) AND (metadata->>'verificationId' = $2) LIMIT 1`,
          [userEmails, vId]
        );
        if (existsCheck.rows.length === 0) {
          const isOutgoing = userEmails.includes((v.sender_email || '').toLowerCase());
          const vType = isOutgoing 
            ? ((v.type === 'human' || v.type === 'verified') ? 'sent_stamped_link' : 'sent_unstamped')
            : ((v.type === 'human' || v.type === 'verified') ? 'recv_verified' : 'recv_unverified');
          await pool.query(
            `INSERT INTO audit_logs (user_email, type, email, timestamp, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              email,
              vType,
              (isOutgoing ? (v.recipient_email || 'recipient@verified.com') : (v.sender_email || 'sender@verified.com')).toLowerCase(),
              v.timestamp || new Date(),
              JSON.stringify({
                verificationId: v.id,
                contentHash: v.content_hash,
                sender: v.sender_email,
                recipient: v.recipient_email || 'Recipient',
                subject: isOutgoing ? 'Outgoing Attested Communication' : 'Incoming Verified Communication',
                account: isOutgoing ? v.sender_email : v.recipient_email,
                status: (v.type === 'human' || v.type === 'verified') ? 'VERIFIED' : 'WARNING',
                proof: (v.type === 'human' || v.type === 'verified') ? 'Level 3 · Cryptographic Human Verification' : 'Standard Unsigned Message'
              })
            ]
          );
        }
      }
    } catch (backfillErr) {
      console.warn('[AUDIT LOGS] Verification backfill notice:', backfillErr.message);
    }

    // Get all logs for the user (including aliases), limited to latest 300 for deduplication & performance
    const logsRes = await pool.query(
      `SELECT id, user_email, type, email, timestamp, metadata FROM audit_logs 
       WHERE LOWER(user_email) = ANY($1) 
          OR LOWER(metadata->>'account') = ANY($1)
          OR LOWER(metadata->>'sender') = ANY($1)
          OR LOWER(metadata->>'recipient') = ANY($1)
       ORDER BY timestamp DESC LIMIT 300`,
      [userEmails]
    );

    // In-memory deduplication of existing rows in database
    const seenDedupeKeys = new Set();
    const deduplicatedLogs = [];
    const stats = {
      sent_stamped_link: 0,
      sent_stamped_hash: 0,
      sent_stamped: 0,
      sent_unstamped: 0,
      received_stamped: 0,
      received_unstamped: 0,
      recv_verified: 0,
      recv_unverified: 0
    };

    for (const row of logsRes.rows) {
      const meta = row.metadata || {};
      const timeMs = new Date(row.timestamp).getTime();
      const timeBucket = Math.floor(timeMs / 30000); // 30-second deduplication window

      const key = meta.verificationId 
        ? `v_${meta.verificationId}` 
        : (meta.contentHash 
            ? `h_${row.type}_${meta.contentHash}` 
            : `${row.type}_${(row.email || '').toLowerCase()}_${meta.subject || ''}_${timeBucket}`);

      if (!seenDedupeKeys.has(key)) {
        seenDedupeKeys.add(key);
        deduplicatedLogs.push({
          id: row.id,
          type: row.type,
          email: row.email,
          userEmail: row.user_email,
          timestamp: timeMs,
          extra: row.metadata
        });

        const typeKey = (row.type || '').toLowerCase();
        if (typeKey in stats) {
          stats[typeKey] = (stats[typeKey] || 0) + 1;
        }
      }
    }

    res.json({
      success: true,
      logs: deduplicatedLogs.slice(0, 100),
      stats
    });
  } catch (err) {
    console.error('[AUDIT LOGS GET] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/audit-logs/log — logs a new audit event
app.post('/api/audit-logs/log', async (req, res) => {
  const { type, email: targetEmail, extra } = req.body;
  if (!type) {
    return res.status(400).json({ error: 'type is required' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const primaryEmail = sessionRes.rows[0].email.toLowerCase();
    
    // Fetch valid aliases to determine target user_email
    const aliasRows = await pool.query('SELECT alias_email FROM user_aliases WHERE LOWER(primary_email) = $1', [primaryEmail]);
    const validEmails = [primaryEmail, ...aliasRows.rows.map(r => r.alias_email.toLowerCase())];
    const outlookAliases = validEmails.filter(e => !e.endsWith('@gmail.com') && !e.endsWith('@googlemail.com'));

    let userEmail = primaryEmail;
    if (extra?.provider === 'outlook' || extra?.siteType === 'outlook') {
      if (extra?.account && validEmails.includes(extra.account.toLowerCase()) && !extra.account.toLowerCase().endsWith('@gmail.com')) {
        userEmail = extra.account.toLowerCase();
      } else if (extra?.recipient && validEmails.includes(extra.recipient.toLowerCase()) && !extra.recipient.toLowerCase().endsWith('@gmail.com')) {
        userEmail = extra.recipient.toLowerCase();
      } else if (extra?.sender && validEmails.includes(extra.sender.toLowerCase()) && !extra.sender.toLowerCase().endsWith('@gmail.com')) {
        userEmail = extra.sender.toLowerCase();
      } else if (outlookAliases.length > 0) {
        userEmail = outlookAliases[0];
      }
    } else if (extra?.account && validEmails.includes(extra.account.toLowerCase())) {
      userEmail = extra.account.toLowerCase();
    } else if (extra?.userEmail && validEmails.includes(extra.userEmail.toLowerCase())) {
      userEmail = extra.userEmail.toLowerCase();
    } else if (type.startsWith('sent') && extra?.sender && validEmails.includes(extra.sender.toLowerCase())) {
      userEmail = extra.sender.toLowerCase();
    } else if ((type.startsWith('recv') || type.startsWith('received')) && extra?.recipient && validEmails.includes(extra.recipient.toLowerCase())) {
      userEmail = extra.recipient.toLowerCase();
    }

    if (extra) {
      if (!extra.account || (extra.provider === 'outlook' && extra.account.endsWith('@gmail.com'))) {
        extra.account = userEmail;
      }
    }

    const cleanTarget = (targetEmail || extra?.recipient || 'recipient@verified.com').toLowerCase();

    // 1. Deduplication: Check if an audit log for the same verificationId already exists
    if (extra?.verificationId) {
      const vExists = await pool.query(
        `SELECT type, email, timestamp, metadata, user_email FROM audit_logs 
         WHERE LOWER(user_email) = ANY($1) AND metadata->>'verificationId' = $2 LIMIT 1`,
        [validEmails, extra.verificationId]
      );
      if (vExists.rows.length > 0) {
        return res.json({
          success: true,
          duplicate: true,
          log: {
            type: vExists.rows[0].type,
            email: vExists.rows[0].email,
            userEmail: vExists.rows[0].user_email,
            timestamp: new Date(vExists.rows[0].timestamp).getTime(),
            extra: vExists.rows[0].metadata
          }
        });
      }
    }

    // 2. Deduplication: Check if same contentHash was logged within the last 5 minutes
    if (extra?.contentHash) {
      const hExists = await pool.query(
        `SELECT type, email, timestamp, metadata, user_email FROM audit_logs 
         WHERE LOWER(user_email) = ANY($1) AND metadata->>'contentHash' = $2 AND timestamp > NOW() - INTERVAL '5 minutes' LIMIT 1`,
        [validEmails, extra.contentHash]
      );
      if (hExists.rows.length > 0) {
        return res.json({
          success: true,
          duplicate: true,
          log: {
            type: hExists.rows[0].type,
            email: hExists.rows[0].email,
            userEmail: hExists.rows[0].user_email,
            timestamp: new Date(hExists.rows[0].timestamp).getTime(),
            extra: hExists.rows[0].metadata
          }
        });
      }
    }

    // 3. Deduplication: Check if same type, target, and subject was logged within the last 30 seconds
    const targetSubject = extra?.subject || '';
    const recentExists = await pool.query(
      `SELECT type, email, timestamp, metadata, user_email FROM audit_logs 
       WHERE LOWER(user_email) = $1 AND type = $2 AND LOWER(email) = $3 AND (metadata->>'subject' = $4 OR ($4 = '' AND (metadata->>'subject' IS NULL OR metadata->>'subject' = ''))) AND timestamp > NOW() - INTERVAL '30 seconds' LIMIT 1`,
      [userEmail, type, cleanTarget, targetSubject]
    );
    if (recentExists.rows.length > 0) {
      return res.json({
        success: true,
        duplicate: true,
        log: {
          type: recentExists.rows[0].type,
          email: recentExists.rows[0].email,
          userEmail: recentExists.rows[0].user_email,
          timestamp: new Date(recentExists.rows[0].timestamp).getTime(),
          extra: recentExists.rows[0].metadata
        }
      });
    }

    let logTimestamp = new Date();
    if (extra?.emailTimestamp) {
      const parsed = new Date(extra.emailTimestamp);
      if (!isNaN(parsed.getTime())) {
        logTimestamp = parsed;
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO audit_logs (user_email, type, email, timestamp, metadata) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, user_email, type, email, timestamp, metadata`,
      [userEmail, type, cleanTarget, logTimestamp, extra ? JSON.stringify(extra) : null]
    );

    res.json({
      success: true,
      log: {
        id: insertRes.rows[0].id,
        type: insertRes.rows[0].type,
        email: insertRes.rows[0].email,
        userEmail: insertRes.rows[0].user_email,
        timestamp: new Date(insertRes.rows[0].timestamp).getTime(),
        extra: insertRes.rows[0].metadata
      }
    });
  } catch (err) {
    console.error('[AUDIT LOGS LOG] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/audit-logs/delete — delete selected audit logs or all logs for the user
app.post('/api/audit-logs/delete', async (req, res) => {
  const { ids, all } = req.body;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const emailLower = sessionRes.rows[0].email.toLowerCase();

    // Get primary + alias emails
    const aliasRes = await pool.query('SELECT alias_email FROM user_aliases WHERE LOWER(primary_email) = $1', [emailLower]);
    const validEmails = [emailLower, ...aliasRes.rows.map(r => r.alias_email.toLowerCase())];

    if (all) {
      const delRes = await pool.query(
        `DELETE FROM audit_logs 
         WHERE LOWER(user_email) = ANY($1) 
            OR LOWER(metadata->>'account') = ANY($1)
            OR LOWER(metadata->>'sender') = ANY($1)
            OR LOWER(metadata->>'recipient') = ANY($1)`,
        [validEmails]
      );
      console.log(`[AUDIT LOGS] 🗑️ Cleared all ${delRes.rowCount} audit logs for user: ${emailLower}`);
      return res.json({ success: true, count: delRes.rowCount, message: 'All audit logs deleted successfully from database.' });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const numericIds = ids
        .map(id => typeof id === 'number' ? id : parseInt(String(id).replace(/^log_/, '')))
        .filter(n => !isNaN(n));
      const strIds = ids.map(id => String(id));

      const delRes = await pool.query(
        `DELETE FROM audit_logs 
         WHERE (id = ANY($1::int[]) OR metadata->>'verificationId' = ANY($2::text[]))
           AND (LOWER(user_email) = ANY($3) OR LOWER(metadata->>'account') = ANY($3) OR LOWER(metadata->>'sender') = ANY($3) OR LOWER(metadata->>'recipient') = ANY($3))`,
        [numericIds.length > 0 ? numericIds : [-1], strIds, validEmails]
      );
      console.log(`[AUDIT LOGS] 🗑️ Deleted ${delRes.rowCount} selected audit logs for user: ${emailLower}`);
      return res.json({ success: true, count: delRes.rowCount, message: 'Selected audit logs deleted successfully from database.' });
    }

    res.status(400).json({ error: 'MISSING_IDS', message: 'No log IDs provided for deletion.' });
  } catch (err) {
    console.error('[AUDIT LOGS DELETE] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete audit logs.' });
  }
});

// POST /api/auth/change-password — authenticated password update
app.post('/api/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Current password and new password are required.' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired. Please log in again.' });
    }
    const emailLower = sessionRes.rows[0].email.toLowerCase();

    const userRes = await pool.query('SELECT password_hash FROM users WHERE LOWER(email) = $1', [emailLower]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User account not found.' });
    }

    const currentHash = userRes.rows[0].password_hash;
    if (currentHash && !verifyPassword(currentPassword, currentHash)) {
      return res.status(400).json({ error: 'INVALID_CURRENT_PASSWORD', message: 'Current password does not match.' });
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: policyCheck.message });
    }

    const newHash = hashPassword(newPassword);
    await pool.query('UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2', [newHash, emailLower]);

    console.log(`[AUTH] 🔒 Password successfully changed for: ${emailLower}`);
    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error('[AUTH CHANGE PASSWORD] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update password.' });
  }
});

// DELETE /api/audit-logs/clear — clears all audit logs for the user
app.delete('/api/audit-logs/clear', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const email = sessionRes.rows[0].email.toLowerCase();

    await pool.query('DELETE FROM audit_logs WHERE LOWER(user_email) = $1', [email]);

    res.json({
      success: true,
      message: 'Audit logs cleared successfully'
    });
  } catch (err) {
    console.error('[AUDIT LOGS CLEAR] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plan/check-quota — lightweight pre-check before performing an action
app.post('/api/plan/check-quota', async (req, res) => {
  const { email, feature } = req.body;
  if (!email || !feature) return res.status(400).json({ error: 'email and feature required' });
  const emailLower = email.toLowerCase();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Please log in to your Attest account.' });
  }

  try {
    const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'INVALID_SESSION', message: 'Session expired or invalid. Please log in again.' });
    }
    const authEmail = sessionRes.rows[0].email.toLowerCase();
    
    // Check identity (matches or is linked alias)
    let isIdentityMatch = authEmail === emailLower;
    if (!isIdentityMatch) {
      const aliasCheck = await pool.query(
        'SELECT 1 FROM user_aliases WHERE LOWER(primary_email) = $1 AND LOWER(alias_email) = $2',
        [authEmail, emailLower]
      );
      if (aliasCheck.rows.length > 0) {
        isIdentityMatch = true;
      }
    }

    if (!isIdentityMatch) {
      return res.status(403).json({ error: 'IDENTITY_MISMATCH', message: `Active Attest session (${authEmail}) does not match this email (${emailLower}).` });
    }

    // Resolve targetEmail to primary account if it is an alias
    const aliasRes = await pool.query('SELECT primary_email FROM user_aliases WHERE LOWER(alias_email) = $1', [emailLower]);
    let targetEmail = emailLower;
    if (aliasRes.rows.length > 0) {
      targetEmail = aliasRes.rows[0].primary_email.toLowerCase();
    }

    await pool.query(
      `INSERT INTO users (email, plan) VALUES ($1, 'free') ON CONFLICT (email) DO NOTHING`,
      [targetEmail]
    );
    const userRes = await pool.query('SELECT plan, gmail_accounts_count FROM users WHERE email = $1', [targetEmail]);
    const user = userRes.rows[0];
    const plan = PLANS[user.plan] || PLANS.free;

    let allowed = true;
    let reason = null;
    let used = 0;
    let limit = null;

    if (feature === 'totp_verify') {
      const today = new Date().toISOString().split('T')[0];
      const quotaRes = await pool.query(
        `SELECT count FROM plan_quota_log WHERE email = $1 AND feature = 'totp_verify' AND log_date = $2`,
        [targetEmail, today]
      );
      used = quotaRes.rows.length > 0 ? parseInt(quotaRes.rows[0].count) : 0;
      limit = plan.totp_daily_limit;
      if (used >= limit) {
        allowed = false;
        reason = `You've used all ${limit} free TOTP verifications for today. Resets at midnight UTC.`;
      }
    } else if (feature === 'webauthn') {
      if (!plan.webauthn_enabled) {
        allowed = false;
        reason = 'Biometric authentication requires the Professional plan.';
      }
    } else if (feature === 'gmail_account') {
      used = parseInt(user.gmail_accounts_count) || 1;
      limit = plan.gmail_accounts_limit;
      if (used >= limit) {
        allowed = false;
        reason = `Your plan allows up to ${limit} Gmail account(s).`;
      }
    }

    res.json({
      success: true,
      allowed,
      feature,
      plan: user.plan,
      used: used || 0,
      limit: limit === Infinity ? 'unlimited' : limit,
      reason: allowed ? null : reason,
      upgrade_url: allowed ? null : 'https://attest.page/pricing'
    });
  } catch (err) {
    console.error('[PLAN QUOTA CHECK] Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/create-checkout-session — initiates Stripe Checkout subscription
app.post('/api/create-checkout-session', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  if (!stripe) {
    console.log('[STRIPE] Stripe secret key not configured. Mocking checkout redirect...');
    // If Stripe is not configured, we return a mock success URL so they can test it end-to-end locally!
    const successUrl = `${req.headers.origin || 'http://localhost:3000'}/pricing?session_id=mock_session_id&email=${encodeURIComponent(email)}`;
    return res.json({ id: 'mock_session', url: successUrl });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Attest Professional Plan',
            description: 'Unlimited Behavioral Verifications, WebAuthn Biometric Support, Up to 5 Gmail Accounts'
          },
          unit_amount: 100, // $1.00 USD
          recurring: {
            interval: 'month'
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      allow_promotion_codes: true,
      success_url: `${req.headers.origin || 'http://localhost:3000'}/pricing?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/pricing`,
      customer_email: email.toLowerCase()
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('[STRIPE] Error creating checkout session:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plan/upgrade — called by Stripe webhook or manually to upgrade a user
app.post('/api/plan/upgrade', async (req, res) => {
  const { email, plan, stripe_customer_id } = req.body;
  if (!email || !plan) return res.status(400).json({ error: 'email and plan required' });
  if (!PLANS[plan]) return res.status(400).json({ error: `Unknown plan: ${plan}. Valid: ${Object.keys(PLANS).join(', ')}` });

  try {
    const expiresAt = plan === 'free' ? null : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); // 31 days
    await pool.query(
      `INSERT INTO users (email, plan, stripe_customer_id, plan_expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
       SET plan = $2, stripe_customer_id = COALESCE($3, users.stripe_customer_id), plan_expires_at = $4`,
      [email.toLowerCase(), plan, stripe_customer_id || null, expiresAt]
    );
    console.log(`[PLAN API] ⬆️  Plan upgraded: ${email} → ${plan}`);
    res.json({ success: true, email, plan, plan_expires_at: expiresAt });
  } catch (err) {
    console.error('[PLAN API] Upgrade error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plan/downgrade — called when subscription lapses
app.post('/api/plan/downgrade', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    await pool.query(
      `UPDATE users SET plan = 'free', plan_expires_at = NULL WHERE email = $1`,
      [email.toLowerCase()]
    );
    console.log(`[PLAN API] ⬇️  Plan downgraded to free: ${email}`);
    res.json({ success: true, email, plan: 'free' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plan/quota-log — admin: view quota usage per user per day
app.get('/api/plan/quota-log', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT email, feature, log_date, count
       FROM plan_quota_log
       ORDER BY log_date DESC, count DESC
       LIMIT 100`
    );
    res.json({ success: true, total: result.rows.length, records: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/user/delete-account — GDPR & CCPA compliant data deletion
app.post('/api/user/delete-account', async (req, res) => {
  let email = (req.body?.email || '').trim().toLowerCase();
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const sessionRes = await pool.query('SELECT email FROM user_sessions WHERE token = $1', [token]);
      if (sessionRes.rows.length > 0) {
        email = sessionRes.rows[0].email.toLowerCase();
      }
    } catch {}
  }

  if (!email) return res.status(400).json({ error: 'email is required' });
  const emailLower = email.toLowerCase();

  try {
    // 1. Delete user sessions
    await pool.query('DELETE FROM user_sessions WHERE LOWER(email) = $1', [emailLower]);

    // 2. Delete user aliases
    await pool.query('DELETE FROM user_aliases WHERE LOWER(primary_email) = $1 OR LOWER(alias_email) = $1', [emailLower]);

    // 3. Delete OTPs
    await pool.query('DELETE FROM user_otps WHERE LOWER(email) = $1', [emailLower]);

    // 4. Delete password reset tokens
    await pool.query('DELETE FROM password_reset_tokens WHERE LOWER(email) = $1', [emailLower]);

    // 5. Delete plan quota logs
    await pool.query('DELETE FROM plan_quota_log WHERE LOWER(email) = $1', [emailLower]);

    // 6. Delete audit logs
    await pool.query("DELETE FROM audit_logs WHERE LOWER(user_email) = $1 OR LOWER(metadata->>'account') = $1", [emailLower]);

    // 7. Delete security alert logs
    await pool.query('DELETE FROM security_alert_log WHERE LOWER(recipient_email) = $1 OR LOWER(attacker_email) = $1', [emailLower]);

    // 8. Delete verifications logs associated with this email
    await pool.query('DELETE FROM verifications WHERE LOWER(sender_email) = $1 OR LOWER(recipient_email) = $1', [emailLower]);

    // 9. Delete profile
    await pool.query('DELETE FROM profiles WHERE LOWER(email) = $1', [emailLower]);

    // 10. Delete primary user record
    const result = await pool.query('DELETE FROM users WHERE LOWER(email) = $1', [emailLower]);

    console.log(`[GDPR DELETE] 🗑️ User account & all data permanently purged: ${emailLower}`);
    res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
  } catch (err) {
    console.error('[GDPR DELETE] Error deleting user:', err);
    res.status(500).json({ error: 'Server error during data purging.' });
  }
});

// Global JSON Error Handler (prevents HTML error pages on body-parser/express errors)
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.'
  });
});

const server = app.listen(port, () => {
  console.log(`HVEL Backend listening on port ${port}`);
  // Keep-alive heartbeat every 60 seconds
  setInterval(() => {
    console.log(`[SYSTEM] 🛡️ Backend Heartbeat — Time: ${new Date().toLocaleTimeString()} | Status: Active`);
  }, 60000);
});

server.on('error', (err) => {
  console.error('[SERVER CRITICAL ERROR]', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please kill the other process or change the PORT in .env`);
  }
});
