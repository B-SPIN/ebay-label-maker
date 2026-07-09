import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../db/database.js';
import jsPDF from 'jspdf';
import {
  ShoppingCart, Search, ChevronRight, ChevronLeft, CheckCircle,
  AlertCircle, X, PlusCircle, Tag, Users, FileText,
  Percent, DollarSign, Trash2, Download, Zap
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

function generateInvoiceNumber(savedInvoices) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `INV${yy}${mm}`;
  const thisMonth = (savedInvoices || []).filter(
    inv => inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)
  );
  const maxSeq = thisMonth.reduce((max, inv) => {
    const seq = parseInt(inv.invoiceNumber.slice(-5), 10);
    return isNaN(seq) ? max : Math.max(max, seq);
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

function buildInvoicePDF(invoice, biz) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 18;
  let y = margin;

  const right = (text, yPos, color) => {
    const c = color || [30, 30, 30];
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(String(text), W - margin, yPos, { align: 'right' });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  if (biz.name) doc.text(biz.name, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  let bizY = y + 7;
  if (biz.address) { doc.text(biz.address, margin, bizY); bizY += 5; }
  if (biz.phone)   { doc.text('Ph: ' + biz.phone, margin, bizY); bizY += 5; }
  if (biz.email)   { doc.text(biz.email, margin, bizY); bizY += 5; }
  if (biz.abn)     { doc.text('ABN: ' + biz.abn, margin, bizY); }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  right('INVOICE', y, [120, 120, 120]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  right(invoice.invoiceNumber, y + 7, [30, 30, 30]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  right('Date: ' + formatDate(invoice.invoiceDate), y + 14, [100, 100, 100]);

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(W - margin - 26, y + 19, 26, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('PAID', W - margin - 13, y + 24.5, { align: 'center' });

  y = Math.max(bizY + 4, y + 36);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, W - margin * 2, 28, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('BILL TO', margin + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(invoice.clientName || 'Customer', margin + 5, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  let billY = y + 19;
  if (invoice.clientMobile) { doc.text('Ph: ' + invoice.clientMobile, margin + 5, billY); billY += 5; }
  if (invoice.clientEmail)  { doc.text(invoice.clientEmail, margin + 5, billY); }
  if (invoice.clientAddress) {
    const addrLines = doc.splitTextToSize(invoice.clientAddress, 80);
    doc.text(addrLines, W - margin - 5, y + 13, { align: 'right' });
  }
  y += 36;

  const colX = { desc: margin, qty: 120, unit: 148, total: W - margin };
  doc.setFillColor(240, 240, 245);
  doc.rect(margin, y, W - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('DESCRIPTION', colX.desc + 2, y + 4);
  doc.text('QTY', colX.qty, y + 4, { align: 'center' });
  doc.text('UNIT PRICE', colX.unit + 4, y + 4);
  doc.text('TOTAL', colX.total, y + 4, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  (invoice.rows || []).forEach(function(row, i) {
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y - 3, W - margin * 2, 8, 'F');
    }
    doc.setTextColor(30, 30, 30);
    const descLines = doc.splitTextToSize(row.description || '', 60);
    doc.text(descLines, colX.desc + 2, y + 1);
    doc.setTextColor(60, 60, 60);
    doc.text(String(row.quantity), colX.qty, y + 1, { align: 'center' });
    doc.text(formatCurrency(row.unitPrice), colX.unit + 4, y + 1);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(row.quantity * row.unitPrice), colX.total, y + 1, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    const rowH = Math.max(8, descLines.length * 5);
    doc.setDrawColor(235, 235, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH - 2, W - margin, y + rowH - 2);
    y += rowH;
  });
  y += 6;

  const totW = 72, totX = W - margin - totW;
  const totRow = function(label, value, bold, highlight) {
    if (highlight) {
      doc.setFillColor(237, 233, 254);
      doc.roundedRect(totX, y - 3, totW, 9, 1.5, 1.5, 'F');
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 10 : 8.5);
    doc.setTextColor(bold ? 30 : 90, bold ? 30 : 90, bold ? 30 : 90);
    doc.text(label, totX + 3, y + 2);
    doc.setTextColor(bold ? 80 : 90, bold ? 60 : 90, bold ? 200 : 90);
    doc.text(value, W - margin, y + 2, { align: 'right' });
    y += 9;
  };

  totRow('Subtotal', formatCurrency(invoice.subtotal));
  totRow('Includes GST (10%)', formatCurrency(invoice.gstIncluded));
  if (invoice.discountAmount > 0) {
    totRow(
      'Discount' + (invoice.discountType === 'percent' ? ' (' + invoice.discountValue + '%)' : ''),
      '-' + formatCurrency(invoice.discountAmount)
    );
  }
  totRow('TOTAL', formatCurrency(invoice.total), true, true);
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Thank you for your business!', W / 2, y, { align: 'center' });

  return doc;
}

export function downloadInvoicePDF(invoice, biz) {
  const doc = buildInvoicePDF(invoice, biz);
  doc.save((invoice.invoiceNumber || 'invoice') + '.pdf');
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Items', icon: ShoppingCart },
    { n: 2, label: 'Customer', icon: Users },
    { n: 3, label: 'Review', icon: FileText },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '32px' }}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        const done = current > s.n;
        const active = current === s.n;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--bg-primary)',
                border: '2px solid ' + (done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'),
                color: (done || active) ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.25s', fontWeight: 700, fontSize: '1rem'
              }}>
                {done ? <CheckCircle size={20} /> : <Icon size={18} />}
              </div>
              <span style={{
                fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent)' : done ? 'var(--success)' : 'var(--text-secondary)',
                transition: 'color 0.25s'
              }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, width: 80, marginBottom: 22,
                background: current > s.n ? 'var(--success)' : 'var(--border)',
                transition: 'background 0.3s'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Item Search Autocomplete ────────────────────────────────────────────────

function ItemSearch({ invoiceItems, selectedIds, onAdd }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!invoiceItems || !query.trim()) return [];
    const q = query.toLowerCase();
    return invoiceItems
      .filter(item => !selectedIds.includes(item.id))
      .filter(item => (item.title || item.description || '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [invoiceItems, selectedIds, query]);

  useEffect(() => { setHighlight(0); }, [filtered]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (item) => {
    onAdd(item.id);
    setQuery('');
    setOpen(false);
    inputRef.current && inputRef.current.focus();
  };

  const onKey = (e) => {
    if (!open || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[highlight]) select(filtered[highlight]); }
    if (e.key === 'Escape')    { setOpen(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-secondary)', pointerEvents: 'none'
        }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={onKey}
          placeholder="Search catalog items by name..."
          style={{
            width: '100%', padding: '12px 36px 12px 38px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
            fontSize: '0.95rem', fontFamily: 'var(--font-sans)', boxSizing: 'border-box'
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', lineHeight: 0, padding: 2
          }}><X size={14} /></button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', marginTop: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden'
        }}>
          {filtered.map((item, i) => {
            const price = item.current_price !== undefined ? item.current_price : (item.unitPrice || 0);
            return (
              <div
                key={item.id}
                onMouseDown={() => select(item)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  background: i === highlight ? 'var(--accent-soft)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s'
                }}
              >
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1, marginRight: 12 }}>
                  {item.title || item.description}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  {formatCurrency(price)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Most Sold Grid ───────────────────────────────────────────────────────────

function MostSoldGrid({ invoiceItems, savedInvoices, selectedIds, onAdd }) {
  const topItems = useMemo(() => {
    if (!invoiceItems || !invoiceItems.length) return [];
    const counts = {};
    (savedInvoices || []).forEach(inv => {
      (inv.rows || []).forEach(row => {
        if (row.id && !String(row.id).startsWith('custom_')) {
          counts[row.id] = (counts[row.id] || 0) + (row.quantity || 1);
        }
      });
    });
    return invoiceItems
      .filter(item => !selectedIds.includes(item.id))
      .map(item => ({ ...item, soldCount: counts[item.id] || 0 }))
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 6);
  }, [invoiceItems, savedInvoices, selectedIds]);

  if (!topItems.length) return null;

  return (
    <div>
      <div style={{
        fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <Zap size={13} /> Quick Add
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {topItems.map(item => {
          const price = item.current_price !== undefined ? item.current_price : (item.unitPrice || 0);
          return (
            <button
              key={item.id}
              onClick={() => onAdd(item.id)}
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '12px 10px', cursor: 'pointer',
                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                transition: 'all 0.15s', outline: 'none'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-soft)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-primary)';
              }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {(item.title || item.description || '').slice(0, 40)}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent)' }}>
                {formatCurrency(price)}
              </span>
              {item.soldCount > 0 && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  x{item.soldCount} sold
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const inputStyle = {
  padding: '11px 13px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', width: '100%', fontSize: '0.95rem',
  fontFamily: 'var(--font-sans)', boxSizing: 'border-box'
};

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: '7px',
  fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)'
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalesTerminal() {
  const invoiceItems  = useLiveQuery(() => db.invoice_items.toArray(), []);
  const savedInvoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray(), []);

  const [biz, setBiz] = useState({ name: '', address: '', phone: '', email: '', abn: '', logoUrl: '' });
  useEffect(() => {
    (async () => {
      const name     = await getSetting('sender_business_name') || await getSetting('sender_name') || '';
      const addr1    = await getSetting('sender_address_line_1') || '';
      const addr2    = await getSetting('sender_address_line_2') || '';
      const suburb   = await getSetting('sender_suburb') || '';
      const state    = await getSetting('sender_state') || '';
      const postcode = await getSetting('sender_postcode') || '';
      setBiz({
        name,
        address: [addr1, addr2, suburb, state, postcode].filter(Boolean).join(', '),
        phone:   await getSetting('sender_phone') || '',
        email:   await getSetting('sender_email') || '',
        abn:     await getSetting('sender_abn') || '',
        logoUrl: await getSetting('invoice_logo_url') || '',
      });
    })();
  }, []);

  const [step, setStep] = useState(1);

  const [invoiceRows, setInvoiceRows]         = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [discountType, setDiscountType]       = useState('none');
  const [discountValue, setDiscountValue]     = useState('');
  const [invoiceDate, setInvoiceDate]         = useState(() => new Date().toISOString().slice(0, 10));

  const [clientName, setClientName]       = useState('');
  const [clientMobile, setClientMobile]   = useState('');
  const [clientEmail, setClientEmail]     = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [step1Error, setStep1Error]   = useState('');
  const [step2Error, setStep2Error]   = useState('');
  const [saveStatus, setSaveStatus]   = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [savedInvoiceRef, setSavedInvoiceRef] = useState(null);

  const invoiceNumber = useMemo(() => generateInvoiceNumber(savedInvoices), [savedInvoices]);

  const subtotal = invoiceRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const gstIncluded = subtotal / 11;
  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'dollar')  return Math.min(val, subtotal);
    if (discountType === 'percent') return subtotal * (Math.min(val, 100) / 100);
    return 0;
  }, [discountType, discountValue, subtotal]);
  const total = subtotal - discountAmount;

  const addItemById = useCallback((itemId) => {
    const item = invoiceItems && invoiceItems.find(e => e.id === Number(itemId));
    if (!item) return;
    const price = item.current_price !== undefined ? item.current_price : (item.unitPrice || 0);
    setInvoiceRows(prev => [...prev, {
      id: item.id, description: item.title || item.description,
      quantity: 1, unitPrice: price
    }]);
    setSelectedItemIds(prev => [...prev, item.id]);
    setStep1Error('');
  }, [invoiceItems]);

  const addCustomRow = () => {
    setInvoiceRows(prev => [...prev, {
      id: 'custom_' + Date.now(), description: '', quantity: 1, unitPrice: 0, isCustom: true
    }]);
    setStep1Error('');
  };

  const updateRow = (index, field, value) => {
    setInvoiceRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === 'description' ? value : Number(value || 0) };
      return next;
    });
  };

  const removeRow = (index) => {
    setInvoiceRows(prev => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (!removed.isCustom) setSelectedItemIds(ids => ids.filter(id => id !== removed.id));
      return next;
    });
  };

  const goToStep2 = () => {
    if (invoiceRows.length === 0) { setStep1Error('Add at least one item to continue.'); return; }
    setStep1Error('');
    setStep(2);
  };

  const goToStep3 = () => {
    if (!clientMobile.trim() && !clientEmail.trim()) {
      setStep2Error('Mobile or email is required.');
      return;
    }
    setStep2Error('');
    setStep(3);
  };

  const resetAll = () => {
    setStep(1);
    setInvoiceRows([]); setSelectedItemIds([]);
    setDiscountType('none'); setDiscountValue('');
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setClientName(''); setClientMobile(''); setClientEmail(''); setClientAddress('');
    setStep1Error(''); setStep2Error('');
    setSaveStatus(''); setSaveMessage(''); setSavedInvoiceRef(null);
  };

  const buildInvoiceObject = () => ({
    invoiceNumber, invoiceDate,
    clientName: clientName.trim(), clientMobile: clientMobile.trim(),
    clientEmail: clientEmail.trim(), clientAddress: clientAddress.trim(),
    rows: invoiceRows, subtotal, gstIncluded, discountType,
    discountValue: parseFloat(discountValue) || 0,
    discountAmount, total, status: 'paid',
    createdAt: new Date().toISOString(),
  });

  const doSave = async () => {
    if (savedInvoiceRef) return savedInvoiceRef;
    setSaveStatus('saving');
    const inv = buildInvoiceObject();
    try {
      const id = await db.invoices.add(inv);
      const saved = { ...inv, id };
      setSavedInvoiceRef(saved);
      setSaveStatus('saved');
      setSaveMessage('Invoice ' + invoiceNumber + ' saved!');
      return saved;
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setSaveMessage('Failed to save. Please try again.');
      return null;
    }
  };

  const handleSave = async () => {
    const saved = await doSave();
    if (saved) setTimeout(() => { setSaveStatus(''); setSaveMessage(''); }, 3500);
  };

  const handleSaveAndPDF = async () => {
    const saved = await doSave();
    if (saved) {
      downloadInvoicePDF(saved, biz);
      setTimeout(() => { setSaveStatus(''); setSaveMessage(''); }, 3500);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 860, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <ShoppingCart size={28} color="var(--accent)" />
            Sales Terminal
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Create a sale, collect customer details, then save &amp; download a PDF invoice.
          </p>
        </div>
        {step > 1 && !savedInvoiceRef && (
          <button className="btn btn-secondary" onClick={resetAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <X size={16} /> Cancel Sale
          </button>
        )}
        {savedInvoiceRef && (
          <button className="btn btn-primary" onClick={resetAll}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <PlusCircle size={16} /> New Sale
          </button>
        )}
      </div>

      <StepIndicator current={step} />

      {/* ── STEP 1: ITEMS ── */}
      {step === 1 && (
        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '1.05rem' }}>
            <Tag size={18} color="var(--accent)" /> Add Items
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px', marginTop: 0 }}>
            All prices are GST-inclusive (10%).
          </p>

          {invoiceItems && invoiceItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <ItemSearch invoiceItems={invoiceItems} selectedIds={selectedItemIds} onAdd={addItemById} />
            </div>
          )}

          {invoiceItems && invoiceItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <MostSoldGrid
                invoiceItems={invoiceItems}
                savedInvoices={savedInvoices}
                selectedIds={selectedItemIds}
                onAdd={addItemById}
              />
            </div>
          )}

          {invoiceRows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 10 }}>
                Order Items
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 96px 32px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
                {['Description', 'Qty', 'Price', ''].map(h => (
                  <span key={h} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {invoiceRows.map((row, i) => (
                  <div key={row.id + '-' + i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 64px 96px 32px',
                    gap: 8, alignItems: 'center', padding: '10px 12px',
                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)'
                  }}>
                    <input type="text" value={row.description}
                      onChange={e => updateRow(i, 'description', e.target.value)}
                      placeholder="Description"
                      style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input type="number" min="1" value={row.quantity}
                      onChange={e => updateRow(i, 'quantity', e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input type="number" step="0.01" min="0" value={row.unitPrice}
                      onChange={e => updateRow(i, 'unitPrice', e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', textAlign: 'right', width: '100%', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            <button onClick={addCustomRow} className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', padding: '8px 14px' }}>
              <PlusCircle size={15} /> Custom Item
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Date:
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontFamily: 'var(--font-sans)' }} />
            </label>
          </div>

          {invoiceRows.length > 0 && (
            <div style={{ padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Percent size={13} /> Discount (optional)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: discountType !== 'none' ? 12 : 0 }}>
                {['none', 'dollar', 'percent'].map(t => (
                  <button key={t} onClick={() => { setDiscountType(t); if (t === 'none') setDiscountValue(''); }}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: '1px solid ' + (discountType === t ? 'var(--accent)' : 'var(--border)'),
                      background: discountType === t ? 'var(--accent-soft)' : 'transparent',
                      color: discountType === t ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                    }}>
                    {t === 'none' ? 'None' : t === 'dollar' ? React.createElement(React.Fragment, null, React.createElement(DollarSign, { size: 12 }), 'Dollar') : React.createElement(React.Fragment, null, React.createElement(Percent, { size: 12 }), 'Percent')}
                  </button>
                ))}
              </div>
              {discountType !== 'none' && (
                <input type="number" min="0" step={discountType === 'dollar' ? '0.01' : '0.1'}
                  max={discountType === 'percent' ? '100' : undefined}
                  value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'dollar' ? 'e.g. 10.00' : 'e.g. 5'}
                  style={{ ...inputStyle, width: 160 }}
                />
              )}
            </div>
          )}

          {invoiceRows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span><span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Incl. GST</span><span>{formatCurrency(gstIncluded)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--danger)', fontWeight: 600 }}>
                    <span>Discount</span><span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)', borderTop: '2px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {step1Error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 16, fontSize: '0.88rem', fontWeight: 600 }}>
              <AlertCircle size={16} /> {step1Error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={goToStep2}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', fontSize: '0.95rem' }}>
              Customer Details <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: CUSTOMER ── */}
      {step === 2 && (
        <div className="card" style={{ padding: '28px', maxWidth: 520, margin: '0 auto' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '1.05rem' }}>
            <Users size={18} color="var(--accent)" /> Customer Details
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', marginTop: 0 }}>
            Mobile or email is required. Everything else is optional.
          </p>
          <div style={{ display: 'grid', gap: 16 }}>
            <label style={labelStyle}>
              Full Name <span style={{ fontWeight: 400 }}>(optional)</span>
              <input type="text" style={inputStyle} value={clientName}
                onChange={e => setClientName(e.target.value)} placeholder="Customer name" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={labelStyle}>
                Mobile *
                <input type="tel" style={inputStyle} value={clientMobile}
                  onChange={e => { setClientMobile(e.target.value); setStep2Error(''); }}
                  placeholder="04XX XXX XXX" />
              </label>
              <label style={labelStyle}>
                Email *
                <input type="email" style={inputStyle} value={clientEmail}
                  onChange={e => { setClientEmail(e.target.value); setStep2Error(''); }}
                  placeholder="customer@email.com" />
              </label>
            </div>
            <p style={{ margin: '-8px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>* Mobile or email is required</p>
            <label style={labelStyle}>
              Address <span style={{ fontWeight: 400 }}>(optional)</span>
              <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={clientAddress}
                onChange={e => setClientAddress(e.target.value)} placeholder="Street, suburb, state, postcode" />
            </label>
          </div>
          {step2Error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.25)', marginTop: 16, fontSize: '0.88rem', fontWeight: 600 }}>
              <AlertCircle size={16} /> {step2Error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginTop: 28 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ChevronLeft size={18} /> Back
            </button>
            <button className="btn btn-primary" onClick={goToStep3}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 24px', fontSize: '0.95rem' }}>
              Review Invoice <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW & SAVE ── */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '32px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, gap: 24 }}>
              <div style={{ flex: 1 }}>
                {biz.logoUrl && <img src={biz.logoUrl} alt="Logo" style={{ maxWidth: 160, maxHeight: 60, objectFit: 'contain', marginBottom: 10, display: 'block' }} />}
                {biz.name    && <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4 }}>{biz.name}</div>}
                {biz.address && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{biz.address}</div>}
                {biz.phone   && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ph: {biz.phone}</div>}
                {biz.email   && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{biz.email}</div>}
                {biz.abn     && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ABN: {biz.abn}</div>}
                {!biz.name && !biz.address && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Configure business details in Settings</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Invoice</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 6 }}>{invoiceNumber}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Date: {formatDate(invoiceDate)}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999, fontSize: '0.76rem', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)' }}>
                  <CheckCircle size={12} /> PAID
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px solid var(--border)', marginBottom: 22 }} />

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: 24 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 8 }}>Bill To</div>
              <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.92rem' }}>
                {clientName || React.createElement('span', { style: { color: 'var(--text-secondary)', fontWeight: 400 } }, 'Customer')}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {clientMobile && React.createElement('div', null, '📱 ' + clientMobile)}
                {clientEmail  && React.createElement('div', null, '✉ ' + clientEmail)}
                {clientAddress && React.createElement('div', { style: { marginTop: 4 } }, clientAddress)}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 22 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {[['Description', 'left'], ['Qty', 'center'], ['Unit Price', 'right'], ['Total', 'right']].map(function(pair) {
                    return React.createElement('th', { key: pair[0], style: { textAlign: pair[1], padding: '9px 8px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' } }, pair[0]);
                  })}
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((row, i) => (
                  <tr key={row.id + '-' + i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 8px', fontSize: '0.87rem' }}>{row.description || React.createElement('span', { style: { color: 'var(--text-secondary)', fontStyle: 'italic' } }, 'Item')}</td>
                    <td style={{ padding: '11px 8px', textAlign: 'center', fontSize: '0.87rem' }}>{row.quantity}</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontSize: '0.87rem' }}>{formatCurrency(row.unitPrice)}</td>
                    <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.87rem' }}>{formatCurrency(row.quantity * row.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.87rem', color: 'var(--text-secondary)' }}>Subtotal</span>
                  <span style={{ fontWeight: 600, fontSize: '0.87rem' }}>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Includes GST (10%)</span>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatCurrency(gstIncluded)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 11px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <span style={{ fontSize: '0.87rem', color: 'var(--danger)' }}>{'Discount' + (discountType === 'percent' ? ' (' + discountValue + '%)' : '')}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.87rem', color: 'var(--danger)' }}>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent)' }}>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Thank you for your business! 🙏</div>
            </div>
          </div>

          <div className="card" style={{ padding: '20px 28px' }}>
            {saveStatus && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', marginBottom: 16, fontSize: '0.88rem', fontWeight: 600,
                background: saveStatus === 'saved' ? 'rgba(16,185,129,0.08)' : saveStatus === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                color: saveStatus === 'saved' ? 'var(--success)' : saveStatus === 'error' ? 'var(--danger)' : 'var(--accent)',
                border: '1px solid ' + (saveStatus === 'saved' ? 'rgba(16,185,129,0.25)' : saveStatus === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)')
              }}>
                {saveStatus === 'saved' ? React.createElement(CheckCircle, { size: 16 }) : saveStatus === 'error' ? React.createElement(AlertCircle, { size: 16 }) : null}
                {saveMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)} disabled={!!savedInvoiceRef}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <ChevronLeft size={18} /> Back
              </button>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!savedInvoiceRef && (
                  <button className="btn btn-secondary" onClick={handleSave} disabled={saveStatus === 'saving'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={16} />
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Invoice'}
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleSaveAndPDF} disabled={saveStatus === 'saving'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', fontSize: '0.95rem' }}>
                  <Download size={16} />
                  {savedInvoiceRef ? 'Download PDF Again' : 'Save & Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
