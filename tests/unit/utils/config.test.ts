import * as path from 'path';
import * as os from 'os';
import { getConfig, validateConfig, ensureDataDir } from '../../../src/utils/config';
import { ConfigError } from '../../../src/utils/errors';

// Mock fs to avoid creating directories during tests
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn()
}));

import * as fs from 'fs';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return default config', () => {
      delete process.env.DATAMIND_API_KEY;
      delete process.env.ZHIPU_API_KEY;
      
      const config = getConfig();
      
      expect(config.llm.provider).toBe('bailian');
      expect(config.llm.model).toBe('glm-5');
      expect(config.llm.baseUrl).toBe('https://coding.dashscope.aliyuncs.com/v1');
    });

    it('should use DATAMIND_API_KEY if set', () => {
      process.env.DATAMIND_API_KEY = 'test-datamind-key';
      
      const config = getConfig();
      
      expect(config.llm.apiKey).toBe('test-datamind-key');
    });

    it('should fallback to ZHIPU_API_KEY if DATAMIND_API_KEY not set', () => {
      delete process.env.DATAMIND_API_KEY;
      process.env.ZHIPU_API_KEY = 'test-zhipu-key';
      
      const config = getConfig();
      
      expect(config.llm.apiKey).toBe('test-zhipu-key');
    });

    it('should prefer DATAMIND_API_KEY over ZHIPU_API_KEY', () => {
      process.env.DATAMIND_API_KEY = 'datamind-key';
      process.env.ZHIPU_API_KEY = 'zhipu-key';
      
      const config = getConfig();
      
      expect(config.llm.apiKey).toBe('datamind-key');
    });

    it('should return correct storage paths', () => {
      const config = getConfig();
      const expectedDataDir = path.join(os.homedir(), '.datamind');
      
      expect(config.storage.dataDir).toBe(expectedDataDir);
      expect(config.storage.duckdbPath).toBe(path.join(expectedDataDir, 'duckdb', 'datamind.db'));
      expect(config.storage.lancedbPath).toBe(path.join(expectedDataDir, 'lancedb'));
    });
  });

  describe('validateConfig', () => {
    it('should pass with valid API key', () => {
      const config = getConfig();
      config.llm.apiKey = 'valid-key';
      
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw ConfigError without API key', () => {
      const config = getConfig();
      config.llm.apiKey = '';
      
      expect(() => validateConfig(config)).toThrow(ConfigError);
    });

    it('should throw ConfigError with undefined API key', () => {
      const config = getConfig();
      config.llm.apiKey = undefined as any;
      
      expect(() => validateConfig(config)).toThrow(ConfigError);
    });

    it('should have correct error message', () => {
      const config = getConfig();
      config.llm.apiKey = '';
      
      try {
        validateConfig(config);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).message).toBe('未配置 API Key');
      }
    });
  });

  describe('ensureDataDir', () => {
    it('should create directories if they do not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      ensureDataDir();
      
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should not create directories if they already exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      
      ensureDataDir();
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});