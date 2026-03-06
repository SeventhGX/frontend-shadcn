#!/bin/bash

# 更新和重新部署脚本

set -e

echo "🔄 更新并重新部署前端应用..."

# 拉取最新代码（如果使用 Git）
if [ -d .git ]; then
    echo "📥 拉取最新代码..."
    git pull
fi

# 重新构建镜像
echo "📦 重新构建 Docker 镜像..."
docker-compose build --no-cache

# 重启容器
echo "🔄 重启容器..."
docker-compose up -d --force-recreate

# 等待容器启动
echo "⏳ 等待容器启动..."
sleep 5

# 检查容器状态
if [ "$(docker ps -q -f name=app_frontend)" ]; then
    echo "✅ 前端应用已成功更新并重启！"
    echo ""
    echo "📊 容器信息："
    docker-compose ps
    echo ""
    echo "📝 查看日志："
    echo "   docker-compose logs -f"
    
    # 清理旧镜像
    echo ""
    echo "🧹 清理旧镜像..."
    docker image prune -f
else
    echo "❌ 容器启动失败，请查看日志："
    docker-compose logs
    exit 1
fi
