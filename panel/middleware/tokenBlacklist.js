// ============================================================
// Orbiton JWT Token Blacklist
// Allows server-side revocation of JWT tokens on logout.
// Without this, stolen tokens stay valid until they expire.
// Uses an in-memory Map with TTL cleanup to prevent RAM leak.
// Architecture Note: In-memory state designed specifically for single-process deployments.
// ============================================================

// { token_jti → expiry_timestamp }
const revokedTokens = new Map();

// Clean up expired revocations every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of revokedTokens.entries()) {
    if (now > exp) revokedTokens.delete(jti);
  }
}, 15 * 60 * 1000);

/**
 * Revoke a JWT token (call on logout)
 * @param {string} jti JWT ID (from decoded.jti) or the full token string
 * @param {number} expMs Token expiry epoch in milliseconds
 */
function revokeToken(jti, expMs) {
  revokedTokens.set(jti, expMs);
}

/**
 * Check if a token has been revoked
 * @param {string} jti JWT ID
 */
function isRevoked(jti) {
  return revokedTokens.has(jti);
}

module.exports = { revokeToken, isRevoked };
