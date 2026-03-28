import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev';

// Middleware to authenticate requests
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

router.use(express.json());

// Auth routes
router.post('/auth/auto-login', async (req, res) => {
  try {
    const defaultEmail = 'default@example.com';
    let user = await prisma.user.findUnique({ where: { email: defaultEmail } });

    if (!user) {
      const organization = await prisma.organization.create({
        data: { name: 'Default Organization' },
      });

      user = await prisma.user.create({
        data: {
          email: defaultEmail,
          passwordHash: 'not-needed',
          name: 'Default User',
          role: 'owner',
          organizationId: organization.id,
        },
      });
    }

    const token = jwt.sign({ userId: user.id, orgId: user.organizationId, role: user.role }, JWT_SECRET, { expiresIn: '365d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auth/logout', authenticate, async (req, res) => {
  // In a real app with refresh tokens, you would invalidate them here.
  // For JWT access tokens, the client just drops the token.
  res.json({ success: true, message: 'Logged out successfully' });
});

// Customers and Items routes removed

// Invoices
router.get('/invoices', authenticate, async (req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: req.user.orgId },
      include: { lineItems: true, payments: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.post('/invoices', authenticate, requireRole(['owner', 'admin', 'staff']), async (req: any, res) => {
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
    
    // Get next invoice number
    const org = await prisma.organization.findUnique({ where: { id: req.user.orgId } });
    const invoiceNumber = `${org?.invoicePrefix}${org?.nextInvoiceNum.toString().padStart(4, '0')}`;
    
    await prisma.organization.update({
      where: { id: req.user.orgId },
      data: { nextInvoiceNum: { increment: 1 } }
    });

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: req.user.orgId,
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

router.get('/invoices/:id', authenticate, async (req: any, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.user.orgId },
      include: { lineItems: true, payments: true }
    });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// ... (existing imports)

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

// ... (existing code)

router.post('/invoices/:id/send', authenticate, requireRole(['owner', 'admin', 'staff']), async (req: any, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.user.orgId },
      include: { organization: true }
    });

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const transporter = await getTransporter();
    
    const info = await transporter.sendMail({
      from: `"${invoice.organization.name}" <${process.env.SMTP_FROM || 'noreply@example.com'}>`,
      to: "customer@example.com", // In a real app, you'd extract email from customerDetails or add an email field
      subject: `Invoice ${invoice.invoiceNumber} from ${invoice.organization.name}`,
      text: `Dear ${invoice.customerName},\n\nPlease find attached your invoice ${invoice.invoiceNumber} for the amount of ${invoice.currency || 'USD'} ${invoice.total.toFixed(2)}.\n\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}\n\nThank you for your business!\n\n${invoice.organization.name}`,
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
          <p><strong>${invoice.organization.name}</strong></p>
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

router.put('/invoices/:id', authenticate, requireRole(['owner', 'admin', 'staff']), async (req: any, res) => {
  try {
    const { customerName, customerDetails, issueDate, dueDate, lineItems, notes, terms, currency, exchangeRate } = req.body;
    const invoiceId = req.params.id;

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.user.orgId }
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

router.delete('/invoices/:id', authenticate, requireRole(['owner', 'admin']), async (req: any, res) => {
  try {
    const invoiceId = req.params.id;

    const existingInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.user.orgId }
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
router.post('/invoices/:id/payments', authenticate, requireRole(['owner', 'admin', 'staff']), async (req: any, res) => {
  try {
    const { amount, method, reference, date } = req.body;
    const invoiceId = req.params.id;
    
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: req.user.orgId }
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
router.get('/dashboard/stats', authenticate, async (req: any, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: req.user.orgId }
    });
    
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

// Analytics route removed

export default router;
