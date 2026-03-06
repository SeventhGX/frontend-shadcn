# 🎉 前端 Docker 部署配置已完成

## ✅ 已完成的工作

### 1. Docker 构建文件
- ✅ **Dockerfile** - 多阶段构建配置，优化镜像大小（~150MB）
- ✅ **docker-compose.yml** - 容器编排配置，支持与后端容器通信
- ✅ **.dockerignore** - 优化构建速度，排除不必要的文件

### 2. 环境配置
- ✅ **.env.example** - 环境变量模板
- ✅ **.env** - 已自动创建（需要根据实际情况修改）
- ✅ **next.config.ts** - 已启用 `standalone` 输出模式

### 3. 代码优化
- ✅ **lib/fetcher.ts** - 支持环境变量配置 API 地址，自动区分浏览器端和服务器端
- ✅ **lib/auth.ts** - 更新使用统一的 API 基础 URL
- ✅ **features/article/api.ts** - 移除硬编码的 API 地址，使用相对路径

### 4. 部署脚本
- ✅ **deploy.sh** - 一键部署脚本
- ✅ **stop.sh** - 停止容器脚本
- ✅ **update.sh** - 更新重新部署脚本

### 5. 文档
- ✅ **docs/DOCKER_DEPLOY.md** - 完整的部署指南
- ✅ **DOCKER_README.md** - 快速开始指南

## 🚀 快速开始

### 第一步：配置环境变量

编辑 `.env` 文件，修改以下关键配置：

```bash
# 前端应用端口（默认 3000）
WEB_PORT=3000

# 浏览器访问的后端 API 地址（改成你的服务器公网 IP 或域名）
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:8000

# 容器内部访问后端的地址（使用后端容器名称）
INTERNAL_API_URL=http://app_backend:8000

# 运行环境
NODE_ENV=production
```

### 第二步：部署应用

```bash
# 方式一：使用自动脚本（推荐）
./deploy.sh

# 方式二：手动执行
docker-compose build
docker-compose up -d
```

### 第三步：验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 检查健康状态
docker inspect --format='{{.State.Health.Status}}' app_frontend
```

### 第四步：访问应用

默认访问地址：**http://localhost:3000**

## 🔗 容器间通信说明

前端容器通过 `bridge` 网络模式和 `external_links` 连接到后端容器：

```yaml
external_links:
  - app_backend    # 后端 API 服务
```

### API 地址配置原理

| 环境 | 使用的环境变量 | 示例值 | 说明 |
|------|---------------|--------|------|
| 浏览器端 | `NEXT_PUBLIC_API_URL` | `http://123.45.67.89:8000` | 必须是浏览器可访问的公网地址 |
| 服务器端（SSR） | `INTERNAL_API_URL` | `http://app_backend:8000` | 容器间通信，使用容器名称 |

**重要提示**：
- `NEXT_PUBLIC_API_URL` 会在构建时嵌入到前端代码中
- `INTERNAL_API_URL` 仅用于服务器端渲染时的 API 调用
- 确保后端容器 `app_backend` 已经启动

## 📂 项目结构

```
frontend-shadcn/
├── Dockerfile                 # Docker 镜像构建文件
├── docker-compose.yml         # Docker Compose 配置
├── .dockerignore             # Docker 构建忽略文件
├── .env                      # 环境变量（需要根据实际情况修改）
├── .env.example              # 环境变量模板
├── deploy.sh                 # 部署脚本
├── stop.sh                   # 停止脚本
├── update.sh                 # 更新脚本
├── DOCKER_README.md          # 快速开始指南
├── docs/
│   └── DOCKER_DEPLOY.md      # 详细部署文档
├── lib/
│   ├── fetcher.ts            # API 请求工具（已更新）
│   └── auth.ts               # 认证工具（已更新）
└── features/
    └── article/
        └── api.ts            # 文章 API（已更新）
```

## 🛠️ 常用命令

```bash
# 部署应用
./deploy.sh

# 停止应用
./stop.sh

# 更新应用（拉取最新代码并重新部署）
./update.sh

# 查看日志
docker-compose logs -f

# 查看容器状态
docker-compose ps

# 重启容器
docker-compose restart

# 进入容器调试
docker exec -it app_frontend sh

# 清理未使用的镜像
docker image prune -f
```

## 🔍 健康检查

容器配置了自动健康检查，每 30 秒检查一次：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' app_frontend

# 可能的状态：
# - starting: 启动中
# - healthy: 健康
# - unhealthy: 不健康
```

## 📝 环境变量完整列表

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `WEB_PORT` | 否 | `3000` | 前端应用监听端口 |
| `NEXT_PUBLIC_API_URL` | 是 | `http://localhost:8000` | 浏览器访问的后端 API 地址 |
| `NEXT_PUBLIC_API_BASE_URL` | 否 | 同上 | 向后兼容的环境变量名 |
| `INTERNAL_API_URL` | 是 | `http://app_backend:8000` | 服务器端访问后端的地址 |
| `NODE_ENV` | 否 | `production` | Node 运行环境 |

## ⚠️ 重要注意事项

1. **首次部署前必须修改 `.env` 文件**
   - 将 `NEXT_PUBLIC_API_URL` 改成实际的服务器地址
   - 例如：`http://123.45.67.89:8000` 或 `https://api.yourdomain.com`

2. **确保后端容器已启动**
   ```bash
   # 检查后端容器状态
   docker ps | grep app_backend
   ```

3. **端口配置**
   - 前端默认使用 3000 端口
   - 确保服务器防火墙已开放该端口

4. **网络配置**
   - 使用 `bridge` 网络模式
   - 通过 `external_links` 连接到后端容器

## 🐛 常见问题

### 1. 容器无法启动

```bash
# 查看详细错误日志
docker-compose logs web

# 检查端口是否被占用
lsof -i :3000

# 杀死占用端口的进程
kill -9 <PID>
```

### 2. 无法连接后端

```bash
# 进入容器测试网络连接
docker exec -it app_frontend sh

# 测试是否能 ping 通后端容器
ping app_backend

# 测试后端 API 是否可访问
curl http://app_backend:8000/health
```

### 3. 浏览器无法访问 API

**原因**：`NEXT_PUBLIC_API_URL` 配置错误

**解决方案**：
1. 确保 `NEXT_PUBLIC_API_URL` 是浏览器可访问的地址
2. 不要使用容器名称（如 `http://app_backend:8000`）
3. 使用服务器的公网 IP 或域名

### 4. 构建失败

```bash
# 清理缓存重新构建
docker-compose build --no-cache

# 检查 .dockerignore 是否排除了必要文件
cat .dockerignore

# 确保 package.json 和 package-lock.json 存在
ls -la package*.json
```

## 🔐 生产环境建议

### 1. 使用 HTTPS

配置 Nginx 反向代理：

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. 配置资源限制

在 `docker-compose.yml` 中添加：

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 3. 设置日志轮转

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. 使用 Docker Secrets

```bash
# 创建 secret
echo "your-api-url" | docker secret create api_url -

# 在 docker-compose.yml 中使用
secrets:
  - api_url
```

## 📚 参考文档

- [详细部署指南](docs/DOCKER_DEPLOY.md)
- [快速开始](DOCKER_README.md)
- [Next.js Docker 文档](https://nextjs.org/docs/deployment#docker-image)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## 🎯 下一步

1. ✅ 已完成 Docker 配置
2. 📝 修改 `.env` 文件中的实际配置
3. 🚀 执行 `./deploy.sh` 部署应用
4. 🔍 访问 `http://localhost:3000` 验证
5. 🌐 配置域名和 HTTPS（生产环境）

## 💡 技术支持

如遇到问题，请：
1. 查看 [docs/DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md) 故障排查章节
2. 检查容器日志：`docker-compose logs -f`
3. 验证环境变量配置是否正确
4. 确认后端容器是否正常运行

---

**祝部署顺利！** 🎊
