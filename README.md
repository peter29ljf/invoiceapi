# Invoice System

一个基于 Python Flask 的发票管理系统，提供完整的发票管理功能。

## 功能特点

- 客户管理
- 发票创建和管理
- PDF 发票生成
- CSV 数据导出
- RESTful API 接口
- 公司信息管理
- 统计报表

## 技术栈

- Python 3.12
- Flask
- SQLAlchemy
- Jinja2
- ReportLab (PDF生成)
- SQLite

## 安装说明

1. 克隆仓库
```bash
git clone https://github.com/peter29ljf/invoiceapi.git
cd invoiceapi
```

2. 创建虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
.\venv\Scripts\activate  # Windows
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 初始化数据库
```bash
flask db upgrade
```

5. 运行应用
```bash
flask run
```

## API 文档

详细的 API 文档请参考 [API_Documentation.md](invoice-web/API_Documentation.md)

## 许可证

MIT License 