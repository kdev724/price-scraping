// Function to scrape brands from https://reverb.com/brands

// Endpoint to fetch all brands from Reverb
// Endpoint to fetch available brands from Reverb

const axios = require("axios");
const path = require("path");
const mongoose = require('mongoose');
const Pedal = require('./model/pedals.mdl');
const cheerio = require("cheerio");
const dotenv = require('dotenv');
const fs = require('fs');

// Debug what's happening
console.log('=== DEBUGGING ENV LOADING ===');
console.log('Current directory:', process.cwd());
console.log('Looking for .env at:', require('path').resolve('.env'));
console.log('File exists:', require('fs').existsSync('.env'));

// Read the actual file content
const envContent = fs.readFileSync('.env', 'utf8');
console.log('Raw .env file content:');
console.log('Length:', envContent.length);
console.log('Content:', JSON.stringify(envContent));
console.log('Lines:', envContent.split('\n').length);

// Try to load .env
const result = dotenv.config();
console.log('Dotenv result:', result);

// Check if it loaded anything
console.log('All env vars with OPENAI:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
console.log('OPENAI_API_KEY value:', process.env.OPENAI_API_KEY);
console.log('=== END DEBUG ===');
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
	Pedal.deleteMany({brand: "Yamaha"}).then(() => {
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
	Pedal.find({
		$where: function() {
			let flag = false;
			for (var i = 0; i < pedals.length; i++) {
				var strArr = pedals[i].name.toLowerCase().split(" ");
				var similarity = 0;
				var s = 1 / strArr.length;
				strArr.forEach((str) => {
					if (this.title.toLowerCase().includes(str)) {
						similarity += s;
					}
				});
				if (similarity > 0.5 && this.condition.display_name.toLocaleLowerCase() === pedals[i].condition.toLocaleLowerCase()) {
					flag = true;
					break;
				}
			}
			return flag;
		}
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
					
					// Use upsert to update existing pedal or create new one
					Pedal.findOneAndUpdate(
						{ productId: item.id }, // filter by productId to find existing
						{
							title,
							brand: brand.name,
							productId: item.id,
							price: item.price,
							condition: item.condition,
							url: item._links.web.href,
							photos: item.photos,
						},
						{ 
							upsert: true, 
							new: true, // return the updated/created document
							setDefaultsOnInsert: true // apply schema defaults on insert
						}
					).exec();
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
// Process brands in batches to save OpenAI tokens
async function processBrandsInBatches(brands, batchSize = 25) {
    const pedalBrands = [];
    
    for (let i = 0; i < brands.length; i += batchSize) {
        const batch = brands.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(brands.length/batchSize)}`);
        
        const batchResults = await analyzeBrandBatch(batch);
        pedalBrands.push(...batchResults);
        
        // Small delay to avoid rate limiting
        if (i + batchSize < brands.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return pedalBrands;
}

// Analyze a batch of brands in one API call
async function analyzeBrandBatch(brandsBatch) {
    try {
        const brandsList = brandsBatch.map((brand, index) => `${index + 1}. "${brand.name}"`).join('\n');
        
        const prompt = `Analyze these ${brandsBatch.length} brands and determine which are focused on guitar pedals/effects.

Brands to analyze:
${brandsList}

For each brand, determine if it's primarily focused on guitar pedals/effects.

Respond with ONLY a JSON array:
[
  {
    "index": 1,
    "brandName": "brand name",
    "isPedalBrand": true/false,
    "confidence": 0.0-1.0,
    "reason": "Brief explanation"
  }
]

Only mark as pedal brands if they primarily make guitar pedals/effects.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a music equipment expert. Analyze brands and determine which are primarily focused on guitar pedals/effects."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 800
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('OpenAI API Error:', data.error);
            return [];
        }

        const content = data.choices[0].message.content;
        
        try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const results = JSON.parse(jsonMatch[0]);
                
                return results
                    .filter(result => result.isPedalBrand && result.confidence > 0.6)
                    .map(result => ({
                        ...brandsBatch[result.index - 1],
                        confidence: result.confidence,
                        reason: result.reason
                    }));
            }
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError);
        }
        
        return [];
        
    } catch (error) {
        console.error('Batch analysis failed:', error);
        return [];
    }
}

const fetchListings = async (req, res) => {
	try {
		let brands = await scrapeBrandsFromWeb();
		console.log(`Found ${brands.length} brands, processing in batches...`);
		
		// Process brands in batches instead of one by one
		const pedalBrands = await processBrandsInBatches(brands, 25);
		
		console.log(`Found ${pedalBrands.length} pedal brands out of ${brands.length} total brands`);
		
		// Process only the pedal brands
		for (const brand of pedalBrands) {
			await getProducts(brand);
		}
		
		res.json({
			totalBrands: brands.length,
			pedalBrands: pedalBrands.length,
			brands: pedalBrands
		});
		
	} catch (error) {
		console.error("Error fetching listings:", error.response?.data || error.message);
		res.status(500).json({ error: 'Internal server error' });
	}
};

// Function to check if a brand is specifically for guitar pedals
async function isGuitarPedalBrand(brandName) {
    if (!brandName) return false;
    
    try {
        const prompt = `Analyze if the brand "${brandName}" is specifically focused on guitar pedals/effects or if it's a general music equipment brand.
		Consider:
		1. Is this brand primarily known for guitar pedals/effects?
		2. Do they specialize in stompboxes, effects processors, or guitar effects?
		3. Or are they known for guitars, amps, keyboards, recording equipment, etc.?

		Respond with ONLY a JSON object in this exact format:
		{
		"isPedalBrand": true/false,
		"confidence": 0.0-1.0,
		"reason": "Brief explanation of why this brand is or isn't pedal-focused"
		}

		Examples:
		- "Boss" should return: {"isPedalBrand": true, "confidence": 1.0, "reason": "Boss is primarily known for guitar pedals and effects"}
		- "Fender" should return: {"isPedalBrand": false, "confidence": 0.8, "reason": "Fender is primarily known for guitars and amplifiers, not pedals"}
		- "Strymon" should return: {"isPedalBrand": true, "confidence": 1.0, "reason": "Strymon specializes in high-end guitar pedals and effects"}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a music equipment expert specializing in guitar pedals and effects. Analyze brands and determine if they are primarily focused on guitar pedals/effects."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.1,
                max_tokens: 200
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('OpenAI API Error:', data.error);
            // Fallback to basic keyword checking
            return fallbackBrandCheck(brandName);
        }

        const content = data.choices[0].message.content;
        
        try {
            // Extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return result;
            } else {
                console.error('No JSON found in OpenAI response:', content);
                return fallbackBrandCheck(brandName);
            }
        } catch (parseError) {
            console.error('Failed to parse OpenAI response:', parseError);
            return fallbackBrandCheck(brandName);
        }

    } catch (error) {
        console.error('OpenAI API request failed:', error);
        // Fallback to basic keyword checking
        return fallbackBrandCheck(brandName);
    }
}
// Fallback function for when OpenAI API fails
function fallbackBrandCheck(brandName) {
    if (!brandName) return { isPedalBrand: false, confidence: 0.3, reason: 'No brand name provided' };
    
    const normalizedBrand = brandName.toLowerCase().trim();
    
    // Basic keyword checking as fallback
    const pedalKeywords = ['pedal', 'effect', 'fx', 'stompbox', 'stomp'];
    const hasPedalKeywords = pedalKeywords.some(keyword => normalizedBrand.includes(keyword));
    
    if (hasPedalKeywords) {
        return { isPedalBrand: true, confidence: 0.6, reason: 'Brand name contains pedal-related keywords (fallback)' };
    }
    
    return { isPedalBrand: false, confidence: 0.3, reason: 'Unknown brand, no pedal indicators found (fallback)' };
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

// Price Guide Transaction Table endpoint
async function getPriceGuide(productId) {
	try {
		const payload = {
			operationName: "Search_PriceGuideTool_TransactionTable",
			variables: {
				canonicalProductIds: [
					"877"
				],
				conditionSlugs: [
					"mint",
					"excellent",
					"very-good",
					"good"
				],
				sellerCountries: [
					"US"
				],
				actionableStatuses: [
					"shipped",
					"picked_up",
					"received"
				],
				limit: 10,
				offset: 0
			},
			query: "query Search_PriceGuideTool_TransactionTable($canonicalProductIds: [String], $sellerCountries: [String], $conditionSlugs: [String], $createdAfterDate: String, $actionableStatuses: [String], $limit: Int, $offset: Int) {\n  priceRecordsSearch(\n    input: {canonicalProductIds: $canonicalProductIds, sellerCountries: $sellerCountries, listingConditionSlugs: $conditionSlugs, createdAfterDate: $createdAfterDate, actionableStatuses: $actionableStatuses, limit: $limit, offset: $offset}\n  ) {\n    priceRecords {\n      _id\n      ...TransactionTablePriceRecordsData\n      __typename\n    }\n    total\n    offset\n    __typename\n  }\n}\n\nfragment TransactionTablePriceRecordsData on PublicPriceRecord {\n  _id\n  condition {\n    displayName\n    __typename\n  }\n  createdAt {\n    seconds\n    __typename\n  }\n  amountProduct {\n    display\n    __typename\n  }\n  listingId\n  __typename\n}"
		};

		const response = await axios.post('https://gql.reverb.com/graphql', payload);
		
		console.log('Price Guide Response:', response.data.data.priceRecordsSearch.priceRecords.length);
		
	} catch (error) {
		console.error('Price Guide API Error:', error.response?.data || error.message);
	}
}