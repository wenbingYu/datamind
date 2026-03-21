import { SQLBuilder } from '../../../../src/core/llm/sql-builder';
import { LLMClient } from '../../../../src/core/llm/client';
import { TableMeta } from '../../../../src/types';

// Mock the LLM client
jest.mock('../../../../src/core/llm/client');

describe('SQLBuilder', () => {
  let builder: SQLBuilder;
  let mockClient: jest.Mocked<LLMClient>;

  const mockTables: TableMeta[] = [{
    name: 'sales',
    rowCount: 100,
    columns: [
      { name: 'id', type: 'number', nullable: false, sampleValues: [1, 2, 3] },
      { name: 'product', type: 'string', nullable: false, sampleValues: ['iPhone', 'Mac'] },
      { name: 'amount', type: 'number', nullable: false, sampleValues: [1000, 2000] }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }];

  beforeEach(() => {
    mockClient = {
      chat: jest.fn(),
      chatWithJSON: jest.fn()
    } as any;
    
    builder = new SQLBuilder(mockClient);
  });

  describe('generateSQL', () => {
    it('should generate SQL from natural language', async () => {
      mockClient.chat.mockResolvedValue('SELECT * FROM sales LIMIT 10');
      
      const sql = await builder.generateSQL('显示前10条销售记录', mockTables);
      
      expect(sql).toBe('SELECT * FROM sales LIMIT 10');
      expect(mockClient.chat).toHaveBeenCalled();
    });

    it('should reject dangerous DROP SQL', async () => {
      mockClient.chat.mockResolvedValue('DROP TABLE sales');
      
      await expect(builder.generateSQL('删除表', mockTables))
        .rejects.toThrow('安全限制');
    });

    it('should reject dangerous DELETE SQL', async () => {
      mockClient.chat.mockResolvedValue('DELETE FROM sales');
      
      await expect(builder.generateSQL('删除数据', mockTables))
        .rejects.toThrow('安全限制');
    });

    it('should reject dangerous TRUNCATE SQL', async () => {
      mockClient.chat.mockResolvedValue('TRUNCATE TABLE sales');
      
      await expect(builder.generateSQL('清空表', mockTables))
        .rejects.toThrow('安全限制');
    });

    it('should clean markdown code blocks', async () => {
      mockClient.chat.mockResolvedValue('```sql\nSELECT * FROM sales\n```');
      
      const sql = await builder.generateSQL('查询所有数据', mockTables);
      
      expect(sql).toBe('SELECT * FROM sales');
    });

    it('should clean sql language marker', async () => {
      mockClient.chat.mockResolvedValue('```sql SELECT * FROM sales ```');
      
      const sql = await builder.generateSQL('查询所有数据', mockTables);
      
      expect(sql).toBe('SELECT * FROM sales');
    });

    it('should include table schema in prompt', async () => {
      mockClient.chat.mockResolvedValue('SELECT * FROM sales');
      
      await builder.generateSQL('查询数据', mockTables);
      
      const callArgs = mockClient.chat.mock.calls[0];
      expect(callArgs[0]).toContain('表名: sales');
      expect(callArgs[0]).toContain('id');
      expect(callArgs[0]).toContain('product');
      expect(callArgs[0]).toContain('amount');
    });

    it('should handle multiple tables', async () => {
      const multiTables: TableMeta[] = [
        ...mockTables,
        {
          name: 'users',
          rowCount: 50,
          columns: [
            { name: 'id', type: 'number', nullable: false, sampleValues: [1, 2] },
            { name: 'name', type: 'string', nullable: false, sampleValues: ['Alice'] }
          ],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];
      
      mockClient.chat.mockResolvedValue('SELECT * FROM sales JOIN users ON sales.user_id = users.id');
      
      await builder.generateSQL('查询销售和用户', multiTables);
      
      const callArgs = mockClient.chat.mock.calls[0];
      expect(callArgs[0]).toContain('sales');
      expect(callArgs[0]).toContain('users');
    });
  });

  describe('explainSQL', () => {
    it('should explain SQL results', async () => {
      mockClient.chat.mockResolvedValue('这个查询返回了所有销售数据');
      
      const result = await builder.explainSQL('SELECT * FROM sales', [{ id: 1, amount: 100 }]);
      
      expect(result).toBe('这个查询返回了所有销售数据');
      expect(mockClient.chat).toHaveBeenCalled();
    });

    it('should include SQL and sample results in prompt', async () => {
      mockClient.chat.mockResolvedValue('解释');
      
      await builder.explainSQL('SELECT * FROM sales', [{ id: 1 }]);
      
      const callArgs = mockClient.chat.mock.calls[0];
      expect(callArgs[0]).toContain('SELECT * FROM sales');
      expect(callArgs[0]).toContain('"id": 1');
    });
  });
});
