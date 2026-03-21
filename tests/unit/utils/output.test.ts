import { formatTable, formatTablesList, formatQueryResult, formatNumber } from '../../../src/utils/output';

describe('Output Utils', () => {
  describe('formatTable', () => {
    it('should format empty rows', () => {
      const result = formatTable(['id', 'name'], []);
      expect(result).toContain('无数据');
    });

    it('should format table with data', () => {
      const result = formatTable(['id', 'name'], [[1, 'Alice'], [2, 'Bob']]);
      
      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
    });

    it('should format null values', () => {
      const result = formatTable(['id', 'value'], [[1, null]]);
      expect(result).toContain('NULL');
    });

    it('should format large numbers', () => {
      const result = formatTable(['amount'], [[1000000]]);
      expect(result).toContain('1.00M');
    });

    it('should format numbers with thousand separator', () => {
      const result = formatTable(['count'], [[5000]]);
      expect(result).toContain('5,000');
    });

    it('should format boolean values', () => {
      const result = formatTable(['active'], [[true], [false]]);
      expect(result).toContain('✓');
      expect(result).toContain('✗');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(60);
      const result = formatTable(['text'], [[longString]]);
      expect(result).toContain('...');
    });
  });

  describe('formatTablesList', () => {
    it('should format empty tables list', () => {
      const result = formatTablesList([]);
      expect(result).toContain('暂无数据表');
    });

    it('should format tables list with data', () => {
      const tables = [
        { name: 'users', rowCount: 100, columns: ['id', 'name', 'email'] },
        { name: 'orders', rowCount: 500, columns: ['id', 'user_id', 'amount'] }
      ];
      
      const result = formatTablesList(tables);
      
      expect(result).toContain('users');
      expect(result).toContain('orders');
      expect(result).toContain('100');
      expect(result).toContain('500');
    });

    it('should truncate column list if more than 5', () => {
      const tables = [
        { name: 'test', rowCount: 10, columns: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
      ];
      
      const result = formatTablesList(tables);
      
      expect(result).toContain('...');
    });
  });

  describe('formatQueryResult', () => {
    it('should format query result', () => {
      const result = formatQueryResult({
        sql: 'SELECT * FROM users',
        columns: ['id', 'name'],
        rows: [[1, 'Alice']],
        rowCount: 1,
        executionTime: 50
      });
      
      expect(result).toContain('SELECT * FROM users');
      expect(result).toContain('Alice');
      expect(result).toContain('1 行');
      expect(result).toContain('50ms');
    });

    it('should handle empty results', () => {
      const result = formatQueryResult({
        sql: 'SELECT * FROM users WHERE id = 999',
        columns: ['id', 'name'],
        rows: [],
        rowCount: 0,
        executionTime: 10
      });
      
      expect(result).toContain('查询无结果');
    });
  });

  describe('formatNumber', () => {
    it('should format billions', () => {
      expect(formatNumber(1500000000)).toBe('1.50B');
    });

    it('should format millions', () => {
      expect(formatNumber(2500000)).toBe('2.50M');
    });

    it('should format thousands', () => {
      expect(formatNumber(3500)).toBe('3.50K');
    });

    it('should format small numbers with locale', () => {
      expect(formatNumber(123)).toBe('123');
    });
  });
});
