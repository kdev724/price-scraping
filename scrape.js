const axios = require('axios');
const path = require('path');

// Serve dashboard.html at the root URL


// GraphQL endpoint
const GQL_URL = 'https://gql.reverb.com/graphql';

// List of pedals to search for (as slugs)
// const pedals = [
//   {name:"Boss BD-2 Blues Driver", value:"Very good"},
//   {name:"Boss TU-3 Chromatic Tuner", value:"Excellent"},
//   {name:"Boss DS-1 Distortion", value:"Excellent"},
//   {name:"Boss RC-1 Loop Station", value:"Excellent"},
//   {name:"Boss Loop Station", value:"Excellent"},
// ];

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from /public (Heroku compatible)
app.use(express.static(path.join(__dirname, 'public')));
console.log(path.join(__dirname, 'public'))
// Default route serves dashboard.html from /public
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.post('/price', async (req, res) => {
  try {
    // Defensive: support both JSON and urlencoded
    let pedals = [];
    if (req.body && Array.isArray(req.body.pedals)) {
      pedals = req.body.pedals;
    } else if (req.body && typeof req.body.pedals === 'string') {
      try { pedals = JSON.parse(req.body.pedals); } catch {}
    }
    if (!Array.isArray(pedals) || pedals.length === 0) {
      return res.status(400).json({ error: 'No pedals provided' });
    }
    const results = [];
    // Map of condition value to UUID (add more as needed)
    const conditionUuidMap = {
      'brand new': 'b7b7b7b7-7b7b-7b7b-7b7b-b7b7b7b7b7b7',
      'mint': 'b7b7b7b7-7b7b-7b7b-7b7b-b7b7b7b7b7b7',
      'Excellent': 'df268ad1-c462-4ba6-b6db-e007e23922ea',
      'ery good': 'ae4d9114-1bd7-4ec5-a4ba-6653af5ac84d',
      'good': 'b2e1e6e2-7e3b-4e7e-8e2e-7e3b4e7e8e2e',
      'fair': 'b2e1e6e2-7e3b-4e7e-8e2e-7e3b4e7e8e2e',
      'poor': 'b2e1e6e2-7e3b-4e7e-8e2e-7e3b4e7e8e2e',
    };
    // pedals already set above
    for (let pedal of pedals) {
      // Convert pedal name to slug
      const slug = pedal.name.toLowerCase().replace(/"/g, '').replace(/\s+/g, '-');
      const conditionValue = (pedal.condition || '').toLowerCase();
      const conditionUuid = conditionUuidMap[conditionValue] || conditionUuidMap['Excellent'];
      const query = `query Core_PriceGuideToolFormContainer($cspSlug: String) {\n  csp(input: {slug: $cspSlug}) {\n    _id\n    ...PriceGuideToolFormContainerData\n    __typename\n  }\n}\n\nfragment PriceGuideToolFormContainerData on CSP {\n  _id\n  id\n  title\n  brand {\n    _id\n    id\n    name\n    __typename\n  }\n  categoryRootUuid\n  categoryUuids\n  image(input: {transform: \"card_square\"}) {\n    _id\n    source\n    __typename\n  }\n  canonicalProducts {\n    _id\n    id\n    finish\n    model\n    name\n    year\n    __typename\n  }\n  slug\n  __typename\n}`;
      const variables = { cspSlug: slug };
      const response = await axios.post(GQL_URL, {
        operationName: "Core_PriceGuideToolFormContainer",
        query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      const csp = response.data?.data?.csp;
      if (csp && csp.canonicalProducts && csp.canonicalProducts.length) {
        const canonicalProductId = csp.canonicalProducts[0].id;
        const countryCode = 'US';
        const priceQuery = {
          operationName: "DataServices_PriceGuideToolEstimatesContainer",
          query: `query DataServices_PriceGuideToolEstimatesContainer($priceRecommendationQueries: [Input_reverb_pricing_PriceRecommendationQuery]) {\n  priceRecommendations(\n    input: {priceRecommendationQueries: $priceRecommendationQueries}\n  ) {\n    priceRecommendations {\n      priceLow {\n        amountCents\n        currency\n        __typename\n      }\n      priceMiddle {\n        amountCents\n        currency\n        __typename\n      }\n      priceHigh {\n        amountCents\n        currency\n        __typename\n      }\n      priceMiddleThirtyDaysAgo {\n        amountCents\n        currency\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}`,
          variables: {
            priceRecommendationQueries: [
              {
                canonicalProductId,
                conditionUuid,
                countryCode
              }
            ]
          }
        };
        const priceResponse = await axios.post(GQL_URL, priceQuery, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        const priceData = priceResponse.data?.data?.priceRecommendations?.priceRecommendations?.[0];
        results.push({
          pedal: csp.title,
          brand: csp.brand?.name,
          productId: canonicalProductId,
          condition: pedal.condition,
          priceLow: priceData ? (priceData.priceLow.amountCents/100) : null,
          priceMiddle: priceData ? (priceData.priceMiddle.amountCents/100) : null,
          priceHigh: priceData ? (priceData.priceHigh.amountCents/100) : null,
          priceMiddleThirtyDaysAgo: priceData && priceData.priceMiddleThirtyDaysAgo ? (priceData.priceMiddleThirtyDaysAgo.amountCents/100) : null,
          currency: priceData ? priceData.priceLow.currency : null
        });
      } else {
        // If not found, just display Not Found for that row, and do not write Adjusted Value
        results.push({
          pedal: pedal.name,
          brand: 'Not Found',
          productId: 'Not Found',
          condition: pedal.condition,
          priceLow: 'Not Found',
          priceMiddle: 'Not Found',
          priceHigh: 'Not Found',
          priceMiddleThirtyDaysAgo: 'Not Found',
          currency: 'Not Found',
          notFound: true
        });
      }
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const ACCESS_TOKEN = '6374723c7c2cafff705e62cbfdbb3ea36d247f24274eced55843d49cb2c62517';

const PRODUCTS = [
  'Boss RC-3 Loop Station',
];

function normalizeWords(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '') // remove dashes and symbols
    .split(' ')
    .filter(Boolean); // remove empty strings
}
async function fetchListings() {
  try {
    const res = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      headers: {
        Authorization: `Bearer Your Token`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json'
      },
      params: {
        q: "'Boss RC-3'",
        limit: 10
      }
    });

    const items = res.data.itemSummaries;
    if (!items || items.length === 0) {
      console.log('No results found.');
      return;
    }

    items.forEach((item, index) => {
      console.log(`\n#${index + 1}`);
      console.log('Title:', item.title);
      console.log('Price:', item.price.value, item.price.currency);
      console.log('Condition:', item.condition);
      console.log('Link:', item.itemWebUrl);
    });
  } catch (error) {
    console.error('❌ Search Error:', error.response?.data || error.message);
  }
}

fetchListings();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
