const Order = require("../../model/orderSchema");
const Address = require('../../model/addressSchema')
const Wallet = require('../../model/walletSchema')


const loadOrderList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search ? req.query.search.trim() : "";

        let filter = {}; 

        if (searchQuery) {
            filter = {
                $or: [
                    { orderId: { $regex: searchQuery, $options: "i" } },  
                    { status: { $regex: searchQuery, $options: "i" } },   
                    { paymentMethod: { $regex: searchQuery, $options: "i" } } 
                ]
            };
        }

        const totalItems = await Order.countDocuments(filter);

        const orders = await Order.find(filter)
            .populate({
                path: 'userId',  
                model: 'User',
                select: 'name'
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            userName: order.userId ? order.userId.name : 'Guest User', 
            date: order.createdOn, 
            totalAmount: order.finalAmount, 
            status: order.status, 
            paymentMethod: order.paymentMethod,
        }));

        const totalPages = Math.ceil(totalItems / limit);

        res.render('load-order-list', { 
            orders: formattedOrders,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                limit: limit,
                totalItems: totalItems,
            },
            searchQuery: searchQuery 
        });

    } catch (error) {
        console.error('Error while loading order list:', error);
        res.redirect('/pageerror');
    }
};


const loadOrderDetails = async (req, res) => {
    
    try {
        const orderId = req.params.id; 

        const order = await Order.findOne({ orderId }).lean();

        if (!order) {
            console.log('Order not found:', orderId);
            return res.redirect('/pageNotFound');
        }

        res.render('load-details', { order });

    } catch (error) {
        console.error('Error while loading the order details:', error);
        res.redirect('/pageNotFound');
    }
};


const updateStatus = async (req, res) => {
    
    try {
        const { itemId, status } = req.body;

        if (!itemId || !status) {
            return res.status(400).json({ success: false, message: 'Order ID and status are required' });
        }

        const updatedOrder = await Order.findOneAndUpdate(
            { orderId: itemId }, 
            { $set: { status } }, 
            { new: true } 
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({ success: true, message: 'Order status updated successfully', order: updatedOrder });

    } catch (error) {
        console.error('Error while updating the status:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const handleReturn = async (req, res) => {

    try {

        const { orderId, productId, status, finalAmount } = req.body;

        console.log('final amount: ', finalAmount);
        

        const order = await Order.findOne({ orderId }).populate("userId"); 

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.orderedItems.find(item => item.product.toString() === productId);

        if (!item) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }

        item.returnRequest.status = status;
        item.returnRequest.requestDate = new Date();

        if (status === 'Approved') {
            order.status = 'Return Accepted';


            const userId = order.userId._id;  

            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transaction: [] });
            }

            const refundAmount = item.price * item.quantity; 

            wallet.balance = parseInt(wallet.balance) + parseInt(finalAmount)

            wallet.transaction.push({
                amount: finalAmount,
                transactionId: `refund-${orderId}-${productId}-${Date.now()}`,
                productName: [item.productName], 
                type: "credit"
            });

            await wallet.save();
            
        } else if (status === 'Rejected') {
            order.status = 'Return Rejected';
        }

        await order.save();

        return res.status(200).json({ success: true, message: `Product return ${status.toLowerCase()}!`, order });

    } catch (error) {
        console.error('Error while handling the return:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};





module.exports = {
    loadOrderList,
    loadOrderDetails,
    updateStatus,
    handleReturn
}