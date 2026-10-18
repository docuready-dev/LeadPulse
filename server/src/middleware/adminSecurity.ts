import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { userStore } from '../services/userStore';

export const adminSecurity = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Secret Gateway Header Check (machine-to-machine internal calls)
  const gatewayToken = req.headers['x-admin-gateway-token'];
  const expectedGateway = process.env.ADMIN_GATEWAY_SECRET;

  if (expectedGateway && gatewayToken === expectedGateway) {
    return next();
  }

  // 2. IP Whitelisting Check (if configured)
  if (process.env.ALLOWED_ADMIN_IPS) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip;
    const allowedIps = process.env.ALLOWED_ADMIN_IPS.split(',').map(ip => ip.trim());
    const normalizedIp = clientIp?.includes('::ffff:') ? clientIp.split('::ffff:')[1] : clientIp;

    if (normalizedIp && !allowedIps.includes(normalizedIp) && !allowedIps.includes(clientIp as string)) {
      if (normalizedIp !== '127.0.0.1' && normalizedIp !== '::1') {
        return res.status(403).json({ error: 'Forbidden: IP not authorized' });
      }
    }
  }

  // 3. User & Session Validation (from Headers or Bearer JWT)
  let userId = (req.headers.userid as string) || '';
  let tokenRole: string | undefined;
  let tokenEmail: string | undefined;

  if (req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      if (decoded) {
        if (!userId && decoded.id) userId = decoded.id;
        if (decoded.role) tokenRole = decoded.role;
        if (decoded.email) tokenEmail = decoded.email;
      }
    } catch {}
  }

  // Direct alias check for Ashley Super Admin
  const cleanId = (userId || '').toLowerCase().trim();
  const cleanEmail = (tokenEmail || '').toLowerCase().trim();
  if (
    cleanId === 'user_ashleyghose64' ||
    cleanId.includes('ashleyghose64') ||
    cleanEmail.includes('ashleyghose64') ||
    tokenRole === 'SUPER_ADMIN' ||
    tokenRole === 'superadmin'
  ) {
    return next();
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing User ID or Bearer token' });
  }

  try {
    let role: string | undefined = tokenRole;

    // Check local store first (supporting both id and email lookup)
    const localUser = userStore.getUserById(userId);
    if (localUser) {
      if (localUser.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com' || localUser._id === 'user_ashleyghose64') {
        return next();
      }
      role = localUser.role;
    }

    // Fallback to Firestore
    if (!role) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const fsData = userDoc.data();
          if (fsData?.email?.toLowerCase().trim() === 'ashleyghose64@gmail.com') {
            return next();
          }
          role = fsData?.role;
        }
      } catch {}
    }

    if (!role) {
      return res.status(403).json({ error: 'Access Denied: User not found.' });
    }
    
    if (role !== 'superadmin' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access Denied: Super Admin privileges required.' });
    }
    
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failure' });
  }
};
