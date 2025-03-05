const Product = require('../../model/productSchema');
const User = require('../../model/userSchema');
const Cart = require('../../model/cartSchema');
const Wishlist = require('../../model/wishlistSchema');

const loadWishList = async (req, res) => {
    try {
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            model: 'Product',
            populate: { path: 'category', model: 'Category' } 
        });

        let products = [];

        if (wishlist && wishlist.products.length > 0) {
            products = wishlist.products
                .filter(item => item.productId)
                .map(item => {
                    const product = item.productId;
                    const originalPrice = product.regularPrice || 0;
                    const categoryDiscount = product.category?.categoryOffer || 0;
                    const productDiscount = product.productOffer || 0;

                    const maxDiscount = Math.max(categoryDiscount, productDiscount);
                    const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

                    return {
                        productId: product._id,
                        productName: product.productName,
                        productImage: product.productImage[0] || "default.jpg",
                        originalPrice,
                        finalPrice,  
                        maxDiscount,
                        description: product.description,
                        addedOn: item.addedOn
                    };
                });
        }

        const userData = await User.findById(userId);

        res.render('user/wishlist', { 
            products,
            user: userData
        });

    } catch (error) {
        console.error('Error while loading the wishlist:', error);
        res.redirect('/pageNotFound');
    }
};


const addToWishList = async (req, res) => {

    try {
        const userId = req.session.user; 
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not logged in' });
        }

        console.log('Product ID:', productId);
        console.log('User ID:', userId);

        const cart = await Cart.findOne({ userId, "items.productId": productId });
        if (cart) {
            return res.status(400).json({ success: false, message: 'Product is already in the cart' });
        }

        
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
        } else {
            
            const isProductInWishlist = wishlist.products.some(item => item.productId.toString() === productId);

            if (isProductInWishlist) {
                return res.status(400).json({ success: false, message: 'Product already in wishlist' });
            }

            wishlist.products.push({ productId });
        }

        
        await wishlist.save();

        return res.status(201).json({ success: true, message: 'Product added to wishlist' });

    } catch (error) {
        console.error('Error while adding product to wishlist:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const removeFromWishlist = async (req, res) => {

    try {
        
        console.log('Product Id: ', req.body);

        const productId = req.body.productId
        const userId = req.session.user

        const wishlist = await Wishlist.updateOne({ userId: userId, 'products.productId': productId}, 
            { $pull: { products: { productId: productId}}})

        if (wishlist.modifiedCount > 0) {

            res.status(200).json({ success: true, message: 'Successfully removed from wishlist!' })
            return;

        }

        res.status(500).json({ success: false, message: 'Error while removing from wishlist!'})

    } catch (error) {
        
        console.log('Error while removing from wishlist!', error);
        res.redirect('/pageNotFound')
        
    }
}


module.exports = {
    loadWishList,
    addToWishList,
    removeFromWishlist
};
