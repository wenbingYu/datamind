# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-21

### Added

#### CLI Commands
- `datamind import <file>` - Import CSV data files with automatic type inference
- `datamind list` - List all imported data tables
- `datamind ask "<question>"` - Natural language to SQL query with results
- `datamind analyze [table]` - Automatic insight generation from data
- `datamind export <file>` - Export analysis reports in Markdown/HTML format
- `datamind ui` - Launch local Web UI for interactive analysis

#### Features
- **Natural Language Query**: Ask questions in plain Chinese/English, auto-generate SQL
- **Automatic Type Inference**: Smart detection of number, string, date, boolean types
- **Insight Engine**: Discover trends, anomalies, correlations, and distributions
- **Chart Generation**: Support for bar, line, pie, and scatter charts
- **Batch Import**: Optimized performance for large datasets (10K+ rows)
- **Web UI**: Dark-themed interactive interface with drag-and-drop upload
- **Vector Search**: LanceDB integration for intelligent table recommendations

#### API Endpoints
- `GET /api/tables` - List all tables
- `POST /api/import` - Upload data files
- `POST /api/ask` - Natural language query
- `POST /api/query` - Execute raw SQL
- `GET /api/analyze/:table` - Analyze table
- `GET /api/schema/:table` - Get table schema
- `GET /api/export/:table` - Export as CSV
- `DELETE /api/tables/:table` - Delete table

#### Technical
- **DuckDB Integration**: Embedded OLAP database for fast analytics
- **LanceDB Integration**: Vector database for semantic search
- **OpenAI Compatible API**: Support for OpenAI, Alibaba Cloud, Zhipu, and local models
- **Parameterized Queries**: SQL injection protection
- **Unified Error Handling**: Custom error classes with friendly messages

### Testing
- 74 unit test cases
- 94% code coverage
- Jest testing framework

### Security
- Parameterized SQL queries to prevent injection
- Input validation for table and column names
- API key validation with helpful error messages

### Performance
- Batch insert for large datasets (1000 rows per batch)
- Progress display during import
- Execution time tracking for queries

## [0.1.0] - 2026-03-21

### Added
- Initial MVP release
- Basic CLI framework
- DuckDB integration
- CSV import functionality
- Natural language query with LLM