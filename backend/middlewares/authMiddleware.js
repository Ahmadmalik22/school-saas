import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect middleware:
 * Verifies JWT token and attaches authenticated user to req.user.
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login to access this resource.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wholesale_b2b_jwt_secret_token_key_2026_secure');

    // Fetch user without password
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Token is invalid or expired. Please login again.',
    });
  }
};

/**
 * Super Admin (Developer) Only Middleware
 */
export const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Developer / Super Admin privileges required.',
  });
};

/**
 * Dynamic Submodule & Module-Level RBAC Middleware
 * Allows access if:
 * 1. User is SUPER_ADMIN (Developer)
 * 2. User is ADMIN (School Principal / Owner)
 * 3. User's permissions array explicitly includes the permissionKey (or at least one of the keys in array)
 */
export const requirePermission = (permissionKeyOrArray) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      return next();
    }

    const userPerms = Array.isArray(req.user.permissions) ? req.user.permissions : [];

    if (Array.isArray(permissionKeyOrArray)) {
      const hasAny = permissionKeyOrArray.some((key) => userPerms.includes(key));
      if (hasAny) return next();
    } else if (userPerms.includes(permissionKeyOrArray)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied: You do not have permissions for this action/submodule. Please contact your school administrator.`,
    });
  };
};

export const requireModule = requirePermission;
