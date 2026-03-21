import { getDatabase, executeSQL, tableExists, getTableMeta, getTableNames, closeDatabase } from '../../../../src/core/engine/duckdb';

describe('DuckDB Engine', () => {
  // Use a single database connection for all tests in this file
  beforeAll(async () => {
    await getDatabase();
  });

  beforeEach(async () => {
    // Clean up any existing test tables
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

  describe('getDatabase', () => {
    it('should create database connection', async () => {
      const db = await getDatabase();
      expect(db).toBeDefined();
    });

    it('should return same instance on multiple calls', async () => {
      const db1 = await getDatabase();
      const db2 = await getDatabase();
      expect(db1).toBe(db2);
    });
  });

  describe('executeSQL', () => {
    it('should execute SELECT query', async () => {
      const result = await executeSQL('SELECT 1 as value');
      expect(result).toEqual([{ value: 1 }]);
    });

    it('should execute CREATE TABLE', async () => {
      await executeSQL('CREATE TABLE test_table (id INTEGER, name VARCHAR)');
      const exists = await tableExists('test_table');
      expect(exists).toBe(true);
    });

    it('should execute INSERT and SELECT', async () => {
      await executeSQL('CREATE TABLE insert_test (id INTEGER, value VARCHAR)');
      await executeSQL("INSERT INTO insert_test VALUES (1, 'test')");
      
      const result = await executeSQL('SELECT * FROM insert_test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].value).toBe('test');
    });

    it('should throw error on invalid SQL', async () => {
      await expect(executeSQL('INVALID SQL STATEMENT')).rejects.toThrow();
    });

    it('should handle complex queries with JOIN', async () => {
      await executeSQL('CREATE TABLE users (id INTEGER, name VARCHAR)');
      await executeSQL('CREATE TABLE orders (id INTEGER, user_id INTEGER, amount DOUBLE)');
      await executeSQL("INSERT INTO users VALUES (1, 'Alice')");
      await executeSQL("INSERT INTO orders VALUES (1, 1, 100.0)");
      
      const result = await executeSQL(`
        SELECT u.name, o.amount 
        FROM users u 
        JOIN orders o ON u.id = o.user_id
      `);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
      expect(result[0].amount).toBe(100.0);
    });
  });

  describe('tableExists', () => {
    it('should return false for non-existent table', async () => {
      const exists = await tableExists('non_existent_table');
      expect(exists).toBe(false);
    });

    it('should return true for existing table', async () => {
      await executeSQL('CREATE TABLE exists_test (id INTEGER)');
      const exists = await tableExists('exists_test');
      expect(exists).toBe(true);
    });

    it('should find table with lowercase name', async () => {
      await executeSQL('CREATE TABLE casetest (id INTEGER)');
      expect(await tableExists('casetest')).toBe(true);
    });
  });

  describe('getTableNames', () => {
    it('should return all table names', async () => {
      await executeSQL('CREATE TABLE table_a (id INTEGER)');
      await executeSQL('CREATE TABLE table_b (id INTEGER)');
      
      const names = await getTableNames();
      expect(names).toContain('table_a');
      expect(names).toContain('table_b');
    });
  });

  describe('getTableMeta', () => {
    it('should return null for non-existent table', async () => {
      const meta = await getTableMeta('non_existent');
      expect(meta).toBeNull();
    });

    it('should return correct metadata', async () => {
      await executeSQL('CREATE TABLE meta_test (id INTEGER, name VARCHAR)');
      await executeSQL("INSERT INTO meta_test VALUES (1, 'test')");
      
      const meta = await getTableMeta('meta_test');
      
      expect(meta).not.toBeNull();
      expect(meta?.name).toBe('meta_test');
      expect(meta?.rowCount).toBe(1);
      expect(meta?.columns).toHaveLength(2);
    });

    it('should include column types', async () => {
      await executeSQL('CREATE TABLE types_test (num DOUBLE, txt VARCHAR, bool BOOLEAN)');
      
      const meta = await getTableMeta('types_test');
      
      expect(meta?.columns.find(c => c.name === 'num')?.type).toBe('number');
      expect(meta?.columns.find(c => c.name === 'txt')?.type).toBe('string');
      expect(meta?.columns.find(c => c.name === 'bool')?.type).toBe('boolean');
    });

    it('should include sample values', async () => {
      await executeSQL('CREATE TABLE sample_test (id INTEGER, name VARCHAR)');
      await executeSQL("INSERT INTO sample_test VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')");
      
      const meta = await getTableMeta('sample_test');
      const nameColumn = meta?.columns.find(c => c.name === 'name');
      
      expect(nameColumn?.sampleValues).toContain('Alice');
      expect(nameColumn?.sampleValues.length).toBeLessThanOrEqual(5);
    });
  });
});
