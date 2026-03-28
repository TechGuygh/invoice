import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
const router = express.Router();

router.use(express.json());

// Invoices
router.get('/invoices', async (req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { lineItems: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.post('/invoices', async (req: any, res) => {
  try {
    const { customerName, customerDetails, issueDate, dueDate, lineItems, notes, terms, currency, exchangeRate } = req.body;
    
    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    
    const items = lineItems.map((item: any) => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemDiscount = itemTotal * (item.discount / 100);
      const itemTax = (itemTotal - itemDiscount) * (item.taxRate / 100);
      
      subtotal += itemTotal;
      discountTotal += itemDiscount;
      taxTotal += itemTax;
      
      return {
        ...item,
        total: itemTotal - itemDiscount + itemTax
      };
    });
    
    const total = subtotal - discountTotal + taxTotal;
    
    // Generate a simple invoice number
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${(count + 1).toString().padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        customerName,
        customerDetails,
        invoiceNumber,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        currency: currency || 'USD',
        exchangeRate: exchangeRate ? Number(exchangeRate) : 1.0,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        amountDue: total,
        notes,
        terms,
        lineItems: {
          create: items
        }
      },
      include: { lineItems: true }
    });
    
    res.json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.get('/invoices/:id', async (req: any, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id },
      include: { lineItems: true, payments: true }
    });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Email configuration
const getTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Fallback to ethereal for testing if no SMTP config
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
};

router.post('/invoices/:id/send', async (req: any, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId }
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const transporter = await getTransporter();
    
    const info = await transporter.sendMail({
      from: `"Your Company" <${process.env.SMTP_FROM || 'noreply@example.com'}>`,
      to: "customer@example.com", // In a real app, you'd extract email from customerDetails or add an email field
      subject: `Invoice ${invoice.invoiceNumber}`,
      text: `Dear ${invoice.customerName},\n\nPlease find attached your invoice ${invoice.invoiceNumber} for the amount of ${invoice.currency || 'USD'} ${invoice.total.toFixed(2)}.\n\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}\n\nThank you for your business!`,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Dear ${invoice.customerName},</p>
          <p>Please find your invoice details below:</p>
          <ul>
            <li><strong>Amount Due:</strong> ${invoice.currency || 'USD'} ${invoice.amountDue.toFixed(2)}</li>
            <li><strong>Total Amount:</strong> ${invoice.currency || 'USD'} ${invoice.total.toFixed(2)}</li>
            <li><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</li>
          </ul>
          <p>Thank you for your business!</p>
        </div>
      `,
    });

    // Update invoice status if it was draft
    if (invoice.status === 'draft') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'sent' }
      });
    }

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

    res.json({ success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.put('/invoices/:id', async (req: any, res) => {
  try {
    const { customerName, customerDetails, issueDate, dueDate, lineItems, notes, terms, currency, exchangeRate } = req.body;
    const invoiceId = req.params.id;

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId }
    });

    if (!existingInvoice) return res.status(404).json({ error: 'Invoice not found' });
    if (existingInvoice.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });

    // Calculate totals
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    
    const items = lineItems.map((item: any) => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemDiscount = itemTotal * (item.discount / 100);
      const itemTax = (itemTotal - itemDiscount) * (item.taxRate / 100);
      
      subtotal += itemTotal;
      discountTotal += itemDiscount;
      taxTotal += itemTax;
      
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discount: item.discount
      };
    });
    
    const total = subtotal - discountTotal + taxTotal;

    // Delete existing line items
    await prisma.invoiceLineItem.deleteMany({
      where: { invoiceId }
    });

    // Update invoice and create new line items
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        customerName,
        customerDetails,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        currency: currency || 'USD',
        exchangeRate: exchangeRate ? Number(exchangeRate) : 1.0,
        subtotal,
        taxTotal,
        discountTotal,
        total,
        amountDue: total,
        notes,
        terms,
        lineItems: {
          create: items
        }
      },
      include: { lineItems: true }
    });
    
    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.delete('/invoices/:id', async (req: any, res) => {
  try {
    const invoiceId = req.params.id;

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId }
    });

    if (!existingInvoice) return res.status(404).json({ error: 'Invoice not found' });

    // Delete related records first
    await prisma.payment.deleteMany({
      where: { invoiceId }
    });
    
    await prisma.invoiceLineItem.deleteMany({
      where: { invoiceId }
    });

    await prisma.invoice.delete({
      where: { id: invoiceId }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// Payments
router.post('/invoices/:id/payments', async (req: any, res) => {
  try {
    const { amount, method, reference, date } = req.body;
    const invoiceId = req.params.id;
    
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId }
    });
    
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    
    const paymentAmount = Number(amount);
    const newAmountDue = Math.max(0, invoice.amountDue - paymentAmount);
    let status = invoice.status;
    
    if (newAmountDue === 0) {
      status = 'paid';
    } else if (newAmountDue < invoice.total) {
      status = 'partially_paid';
    }
    
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentAmount,
        method,
        reference,
        date: new Date(date || new Date())
      }
    });
    
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountDue: newAmountDue, status }
    });
    
    res.json(payment);
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Dashboard stats
router.get('/dashboard/stats', async (req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany();
    
    const totalRevenue = invoices.filter(i => i.status === 'paid' || i.status === 'partially_paid')
      .reduce((sum, i) => sum + (i.total - i.amountDue), 0);
      
    const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft')
      .reduce((sum, i) => sum + i.amountDue, 0);
      
    const overdue = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft' && new Date(i.dueDate) < new Date())
      .reduce((sum, i) => sum + i.amountDue, 0);
      
    res.json({ totalRevenue, outstanding, overdue, invoiceCount: invoices.length });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
