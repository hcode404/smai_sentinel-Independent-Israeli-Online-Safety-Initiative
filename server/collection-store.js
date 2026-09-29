// Emergency collection storage, independent of D1 and KV quotas. One SQLite
// Durable Object is used per collection, so user, ticket and conversation data
// remain queryable when the primary database is temporarily unavailable.
export class CollectionStore {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    ); CREATE INDEX IF NOT EXISTS records_created_at ON records(created_at DESC);`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/records') {
        const rows = this.sql.exec('SELECT data FROM records ORDER BY created_at DESC LIMIT 10000').toArray();
        return Response.json(rows.map(row => JSON.parse(row.data)));
      }
      if (url.pathname.startsWith('/record/')) {
        const id = decodeURIComponent(url.pathname.slice('/record/'.length));
        if (request.method === 'GET') {
          const rows = this.sql.exec('SELECT data FROM records WHERE id=? LIMIT 1', id).toArray();
          return Response.json(rows[0] ? JSON.parse(rows[0].data) : null);
        }
        if (request.method === 'PUT') {
          const record = await request.json();
          this.sql.exec(`INSERT INTO records (id,created_at,data) VALUES (?,?,?)
            ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at,data=excluded.data`,
            id, String(record.createdAt || record.updatedAt || new Date().toISOString()), JSON.stringify(record));
          return Response.json(record);
        }
        if (request.method === 'DELETE') {
          this.sql.exec('DELETE FROM records WHERE id=?', id);
          return Response.json({ok:true});
        }
      }
      return new Response('Not found', {status:404});
    } catch (error) {
      console.error(JSON.stringify({event:'collection_store_error',message:String(error?.message||error).slice(0,300)}));
      return Response.json({error:'collection storage operation failed'}, {status:500});
    }
  }
}
