const express = require('express')
const router = express.Router()
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure upload directory
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const offerController = require('../controllers/admin/offerController')
const couponController = require('../controllers/admin/couponController')
const dashboardController = require('../controllers/admin/dashboardController')
const {userAuth, adminAuth} = require('../middlewares/auth')


// login management
router.get('/login', adminController.loadLogin)
router.post('/login', adminController.login)
router.get('/', adminAuth, adminController.loadDashboard)
router.get('/logout', adminController.logout)
router.get('/pageError', adminController.pageError)
router.get('/dashboard', (req, res) => res.redirect('/admin'))

//customer management
router.get('/users', adminAuth, customerController.customerInfo)
router.get('/blockCustomer', adminAuth, customerController.customerBlocked)
router.get('/unBlockCustomer', adminAuth, customerController.customerUnBlocked)

// Category Management
router.get('/category', adminAuth, categoryController.categoryInfo)
router.post('/addCategory', adminAuth, categoryController.addCategory)
router.get('/editCategory', adminAuth, categoryController.getEditCategory)
router.post('/editCategory/:id', adminAuth, categoryController.editCategory)
router.get('/listCategory', adminAuth, categoryController.getListCategory)
router.get('/unlistCategory', adminAuth, categoryController.getUnListCategory)

//product management
// router.get('/addProducts', adminAuth, productController.getProductAddPage)
router.get('/products', adminAuth, productController.getProducts);
router.get('/products/addProducts', adminAuth, productController.addProducts)
router.patch('/products/toggle-status/:productId', adminAuth, productController.toggleStatus)
// router.post('/add-productt', adminAuth, productController.addingProduct)

router.post('/add-product', adminAuth, upload.array('productImage'), productController.addingProduct);
router.get('/products/editProduct/:id', adminAuth, productController.getEditProduct)
router.post('/update-product/:id', adminAuth, upload.array('productImage'), productController.editProduct)
router.delete('/products/deleteProduct/:id', adminAuth, productController.deleteProduct)
router.delete('/product/:productId/delete-image', adminAuth, productController.deleteProductImage)

// Order Management
router.get('/orderList', adminAuth, orderController.loadOrderList)
router.get('/orders/:id', adminAuth, orderController.loadOrderDetails)
router.post('/update-order-status', orderController.updateStatus)
router.post('/handleReturn', adminAuth, orderController.handleReturn)

// offer management
router.post('/addOffer', adminAuth, offerController.addOffer)
router.delete('/removeOffer', adminAuth, offerController.deleteOffer)
router.post('/addProductOffer', adminAuth, offerController.productAddOffer)
router.delete('/removeProductOffer', adminAuth, offerController.deleteProductOffer)


// coupon management
router.get('/coupon', adminAuth, couponController.loadCoupon)
router.post('/create-coupon', adminAuth, couponController.createCoupon)
router.put('/edit-coupon', adminAuth, couponController.editCoupon)
router.delete('/delete-coupon', adminAuth, couponController.deleteCoupon)
router.get('/get-coupon/:name', couponController.getCoupon)


// Dashoboard filtering
router.get('/orders/filter', adminAuth, dashboardController.filterOrder)
router.get('/orders/download/excel', adminAuth, dashboardController.downloadExcelReport)
router.get('/orders/download/pdf', adminAuth, dashboardController.downloadPdfReport)

router.get('*', (req, res) => res.redirect('/pageNotFound'))

module.exports = router




