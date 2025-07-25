// Function to scrape brands from https://reverb.com/brands

// Endpoint to fetch all brands from Reverb
// Endpoint to fetch available brands from Reverb

const axios = require("axios");
const path = require("path");
const mongoose = require('mongoose');
const Pedal = require('./model/pedals.mdl');
const cheerio = require("cheerio");
// Serve dashboard.html at the root URL
// GraphQL endpoint
const MONGO_URI = 'mongodb://localhost:27017/prices';

mongoose.connect(MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
	console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
	console.error('MongoDB connection error:', err);
});


const express = require("express");
const app = express();
const PORT = process.env.PORT || 80;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from /public (Heroku compatible)
app.use(express.static(path.join(__dirname, "public")));
console.log(path.join(__dirname, "public"));
// Default route serves dashboard.html from /public
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
// New /search endpoint for Reverb Combined Marketplace Search
app.post("/initial", async (req, res) => {
	fetchListings(req, res);

	// Pedal.deleteMany({}).then(() => {
	// 	fetchListings(req, res);
	// });
})

app.post("/search", async (req, res) => {
	let pedals = [];
	if (req.body && Array.isArray(req.body.pedals)) {
		pedals = req.body.pedals;
	} else if (req.body && typeof req.body.pedals === "string") {
		try {
			pedals = JSON.parse(req.body.pedals);
		} catch { }
	}
	var titles = [];
	pedals.forEach((pedal) => {
		titles.push(pedal.name);
	});
	console.log(pedals)
	Pedal.find({
		$or: [
			{ title: { $in: titles } }, // exact match
			...titles.map(pedal => ({
				title: { $regex: pedal, $options: "i" } // case-insensitive substring match
			}))
		]
	})
		.then((foundPedals) => {
			if (foundPedals.length > 0) {
				var products = []
				foundPedals.forEach((item, i) => {
					var pedal = pedals.find(p => item.title.toLowerCase().includes(p.name.toLowerCase()));
					if (!pedal) return;
					if (item.condition.display_name.toLocaleLowerCase() === pedal.condition.toLocaleLowerCase()) {
						products.push({
							id: i + 1,
							title: item.title,
							brand: item.brand,
							productId: item.productId,
							price: item.price,
							condition: item.condition,
							url: item.url,
							photos: item.photos
						});
					}
				});
				return res.json({ products });
			} else {
				return res.status(404).json({ error: "No pedals found" });
			}
		})
		.catch((err) => {
			console.error("Error fetching pedals:", err);
			return res.status(500).json({ error: "Internal server error" });
		});
});

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const { title } = require("process");
async function scrapeBrandsFromWeb() {
	const brands = require('fs').readFileSync('brands_debug.txt', 'utf8');
	return JSON.parse(brands);
}
async function scrapeBrandsFromWeb1() {
	console.log('🚀 Starting Ubuntu-compatible Puppeteer scraper...');
	
	// Ubuntu-specific browser configuration
	const browser = await puppeteer.launch({
	  headless: true, // Must be true on Ubuntu
	  slowMo: 200,
	  args: [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--no-first-run',
		'--no-zygote',
		'--single-process',
		'--disable-extensions',
		'--disable-background-timer-throttling',
		'--disable-backgrounding-occluded-windows',
		'--disable-renderer-backgrounding',
		'--disable-features=TranslateUI',
		'--disable-ipc-flooding-protection',
		'--disable-web-security',
		'--disable-features=VizDisplayCompositor',
		'--window-size=1920,1080',
		'--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
	  ]
	});
  
	const page = await browser.newPage();
	
	// Ubuntu-specific page settings
	await page.setViewport({ width: 1920, height: 1080 });
	await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
	
	// Block unnecessary resources for faster loading
	await page.setRequestInterception(true);
	page.on('request', (req) => {
	  const resourceType = req.resourceType();
	  if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
		req.abort();
	  } else {
		req.continue();
	  }
	});
  
	console.log('🌐 Navigating to Reverb brands page...');
	
	try {
	  // Navigate with better wait strategy for Ubuntu
	  await page.goto('https://reverb.com/brands', {
		waitUntil: 'networkidle2', // Better for Ubuntu
		timeout: 60000,
	  });
	  
	  console.log('✅ Page loaded successfully');
	  
	  // Wait longer for dynamic content on Ubuntu
	  console.log('⏳ Waiting for dynamic content...');
	  await new Promise(resolve => setTimeout(resolve, 5000))
	  
	  let brands = [];
	  
	  console.log('�� Strategy 1: Trying original selector...');
	  try {
		await page.waitForSelector('.brands-index__all-brands__section__column a', { timeout: 5000 });
		
		brands = await page.evaluate(() => {
		  const elements = document.querySelectorAll('.brands-index__all-brands__section__column a');
		  return Array.from(elements).map(el => ({
			name: el.textContent.trim(),
			url: el.href.startsWith('http') ? el.href : `https://reverb.com${el.getAttribute('href')}`
		  })).filter(brand => brand.name && brand.name.length > 0);
		});
		
		if (brands.length > 0) {
		  console.log(`✅ Strategy 1 success! Found ${brands.length} brands`);
		}
	  } catch (e) {
		console.log('❌ Strategy 1 failed:', e.message);
	  }
	  
	  // STRATEGY 2: Try alternative selectors
	  if (brands.length === 0) {
		console.log('�� Strategy 2: Trying alternative selectors...');
		const selectors = [
		  '.brands-index a',
		  '.brands-index__all-brands a',
		  '.brands-index__section a',
		  'a[href*="/brands/"]',
		  'a[href*="/c/"]'
		];
		
		for (const selector of selectors) {
		  try {
			console.log(`  Trying: ${selector}`);
			await page.waitForSelector(selector, { timeout: 3000 });
			
			brands = await page.evaluate((sel) => {
			  const elements = document.querySelectorAll(sel);
			  return Array.from(elements).map(el => ({
				name: el.textContent.trim(),
				url: el.href.startsWith('http') ? el.href : `https://reverb.com${el.getAttribute('href')}`
			  })).filter(brand => brand.name && brand.name.length > 0 && brand.name.length < 100);
			}, selector);
			
			if (brands.length > 0) {
			  console.log(`✅ Strategy 2 success! Found ${brands.length} brands with ${selector}`);
			  break;
			}
		  } catch (e) {
			console.log(`  ❌ Failed: ${selector}`);
			continue;
		  }
		}
	  }
	  
	  // STRATEGY 3: Generic link analysis
	  if (brands.length === 0) {
		console.log('🔍 Strategy 3: Generic link analysis...');
		
		brands = await page.evaluate(() => {
		  const allLinks = Array.from(document.querySelectorAll('a'));
		  console.log(`Total links found: ${allLinks.length}`);
		  
		  const brandLinks = allLinks.filter(link => {
			const href = link.href;
			const text = link.textContent.trim();
			
			return href && 
				   href.includes('reverb.com') && 
				   (href.includes('/brands/') || 
					href.includes('/c/') || 
					href.includes('/make/')) &&
				   text.length > 0 && 
				   text.length < 50 &&
				   !text.includes('http') &&
				   !text.includes('www') &&
				   !text.includes('@');
		  });
		  
		  console.log(`Brand-like links found: ${brandLinks.length}`);
		  
		  return brandLinks.map(link => ({
			name: link.textContent.trim(),
			url: link.href
		  }));
		});
		
		console.log(`✅ Strategy 3 found ${brands.length} potential brands`);
	  }
	  
	  // STRATEGY 4: Text content analysis
	  if (brands.length === 0) {
		console.log('🔍 Strategy 4: Text content analysis...');
		
		brands = await page.evaluate(() => {
		  const bodyText = document.body.innerText;
		  
		  const commonBrands = [
			'BOSS', 'Fender', 'Gibson', 'Ibanez', 'Yamaha', 'Roland', 'Korg', 'Moog', 'TC Electronic',
			'Electro-Harmonix', 'MXR', 'Dunlop', 'Ernie Ball', 'D\'Addario', 'Seymour Duncan',
			'EMG', 'DiMarzio', 'PRS', 'ESP', 'Jackson', 'Schecter', 'Gretsch', 'Epiphone',
			'Squier', 'Peavey', 'Marshall', 'Vox', 'Orange', 'Mesa Boogie', 'Fractal Audio',
			'Line 6', 'Zoom', 'DigiTech', 'Eventide', 'Strymon', 'Chase Bliss',
			'EarthQuaker Devices', 'Walrus Audio', 'JHS', 'Wampler', 'Keeley', 'Fulltone'
		  ];
		  
		  const foundBrands = [];
		  
		  commonBrands.forEach(brand => {
			if (bodyText.toLowerCase().includes(brand.toLowerCase())) {
			  foundBrands.push({
				name: brand,
				url: `https://reverb.com/brands/${brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`
			  });
			}
		  });
		  
		  return foundBrands;
		});
		
		console.log(`✅ Strategy 4 found ${brands.length} common brands`);
	  }
	  
	  // FINAL FALLBACK: Hardcoded brands
	  if (brands.length === 0) {
		console.log('⚠️ All strategies failed, using hardcoded fallback brands...');
		
		brands = [
		  { name: 'BOSS', url: 'https://reverb.com/brands/boss' },
		  { name: 'Fender', url: 'https://reverb.com/brands/fender' },
		  { name: 'Gibson', url: 'https://reverb.com/brands/gibson' },
		  { name: 'Ibanez', url: 'https://reverb.com/brands/ibanez' },
		  { name: 'Yamaha', url: 'https://reverb.com/brands/yamaha' },
		  { name: 'Roland', url: 'https://reverb.com/brands/roland' },
		  { name: 'Korg', url: 'https://reverb.com/brands/korg' },
		  { name: 'Moog', url: 'https://reverb.com/brands/moog' },
		  { name: 'TC Electronic', url: 'https://reverb.com/brands/tc-electronic' },
		  { name: 'Electro-Harmonix', url: 'https://reverb.com/brands/electro-harmonix' },
		  { name: 'MXR', url: 'https://reverb.com/brands/mxr' },
		  { name: 'Dunlop', url: 'https://reverb.com/brands/dunlop' },
		  { name: 'Ernie Ball', url: 'https://reverb.com/brands/ernie-ball' },
		  { name: 'Seymour Duncan', url: 'https://reverb.com/brands/seymour-duncan' },
		  { name: 'EMG', url: 'https://reverb.com/brands/emg' },
		  { name: 'DiMarzio', url: 'https://reverb.com/brands/dimarzio' },
		  { name: 'PRS', url: 'https://reverb.com/brands/prs' },
		  { name: 'ESP', url: 'https://reverb.com/brands/esp' },
		  { name: 'Jackson', url: 'https://reverb.com/brands/jackson' },
		  { name: 'Schecter', url: 'https://reverb.com/brands/schecter' }
		];
		
		console.log('✅ Using fallback brands');
	  }
	  
	  await browser.close();
	  console.log(`�� Scraping completed. Found ${brands.length} brands.`);
	  
	  // Log the first few brands found
	  if (brands.length > 0) {
		console.log('📋 Sample brands found:');
		brands.slice(0, 5).forEach((brand, index) => {
		  console.log(`  ${index + 1}. ${brand.name} - ${brand.url}`);
		});
	  }
	  
	  return brands;
	  
	} catch (error) {
	  console.error('❌ Error during scraping:', error);
	  
	  try {
		await page.screenshot({ path: 'error_debug.png', fullPage: true });
		console.log('📸 Error screenshot saved as error_debug.png');
	  } catch (screenshotError) {
		console.error('Failed to take error screenshot:', screenshotError);
	  }
	  
	  await browser.close();
	  
	  // Return fallback brands even on error
	  console.log('�� Returning fallback brands due to error...');
	  return [
		{ name: 'BOSS', url: 'https://reverb.com/brands/boss' },
		{ name: 'Fender', url: 'https://reverb.com/brands/fender' },
		{ name: 'Gibson', url: 'https://reverb.com/brands/gibson' },
		{ name: 'Ibanez', url: 'https://reverb.com/brands/ibanez' },
		{ name: 'Yamaha', url: 'https://reverb.com/brands/yamaha' }
	  ];
	}
  }

const accessToken = '0e5ce3b5378045fd27810212c28ad211ae420fa5515a0a56aded4b9fd402cbd0';

var traitValues = {
	"art-and-lutherie--11094": "art-and-lutherie",
	"b-c-rich--47": "b-c-rich",
	"g-and-l--11094": "g-and-l",
}
const getProducts = async (brand) => {
	let brandName = brand.url.split('/').pop();
	// if (!brand.name.includes(" ")) {
	// 	brandName = brand.name.toLocaleLowerCase();
	// }
	brandName = brandName.split("--")[0];
	console.log('🎸 Brands Found:', brandName);
	var page = 0, total = 0, priceQuery = [], step = 0;
	var testResponse = await axios.get('https://api.reverb.com/api/listings', {
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Accept': 'application/hal+json',
			'Content-Type': 'application/json',
			'Accept-Version': '3.0'
		},
		params: {
			make: brandName,   // You can change this
			page: page + 1,
			per_page: 50              // Max 100 per page
		}
	})
	
	console.log(testResponse.data.total)
	if (testResponse.data.total == 0) {
		step--;
	}
	if (testResponse.data.total >= 20000) {
		priceQuery = [{ price_min: 0, price_max: 10 }, { price_min: 10.001, price_max: 20 }, { price_min: 20.001, price_max: 50 }, { price_min: 50.001, price_max: 100 }, { price_min: 100.001, price_max: 200 }, { price_min: 200.001, price_max: 10000 }]
		step = priceQuery.length - 1;
		console.log("Step 1: Price range set to 0-150");
	}
	while (step >= 0) {
		while ((page == 0 || page * 50 < total) && page < 400) {
			var response = await axios.get('https://api.reverb.com/api/listings', {
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Accept': 'application/hal+json',
					'Content-Type': 'application/json',
					'Accept-Version': '3.0'
				},
				params: {
					make: brandName,   // You can change this
					page: page + 1,
					per_page: 50,
					...priceQuery[priceQuery.length - step - 1]
				}
			})
			var total = response.data.total
			const listings = response.data.listings;
			listings.forEach(item => {
				const title = item.title;
				const newPedal = new Pedal({
					title,
					brand: item.brand,
					productId: item.id,
					price: item.price,
					condition: item.condition,
					url: item._links.web.href,
					photos: item.photos.map(photo => photo.url),
				});
				newPedal.save();
			});
			if (total > page * 50) {
				console.log(total - page * 50, page);
				page++;
				// fetchListings();
			}
		}
		page = 0;
		step--;
	}

}
const fetchListings = async (req, res) => {
	try {
		let brands = await scrapeBrandsFromWeb();
		let flag = 0;
		for (const brand of brands) {
			// await getProducts(brand);
			if (brand.name == "Coveramp") {
				flag = 1;
			}
			if (flag == 1) {
				await getProducts(brand);
			}
		}
		res.json({brands});
	} catch (error) {
		console.error('API Error:', error.response?.data || error.message);
	}
};
const getCategories = async (listings) => {
	const res = await fetch('https://api.reverb.com/api/categories/flat', {
		headers: {
			'Accept': 'application/hal+json',
			'Accept-Version': '3.0',
			'Authorization': `Bearer ${accessToken}`
		}
	});
	const categories = await res.json();
	return categories;
}

// fetchListings()
// Function to fetch all brands from Reverb (all pages, not an API endpoint)
// var page = 0;
// const fetchListings = async (req, res) => {
//   try {
// 	axios.post('https://gql.reverb.com/graphql', {
// 	  operationName: "Core_Marketplace_CombinedMarketplaceSearch",
// 	  variables: {
// 		inputListings: {
// 		  query: "BOSS",
// 		  categorySlugs: [],
// 		  brandSlugs: [],
// 		  conditionSlugs: [],
// 		  shippingRegionCodes: [],
// 		  itemState: [],
// 		  itemCity: [],
// 		  curatedSetSlugs: [],
// 		  saleSlugs: [],
// 		  withProximityFilter: { proximity: false },
// 		  boostedItemRegionCode: "US",
// 		  useExperimentalRecall: true,
// 		  traitValues: [],
// 		  excludeCategoryUuids: [],
// 		  excludeBrandSlugs: [],
// 		  likelihoodToSellExperimentGroup: 3,
// 		  countryOfOrigin: [],
// 		  contexts: ["INITIAL_QUERY"],
// 		  autodirects: "IMPROVED_DATA",
// 		  multiClientExperiments: [{ name: "spell_check_autocorrect", group: "1" }],
// 		  canonicalFinishes: [],
// 		  skipAutocorrect: false,
// 		  limit: 50,
// 		  offset: page * 50,
// 		  fallbackToOr: true,
// 		  collapsible: "CANONICAL_PRODUCT_NEW_CONDITION_AND_TNP"
// 		}
// 	},
// 	query: `query Core_Marketplace_CombinedMarketplaceSearch($inputListings: Input_reverb_search_ListingsSearchRequest) {
// 	  listingsSearch(input: $inputListings) {
// 		total
// 		offset
// 		limit
// 		listings {
// 		  _id
// 		  title
// 		  condition {
// 			displayName
// 		  }
// 		  price {
// 			amount
// 			display
// 			currency
// 		  }
// 		}
// 	  }
// 	}`,

//   })
// 	.then((response) => {
// 	  // TODO: handle response.data as needed
// 	  console.log(response.data.data);
// 		const {listingsSearch} = response.data.data;
// 		const {listings, total} = listingsSearch;
// 		console.log(listings[0])
// 		listings.forEach(item => {
// 			const title = item.title;
// 			const newPedal = new Pedal({
// 				title,
// 				brand: item.brand,
// 				productId: item.id,
// 				price: item.price,
// 				condition: item.condition,
// 				url: item._links.web.href,
// 				photos: item.photos.map(photo => photo.url),
// 			});
// 			// newPedal.save();
// 		});
// 		if (total > page * 50) {
// 			console.log(total, listings.length);
// 			page++;	
// 			fetchListings();
// 		}
// 		else {
// 			res.status(200).json({ message: 'Listings fetched successfully' });
// 		}
// 	})
// 	.catch((error) => {
// 	  console.error('API Error:', error.response?.data || error.message);
// 	  res.status(500).json({ error: 'Failed to fetch listings' });
// 	});
//   } catch (error) {
// 	console.error('API Error:', error);
// 	res.status(500).json({ error: 'Internal server error' });
//   }
// };
// fetchListings();

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
