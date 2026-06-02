#!/bin/bash

# 更新和重新部署脚本

set -e

echo "🔄 更新并重新部署前端应用..."

# 拉取最新代码（如果使用 Git）
# if [ -d .git ]; then
#     echo "📥 拉取最新代码..."
#     git pull
# fi

# 重新构建镜像（限制资源，避免低配服务器卡死）
# nice -n 19 / ionice -c 3 把构建进程降到最低优先级，CPU 和 IO 优先让给其他服务
# 同时关闭 BuildKit 以便支持 --memory 资源限制
echo "📦 重新构建 Docker 镜像..."
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
nice -n 19 ionice -c 3 docker-compose build --no-cache

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
