#!/bin/bash

# 前端应用 Docker 部署脚本

set -e  # 遇到错误时退出

echo "🚀 开始构建前端应用 Docker 镜像..."

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，将使用 .env.example 创建"
    cp .env.example .env
    echo "✅ 已创建 .env 文件，请根据实际情况修改配置"
    echo "📝 编辑完成后，请重新运行此脚本"
    exit 1
fi

# 构建镜像
echo "📦 构建 Docker 镜像..."
docker-compose build

# 停止并移除旧容器
if [ "$(docker ps -aq -f name=app_frontend)" ]; then
    echo "🛑 停止并移除旧容器..."
    docker-compose down
fi

# 启动容器
echo "▶️  启动容器..."
docker-compose up -d

# 等待容器启动
echo "⏳ 等待容器启动..."
sleep 5

# 检查容器状态
if [ "$(docker ps -q -f name=app_frontend)" ]; then
    echo "✅ 前端应用已成功启动！"
    echo ""
    echo "📊 容器信息："
    docker-compose ps
    echo ""
    echo "🌐 访问地址："
    WEB_PORT=$(grep WEB_PORT .env | cut -d '=' -f2 || echo "3000")
    echo "   http://localhost:${WEB_PORT}"
    echo ""
    echo "📝 查看日志："
    echo "   docker-compose logs -f"
    echo ""
    echo "🔍 健康检查："
    echo "   docker inspect --format='{{.State.Health.Status}}' app_frontend"
else
    echo "❌ 容器启动失败，请查看日志："
    docker-compose logs
    exit 1
fi
