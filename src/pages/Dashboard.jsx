import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { parseEbayCsv } from '../services/csvParser.js';
import { validateAddresses, validatePostcode, startBackgroundValidation } from '../services/addressValidator.js';
import { db, getEbayHeaderMap } from '../db/database.js';
import { NotificationService } from '../services/notificationService.js';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, Clock, Archive, Trash2, Printer, Edit2, Info, Loader2 } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Dashboard() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  React.useEffect(() => {
    const handleComplete = (e) => {
      const { count } = e.detail;
      setNotification(`Validation complete for ${count} addresses!`);
      setTimeout(() => setNotification(null), 5000);
    };
    window.addEventListener('validation-complete', handleComplete);
    return () => window.removeEventListener('validation-complete', handleComplete);
  }, []);

  const recentLogs = useLiveQuery(() => db.csv_logs.orderBy('id').reverse().limit(5).toArray());
  const allOrders = useLiveQuery(() => db.orders.toArray());
  const apiKeySetting = useLiveQuery(() => db.settings.get('geoapify_api_key'));
  const hasApiKey = !!(apiKeySetting && apiKeySetting.value);

  // Group orders by batchTimestamp — each CSV upload is its own separate batch
  const batches = React.useMemo(() => {
    if (!allOrders || allOrders.length === 0) return [];
    const groups = new Map();
    for (const order of allOrders) {
      const ts = order.batchTimestamp || 'Unknown';
      if (!groups.has(ts)) {
        groups.set(ts, { timestamp: ts, filename: order.batchFilename || 'Unknown', orders: [] });
      }
      groups.get(ts).orders.push(order);
    }
    return Array.from(groups.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [allOrders]);

  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setProgress('Parsing CSV...');
    setError('');
    NotificationService.showParsingStarted(file.name);

    try {
      // 1. Parse CSV
      const parsedOrders = await parseEbayCsv(file, await getEbayHeaderMap());
      
      if (parsedOrders.length === 0) {
        throw new Error('No valid orders found in CSV.');
      }

      // 2. Fetch Settings directly (avoiding stale state)
      const apiKey = await db.settings.get('geoapify_api_key');
      const useGeo = await db.settings.get('use_geoapify');
      const apiEnabled = !!(apiKey?.value && useGeo?.value === 'true');
      
      setProgress(`Preparing batch...`);
      
      const currentTimestamp = new Date().toISOString();
      const initialProcessed = parsedOrders.map(o => {
        const isLocalValid = validatePostcode(o.state, o.postcode);
        const startsWithParcel = (o.address1?.trim().toLowerCase().startsWith('parcel') || o.address2?.trim().toLowerCase().startsWith('parcel'));
        
        // If API is enabled, we mark it as 'verifying' even if local passes 
        // to get the extra confidence/formatting from Geoapify.
        // Otherwise, we fallback to local validation result.
        let status = 'unverified';
        let error = null;
        let showPhoneOnLabel = startsWithParcel;

        if (startsWithParcel) {
          status = 'unverified';
          error = 'Parcel Address - Needs manual confirmation';
        } else if (apiEnabled) {
          status = 'verifying';
        } else if (isLocalValid) {
          status = 'valid';
        }

        return {
          ...o,
          orderId: o.orderIds,
          batchTimestamp: currentTimestamp,
          batchFilename: file.name,
          status,
          error,
          showPhoneOnLabel
        };
      });

      // 3. Save immediately
      setProgress('Saving batch...');
      await db.orders.bulkAdd(initialProcessed);

      // 4. Trigger Background API Validation if needed
      if (apiEnabled) {
        startBackgroundValidation(currentTimestamp);
      }

      // 5. Summarize and Log (Initial state)
      const validCount = initialProcessed.filter(o => o.status === 'valid').length;
      const manualCount = initialProcessed.filter(o => o.status === 'manual').length;
      const invalidCount = initialProcessed.length - validCount - manualCount;

      await db.csv_logs.add({
        filename: file.name,
        processedAt: currentTimestamp,
        totalRows: initialProcessed.length,
        validCount,
        invalidCount,
        manualCount
      });
      
      // Keep only last 5 logs
      const logsCount = await db.csv_logs.count();
      if (logsCount > 5) {
        const oldestLogs = await db.csv_logs.orderBy('id').limit(logsCount - 5).toArray();
        await db.csv_logs.bulkDelete(oldestLogs.map(l => l.id));
      }
    } catch (err) {
      console.error(err);
      const errorMsg = err.message || 'An error occurred during processing.';
      setError(errorMsg);
      NotificationService.showParsingError(errorMsg);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    processFile(file);
    event.target.value = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv' || file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setError('Please upload a valid CSV file.');
    }
  };

  const handleClearAll = async () => {
    setConfirmState({
      isOpen: true,
      title: 'Clear All Batches',
      message: 'Are you sure you want to permanently delete ALL batches and orders? This action cannot be undone.',
      onConfirm: async () => {
        await db.orders.clear();
      }
    });
  };

  const handleRemoveBatch = async (timestamp, filename) => {
    setConfirmState({
      isOpen: true,
      title: 'Remove Batch',
      message: `Are you sure you want to remove the batch "${filename}"?`,
      onConfirm: async () => {
        const toRemove = allOrders.filter(o => o.batchTimestamp === timestamp);
        const ids = toRemove.map(o => o.id).filter(Boolean);
        if (ids.length > 0) {
          await db.orders.bulkDelete(ids);
        }
      }
    });
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ marginBottom: '24px' }}>Dashboard</h1>

      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 1000,
          background: 'var(--accent)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 'var(--radius)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slide-in 0.3s ease-out'
        }}>
          <CheckCircle size={20} />
          <span style={{ fontWeight: 600 }}>{notification}</span>
        </div>
      )}

      {/* SECTION 1: Process New CSV */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <h2 style={{ marginBottom: '8px' }}>Process CSV</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Upload an eBay orders CSV. Each file creates a separate batch for label printing and review.
        </p>

        {!hasApiKey && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            marginTop: '16px',
            padding: '14px 16px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            lineHeight: 1.5
          }}>
            <Info size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong style={{ color: '#f59e0b' }}>No Geoapify API key configured.</strong>
              <span style={{ color: 'var(--text-secondary)' }}>
                {' '}Online address validation is disabled — only offline checks will run.
                <button
                  onClick={() => navigate('/settings')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, marginLeft: '4px', fontSize: '0.9rem', textDecoration: 'underline' }}
                >
                  Add key in Settings →
                </button>
              </span>
            </div>
          </div>
        )}
        
        <label 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ 
            display: 'block',
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`, 
            borderRadius: 'var(--radius)', 
            padding: '60px', 
            textAlign: 'center',
            marginTop: '24px',
            cursor: isProcessing ? 'wait' : 'pointer',
            transition: 'var(--transition)',
            background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
            position: 'relative'
          }}
        >
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            disabled={isProcessing}
            style={{ display: 'none' }}
          />
          {isProcessing ? (
            <div className="loading-state">
              <div className="spinner spin"></div>
              <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '1.1rem' }}>{progress}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: isDragging ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <UploadCloud size={48} />
              <span style={{ fontWeight: 500, fontSize: '1.1rem' }}>
                {isDragging ? 'Drop CSV here' : 'Click or Drag & Drop .csv file here'}
              </span>
            </div>
          )}
        </label>

        {error && (
          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 'var(--radius-sm)' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      {/* SECTION 2: Active Batches */}
      {batches.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Active Batches ({batches.length})</h2>
            {batches.length > 1 && (
              <button 
                className="btn"
                onClick={handleClearAll}
                style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {batches.map((batch, idx) => {
              const validCount = batch.orders.filter(o => o.status === 'valid').length;
              const manualCount = batch.orders.filter(o => o.status === 'manual').length;
              const verifyingCount = batch.orders.filter(o => o.status === 'verifying').length;
              const invalidCount = batch.orders.length - validCount - manualCount - verifyingCount;
              const isVerifying = verifyingCount > 0;

              return (
                <div key={batch.timestamp} className="card">
                  {/* Batch Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={20} color="var(--accent)" />
                        {batch.filename}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {new Date(batch.timestamp).toLocaleString()} — {batch.orders.length} orders
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveBatch(batch.timestamp, batch.filename)}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                      title="Remove this batch"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ 
                      padding: '20px', 
                      borderRadius: 'var(--radius-sm)', 
                      background: 'rgba(34, 197, 94, 0.08)', 
                      border: '1px solid rgba(34, 197, 94, 0.15)',
                      textAlign: 'center'
                    }}>
                      <CheckCircle size={28} color="#22c55e" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{validCount}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Valid</div>
                    </div>
                    
                    <div style={{ 
                      padding: '20px', 
                      borderRadius: 'var(--radius-sm)', 
                      background: isVerifying ? 'rgba(59, 130, 246, 0.05)' : (invalidCount > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-primary)'), 
                      border: `1px solid ${isVerifying ? 'var(--accent)' : (invalidCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--border)')}`,
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      {isVerifying ? (
                        <>
                          <Loader2 size={28} color="var(--accent)" className="spin" style={{ margin: '0 auto 8px' }} />
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{verifyingCount}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Verifying...</div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={28} color={invalidCount > 0 ? '#f59e0b' : 'var(--text-secondary)'} style={{ margin: '0 auto 8px' }} />
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: invalidCount > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>{invalidCount}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Invalid</div>
                        </>
                      )}
                    </div>

                    <div style={{ 
                      padding: '20px', 
                      borderRadius: 'var(--radius-sm)', 
                      background: manualCount > 0 ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)', 
                      border: `1px solid ${manualCount > 0 ? 'rgba(59, 130, 246, 0.15)' : 'var(--border)'}`,
                      textAlign: 'center'
                    }}>
                      <Archive size={28} color={manualCount > 0 ? '#3b82f6' : 'var(--text-secondary)'} style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: manualCount > 0 ? '#3b82f6' : 'var(--text-secondary)' }}>{manualCount}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Manual</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => navigate(`/labels?batch=${encodeURIComponent(batch.timestamp)}`)}
                      style={{ padding: '10px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}
                      disabled={validCount === 0}
                    >
                      <Printer size={16} /> Print {validCount} Labels
                    </button>
                    
                    {invalidCount > 0 && (
                      <button 
                        className="btn" 
                        onClick={() => navigate(`/review?batch=${encodeURIComponent(batch.timestamp)}`)}
                        style={{ padding: '10px 24px', background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
                      >
                        <Edit2 size={16} /> Review {invalidCount} Invalid
                      </button>
                    )}
                  </div>

                  {/* Manual Orders Table (collapsed inline) */}
                  {manualCount > 0 && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                      <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                        <Archive size={16} color="#3b82f6" />
                        Manual Processing Required on eBay
                      </h4>
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'var(--bg-primary)', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                              <th style={{ padding: '10px 12px' }}>Order ID</th>
                              <th style={{ padding: '10px 12px' }}>Buyer</th>
                              <th style={{ padding: '10px 12px' }}>Postage Service</th>
                              <th style={{ padding: '10px 12px' }}>Conf</th>
                              <th style={{ padding: '10px 12px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batch.orders.filter(o => o.status === 'manual').map(order => (
                              <tr key={order.orderId} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '10px 12px' }}>{order.orderId}</td>
                                <td style={{ padding: '10px 12px' }}>{order.buyerUsername}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                                    {order.postageService || 'Unknown'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {order.geoConfidence > 0 ? (
                                    <span style={{ fontWeight: 600, color: order.geoConfidence >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>
                                      {(order.geoConfidence * 100).toFixed(0)}%
                                    </span>
                                  ) : '--'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {order.error ? (
                                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <AlertTriangle size={14} /> {order.error}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <CheckCircle size={14} /> Passed
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: Recent Processed Logs */}
      {recentLogs && recentLogs.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '16px' }}>Recent Processed Files</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{log.filename}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {new Date(log.processedAt).toLocaleString()} — {log.validCount} Valid, {log.invalidCount} Invalid, {log.manualCount || 0} Manual
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
