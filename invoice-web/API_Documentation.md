# Invoice 系统 API 使用文档

本文档详细介绍 Invoice 系统的所有 API 端点使用方法（不包括 Webhook 方式）。

## 基础信息

- **基础URL:** `http://127.0.0.1:5001`
- **Content-Type:** `application/json`
- **所有请求都需要使用 JSON 格式**

---

## 1. 客户管理 API

### 1.1 获取所有客户

**端点:** `GET /api/customers`

**描述:** 获取系统中所有客户的列表

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/customers
```

**响应示例:**
```json
[
  {
    "id": 1,
    "name": "lin",
    "email": "",
    "phone": "13380090848",
    "address": "",
    "created_at": "2025-06-08T14:57:43.656607"
  }
]
```

### 1.2 创建新客户

**端点:** `POST /api/customers`

**必需字段:**
- `name` - 客户姓名

**可选字段:**
- `email` - 邮箱地址
- `phone` - 电话号码
- `address` - 地址

**请求示例:**
```
curl -X POST http://127.0.0.1:5001/api/customers -H "Content-Type: application/json" -d '{"name": "John Smith", "email": "john.smith@example.com", "phone": "+1-555-123-4567", "address": "123 Main Street\nSuite 100\nNew York, NY 10001"}'
```

**响应示例:**
```json
{
  "id": 9,
  "message": "Customer created successfully"
}
```

### 1.3 获取单个客户详情

**端点:** `GET /api/customers/{customer_id}`

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/customers/1
```

**响应示例:**
```json
{
  "id": 1,
  "name": "lin",
  "email": "",
  "phone": "13380090848",
  "address": "",
  "created_at": "2025-06-08T14:57:43.656607"
}
```

### 1.4 更新客户信息

**端点:** `PUT /api/customers/{customer_id}`

**可更新字段:**
- `name` - 客户姓名
- `email` - 邮箱地址
- `phone` - 电话号码
- `address` - 地址

**请求示例:**
```
curl -X PUT http://127.0.0.1:5001/api/customers/1 -H "Content-Type: application/json" -d '{"name": "Lin Updated", "phone": "+1-604-555-0123"}'
```

**响应示例:**
```json
{
  "message": "Customer updated successfully"
}
```

### 1.5 删除客户

**端点:** `DELETE /api/customers/{customer_id}`

**注意:** 不能删除有关联发票的客户

**请求示例:**
```
curl -X DELETE http://127.0.0.1:5001/api/customers/1
```

**成功响应:**
```json
{
  "message": "Customer deleted successfully"
}
```

**错误响应:**
```json
{
  "error": "Cannot delete customer with existing invoices"
}
```

---

## 2. 发票管理 API

### 2.1 获取所有发票

**端点:** `GET /api/invoices`

**描述:** 获取系统中所有发票的列表

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/invoices
```

**响应示例:**
```json
[
  {
    "id": 1,
    "invoice_number": "INV-20250609-0001",
    "customer_name": "lin",
    "issue_date": "2025-06-09",
    "due_date": "2025-07-09",
    "status": "pending",
    "total": 105.0,
    "created_at": "2025-06-09T14:57:43.656607"
  }
]
```

### 2.2 创建新发票

**端点:** `POST /api/invoices`

**必需字段:**
- `customer_id` - 已存在的客户ID
- `items` - 商品项目数组
  - `description` - 商品描述
  - `unit_price` - 单价

**可选字段:**
- `issue_date` - 签发日期（默认：今天）
- `due_date` - 到期日期（默认：30天后）
- `tax_rate` - 税率（默认：5.0%）
- `discount` - 折扣金额（默认：0）
- `status` - 状态（默认：pending）
- `notes` - 备注
- 商品项目中的 `quantity` - 数量（默认：1.0）

**请求示例（完整版）:**
```
curl -X POST http://127.0.0.1:5001/api/invoices -H "Content-Type: application/json" -d '{"customer_id": 1, "issue_date": "2025-06-09", "due_date": "2025-07-09", "tax_rate": 8.5, "discount": 50.0, "status": "pending", "notes": "Thank you for your business!", "items": [{"description": "Web Development Services", "quantity": 40, "unit_price": 150.00}, {"description": "Logo Design", "quantity": 1, "unit_price": 500.00}]}'
```

**请求示例（最简版）:**
```
curl -X POST http://127.0.0.1:5001/api/invoices -H "Content-Type: application/json" -d '{"customer_id": 8, "items": [{"description": "inspection fee", "unit_price": 100}]}'
```

**响应示例:**
```json
{
  "id": 10,
  "invoice_number": "INV-20250609-0003"
}
```

### 2.3 获取单个发票详情

**端点:** `GET /api/invoices/{invoice_id}`

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/invoices/1
```

**响应示例:**
```json
{
  "id": 1,
  "invoice_number": "INV-20250609-0001",
  "customer": {
    "id": 8,
    "name": "lin",
    "email": "",
    "phone": "13380090848",
    "address": ""
  },
  "issue_date": "2025-06-09",
  "due_date": "2025-07-09",
  "status": "pending",
  "tax_rate": 5.0,
  "discount": 0.0,
  "notes": "",
  "items": [
    {
      "id": 1,
      "description": "inspection fee",
      "quantity": 1.0,
      "unit_price": 100.0,
      "total": 100.0
    }
  ],
  "subtotal": 100.0,
  "tax_amount": 5.0,
  "total": 105.0
}
```

### 2.4 更新发票信息

**端点:** `PUT /api/invoices/{invoice_id}`

**可更新字段:**
- `customer_id` - 客户ID
- `issue_date` - 签发日期
- `due_date` - 到期日期
- `tax_rate` - 税率
- `discount` - 折扣金额
- `status` - 状态
- `notes` - 备注
- `items` - 商品项目数组（会替换所有现有项目）

**请求示例:**
```
curl -X PUT http://127.0.0.1:5001/api/invoices/1 -H "Content-Type: application/json" -d '{"status": "paid", "notes": "Payment received"}'
```

**响应示例:**
```json
{
  "message": "Invoice updated successfully"
}
```

### 2.5 删除发票

**端点:** `DELETE /api/invoices/{invoice_id}`

**请求示例:**
```
curl -X DELETE http://127.0.0.1:5001/api/invoices/1
```

**响应示例:**
```json
{
  "message": "Invoice deleted successfully"
}
```

### 2.6 下载发票PDF

**端点:** `GET /api/invoices/{invoice_id}/pdf`

**描述:** 生成并下载发票的PDF文件

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/invoices/1/pdf -o invoice_INV-20250609-0001.pdf
```

### 2.7 导出发票CSV

**端点:** `GET /api/invoices/export/csv`

**描述:** 导出所有发票数据为CSV文件

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/invoices/export/csv -o invoices_export.csv
```

---

## 3. 统计信息 API

### 3.1 获取系统统计

**端点:** `GET /api/stats`

**描述:** 获取系统的统计信息

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/stats
```

**响应示例:**
```json
{
  "total_customers": 7,
  "total_invoices": 10,
  "pending_invoices": 8,
  "paid_invoices": 2,
  "overdue_invoices": 0,
  "total_revenue": 1500.0,
  "pending_amount": 2100.0
}
```

---

## 4. 公司设置 API

### 4.1 获取公司设置

**端点:** `GET /api/company/settings`

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/company/settings
```

**响应示例:**
```json
{
  "id": 1,
  "company_name": "FANGXIN PLUMBING LTD",
  "address": "8900 DEMOREST DR.",
  "city_postal": "V7A4M1",
  "phone": "(604) 388-9995",
  "email": "PETERLJF@GMAIL.COM",
  "gst_number": "759154495RT0001"
}
```

### 4.2 更新公司设置

**端点:** `PUT /api/company/settings`

**可更新字段:**
- `company_name` - 公司名称
- `address` - 地址
- `city_postal` - 城市邮编
- `phone` - 电话
- `email` - 邮箱
- `gst_number` - GST号码

**请求示例:**
```
curl -X PUT http://127.0.0.1:5001/api/company/settings -H "Content-Type: application/json" -d '{"company_name": "New Company Name", "phone": "(604) 555-0123"}'
```

**响应示例:**
```json
{
  "id": 1,
  "company_name": "New Company Name",
  "address": "8900 DEMOREST DR.",
  "city_postal": "V7A4M1",
  "phone": "(604) 555-0123",
  "email": "PETERLJF@GMAIL.COM",
  "gst_number": "759154495RT0001"
}
```

---

## 5. 其他 API

### 5.1 获取客户列表（别名）

**端点:** `GET /api/clients`

**描述:** 与 `/api/customers` 功能相同，是客户API的别名

**请求示例:**
```
curl -X GET http://127.0.0.1:5001/api/clients
```

---

## 6. 错误处理

### 常见错误响应格式

```json
{
  "error": "错误描述信息"
}
```

### HTTP状态码

- `200` - 成功
- `201` - 创建成功
- `400` - 请求错误（缺少必需字段等）
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 7. 使用建议

### 7.1 创建发票的最佳实践

1. **先创建客户**（如果不存在）
2. **记录返回的客户ID**
3. **使用客户ID创建发票**

### 7.2 字段省略规则

- 不需要的字段可以完全从JSON中删除
- 空字符串和null值也会被相应处理
- 所有可选字段都有合理的默认值

### 7.3 日期格式

- 所有日期字段使用 `YYYY-MM-DD` 格式
- 例如：`"2025-06-09"`

### 7.4 数值格式

- 价格和数量支持小数
- 税率以百分比形式表示（如：5.0 表示 5%）
- 金额精确到小数点后两位

---

## 8. 快速开始示例

### 创建客户并生成发票的完整流程

```
# 1. 创建客户
curl -X POST http://127.0.0.1:5001/api/customers -H "Content-Type: application/json" -d '{"name": "John Doe", "phone": "123-456-7890"}'

# 返回: {"id": 10, "message": "Customer created successfully"}

# 2. 为客户创建发票
curl -X POST http://127.0.0.1:5001/api/invoices -H "Content-Type: application/json" -d '{"customer_id": 10, "items": [{"description": "Consulting Service", "unit_price": 200}]}'

# 返回: {"id": 15, "invoice_number": "INV-20250609-0004"}

# 3. 查看发票详情
curl -X GET http://127.0.0.1:5001/api/invoices/15

# 4. 下载PDF
curl -X GET http://127.0.0.1:5001/api/invoices/15/pdf -o invoice.pdf
```

---

**文档更新日期:** 2025-06-09  
**API版本:** v1.0 