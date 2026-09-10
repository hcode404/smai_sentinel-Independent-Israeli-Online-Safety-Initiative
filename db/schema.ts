import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{
  collection:text('collection').notNull(), id:text('id').notNull(),
  data:text('data').notNull(), version:integer('version').notNull().default(1),
  createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.collection,t.id]}),index('records_collection_created').on(t.collection,t.createdAt)]);
export const limits=sqliteTable('request_limits',{
  key:text('key').primaryKey(), count:integer('count').notNull(), expires:integer('expires').notNull()
});
