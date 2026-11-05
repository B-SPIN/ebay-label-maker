import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSetting, saveSetting, getDailyUsage, db } from '../db/database';
import { applyLabelFont } from '../services/fontLoader';
import { Key, Activity, Save, CheckCircle, AlertCircle, Layout, Type, Search, Trash2, Sun, Moon, Box, Settings as SettingsIcon, Eye, RotateCcw, CloudCog, FileText } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import PreviewDialog from '../components/PreviewDialog';
import EbayHeaderSettings from '../components/EbayHeaderSettings';

const POPULAR_FONTS = [
  'Arial', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Oswald', 'Raleway', 'PT Sans', 'Ubuntu', 'Nunito'
];

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [dailyUsage, setDailyUsage] = useState(0);
  const maxUsage = 3000;

  const [useGeoApify, setUseGeoApify] = useState(true);
  const [labelWidth, setLabelWidth] = useState(90);
  const [labelHeight, setLabelHeight] = useState(30);
  const [selectedFont, setSelectedFont] = useState('Nunito');
  const [selectedPalette, setSelectedPalette] = useState('indigo');
  const [currentTheme, setCurrentTheme] = useState('light');
  const [fontSearch, setFontSearch] = useState('');
  const [allFonts, setAllFonts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sampleInvoiceCount, setSampleInvoiceCount] = useState(0);
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [invoiceTerms, setInvoiceTerms] = useState('Payment due within 14 days.');
  const [invoiceTaxRate, setInvoiceTaxRate] = useState(10);
  const [invoiceLogoUrl, setInvoiceLogoUrl] = useState('');

  // Sender Details
  const [senderName, setSenderName] = useState('');
  const [senderBusiness, setSenderBusiness] = useState('');
  const [senderAddress1, setSenderAddress1] = useState('');
  const [senderAddress2, setSenderAddress2] = useState('');
  const [senderSuburb, setSenderSuburb] = useState('');
  const [senderState, setSenderState] = useState('');
  const [senderPostcode, setSenderPostcode] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  // Invoice Details
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceBusiness, setInvoiceBusiness] = useState('');
  const [invoiceAddress1, setInvoiceAddress1] = useState('');
  const [invoiceAddress2, setInvoiceAddress2] = useState('');
  const [invoiceSuburb, setInvoiceSuburb] = useState('');
  const [invoiceState, setInvoiceState] = useState('');
  const [invoicePostcode, setInvoicePostcode] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoiceWebsite, setInvoiceWebsite] = useState('');
  const [invoiceAbn, setInvoiceAbn] = useState('');
  // Alternate Sender Details (used when shipping to ACT)
  const [altSenderName, setAltSenderName] = useState('');
  const [altSenderBusiness, setAltSenderBusiness] = useState('');
  const [altSenderAddress1, setAltSenderAddress1] = useState('');
  const [altSenderAddress2, setAltSenderAddress2] = useState('');
  const [altSenderSuburb, setAltSenderSuburb] = useState('');
  const [altSenderState, setAltSenderState] = useState('');
  const [altSenderPostcode, setAltSenderPostcode] = useState('');
  const [altSenderPhone, setAltSenderPhone] = useState('');
  const [altSenderEmail, setAltSenderEmail] = useState('');

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('admin') === '1') {
      setIsAdmin(true);
    }
  }, [location.search]);

  const SAMPLE_INVOICE_ITEMS = [
    { description: 'Premium Widget', unitPrice: 49.95, sampleData: true },
    { description: 'Shipping Sticker Pack', unitPrice: 12.5, sampleData: true },
    { description: 'Factory Parts Kit', unitPrice: 129.99, sampleData: true },
    { description: 'Express Packaging', unitPrice: 24.95, sampleData: true },
    { description: 'Desk Lamp', unitPrice: 69.0, sampleData: true },
    { description: 'Notebook Bundle', unitPrice: 19.99, sampleData: true },
    { description: 'Warranty Extension', unitPrice: 14.5, sampleData: true }
  ];

  const refreshSampleInvoiceCount = async () => {
    const count = await db.invoice_items.filter(item => item.sampleData === true).count();
    setSampleInvoiceCount(count);
  };

  useEffect(() => {
    if (isAdmin) {
      refreshSampleInvoiceCount();
    }
  }, [isAdmin]);

  const loadSampleInvoiceData = async () => {
    const existingCount = await db.invoice_items.filter(item => item.sampleData === true).count();
    if (existingCount > 0) {
      window.alert('Sample invoice items already exist. Clear them first before loading again.');
      return;
    }

    await db.invoice_items.bulkAdd(SAMPLE_INVOICE_ITEMS);
    setSampleInvoiceCount(SAMPLE_INVOICE_ITEMS.length);
    window.alert('Sample invoice items have been added to the database.');
  };

  const clearSampleInvoiceData = async () => {
    const confirmClear = window.confirm('Clear sample invoice items from the database? This will remove only sample item records.');
    if (!confirmClear) return;

    const sampleItems = await db.invoice_items.filter(item => item.sampleData === true).toArray();
    if (sampleItems.length === 0) {
      window.alert('No sample invoice items found.');
      return;
    }

    await db.transaction('rw', db.invoice_items, async () => {
      for (const record of sampleItems) {
        await db.invoice_items.delete(record.id);
      }
    });

    setSampleInvoiceCount(0);
    window.alert('Sample invoice items have been cleared.');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedKey = await getSetting('geoapify_api_key');
        if (savedKey) setApiKey(savedKey);

        const savedUseGeo = await getSetting('use_geoapify');
        if (savedUseGeo !== null) setUseGeoApify(savedUseGeo === 'true');

        const today = new Date().toISOString().split('T')[0];
        const usageCount = await getDailyUsage(today);
        setDailyUsage(usageCount);

        const savedWidth = await getSetting('label_width');
        if (savedWidth) setLabelWidth(parseInt(savedWidth, 10));

        const savedHeight = await getSetting('label_height');
        if (savedHeight) setLabelHeight(parseInt(savedHeight, 10));

        const savedFont = await getSetting('label_font');
        if (savedFont) setSelectedFont(savedFont);

        const savedPalette = await getSetting('palette');
        if (savedPalette) setSelectedPalette(savedPalette);

        const savedTheme = await getSetting('theme');
        if (savedTheme) setCurrentTheme(savedTheme);

        // Load Sender Details
        setSenderName(await getSetting('sender_name') || '');
        setSenderBusiness(await getSetting('sender_business_name') || '');
        setSenderAddress1(await getSetting('sender_address_line_1') || '');
        setSenderAddress2(await getSetting('sender_address_line_2') || '');
        setSenderSuburb(await getSetting('sender_suburb') || '');
        setSenderState(await getSetting('sender_state') || '');
        setSenderPostcode(await getSetting('sender_postcode') || '');
        setSenderPhone(await getSetting('sender_phone') || '');
        setSenderEmail(await getSetting('sender_email') || '');
        // Load Invoice Address Details
        setInvoiceName(await getSetting('invoice_name') || '');
        setInvoiceBusiness(await getSetting('invoice_business_name') || '');
        setInvoiceAddress1(await getSetting('invoice_address_line_1') || '');
        setInvoiceAddress2(await getSetting('invoice_address_line_2') || '');
        setInvoiceSuburb(await getSetting('invoice_suburb') || '');
        setInvoiceState(await getSetting('invoice_state') || '');
        setInvoicePostcode(await getSetting('invoice_postcode') || '');
        setInvoicePhone(await getSetting('invoice_phone') || '');
        setInvoiceEmail(await getSetting('invoice_email') || '');
        setInvoiceWebsite(await getSetting('invoice_website') || '');
        setInvoiceAbn(await getSetting('invoice_abn') || '');

        // Load Alternate Sender Details
        setAltSenderName(await getSetting('alt_sender_name') || '');
        setAltSenderBusiness(await getSetting('alt_sender_business_name') || '');
        setAltSenderAddress1(await getSetting('alt_sender_address_line_1') || '');
        setAltSenderAddress2(await getSetting('alt_sender_address_line_2') || '');
        setAltSenderSuburb(await getSetting('alt_sender_suburb') || '');
        setAltSenderState(await getSetting('alt_sender_state') || '');
        setAltSenderPostcode(await getSetting('alt_sender_postcode') || '');
        setAltSenderPhone(await getSetting('alt_sender_phone') || '');
        setAltSenderEmail(await getSetting('alt_sender_email') || '');

        setInvoicePrefix(await getSetting('invoice_prefix') || 'INV');
        setInvoiceTerms(await getSetting('invoice_terms') || 'Payment due within 14 days.');
        setInvoiceTaxRate(parseFloat(await getSetting('invoice_tax_rate')) || 10);
        setInvoiceLogoUrl(await getSetting('invoice_logo_url') || '');

        // Fetch font list for search
        const res = await fetch('https://cdn.jsdelivr.net/gh/hasinhayder/google-fonts/subsets/latin/display/fonts.json');
        const data = await res.json();
        if (data && data.fonts) {
          setAllFonts(data.fonts);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadData();
  }, []);

  // Live preview the font and dimensions when they change
  useEffect(() => {
    applyLabelFont(selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    document.documentElement.style.setProperty('--label-width', `${labelWidth}mm`);
    document.documentElement.style.setProperty('--label-height', `${labelHeight}mm`);
  }, [labelWidth, labelHeight]);

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', selectedPalette);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [selectedPalette, currentTheme]);

  const handleSave = async () => {
    try {
      await saveSetting('geoapify_api_key', apiKey);
      await saveSetting('use_geoapify', useGeoApify.toString());
      await saveSetting('label_width', labelWidth.toString());
      await saveSetting('label_height', labelHeight.toString());
      await saveSetting('label_font', selectedFont);
      await saveSetting('palette', selectedPalette);
      await saveSetting('theme', currentTheme);

      // Save Sender Details
      await saveSetting('sender_name', senderName);
      await saveSetting('sender_business_name', senderBusiness);
      await saveSetting('sender_address_line_1', senderAddress1);
      await saveSetting('sender_address_line_2', senderAddress2);
      await saveSetting('sender_suburb', senderSuburb);
      await saveSetting('sender_state', senderState);
      await saveSetting('sender_postcode', senderPostcode);
      await saveSetting('sender_phone', senderPhone);
      await saveSetting('sender_email', senderEmail);
      // Save Invoice Address Details
      await saveSetting('invoice_name', invoiceName);
      await saveSetting('invoice_business_name', invoiceBusiness);
      await saveSetting('invoice_address_line_1', invoiceAddress1);
      await saveSetting('invoice_address_line_2', invoiceAddress2);
      await saveSetting('invoice_suburb', invoiceSuburb);
      await saveSetting('invoice_state', invoiceState);
      await saveSetting('invoice_postcode', invoicePostcode);
      await saveSetting('invoice_phone', invoicePhone);
      await saveSetting('invoice_email', invoiceEmail);
      await saveSetting('invoice_website', invoiceWebsite);
      await saveSetting('invoice_abn', invoiceAbn);

      // Save Alternate Sender Details
      await saveSetting('alt_sender_name', altSenderName);
      await saveSetting('alt_sender_business_name', altSenderBusiness);
      await saveSetting('alt_sender_address_line_1', altSenderAddress1);
      await saveSetting('alt_sender_address_line_2', altSenderAddress2);
      await saveSetting('alt_sender_suburb', altSenderSuburb);
      await saveSetting('alt_sender_state', altSenderState);
      await saveSetting('alt_sender_postcode', altSenderPostcode);
      await saveSetting('alt_sender_phone', altSenderPhone);
      await saveSetting('alt_sender_email', altSenderEmail);

      await saveSetting('invoice_prefix', invoicePrefix);
      await saveSetting('invoice_terms', invoiceTerms);
      await saveSetting('invoice_tax_rate', invoiceTaxRate.toString());
      await saveSetting('invoice_logo_url', invoiceLogoUrl);

      // Update CSS variables immediately
      document.documentElement.style.setProperty('--label-width', `${labelWidth}mm`);
      document.documentElement.style.setProperty('--label-height', `${labelHeight}mm`);
      document.documentElement.setAttribute('data-palette', selectedPalette);
      document.documentElement.setAttribute('data-theme', currentTheme);
      applyLabelFont(selectedFont);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleResetLabelConfig = async () => {
    try {
      const savedWidth = await getSetting('label_width');
      if (savedWidth) setLabelWidth(parseInt(savedWidth, 10));
      else setLabelWidth(90);

      const savedHeight = await getSetting('label_height');
      if (savedHeight) setLabelHeight(parseInt(savedHeight, 10));
      else setLabelHeight(30);

      const savedFont = await getSetting('label_font');
      if (savedFont) setSelectedFont(savedFont);
      else setSelectedFont('Arial');
    } catch (error) {
      console.error('Error resetting label config:', error);
    }
  };

  const handleResetApp = async () => {
    try {
      // Save current configuration before resetting
      await saveSetting('geoapify_api_key', apiKey);
      await saveSetting('use_geoapify', useGeoApify.toString());
      await saveSetting('label_width', labelWidth.toString());
      await saveSetting('label_height', labelHeight.toString());
      await saveSetting('label_font', selectedFont);
      await saveSetting('palette', selectedPalette);
      await saveSetting('theme', currentTheme);

      // Clear data tables but keep settings
      await db.transaction('rw', [db.orders, db.csv_logs, db.daily_usage], async () => {
        await db.orders.clear();
        await db.csv_logs.clear();
        await db.daily_usage.clear();
      });
      // Optionally reset daily usage in state
      setDailyUsage(0);
      setShowResetDialog(false);
      // Hard reload to clear any memory states
      window.location.reload();
    } catch (error) {
      console.error('Error resetting app:', error);
      alert('Failed to reset application data.');
    }
  };

  const filteredFonts = fontSearch.length > 1
    ? allFonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())).slice(0, 10)
    : [];

  const usagePercentage = Math.min((dailyUsage / maxUsage) * 100, 100);
  const getUsageColor = () => {
    if (usagePercentage < 50) return 'var(--success)';
    if (usagePercentage < 85) return 'var(--warning)';
    return 'var(--danger)';
  };

  const PALETTES = [
    { id: 'indigo', name: 'Indigo Night', color: '#3b82f6' },
    { id: 'emerald', name: 'Emerald Garden', color: '#10b981' },
    { id: 'rose', name: 'Rose Petal', color: '#f43f5e' }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SettingsIcon size={28} color="var(--accent)" />
          Settings
        </h1>

        <p style={{ color: 'var(--text-secondary)' }}>Manage your application configuration and API quotas.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
        gap: '24px',
        alignItems: 'start'
      }}>
        <div className="card" style={{ height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={20} />
            API & Quotas
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Configure your Geoapify API key and monitor your daily batch processing limits.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="useGeoApify"
                checked={useGeoApify}
                onChange={(e) => setUseGeoApify(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="useGeoApify" style={{ fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', flex: 1 }}>
                Enable Geoapify Address Validation
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Geoapify API Key</label>
              <input
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!useGeoApify}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'var(--transition)',
                  opacity: useGeoApify ? 1 : 0.6
                }}
              />
            </div>

            {/* Daily Usage Section Merged Here */}
            <div style={{ marginTop: '8px', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} color="var(--accent)" />
                  API Quota Usage
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{usagePercentage.toFixed(0)}%</span>
              </div>

              <div style={{ width: '100%', backgroundColor: 'var(--border)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  width: `${usagePercentage}%`,
                  backgroundColor: getUsageColor(),
                  height: '100%',
                  transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>0</span>
                <span>{dailyUsage.toLocaleString()} used</span>
                <span>{maxUsage.toLocaleString()}</span>
              </div>
            </div>


            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start',
                transition: 'var(--transition)'
              }}
            >
              {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
              {isSaved ? 'Saved Successfully' : 'Save API Settings'}
            </button>
          </div>
        </div>

        <div className="card" style={{ height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layout size={20} />
            Theme & Appearance
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Customize the look and feel of your workspace with premium color palettes and themes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '12px' }}>Color Palette</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PALETTES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPalette(p.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid',
                      borderColor: selectedPalette === p.id ? 'var(--accent)' : 'var(--border)',
                      background: selectedPalette === p.id ? 'var(--accent-soft)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: p.color, border: '2px solid white', boxShadow: '0 0 0 1px var(--border)' }}></div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: selectedPalette === p.id ? 'var(--accent)' : 'var(--text-primary)' }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: '12px' }}>Mode</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setCurrentTheme('light')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid',
                    borderColor: currentTheme === 'light' ? 'var(--accent)' : 'var(--border)',
                    background: currentTheme === 'light' ? 'var(--accent-soft)' : 'var(--bg-primary)',
                    color: currentTheme === 'light' ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  <Sun size={18} />
                  Light
                </button>
                <button
                  onClick={() => setCurrentTheme('dark')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid',
                    borderColor: currentTheme === 'dark' ? 'var(--accent)' : 'var(--border)',
                    background: currentTheme === 'dark' ? 'var(--accent-soft)' : 'var(--bg-primary)',
                    color: currentTheme === 'dark' ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  <Moon size={18} />
                  Dark
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start',
                transition: 'var(--transition)'
              }}
            >
              {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
              {isSaved ? 'Saved Successfully' : 'Apply Appearance'}
            </button>
          </div>
        </div>

        <div className="card" style={{ height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={20} />
            Label Configuration
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Set the dimensions and typography for your thermal labels.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Label Width (mm)</label>
              <input
                type="number"
                value={labelWidth}
                onChange={(e) => setLabelWidth(parseInt(e.target.value, 10) || 0)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Label Height (mm)</label>
              <input
                type="number"
                value={labelHeight}
                onChange={(e) => setLabelHeight(parseInt(e.target.value, 10) || 0)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', padding: '16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Type size={18} color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>Label Font</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[...POPULAR_FONTS, ...(POPULAR_FONTS.includes(selectedFont) ? [] : [selectedFont])].map(font => (
                <button
                  key={font}
                  onClick={() => setSelectedFont(font)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: selectedFont === font ? 'var(--accent)' : 'var(--border)',
                    background: selectedFont === font ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: selectedFont === font ? 'white' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    fontFamily: font === 'Arial' ? 'Arial' : `'${font}', sans-serif`
                  }}
                >
                  {font}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Search all Google Fonts..."
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    width: '100%',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {filteredFonts.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 10,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '4px',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {filteredFonts.map(font => (
                    <div
                      key={font}
                      onClick={() => {
                        setSelectedFont(font);
                        setFontSearch('');
                      }}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        transition: 'var(--transition)',
                        fontFamily: `'${font}', sans-serif`
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {font}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Selected:</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: `'${selectedFont}', sans-serif` }}>{selectedFont}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
            >
              {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
              {isSaved ? 'Saved Successfully' : 'Save Label Config'}
            </button>

            <button
              onClick={() => setShowPreviewDialog(true)}
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Eye size={18} />
              Preview Label
            </button>

            <button
              onClick={handleResetLabelConfig}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid transparent',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'var(--transition)',
                marginLeft: 'auto'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'var(--bg-primary)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
        <div className="card" style={{ height: '100%', gridColumn: 'span 1' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={20} />
            Sender Details (AusPost)
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
            These details will be used as the 'From' address in the AusPost import file.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sender Name</label>
                <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Full Name" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Business Name</label>
                <input type="text" value={senderBusiness} onChange={e => setSenderBusiness(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Optional" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 1</label>
              <input type="text" value={senderAddress1} onChange={e => setSenderAddress1(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Street Address" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 2</label>
              <input type="text" value={senderAddress2} onChange={e => setSenderAddress2(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Apartment, suite, etc." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Suburb</label>
                <input type="text" value={senderSuburb} onChange={e => setSenderSuburb(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>State</label>
                <input type="text" value={senderState} onChange={e => setSenderState(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Postcode</label>
                <input type="text" value={senderPostcode} onChange={e => setSenderPostcode(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phone Number</label>
                <input type="text" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
                transition: 'var(--transition)'
              }}
            >
              {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
              Save Sender Details
            </button>
          </div>
        </div>

        <div className="card" style={{ height: '100%', gridColumn: 'span 1' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={20} />
            Alternate Sender Address (ACT)
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
            If filled in, this address will replace the primary sender when the shipping destination state is <strong>ACT</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sender Name</label>
                <input type="text" value={altSenderName} onChange={e => setAltSenderName(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Full Name" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Business Name</label>
                <input type="text" value={altSenderBusiness} onChange={e => setAltSenderBusiness(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Optional" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 1</label>
              <input type="text" value={altSenderAddress1} onChange={e => setAltSenderAddress1(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Street Address" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 2</label>
              <input type="text" value={altSenderAddress2} onChange={e => setAltSenderAddress2(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Apartment, suite, etc." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Suburb</label>
                <input type="text" value={altSenderSuburb} onChange={e => setAltSenderSuburb(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>State</label>
                <input type="text" value={altSenderState} onChange={e => setAltSenderState(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Postcode</label>
                <input type="text" value={altSenderPostcode} onChange={e => setAltSenderPostcode(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phone Number</label>
                <input type="text" value={altSenderPhone} onChange={e => setAltSenderPhone(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                <input type="email" value={altSenderEmail} onChange={e => setAltSenderEmail(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
                transition: 'var(--transition)'
              }}
            >
              {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
              Save Alternate Sender
            </button>
          </div>
        </div>

        <div className="card" style={{ height: '100%' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} />
            Invoice Settings
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
            Configure invoice defaults, tax rate, and logo for printed invoices.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Invoice Prefix</label>
              <input type="text" value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="INV" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tax Rate (%)</label>
              <input type="number" value={invoiceTaxRate} onChange={e => setInvoiceTaxRate(parseFloat(e.target.value) || 0)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="10" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sender Name</label>
                <input type="text" value={invoiceName} onChange={e => setInvoiceName(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Full Name" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Business Name</label>
                <input type="text" value={invoiceBusiness} onChange={e => setInvoiceBusiness(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Optional" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 1</label>
              <input type="text" value={invoiceAddress1} onChange={e => setInvoiceAddress1(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Street Address" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Address Line 2</label>
              <input type="text" value={invoiceAddress2} onChange={e => setInvoiceAddress2(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Apartment, suite, etc." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Suburb</label>
                <input type="text" value={invoiceSuburb} onChange={e => setInvoiceSuburb(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>State</label>
                <input type="text" value={invoiceState} onChange={e => setInvoiceState(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Postcode</label>
                <input type="text" value={invoicePostcode} onChange={e => setInvoicePostcode(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Phone Number</label>
                <input type="text" value={invoicePhone} onChange={e => setInvoicePhone(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                <input type="email" value={invoiceEmail} onChange={e => setInvoiceEmail(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Website URL</label>
              <input type="url" value={invoiceWebsite} onChange={e => setInvoiceWebsite(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="e.g. www.mystore.com" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>ABN</label>
              <input type="text" value={invoiceAbn} onChange={e => setInvoiceAbn(e.target.value)} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="e.g. 12 345 678 901" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Invoice Terms</label>
              <textarea value={invoiceTerms} onChange={e => setInvoiceTerms(e.target.value)} rows={4} style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Invoice Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {invoiceLogoUrl && (
                  <div style={{ background: '#fff', padding: '4px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    <img src={invoiceLogoUrl} alt="Logo Preview" style={{ maxWidth: 120, maxHeight: 48, objectFit: 'contain', display: 'block' }} />
                  </div>
                )}
                <label style={{ cursor: 'pointer', padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', transition: 'var(--transition)' }}>
                  Upload Image
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setInvoiceLogoUrl(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
                {invoiceLogoUrl && (
                  <button onClick={() => setInvoiceLogoUrl('')} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '8px' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleSave}
            style={{
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'var(--transition)'
            }}
          >
            {isSaved ? <CheckCircle size={18} /> : <Save size={18} />}
            Save Invoice Defaults
          </button>
        </div>

        {isAdmin && <EbayHeaderSettings />}

        {isAdmin && (
          <div className="card" style={{ borderTop: '4px solid var(--danger)', height: '100%' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)' }}>
              <Trash2 size={20} />
              Danger Zone
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Wipe all transaction data, including uploaded batches, orders, and processing history.
              Your <strong>API configuration</strong> and <strong>visual preferences</strong> will be automatically saved and preserved.
            </p>

            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(254, 226, 226, 0.65)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)' }}>Sample Invoice Data</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Load a ready-made invoice dataset with items and prices for testing.
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{sampleInvoiceCount} records</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={loadSampleInvoiceData}
                  style={{
                    background: 'var(--danger)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  Load Sample Invoice Data
                </button>
                <button
                  onClick={clearSampleInvoiceData}
                  style={{
                    background: 'transparent',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition)'
                  }}
                >
                  Clear Sample Data
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowResetDialog(true)}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                padding: '12px 20px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'var(--transition)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
            >
              <Trash2 size={18} />
              Reset Application Data
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showResetDialog}
        onCancel={() => setShowResetDialog(false)}
        onConfirm={handleResetApp}
        title="Reset Application Data?"
        message="This will permanently delete all uploaded batches, orders, and usage logs. Your current API key, theme, and label configurations will be saved and preserved. This action cannot be undone."
        confirmText="Yes, Reset Data"
        cancelText="Cancel"
        type="danger"
      />

      <PreviewDialog
        isOpen={showPreviewDialog}
        onClose={() => setShowPreviewDialog(false)}
        selectedFont={selectedFont}
        labelWidth={labelWidth}
        labelHeight={labelHeight}
      />
    </div>
  );
}

