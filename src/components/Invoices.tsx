import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FileText, Plus, Search, MoreVertical, CheckCircle, Clock, AlertCircle, Download, CreditCard, Mail, Trash2, Edit, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../lib/utils';

export default function Invoices({ settings }: { settings: any }) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
    enabled: !!token,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, amount, method }: { id: string, amount: number, method: string }) => {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount, method, date: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Failed to record payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setSelectedInvoice(null);
      setPaymentAmount('');
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to send email');
      return res.json();
    },
    onSuccess: (data) => {
      alert(`Email sent successfully! Preview URL: ${data.previewUrl || 'Check console'}`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      alert(`Error sending email: ${error.message}`);
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete invoice');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (error: any) => {
      alert(`Error deleting invoice: ${error.message}`);
    }
  });

  const handleDuplicate = (invoice: any) => {
    const draft = {
      invoiceData: {
        from: { name: settings.companyName || '', details: settings.companyDetails || '' },
        to: { name: invoice.customerName, details: invoice.customerDetails || '' }
      },
      customerName: invoice.customerName,
      customerDetails: invoice.customerDetails,
      dueDate: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentInstructions: invoice.terms || '',
      items: invoice.lineItems.map((item: any) => ({
        name: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate
      }))
    };
    localStorage.setItem('invoiceDraft', JSON.stringify(draft));
    navigate('/invoices/new');
  };

  const filteredInvoices = invoices.filter((inv: any) => 
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partially_paid': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'partially_paid': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount) return;
    recordPaymentMutation.mutate({
      id: selectedInvoice.id,
      amount: Number(paymentAmount),
      method: paymentMethod
    });
  };

  const exportCSV = () => {
    if (!invoices || invoices.length === 0) return;
    const headers = ['Invoice Number', 'Customer', 'Status', 'Issue Date', 'Due Date', 'Total', 'Amount Due'];
    const csvContent = [
      headers.join(','),
      ...invoices.map((inv: any) => [
        `"${inv.invoiceNumber || ''}"`,
        `"${inv.customerName || ''}"`,
        `"${inv.status || ''}"`,
        `"${new Date(inv.issueDate).toLocaleDateString()}"`,
        `"${new Date(inv.dueDate).toLocaleDateString()}"`,
        `"${inv.total || 0}"`,
        `"${inv.amountDue || 0}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'invoices.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = (invoice: any) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header Background
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, 210, 35, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    if (settings?.logo) {
      doc.addImage(settings.logo, 'PNG', 14, 5, 25, 25);
    }
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.companyName || 'YOUR COMPANY', 196, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (settings?.companyDetails) {
      const detailsLines = settings.companyDetails.split('\n');
      detailsLines.forEach((line: string, i: number) => {
        doc.text(line, 196, 24 + (i * 5), { align: 'right' });
      });
    }

    doc.setTextColor(0, 0, 0);

    // Invoice Details
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice', 130, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 130, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerName, 165, 60);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Number:', 130, 67);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoiceNumber, 165, 67);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Date:', 130, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.issueDate).toLocaleDateString(), 165, 74);

    doc.setFont('helvetica', 'bold');
    doc.text('Due Date:', 130, 81);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(invoice.dueDate).toLocaleDateString(), 165, 81);

    // Table
    const currency = invoice.currency || settings.currency || 'GHS';
    const tableHead = [['Quantity', 'Description', `Unit Price(${currency})`, `Amount(${currency})`]];
    const tableBody = invoice.lineItems.map((item: any) => [
      item.quantity.toString(),
      item.description,
      item.unitPrice.toFixed(2),
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 90,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [33, 37, 41] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(invoice.total, invoice.currency || settings.currency || 'GHS')}`, 196, finalY, { align: 'right' });
    doc.text(`Amount Due: ${formatCurrency(invoice.amountDue, invoice.currency || settings.currency || 'GHS')}`, 196, finalY + 8, { align: 'right' });

    doc.save(`invoice_${invoice.invoiceNumber}.pdf`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Invoices</h1>
          <p className="text-neutral-500 mt-1">Manage and track your invoices</p>
        </div>
        <button 
          onClick={() => navigate('/invoices/new')}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors shadow-sm font-medium w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input 
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-shadow"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/50 text-sm font-medium text-neutral-500">
                <th className="p-4 font-medium">Invoice No.</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Issue Date</th>
                <th className="p-4 font-medium">Due Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">Loading invoices...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-neutral-300 mb-4" />
                      <p>No invoices found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice: any) => (
                  <tr key={invoice.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="p-4 font-medium text-neutral-900">{invoice.invoiceNumber}</td>
                    <td className="p-4 text-neutral-600">{invoice.customerName}</td>
                    <td className="p-4 text-neutral-600">{new Date(invoice.issueDate).toLocaleDateString()}</td>
                    <td className="p-4 text-neutral-600">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="p-4 font-medium text-neutral-900">
                      {formatCurrency(invoice.total, invoice.currency || settings.currency || 'GHS')}
                      {invoice.amountDue > 0 && invoice.amountDue < invoice.total && (
                        <span className="block text-xs text-neutral-500 font-normal">
                          Due: {formatCurrency(invoice.amountDue, invoice.currency || settings.currency || 'GHS')}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {getStatusIcon(invoice.status)}
                        {invoice.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => sendEmailMutation.mutate(invoice.id)}
                          className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Email"
                          disabled={sendEmailMutation.isPending}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDuplicate(invoice)}
                          className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                          title="Duplicate Invoice"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => downloadPDF(invoice)}
                          className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {invoice.amountDue > 0 && (
                          <button 
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentAmount(invoice.amountDue.toString());
                            }}
                            className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Record Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.status === 'draft' && (
                          <button 
                            onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                            className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {(user?.role === 'admin' || user?.role === 'owner') && (
                          <button 
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this invoice?')) {
                                deleteInvoiceMutation.mutate(invoice.id);
                              }
                            }}
                            className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Invoice"
                            disabled={deleteInvoiceMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Invoice</label>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-600">
                  {selectedInvoice.invoiceNumber} - {selectedInvoice.customerName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Amount Due</label>
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 font-medium text-neutral-900">
                  {formatCurrency(selectedInvoice.amountDue, selectedInvoice.currency || settings.currency || 'GHS')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Amount</label>
                <input 
                  type="number" 
                  step="0.01"
                  max={selectedInvoice.amountDue}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Payment Method</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="flex-1 px-4 py-3 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="flex-1 px-4 py-3 text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
