#!/bin/bash
# DataMind 高级图表模块安装脚本
# 将图表模块集成到主项目中

set -e

DATAMIND_DIR="/Users/wenbing/.openclaw/workspace/projects/datamind"
CHARTS_DIR="/Users/wenbing/.openclaw/workspace/datamind-charts"

echo "📊 DataMind 高级图表模块安装"
echo "================================"

# 检查权限
if [ ! -w "$DATAMIND_DIR" ]; then
    echo "⚠️  需要 root 权限来写入项目目录"
    echo "请运行: sudo chown -R \$(whoami):staff $DATAMIND_DIR"
    echo ""
    echo "或者手动复制文件："
    echo "  cp -r $CHARTS_DIR/*.ts $DATAMIND_DIR/src/charts/"
    exit 1
fi

# 创建目标目录
echo "📁 创建目录结构..."
mkdir -p "$DATAMIND_DIR/src/charts"

# 复制核心文件
echo "📝 复制核心文件..."
cp "$CHARTS_DIR/types.ts" "$DATAMIND_DIR/src/charts/"
cp "$CHARTS_DIR/generator.ts" "$DATAMIND_DIR/src/charts/"
cp "$CHARTS_DIR/export.ts" "$DATAMIND_DIR/src/charts/"
cp "$CHARTS_DIR/themes.ts" "$DATAMIND_DIR/src/charts/"
cp "$CHARTS_DIR/recommender.ts" "$DATAMIND_DIR/src/charts/"
cp "$CHARTS_DIR/index.ts" "$DATAMIND_DIR/src/charts/"

# 复制 CLI 命令
echo "📝 复制 CLI 命令..."
mkdir -p "$DATAMIND_DIR/src/cli/commands"
cp "$CHARTS_DIR/commands/chart.ts" "$DATAMIND_DIR/src/cli/commands/"

# 复制 UI 组件
echo "📝 复制 UI 组件..."
mkdir -p "$DATAMIND_DIR/src/charts/ui"
cp "$CHARTS_DIR/ui/chart-config.html" "$DATAMIND_DIR/src/charts/ui/"

echo ""
echo "✅ 安装完成！"
echo ""
echo "后续步骤："
echo "1. 更新 CLI 入口文件 (src/cli/index.ts) 添加 chart 命令"
echo "2. 更新 Web UI (src/ui/public/index.html) 集成图表配置面板"
echo "3. 运行 npm run build 重新编译"
echo ""
echo "📚 查看文档: cat $CHARTS_DIR/INTEGRATION.md"