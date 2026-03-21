import * as fs from 'fs';
import * as path from 'path';
import { parseCSV, importCSV } from '../../../../src/core/importer/csv';
import { executeSQL, closeDatabase, getDatabase } from '../../../../src/core/engine/duckdb';

// Mock the lancedb import
jest.mock('../../../../src/core/engine/lancedb', () => ({
  indexTableSchema: jest.fn().mockResolvedValue(undefined)
}));

describe('CSV Importer', () => {
  const fixturesDir = path.join(__dirname, '../../../fixtures');

  beforeAll(async () => {
    await getDatabase();
  });

  afterEach(async () => {
    // Clean up test tables
    try {
      const tables = await executeSQL("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
      for (const t of tables) {
        await executeSQL(`DROP TABLE IF EXISTS "${t.table_name}"`);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('parseCSV', () => {
    it('should parse simple CSV with headers', async () => {
      const result = await parseCSV(path.join(fixturesDir, 'sample.csv'));
      
      expect(result.headers).toEqual(['id', 'name', 'value']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual(['1', 'Alice', '100']);
      expect(result.rows[1]).toEqual(['2', 'Bob', '200']);
      expect(result.rows[2]).toEqual(['3', 'Charlie', '300']);
    });

    it('should infer column types correctly', async () => {
      const result = await parseCSV(path.join(fixturesDir, 'types.csv'));
      
      expect(result.columnTypes.get('num')).toBe('number');
      expect(result.columnTypes.get('str')).toBe('string');
      expect(result.columnTypes.get('date')).toBe('date');
      expect(result.columnTypes.get('bool')).toBe('boolean');
    });

    it('should throw error on empty file', async () => {
      const csvPath = path.join(fixturesDir, 'empty-test.csv');
      fs.writeFileSync(csvPath, '');
      
      await expect(parseCSV(csvPath)).rejects.toThrow('CSV 文件为空');
      
      fs.unlinkSync(csvPath);
    });

    it('should handle quoted values', async () => {
      const csvPath = path.join(fixturesDir, 'quoted-test.csv');
      fs.writeFileSync(csvPath, 'id,name\n1,"John, Doe"\n2,"Quoted ""value"""');
      
      const result = await parseCSV(csvPath);
      
      expect(result.rows[0][1]).toBe('John, Doe');
      expect(result.rows[1][1]).toBe('Quoted "value"');
      
      fs.unlinkSync(csvPath);
    });

    it('should handle whitespace in values', async () => {
      const csvPath = path.join(fixturesDir, 'whitespace-test.csv');
      fs.writeFileSync(csvPath, 'id,  name  ,value\n1,  Alice  ,100');
      
      const result = await parseCSV(csvPath);
      
      expect(result.headers[1]).toBe('name');
      expect(result.rows[0][1]).toBe('Alice');
      
      fs.unlinkSync(csvPath);
    });
  });

  describe('importCSV', () => {
    it('should import CSV to database and return metadata', async () => {
      const meta = await importCSV(path.join(fixturesDir, 'sample.csv'), 'test_import');
      
      expect(meta.name).toBe('test_import');
      expect(meta.rowCount).toBe(3);
      expect(meta.columns).toHaveLength(3);
      expect(meta.columns.map(c => c.name)).toContain('id');
      expect(meta.columns.map(c => c.name)).toContain('name');
      expect(meta.columns.map(c => c.name)).toContain('value');
    });

    it('should use filename as table name if not provided', async () => {
      const meta = await importCSV(path.join(fixturesDir, 'sample.csv'));
      
      expect(meta.name).toBe('sample');
    });

    it('should replace existing table with same name', async () => {
      // First import
      await importCSV(path.join(fixturesDir, 'sample.csv'), 'replace_test');
      
      // Second import with same name
      const meta = await importCSV(path.join(fixturesDir, 'types.csv'), 'replace_test');
      
      expect(meta.rowCount).toBe(2); // types.csv has 2 rows
    });

    it('should sanitize invalid table names', async () => {
      const meta = await importCSV(path.join(fixturesDir, 'sample.csv'), 'Test-Table Name!');
      
      expect(meta.name).toBe('test_table_name_');
    });

    it('should correctly infer and store column types', async () => {
      await importCSV(path.join(fixturesDir, 'types.csv'), 'types_test');
      
      const result = await executeSQL('SELECT * FROM types_test ORDER BY num');
      
      expect(result).toHaveLength(2);
      expect(typeof result[0].num).toBe('number');
      expect(typeof result[0].bool).toBe('boolean');
    });

    it('should sanitize special characters to underscores', async () => {
      // '!!!' will be sanitized to '___' (not empty)
      const meta = await importCSV(path.join(fixturesDir, 'sample.csv'), '!!!');
      
      expect(meta.name).toBe('___');
      expect(meta.rowCount).toBe(3);
    });
  });
});
