import React, { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../db/database.js';
import { downloadInvoicePDF } from './SalesTerminal.jsx';
import {
  FileText, Trash2, Download, Users, CheckCircle
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-AU', {
    style: 'currency', currency: 'AUD',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function downloadCSV(filename, rows, headers) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceHistory() {
  const savedInvoices = useLiveQuery(
    () => db.invoices.orderBy('createdAt').reverse().toArray(), []
  );

  const [bizCache, setBizCache] = useState(null);

  // Load biz details lazily (only when PDF is requested)
  const getBiz = useCallback(async () => {
    if (bizCache) return bizCache;
    const name     = await getSetting('sender_business_name') || await getSetting('sender_name') || '';
    const addr1    = await getSetting('sender_address_line_1') || '';
    const addr2    = await getSetting('sender_address_line_2') || '';
    const suburb   = await getSetting('sender_suburb') || '';
    const state    = await getSetting('sender_state') || '';
    const postcode = await getSetting('sender_postcode') || '';
    const biz = {
      name,
      address: [addr1, addr2, suburb, state, postcode].filter(Boolean).join(', '),
      phone:   await getSetting('sender_phone') || '',
      email:   await getSetting('sender_email') || '',
      abn:     await getSetting('sender_abn') || '',
      logoUrl: await getSetting('invoice_logo_url') || '',
    };
    setBizCache(biz);
    return biz;
  }, [bizCache]);

  const handleDownloadPDF = async (invoice) => {
    const biz = await getBiz();
    downloadInvoicePDF(invoice, biz);
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    await db.invoices.delete(id);
  };

  const exportAllCSV = () => {
    if (!savedInvoices?.length) return;
    const rows = savedInvoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Date': formatDate(inv.invoiceDate || inv.createdAt),
      'Client Name': inv.clientName,
      'Mobile': inv.clientMobile,
      'Email': inv.clientEmail,
      'Subtotal': Number(inv.subtotal || 0).toFixed(2),
      'GST Included': Number(inv.gstIncluded || 0).toFixed(2),
      'Discount': Number(inv.discountAmount || 0).toFixed(2),
      'Total': Number(inv.total || 0).toFixed(2),
      'Status': 'PAID'
    }));
    downloadCSV(
      `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      ['Invoice Number', 'Date', 'Client Name', 'Mobile', 'Email', 'Subtotal', 'GST Included', 'Discount', 'Total', 'Status']
    );
  };

  const exportContactsCSV = () => {
    if (!savedInvoices?.length) return;
    const seen = new Set();
    const rows = [];
    for (const inv of savedInvoices) {
      const key = (inv.clientMobile || '') + '|' + (inv.clientEmail || '');
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({ 'Name': inv.clientName, 'Mobile': inv.clientMobile, 'Email': inv.clientEmail });
      }
    }
    downloadCSV(
      `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      ['Name', 'Mobile', 'Email']
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <FileText size={28} color="var(--accent)" />
            Invoice History
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            All saved invoices. Download PDFs or export data.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={exportContactsCSV}
            disabled={!savedInvoices?.length}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
          >
            <Users size={15} /> Export Contacts
          </button>
          <button
            className="btn btn-secondary"
            onClick={exportAllCSV}
            disabled={!savedInvoices?.length}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 14px' }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {savedInvoices?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-primary)' }}>
                  {['Invoice #', 'Date', 'Client', 'Mobile', 'Email', 'Total', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: h === 'Total' ? 'right' : 'left',
                      padding: '13px 16px', color: 'var(--text-secondary)',
                      fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8rem',
                      textTransform: 'uppercase', letterSpacing: '0.04em'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savedInvoices.map((invoice, idx) => (
                  <tr
                    key={invoice.id}
                    style={{
                      borderBottom: idx < savedInvoices.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.12s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {invoice.invoiceNumber}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(invoice.invoiceDate || invoice.createdAt)}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {invoice.clientName || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                      {invoice.clientMobile || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                      {invoice.clientEmail || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatCurrency(invoice.total)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                        background: 'rgba(16,185,129,0.10)', color: 'var(--success)',
                        border: '1px solid rgba(16,185,129,0.22)'
                      }}>
                        <CheckCircle size={11} /> PAID
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          title="Download PDF"
                          style={{
                            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                            color: 'var(--accent)', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                            padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5,
                            fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        >
                          <Download size={13} /> PDF
                        </button>
                        <button
                          onClick={() => deleteInvoice(invoice.id)}
                          title="Delete invoice"
                          style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', padding: '5px',
                            borderRadius: 'var(--radius-sm)', transition: 'color 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '60px 32px', textAlign: 'center' }}>
            <FileText size={40} style={{ color: 'var(--border)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
              No saved invoices yet.
            </p>
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0', fontSize: '0.85rem' }}>
              Use the <strong>Sales Terminal</strong> to create your first sale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
