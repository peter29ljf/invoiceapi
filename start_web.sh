#!/bin/bash

echo "启动发票管理系统网页版..."
echo "访问地址: http://localhost:8080"
echo "按 Ctrl+C 停止服务器"

cd invoice-web
source venv/bin/activate
python app.py 