import { Router, Request, Response } from 'express';
import { db } from '../index';

const router = Router();

const getEasyAppointmentsUrl = () => {
  return process.env.EASYAPPOINTMENTS_URL || 'http://localhost:8080';
};

// GET /api/booking/status - Check if Easy!Appointments backend is online
router.get('/status', async (_req: Request, res: Response) => {
  const baseUrl = getEasyAppointmentsUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const isOnline = response.status >= 200 && response.status < 400;
    res.json({
      online: isOnline,
      url: baseUrl,
      adminUrl: `${baseUrl}/index.php/backend`,
      statusCode: response.status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.json({
      online: false,
      url: baseUrl,
      adminUrl: `${baseUrl}/index.php/backend`,
      error: error.message || 'Service unreachable on port 8080',
      hint: 'Run "docker compose up -d easyappointments mysql" to start the PHP/MySQL backend.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/booking/config - Retrieve appointment scheduler configuration
router.get('/config', (req: Request, res: Response) => {
  const baseUrl = getEasyAppointmentsUrl();
  res.json({
    baseUrl,
    clientBookingUrl: baseUrl,
    adminPortalUrl: `${baseUrl}/index.php/backend`,
    database: {
      type: 'MySQL 8.0',
      defaultHost: process.env.MYSQL_HOST || 'localhost',
      defaultPort: Number(process.env.MYSQL_PORT) || 3306,
      defaultDatabase: process.env.MYSQL_DATABASE || 'easyappointments',
      defaultUser: process.env.MYSQL_USER || 'user'
    },
    dockerServices: ['easyappointments', 'mysql', 'leadpulse-server', 'leadpulse-client'],
    embedSnippet: `<iframe src="${baseUrl}" width="100%" height="750" frameborder="0"></iframe>`
  });
});

// POST /api/booking/sync - Bridge a booked appointment to Firestore CRM deals
router.post('/sync', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  const { customerEmail, customerName, serviceName, appointmentDate, dealId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing userid header' });
  }

  try {
    // 1. If dealId is provided, update existing lead deal
    if (dealId) {
      const dealRef = db.collection('leads').doc(dealId);
      const dealDoc = await dealRef.get();
      if (dealDoc.exists) {
        const existingData = dealDoc.data() || {};
        const activities = Array.isArray(existingData.activities) ? existingData.activities : [];
        
        activities.push({
          id: `book-${Date.now()}`,
          type: 'Appointments',
          title: `Booked: ${serviceName || 'Consultation Session'}`,
          text: `Easy!Appointments session confirmed for ${appointmentDate || 'Upcoming date'} with ${customerName || 'Customer'}.`,
          date: new Date().toISOString().split('T')[0],
          author: 'Easy!Appointments Sync',
          status: 'Confirmed'
        });

        await dealRef.update({
          status: 'Demo',
          appointmentDate: appointmentDate || new Date().toISOString(),
          activities
        });

        return res.json({ success: true, message: 'Synced appointment to lead deal', dealId });
      }
    }

    // 2. Otherwise search for matching lead by email
    if (customerEmail) {
      const snapshot = await db.collection('leads')
        .where('userId', '==', userId)
        .where('email', '==', customerEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const leadDoc = snapshot.docs[0];
        const leadData = leadDoc.data();
        const activities = Array.isArray(leadData.activities) ? leadData.activities : [];

        activities.push({
          id: `book-${Date.now()}`,
          type: 'Appointments',
          title: `Booked: ${serviceName || 'Consultation Session'}`,
          text: `Easy!Appointments session confirmed for ${appointmentDate || 'Upcoming date'}.`,
          date: new Date().toISOString().split('T')[0],
          author: 'Easy!Appointments Sync',
          status: 'Confirmed'
        });

        await leadDoc.ref.update({
          status: 'Demo',
          appointmentDate: appointmentDate || new Date().toISOString(),
          activities
        });

        return res.json({ success: true, message: 'Matched and updated existing lead', leadId: leadDoc.id });
      }
    }

    res.json({ success: true, message: 'Appointment logged successfully' });
  } catch (error: any) {
    console.error('Failed to sync appointment with CRM:', error);
    res.status(500).json({ error: 'Failed to sync appointment', details: error.message });
  }
});

export default router;
