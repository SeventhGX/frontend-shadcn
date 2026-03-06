#!/bin/bash

# 停止和清理脚本

echo "🛑 停止前端应用容器..."
docker-compose down

echo "🧹 清理未使用的镜像（可选）..."
read -p "是否清理未使用的 Docker 镜像？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker image prune -f
    echo "✅ 清理完成"
else
    echo "⏭️  跳过清理"
fi

echo "✅ 前端应用已停止"
