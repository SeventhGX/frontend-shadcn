# 前端 Docker 部署快速指南

## 🚀 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改以下配置：
# - WEB_PORT: 前端应用端口（默认 3000）
# - NEXT_PUBLIC_API_URL: 浏览器访问的后端 API 地址
# - INTERNAL_API_URL: 容器内部访问后端的地址（Docker 部署时使用）
```

### 2. 部署应用

使用自动部署脚本：

```bash
./deploy.sh
```

或手动执行：

```bash
# 构建镜像
docker-compose build

# 启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 3. 访问应用

默认访问地址：http://localhost:3000

## 🛠️ 常用命令

```bash
# 部署应用
./deploy.sh

# 停止应用
./stop.sh

# 更新应用
./update.sh

# 查看日志
docker-compose logs -f

# 查看容器状态
docker-compose ps

# 重启容器
docker-compose restart

# 进入容器
docker exec -it app_frontend sh
```

## 📝 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `WEB_PORT` | 前端应用端口 | `3000` |
| `NEXT_PUBLIC_API_URL` | 浏览器访问的后端 API 地址 | `http://your-server-ip:8000` |
| `INTERNAL_API_URL` | 容器内部访问后端的地址 | `http://app_backend:8000` |
| `NODE_ENV` | Node 运行环境 | `production` |

## 🔗 与后端容器通信

前端容器通过 `external_links` 连接到后端容器 `app_backend`：

- 浏览器端 → 使用 `NEXT_PUBLIC_API_URL`（需要配置为公网可访问的地址）
- 服务器端（SSR）→ 使用 `INTERNAL_API_URL`（容器间通信，使用容器名称）

## 🐳 Docker 镜像信息

- **镜像名称**: `app_frontend:latest`
- **容器名称**: `app_frontend`
- **基础镜像**: `node:20-alpine`
- **构建方式**: 多阶段构建
- **最终镜像大小**: ~150MB

## 📚 详细文档

完整的部署文档和故障排查指南，请参考：[docs/DOCKER_DEPLOY.md](docs/DOCKER_DEPLOY.md)

## 🔐 生产环境建议

1. 使用 HTTPS（配置 Nginx 反向代理 + SSL 证书）
2. 配置防火墙规则
3. 定期更新依赖和基础镜像
4. 使用 Docker secrets 管理敏感信息
5. 配置资源限制（CPU、内存）
6. 设置日志轮转

## ⚠️ 注意事项

1. 确保后端容器 `app_backend` 已经启动并正常运行
2. `NEXT_PUBLIC_API_URL` 必须是浏览器可访问的地址（公网 IP 或域名）
3. `INTERNAL_API_URL` 使用 Docker 容器名称进行内部通信
4. 首次部署时会自动创建 `.env` 文件，请根据实际情况修改
5. 端口 3000 需要在服务器防火墙中开放

## 🐛 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker-compose logs web

# 检查端口占用
lsof -i :3000
```

### 无法连接后端

```bash
# 测试容器间网络连接
docker exec -it app_frontend sh
ping app_backend
curl http://app_backend:8000/health
```

### 浏览器无法访问 API

1. 检查 `NEXT_PUBLIC_API_URL` 是否配置正确
2. 确认服务器防火墙已开放后端端口
3. 验证后端服务是否正常运行

## 📞 技术支持

如遇到问题，请查看：
- [部署文档](docs/DOCKER_DEPLOY.md)
- [Next.js 文档](https://nextjs.org/docs)
- [Docker 文档](https://docs.docker.com/)
