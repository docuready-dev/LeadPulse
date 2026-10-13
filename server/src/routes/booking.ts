import { Router, Request, Response } from 'express';
import { db } from '../index';
import { 
  checkGoogleCalendarStatus, 
  getCalendarAvailableSlots, 
  createGoogleCalendarBooking,
  GoogleCalendarSettings,
  BookingSlotDetails
} from '../services/googleCalendar';
import { sendDirectEmail } from '../services/mailer';

const router = Router();

// Middleware helper to retrieve user's calendar settings
async function getUserCalendarSettings(userId?: string): Promise<GoogleCalendarSettings | undefined> {
  if (!userId) return undefined;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data()?.googleCalendarSettings;
    }
  } catch (err) {
    console.warn('[Booking Route] Failed to fetch user calendar settings:', err);
  }
  return undefined;
}

// GET /api/booking/status - Check Google Calendar integration status
router.get('/status', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  const userSettings = await getUserCalendarSettings(userId);

  try {
    const status = await checkGoogleCalendarStatus(userSettings);
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.json({
      isConnected: false,
      calendarId: userSettings?.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary',
      error: error.message || 'Failed to inspect Google Calendar status',
      setupInstructions: [
        '1. Go to Google Cloud Console (console.cloud.google.com) and enable the Google Calendar API.',
        '2. Create OAuth 2.0 Credentials or a Service Account JSON.',
        '3. Create a dedicated Google Calendar and note its Calendar ID.',
        '4. Save your credentials in Calendar Settings.'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/booking/configure - Save Google Calendar settings in user profile
router.post('/configure', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: missing userid header' });
  }

  const {
    calendarId,
    serviceAccountJson,
    clientEmail,
    privateKey,
    clientId,
    clientSecret,
    refreshToken,
    appointmentScheduleUrl,
    timeZone
  } = req.body;

  const candidateSettings: GoogleCalendarSettings = {
    calendarId: (calendarId || '').trim() || 'primary',
    serviceAccountJson: serviceAccountJson ? serviceAccountJson.trim() : undefined,
    clientEmail: clientEmail ? clientEmail.trim() : undefined,
    privateKey: privateKey ? privateKey.trim() : undefined,
    clientId: clientId ? clientId.trim() : undefined,
    clientSecret: clientSecret ? clientSecret.trim() : undefined,
    refreshToken: refreshToken ? refreshToken.trim() : undefined,
    appointmentScheduleUrl: appointmentScheduleUrl ? appointmentScheduleUrl.trim() : undefined,
    timeZone: timeZone || 'Asia/Kolkata'
  };

  try {
    const verification = await checkGoogleCalendarStatus(candidateSettings);

    await db.collection('users').doc(userId).update({
      googleCalendarSettings: {
        ...candidateSettings,
        verifiedAt: verification.isConnected ? new Date().toISOString() : null,
        isVerified: verification.isConnected
      }
    });

    res.json({
      success: true,
      isConnected: verification.isConnected,
      calendarId: candidateSettings.calendarId,
      message: verification.isConnected
        ? 'Google Calendar connected successfully and verified with Google API!'
        : 'Settings saved. Google API reported: ' + (verification.error || 'Awaiting valid credentials.'),
      details: verification
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update Google Calendar settings', details: err.message });
  }
});

// GET /api/booking/slots - Query free/busy open slots for a specific date
router.get('/slots', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  const userSettings = await getUserCalendarSettings(userId);

  const dateParam = (req.query.date as string) || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const durationParam = Number(req.query.duration) || 30;
  const timeZoneParam = (req.query.timeZone as string) || userSettings?.timeZone || 'Asia/Kolkata';

  try {
    const result = await getCalendarAvailableSlots({
      date: dateParam,
      durationMinutes: durationParam,
      timeZone: timeZoneParam,
      settings: userSettings
    });

    res.json(result);
  } catch (err: any) {
    console.error('[Booking Route] Failed to query available slots:', err);
    res.status(500).json({ error: 'Failed to load available slots', details: err.message });
  }
});

// POST /api/booking/create - Insert new booking into Google Calendar and sync with CRM
router.post('/create', async (req: Request, res: Response) => {
  const userId = req.headers.userid as string;
  const {
    leadName,
    leadEmail,
    leadPhone,
    companyName,
    serviceName = '30-Min Strategy Consultation',
    startTime,
    endTime,
    notes,
    timeZone = 'Asia/Kolkata',
    dealId
  } = req.body;

  if (!leadName || !leadEmail || !startTime) {
    return res.status(400).json({ error: 'Missing required booking fields (leadName, leadEmail, startTime)' });
  }

  const userSettings = await getUserCalendarSettings(userId);

  // Compute endTime if not provided (default 30 mins)
  const resolvedEndTime = endTime || new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString();

  const slotDetails: BookingSlotDetails = {
    leadName,
    leadEmail,
    leadPhone,
    companyName,
    serviceName,
    startTime,
    endTime: resolvedEndTime,
    notes,
    timeZone,
    userId,
    leadId: dealId
  };

  try {
    // 1. Insert into Google Calendar via SDK
    const calendarResult = await createGoogleCalendarBooking(slotDetails, userSettings);

    const title = `Google Calendar: ${serviceName} with ${leadName}`;
    const textDetails = `${serviceName} scheduled on ${new Date(startTime).toLocaleString('en-US', { timeZone })}${calendarResult.meetLink ? ' | Google Meet: ' + calendarResult.meetLink : ''}.${notes ? ' Notes: ' + notes : ''}`;

    // 2. Sync to CRM Leads collection
    let resolvedLeadId = dealId;

    if (dealId) {
      const dealRef = db.collection('leads').doc(dealId);
      const dealDoc = await dealRef.get();
      if (dealDoc.exists) {
        const existingData = dealDoc.data() || {};
        const activities = Array.isArray(existingData.activities) ? existingData.activities : [];

        activities.push({
          id: `gcal-${Date.now()}`,
          type: 'Appointments',
          title,
          text: textDetails,
          date: startTime.split('T')[0],
          timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          author: 'Google Calendar Sync',
          meetLink: calendarResult.meetLink || null,
          status: 'Confirmed'
        });

        await dealRef.update({
          status: 'Demo',
          appointmentDate: startTime,
          timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          activities
        });
      }
    } else if (userId && leadEmail) {
      // Find matching lead by email or create new lead
      const snapshot = await db.collection('leads')
        .where('userId', '==', userId)
        .where('email', '==', leadEmail.trim())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const leadDoc = snapshot.docs[0];
        resolvedLeadId = leadDoc.id;
        const leadData = leadDoc.data();
        const activities = Array.isArray(leadData.activities) ? leadData.activities : [];

        activities.push({
          id: `gcal-${Date.now()}`,
          type: 'Appointments',
          title,
          text: textDetails,
          date: startTime.split('T')[0],
          timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          author: 'Google Calendar Sync',
          meetLink: calendarResult.meetLink || null,
          status: 'Confirmed'
        });

        await leadDoc.ref.update({
          status: 'Demo',
          appointmentDate: startTime,
          timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          activities
        });
      } else if (userId) {
        const newLeadRef = db.collection('leads').doc();
        resolvedLeadId = newLeadRef.id;
        await newLeadRef.set({
          userId,
          businessName: companyName || leadName,
          firstName: leadName.split(' ')[0],
          email: leadEmail,
          phone: leadPhone || '',
          category: 'Appointment Booking',
          fieldOfWork: serviceName,
          status: 'Demo',
          appointmentDate: startTime,
          timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          tags: ['Google Calendar Booking', 'Direct Lead'],
          saved: true,
          activities: [
            {
              id: `gcal-${Date.now()}`,
              type: 'Appointments',
              title,
              text: textDetails,
              date: startTime.split('T')[0],
              timeSlot: new Date(startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              author: 'Google Calendar Sync',
              meetLink: calendarResult.meetLink || null,
              status: 'Confirmed'
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 3. Dispatch Email Confirmation to Attendee
    try {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 16px;">
            Booking Confirmed
          </div>
          <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
            ${serviceName}
          </h2>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            Hi ${leadName}, your consultation session has been confirmed on Google Calendar.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #1e293b; line-height: 1.6;">
            <strong>Date & Time:</strong> ${new Date(startTime).toLocaleString('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' })}<br/>
            <strong>Topic:</strong> ${serviceName}<br/>
            ${calendarResult.meetLink ? `<strong>Google Meet:</strong> <a href="${calendarResult.meetLink}" style="color: #4f46e5; font-weight: 600;">Join Video Meeting</a><br/>` : ''}
            <strong>Calendar ID:</strong> ${calendarResult.calendarId}
          </div>
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${calendarResult.htmlLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700;">
              Add to Google Calendar
            </a>
          </div>
          <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
            LeadPulse Autonomous B2B Outreach & Calendar Scheduling Engine
          </p>
        </div>
      `;

      await sendDirectEmail({
        to: leadEmail,
        subject: `Confirmed: ${serviceName} on ${new Date(startTime).toLocaleDateString('en-US', { timeZone })}`,
        html: emailHtml,
        text: `Your booking for ${serviceName} is confirmed for ${new Date(startTime).toLocaleString('en-US', { timeZone })}.`
      }).catch(err => console.warn('[Booking Route] Optional confirmation email send warning:', err.message));
    } catch (mailErr) {
      // Non-blocking email dispatch failure
      console.warn('[Booking Route] Could not dispatch booking email:', mailErr);
    }

    res.json({
      success: true,
      booking: calendarResult,
      leadId: resolvedLeadId,
      message: 'Appointment scheduled and synchronized successfully.'
    });
  } catch (error: any) {
    console.error('[Booking Route] Booking creation failure:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
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
            meetLink: act.meetLink || null,
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
          meetLink: null,
          status: 'Confirmed'
        });
      }
    });

    res.json(appointments);
  } catch (err: any) {
    console.error('[Booking Route] Failed to fetch appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

export default router;
