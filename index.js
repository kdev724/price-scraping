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

	Pedal.deleteMany({title: {$regex: "D'Addario"}}).then(() => {
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

const accessToken = '0e5ce3b5378045fd27810212c28ad211ae420fa5515a0a56aded4b9fd402cbd0';

const traitValues = {
	"novo": "novo-1"
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
			if (brand.name == "D'Addario") {
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
