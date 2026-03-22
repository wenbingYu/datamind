FROM node:20-alpine

# 安装系统依赖 (DuckDB 和 LanceDB 可能需要)
RUN apk add --no-cache python3 make g++

# 创建工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖 (包括 DuckDB 和 LanceDB)
RUN npm ci --only=production

# 复制源代码
COPY dist/ ./dist/
COPY README.md ./

# 设置环境变量
ENV NODE_ENV=production
# 数据目录统一使用 ~/.datamind (容器内 /root/.datamind)
ENV DATAMIND_HOME=/root/.datamind

# 暴露端口
EXPOSE 3000

# 入口
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["ui", "--port", "3000", "--host", "0.0.0.0"]