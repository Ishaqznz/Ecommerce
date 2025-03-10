
const Product = require('../../model/productSchema')
const User = require('../../model/userSchema')
const Cart = require('../../model/cartSchema')
const Wishlist = require('../../model/wishlistSchema')

const loadCart = async (req, res) => {
    
    try {
        console.log('Cart session:', req.session.user);

        if (!req.session || !req.session.user) {
            return res.redirect('/');
        }

        const userId = req.session.user;

        let cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            cart = new Cart({
                userId,
                items: []
            });
        }

        cart.items = cart.items.filter(item => item.productId && !item.productId.isBlocked);

        let subtotal = cart.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        const TAX_RATE = 0; 
        let tax = subtotal * TAX_RATE;
        let total = subtotal;

        cart.subtotal = subtotal;
        cart.tax = tax;
        cart.total = total;

        console.log('Filtered Cart:', cart);

        const userData = await User.findById(userId);

        res.render('user/cart', {
            cart,
            user: userData
        });

    } catch (error) {
        console.error('Error while loading the cart page:', error);
        res.redirect('/pageNotFound');
    }
};


const addToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const userId = req.session.user;
        const { productId, productPrice, selectedSize } = req.body;

        console.log('recieved body: ', req.body);
        
        console.log('selected size: ', selectedSize);
        
        if (!productId || !selectedSize) {
            return res.status(400).json({ message: 'Product ID and selected size are required' });
        }

        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (!product.category || !product.category.isListed) {
            return res.status(403).json({ message: 'This product belongs to an unlisted category and cannot be added to the cart.' });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ message: 'Product is out of stock.' });
        }

        if (!product.sizes.has(selectedSize) || product.sizes.get(selectedSize) <= 0) {
            return res.status(400).json({ message: `Size ${selectedSize} is out of stock.` });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            cart = new Cart({
                userId,
                items: []
            });
        }

        const existingItem = cart.items.find(
            item => item.productId.toString() === productId && item.size === selectedSize
        );

        if (existingItem) {
            if (existingItem.quantity + 1 > product.sizes.get(selectedSize)) {
                return res.status(400).json({ message: `Not enough stock available for size ${selectedSize}.` });
            }
            existingItem.quantity += 1;
            existingItem.totalPrice = existingItem.quantity * existingItem.price;
        } else {
            cart.items.push({
                productId,
                quantity: 1,
                price: productPrice,
                totalPrice: productPrice,
                status: 'placed',
                size: selectedSize
            });
        }

        // product.sizes.set(selectedSize, product.sizes.get(selectedSize) - 1);
        // product.quantity -= 1; 

        await product.save();

        let subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        await cart.save();

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        res.status(201).json({
            message: 'Successfully added to cart',
            cart: { ...cart.toObject(), subtotal }
        });

    } catch (error) {
        console.error('Error while adding product to cart:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



const removeFromCart = async (req, res) => {
    try {

        const { itemId } = req.body; 
        const id = req.session.user

        const cart = await Cart.findOne({ userId: id }); 
        
        if (!cart) {
            return res.status(404).send('Cart not found.');
        }


        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).send('Item not found in cart.');
        }


        cart.items.splice(itemIndex, 1);

        await cart.save();


        res.status(200).send('Item removed from cart successfully.');

    } catch (error) {

        console.error('Error removing item from cart:', error);
        res.status(500).send('Server error.');

    }
};


const updateCartItem = async (req, res) => {
    try {
        
        const { itemId, quantity, size } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        if (!itemId || quantity < 1) {
            return res.status(400).json({ message: 'Invalid item or quantity' });
        }

        let cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        const product = cart.items[itemIndex].productId;

        console.log('-------------------------------');

        console.log('products when updating the cart item: ', product);

        console.log('--');

        console.log('product sizes: ', product.sizes);

        const sizeArray = Array.from(product.sizes)

        console.log('size array: ', sizeArray);

        let sizeQuantity 


        for (var i = 0; i < sizeArray.length; i++) {
            if (size == sizeArray[i][0]) {
                sizeQuantity = parseInt(sizeArray[i][1])
            }
        }

        console.log('size quantity: ', sizeQuantity);
            
        if (quantity > sizeQuantity) {
            return res.status(400).json({ message: `Only ${sizeQuantity} items are available in stock.` });
        }


        if (quantity > 15) {
            return res.status(400).json({ message: 'You can only add up to 15 items per product.' });
        }

        cart.items[itemIndex].quantity = quantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;

        let subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const TAX_RATE = 0.12;
        let tax = subtotal * TAX_RATE;
        let total = subtotal + tax;

        cart.subtotal = subtotal;
        cart.tax = tax;
        cart.total = total;

        await cart.save();

        res.json({ message: 'Cart updated successfully', cart });

    } catch (error) {
        console.error('Error updating cart item:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



module.exports = {
    loadCart,
    addToCart,
    removeFromCart,
    updateCartItem
}