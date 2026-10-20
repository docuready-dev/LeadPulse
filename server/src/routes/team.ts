import express from 'express';
import { db } from '../index';
import { syncUserPoolCredits } from './auth';

const router = express.Router();

// GET /api/team - Fetch workspace team members
router.get('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};

    const teamRef = db.collection('team_members');
    const snapshot = await teamRef.where('workspaceId', '==', userId).get();

    if (snapshot.empty) {
      // Initialize only the real authenticated user as the Workspace Owner
      const leadsSnap = await db.collection('leads').where('userId', '==', userId).get();
      const realLeadsCount = leadsSnap.size;

      const ownerMember = {
        workspaceId: userId,
        name: userData.name || 'Workspace Owner',
        email: userData.email || '',
        role: 'Workspace Owner',
        status: 'active',
        leadsAssigned: realLeadsCount,
        monthlyQuota: 0,
        avatar: userData.profile_picture || '',
        createdAt: new Date().toISOString()
      };

      const doc1 = await teamRef.add(ownerMember);
      return res.json([{ _id: doc1.id, ...ownerMember }]);
    }

    const members = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    res.json(members);
  } catch (err: any) {
    console.error('[Team] Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// GET /api/team/limits - Return seat limits and universal token pool
router.get('/limits', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = await syncUserPoolCredits(userId, userDoc.data() || {});
    const plan = (userData.plan || 'free').toLowerCase();
    const seatsSelected = Number(userData.seats_selected) || 10; // default registration seats selection

    let maxSeats = 2; // Free tier has 2 seats
    const defaultBase = plan === 'basic' ? 600 : plan === 'pro' ? 1500 : 15;
    const baseCredits = userData.lead_credits !== undefined ? Number(userData.lead_credits) : defaultBase;
    const topupCredits = userData.topup_credits !== undefined ? Number(userData.topup_credits) : 0;
    const universalTokens = baseCredits + topupCredits;
    let seatPercent = null;

    if (plan === 'basic') {
      // Basic tier: 5 seats total (or 50% of seatsSelected if custom baseline is higher)
      maxSeats = Math.max(5, Math.floor(seatsSelected * 0.5));
      seatPercent = 50;
    } else if (plan === 'pro') {
      // Pro tier: 10 seats total (or 100% of seatsSelected if custom baseline is higher)
      maxSeats = Math.max(10, seatsSelected);
      seatPercent = 100;
    }

    const teamRef = db.collection('team_members');
    const snapshot = await teamRef.where('workspaceId', '==', userId).get();

    res.json({
      plan,
      seatsSelected,
      maxSeats,
      activeSeats: snapshot.size,
      universalTokens,
      lead_credits: baseCredits,
      topup_credits: topupCredits,
      seatPercent
    });
  } catch (err: any) {
    console.error('[Team] Limits error:', err);
    res.status(500).json({ error: 'Failed to fetch team limits' });
  }
});

// PATCH /api/team/seats - Configure seats selected at registration
router.patch('/seats', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { seats_selected } = req.body;
  const numSeats = Number(seats_selected);
  if (!numSeats || numSeats < 2) {
    return res.status(400).json({ error: 'Valid seats count of 2 or more is required' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    await userRef.set({ seats_selected: numSeats }, { merge: true });
    res.json({ success: true, seats_selected: numSeats });
  } catch (err: any) {
    console.error('[Team] Seats update error:', err);
    res.status(500).json({ error: 'Failed to update registration seats' });
  }
});

// Handler to add or invite team member
const handleAddMember = async (req: express.Request, res: express.Response) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { 
    name, 
    email, 
    role = 'Sales Lead / SDR', 
    monthlyQuota = 250, 
    status = 'active',
    leadsAssigned = 0 
  } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Name and Email are required' });

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    const plan = (userData.plan || 'free').toLowerCase();
    const seatsSelected = Number(userData.seats_selected) || 10;

    let maxSeats = 2; // Free tier has 2 seats
    if (plan === 'basic') {
      maxSeats = Math.max(5, Math.floor(seatsSelected * 0.5));
    } else if (plan === 'pro') {
      maxSeats = Math.max(10, seatsSelected);
    }

    const teamRef = db.collection('team_members');
    const existing = await teamRef.where('workspaceId', '==', userId).get();

    if (existing.size >= maxSeats) {
      return res.status(403).json({ 
        error: `Seat limit reached for your ${plan.toUpperCase()} tier (${existing.size}/${maxSeats} seats used). Allotted seats: Free (2 seats), Basic (5 seats), Pro (10 seats). Upgrade your subscription to add more team members.`,
        code: 'SEAT_LIMIT_REACHED',
        maxSeats,
        currentSeats: existing.size,
        plan
      });
    }

    const newMember = {
      workspaceId: userId,
      name,
      email,
      role,
      status: status === 'invited' ? 'invited' : 'active',
      leadsAssigned: Number(leadsAssigned) || 0,
      monthlyQuota: Number(monthlyQuota) || 250,
      avatar: '',
      inviteSentAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    const docRef = await teamRef.add(newMember);
    res.json({ _id: docRef.id, ...newMember });
  } catch (err: any) {
    console.error('[Team] Add/Invite member error:', err);
    res.status(500).json({ error: 'Failed to add team member' });
  }
};

// POST /api/team/invite - Invite a new team member
router.post('/invite', handleAddMember);

// POST /api/team - Add a new team member
router.post('/', handleAddMember);

// PATCH /api/team/:id - Update member role or quota
router.patch('/:id', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  try {
    const docRef = db.collection('team_members').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Member not found' });

    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ _id: updated.id, ...updated.data() });
  } catch (err: any) {
    console.error('[Team] Update error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/team/:id - Remove member from workspace
router.delete('/:id', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  try {
    const docRef = db.collection('team_members').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Member not found' });

    if (doc.data()?.role === 'Workspace Owner') {
      return res.status(400).json({ error: 'Cannot remove the primary Workspace Owner' });
    }

    await docRef.delete();
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Team] Remove error:', err);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
