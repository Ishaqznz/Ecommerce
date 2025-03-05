const User = require('../model/userSchema')
const Product = require('../model/productSchema');
const Category = require('../model/categorySchema');

const userAuth = async (req, res, next) => {
    const user = req.session.user 
    console.log('req.session.user values', user);
    
    try {
        const findUser = await User.findOne({ _id: user, isBlocked: false });
        const products = await Product.find({}).lean();
        const categories = await Category.find({isListed: true}).lean()
        if (findUser) {
            next(); 
        } else {
            req.session.user = null; 
            if (req.url == '/shop') {
                return res.render('user/shop', {
                    products: products,
                    categories
                })
            }
            
            const productId = req.params.id
            if (req.url == `/product/${productId}`) {
                const product = await Product.findById(req.params.id).lean(); 
                return res.render('user/product-detail', {
                    product
                })
            }

            if (req.url == '/userProfile') {
                return res.redirect('/')
            }

            if (req.url == '/profile') {
                return res.redirect('/')
            }

            if (req.url == '/cart') {
                return res.redirect('/')
            }

            if (req.url == '/wishlist') {
                return res.redirect('/')
            }

            if (req.url == '/account') {
                return res.redirect('/')
            }

            return res.redirect('/login')
        }
    } catch (error) {
        console.log('Error happened while authenticating user by using middleware', error);
        res.status(500).send('Internal Server Error!');
    }
}

const adminAuth = async (req, res, next) => {
   if (req.session.admin) {
    await User.findOne({isAdmin: true})
    .then((data) => {
        if (data) {
            next()
        } else {
            res.render('user/home')
        }
    })

    .catch((error) => {
        console.log('error in admin auth middleware', error);
        res.status(500).send('Internal Servor error')
        
    })
   } else {
    res.redirect('/')
   }
}

module.exports = {
    adminAuth,
    userAuth
}