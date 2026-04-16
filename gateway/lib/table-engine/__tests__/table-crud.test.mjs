/**
 * Tests for database object layer + schema layer MCP tools (4.3D)
 * Run: node --test gateway/lib/table-engine/__tests__/table-crud.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runTableEngineMigrations } from '../migrations.js';
import { createSchema } from '../schema.js';

function setup() {
  const db = new Database(':memory:');
  runTableEngineMigrations(db);
  const schema = createSchema(db);
  return { db, schema };
}

// ── create_table ──

test('create_table: creates empty table with id and title', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'My Table' });
  assert.ok(t.id);
  assert.equal(t.title, 'My Table');
});

test('create_table: creates table with initial columns', () => {
  const { schema } = setup();
  const t = schema.createTable({
    title: 'With Cols',
    columns: [
      { title: 'Name', uidt: 'SingleLineText' },
      { title: 'Score', uidt: 'Number' },
    ],
  });
  const fields = schema.listFields(t.id).filter(f => !f.is_primary);
  assert.equal(fields.length, 2);
  assert.ok(fields.some(f => f.title === 'Name'));
  assert.ok(fields.some(f => f.title === 'Score'));
});

test('create_table: describe_table consistency after creation', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Describe Me', columns: [{ title: 'Field1', uidt: 'SingleLineText' }] });
  const fields = schema.listFields(t.id);
  assert.ok(fields.length > 0);
  assert.ok(fields.some(f => f.title === 'Field1'));
});

// ── add_column / update_column / delete_column / reorder_columns ──

test('add_column: adds new column to existing table', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Cols Test' });
  const f = schema.addField(t.id, { title: 'Email', uidt: 'Email' });
  assert.ok(f);
  const fields = schema.listFields(t.id);
  assert.ok(fields.some(ff => ff.title === 'Email'));
});

test('add_column: multiple columns retain independent physical columns', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Multi' });
  schema.addField(t.id, { title: 'A', uidt: 'SingleLineText' });
  schema.addField(t.id, { title: 'B', uidt: 'Number' });
  const fields = schema.listFields(t.id).filter(f => !f.is_primary);
  assert.equal(fields.length, 2);
  const physCols = fields.map(f => f.physical_column);
  assert.equal(new Set(physCols).size, 2, 'distinct physical columns');
});

test('update_column: renames a column', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Rename' });
  const field = schema.addField(t.id, { title: 'OldName', uidt: 'SingleLineText' });
  schema.updateField(field.id, { title: 'NewName' });
  const fields = schema.listFields(t.id);
  assert.ok(fields.some(f => f.title === 'NewName'));
  assert.ok(!fields.some(f => f.title === 'OldName'));
});

test('update_column: rejects physical_column patch (immutable)', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Immutable' });
  const field = schema.addField(t.id, { title: 'F', uidt: 'SingleLineText' });
  assert.throws(() => schema.updateField(field.id, { physical_column: 'f_hax' }), /immutable/);
});

test('delete_column: removes column from listFields', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Del Col' });
  const field = schema.addField(t.id, { title: 'Temp', uidt: 'SingleLineText' });
  schema.dropField(field.id);
  const fields = schema.listFields(t.id);
  assert.ok(!fields.some(f => f.id === field.id));
});

test('delete_column: other columns survive deletion', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Survive' });
  schema.addField(t.id, { title: 'Keep', uidt: 'SingleLineText' });
  const toDelete = schema.addField(t.id, { title: 'Drop', uidt: 'Number' });
  schema.dropField(toDelete.id);
  const fields = schema.listFields(t.id);
  assert.ok(fields.some(f => f.title === 'Keep'));
  assert.ok(!fields.some(f => f.title === 'Drop'));
});

test('reorder_columns: updates position of columns', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Reorder' });
  const f1 = schema.addField(t.id, { title: 'First', uidt: 'SingleLineText' });
  const f2 = schema.addField(t.id, { title: 'Second', uidt: 'Number' });
  schema.updateField(f2.id, { position: 0 });
  schema.updateField(f1.id, { position: 1 });
  const fields = schema.listFields(t.id).filter(f => !f.is_primary);
  const sorted = [...fields].sort((a, b) => a.position - b.position);
  assert.equal(sorted[0].title, 'Second');
  assert.equal(sorted[1].title, 'First');
});

// ── describe_table consistency ──

test('describe_table consistency: listFields after add + delete returns only live columns', () => {
  const { schema } = setup();
  const t = schema.createTable({ title: 'Consistency' });
  schema.addField(t.id, { title: 'Alive', uidt: 'SingleLineText' });
  const deleted = schema.addField(t.id, { title: 'Dead', uidt: 'Number' });
  schema.dropField(deleted.id);
  const fields = schema.listFields(t.id);
  assert.ok(fields.some(f => f.title === 'Alive'));
  assert.ok(!fields.some(f => f.title === 'Dead'));
});

// ── Row-level regression ──

test('row regression: physical column present in DB after adding a column', () => {
  const { db, schema } = setup();
  const t = schema.createTable({ title: 'RowReg', columns: [{ title: 'Val', uidt: 'SingleLineText' }] });
  const field = schema.listFields(t.id).find(f => f.title === 'Val');
  assert.ok(field, 'Val field found');
  const physTable = `utbl_${t.id}_rows`;
  const tableInfo = db.prepare(`PRAGMA table_info("${physTable}")`).all();
  assert.ok(tableInfo.some(c => c.name === field.physical_column));
});

test('row regression: physical column removed from DB after dropField', () => {
  const { db, schema } = setup();
  const t = schema.createTable({ title: 'PhysReg' });
  const field = schema.addField(t.id, { title: 'X', uidt: 'SingleLineText' });
  const physTable = `utbl_${t.id}_rows`;
  let tableInfo = db.prepare(`PRAGMA table_info("${physTable}")`).all();
  assert.ok(tableInfo.some(c => c.name === field.physical_column));
  schema.dropField(field.id);
  tableInfo = db.prepare(`PRAGMA table_info("${physTable}")`).all();
  assert.ok(!tableInfo.some(c => c.name === field.physical_column));
});
