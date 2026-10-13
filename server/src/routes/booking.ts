import { Router, Request, Response } from 'express';
import { db } from '../index';

const router = Router();

const getEasyAppointmentsUrl = () => {
  return process.env.EASYAPPOINTMENTS_URL || 'http://localhost:8088';
};

// GET /api/booking/status - Check if Easy!Appointments backend is online
router.get('/status', async (_req: Request, res: Response) => {
  const baseUrl = getEasyAppointmentsUrl();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const bodyText = await response.text().catch(() => '');

    // Detect if port is occupied by another local service (e.g., Mint HTTP Server on port 8080)
    const isMintServer = bodyText.includes('Mint HTTP Server') || bodyText.includes('MicroFlex') || bodyText.includes('MotiFlex');
    if (isMintServer) {
      return res.json({
        online: false,
        url: baseUrl,
        adminUrl: `${baseUrl}/index.php/backend`,
        statusCode: response.status,
        error: 'Port collision detected: Port 8080 is running Mint HTTP Server (motion controller), not Easy!Appointments. Please use port 8088.',
        hint: 'Easy!Appointments has been mapped to port 8088 to avoid colliding with Mint HTTP Server.',
        timestamp: new Date().toISOString()
      });
    }

    const isEasyAppointments = bodyText.includes('Easy!Appointments') || bodyText.includes('easyappointments') || bodyText.includes('alextselegidis');
    const isOnline = (response.status >= 200 && response.status < 400) && (isEasyAppointments || !bodyText.includes('Controller.aspx'));

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
      error: error.message || 'Service unreachable on port 8088',
      hint: 'Run "docker compose up -d easyappointments mysql" on port 8088, or use the built-in LeadPulse scheduler.',
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
  const { 
    customerEmail, 
    customerName, 
    customerPhone,
    serviceName, 
    appointmentDate, 
    timeSlot,
    notes,
    dealId 
  } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing userid header' });
  }

  const cleanDate = appointmentDate || new Date().toISOString();
  const title = `Booked: ${serviceName || 'Consultation Session'} (${timeSlot || 'Scheduled'})`;
  const textDetails = `${serviceName || 'Session'} confirmed for ${cleanDate} ${timeSlot ? 'at ' + timeSlot : ''} with ${customerName || 'Customer'}.${notes ? ' Notes: ' + notes : ''}`;

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
          title,
          text: textDetails,
          date: new Date().toISOString().split('T')[0],
          timeSlot: timeSlot || '',
          author: 'LeadPulse Scheduler',
          status: 'Confirmed'
        });

        await dealRef.update({
          status: 'Demo',
          appointmentDate: cleanDate,
          timeSlot: timeSlot || '',
          activities
        });

        return res.json({ success: true, message: 'Synced appointment to lead deal', dealId });
      }
    }

    // 2. Otherwise search for matching lead by email
    if (customerEmail) {
      const snapshot = await db.collection('leads')
        .where('userId', '==', userId)
        .where('email', '==', customerEmail.trim())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const leadDoc = snapshot.docs[0];
        const leadData = leadDoc.data();
        const activities = Array.isArray(leadData.activities) ? leadData.activities : [];

        activities.push({
          id: `book-${Date.now()}`,
          type: 'Appointments',
          title,
          text: textDetails,
          date: new Date().toISOString().split('T')[0],
          timeSlot: timeSlot || '',
          author: 'LeadPulse Scheduler',
          status: 'Confirmed'
        });

        await leadDoc.ref.update({
          status: 'Demo',
          appointmentDate: cleanDate,
          timeSlot: timeSlot || '',
          activities
        });

        return res.json({ success: true, message: 'Matched and updated existing lead', leadId: leadDoc.id });
      }
    }

    // 3. If no matching lead, create a new contact in CRM
    const newLeadRef = db.collection('leads').doc();
    const newLeadData = {
      userId,
      businessName: customerName || (customerEmail ? customerEmail.split('@')[0] : 'Consultation Prospect'),
      firstName: customerName ? customerName.split(' ')[0] : 'Prospect',
      email: customerEmail || '',
      phone: customerPhone || '',
      category: 'Appointment Booking',
      fieldOfWork: serviceName || 'Direct Booking',
      status: 'Demo',
      appointmentDate: cleanDate,
      timeSlot: timeSlot || '',
      tags: ['Booked Meeting', 'LeadPulse Scheduler'],
      saved: true,
      activities: [
        {
          id: `book-${Date.now()}`,
          type: 'Appointments',
          title,
          text: textDetails,
          date: new Date().toISOString().split('T')[0],
          timeSlot: timeSlot || '',
          author: 'LeadPulse Scheduler',
          status: 'Confirmed'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await newLeadRef.set(newLeadData);
    res.json({ success: true, message: 'New lead and appointment created successfully', leadId: newLeadRef.id });
  } catch (error: any) {
    console.error('Failed to sync appointment with CRM:', error);
    res.status(500).json({ error: 'Failed to sync appointment', details: error.message });
  }
});

// GET /api/booking/appointments - Retrieve all booked appointments for user
router.get('/appointments', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing userid header' });
  }

  try {
    const snapshot = await db.collection('leads')
      .where('userId', '==', userId)
      .where('status', '==', 'Demo')
      .get();

    const appointments: any[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activities = Array.isArray(data.activities) ? data.activities : [];
      const bookingActivities = activities.filter((a: any) => a.type === 'Appointments');

      if (bookingActivities.length > 0) {
        bookingActivities.forEach((act: any) => {
          appointments.push({
            id: act.id,
            leadId: doc.id,
            businessName: data.businessName,
            customerName: data.firstName || data.businessName,
            customerEmail: data.email,
            customerPhone: data.phone,
            appointmentDate: data.appointmentDate || act.date,
            timeSlot: data.timeSlot || act.timeSlot || '',
            title: act.title,
            status: act.status || 'Confirmed'
          });
        });
      } else if (data.appointmentDate) {
        appointments.push({
          id: `lead-app-${doc.id}`,
          leadId: doc.id,
          businessName: data.businessName,
          customerName: data.firstName || data.businessName,
          customerEmail: data.email,
          customerPhone: data.phone,
          appointmentDate: data.appointmentDate,
          timeSlot: data.timeSlot || '',
          title: 'Consultation Session',
          status: 'Confirmed'
        });
      }
    });

    res.json(appointments);
  } catch (err: any) {
    console.error('Failed to fetch appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

export default router;
