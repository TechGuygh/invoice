import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Download, Save, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';

export default function InvoiceCreation({ settings }: { settings: any }) {
  const queryClient = useQueryClient();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('MOMO PAYMENT DETAILS\nName: Irene Addokoh\nTelephone: 0243109681\n\nName: Irene Pasta\nTelephone: 0597430856');
  const [currency, setCurrency] = useState(settings.currency || 'GHS');
  const [exchangeRate, setExchangeRate] = useState(1.0);
  const [invoiceData, setInvoiceData] = useState({
    from: { name: '', details: '' },
    to: { name: '', details: '' }
  });
  const [invoiceNumber, setInvoiceNumber] = useState('52148');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [items, setItems] = useState([
    { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 },
    { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 },
    { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 }
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState(settings.template || 'modern');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Save Invoice Mutation
  const saveInvoiceMutation = useMutation({
    mutationFn: async (invoicePayload: any) => {
      const url = id ? `/api/invoices/${id}` : '/api/invoices';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoicePayload)
      });
      if (!res.ok) throw new Error(`Failed to ${id ? 'update' : 'create'} invoice`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      alert(`Invoice ${id ? 'updated' : 'created'} successfully!`);
      
      if (!id) {
        // Reset form
        setCustomerName('');
        setDueDate('');
        setCurrency(settings.currency || 'USD');
        setExchangeRate(1.0);
        setPaymentInstructions('MOMO PAYMENT DETAILS\nName: Irene Addokoh\nTelephone: 0243109681\n\nName: Irene Pasta\nTelephone: 0597430856');
        setInvoiceData({ from: { name: '', details: '' }, to: { name: '', details: '' } });
        setItems([
          { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 },
          { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 },
          { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 }
        ]);
        setErrors({});
        localStorage.removeItem('invoiceDraft');
      }
      navigate('/invoices');
    },
    onError: (error) => {
      alert(`Error ${id ? 'updating' : 'creating'} invoice: ` + error.message);
    }
  });

  useEffect(() => {
    setSelectedTemplate(settings.template);
  }, [settings.template]);

  const { data: invoiceToEdit, isLoading: isFetchingInvoice } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error('Failed to fetch invoice');
      return res.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (invoiceToEdit) {
      setCustomerName(invoiceToEdit.customerName || '');
      setDueDate(new Date(invoiceToEdit.dueDate).toISOString().split('T')[0]);
      setCurrency(invoiceToEdit.currency || settings.currency || 'USD');
      setExchangeRate(invoiceToEdit.exchangeRate || 1.0);
      setPaymentInstructions(invoiceToEdit.terms || '');
      setInvoiceNumber(invoiceToEdit.invoiceNumber);
      setInvoiceData({
        from: { name: settings.companyName || '', details: settings.companyDetails || '' },
        to: { name: invoiceToEdit.customerName || '', details: invoiceToEdit.customerDetails || '' }
      });
      setItems(invoiceToEdit.lineItems.map((item: any) => ({
        name: item.description,
        quantity: item.quantity,
        price: item.unitPrice,
        discount: item.discount
      })));
    } else if (!id) {
      const draft = localStorage.getItem('invoiceDraft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.customerName !== undefined) setCustomerName(parsed.customerName);
          if (parsed.dueDate !== undefined) setDueDate(parsed.dueDate);
          if (parsed.currency !== undefined) setCurrency(parsed.currency);
          if (parsed.exchangeRate !== undefined) setExchangeRate(parsed.exchangeRate);
          if (parsed.paymentInstructions !== undefined) setPaymentInstructions(parsed.paymentInstructions);
          if (parsed.invoiceData !== undefined) setInvoiceData(parsed.invoiceData);
          if (parsed.invoiceNumber !== undefined) setInvoiceNumber(parsed.invoiceNumber);
          if (parsed.items !== undefined) setItems(parsed.items);
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    }
  }, [invoiceToEdit, id, settings]);

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomerName(name);
    setInvoiceData(prev => ({
      ...prev,
      to: { ...prev.to, name }
    }));
  };

  const saveDraft = () => {
    const draft = {
      customerName,
      dueDate,
      currency,
      exchangeRate,
      paymentInstructions,
      invoiceData,
      invoiceNumber,
      items
    };
    localStorage.setItem('invoiceDraft', JSON.stringify(draft));
    setIsSavingDraft(true);
    setTimeout(() => setIsSavingDraft(false), 2000);
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, price: 0, discount: 0, taxRate: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    // Clear error when user types
    if (errors[`${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}-${field}`];
      setErrors(newErrors);
    }
  };

  const total = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.price;
    const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
    const taxAmount = (itemTotal - discountAmount) * ((item.taxRate || 0) / 100);
    return sum + (itemTotal - discountAmount + taxAmount);
  }, 0);

  const validateItems = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!customerName) {
      newErrors['customer'] = 'Please enter a customer name';
      isValid = false;
    }

    if (!dueDate) {
      newErrors['dueDate'] = 'Please select a due date';
      isValid = false;
    }

    items.forEach((item, index) => {
      if (!item.name.trim()) {
        newErrors[`${index}-name`] = 'Name cannot be empty';
        isValid = false;
      }
      if (item.quantity <= 0) {
        newErrors[`${index}-quantity`] = 'Quantity must be positive';
        isValid = false;
      }
      if (item.price <= 0) {
        newErrors[`${index}-price`] = 'Price must be positive';
        isValid = false;
      }
      if (settings.showDiscount && (item.discount < 0 || item.discount > 100)) {
        newErrors[`${index}-discount`] = 'Discount must be between 0 and 100';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveInvoice = () => {
    if (!validateItems()) return;

    const invoicePayload = {
      customerName: customerName,
      customerDetails: invoiceData.to.details,
      issueDate: new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      currency,
      exchangeRate,
      notes: invoiceData.from.details,
      terms: paymentInstructions,
      lineItems: items.map(item => ({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0
      }))
    };

    saveInvoiceMutation.mutate(invoicePayload);
  };

  const generatePDF = () => {
    if (!validateItems()) return;

    const doc = new jsPDF('p', 'mm', 'a4');

    // Header Background
    doc.setFillColor(33, 37, 41); // Dark slate
    doc.rect(0, 0, 210, 35, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    if (settings.logo) {
      doc.addImage(settings.logo, 'PNG', 14, 5, 25, 25);
    }
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceData.from.name || 'YOUR COMPANY', 196, 18, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (invoiceData.from.details) {
      const detailsLines = invoiceData.from.details.split('\n');
      detailsLines.forEach((line, i) => {
        doc.text(line, 196, 24 + (i * 5), { align: 'right' });
      });
    }

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Payment Instructions (Left)
    let yPos = 50;
    const lines = paymentInstructions.split('\n');
    lines.forEach((line, i) => {
      if (i === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
      }
      doc.text(line, 14, yPos);
      yPos += (i === 0 ? 8 : 6);
    });

    // Invoice Details (Right)
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice', 130, 50);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 130, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(customerName, 165, 60);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Number:', 130, 67);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceNumber, 165, 67);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Date:', 130, 74);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString(), 165, 74);

    doc.setFont('helvetica', 'bold');
    doc.text('Due Date:', 130, 81);
    doc.setFont('helvetica', 'normal');
    doc.text(dueDate, 165, 81);

    // Table
    const tableHead = settings.showDiscount 
      ? [['Quantity', 'Description', `Unit Price(${currency})`, 'Discount(%)', `Amount(${currency})`]]
      : [['Quantity', 'Description', `Unit Price(${currency})`, `Amount(${currency})`]];

    const tableBody = items.map(item => {
      const itemTotal = item.quantity * item.price;
      const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
      const finalAmount = (itemTotal - discountAmount).toFixed(2);

      if (settings.showDiscount) {
        return [
          item.quantity.toString(),
          item.name,
          item.price.toFixed(2),
          `${item.discount || 0}%`,
          finalAmount
        ];
      }
      return [
        item.quantity.toString(),
        item.name,
        item.price.toFixed(2),
        finalAmount
      ];
    });

    autoTable(doc, {
      startY: Math.max(yPos + 10, 90),
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { 
        fillColor: [155, 44, 60], // #9b2c3c
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: settings.showDiscount ? {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      } : {
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      styles: {
        lineColor: [150, 150, 150],
        lineWidth: 0.1,
        minCellHeight: 12,
        valign: 'middle'
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(total, currency)}`, 196, finalY, { align: 'right' });

    doc.save('invoice.pdf');
  };

  const renderPreview = () => {
    if (selectedTemplate === 'classic') {
      return (
        <div className="bg-white p-10 text-neutral-800 font-serif h-full flex flex-col">
          <div className="flex justify-between border-b-2 border-neutral-800 pb-6 mb-6">
            <div>
              <h1 className="text-4xl font-bold uppercase tracking-widest mb-2">INVOICE</h1>
              <p className="text-sm text-neutral-600">Invoice #: {invoiceNumber}</p>
              <p className="text-sm text-neutral-600">Date: {new Date().toLocaleDateString()}</p>
              <p className="text-sm text-neutral-600">Due Date: {dueDate}</p>
            </div>
            <div className="text-right">
              {settings.logo ? <img src={settings.logo} alt="Logo" className="h-16 object-contain ml-auto mb-2" /> : <div className="h-16 w-16 bg-neutral-100 border border-neutral-200 ml-auto mb-2 flex items-center justify-center text-xs text-neutral-400">LOGO</div>}
              <h2 className="font-bold text-lg">{invoiceData.from.name || 'Your Company'}</h2>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{invoiceData.from.details || 'Your Address'}</p>
            </div>
          </div>
          <div className="flex justify-between mb-8">
            <div>
              <h3 className="font-bold text-neutral-800 border-b border-neutral-300 inline-block mb-2">BILL TO</h3>
              <p className="font-bold">{customerName || invoiceData.to.name || 'Client Name'}</p>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{invoiceData.to.details || 'Client Address'}</p>
            </div>
            <div className="text-right max-w-[50%]">
              <h3 className="font-bold text-neutral-800 border-b border-neutral-300 inline-block mb-2">PAYMENT INFO</h3>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{paymentInstructions}</p>
            </div>
          </div>
          <table className="w-full mb-8 text-sm">
            <thead>
              <tr className="border-b-2 border-neutral-800 text-left">
                <th className="py-2">Description</th>
                {settings.showQtyPrice && <th className="py-2 text-center">Qty</th>}
                {settings.showQtyPrice && <th className="py-2 text-right">Price</th>}
                {settings.showDiscount && <th className="py-2 text-right">Discount</th>}
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const itemTotal = item.quantity * item.price;
                const discountAmount = itemTotal * ((item.discount || 0) / 100);
                const finalAmount = itemTotal - discountAmount;
                return (
                  <tr key={i} className="border-b border-neutral-200">
                    <td className="py-3">{item.name || 'Item Description'}</td>
                    {settings.showQtyPrice && <td className="py-3 text-center">{item.quantity}</td>}
                    {settings.showQtyPrice && <td className="py-3 text-right">{formatCurrency(item.price, currency)}</td>}
                    {settings.showDiscount && <td className="py-3 text-right">{item.discount || 0}%</td>}
                    <td className="py-3 text-right">{formatCurrency(finalAmount, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-auto flex justify-end">
            <div className="w-1/2">
              <div className="flex justify-between font-bold text-lg border-t-2 border-neutral-800 pt-2">
                <span>TOTAL</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'minimal') {
      return (
        <div className="bg-white p-12 text-neutral-800 font-sans h-full flex flex-col">
          <div className="flex justify-between items-start mb-16">
            <div>
              {settings.logo ? <img src={settings.logo} alt="Logo" className="h-12 object-contain mb-6" /> : <div className="h-12 w-12 bg-neutral-100 rounded-lg mb-6 flex items-center justify-center text-xs text-neutral-400">LOGO</div>}
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">From</h2>
              <p className="font-medium">{invoiceData.from.name || 'Your Company'}</p>
              <p className="text-sm text-neutral-500 whitespace-pre-line">{invoiceData.from.details || 'Your Address'}</p>
            </div>
            <div className="text-right">
              <h1 className="text-5xl font-light text-neutral-200 mb-6">INVOICE</h1>
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Billed To</h2>
              <p className="font-medium">{customerName || invoiceData.to.name || 'Client Name'}</p>
              <p className="text-sm text-neutral-500 whitespace-pre-line">{invoiceData.to.details || 'Client Address'}</p>
            </div>
          </div>
          <div className="mb-8">
            <div className="flex text-xs font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-100 pb-3 mb-3">
              <div className="flex-1">Description</div>
              {settings.showQtyPrice && <div className="w-20 text-center">Qty</div>}
              {settings.showQtyPrice && <div className="w-24 text-right">Price</div>}
              {settings.showDiscount && <div className="w-20 text-right">Discount</div>}
              <div className="w-32 text-right">Amount</div>
            </div>
            {items.map((item, i) => {
              const itemTotal = item.quantity * item.price;
              const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
              const finalAmount = itemTotal - discountAmount;
              return (
                <div key={i} className="flex text-sm py-3 border-b border-neutral-50">
                  <div className="flex-1 font-medium">{item.name || 'Item Description'}</div>
                  {settings.showQtyPrice && <div className="w-20 text-center text-neutral-500">{item.quantity}</div>}
                  {settings.showQtyPrice && <div className="w-24 text-right text-neutral-500">{formatCurrency(item.price, currency)}</div>}
                  {settings.showDiscount && <div className="w-20 text-right text-neutral-500">{item.discount || 0}%</div>}
                  <div className="w-32 text-right font-medium">{formatCurrency(finalAmount, currency)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-auto flex justify-between items-end">
            <div className="text-sm text-neutral-400 max-w-[50%]">
              <p className="font-bold mb-1">Payment Info:</p>
              <p className="whitespace-pre-line">{paymentInstructions}</p>
              <div className="mt-4">
                <p>Invoice No: {invoiceNumber}</p>
                <p>Date: {new Date().toLocaleDateString()}</p>
                <p>Due Date: {dueDate}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Total Due</p>
              <p className={`text-4xl font-bold bg-clip-text text-transparent ${settings.themeColor || 'bg-neutral-900'}`}>
                {formatCurrency(total, currency)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'orange') {
      return (
        <div className="bg-white p-10 text-neutral-800 font-sans h-full flex flex-col">
          <div className="flex justify-between items-start border-t-8 border-[#e86c3f] pt-8 mb-8">
            <div className="flex items-center gap-4">
              {settings.logo ? <img src={settings.logo} alt="Logo" className="h-16 w-16 object-contain rounded-full bg-neutral-500" /> : <div className="h-16 w-16 bg-neutral-500 rounded-full flex items-center justify-center text-xs text-white">LOGO</div>}
              <div>
                <h2 className="font-bold text-lg">{invoiceData.from.name || 'Your Company Name'}</h2>
                <p className="text-sm text-neutral-600 whitespace-pre-line">{invoiceData.from.details || 'Your Address\nCity, State, Zip'}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-light text-neutral-400 mb-4">INVOICE</h1>
              <div className="flex justify-end gap-4 text-sm border-t border-b border-neutral-200 py-2">
                <div className="text-center">
                  <p className="font-bold">DATE</p>
                  <p>{new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold">INVOICE NO.</p>
                  <p>{invoiceNumber}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-between mb-8">
            <div>
              <h3 className="font-bold text-xs text-neutral-800 mb-2">BILL TO</h3>
              <p className="text-sm font-medium">{customerName || invoiceData.to.name || 'Contact Name'}</p>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{invoiceData.to.details || 'Client Company Name\nAddress\nPhone\nEmail'}</p>
            </div>
            <div className="text-right max-w-[50%]">
              <h3 className="font-bold text-xs text-neutral-800 mb-2">SHIP TO</h3>
              <p className="text-sm font-medium">{customerName || invoiceData.to.name || 'Name / Dept'}</p>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{invoiceData.to.details || 'Client Company Name\nAddress\nPhone'}</p>
            </div>
          </div>
          <table className="w-full mb-8 text-sm border-collapse">
            <thead>
              <tr className="bg-[#e86c3f] text-white text-center text-xs font-bold">
                <th className="py-2 px-2 text-left border-r border-white/20">DESCRIPTION</th>
                {settings.showQtyPrice && <th className="py-2 px-2 border-r border-white/20">QTY</th>}
                {settings.showQtyPrice && <th className="py-2 px-2 border-r border-white/20">UNIT PRICE</th>}
                {settings.showDiscount && <th className="py-2 px-2 border-r border-white/20">DISCOUNT</th>}
                <th className="py-2 px-2 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const itemTotal = item.quantity * item.price;
                const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
                const finalAmount = itemTotal - discountAmount;
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                    <td className="py-2 px-2 border-r border-neutral-200">{item.name || 'Item Description'}</td>
                    {settings.showQtyPrice && <td className="py-2 px-2 text-center border-r border-neutral-200">{item.quantity}</td>}
                    {settings.showQtyPrice && <td className="py-2 px-2 text-right border-r border-neutral-200">{formatCurrency(item.price, currency)}</td>}
                    {settings.showDiscount && <td className="py-2 px-2 text-center border-r border-neutral-200">{item.discount || 0}%</td>}
                    <td className="py-2 px-2 text-right">{formatCurrency(finalAmount, currency)}</td>
                  </tr>
                );
              })}
              {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className={(items.length + i) % 2 === 0 ? 'bg-neutral-50' : 'bg-white'}>
                  <td className="py-4 px-2 border-r border-neutral-200"></td>
                  {settings.showQtyPrice && <td className="py-4 px-2 border-r border-neutral-200"></td>}
                  {settings.showQtyPrice && <td className="py-4 px-2 border-r border-neutral-200"></td>}
                  {settings.showDiscount && <td className="py-4 px-2 border-r border-neutral-200"></td>}
                  <td className="py-4 px-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto flex justify-between items-start">
            <div className="text-xs text-neutral-500 max-w-[50%]">
              <p className="font-bold mb-1">Remarks / Payment Instructions:</p>
              <p className="whitespace-pre-line">{paymentInstructions}</p>
            </div>
            <div className="w-64 text-sm">
              <div className="flex justify-between py-1">
                <span className="font-bold text-neutral-600">SUBTOTAL</span>
                <span>{formatCurrency(items.reduce((sum, item) => sum + item.quantity * item.price, 0), currency)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-neutral-600">DISCOUNT</span>
                <span>{settings.showDiscount ? formatCurrency(items.reduce((sum, item) => sum + (item.quantity * item.price * ((item.discount || 0) / 100)), 0), currency) : formatCurrency(0, currency)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-neutral-600">SUBTOTAL LESS DISCOUNT</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-neutral-600">TAX RATE</span>
                <span>0.00%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-bold text-neutral-600">TOTAL TAX</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-300">
                <span className="font-bold text-neutral-600">SHIPPING/HANDLING</span>
                <span>0.00</span>
              </div>
              <div className="flex justify-between py-2 bg-[#f4dcd6] mt-2 px-2 font-bold">
                <span>Balance Due</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedTemplate === 'blue') {
      return (
        <div className="bg-white text-neutral-800 font-sans h-full flex flex-col">
          <div className="bg-[#246282] text-white p-8 flex justify-between items-start">
            <h1 className="text-5xl font-light tracking-wide">INVOICE</h1>
            <div className="text-right text-sm">
              <h2 className="font-bold text-lg mb-1">{invoiceData.from.name || 'Your Company Name'}</h2>
              <p className="whitespace-pre-line">{invoiceData.from.details || 'Street Address\nCity, State, Zip/Postal Code\nPhone\nEmail'}</p>
            </div>
          </div>
          <div className="p-8 flex-1 flex flex-col">
            <div className="flex justify-between mb-8 text-sm">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <span className="font-bold">Invoice No.</span>
                <span>{invoiceNumber}</span>
                <span className="font-bold">Date of Issue</span>
                <span>{new Date().toLocaleDateString()}</span>
                <span className="font-bold">Due Date</span>
                <span>{dueDate || 'Enter Due Date Here'}</span>
              </div>
              <div className="text-right">
                <h3 className="font-bold mb-1">Bill To</h3>
                <p>{customerName || invoiceData.to.name || 'Client Company Name'}</p>
                <p className="whitespace-pre-line text-neutral-600">{invoiceData.to.details || 'Address\nPhone\nEmail'}</p>
              </div>
            </div>
            <table className="w-full mb-8 text-sm border-collapse">
              <thead>
                <tr className="border-t-2 border-b-2 border-neutral-800 font-bold text-left">
                  <th className="py-2 px-2 w-12">Item</th>
                  <th className="py-2 px-2">Description</th>
                  {settings.showQtyPrice && <th className="py-2 px-2 text-center">Hours</th>}
                  {settings.showQtyPrice && <th className="py-2 px-2 text-right">Rate</th>}
                  {settings.showDiscount && <th className="py-2 px-2 text-right">Discount</th>}
                  <th className="py-2 px-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const itemTotal = item.quantity * item.price;
                  const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
                  const finalAmount = itemTotal - discountAmount;
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-neutral-100' : 'bg-white'}>
                      <td className="py-2 px-2">{i + 1}</td>
                      <td className="py-2 px-2">{item.name || 'Item Description'}</td>
                      {settings.showQtyPrice && <td className="py-2 px-2 text-center">{item.quantity}</td>}
                      {settings.showQtyPrice && <td className="py-2 px-2 text-right">{formatCurrency(item.price, currency)}</td>}
                      {settings.showDiscount && <td className="py-2 px-2 text-right">{item.discount || 0}%</td>}
                      <td className="py-2 px-2 text-right">{formatCurrency(finalAmount, currency)}</td>
                    </tr>
                  );
                })}
                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className={(items.length + i) % 2 === 0 ? 'bg-neutral-100' : 'bg-white'}>
                    <td className="py-4 px-2"></td>
                    <td className="py-4 px-2"></td>
                    {settings.showQtyPrice && <td className="py-4 px-2"></td>}
                    {settings.showQtyPrice && <td className="py-4 px-2"></td>}
                    {settings.showDiscount && <td className="py-4 px-2"></td>}
                    <td className="py-4 px-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-auto flex justify-between items-start">
              <div className="text-sm">
                <p className="font-bold mb-1">Terms</p>
                <p className="text-neutral-600 whitespace-pre-line">{paymentInstructions}</p>
              </div>
              <div className="w-64 text-sm">
                <div className="flex justify-between py-1">
                  <span className="font-bold">Subtotal</span>
                  <span>{formatCurrency(items.reduce((sum, item) => sum + item.quantity * item.price, 0), currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-bold">Discount</span>
                  <span>{settings.showDiscount ? formatCurrency(items.reduce((sum, item) => sum + (item.quantity * item.price * ((item.discount || 0) / 100)), 0), currency) : formatCurrency(0, currency)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="font-bold">Tax Rate</span>
                  <span>0.00%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-300">
                  <span className="font-bold">Tax</span>
                  <span>{formatCurrency(items.reduce((sum, item) => {
                    const itemTotal = item.quantity * item.price;
                    const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
                    return sum + ((itemTotal - discountAmount) * ((item.taxRate || 0) / 100));
                  }, 0), currency)}</span>
                </div>
                <div className="flex justify-between py-2 font-bold text-base">
                  <span>Total</span>
                  <span className="bg-[#d5e6f1] px-2 py-1">{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#246282] text-white p-4 text-center text-sm font-bold mt-auto">
            Thank you for your business!
          </div>
        </div>
      );
    }

    // Default Modern Template
    return (
      <>
        {/* Header Block */}
        <div className="bg-[#1a202c] text-white p-8 h-32 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" className="w-16 h-16 object-contain bg-white rounded-full p-1" />
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium">Logo</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold tracking-widest uppercase">{invoiceData.from.name || 'YOUR COMPANY'}</h1>
            {invoiceData.from.details && (
              <div className="text-sm font-medium tracking-widest uppercase mt-1 whitespace-pre-line">
                {invoiceData.from.details}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Info Block */}
        <div className="px-8 py-8 flex justify-between text-sm">
          <div className="whitespace-pre-wrap leading-relaxed max-w-[50%]">
            {paymentInstructions.split('\n').map((line, i) => (
              <div key={i} className={i === 0 ? "font-bold text-lg mb-3" : "text-neutral-800 text-base"}>
                {line}
              </div>
            ))}
          </div>
          <div className="w-64">
            <h2 className="text-4xl font-bold mb-6 text-neutral-900">Invoice</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-bold text-neutral-900">Bill To:</span>
                <span className="text-neutral-800">{customerName || invoiceData.to.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-900">Invoice Number:</span>
                <span className="text-neutral-800">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-900">Invoice Date:</span>
                <span className="text-neutral-800">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-neutral-900">Due Date:</span>
                <span className="text-neutral-800">{dueDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="px-8 flex-1 flex flex-col">
          <table className="w-full text-sm text-left mb-8 border-collapse">
            <thead className="bg-[#9b2c3c] text-white">
              <tr>
                {settings.showQtyPrice && <th className="py-3 px-4 font-bold border border-[#9b2c3c]">Quantity</th>}
                <th className="py-3 px-4 font-bold border border-[#9b2c3c]">Description</th>
                {settings.showQtyPrice && <th className="py-3 px-4 font-bold text-right border border-[#9b2c3c]">Unit Price({currency})</th>}
                {settings.showDiscount && <th className="py-3 px-4 font-bold text-right border border-[#9b2c3c]">Discount(%)</th>}
                <th className="py-3 px-4 font-bold text-right border border-[#9b2c3c]">Amount({currency})</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const itemTotal = item.quantity * item.price;
                const discountAmount = settings.showDiscount ? itemTotal * ((item.discount || 0) / 100) : 0;
                const finalAmount = itemTotal - discountAmount;
                return (
                  <tr key={index}>
                    {settings.showQtyPrice && <td className="py-4 px-4 border border-neutral-300 text-neutral-800">{item.quantity}</td>}
                    <td className="py-4 px-4 border border-neutral-300 text-neutral-800">{item.name}</td>
                    {settings.showQtyPrice && <td className="py-4 px-4 text-right border border-neutral-300 text-neutral-800">{formatCurrency(item.price, currency)}</td>}
                    {settings.showDiscount && <td className="py-4 px-4 text-right border border-neutral-300 text-neutral-800">{item.discount || 0}%</td>}
                    <td className="py-4 px-4 text-right border border-neutral-300 text-neutral-800">{formatCurrency(finalAmount, currency)}</td>
                  </tr>
                );
              })}
              {/* Empty rows to match the reference look */}
              {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  {settings.showQtyPrice && <td className="py-6 px-4 border border-neutral-300"></td>}
                  <td className="py-6 px-4 border border-neutral-300"></td>
                  {settings.showQtyPrice && <td className="py-6 px-4 border border-neutral-300"></td>}
                  {settings.showDiscount && <td className="py-6 px-4 border border-neutral-300"></td>}
                  <td className="py-6 px-4 border border-neutral-300"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="mt-auto flex justify-end mb-8">
            <div className="text-xl font-bold text-neutral-900">
              Total: {formatCurrency(total, currency)}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
            {id ? 'Edit Invoice' : 'Create Invoice'}
          </h1>
          <p className="text-neutral-500 mt-1">Fill in the details below to generate a new invoice</p>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Form Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 sm:p-8 rounded-3xl bg-white shadow-xl border border-neutral-100"
        >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">Invoice Details</h2>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Company Name</label>
              <input type="text" placeholder="e.g. Acme Corp" value={invoiceData.from.name} onChange={(e) => setInvoiceData({ ...invoiceData, from: { ...invoiceData.from, name: e.target.value } })} className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Company Details</label>
              <textarea placeholder="e.g. 123 Business Rd..." value={invoiceData.from.details} onChange={(e) => setInvoiceData({ ...invoiceData, from: { ...invoiceData.from, details: e.target.value } })} className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[60px]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Invoice Number</label>
              <input type="text" placeholder="e.g. 52148" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Customer Name</label>
              <input 
                type="text"
                placeholder="e.g. John Doe"
                value={customerName} 
                onChange={handleCustomerNameChange} 
                className={`w-full p-4 rounded-2xl border ${errors['customer'] ? 'border-red-500' : 'border-neutral-200'} bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
              />
              {errors['customer'] && <p className="text-red-500 text-xs mt-1">{errors['customer']}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Customer Details</label>
              <textarea 
                placeholder="e.g. 456 Client St..." 
                value={invoiceData.to.details} 
                onChange={(e) => setInvoiceData({ ...invoiceData, to: { ...invoiceData.to, details: e.target.value } })} 
                className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[60px]" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`w-full p-4 rounded-2xl border ${errors['dueDate'] ? 'border-red-500' : 'border-neutral-200'} bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all`} />
              {errors['dueDate'] && <p className="text-red-500 text-xs mt-1">{errors['dueDate']}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Currency</label>
              <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="e.g. USD, EUR, GHC" className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-600">Exchange Rate</label>
              <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-600">Payment Instructions</label>
            <textarea 
              placeholder="Enter payment details..." 
              value={paymentInstructions} 
              onChange={(e) => setPaymentInstructions(e.target.value)} 
              className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px]" 
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-neutral-100">
            <h3 className="text-lg font-semibold text-neutral-800">Items</h3>
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row flex-wrap sm:flex-nowrap gap-3 sm:gap-4 items-start sm:items-start bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                <div className="w-full sm:flex-1 min-w-[150px] space-y-2">
                  <input type="text" placeholder="Item Description" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className={`w-full p-3 rounded-xl border ${errors[`${index}-name`] ? 'border-red-500' : 'border-neutral-200'} bg-white focus:ring-2 focus:ring-blue-500 outline-none`} />
                  {errors[`${index}-name`] && <p className="text-red-500 text-xs mt-1">{errors[`${index}-name`]}</p>}
                </div>
                <div className="flex gap-3 w-full sm:w-auto items-start mt-2 sm:mt-0">
                  <div className="flex-1 sm:flex-none sm:w-24">
                    <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} className={`w-full p-3 rounded-xl border ${errors[`${index}-quantity`] ? 'border-red-500' : 'border-neutral-200'} bg-white focus:ring-2 focus:ring-blue-500 outline-none`} />
                    {errors[`${index}-quantity`] && <p className="text-red-500 text-xs mt-1">{errors[`${index}-quantity`]}</p>}
                  </div>
                  <div className="flex-1 sm:flex-none sm:w-32">
                    <input type="number" placeholder="Price" value={item.price} onChange={(e) => updateItem(index, 'price', Number(e.target.value))} className={`w-full p-3 rounded-xl border ${errors[`${index}-price`] ? 'border-red-500' : 'border-neutral-200'} bg-white focus:ring-2 focus:ring-blue-500 outline-none`} />
                    {errors[`${index}-price`] && <p className="text-red-500 text-xs mt-1">{errors[`${index}-price`]}</p>}
                  </div>
                  {settings.showDiscount && (
                    <div className="flex-1 sm:flex-none sm:w-24">
                      <input type="number" placeholder="Disc %" value={item.discount} onChange={(e) => updateItem(index, 'discount', Number(e.target.value))} className={`w-full p-3 rounded-xl border ${errors[`${index}-discount`] ? 'border-red-500' : 'border-neutral-200'} bg-white focus:ring-2 focus:ring-blue-500 outline-none`} />
                      {errors[`${index}-discount`] && <p className="text-red-500 text-xs mt-1">{errors[`${index}-discount`]}</p>}
                    </div>
                  )}
                  <button onClick={() => removeItem(index)} className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex-shrink-0 mt-0">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={addItem} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors w-full justify-center mt-4">
              <Plus className="w-5 h-5" /> Add New Item
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-neutral-100 gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm text-neutral-500 mb-1">Total Amount</p>
              <span className="text-3xl font-bold text-neutral-900">{formatCurrency(total, currency)}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button onClick={saveDraft} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors shadow-sm">
                {isSavingDraft ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              <button 
                onClick={handleSaveInvoice} 
                disabled={saveInvoiceMutation.isPending}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white transition-colors shadow-lg ${settings.themeColor || 'bg-blue-600'} hover:opacity-90 disabled:opacity-50`}
              >
                {saveInvoiceMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saveInvoiceMutation.isPending ? 'Saving...' : 'Save Invoice'}
              </button>
              <button onClick={generatePDF} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-white transition-colors shadow-lg bg-neutral-900 hover:bg-neutral-800`}>
                <Download className="w-5 h-5" /> Export PDF
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Preview Section */}
      <div className="overflow-x-auto pb-4 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="min-w-[600px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-neutral-900">Preview</h2>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="p-2 rounded-xl border border-neutral-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
            >
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
              <option value="orange">Orange</option>
              <option value="blue">Blue</option>
            </select>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-sm shadow-2xl border border-neutral-200 overflow-hidden flex flex-col text-neutral-800 sticky top-24"
            style={{ aspectRatio: '1 / 1.414', maxHeight: '1000px' }}
          >
            {renderPreview()}
          </motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}
