const User = require('../../model/userSchema')
const mongoose = require('mongoose')
const bycrypt = require('bcrypt')
const Order = require('../../model/orderSchema')
const Coupon = require('../../model/couponSchema')

const loadLogin = async (req, res) => {
    
    if (req.session.admin) {
        return res.redirect('/admin/dashboard')
    }
    res.render('admin-login', {message: null})
}


const login = async (req, res) => {

    try {
        
        const {email, password} = req.body       
        const admin = await User.findOne({email, isAdmin: true})

        console.log('entered password: ', password);

        if (admin) {

            const passwordMatch = await bycrypt.compare(password, admin.password)

            console.log('matched pssword: ', passwordMatch);
            
            if (passwordMatch) {

                req.session.admin = true
                return res.redirect('/admin')

            } else {
                return res.render('admin-login', {
                    message: 'Password mismatch!'
                })
            }
        } else {
            return res.render('admin-login', {
                message: 'Email is not existed!'
            })
        }

    } catch (error) {
        
        console.log('login error', error);
        return res.redirect('/pageError')

    }
}



const loadDashboard = async (req, res) => {

    try {
        const period = req.query.period || 'all';
        

        let startDate = new Date();  
        const endDate = new Date();  

        switch(period) {
            case '1day':
                startDate.setDate(endDate.getDate() - 1);
                break;
            case '1week':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '1month':
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            default:
                startDate = null;  
        }

        const dateFilter = startDate ? {
            createdOn: {
                $gte: startDate,
                $lte: endDate
            }
        } : {};


        const totalSales = await Order.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        console.log('Filtered Sales:', totalSales);

        const totalOrders = await Order.countDocuments(dateFilter);
        const cancelledOrders = await Order.countDocuments({ ...dateFilter, status: 'Cancelled' });
        const pendingOrders = await Order.countDocuments({ ...dateFilter, status: 'Pending' });
        const processingOrders = await Order.countDocuments({ ...dateFilter, status: 'Processing' });
        const deliveredOrders = await Order.countDocuments({ ...dateFilter, status: 'Delivered' });

        const cancelledAmount = await Order.aggregate([
            { $match: { ...dateFilter, status: 'Cancelled' } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        const pendingAmount = await Order.aggregate([
            { $match: { ...dateFilter, status: 'Pending' } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        const processingAmount = await Order.aggregate([
            { $match: { ...dateFilter, status: 'Processing' } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        const deliveredAmount = await Order.aggregate([
            { $match: { ...dateFilter, status: 'Delivered' } },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } }
        ]);

        const totalDiscounts = await Order.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: "$discount" } } }
        ]);

        const activeCoupons = await Coupon.countDocuments({ 
            expireOn: { $gt: new Date() },
            isList: true 
        });
        
        const expiredCoupons = await Coupon.countDocuments({ 
            expireOn: { $lt: new Date() }
        });

        const totalCouponUsage = await Order.countDocuments({
            ...dateFilter,
            discount: { $gt: 0 }
        });

        const totalUsers = await User.countDocuments();

        const cancelledPercentage = totalOrders ? ((cancelledOrders / totalOrders) * 100).toFixed(2) : 0;
        const pendingPercentage = totalOrders ? ((pendingOrders / totalOrders) * 100).toFixed(2) : 0;
        const processingPercentage = totalOrders ? ((processingOrders / totalOrders) * 100).toFixed(2) : 0;
        const deliveredPercentage = totalOrders ? ((deliveredOrders / totalOrders) * 100).toFixed(2) : 0;

        const totalSalesGrowth = 5.2;



        // top products
        const topProducts = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$orderedItems.product",
                    productName: { $first: "$productInfo.productName" },
                    category: { $first: "$productInfo.category" },
                    totalQuantitySold: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { 
                        $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] }
                    },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            { $sort: { totalQuantitySold: -1 } }, 
            { $limit: 10 }
        ]);


        // top 5 categories
        const topCategories = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.category",
                    totalRevenue: {
                        $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] }
                    },
                    totalQuantitySold: { $sum: "$orderedItems.quantity" }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            { $unwind: "$categoryInfo" },
            { $sort: { totalRevenue: -1 } },
            { $limit: 5 }
        ]);




        res.render('dashboard', {
            data: {
                totalSales: totalSales[0]?.total || 0,
                totalSalesGrowth,
                totalOrders,
                cancelledOrders,
                cancelledAmount: cancelledAmount[0]?.total || 0,
                cancelledPercentage,
                pendingOrders,
                pendingAmount: pendingAmount[0]?.total || 0,
                pendingPercentage,
                processingOrders,
                processingAmount: processingAmount[0]?.total || 0,
                processingPercentage,
                deliveredOrders,
                deliveredAmount: deliveredAmount[0]?.total || 0,
                deliveredPercentage,
                totalUsers,
                totalDiscounts: totalDiscounts[0]?.total || 0,
                activeCoupons,
                expiredCoupons,
                totalCouponUsage,
                discountPercentage: totalSales[0]?.total ? 
                    ((totalDiscounts[0]?.total / totalSales[0].total) * 100).toFixed(2) : 0,
                selectedPeriod: period 
            },
            topProducts,
            topCategories
        });

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).send("Internal Server Error");
    }
};





const pageError = (req, res) => {
    res.render('admin-error')
}

const logout = (req, res) => {
    try {
        req.session.admin = undefined
        res.redirect('/admin/login')
    } catch (error) {
        console.log('Un expected error during logout', error);
        res.redirect('/admin/pageError')
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
}