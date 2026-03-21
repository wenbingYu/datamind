# 安装指南

本文档详细介绍 DataMind 的安装方法，包括系统要求、安装步骤和环境配置。

## 系统要求

### 操作系统

DataMind 支持以下操作系统：

| 操作系统 | 最低版本 | 推荐版本 |
|---------|---------|---------|
| macOS | 10.15 (Catalina) | 12.0+ (Monterey) |
| Windows | Windows 10 | Windows 11 |
| Linux | Ubuntu 18.04+ | Ubuntu 22.04+ |

### 运行时环境

- **Node.js**: 版本 18.0.0 或更高
- **npm**: 版本 8.0.0 或更高（通常随 Node.js 安装）

> 💡 **提示**: 推荐使用 Node.js 20+ LTS 版本以获得最佳性能和稳定性。

### 硬件要求

| 资源 | 最低配置 | 推荐配置 |
|-----|---------|---------|
| 内存 | 4 GB | 8 GB+ |
| 存储空间 | 500 MB | 2 GB+ |
| CPU | 2 核心 | 4 核心+ |

### 检查 Node.js 版本

```bash
node --version
# 应显示 v18.x.x 或更高版本

npm --version
# 应显示 8.x.x 或更高版本
```

如果未安装 Node.js，请参考下方的安装指南。

---

## 安装 Node.js

### macOS

**方式一：使用 Homebrew（推荐）**

```bash
# 安装 Homebrew（如果尚未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 验证安装
node --version
```

**方式二：使用 nvm（Node Version Manager）**

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载终端配置
source ~/.zshrc  # 或 source ~/.bashrc

# 安装 Node.js LTS 版本
nvm install --lts

# 验证安装
node --version
```

### Windows

**方式一：使用官方安装包**

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本安装包（.msi 文件）
3. 运行安装程序，按提示完成安装

**方式二：使用 Chocolatey**

```powershell
# 安装 Chocolatey（如果尚未安装）
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 安装 Node.js
choco install nodejs-lts

# 验证安装
node --version
```

### Linux (Ubuntu/Debian)

```bash
# 使用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

---

## 安装 DataMind

### 方式一：npm 全局安装（推荐）

最简单的安装方式，适合大多数用户：

```bash
# 全局安装 DataMind
npm install -g datamind

# 验证安装
datamind --version
```

安装成功后，你可以在任何目录使用 `datamind` 命令。

### 方式二：从源码安装

适合开发者或需要自定义的用户：

```bash
# 克隆仓库
git clone https://github.com/wenbingYu/datamind.git

# 进入项目目录
cd datamind

# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（可选，方便开发调试）
npm link

# 验证安装
datamind --version
```

### 方式三：使用 npx（无需安装）

临时使用，无需全局安装：

```bash
# 直接运行
npx datamind --help
```

---

## 环境变量配置

DataMind 需要配置 LLM API Key 才能使用自然语言查询功能。

### 获取 API Key

DataMind 支持多种 LLM 提供商：

| 提供商 | 获取方式 |
|-------|---------|
| 阿里云百炼 | [百炼控制台](https://bailian.console.aliyun.com/) |
| 智谱 AI | [智谱开放平台](https://open.bigmodel.cn/) |
| OpenAI | [OpenAI API Keys](https://platform.openai.com/api-keys) |

### 配置方式

**方式一：环境变量（推荐）**

```bash
# macOS / Linux - 添加到 ~/.zshrc 或 ~/.bashrc
echo 'export DATAMIND_API_KEY=your_api_key_here' >> ~/.zshrc
source ~/.zshrc

# 或者使用智谱 API Key
echo 'export ZHIPU_API_KEY=your_api_key_here' >> ~/.zshrc
source ~/.zshrc
```

```powershell
# Windows PowerShell - 添加到用户环境变量
[Environment]::SetEnvironmentVariable("DATAMIND_API_KEY", "your_api_key_here", "User")

# 重新打开终端后生效
```

**方式二：命令行临时设置**

```bash
# 仅当前会话有效
export DATAMIND_API_KEY=your_api_key_here

# 然后运行 DataMind
datamind ask "查询销售额最高的产品"
```

### 自定义 LLM 配置

DataMind 默认使用阿里云百炼 GLM-5 模型。你也可以自定义配置：

```bash
# 使用智谱 GLM
export DATAMIND_LLM_PROVIDER=zhipu
export DATAMIND_LLM_MODEL=glm-4
export DATAMIND_API_KEY=your_zhipu_api_key

# 使用 OpenAI
export DATAMIND_LLM_PROVIDER=openai
export DATAMIND_LLM_MODEL=gpt-4
export DATAMIND_API_KEY=your_openai_api_key
export DATAMIND_BASE_URL=https://api.openai.com/v1

# 使用本地模型（如 Ollama）
export DATAMIND_LLM_PROVIDER=ollama
export DATAMIND_LLM_MODEL=llama3
export DATAMIND_BASE_URL=http://localhost:11434/v1
```

---

## 数据存储位置

DataMind 将数据存储在本地，默认位置：

```
~/.datamind/
├── data/           # 原始数据文件
├── duckdb/         # DuckDB 数据库文件
│   └── datamind.db
├── lancedb/        # LanceDB 向量索引
└── config.json     # 配置文件（可选）
```

### 自定义数据目录

```bash
# 设置自定义数据目录
export DATAMIND_DATA_DIR=/path/to/custom/directory
```

---

## 验证安装

### 检查版本

```bash
datamind --version
# 输出: 1.0.0
```

### 查看帮助

```bash
datamind --help

# 输出:
# Usage: datamind [options] [command]
# 
# 智能数据分析助手 — 上传数据，用自然语言分析
# 
# Options:
#   -V, --version   output the version number
#   -h, --help      display help for command
# 
# Commands:
#   import <file>   导入数据文件 (支持 CSV)
#   list            列出已导入的数据表
#   ask <question>  用自然语言查询数据
#   analyze [table] 分析数据表并生成洞察
#   export <file>   导出分析报告
#   ui              启动 Web UI 界面
#   help [command]  display help for command
```

### 测试导入功能

```bash
# 创建测试数据
cat > test.csv << EOF
name,age,city
Alice,28,Beijing
Bob,35,Shanghai
Charlie,42,Guangzhou
EOF

# 导入数据
datamind import test.csv

# 预期输出:
# ✔ 导入成功!
#   表名: test
#   行数: 3
#   列数: 3
```

---

## 常见问题

### 1. `command not found: datamind`

**原因**: npm 全局安装目录不在 PATH 中。

**解决方案**:

```bash
# 查看 npm 全局安装目录
npm config get prefix

# macOS / Linux - 添加到 PATH
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Windows - 重启终端或手动添加到系统 PATH
```

### 2. `EACCES: permission denied`

**原因**: npm 全局安装权限不足。

**解决方案**:

```bash
# 方式一：使用 sudo（不推荐）
sudo npm install -g datamind

# 方式二：修改 npm 默认目录（推荐）
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### 3. `未配置 API Key`

**原因**: 未设置环境变量。

**解决方案**: 参考上文「环境变量配置」章节。

### 4. Node.js 版本过低

**原因**: Node.js 版本低于 18。

**解决方案**:

```bash
# 使用 nvm 升级 Node.js
nvm install 20
nvm use 20
nvm alias default 20
```

---

## 更新 DataMind

```bash
# 更新到最新版本
npm update -g datamind

# 查看当前版本
datamind --version
```

---

## 卸载 DataMind

```bash
# 全局卸载
npm uninstall -g datamind

# 删除数据目录（可选）
rm -rf ~/.datamind
```

---

## 下一步

安装完成后，建议阅读：

- [快速入门指南](./QUICK_START.md) - 5 分钟上手 DataMind
- [CLI 命令参考](./CLI_REFERENCE.md) - 详细的命令说明
- [使用示例](./EXAMPLES.md) - 实际应用场景