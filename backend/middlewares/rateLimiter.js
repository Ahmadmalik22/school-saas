import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Login Endpoint
 * Protects against brute-force password guessing and dictionary attacks.
 * Allows maximum 5 failed/login requests per 15 minutes per IP address.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per 15 minutes
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Boht zyada login attempts ho chuki hain. Security k lye 15 minute k lye login block kr dia gya hai. 15 minute baad dobara try karein.',
    retryAfterMinutes: 15,
  },
});

/**
 * General API Protection Limiter
 * Protects server from aggressive scrapers, bot floods, and DDoS attacks.
 * Limit is PER IP ADDRESS (per internet connection) - NOT total server-wide!
 * Allows up to 3,000 requests per 15 minutes per IP address (more than enough for 50+ staff on 1 Wi-Fi).
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // 3,000 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Aap k internet connection se boht zyada requests bhej di gyi hain. Baraye meherbani thori dair baad try karein.',
  },
});
