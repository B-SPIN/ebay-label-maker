import Dexie from 'dexie';
import { mergeHeaderMap } from '../services/ebayHeaders.js';

export const db = new Dexie('EbayLabelMakerDB');

db.version(1).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: 'orderId, buyerUsername, address, [buyerUsername+address], status'
});

// v2: Switch orders PK to auto-increment so multiple batches can coexist
// even when they contain overlapping eBay order IDs.
db.version(2).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status'
});

// v3: Add amazon_conversions table
db.version(3).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt'
});

db.version(4).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt',
  invoice_items: '++id, description, unitPrice, sampleData',
  invoices: '++id, invoiceNumber, issueDate, dueDate, clientName, clientCompany'
});

db.version(5).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt',
  invoice_items: '++id, description, unitPrice, sampleData',
  invoices: '++id, invoiceNumber, issueDate, dueDate, clientName, clientCompany, createdAt'
});

db.version(6).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt',
  invoice_items: '++id, description, unitPrice, sampleData',
  invoices: '++id, invoiceNumber, issueDate, dueDate, clientName, clientCompany, createdAt, status'
});

db.version(7).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt',
  invoice_items: '++id, description, unitPrice, sampleData',
  invoices: '++id, invoiceNumber, issueDate, dueDate, clientName, clientCompany, createdAt, status',
  ebay_conversions: '++id, filename, createdAt'
});

// v8: Simplified invoice schema — GST-inclusive, always PAID, new sequential numbering
db.version(8).stores({
  settings: 'key',
  daily_usage: 'date',
  csv_logs: '++id, filename, processedAt, totalRows, validCount, invalidCount',
  orders: '++id, orderId, buyerUsername, batchTimestamp, status',
  amazon_conversions: '++id, filename, createdAt',
  invoice_items: '++id, description, unitPrice, sampleData',
  invoices: '++id, invoiceNumber, invoiceDate, clientName, clientMobile, clientEmail, createdAt',
  ebay_conversions: '++id, filename, createdAt'
});


// Helper to get a setting
export async function getSetting(key) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : null;
}

// Helper to save a setting
export async function saveSetting(key, value) {
  return await db.settings.put({ key, value });
}

// eBay CSV header names (admin-editable in Settings), merged over the defaults
export async function getEbayHeaderMap() {
  return mergeHeaderMap(await getSetting('ebay_header_map'));
}

// Helper to get daily usage
export async function getDailyUsage(dateString) {
  const usage = await db.daily_usage.get(dateString);
  return usage ? usage.count : 0;
}

// Helper to increment daily usage
export async function incrementDailyUsage(dateString, amount = 1) {
  return await db.transaction('rw', db.daily_usage, async () => {
    const current = await getDailyUsage(dateString);
    await db.daily_usage.put({ date: dateString, count: current + amount });
    return current + amount;
  });
}
