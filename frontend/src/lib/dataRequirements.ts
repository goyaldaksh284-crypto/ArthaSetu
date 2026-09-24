import db, { getLocal, DEFAULT_TRANSACTIONS } from '@/services/database';

export const MinimumDataRequired = 5;

/**
 * Synchronous, instant check using cached local storage data.
 * Returns true immediately (0ms) so pages never hang on "Checking data requirements...".
 */
export const hasMinimumTransactionsSync = (): boolean => {
  try {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
    const local = getLocal<any[]>(`arthasetu_txs_${userId}`, DEFAULT_TRANSACTIONS);
    return Boolean(local && local.length >= MinimumDataRequired);
  } catch {
    return true;
  }
};

export const hasMinimumTransactions = async (): Promise<boolean> => {
  try {
    if (hasMinimumTransactionsSync()) return true;
    const transactions = await db.transactions.getAll();
    return transactions.length >= MinimumDataRequired;
  } catch (error) {
    console.warn('Error checking minimum transactions, defaulting to true:', error);
    return true;
  }
};

