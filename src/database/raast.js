/**
 * Raast / Digital Banking & Utility Bills Transactions Database Module
 * Streamlined: Tracks Amount & Commission Fee / Profit for Deposits, Withdrawals, and Bills.
 */

function raastDB(db) {
  return {
    create(data) {
      const txn = db.transaction(() => {
        if (!data || typeof data !== 'object') throw new Error('Transaction data is required');

        const type = data.transaction_type || 'Cash Deposit';
        if (!['Cash Deposit', 'Cash Withdrawal', 'Bill Payment'].includes(type)) {
          throw new Error("Invalid transaction type. Must be 'Cash Deposit', 'Cash Withdrawal', or 'Bill Payment'");
        }

        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Amount must be a positive number');
        }

        // Commission fee / profit:
        let fee = 0;
        if (data.fee_amount !== undefined && data.fee_amount !== null && data.fee_amount !== '') {
          fee = Number(data.fee_amount);
        } else if (type === 'Bill Payment') {
          fee = 20;
        } else {
          fee = Math.ceil(amount / 1000) * 20;
        }

        if (!Number.isFinite(fee) || fee < 0) fee = 0;
        const profit = fee;

        let totalCollected = 0;
        if (type === 'Cash Deposit' || type === 'Bill Payment') {
          totalCollected = amount + fee;
        } else {
          totalCollected = amount;
        }

        const stmt = db.prepare(`
          INSERT INTO raast_transactions (
            transaction_type, amount, fee_amount, profit, total_collected
          ) VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(type, amount, fee, profit, totalCollected);

        const created = db.prepare('SELECT * FROM raast_transactions ORDER BY id DESC LIMIT 1').get();
        return created;
      });

      return txn();
    },

    getAll(filters = {}) {
      let query = 'SELECT * FROM raast_transactions';
      const params = [];
      const conditions = [];

      if (filters.type && filters.type !== 'all') {
        conditions.push('transaction_type = ?');
        params.push(filters.type);
      }

      if (filters.startDate) {
        conditions.push('created_at >= ?');
        params.push(String(filters.startDate).includes(' ') ? filters.startDate : filters.startDate + ' 00:00:00');
      }

      if (filters.endDate) {
        conditions.push('created_at <= ?');
        params.push(String(filters.endDate).includes(' ') ? filters.endDate : filters.endDate + ' 23:59:59');
      }

      if (filters.search) {
        const rawSearch = filters.search.trim();
        const searchPattern = `%${rawSearch.toLowerCase()}%`;
        conditions.push('(LOWER(transaction_type) LIKE ? OR CAST(id AS TEXT) LIKE ? OR CAST(amount AS TEXT) LIKE ? OR CAST(fee_amount AS TEXT) LIKE ?)');
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY id DESC';

      if (filters.limit) {
        query += ` LIMIT ${parseInt(filters.limit, 10)}`;
      }

      return db.prepare(query).all(...params);
    },

    get(id) {
      if (!id) return null;
      return db.prepare('SELECT * FROM raast_transactions WHERE id = ?').get(Number(id));
    },

    getStats(filters = {}) {
      let query = 'SELECT * FROM raast_transactions';
      const params = [];
      const conditions = [];

      if (filters.startDate) {
        conditions.push('created_at >= ?');
        params.push(String(filters.startDate).includes(' ') ? filters.startDate : filters.startDate + ' 00:00:00');
      }

      if (filters.endDate) {
        conditions.push('created_at <= ?');
        params.push(String(filters.endDate).includes(' ') ? filters.endDate : filters.endDate + ' 23:59:59');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const rows = db.prepare(query).all(...params) || [];

      let total_transactions = rows.length;
      let total_volume = 0;

      let total_deposit_count = 0;
      let total_deposit_volume = 0;
      let total_deposit_profit = 0;

      let total_withdrawal_count = 0;
      let total_withdrawal_volume = 0;
      let total_withdrawal_profit = 0;

      let total_bill_count = 0;
      let total_bill_volume = 0;
      let total_bill_profit = 0;

      let total_profit = 0;

      for (const row of rows) {
        const amt = Number(row.amount) || 0;
        const fee = Number(row.fee_amount) || 0;
        const p = (Number(row.profit) || fee);

        total_profit += p;
        total_volume += amt;

        if (row.transaction_type === 'Cash Deposit') {
          total_deposit_count += 1;
          total_deposit_volume += amt;
          total_deposit_profit += p;
        } else if (row.transaction_type === 'Cash Withdrawal') {
          total_withdrawal_count += 1;
          total_withdrawal_volume += amt;
          total_withdrawal_profit += p;
        } else if (row.transaction_type === 'Bill Payment') {
          total_bill_count += 1;
          total_bill_volume += amt;
          total_bill_profit += p;
        }
      }

      return {
        total_transactions,
        total_volume,
        total_deposit_count,
        total_deposit_volume,
        total_deposit_profit,
        total_withdrawal_count,
        total_withdrawal_volume,
        total_withdrawal_profit,
        total_bill_count,
        total_bill_volume,
        total_bill_profit,
        total_profit
      };
    },

    delete(id) {
      if (!id) return false;
      db.prepare('DELETE FROM raast_transactions WHERE id = ?').run(Number(id));
      // The WASM sql.js adapter's run() does not expose a `changes` count,
      // so treat a completed statement (no thrown error) as success.
      return true;
    }
  };
}

module.exports = { raastDB };
