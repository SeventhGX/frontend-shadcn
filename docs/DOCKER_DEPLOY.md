# Docker 部署指南

本文档介绍如何使用 Docker 容器部署前端应用，并与同服务器上的后端容器进行通信。

## 📋 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 后端容器 `app_backend` 已经在运行（监听 8000 端口）
- PostgreSQL 容器 `postgres-18` 已经在运行
- Redis 容器 `my-redis` 已经在运行

## 🚀 快速开始

### 1. 配置环境变量

复制环境变量示例文件并根据实际情况修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，主要配置项：

```bash
# 前端应用端口
WEB_PORT=3000

# 浏览器访问的后端 API 地址（使用服务器的公网 IP 或域名）
NEXT_PUBLIC_API_URL=http://your-server-ip:8000

# 容器内部访问后端 API 地址（使用后端容器名称）
INTERNAL_API_URL=http://app_backend:8000

# 运行环境
NODE_ENV=production
```

### 2. 构建镜像

```bash
docker-compose build
```

### 3. 启动容器

```bash
docker-compose up -d
```

### 4. 查看运行状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看健康检查状态
docker inspect --format='{{.State.Health.Status}}' app_frontend
```

## 🔧 容器管理

### 停止容器

```bash
docker-compose down
```

### 重启容器

```bash
docker-compose restart
```

### 重新构建并启动

```bash
docker-compose up -d --build
```

### 进入容器

```bash
docker exec -it app_frontend sh
```

## 🌐 网络配置

### 容器间通信

本项目使用 Docker 的 `bridge` 网络模式，通过 `external_links` 连接到外部容器：

- `app_backend` - 后端 API 服务（端口 8000）
- `postgres-18` - PostgreSQL 数据库（端口 5432）
- `my-redis` - Redis 缓存（端口 6379）

### API 地址配置说明

前端应用中有两个 API 地址配置：

1. **NEXT_PUBLIC_API_URL**: 浏览器端使用
   - 需要配置为可从用户浏览器访问的地址
   - 通常是服务器的公网 IP 或域名
   - 例如：`http://123.45.67.89:8000` 或 `https://api.yourdomain.com`

2. **INTERNAL_API_URL**: 服务器端渲染（SSR）时使用
   - 容器内部访问后端 API 的地址
   - 使用 Docker 容器名称：`http://app_backend:8000`
   - 不会暴露给浏览器

## 📦 镜像信息

- **镜像名称**: `app_frontend:latest`
- **容器名称**: `app_frontend`
- **基础镜像**: `node:20-alpine`
- **暴露端口**: 3000

## 🔍 健康检查

容器配置了健康检查，每 30 秒检查一次应用是否正常运行：

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## 🐛 故障排查

### 容器无法启动

1. 检查端口是否被占用：
```bash
lsof -i :3000
```

2. 查看容器日志：
```bash
docker-compose logs web
```

### 无法连接后端

1. 确认后端容器正在运行：
```bash
docker ps | grep app_backend
```

2. 测试容器间网络连接：
```bash
docker exec -it app_frontend sh
# 在容器内执行
ping app_backend
curl http://app_backend:8000/health
```

3. 检查环境变量配置：
```bash
docker exec -it app_frontend env | grep API
```

### 浏览器无法访问 API

1. 确认 `NEXT_PUBLIC_API_URL` 配置正确
2. 检查服务器防火墙是否开放 8000 端口
3. 确认后端服务正常运行

## 🔐 安全建议

1. **生产环境部署**：
   - 使用 HTTPS（配置 Nginx 反向代理）
   - 不要在客户端暴露敏感信息
   - 定期更新依赖和基础镜像

2. **环境变量管理**：
   - 不要将 `.env` 文件提交到版本控制
   - 使用 Docker secrets 或环境变量管理工具

3. **资源限制**：
   - 可以在 `docker-compose.yml` 中添加资源限制：
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1'
         memory: 1G
   ```

## 📚 相关文档

- [Next.js Docker 部署文档](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- 后端部署文档：参考后端项目的 `docker-compose.yml`

## ⚙️ Dockerfile 架构

本项目使用多阶段构建优化镜像大小：

1. **deps 阶段**: 安装生产依赖
2. **builder 阶段**: 构建 Next.js 应用
3. **runner 阶段**: 运行应用（最终镜像）

最终镜像大小约 150MB，相比单阶段构建节省了约 500MB。

## 🎯 生产环境最佳实践

### 使用 Nginx 反向代理

创建 `nginx.conf` 配置文件：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端应用
    location / {
        proxy_pass http://app_frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://app_backend:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 配置 SSL/TLS

使用 Let's Encrypt 获取免费 SSL 证书：

```bash
# 安装 certbot
apt-get install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d yourdomain.com
```

## 📝 日志管理

如需持久化日志，在 `docker-compose.yml` 中添加 volumes：

```yaml
volumes:
  - ./logs:/app/.next/logs
```

查看日志：

```bash
# 实时查看日志
docker-compose logs -f web

# 查看最近 100 行日志
docker-compose logs --tail=100 web
```

## 🔄 更新部署

当代码更新后：

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建镜像
docker-compose build

# 3. 重启容器
docker-compose up -d

# 4. 清理旧镜像（可选）
docker image prune -f
```
