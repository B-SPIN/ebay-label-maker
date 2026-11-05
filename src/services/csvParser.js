import Papa from 'papaparse';
import { DEFAULT_HEADER_MAP, headerAliases, pickHeader } from './ebayHeaders.js';

// headerMap: eBay header names to read (see ebayHeaders.js); defaults to the standard names.
export const parseEbayCsv = (fileOrString, headerMap = DEFAULT_HEADER_MAP) => {
  const get = (item, key) => pickHeader(item, headerMap, key);
  const markerAliases = headerAliases(headerMap, 'salesRecordNumber');
  const orderAliases = headerAliases(headerMap, 'orderNumber');

  return new Promise((resolve, reject) => {
    Papa.parse(fileOrString, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        try {
          const rawData = results.data;

          // Find the actual header row index (eBay CSVs often have empty/junk rows at the top)
          let headerIndex = -1;
          for (let i = 0; i < rawData.length; i++) {
            if (markerAliases.includes(rawData[i][0]) || orderAliases.some(a => rawData[i].includes(a))) {
              headerIndex = i;
              break;
            }
          }

          if (headerIndex === -1) {
            throw new Error('Could not find header row in CSV');
          }

          const headers = rawData[headerIndex];
          const rows = rawData.slice(headerIndex + 1);

          // Build objects
          const items = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header ? header.trim() : `Col${index}`] = row[index] ? row[index].trim() : '';
            });
            return obj;
          });

          // 1. Group by Order Number to establish order baseline and collect all items inside it
          const ordersMap = new Map();

          for (const item of items) {
            const orderNum = get(item, 'orderNumber');
            if (!orderNum || orderNum.includes('record(s) downloaded') || orderNum.includes('Seller ID')) continue;

            if (!ordersMap.has(orderNum)) {
              ordersMap.set(orderNum, {
                orderNumber: orderNum,
                buyerUsername: get(item, 'buyerUsername'),
                buyerName: get(item, 'buyerName'),
                postToName: get(item, 'shipToName'),
                phone: get(item, 'phone'),
                address1: get(item, 'address1'),
                address2: get(item, 'address2'),
                city: get(item, 'city'),
                state: get(item, 'state'),
                postcode: get(item, 'postcode'),
                country: get(item, 'country'),
                postageService: get(item, 'postageService'),
                items: [],
                buyerNote: get(item, 'buyerNote'),
                // Single-row orders have the item on the same line as the address
                // Multi-row orders have address on first line, items on subsequent lines
              });
            }

            const order = ordersMap.get(orderNum);

            // Sometimes the first row of a multi-item order has the postage service, we don't want to overwrite it with empty strings
            if (!order.postageService && get(item, 'postageService')) {
              order.postageService = get(item, 'postageService');
            }
            if (!order.buyerUsername && get(item, 'buyerUsername')) {
              order.buyerUsername = get(item, 'buyerUsername');
            }
            if (!order.phone && get(item, 'phone')) {
              order.phone = get(item, 'phone');
            }
            if (!order.address1 && get(item, 'address1')) {
              order.address1 = get(item, 'address1');
              order.address2 = get(item, 'address2');
              order.city = get(item, 'city');
              order.state = get(item, 'state');
              order.postcode = get(item, 'postcode');
              order.postToName = get(item, 'shipToName');
            }

            const customLabel = get(item, 'customLabel');
            const quantity = parseInt(get(item, 'quantity'), 10) || 1;

            if (customLabel) {
              order.items.push({ customLabel, quantity });
            } else if (get(item, 'itemTitle') && !get(item, 'itemTitle').includes('record(s) downloaded') && !get(item, 'itemTitle').includes('Seller ID :')) {
              // Fallback to title if no custom label
              order.items.push({ customLabel: get(item, 'itemTitle'), quantity });
            }
          }

          // Generate base grouped orders
          let parsedOrders = Array.from(ordersMap.values());

          // 2 & 3: Consolidate items into SKU formats string, and merge distinct orders 
          // if Post to ame and Address match.
          const consolidatedMap = new Map();
          const resultsArray = [];

          for (const order of parsedOrders) {
            const orderItems = order.items.map(i => ({ sku: i.customLabel, quantity: i.quantity }));

            if (order.postageService !== "Australia Post Domestic Regular Letter Untracked") {
              // Manual processing orders (non-letter)
              resultsArray.push({
                orderIds: order.orderNumber,
                buyerUsername: order.buyerUsername,
                name: order.postToName,
                phone: order.phone || '',
                address1: order.address1,
                address2: order.address2,
                city: order.city,
                state: order.state,
                postcode: order.postcode,
                country: order.country,
                items: orderItems,
                itemsSummary: orderItems.map(i => `${i.sku} X <b>${i.quantity}</b>`).join('<br/>'),
                manualFlag: true,
                postageService: order.postageService,
                buyerNote: order.buyerNote,
                isExtra: false
              });
              continue;
            }

            const rawAddress = [order.address2, order.city, order.state, order.postcode].filter(Boolean).join(', ').toLowerCase();
            const mergeKey = `${order.postToName}-${rawAddress}`;

            if (consolidatedMap.has(mergeKey)) {
              const existing = consolidatedMap.get(mergeKey);
              existing.orderNumbers.push(order.orderNumber);
              existing.combinedItems.push(...orderItems);
              // Also merge buyer notes if they differ
              if (order.buyerNote && !existing.buyerNote.includes(order.buyerNote)) {
                existing.buyerNote = existing.buyerNote ? `${existing.buyerNote} | ${order.buyerNote}` : order.buyerNote;
              }
              // Keep first non-empty phone
              if (!existing.phone && order.phone) {
                existing.phone = order.phone;
              }
            } else {
              consolidatedMap.set(mergeKey, {
                orderNumbers: [order.orderNumber],
                buyerUsername: order.buyerUsername,
                postToName: order.postToName,
                phone: order.phone || '',
                address1: order.address1,
                address2: order.address2,
                city: order.city,
                state: order.state,
                postcode: order.postcode,
                country: order.country,
                combinedItems: [...orderItems],
                buyerNote: order.buyerNote || ''
              });
            }
          }

          // Final output formatting for consolidated (Untracked Letters)
          for (const [key, merged] of consolidatedMap.entries()) {
            resultsArray.push({
              orderIds: merged.orderNumbers.join(', '),
              buyerUsername: merged.buyerUsername,
              name: merged.postToName,
              phone: merged.phone || '',
              address1: merged.address1,
              address2: merged.address2,
              city: merged.city,
              state: merged.state,
              postcode: merged.postcode,
              country: merged.country,
              items: merged.combinedItems,
              itemsSummary: merged.combinedItems.map(i => `${i.sku} X <b>${i.quantity}</b>`).join('<br/>'),
              buyerNote: merged.buyerNote,
              isExtra: false
            });
          }


          resolve(resultsArray);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};
