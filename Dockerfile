# 多阶段构建 Next.js 应用

# 第一阶段：安装依赖
FROM node:20-alpine AS deps
# 切换 Alpine 为阿里云镜像源，加速 apk 安装
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache libc6-compat
WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package.json package-lock.json* ./
# npm ci 直接读取 lockfile，跳过依赖解析，比 npm install 快 2-3 倍
RUN npm ci --ignore-scripts --registry=https://registry.npmmirror.com/

# 第二阶段：构建应用
FROM node:20-alpine AS builder
WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules
# 复制所有源代码
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# 限制 Node 堆内存，避免构建时吃满系统内存触发 OOM
ENV NODE_OPTIONS=--max-old-space-size=1536
# 限制 Next.js / webpack 的并行 worker 数，降低 CPU 峰值
ENV NEXT_BUILD_WORKERS=1

# 构建 Next.js 应用
RUN npm run build

# 第三阶段：运行应用
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 合并为一条命令，减少镜像层
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 用 --chown 直接在复制时设置权限，避免额外的 chown 层
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
