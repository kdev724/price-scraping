const axios = require("axios");
const path = require("path");
const mongoose = require('mongoose');
const Pedal = require('./model/pedals.mdl');
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
	Pedal.deleteMany({}).then(() => {
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
		$or: titles.map(t => ([
			{ title: { $regex: t, $options: 'i' } },
			{ title: t }
		])).flat()
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

const accessToken = 'YOUR_ACCESS_TOKEN';

var page = 1;
const fetchListings = async (req, res) => {
  try {
    axios.get('https://api.reverb.com/api/listings', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/hal+json',
        'Content-Type': 'application/json',
		'Accept-Version': '3.0'
      },
      params: {
        query: 'fender guitar',   // You can change this
        page,
        per_page: 50              // Max 100 per page
      }
    }).then((response) => {
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
		if (response.data.total > page * 50) {
			console.log(response.data.total - page * 50, page);
			page++;	
			fetchListings();
		}
		else {
			res.status(200).json({ message: 'Listings fetched successfully' });
		}
	})
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
  }
};
// fetchListings();

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
