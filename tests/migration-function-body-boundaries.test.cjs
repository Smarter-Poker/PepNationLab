const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findTriggerColumnRefs, buildSchemaFromMigrations } = require('../scripts/check_migration_column_drift.js');
const trigger = (fn, table) => `CREATE TRIGGER tr_${fn} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${fn}();`;
test('tagged bodies do not capture NEW/OLD fields from adjacent functions', () => {
  const sql = `CREATE FUNCTION public.one() RETURNS trigger AS $function$ BEGIN RETURN NEW.id; END; $function$ LANGUAGE plpgsql;
CREATE FUNCTION public.two() RETURNS trigger AS $other$ BEGIN RETURN NEW.secret; END; $other$ LANGUAGE plpgsql;
${trigger('one', 'first')} ${trigger('two', 'second')}`;
  assert.deepEqual(findTriggerColumnRefs(sql).map(({table, col}) => [table,col]), [['first','id'],['second','secret']]);
});
test('untagged bodies, nested different tags and long bodies retain genuine references', () => {
  const sql = `CREATE FUNCTION one() RETURNS trigger AS $$ BEGIN PERFORM '$different$'; ${' '.repeat(5000)} RETURN NEW.genuinely_unknown; END; $$ LANGUAGE plpgsql; ${trigger('one','first')}`;
  assert.deepEqual(findTriggerColumnRefs(sql).map(({col}) => col), ['genuinely_unknown']);
});
test('unmapped function bodies cannot introduce fake function declarations into scanning', () => {
  const sql = `CREATE FUNCTION ignored() RETURNS text AS $outer$ SELECT 'CREATE FUNCTION one() RETURNS trigger AS $$ BEGIN RETURN NEW.fake; END; $$'; $outer$ LANGUAGE sql;
CREATE FUNCTION one() RETURNS trigger AS $body$ BEGIN RETURN OLD.id; END; $body$ LANGUAGE plpgsql; ${trigger('one','first')}`;
  assert.deepEqual(findTriggerColumnRefs(sql).map(({col}) => col), ['id']);
});
test('unterminated tagged bodies fail closed', () => {
  assert.throws(() => findTriggerColumnRefs(`CREATE FUNCTION one() RETURNS trigger AS $tag$ BEGIN RETURN NEW.id; ${trigger('one','first')}`), /Unterminated/);
});
test('actual manufacturer migration references only columns on its trigger targets', () => {
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, 'supabase/migrations');
  const schema = buildSchemaFromMigrations(fs.readdirSync(dir).filter(f => f.endsWith('.sql')).map(f => path.join(dir,f)));
  const refs = findTriggerColumnRefs(fs.readFileSync(path.join(dir,'20260715090000_manufacturer_accounts.sql'),'utf8'));
  assert.ok(refs.length > 0);
  assert.deepEqual(refs.filter(r => !schema.get(r.table)?.has(r.col)), []);
});
