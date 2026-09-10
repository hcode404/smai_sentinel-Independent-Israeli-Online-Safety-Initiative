import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
export function localDatabase(file=':memory:'){
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
    if(!db.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)){
      db.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
      db.prepare('INSERT INTO local_migrations VALUES (?)').run(name);
    }
  }
  const prepare=sql=>{let values=[];const stmt={bind(...v){values=v;return stmt;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};}};return stmt;};
  return {prepare,async batch(stmts){db.exec('BEGIN');try{const out=[];for(const st of stmts)out.push(await st.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}},close(){db.close();}};
}
