import { JSONFilePreset } from 'lowdb/node'
import type { Transfer, Balance, Snapshots } from './types';
import type { Low } from 'lowdb';

import balanceData from "./data/balance.json"

type Data = {
    balances: Balance[];
    transfers: Transfer[];
    snapshots: Snapshots[];
}

const defaultData: Data = { balances: balanceData, transfers: [], snapshots: [] }

export const db: Low<Data> = await JSONFilePreset<Data>('db.json', defaultData)