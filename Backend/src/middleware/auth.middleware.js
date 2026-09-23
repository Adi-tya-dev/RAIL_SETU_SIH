/**
 * auth.middleware.js
 *
 * Lightweight Role-Based Access Control (RBAC) middleware.
 *
 * Uses a simple API-key + role mapping approach suitable for the SIH demo.
 * In production this would be replaced with JWT + refresh token.
 *
 * Usage:
 *   const { authenticate, requireRole } = require('../middleware/auth.middleware');
 *
 *   router.post('/run', authenticate, requireRole('CONTROLLER'), handler);
 *
 * Request Headers:
 *   X-Api-Key: <key>   — identifies and authenticates the user
 *
 * Roles:
 *   CONTROLLER  — Full access: approve/cancel plans, run pipeline, run emergency sim
 *   ENGINEER    — Can view tasks and read plans; cannot approve or run pipeline
 *   VIEWER      — Read-only access to dashboard and plans
 */

"use strict";

// ─── Demo key → role mapping ──────────────────────────────────────────────────
// In production: replace with DB lookup or JWT verification.
const DEMO_KEYS = {
  "ctrl-railsetu-2026":  "CONTROLLER",
  "eng-railsetu-2026":   "ENGINEER",
  "view-railsetu-2026":  "VIEWER",
};

// Allow override via environment variable (e.g. for testing)
// Format: CONTROLLER:key1,ENGINEER:key2,VIEWER:key3
if (process.env.RBAC_KEYS) {
  try {
    for (const pair of process.env.RBAC_KEYS.split(",")) {
      const [role, key] = pair.split(":");
      if (role && key) DEMO_KEYS[key.trim()] = role.trim();
    }
  } catch (_) { /* ignore malformed env */ }
}

// ─── Middleware: authenticate ─────────────────────────────────────────────────

/**
 * authenticate(req, res, next)
 *
 * Validates X-Api-Key header and attaches req.userRole.
 * If no key is provided, defaults to VIEWER role for read-only endpoints.
 * If an invalid key is provided on a protected endpoint, returns 401.
 */
function authenticate(req, res, next) {
  const key  = req.headers["x-api-key"] || "";
  const role = DEMO_KEYS[key];

  if (!role) {
    // No matching key — treat as unauthenticated viewer for GET requests
    if (req.method === "GET") {
      req.userRole = "VIEWER";
      return next();
    }
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Provide a valid X-Api-Key header.",
      hint: "Demo keys: ctrl-railsetu-2026 (Controller), eng-railsetu-2026 (Engineer), view-railsetu-2026 (Viewer)",
    });
  }

  req.userRole = role;
  res.setHeader("X-Authenticated-Role", role);
  next();
}

// ─── Middleware: requireRole ──────────────────────────────────────────────────

/**
 * requireRole(...allowedRoles)
 *
 * Returns middleware that checks req.userRole against the allowed list.
 * Must be used AFTER authenticate().
 *
 * @param  {...string} allowedRoles  - Roles that can access this route
 * @returns Express middleware
 *
 * @example
 *   router.post('/approve', authenticate, requireRole('CONTROLLER'), handler);
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: Access denied. This action requires one of: ,
        your_role: req.userRole,
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, DEMO_KEYS };
