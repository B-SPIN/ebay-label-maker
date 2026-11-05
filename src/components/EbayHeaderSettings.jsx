import React, { useEffect, useState } from 'react';
import { FileText, Save, CheckCircle, RotateCcw } from 'lucide-react';
import { getEbayHeaderMap, saveSetting } from '../db/database';
import { DEFAULT_HEADER_MAP, EBAY_FIELDS } from '../services/ebayHeaders';

// Admin card: edit the eBay CSV header names the importers look for.
// Each field accepts several comma-separated names so old and new exports both work.
export default function EbayHeaderSettings() {
  const [map, setMap] = useState(DEFAULT_HEADER_MAP);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getEbayHeaderMap().then(setMap); }, []);

  const handleSave = async () => {
    await saveSetting('ebay_header_map', map);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem'
  };

  return (
    <div className="card" style={{ height: '100%' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FileText size={20} />
        eBay CSV headers
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Match the column titles in your eBay export. Separate several accepted names with commas;
        the first one found in the file is used.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 2fr', gap: '10px 16px', alignItems: 'center', marginBottom: '24px' }}>
        {EBAY_FIELDS.map(({ key, label }) => (
          <React.Fragment key={key}>
            <label htmlFor={`ebay-header-${key}`} style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</label>
            <input
              id={`ebay-header-${key}`}
              type="text"
              value={map[key]}
              onChange={e => setMap({ ...map, [key]: e.target.value })}
              style={inputStyle}
            />
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          Save eBay headers
        </button>
        <button
          onClick={() => setMap(DEFAULT_HEADER_MAP)}
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RotateCcw size={18} />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
