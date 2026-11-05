// eBay CSV header names used by the importers. Pure module (no DB) so it can be used from node tests.
// Each value is a comma-separated list of accepted header names (first non-empty match wins),
// so old and new eBay exports can both be read. Admins can override these in Settings.
export const EBAY_FIELDS = [
  { key: 'salesRecordNumber', label: 'Header row marker (first column)', defaults: 'Sales Record Number' },
  { key: 'orderNumber', label: 'Order number', defaults: 'Order Number' },
  { key: 'buyerUsername', label: 'Buyer username', defaults: 'Buyer Username' },
  { key: 'buyerName', label: 'Buyer name', defaults: 'Buyer Name' },
  { key: 'buyerEmail', label: 'Buyer email', defaults: 'Buyer Email' },
  { key: 'buyerNote', label: 'Buyer note', defaults: 'Buyer Note' },
  { key: 'shipToName', label: 'Ship to name', defaults: 'Ship To Name, Post To Name' },
  { key: 'phone', label: 'Ship to phone', defaults: 'Ship To Phone, Post To Phone' },
  { key: 'address1', label: 'Ship to address 1', defaults: 'Ship To Address 1, Post To Address 1' },
  { key: 'address2', label: 'Ship to address 2', defaults: 'Ship To Address 2, Post To Address 2' },
  { key: 'city', label: 'Ship to city', defaults: 'Ship To City, Post To City' },
  { key: 'state', label: 'Ship to state', defaults: 'Ship To State, Post To State' },
  { key: 'postcode', label: 'Ship to postcode', defaults: 'Ship To Postcode, Ship To Postal Code, Post To Postal Code' },
  { key: 'country', label: 'Ship to country', defaults: 'Ship To Country, Post To Country' },
  { key: 'postageService', label: 'Postage service', defaults: 'Shipping Service, Postage Service' },
  { key: 'customLabel', label: 'Custom label (SKU)', defaults: 'Custom Label' },
  { key: 'itemTitle', label: 'Item title', defaults: 'Item Title' },
  { key: 'quantity', label: 'Quantity', defaults: 'Quantity' }
];

export const DEFAULT_HEADER_MAP = Object.fromEntries(EBAY_FIELDS.map(f => [f.key, f.defaults]));

// Saved overrides win; blank or missing fields fall back to the defaults.
export const mergeHeaderMap = (saved) => {
  const map = { ...DEFAULT_HEADER_MAP };
  Object.entries(saved || {}).forEach(([key, value]) => {
    if (key in map && typeof value === 'string' && value.trim()) map[key] = value;
  });
  return map;
};

export const headerAliases = (map, key) =>
  (map[key] || '').split(',').map(s => s.trim()).filter(Boolean);

// Value of the first alias present (and non-empty) on a row keyed by exact header text.
export const pickHeader = (row, map, key) => {
  for (const alias of headerAliases(map, key)) {
    if (row[alias]) return row[alias];
  }
  return '';
};
