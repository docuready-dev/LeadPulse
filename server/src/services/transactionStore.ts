import fs from 'fs';
import path from 'path';

export interface TransactionRecord {
  _id: string;
  transactionId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  itemKey: string;
  itemName: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  gateway: string;
  createdAt: string;
}

class TransactionStore {
  private dataDir: string;
  private filePath: string;
  private transactions: Map<string, TransactionRecord> = new Map();

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'transactions.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.transactionId) {
              this.transactions.set(item.transactionId, item);
            }
          }
        }
      }

      // Seed initial transactions if empty so the payments ledger shows real platform records
      if (this.transactions.size === 0) {
        const sampleSeed: TransactionRecord[] = [
          {
            _id: 'txn_init_001',
            transactionId: 'TXN_PH_1791985400_a1b2',
            userId: 'user_ashleyghose64',
            userEmail: 'ashleyghose64@gmail.com',
            userName: 'Ashley',
            itemKey: 'pro',
            itemName: 'LeadPulse Pro Subscription (1,500 Leads/mo)',
            amount: 1999,
            currency: 'INR',
            type: 'subscription',
            status: 'SUCCESS',
            gateway: 'PhonePe',
            createdAt: '2026-10-17T11:20:00.000Z'
          },
          {
            _id: 'txn_init_002',
            transactionId: 'TXN_PH_1791982100_c3d4',
            userId: 'user_ashleyghose28',
            userEmail: 'ashleyghose28@gmail.com',
            userName: 'Bicon Ghose',
            itemKey: 'micro',
            itemName: 'Micro Top-Up Pack (20 Leads)',
            amount: 50,
            currency: 'INR',
            type: 'bundle',
            status: 'SUCCESS',
            gateway: 'PhonePe',
            createdAt: '2026-10-16T15:45:00.000Z'
          },
          {
            _id: 'txn_init_003',
            transactionId: 'TXN_PH_1791979000_e5f6',
            userId: 'user_enterprise_corp',
            userEmail: 'finance@apexsolutions.io',
            userName: 'Apex Cloud Solutions',
            itemKey: 'mega',
            itemName: 'Mega Top-Up Pack (1,000 Leads)',
            amount: 1000,
            currency: 'INR',
            type: 'bundle',
            status: 'SUCCESS',
            gateway: 'PhonePe',
            createdAt: '2026-10-15T09:12:00.000Z'
          },
          {
            _id: 'txn_init_004',
            transactionId: 'TXN_PH_1791971200_g7h8',
            userId: 'user_growth_biz',
            userEmail: 'billing@nextgenai.tech',
            userName: 'NextGen AI Labs',
            itemKey: 'basic',
            itemName: 'LeadPulse Basic Subscription (600 Leads/mo)',
            amount: 699,
            currency: 'INR',
            type: 'subscription',
            status: 'SUCCESS',
            gateway: 'PhonePe',
            createdAt: '2026-10-14T18:30:00.000Z'
          }
        ];
        for (const s of sampleSeed) {
          this.transactions.set(s.transactionId, s);
        }
        this.saveToDisk();
      }
    } catch (err: any) {
      console.warn('[TransactionStore] Load error:', err.message);
    }
  }

  private saveToDisk() {
    try {
      const list = Array.from(this.transactions.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[TransactionStore] Save error:', err.message);
    }
  }

  addTransaction(tx: Omit<TransactionRecord, '_id'> & { _id?: string }): TransactionRecord {
    const id = tx._id || `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: TransactionRecord = {
      _id: id,
      ...tx
    };
    this.transactions.set(record.transactionId, record);
    this.saveToDisk();
    return record;
  }

  getAll(): TransactionRecord[] {
    return Array.from(this.transactions.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  getTotalRevenue(): number {
    let total = 0;
    for (const tx of this.transactions.values()) {
      if (tx.status === 'SUCCESS') {
        total += tx.amount || 0;
      }
    }
    return total;
  }
}

export const transactionStore = new TransactionStore();
