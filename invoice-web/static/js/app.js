// Global variables
let customers = [];
let invoices = [];
let currentInvoiceId = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    
    document.querySelector('input[name="issue_date"]').value = today;
    document.querySelector('input[name="due_date"]').value = dueDate.toISOString().split('T')[0];
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const view = this.getAttribute('data-view');
            showView(view);
        });
    });
    
    // Load initial data
    loadDashboard();
    loadCustomers();
    loadInvoices();
    loadWebhookSample();
});

// View management
function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    
    document.getElementById(viewName + '-view').style.display = 'block';
    
    // Update active nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-view') === viewName) {
            link.classList.add('active');
        }
    });
    
    // Load data for specific views
    if (viewName === 'settings') {
        loadCompanySettings();
        setupCompanySettingsPreview();
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch('/api/invoices');
        const data = await response.json();
        
        const stats = {
            total: data.length,
            paid: data.filter(inv => inv.status === 'paid').length,
            pending: data.filter(inv => inv.status === 'pending').length,
            overdue: data.filter(inv => inv.status === 'overdue').length
        };
        
        document.getElementById('total-invoices').textContent = stats.total;
        document.getElementById('paid-invoices').textContent = stats.paid;
        document.getElementById('pending-invoices').textContent = stats.pending;
        document.getElementById('overdue-invoices').textContent = stats.overdue;
        
        // Recent invoices
        const recent = data.slice(-5).reverse();
        const recentHtml = recent.map(inv => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <div>
                    <strong>${inv.invoice_number}</strong> - ${inv.customer_name}
                </div>
                <div>
                    <span class="badge status-${inv.status}">${inv.status}</span>
                    $${inv.total.toFixed(2)}
                </div>
            </div>
        `).join('');
        
        document.getElementById('recent-invoices-list').innerHTML = recentHtml || '<p class="text-muted">No invoices yet</p>';
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Customers
async function loadCustomers() {
    try {
        const response = await fetch('/api/customers');
        customers = await response.json();
        
        // Update customer table
        const tbody = document.getElementById('customers-tbody');
        tbody.innerHTML = customers.map(customer => `
            <tr>
                <td>${customer.name}</td>
                <td>${customer.email || '-'}</td>
                <td>${customer.phone || '-'}</td>
                <td>${customer.address || '-'}</td>
                <td>${new Date(customer.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editCustomer(${customer.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCustomer(${customer.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Update customer select in invoice form
        const select = document.querySelector('select[name="customer_id"]');
        select.innerHTML = '<option value="">Select Customer</option>' + 
            customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function showNewCustomerModal() {
    document.getElementById('newCustomerForm').reset();
    new bootstrap.Modal(document.getElementById('newCustomerModal')).show();
}

let editingCustomerId = null;

async function editCustomer(id) {
    try {
        const response = await fetch(`/api/customers/${id}`);
        const customer = await response.json();
        
        editingCustomerId = id;
        
        // Fill the form with customer data
        const form = document.getElementById('newCustomerForm');
        form.querySelector('input[name="name"]').value = customer.name;
        form.querySelector('input[name="email"]').value = customer.email || '';
        form.querySelector('input[name="phone"]').value = customer.phone || '';
        form.querySelector('textarea[name="address"]').value = customer.address || '';
        
        // Change modal title
        document.querySelector('#newCustomerModal .modal-title').textContent = 'Edit Customer';
        
        new bootstrap.Modal(document.getElementById('newCustomerModal')).show();
    } catch (error) {
        console.error('Error loading customer:', error);
        showAlert('Error loading customer', 'danger');
    }
}

async function saveCustomer() {
    const form = document.getElementById('newCustomerForm');
    const formData = new FormData(form);
    
    const customerData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address')
    };
    
    try {
        const url = editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers';
        const method = editingCustomerId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('newCustomerModal')).hide();
            loadCustomers();
            showAlert(`Customer ${editingCustomerId ? 'updated' : 'created'} successfully`, 'success');
            
            // Reset editing state
            editingCustomerId = null;
            document.querySelector('#newCustomerModal .modal-title').textContent = 'New Customer';
        } else {
            showAlert(`Error ${editingCustomerId ? 'updating' : 'creating'} customer`, 'danger');
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        showAlert('Error saving customer', 'danger');
    }
}

async function deleteCustomer(id) {
    if (!confirm('Are you sure you want to delete this customer?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/customers/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadCustomers();
            showAlert('Customer deleted successfully', 'success');
        } else {
            const data = await response.json();
            showAlert(data.error || 'Error deleting customer', 'danger');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showAlert('Error deleting customer', 'danger');
    }
}

// Invoices
async function loadInvoices() {
    try {
        const response = await fetch('/api/invoices');
        invoices = await response.json();
        
        const tbody = document.getElementById('invoices-tbody');
        tbody.innerHTML = invoices.map(invoice => `
            <tr onclick="showInvoiceDetails(${invoice.id})">
                <td>${invoice.invoice_number}</td>
                <td>${invoice.customer_name}</td>
                <td>${new Date(invoice.issue_date).toLocaleDateString()}</td>
                <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
                <td>$${invoice.total.toFixed(2)}</td>
                <td><span class="badge status-${invoice.status}">${invoice.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editInvoice(${invoice.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteInvoice(${invoice.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

function showNewInvoiceModal() {
    document.getElementById('newInvoiceForm').reset();
    
    // Reset to single item
    const itemsContainer = document.getElementById('invoice-items');
    itemsContainer.innerHTML = `
        <div class="invoice-item-row mb-2">
            <div class="row">
                <div class="col-md-6">
                    <input type="text" class="form-control" placeholder="Description" name="item_description[]" required>
                </div>
                <div class="col-md-2">
                    <input type="number" class="form-control" placeholder="Qty" name="item_quantity[]" step="0.01" required>
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control" placeholder="Unit Price" name="item_price[]" step="0.01" required>
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeItem(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    new bootstrap.Modal(document.getElementById('newInvoiceModal')).show();
}

function addInvoiceItem() {
    const itemsContainer = document.getElementById('invoice-items');
    const newItem = document.createElement('div');
    newItem.className = 'invoice-item-row mb-2';
    newItem.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <input type="text" class="form-control" placeholder="Description" name="item_description[]" required>
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" placeholder="Qty" name="item_quantity[]" step="0.01" required>
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control" placeholder="Unit Price" name="item_price[]" step="0.01" required>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-sm btn-danger" onclick="removeItem(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    itemsContainer.appendChild(newItem);
}

function removeItem(button) {
    const itemsContainer = document.getElementById('invoice-items');
    if (itemsContainer.children.length > 1) {
        button.closest('.invoice-item-row').remove();
    }
}

async function saveInvoice() {
    const form = document.getElementById('newInvoiceForm');
    const formData = new FormData(form);
    
    const items = [];
    const descriptions = formData.getAll('item_description[]');
    const quantities = formData.getAll('item_quantity[]');
    const prices = formData.getAll('item_price[]');
    
    for (let i = 0; i < descriptions.length; i++) {
        items.push({
            description: descriptions[i],
            quantity: parseFloat(quantities[i]),
            unit_price: parseFloat(prices[i])
        });
    }
    
    const invoiceData = {
        customer_id: parseInt(formData.get('customer_id')),
        issue_date: formData.get('issue_date'),
        due_date: formData.get('due_date'),
        tax_rate: parseFloat(formData.get('tax_rate')) || 0,
        discount: parseFloat(formData.get('discount')) || 0,
        notes: formData.get('notes'),
        items: items
    };
    
    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(invoiceData)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('newInvoiceModal')).hide();
            loadInvoices();
            loadDashboard();
            showAlert('Invoice created successfully', 'success');
        } else {
            showAlert('Error creating invoice', 'danger');
        }
    } catch (error) {
        console.error('Error saving invoice:', error);
        showAlert('Error saving invoice', 'danger');
    }
}

async function showInvoiceDetails(invoiceId) {
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`);
        const invoice = await response.json();
        
        const content = `
            <div class="invoice-details-header">
                <div class="row">
                    <div class="col-md-6">
                        <h4>${invoice.invoice_number}</h4>
                        <p class="mb-1">Issue Date: ${new Date(invoice.issue_date).toLocaleDateString()}</p>
                        <p class="mb-1">Due Date: ${new Date(invoice.due_date).toLocaleDateString()}</p>
                        <p>
                            <span class="badge status-${invoice.status}">${invoice.status}</span>
                            ${invoice.status === 'pending' ? `
                                <button class="btn btn-sm btn-success ms-2" onclick="markInvoiceAsPaid(${invoice.id})">
                                    <i class="bi bi-check-circle"></i> Mark as Paid
                                </button>
                            ` : ''}
                        </p>
                    </div>
                    <div class="col-md-6 text-md-end">
                        <h5>Bill To:</h5>
                        <p class="mb-1"><strong>${invoice.customer.name}</strong></p>
                        ${invoice.customer.email ? `<p class="mb-1">${invoice.customer.email}</p>` : ''}
                        ${invoice.customer.phone ? `<p class="mb-1">${invoice.customer.phone}</p>` : ''}
                        ${invoice.customer.address ? `<p class="mb-1">${invoice.customer.address.replace(/\n/g, '<br>')}</p>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="invoice-items-table">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th class="text-center">Quantity</th>
                            <th class="text-end">Unit Price</th>
                            <th class="text-end">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoice.items.map(item => `
                            <tr>
                                <td>${item.description}</td>
                                <td class="text-center">${item.quantity}</td>
                                <td class="text-end">$${item.unit_price.toFixed(2)}</td>
                                <td class="text-end">$${item.total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="invoice-totals">
                <div class="row">
                    <div class="col-md-6 offset-md-6">
                        <div class="row">
                            <div class="col-6">Subtotal:</div>
                            <div class="col-6">$${invoice.subtotal.toFixed(2)}</div>
                        </div>
                        ${invoice.tax_rate > 0 ? `
                            <div class="row">
                                <div class="col-6">Tax (${invoice.tax_rate}%):</div>
                                <div class="col-6">$${invoice.tax_amount.toFixed(2)}</div>
                            </div>
                        ` : ''}
                        ${invoice.discount > 0 ? `
                            <div class="row">
                                <div class="col-6">Discount:</div>
                                <div class="col-6">-$${invoice.discount.toFixed(2)}</div>
                            </div>
                        ` : ''}
                        <div class="row total-row">
                            <div class="col-6">Total:</div>
                            <div class="col-6">$${invoice.total.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${invoice.notes ? `
                <div class="mt-4">
                    <h6>Notes:</h6>
                    <p>${invoice.notes}</p>
                </div>
            ` : ''}
        `;
        
        document.getElementById('invoiceDetailsContent').innerHTML = content;
        document.getElementById('downloadPdfBtn').href = `/api/invoices/${invoiceId}/pdf`;
        
        new bootstrap.Modal(document.getElementById('invoiceDetailsModal')).show();
    } catch (error) {
        console.error('Error loading invoice details:', error);
        showAlert('Error loading invoice details', 'danger');
    }
}

async function editInvoice(invoiceId) {
    try {
        // Load customers for the dropdown
        await loadCustomers();
        
        const response = await fetch(`/api/invoices/${invoiceId}`);
        const invoice = await response.json();
        
        // Fill the edit form
        const form = document.getElementById('editInvoiceForm');
        form.querySelector('input[name="invoice_id"]').value = invoice.id;
        form.querySelector('select[name="customer_id"]').value = invoice.customer.id;
        form.querySelector('select[name="status"]').value = invoice.status;
        form.querySelector('input[name="issue_date"]').value = invoice.issue_date;
        form.querySelector('input[name="due_date"]').value = invoice.due_date;
        form.querySelector('input[name="tax_rate"]').value = invoice.tax_rate;
        form.querySelector('input[name="discount"]').value = invoice.discount;
        form.querySelector('textarea[name="notes"]').value = invoice.notes || '';
        
        // Populate customer dropdown
        const customerSelect = form.querySelector('select[name="customer_id"]');
        customerSelect.innerHTML = '<option value="">Select Customer</option>' + 
            customers.map(c => `<option value="${c.id}" ${c.id === invoice.customer.id ? 'selected' : ''}>${c.name}</option>`).join('');
        
        // Populate items
        populateEditInvoiceItems(invoice.items);
        
        new bootstrap.Modal(document.getElementById('editInvoiceModal')).show();
    } catch (error) {
        console.error('Error loading invoice for editing:', error);
        showAlert('Error loading invoice', 'danger');
    }
}

function populateEditInvoiceItems(items) {
    const container = document.getElementById('edit-invoice-items');
    container.innerHTML = '';
    
    items.forEach(item => {
        addEditInvoiceItem(item);
    });
    
    // Add one empty item if no items exist
    if (items.length === 0) {
        addEditInvoiceItem();
    }
}

function addEditInvoiceItem(itemData = null) {
    const container = document.getElementById('edit-invoice-items');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'edit-invoice-item-row mb-2';
    itemDiv.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <input type="text" class="form-control" placeholder="Description" name="item_description[]" value="${itemData ? itemData.description : ''}" required>
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control" placeholder="Qty" name="item_quantity[]" step="0.01" value="${itemData ? itemData.quantity : ''}" required>
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control" placeholder="Unit Price" name="item_price[]" step="0.01" value="${itemData ? itemData.unit_price : ''}" required>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-sm btn-danger" onclick="removeEditItem(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(itemDiv);
}

function removeEditItem(button) {
    const container = document.getElementById('edit-invoice-items');
    if (container.children.length > 1) {
        button.closest('.edit-invoice-item-row').remove();
    }
}

async function updateInvoice() {
    const form = document.getElementById('editInvoiceForm');
    const formData = new FormData(form);
    const invoiceId = formData.get('invoice_id');
    
    // Collect items data
    const descriptions = formData.getAll('item_description[]');
    const quantities = formData.getAll('item_quantity[]');
    const prices = formData.getAll('item_price[]');
    
    const items = [];
    for (let i = 0; i < descriptions.length; i++) {
        if (descriptions[i] && quantities[i] && prices[i]) {
            items.push({
                description: descriptions[i],
                quantity: parseFloat(quantities[i]),
                unit_price: parseFloat(prices[i])
            });
        }
    }
    
    if (items.length === 0) {
        showAlert('Please add at least one invoice item', 'danger');
        return;
    }
    
    const updateData = {
        customer_id: parseInt(formData.get('customer_id')),
        status: formData.get('status'),
        issue_date: formData.get('issue_date'),
        due_date: formData.get('due_date'),
        tax_rate: parseFloat(formData.get('tax_rate')) || 0,
        discount: parseFloat(formData.get('discount')) || 0,
        notes: formData.get('notes'),
        items: items
    };
    
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('editInvoiceModal')).hide();
            loadInvoices();
            loadDashboard();
            showAlert('Invoice updated successfully', 'success');
        } else {
            showAlert('Error updating invoice', 'danger');
        }
    } catch (error) {
        console.error('Error updating invoice:', error);
        showAlert('Error updating invoice', 'danger');
    }
}

async function markInvoiceAsPaid(invoiceId) {
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'paid' })
        });
        
        if (response.ok) {
            // Close the details modal
            bootstrap.Modal.getInstance(document.getElementById('invoiceDetailsModal')).hide();
            loadInvoices();
            loadDashboard();
            showAlert('Invoice marked as paid successfully', 'success');
        } else {
            showAlert('Error updating invoice status', 'danger');
        }
    } catch (error) {
        console.error('Error updating invoice status:', error);
        showAlert('Error updating invoice status', 'danger');
    }
}

async function deleteInvoice(invoiceId) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadInvoices();
                loadDashboard();
                showAlert('Invoice deleted successfully', 'success');
            } else {
                showAlert('Error deleting invoice', 'danger');
            }
        } catch (error) {
            console.error('Error deleting invoice:', error);
            showAlert('Error deleting invoice', 'danger');
        }
    }
}

async function exportInvoicesCSV() {
    try {
        const response = await fetch('/api/invoices/export/csv');
        
        if (response.ok) {
            // Get the filename from the response headers or create a default one
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'invoices_export.csv';
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }
            
            // Create blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('CSV export completed successfully', 'success');
        } else {
            showAlert('Error exporting CSV', 'danger');
        }
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showAlert('Error exporting CSV', 'danger');
    }
}

// Webhook sample
async function loadWebhookSample() {
    try {
        const response = await fetch('/static/webhook_sample.json');
        const data = await response.text();
        document.getElementById('webhook-sample').textContent = data;
    } catch (error) {
        // If static file doesn't exist, show the sample
        const sample = {
            customer: {
                name: "John Smith",
                email: "john.smith@example.com",
                phone: "+1-555-123-4567",
                address: "123 Main Street\nSuite 100\nNew York, NY 10001"
            },
            issue_date: "2025-05-30",
            due_date: "2025-06-29",
            tax_rate: 8.5,
            discount: 50.0,
            status: "pending",
            notes: "Thank you for your business!",
            items: [
                {
                    description: "Web Development Services - May 2025",
                    quantity: 40,
                    unit_price: 150.00
                },
                {
                    description: "Logo Design",
                    quantity: 1,
                    unit_price: 500.00
                }
            ]
        };
        document.getElementById('webhook-sample').textContent = JSON.stringify(sample, null, 2);
    }
}

// Utility
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Company Settings
async function loadCompanySettings() {
    try {
        const response = await fetch('/api/company/settings');
        const settings = await response.json();
        
        if (response.ok) {
            // Populate form fields
            const form = document.getElementById('companySettingsForm');
            form.company_name.value = settings.company_name || '';
            form.address.value = settings.address || '';
            form.city_postal.value = settings.city_postal || '';
            form.phone.value = settings.phone || '';
            form.email.value = settings.email || '';
            form.gst_number.value = settings.gst_number || '';
            
            // Update preview
            updateCompanyPreview(settings);
        } else {
            showAlert('Failed to load company settings: ' + settings.error, 'danger');
        }
    } catch (error) {
        showAlert('Error loading company settings: ' + error.message, 'danger');
    }
}

async function saveCompanySettings() {
    try {
        const form = document.getElementById('companySettingsForm');
        const formData = new FormData(form);
        
        const settings = {
            company_name: formData.get('company_name'),
            address: formData.get('address'),
            city_postal: formData.get('city_postal'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            gst_number: formData.get('gst_number')
        };
        
        const response = await fetch('/api/company/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('Company settings saved successfully!', 'success');
            updateCompanyPreview(result);
        } else {
            showAlert('Failed to save settings: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error saving settings: ' + error.message, 'danger');
    }
}

function updateCompanyPreview(settings) {
    document.getElementById('preview-company-name').textContent = settings.company_name;
    document.getElementById('preview-address').textContent = settings.address;
    document.getElementById('preview-phone').textContent = settings.phone;
    document.getElementById('preview-email').textContent = settings.email;
    document.getElementById('preview-city-postal').textContent = settings.city_postal;
    document.getElementById('preview-gst').textContent = settings.gst_number;
}

function setupCompanySettingsPreview() {
    const form = document.getElementById('companySettingsForm');
    if (!form) return;
    
    // Add live preview to all form inputs
    form.addEventListener('input', function(e) {
        const field = e.target.name;
        const value = e.target.value;
        
        switch(field) {
            case 'company_name':
                document.getElementById('preview-company-name').textContent = value || 'Company Name';
                break;
            case 'address':
                document.getElementById('preview-address').textContent = value || 'Address';
                break;
            case 'phone':
                document.getElementById('preview-phone').textContent = value || 'Phone';
                break;
            case 'email':
                document.getElementById('preview-email').textContent = value || 'Email';
                break;
            case 'city_postal':
                document.getElementById('preview-city-postal').textContent = value || 'City & Postal';
                break;
            case 'gst_number':
                document.getElementById('preview-gst').textContent = value || 'GST Number';
                break;
        }
    });
}