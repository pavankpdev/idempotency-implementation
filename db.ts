import { JSONFilePreset } from 'lowdb/node'
import type { Transfer, Balance, Snapshots } from './types';
import type { Low } from 'lowdb';

import balanceData from "./data/balance.json"

console.log('🗄️  Initializing database...');
console.log(`📊 Loading ${balanceData.length} users from balance data`);

type Data = {
    balances: Balance[];
    transfers: Transfer[];
    snapshots: Snapshots[];
}

const defaultData: Data = { balances: balanceData, transfers: [], snapshots: [] }

let db: Low<Data>;

try {
    db = await JSONFilePreset<Data>('db.json', defaultData);
    console.log('✅ Database initialized successfully');
    console.log(`📋 Current state: ${db.data.balances.length} balances, ${db.data.transfers.length} transfers, ${db.data.snapshots.length} snapshots`);
} catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
}

export { db };