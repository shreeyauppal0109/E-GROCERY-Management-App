// server.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 5000;
const cors = require('cors');
const User = require('./models/userModel.js')
const jwt = require('jsonwebtoken')
mongoose.connect('mongodb://localhost/fruitvegmarke',
{
    useNewUrlParser: true,
    useUnifiedTopology: true
}
);

app.use(express.json());
app.use(cors()); // Use the cors middleware
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const Admin = mongoose.model('Admin', adminSchema);
const productSchema = new mongoose.Schema({
name: String,
type: String,
description: String,
price: Number,
image: String,
});

const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: Number,
        price: Number,
    }],
    totalPrice: Number,
}, {
    timestamps: true, // Optional: to track when orders are created/updated
});

module.exports = mongoose.model('Order', orderSchema);

const Order = mongoose.model('Order', orderSchema);


const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, '2b352cea-da9c-4abb-95c1-26aa15540ccf', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
// server.js
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin || admin.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // No token, just a success message
        res.json({ message: 'Admin logged in successfully' });
    } catch (error) {
        console.error('Error logging in admin:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Define API endpoint for adding a new product
app.post('/api/products/add', async (req, res) => {
    try {
        const { name, type, description, price, image } = req.body;
        const newProduct = new Product({ name, type, description, price, image });
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Failed to add product' });
    }
});


app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndDelete(id); // Delete product by ID
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Route for updating a product by ID
app.put('/api/products/:id', async (req, res) => {
    const { name, type, description, price, image } = req.body;
    const productId = req.params.id;

    try {
        // Find the product by ID and update it
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { name, type, description, price, image },
            { new: true } // Returns the updated document
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.json(updatedProduct); // Respond with the updated product
    } catch (error) {
        res.status(500).json({ message: 'Failed to update product.' });
    }
});

// Define API endpoint for fetching all products
app.get('/api/products', async (req, res) => {
try {
    // Fetch all products from the database
    const allProducts = await Product.find();

    // Send the entire products array as JSON response
    res.json(allProducts);
} catch (error) {
    console.error(error);
    res.status(500)
    .json({ error: 'Internal Server Error' });
}
});

// Signup route
app.post('/api/users/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/admin/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if an admin with the same username already exists
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Admin with this username already exists' });
        }

        // Create a new admin
        const admin = new Admin({ username, password });
        await admin.save();

        res.status(201).json({ message: 'Admin account created successfully' });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Login route
app.post('/api/users/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(password);
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create and send token
        const token = jwt.sign({ userId: user._id },'2b352cea-da9c-4abb-95c1-26aa15540ccf', { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.post('/api/orders/order', authenticateToken, async (req, res) => {
    try {
        console.log(req.body);
        const { cart, totalPrice } = req.body;
        console.log(cart);
        const items = cart.map(item => ({
            product: item._id, // Assuming _id is the product identifier
            quantity: item.quantity, // Adjust according to your use case
            price: item.price
        }));
        const order = new Order({
            user: req.user.userId,
            items,
            totalPrice,
        });
        await order.save();
        res.status(201).json({ message: 'Order placed successfully!' });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ error: 'Failed to place order. Please try again.' });
    }
});


app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.userId })
            .populate({
                path: 'items.product',
                select: 'name price' // Select fields to include
            });
            console.log(orders)
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders. Please try again.' });
    }
});

// Get All Orders (No Authentication)
app.get('/api/admin/order', async (req, res) => {
    try {
        // Fetch all orders from the database
        const orders = await Order.find()
            .populate({
                path: 'items.product',
                select: 'name price image'  // Select the necessary fields to display
            })
            .exec(); // Execute the query to retrieve all orders

        // If no orders are found, return a 404 error
        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found.' });
        }

        // Return the orders as a response
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders. Please try again.' });
    }
});




app.listen(PORT, () => {
console.log(
    `Server is running on port ${PORT}`
);
});
