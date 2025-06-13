# Invoice Management System API

A modern, full-featured invoice management system built with Flask and Vue.js, designed for small businesses to manage customers, create invoices, and track payments.

## 🚀 Features

### Core Features
- **Customer Management**: Create, read, update, and delete customer records
- **Invoice Management**: Full CRUD operations for invoices with automatic numbering
- **PDF Generation**: Professional invoice PDFs with company branding
- **Dashboard Analytics**: Real-time statistics and overview
- **CSV Export**: Export all invoices to CSV format for accounting
- **Webhook Integration**: Create invoices via API with minimal input

### Advanced Features
- **Smart Defaults**: Automatic tax calculation (5%), due dates (30 days), and quantity (1)
- **Status Management**: Track invoice status (pending, paid, overdue, cancelled)
- **Flexible Customer Matching**: Find customers by email or name
- **Multi-item Support**: Add multiple line items per invoice
- **Tax & Discount**: Configurable tax rates and discount amounts
- **Responsive Design**: Works on desktop, tablet, and mobile

## 📋 Prerequisites

- Python 3.8+
- SQLite (included with Python)
- Modern web browser

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/peter29ljf/invoiceapi.git
cd invoiceapi/invoice-web
```

2. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to:
```
http://localhost:5001
```

## 📁 Project Structure

```
invoice-web/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── instance/             # SQLite database directory
│   └── invoices.db       # Database file (auto-created)
├── static/               # Static assets
│   ├── css/
│   │   └── style.css     # Custom styles
│   └── js/
│       └── app.js        # Frontend JavaScript
├── templates/            # HTML templates
│   └── index.html        # Main application template
└── samples/              # API examples and webhook samples
    ├── api_examples.json
    ├── webhook_sample.json
    └── webhook_sample_minimal.json
```

## 🔌 API Endpoints

### Customer Endpoints
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create new customer
- `GET /api/customers/{id}` - Get customer details
- `PUT /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer

### Invoice Endpoints
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/{id}` - Get invoice details
- `PUT /api/invoices/{id}` - Update invoice (all fields including items)
- `DELETE /api/invoices/{id}` - Delete invoice
- `GET /api/invoices/{id}/pdf` - Download invoice PDF
- `GET /api/invoices/export/csv` - Export all invoices to CSV

### Webhook Endpoint
- `POST /api/webhook/invoice` - Create invoice via webhook

### Other Endpoints
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/company/settings` - Get company settings
- `PUT /api/company/settings` - Update company settings

## 📝 API Examples

### Create Customer
```json
POST /api/customers
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-123-4567",
  "address": "123 Main St\nNew York, NY 10001"
}
```

### Create Invoice (Standard)
```json
POST /api/invoices
{
  "customer_id": 1,
  "issue_date": "2025-01-20",
  "due_date": "2025-02-19",
  "tax_rate": 8.5,
  "discount": 50.00,
  "notes": "Thank you for your business!",
  "items": [
    {
      "description": "Web Development Services",
      "quantity": 40,
      "unit_price": 150.00
    }
  ]
}
```

### Create Invoice via Webhook (Minimal)
```json
POST /api/webhook/invoice
{
  "customer": {
    "name": "Quick Client"
  },
  "items": [
    {
      "description": "Consulting Service",
      "unit_price": 150.00
    }
  ]
}
```

### Update Invoice (Complete)
```json
PUT /api/invoices/{id}
{
  "customer_id": 2,
  "status": "paid",
  "issue_date": "2025-01-16",
  "due_date": "2025-02-20",
  "tax_rate": 9.0,
  "discount": 75.00,
  "notes": "Payment received",
  "items": [
    {
      "description": "Updated Service",
      "quantity": 45,
      "unit_price": 160.00
    }
  ]
}
```

### Default Values (Webhook)
- **Tax Rate**: 5%
- **Quantity**: 1
- **Issue Date**: Today
- **Due Date**: 30 days from today
- **Status**: pending
- **Discount**: 0

## 🎨 Features Overview

### 1. Dashboard
- Total revenue tracking
- Pending amounts
- Invoice and customer counts
- Recent invoice list

### 2. Invoice Management
- Create invoices with multiple line items
- Edit all invoice fields including items
- Quick status change (Pending → Paid)
- PDF generation with company branding
- CSV export for accounting

### 3. Customer Management
- Complete CRUD operations
- Customer history tracking
- Protection against deleting customers with invoices

### 4. Company Settings
- Customizable company information
- Real-time PDF preview
- GST/Tax number support

## 🔧 Configuration

### Database
The application uses SQLite database stored in `instance/invoices.db`. The database is automatically created on first run.

### Company Settings
Default company settings can be modified through the Settings page in the application.

### Port Configuration
Default port is 5001. To change:
```python
app.run(debug=True, port=5001, host='0.0.0.0')
```

## 📊 CSV Export Format

The CSV export includes the following columns:
- Invoice Number
- Customer Name
- Customer Email
- Customer Phone
- Issue Date
- Due Date
- Status
- Items (formatted text)
- Subtotal
- Tax Rate (%)
- Tax Amount
- Discount
- Total
- Notes
- Created At

## 🐛 Troubleshooting

### Database Issues
If you encounter database errors:
```bash
rm instance/invoices.db
python app.py  # Database will be recreated
```

### Port Already in Use
If port 5001 is in use:
```bash
# Find process using port
lsof -i :5001
# Or change port in app.py
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

- **Peter Lin** - [GitHub](https://github.com/peter29ljf)

## 🙏 Acknowledgments

- Flask framework for the backend
- ReportLab for PDF generation
- Bootstrap for UI components
- SQLAlchemy for database ORM