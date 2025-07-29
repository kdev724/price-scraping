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

// Add security headers to resolve cross-origin-isolated violations
app.use((req, res, next) => {
	// Set Cross-Origin-Embedder-Policy to allow cross-origin isolation
	res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
	// Set Cross-Origin-Opener-Policy to allow cross-origin isolation
	res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
	// Set Content-Security-Policy to allow external resources
	res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:;");
	next();
});

// Serve static files from /public (Heroku compatible)
app.use(express.static(path.join(__dirname, "public")));
console.log(path.join(__dirname, "public"));
// Default route serves dashboard.html from /public
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});
// New /search endpoint for Reverb Combined Marketplace Search
app.post("/initial", async (req, res) => {
	Pedal.deleteMany({brand: "RebelRelic"}).then(() => {
		fetchListings(req, res);
	});
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
	
	// Create a more flexible search query
	let searchQueries = [];
	titles.forEach(title => {
		// Normalize the search title (remove special characters, convert to lowercase)
		const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
		
		// Split the normalized title into words for more flexible matching
		const words = normalizedTitle.split(' ').filter(word => word.length > 2);
		
		// Create multiple search patterns for better matching
		searchQueries.push(
			{ title: { $regex: title, $options: "i" } }, // Full title match
			{ title: { $regex: normalizedTitle, $options: "i" } }, // Normalized title match
			...words.map(word => ({ title: { $regex: word, $options: "i" } })) // Individual word matches
		);
		
		// Create variations of the title (remove spaces, add hyphens, etc.)
		const variations = [
			title.replace(/\s+/g, ''), // Remove all spaces
			title.replace(/\s+/g, '-'), // Replace spaces with hyphens
			title.replace(/\s+/g, '_'), // Replace spaces with underscores
			normalizedTitle.replace(/\s+/g, ''), // Normalized without spaces
			normalizedTitle.replace(/\s+/g, '-'), // Normalized with hyphens
		];
		
		variations.forEach(variation => {
			if (variation.length > 2) {
				searchQueries.push({ title: { $regex: variation, $options: "i" } });
			}
		});
	});
	
	Pedal.find({
		$or: searchQueries
	})
		.then((foundPedals) => {
			if (foundPedals.length > 0) {
				var products = []
				foundPedals.forEach((item, i) => {
					// Check if any of the search titles match this item
					const matchingPedal = pedals.find(p => {
						const searchTitle = p.name.toLowerCase();
						const itemTitle = item.title.toLowerCase();
						
						// Normalize both titles for comparison
						const normalizedSearch = searchTitle.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						const normalizedItem = itemTitle.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						
						// Check if the search title is contained in the item title
						// or if the item title contains key words from the search
						// or if normalized versions match
						return itemTitle.includes(searchTitle) || 
							   normalizedItem.includes(normalizedSearch) ||
							   searchTitle.split(' ').some(word => 
								   word.length > 2 && itemTitle.includes(word)
							   ) ||
							   normalizedSearch.split(' ').some(word => 
								   word.length > 2 && normalizedItem.includes(word)
							   );
					});
					
					// If we found a matching pedal, include it regardless of condition
					// (removed the strict condition matching)
					if (matchingPedal) {
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
				
				// Sort results by relevance (exact matches first, then partial matches)
				products.sort((a, b) => {
					const aExactMatch = titles.some(title => {
						const normalizedSearch = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						const normalizedItem = a.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						return a.title.toLowerCase().includes(title.toLowerCase()) || 
							   normalizedItem.includes(normalizedSearch);
					});
					const bExactMatch = titles.some(title => {
						const normalizedSearch = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						const normalizedItem = b.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
						return b.title.toLowerCase().includes(title.toLowerCase()) || 
							   normalizedItem.includes(normalizedSearch);
					});
					
					if (aExactMatch && !bExactMatch) return -1;
					if (!aExactMatch && bExactMatch) return 1;
					return 0;
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

const accessToken = '0e5ce3b5378045fd27810212c28ad211ae420fa5515a0a56aded4b9fd402cbd0';

const traitValues = {
	"novo": "novo-1",
	"jet": "jet-1",
	"rebelrelic": "rebelrelic-1"
}

const getProducts = async (brand) => {
	let brandName = brand.url.split('/').pop();
	// if (!brand.name.includes(" ")) {
	// 	brandName = brand.name.toLocaleLowerCase();
	// }
	console.log('🎸 Brands Found:', brandName);
	brandName = brandName.split("--")[0];
	brandName = traitValues[brandName] || brandName;
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
		priceQuery = [{ price_min: 0, price_max: 10 }, { price_min: 10.001, price_max: 20 }, { price_min: 20.001, price_max: 50 }, { price_min: 50.001, price_max: 100 },
			{ price_min: 100.001, price_max: 200 }, { price_min: 200.001, price_max: 500 }, { price_min: 500.001, price_max: 1000 }, { price_min: 1000.001, price_max: 2000 }, 
			{ price_min: 2000.001, price_max: 5000 }, { price_min: 5000.001, price_max: 10000 }, { price_min: 10000.001, price_max: 20000 }, {price_min: 20000.001, price_max: 100000}]
		step = priceQuery.length - 1;
		console.log("Step 1: Price range set to 0-10");
	}
	while (step >= 0) {
		while ((page == 0 || page * 50 < total) && page < 400) {
			try {
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
						brand: brand.name,
						productId: item.id,
						price: item.price,
						condition: item.condition,
						url: item._links.web.href,
						photos: item.photos.map(photo => photo.url),
					});
					newPedal.save();
				});
				if (total > page * 50 || total == 0) {
					console.log(total - page * 50, page);
					page++;
					// fetchListings();
				}
			} catch (error) {
				console.error("Error 123 listings:", error.response?.data || error.message);
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
			if (brand.name == "RebelRelic") {
				flag = 1;
			}
			if (flag == 1) {
				await getProducts(brand);
			}
		}
		res.json({brands});
	} catch (error) {
		console.error("Error fetching listings:", error.response?.data || error.message);
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
