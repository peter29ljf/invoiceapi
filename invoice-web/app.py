from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os
import json
import csv
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle
from reportlab.lib.colors import HexColor
import io

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///invoices.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

db = SQLAlchemy(app)

# Database Models
class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    invoices = db.relationship('Invoice', backref='customer', lazy=True)

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, paid, overdue, cancelled
    tax_rate = db.Column(db.Float, default=0.0)
    discount = db.Column(db.Float, default=0.0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('InvoiceItem', backref='invoice', lazy=True, cascade='all, delete-orphan')
    
    @property
    def subtotal(self):
        return sum(item.total for item in self.items)
    
    @property
    def tax_amount(self):
        return self.subtotal * (self.tax_rate / 100)
    
    @property
    def total(self):
        return self.subtotal + self.tax_amount - self.discount

class InvoiceItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    
    @property
    def total(self):
        return self.quantity * self.unit_price

class CompanySettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(100), default='FANGXIN PLUMBING LTD')
    address = db.Column(db.String(200), default='8900 DEMOREST DR.')
    city_postal = db.Column(db.String(50), default='V7A4M1')
    phone = db.Column(db.String(20), default='(604) 388-9995')
    email = db.Column(db.String(100), default='PETERLJF@GMAIL.COM')
    gst_number = db.Column(db.String(30), default='759154495RT0001')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    @staticmethod
    def get_settings():
        settings = CompanySettings.query.first()
        if not settings:
            settings = CompanySettings()
            db.session.add(settings)
            db.session.commit()
        return settings

# Create tables
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Customer API endpoints
@app.route('/api/customers', methods=['GET', 'POST'])
def customers():
    if request.method == 'GET':
        customers = Customer.query.all()
        return jsonify([{
            'id': c.id,
            'name': c.name,
            'email': c.email,
            'phone': c.phone,
            'address': c.address,
            'created_at': c.created_at.isoformat()
        } for c in customers])
    
    elif request.method == 'POST':
        data = request.json
        customer = Customer(
            name=data['name'],
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            address=data.get('address', '')
        )
        db.session.add(customer)
        db.session.commit()
        return jsonify({'id': customer.id, 'message': 'Customer created successfully'}), 201

# Customer detail endpoints
@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
def customer_detail(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    
    if request.method == 'GET':
        return jsonify({
            'id': customer.id,
            'name': customer.name,
            'email': customer.email,
            'phone': customer.phone,
            'address': customer.address,
            'created_at': customer.created_at.isoformat()
        })
    
    elif request.method == 'PUT':
        data = request.json
        customer.name = data.get('name', customer.name)
        customer.email = data.get('email', customer.email)
        customer.phone = data.get('phone', customer.phone)
        customer.address = data.get('address', customer.address)
        
        db.session.commit()
        return jsonify({'message': 'Customer updated successfully'})
    
    elif request.method == 'DELETE':
        # Check if customer has invoices
        if customer.invoices:
            return jsonify({'error': 'Cannot delete customer with existing invoices'}), 400
        
        db.session.delete(customer)
        db.session.commit()
        return jsonify({'message': 'Customer deleted successfully'})

# Invoice API endpoints
@app.route('/api/invoices', methods=['GET', 'POST'])
def invoices():
    if request.method == 'GET':
        # Get all invoices, including those with missing customers
        invoices = Invoice.query.all()
        
        return jsonify([{
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'customer_name': inv.customer.name if inv.customer else '[Customer Deleted]',
            'issue_date': inv.issue_date.isoformat(),
            'due_date': inv.due_date.isoformat(),
            'status': inv.status,
            'total': inv.total,
            'created_at': inv.created_at.isoformat()
        } for inv in invoices])
    
    elif request.method == 'POST':
        data = request.json
        
        # Validate required fields
        if 'customer_id' not in data:
            return jsonify({'error': 'customer_id is required'}), 400
        
        if 'items' not in data or not data['items']:
            return jsonify({'error': 'At least one item is required'}), 400
        
        # Generate invoice number
        today = datetime.now()
        count = Invoice.query.filter(
            db.func.date(Invoice.created_at) == today.date()
        ).count()
        invoice_number = f"INV-{today.strftime('%Y%m%d')}-{count + 1:04d}"
        
        # Set smart defaults for dates
        today_str = today.strftime('%Y-%m-%d')
        due_date_default = (today + timedelta(days=30)).strftime('%Y-%m-%d')  # 30 days from today
        
        invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=data['customer_id'],
            issue_date=datetime.strptime(data.get('issue_date', today_str), '%Y-%m-%d').date(),
            due_date=datetime.strptime(data.get('due_date', due_date_default), '%Y-%m-%d').date(),
            tax_rate=data.get('tax_rate', 5.0),  # Default 5% tax
            discount=data.get('discount', 0),
            notes=data.get('notes', ''),
            status=data.get('status', 'pending')
        )
        db.session.add(invoice)
        db.session.flush()

        # Add items
        for item in data['items']:
            # Validate item required fields
            if not item.get('description'):
                return jsonify({'error': 'Item description is required'}), 400
            if not item.get('unit_price'):
                return jsonify({'error': 'Item unit_price is required'}), 400
                
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                description=item['description'],
                quantity=item.get('quantity', 1.0),  # Default quantity 1
                unit_price=float(item['unit_price'])
            )
            db.session.add(invoice_item)

        db.session.commit()
        return jsonify({'id': invoice.id, 'invoice_number': invoice.invoice_number}), 201

@app.route('/api/invoices/<int:invoice_id>', methods=['GET', 'PUT', 'DELETE'])
def invoice_detail(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    
    if request.method == 'GET':
        return jsonify({
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'customer': {
                'id': invoice.customer.id,
                'name': invoice.customer.name,
                'email': invoice.customer.email,
                'phone': invoice.customer.phone,
                'address': invoice.customer.address
            },
            'issue_date': invoice.issue_date.isoformat(),
            'due_date': invoice.due_date.isoformat(),
            'status': invoice.status,
            'tax_rate': invoice.tax_rate,
            'discount': invoice.discount,
            'notes': invoice.notes,
            'items': [{
                'id': item.id,
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'total': item.total
            } for item in invoice.items],
            'subtotal': invoice.subtotal,
            'tax_amount': invoice.tax_amount,
            'total': invoice.total
        })
    
    elif request.method == 'PUT':
        data = request.json
        
        # Update basic fields
        invoice.status = data.get('status', invoice.status)
        invoice.tax_rate = data.get('tax_rate', invoice.tax_rate)
        invoice.discount = data.get('discount', invoice.discount)
        invoice.notes = data.get('notes', invoice.notes)
        
        # Update customer if provided
        if 'customer_id' in data:
            invoice.customer_id = data['customer_id']
        
        # Update dates if provided
        if 'due_date' in data:
            invoice.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        
        if 'issue_date' in data:
            invoice.issue_date = datetime.strptime(data['issue_date'], '%Y-%m-%d').date()
        
        # Update items if provided
        if 'items' in data:
            # Delete existing items
            InvoiceItem.query.filter_by(invoice_id=invoice.id).delete()
            
            # Add new items
            for item_data in data['items']:
                new_item = InvoiceItem(
                    invoice_id=invoice.id,
                    description=item_data['description'],
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price']
                )
                db.session.add(new_item)
        
        db.session.commit()
        return jsonify({'message': 'Invoice updated successfully'})
    
    elif request.method == 'DELETE':
        db.session.delete(invoice)
        db.session.commit()
        return jsonify({'message': 'Invoice deleted successfully'})

# Webhook endpoint
@app.route('/api/webhook/invoice', methods=['POST'])
def webhook_invoice():
    try:
        data = request.json
        
        # Validate minimal webhook data
        if not data or 'customer' not in data or 'items' not in data:
            return jsonify({'error': 'Missing required fields: customer and items'}), 400
        
        # Validate customer has at least a name
        customer_data = data['customer']
        if not customer_data.get('name'):
            return jsonify({'error': 'Customer name is required'}), 400
        
        # Validate items
        if not data['items'] or len(data['items']) == 0:
            return jsonify({'error': 'At least one item is required'}), 400
        
        # Check if customer exists or create new (more flexible matching)
        customer = None
        
        # Try to find by email first (if provided)
        if customer_data.get('email'):
            customer = Customer.query.filter_by(email=customer_data['email']).first()
        
        # If not found by email, try to find by name (exact match)
        if not customer:
            customer = Customer.query.filter_by(name=customer_data['name']).first()
        
        # Create new customer if not found
        if not customer:
            customer = Customer(
                name=customer_data['name'],
                email=customer_data.get('email', ''),
                phone=customer_data.get('phone', ''),
                address=customer_data.get('address', '')
            )
            db.session.add(customer)
            db.session.flush()
        
        # Generate invoice number
        today = datetime.now()
        count = Invoice.query.filter(
            db.func.date(Invoice.created_at) == today.date()
        ).count()
        invoice_number = f"INV-{today.strftime('%Y%m%d')}-{count + 1:04d}"
        
        # Set smart defaults
        today_str = today.strftime('%Y-%m-%d')
        due_date_default = (today + timedelta(days=30)).strftime('%Y-%m-%d')  # 30 days from today
        
        # Create invoice with defaults
        invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=customer.id,
            issue_date=datetime.strptime(data.get('issue_date', today_str), '%Y-%m-%d').date(),
            due_date=datetime.strptime(data.get('due_date', due_date_default), '%Y-%m-%d').date(),
            tax_rate=data.get('tax_rate', 5.0),  # Default 5% tax
            discount=data.get('discount', 0),
            notes=data.get('notes', ''),
            status=data.get('status', 'pending')  # Default pending status
        )
        db.session.add(invoice)
        db.session.flush()
        
        # Add items with defaults
        for item in data['items']:
            # Validate item has required fields
            if not item.get('description'):
                raise ValueError('Item description is required')
            if not item.get('unit_price'):
                raise ValueError('Item unit_price is required')
            
            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                description=item['description'],
                quantity=item.get('quantity', 1.0),  # Default quantity 1
                unit_price=float(item['unit_price'])
            )
            db.session.add(invoice_item)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'customer_id': customer.id,
            'customer_name': customer.name,
            'total': invoice.total,
            'pdf_url': f'/api/invoices/{invoice.id}/pdf'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Company Settings API
@app.route('/api/company/settings', methods=['GET', 'PUT'])
def company_settings():
    if request.method == 'GET':
        try:
            settings = CompanySettings.get_settings()
            return jsonify({
                'id': settings.id,
                'company_name': settings.company_name,
                'address': settings.address,
                'city_postal': settings.city_postal,
                'phone': settings.phone,
                'email': settings.email,
                'gst_number': settings.gst_number
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            settings = CompanySettings.get_settings()
            
            # Update settings
            if 'company_name' in data:
                settings.company_name = data['company_name']
            if 'address' in data:
                settings.address = data['address']
            if 'city_postal' in data:
                settings.city_postal = data['city_postal']
            if 'phone' in data:
                settings.phone = data['phone']
            if 'email' in data:
                settings.email = data['email']
            if 'gst_number' in data:
                settings.gst_number = data['gst_number']
            
            db.session.commit()
            
            return jsonify({
                'id': settings.id,
                'company_name': settings.company_name,
                'address': settings.address,
                'city_postal': settings.city_postal,
                'phone': settings.phone,
                'email': settings.email,
                'gst_number': settings.gst_number
            })
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

# Statistics API
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        total_customers = Customer.query.count()
        total_invoices = Invoice.query.count()
        pending_invoices = Invoice.query.filter_by(status='pending').count()
        paid_invoices = Invoice.query.filter_by(status='paid').count()
        overdue_invoices = Invoice.query.filter_by(status='overdue').count()
        
        # Calculate total revenue from paid invoices
        paid_invoices_list = Invoice.query.filter_by(status='paid').all()
        total_revenue = sum(invoice.total for invoice in paid_invoices_list)
        
        # Calculate pending amount from pending invoices
        pending_invoices_list = Invoice.query.filter_by(status='pending').all()
        pending_amount = sum(invoice.total for invoice in pending_invoices_list)
        
        return jsonify({
            'total_customers': total_customers,
            'total_invoices': total_invoices,
            'pending_invoices': pending_invoices,
            'paid_invoices': paid_invoices,
            'overdue_invoices': overdue_invoices,
            'total_revenue': float(total_revenue),
            'pending_amount': float(pending_amount)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Clients API (alias for customers)
@app.route('/api/clients', methods=['GET'])
def get_clients():
    return customers()

# PDF generation
@app.route('/api/invoices/<int:invoice_id>/pdf')
def generate_pdf(invoice_id):
    invoice = Invoice.query.get_or_404(invoice_id)
    company = CompanySettings.get_settings()
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Company Header Background - Blue gradient effect
    p.setFillColor(HexColor('#1e3a8a'))  # Dark blue
    p.rect(0, height - 120, width, 120, fill=1, stroke=0)
    
    # Company Information (White text on blue background)
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 22)
    p.drawString(60, height - 40, company.company_name)
    
    p.setFont("Helvetica", 11)
    p.drawString(60, height - 65, company.address)
    p.drawString(250, height - 65, f"P: {company.phone}")
    p.drawString(420, height - 65, f"Email: {company.email}")
    p.drawString(60, height - 90, company.city_postal)
    p.drawString(250, height - 90, f"GST#: {company.gst_number}")
    
    # Invoice Label centered
    p.setFillColor(HexColor('#dc2626'))  # Red accent
    p.setFont("Helvetica-Bold", 32)
    invoice_text = "INVOICE"
    text_width = p.stringWidth(invoice_text, "Helvetica-Bold", 32)
    p.drawString((width - text_width) / 2, height - 110, invoice_text)
    
    # Invoice details section with light background
    p.setFillColor(HexColor('#f3f4f6'))  # Light gray background
    p.rect(0, height - 200, width, 80, fill=1, stroke=0)
    
    # Invoice details text
    p.setFillColor(HexColor('#1f2937'))  # Dark gray text
    p.setFont("Helvetica-Bold", 12)
    p.drawString(60, height - 150, "Invoice Number:")
    p.drawString(60, height - 175, "Issue Date:")
    p.drawString(60, height - 200, "Due Date:")
    
    p.setFont("Helvetica", 12)
    p.drawString(180, height - 150, invoice.invoice_number)
    p.drawString(180, height - 175, str(invoice.issue_date))
    p.drawString(180, height - 200, str(invoice.due_date))
    
    # Customer details with accent color
    p.setFillColor(HexColor('#1e3a8a'))  # Blue accent
    p.setFont("Helvetica-Bold", 14)
    p.drawString(350, height - 150, "Bill To:")
    
    p.setFillColor(HexColor('#1f2937'))  # Dark gray
    p.setFont("Helvetica-Bold", 12)
    p.drawString(350, height - 175, invoice.customer.name)
    p.setFont("Helvetica", 10)
    if invoice.customer.address:
        lines = invoice.customer.address.split('\n')
        y = height - 200
        for line in lines:
            p.drawString(350, y, line)
            y -= 18
    
    # Items table header with colored background
    y = height - 300
    p.setFillColor(HexColor('#1e3a8a'))  # Blue header
    p.rect(50, y - 5, width - 100, 30, fill=1, stroke=0)
    
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 11)
    p.drawString(60, y + 3, "Description")
    p.drawString(300, y + 3, "Qty")
    p.drawString(350, y + 3, "Unit Price")
    p.drawString(450, y + 3, "Total")
    
    # Items with alternating row colors
    p.setFont("Helvetica", 10)
    y -= 40
    row_count = 0
    for item in invoice.items:
        if row_count % 2 == 0:
            p.setFillColor(HexColor('#f9fafb'))  # Light gray for even rows
            p.rect(50, y - 8, width - 100, 25, fill=1, stroke=0)
        
        p.setFillColor(HexColor('#1f2937'))  # Dark text
        p.drawString(60, y, item.description[:40])
        p.drawString(300, y, str(item.quantity))
        p.drawString(350, y, f"${item.unit_price:.2f}")
        p.drawString(450, y, f"${item.total:.2f}")
        y -= 25
        row_count += 1
    
    # Totals section with background
    y -= 20
    p.setStrokeColor(HexColor('#d1d5db'))
    p.setLineWidth(1)
    p.line(340, y + 10, width - 60, y + 10)
    
    # Subtotal
    p.setFillColor(HexColor('#1f2937'))
    p.setFont("Helvetica", 11)
    p.drawString(350, y - 5, "Subtotal:")
    p.drawString(450, y - 5, f"${invoice.subtotal:.2f}")
    y -= 25
    
    # Tax
    if invoice.tax_rate > 0:
        p.setFillColor(HexColor('#6b7280'))
        p.drawString(350, y, f"Tax ({invoice.tax_rate}%):")
        p.drawString(450, y, f"${invoice.tax_amount:.2f}")
        y -= 25
    
    # Discount
    if invoice.discount > 0:
        p.setFillColor(HexColor('#dc2626'))  # Red for discount
        p.drawString(350, y, "Discount:")
        p.drawString(450, y, f"-${invoice.discount:.2f}")
        y -= 25
    
    # Total with highlighted background
    y -= 15
    p.setFillColor(HexColor('#1e3a8a'))  # Blue background for total
    p.rect(340, y - 8, width - 380, 35, fill=1, stroke=0)
    
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 14)
    p.drawString(350, y + 5, "Total:")
    p.drawString(450, y + 5, f"${invoice.total:.2f}")
    
    # Notes section with border
    if invoice.notes:
        p.setFillColor(HexColor('#fef3c7'))  # Light yellow background
        p.rect(50, 60, width - 100, 70, fill=1, stroke=0)
        
        p.setStrokeColor(HexColor('#f59e0b'))  # Orange border
        p.setLineWidth(2)
        p.rect(50, 60, width - 100, 70, fill=0, stroke=1)
        
        p.setFillColor(HexColor('#1f2937'))
        p.setFont("Helvetica-Bold", 11)
        p.drawString(60, 110, "Notes:")
        p.setFont("Helvetica", 10)
        
        # Handle multi-line notes
        notes_lines = invoice.notes.split('\n')
        y_note = 90
        for line in notes_lines[:2]:  # Show first 2 lines
            if len(line) > 75:
                line = line[:72] + '...'
            p.drawString(60, y_note, line)
            y_note -= 18
    
    # Footer
    p.setFillColor(HexColor('#6b7280'))
    p.setFont("Helvetica", 8)
    p.drawCentredString(width/2, 30, "Thank you for your business!")
    
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'invoice_{invoice.invoice_number}.pdf',
        mimetype='application/pdf'
    )

# CSV export endpoint
@app.route('/api/invoices/export/csv')
def export_invoices_csv():
    try:
        invoices = Invoice.query.all()
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Invoice Number',
            'Customer Name', 
            'Customer Email',
            'Customer Phone',
            'Issue Date',
            'Due Date',
            'Status',
            'Items',
            'Subtotal',
            'Tax Rate (%)',
            'Tax Amount',
            'Discount',
            'Total',
            'Notes',
            'Created At'
        ])
        
        # Write invoice data
        for invoice in invoices:
            # Format items as readable text
            items_text = '; '.join([
                f"{item.description} (Qty: {item.quantity}, Price: ${item.unit_price:.2f}, Total: ${item.total:.2f})"
                for item in invoice.items
            ])
            
            writer.writerow([
                invoice.invoice_number,
                invoice.customer.name,
                invoice.customer.email or '',
                invoice.customer.phone or '',
                invoice.issue_date.strftime('%Y-%m-%d'),
                invoice.due_date.strftime('%Y-%m-%d'),
                invoice.status,
                items_text,
                f"${invoice.subtotal:.2f}",
                f"{invoice.tax_rate:.2f}%",
                f"${invoice.tax_amount:.2f}",
                f"${invoice.discount:.2f}",
                f"${invoice.total:.2f}",
                invoice.notes or '',
                invoice.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        # Convert to bytes
        output.seek(0)
        csv_data = output.getvalue()
        output.close()
        
        # Create response
        buffer = io.BytesIO()
        buffer.write(csv_data.encode('utf-8'))
        buffer.seek(0)
        
        filename = f"invoices_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001, host='0.0.0.0')