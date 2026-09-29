// One Durable Object instance is created per conversation. This keeps message
// history sharded by room instead of repeatedly scanning the site's global D1
// records table.
export class ChatRoom {
  constructor(state) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        sender_id TEXT,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_created_at
        ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS messages_sender
        ON messages(sender_id, created_at DESC);
    `);
  }

  async putMessage(message) {
    if (!message?.id || !message?.convId) throw new Error('invalid chat message');
    const data = {...message};
    delete data._version;
    this.sql.exec(
      `INSERT INTO messages (id, created_at, sender_id, data)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         created_at=excluded.created_at,
         sender_id=excluded.sender_id,
         data=excluded.data`,
      String(message.id),
      String(message.createdAt || new Date().toISOString()),
      String(message.senderId || ''),
      JSON.stringify(data)
    );
    return data;
  }

  async importMessages(messages) {
    const accepted = [];
    for (const message of Array.isArray(messages) ? messages.slice(0, 100) : []) {
      if (!message?.id || !message?.convId) continue;
      const data = {...message};
      delete data._version;
      this.sql.exec(
        `INSERT OR IGNORE INTO messages (id, created_at, sender_id, data)
         VALUES (?, ?, ?, ?)`,
        String(message.id), String(message.createdAt || new Date().toISOString()),
        String(message.senderId || ''), JSON.stringify(data)
      );
      accepted.push(data.id);
    }
    return accepted.length;
  }

  async getMessage(id) {
    const row = this.sql.exec('SELECT data FROM messages WHERE id=? LIMIT 1', String(id)).one();
    return row ? JSON.parse(row.data) : null;
  }

  async listMessages(before = '', requestedLimit = 80) {
    const limit = Math.min(100, Math.max(1, Number(requestedLimit) || 80));
    const rows = before
      ? this.sql.exec('SELECT data FROM messages WHERE created_at<? ORDER BY created_at DESC LIMIT ?', String(before), limit).toArray()
      : this.sql.exec('SELECT data FROM messages ORDER BY created_at DESC LIMIT ?', limit).toArray();
    return rows.map(row => JSON.parse(row.data)).reverse();
  }

  async countBySender(senderId, maximum = 3) {
    const rows = this.sql.exec(
      'SELECT id FROM messages WHERE sender_id=? ORDER BY created_at DESC LIMIT ?',
      String(senderId), Math.min(10, Math.max(1, Number(maximum) || 3))
    ).toArray();
    return rows.length;
  }
}
