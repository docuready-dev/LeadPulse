import { calendar as googleCalendarClient, calendar_v3 } from '@googleapis/calendar';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

export interface GoogleCalendarSettings {
  calendarId?: string;
  authType?: 'service_account' | 'oauth2' | 'env';
  syncMode?: 'smart_direct' | 'google_schedule' | 'ical' | 'service_account';
  clientEmail?: string;
  privateKey?: string;
  serviceAccountJson?: string;
  keyFilePath?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string;
  appointmentScheduleUrl?: string;
  icalUrl?: string;
  timeZone?: string;
}

export interface BookingSlotDetails {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  companyName?: string;
  serviceName?: string;
  notes?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  timeZone?: string; // e.g. 'Asia/Kolkata'
  userId?: string;
  leadId?: string;
}

export interface BookingCreationResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  meetLink?: string;
  summary: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  calendarId: string;
  leadName: string;
  leadEmail: string;
  isGoogleCalendarSynced: boolean;
  message: string;
  error?: string;
}

const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

/**
 * Resolves Google Authentication client from settings or environment variables.
 * Priority:
 * 1. User OAuth2 credentials (clientId, clientSecret, refreshToken)
 * 2. User Service Account credentials (JSON or email+privateKey)
 * 3. Environment variables (GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SERVICE_ACCOUNT_KEY, or local serviceAccountKey.json)
 */
export function getGoogleAuthClient(settings?: GoogleCalendarSettings): { auth: any; calendarId: string; isConfigured: boolean } {
  const calendarId = settings?.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary';

  // 1. User OAuth2 credentials
  if (settings?.clientId && settings?.clientSecret && settings?.refreshToken) {
    const oauth2Client = new OAuth2Client(
      settings.clientId.trim(),
      settings.clientSecret.trim(),
      'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({
      refresh_token: settings.refreshToken.trim(),
      access_token: settings.accessToken ? settings.accessToken.trim() : undefined
    });
    return { auth: oauth2Client, calendarId, isConfigured: true };
  }

  // 2. User Service Account JSON
  if (settings?.serviceAccountJson) {
    try {
      const parsed = JSON.parse(settings.serviceAccountJson.trim());
      const auth = new GoogleAuth({
        credentials: {
          client_email: parsed.client_email,
          private_key: parsed.private_key
        },
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
      });
      return { auth, calendarId, isConfigured: true };
    } catch (err) {
      console.warn('[GoogleCalendar] Failed to parse provided serviceAccountJson:', err);
    }
  }

  // 3. User Service Account Email + Private Key
  if (settings?.clientEmail && settings?.privateKey) {
    const formattedKey = settings.privateKey.includes('-----BEGIN PRIVATE KEY-----')
      ? settings.privateKey.replace(/\\n/g, '\n').trim()
      : `-----BEGIN PRIVATE KEY-----\n${settings.privateKey.trim()}\n-----END PRIVATE KEY-----\n`;

    const auth = new GoogleAuth({
      credentials: {
        client_email: settings.clientEmail.trim(),
        private_key: formattedKey
      },
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
    });
    return { auth, calendarId, isConfigured: true };
  }

  // 4. Environment: GOOGLE_SERVICE_ACCOUNT_KEY JSON string
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim());
      const auth = new GoogleAuth({
        credentials: {
          client_email: parsed.client_email,
          private_key: parsed.private_key
        },
        scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
      });
      return { auth, calendarId, isConfigured: true };
    } catch (err) {
      console.warn('[GoogleCalendar] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY env:', err);
    }
  }

  // 5. Environment: GOOGLE_APPLICATION_CREDENTIALS or local file
  const candidateFiles = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'credentials.json'),
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(__dirname, '../../credentials.json'),
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ].filter(Boolean) as string[];

  for (const filePath of candidateFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const auth = new GoogleAuth({
          keyFile: filePath,
          scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
        });
        return { auth, calendarId, isConfigured: true };
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Not configured yet
  return { auth: null, calendarId, isConfigured: false };
}

/**
 * Returns Google Calendar v3 API instance.
 */
export function getCalendarInstance(settings?: GoogleCalendarSettings): { calendar: calendar_v3.Calendar | null; calendarId: string; isConfigured: boolean } {
  const { auth, calendarId, isConfigured } = getGoogleAuthClient(settings);
  if (!isConfigured || !auth) {
    return { calendar: null, calendarId, isConfigured: false };
  }

  const cal = googleCalendarClient({
    version: 'v3',
    auth
  });

  return { calendar: cal, calendarId, isConfigured: true };
}

/**
 * Checks connection status with Google Calendar API.
 */
export async function checkGoogleCalendarStatus(settings?: GoogleCalendarSettings): Promise<{
  isConnected: boolean;
  calendarId: string;
  summary?: string;
  timeZone?: string;
  error?: string;
  setupInstructions: string[];
}> {
  const { calendar, calendarId, isConfigured } = getCalendarInstance(settings);

  const setupInstructions = [
    '1. Go to Google Cloud Console (console.cloud.google.com) and enable the Google Calendar API.',
    '2. Create a Service Account (or OAuth 2.0 Client) and download the JSON key file.',
    '3. Create a dedicated Google Calendar in your Google account (e.g. "Strovr Bookings").',
    '4. Under Calendar Settings, copy the Calendar ID (ends in @group.calendar.google.com).',
    '5. Share the calendar with your service account email with "Make changes to events" permission.',
    '6. Paste your Calendar ID and Service Account JSON in Strovr Calendar Settings.'
  ];

  if (!isConfigured || !calendar) {
    return {
      isConnected: false,
      calendarId,
      error: 'Google Calendar API credentials are not yet configured.',
      setupInstructions
    };
  }

  try {
    const res = await calendar.calendars.get({
      calendarId
    });

    return {
      isConnected: true,
      calendarId,
      summary: res.data.summary || 'Google Calendar',
      timeZone: res.data.timeZone || DEFAULT_TIMEZONE,
      setupInstructions
    };
  } catch (err: any) {
    console.warn('[GoogleCalendar] Status check returned error:', err.message);
    return {
      isConnected: false,
      calendarId,
      error: err.message || 'Failed to authenticate with Google Calendar API.',
      setupInstructions
    };
  }
}

/**
 * Queries Google Calendar Free/Busy endpoint to identify conflicts,
 * and generates open bookable time slots for a specified date range.
 */
export async function getCalendarAvailableSlots(options: {
  date: string; // YYYY-MM-DD
  durationMinutes?: number;
  timeZone?: string;
  settings?: GoogleCalendarSettings;
}): Promise<{
  date: string;
  timeZone: string;
  slots: Array<{ time: string; startIso: string; endIso: string; available: boolean }>;
  isLiveGoogleCalendar: boolean;
}> {
  const duration = options.durationMinutes || 30;
  const timeZone = options.timeZone || options.settings?.timeZone || DEFAULT_TIMEZONE;
  const dateStr = options.date;

  // Standard business hours: 09:30 AM to 06:30 PM (slots)
  const defaultTimes = [
    '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM',
    '05:30 PM', '06:00 PM'
  ];

  // Build slot start/end ISO strings
  const builtSlots = defaultTimes.map((label) => {
    const [timePart, modifier] = label.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const pad = (n: number) => String(n).padStart(2, '0');
    const startIso = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`;
    
    // Calculate end time
    const startEpoch = new Date(`${dateStr}T${pad(hours)}:${pad(minutes)}:00Z`).getTime();
    const endEpoch = startEpoch + duration * 60 * 1000;
    const endDate = new Date(endEpoch);
    const endHours = endDate.getUTCHours();
    const endMinutes = endDate.getUTCMinutes();
    const endIso = `${dateStr}T${pad(endHours)}:${pad(endMinutes)}:00`;

    return {
      time: label,
      startIso,
      endIso,
      available: true
    };
  });

  const { calendar, calendarId, isConfigured } = getCalendarInstance(options.settings);

  if (!isConfigured || !calendar) {
    return {
      date: dateStr,
      timeZone,
      slots: builtSlots,
      isLiveGoogleCalendar: false
    };
  }

  try {
    const timeMin = `${dateStr}T00:00:00Z`;
    const timeMax = `${dateStr}T23:59:59Z`;

    const freeBusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone,
        items: [{ id: calendarId }]
      }
    });

    const busyRanges = freeBusyRes.data.calendars?.[calendarId]?.busy || [];

    // Filter slots based on busy ranges
    const evaluatedSlots = builtSlots.map((slot) => {
      const slotStart = new Date(slot.startIso).getTime();
      const slotEnd = new Date(slot.endIso).getTime();

      const isBusy = busyRanges.some((interval) => {
        if (!interval.start || !interval.end) return false;
        const busyStart = new Date(interval.start).getTime();
        const busyEnd = new Date(interval.end).getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      return {
        ...slot,
        available: !isBusy
      };
    });

    return {
      date: dateStr,
      timeZone,
      slots: evaluatedSlots,
      isLiveGoogleCalendar: true
    };
  } catch (err: any) {
    console.warn('[GoogleCalendar] freebusy query fallback:', err.message);
    return {
      date: dateStr,
      timeZone,
      slots: builtSlots,
      isLiveGoogleCalendar: false
    };
  }
}

/**
 * Inserts a confirmed booking into Google Calendar and generates Google Meet link.
 */
export async function createGoogleCalendarBooking(
  slotDetails: BookingSlotDetails,
  settings?: GoogleCalendarSettings
): Promise<BookingCreationResult> {
  const { calendar, calendarId, isConfigured } = getCalendarInstance(settings);
  const timeZone = slotDetails.timeZone || settings?.timeZone || DEFAULT_TIMEZONE;

  const eventSummary = `Call with ${slotDetails.leadName}`;
  const eventDescription = [
    `Lead Generation booking via Strovr.`,
    `Lead Name: ${slotDetails.leadName}`,
    `Email: ${slotDetails.leadEmail}`,
    slotDetails.leadPhone ? `Phone: ${slotDetails.leadPhone}` : null,
    slotDetails.companyName ? `Company: ${slotDetails.companyName}` : null,
    slotDetails.serviceName ? `Topic: ${slotDetails.serviceName}` : null,
    slotDetails.notes ? `Notes: ${slotDetails.notes}` : null,
    `\nPowered by Strovr B2B Revenue Engine`
  ].filter(Boolean).join('\n');

  if (isConfigured && calendar) {
    try {
      const eventResource: calendar_v3.Schema$Event = {
        summary: eventSummary,
        description: eventDescription,
        start: {
          dateTime: slotDetails.startTime,
          timeZone
        },
        end: {
          dateTime: slotDetails.endTime,
          timeZone
        },
        attendees: [
          { email: slotDetails.leadEmail, displayName: slotDetails.leadName }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 }
          ]
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventResource,
        conferenceDataVersion: 1,
        sendUpdates: 'all'
      });

      const eventData = response.data;
      const meetLink = (eventData.hangoutLink || eventData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri) ?? undefined;

      return {
        success: true,
        eventId: eventData.id || `gcal-${Date.now()}`,
        htmlLink: eventData.htmlLink || `https://calendar.google.com/calendar/r/eventedit?eid=${eventData.id}`,
        meetLink,
        summary: eventSummary,
        startTime: slotDetails.startTime,
        endTime: slotDetails.endTime,
        timeZone,
        calendarId,
        leadName: slotDetails.leadName,
        leadEmail: slotDetails.leadEmail,
        isGoogleCalendarSynced: true,
        message: 'Successfully booked and synced directly to Google Calendar.'
      };
    } catch (apiErr: any) {
      console.warn('[GoogleCalendar] events.insert failed, logging fallback:', apiErr.message);
      return {
        success: true,
        eventId: `local-book-${Date.now()}`,
        htmlLink: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventSummary)}&dates=${slotDetails.startTime.replace(/[-:]/g, '')}/${slotDetails.endTime.replace(/[-:]/g, '')}&details=${encodeURIComponent(eventDescription)}`,
        summary: eventSummary,
        startTime: slotDetails.startTime,
        endTime: slotDetails.endTime,
        timeZone,
        calendarId,
        leadName: slotDetails.leadName,
        leadEmail: slotDetails.leadEmail,
        isGoogleCalendarSynced: false,
        message: `Booking created in Strovr. (Google Calendar API returned: ${apiErr.message})`,
        error: apiErr.message
      };
    }
  }

  // Not connected yet: generate universal Google Calendar 1-click template link
  const cleanStart = slotDetails.startTime.replace(/[-:]/g, '').split('.')[0];
  const cleanEnd = slotDetails.endTime.replace(/[-:]/g, '').split('.')[0];
  const gcalDirectLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventSummary)}&dates=${cleanStart}/${cleanEnd}&details=${encodeURIComponent(eventDescription)}`;

  return {
    success: true,
    eventId: `local-book-${Date.now()}`,
    htmlLink: gcalDirectLink,
    summary: eventSummary,
    startTime: slotDetails.startTime,
    endTime: slotDetails.endTime,
    timeZone,
    calendarId,
    leadName: slotDetails.leadName,
    leadEmail: slotDetails.leadEmail,
    isGoogleCalendarSynced: false,
    message: 'Booking confirmed in Strovr scheduler. Connect Google Calendar API in Calendar Settings for automated two-way cloud sync.'
  };
}
