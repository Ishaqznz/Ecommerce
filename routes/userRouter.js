const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const profileController = require('../controllers/user/profileController')
const { route } = require('../app')
const passport = require('passport')
const {userAuth, adminAuth} = require('../middlewares/auth')
const productController = require('../controllers/admin/productController')
const cartController = require('../controllers/user/cartController')
const wishlistController = require('../controllers/user/wishlistController.js')
const accountController = require('../controllers/user/accountController.js')
const orderController = require('../controllers/user/orderController.js')
const walletController = require('../controllers/user/walletController.js')
const couponController = require('../controllers/user/couponController.js')

//login managemnet
router.get('/',  userController.loadHomePage)
router.get('/pageNotFound', userController.pageNotFound)
router.get('/login', userController.loadLogin)
router.post('/login', userController.login)
router.get('/register', (req, res) => res.redirect('/signup'))
router.get('/signup', userController.loadSignup)
router.post('/signup', userController.signUp)
router.get('/logout', userController.logout)
router.post('/verify-otp', userController.verifyOtp)
router.post('/resend-otp', userController.resendOtp)
router.post('/otp-verified', userController.otpVerified)
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signup'}), 
    (req, res) => {
        
        req.session.user = req.user._id
        res.redirect('/');
    }
);

router.get('/forgot-password', userController.loadForgotPassword)
router.post('/forgot-otp', userController.forgotPassword)
router.post('/reset-password', userController.resetPassword)
router.post('/reset-password-verify', userController.resetVerify)
router.post('/changePass', userAuth, userController.changePass)

// product listing and address management
router.get('/shop', userController.getShopProducts)
router.get('/shop/filter', userController.getProductByPrice)
router.get('/shop/search', userController.getProductsBySearch)
router.get('/product/:id', productController.productDetail)
router.get('/shop/category/:categoryId', userController.getProductsByCategory);
router.get('/userProfile', userAuth, userController.getMyProfile)
router.get('/profile', userAuth, profileController.loadAddress)
router.post('/addingAddress', profileController.addAddress)
router.delete('/delete-address/:id', profileController.deleteAddress)
router.put('/edit-address/:id', profileController.editAddress)

// cart management
router.get('/cart', userAuth, cartController.loadCart)
router.post('/addto-Cart', cartController.addToCart)
router.delete('/removeFromCart', cartController.removeFromCart)
router.post('/cart/update', cartController.updateCartItem)

// whislist management
router.get('/wishlist', userAuth, wishlistController.loadWishList)
router.post('/addToWishList', wishlistController.addToWishList)
router.delete('/remove-wishlist', wishlistController.removeFromWishlist)

// Account Management
router.get('/account', userAuth, accountController.loadAccount)
router.get('/edit-account', userAuth, accountController.loadEditAccount)
router.post('/newEmail-verify', accountController.verifyOtp)
router.patch('/saveEmail', accountController.saveEmail)
router.post('/saveAccount', accountController.saveDetails)


// Order management
router.get('/checkout', userAuth, orderController.loadCheckOut)
router.get('/payment', userAuth, orderController.loadPayment)
router.get('/payment-failure', userAuth, orderController.paymentFailure)
router.post('/place-order', orderController.placeOrder)
router.get('/order-confirmation', userAuth, orderController.loadOrderConfirmation)
router.get('/payment-success', userAuth, orderController.loadPaymentSuccess)
router.post('/generate-pdf', userAuth, orderController.generatePDF);
router.get('/download-invoice/:id', userAuth, orderController.downloadInvoice)

// order listing
router.get('/orders', userAuth, orderController.loadOrders)
router.delete('/cancel-order/:id', orderController.cancelOrder)
router.delete('/cancel-product/:orderId/:productId', orderController.cancelProduct)
router.get('/order-details/:id', userAuth, orderController.loadOrderDetails)
router.post('/orders/return', userAuth, orderController.returnOrder)
router.post('/retryPaymentSuccess', userAuth, orderController.retryPayment)

//Wallet Management
router.get('/wallet', userAuth, walletController.loadWallet)
router.post('/payWithWallet', userAuth, walletController.payWithWallet)
router.post('/add-money', userAuth, walletController.createAddMoneyOrder);
router.post('/verify-payment', userAuth, walletController.verifyAddMoneyPayment);

// coupon Management
router.post('/apply-coupon', userAuth, couponController.applyCoupon)
router.patch('/remove-coupon', userAuth, couponController.removeCoupon)


// UPI payement config
router.post('/create-order', userAuth, walletController.upiCheckout)
router.post('/create-retry-order', userAuth, walletController.createRetryOrder)


router.get('*', (req, res) => res.redirect('/pageNotFound'))


module.exports = router
