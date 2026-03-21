import { DataMindError, ConfigError, QueryError, ImportError, FileError } from '../../../src/utils/errors';

describe('Errors', () => {
  describe('DataMindError', () => {
    it('should create error with code', () => {
      const error = new DataMindError('Test error', 'TEST_CODE');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DataMindError');
      expect(error.exitCode).toBe(1);
    });

    it('should create error with custom exit code', () => {
      const error = new DataMindError('Test error', 'TEST_CODE', 2);
      expect(error.exitCode).toBe(2);
    });

    it('should be instance of Error', () => {
      const error = new DataMindError('Test error', 'TEST_CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ConfigError', () => {
    it('should create config error with correct properties', () => {
      const error = new ConfigError('Missing API key');
      expect(error.message).toBe('Missing API key');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('ConfigError');
    });

    it('should be instance of DataMindError', () => {
      const error = new ConfigError('Missing API key');
      expect(error).toBeInstanceOf(DataMindError);
    });
  });

  describe('QueryError', () => {
    it('should create query error with correct properties', () => {
      const error = new QueryError('SQL execution failed');
      expect(error.message).toBe('SQL execution failed');
      expect(error.code).toBe('QUERY_ERROR');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('QueryError');
    });

    it('should be instance of DataMindError', () => {
      const error = new QueryError('Invalid SQL');
      expect(error).toBeInstanceOf(DataMindError);
    });
  });

  describe('ImportError', () => {
    it('should create import error with correct properties', () => {
      const error = new ImportError('Failed to import CSV');
      expect(error.message).toBe('Failed to import CSV');
      expect(error.code).toBe('IMPORT_ERROR');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('ImportError');
    });

    it('should be instance of DataMindError', () => {
      const error = new ImportError('Invalid file format');
      expect(error).toBeInstanceOf(DataMindError);
    });
  });

  describe('FileError', () => {
    it('should create file error with correct properties', () => {
      const error = new FileError('File not found');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_ERROR');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('FileError');
    });

    it('should be instance of DataMindError', () => {
      const error = new FileError('Unsupported format');
      expect(error).toBeInstanceOf(DataMindError);
    });
  });
});