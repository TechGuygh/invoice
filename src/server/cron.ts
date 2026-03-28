import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupCronJobs() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily cron job to check for overdue invoices...');
    try {
      const now = new Date();
      
      // Find all invoices that are not paid or overdue, and their due date is past
      const overdueInvoices = await prisma.invoice.updateMany({
        where: {
          status: {
            in: ['sent', 'partially_paid']
          },
          dueDate: {
            lt: now
          }
        },
        data: {
          status: 'overdue'
        }
      });
      
      console.log(`Updated ${overdueInvoices.count} invoices to overdue status.`);
    } catch (error) {
      console.error('Error running overdue invoices cron job:', error);
    }
  });
}
