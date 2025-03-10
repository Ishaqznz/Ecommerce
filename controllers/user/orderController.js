const User = require('../../model/userSchema')
const Address = require('../../model/addressSchema')
const Product = require('../../model/productSchema')
const Cart = require('../../model/cartSchema')
const Order = require('../../model/orderSchema')
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const env = require('dotenv').config()
const Wallet = require('../../model/walletSchema')
const Coupon = require('../../model/couponSchema')

const loadCheckOut = async (req, res) => {

    try {

        console.log('checkout.....');
        
        const userId = req.session.user;

        const userData = await User.findOne({ _id: userId });
        const addresses = await Address.find({ userId: userId });

        const coupons = await Coupon.find()

        const cartData = await Cart.findOne({ userId: userId }).populate("items.productId");

        let products = [];
        let subtotal = 0;
        let delivery = 88;  
        let discount   
        let total = 0;

        if (cartData && Array.isArray(cartData.items)) {
            products = cartData.items
                .filter(item => !item.productId.isBlocked)  
                .map(item => ({
                    productId: item.productId._id,
                    productName: item.productId.productName,
                    productImage: item.productId.productImage[0],
                    salePrice: item.productId.salePrice,
                    quantity: item.quantity,
                    totalPrice: item.totalPrice,
                    size: item.size
                }));

            subtotal = products.reduce((acc, product) => acc + (product.totalPrice || 0), 0);
        }

        discount = (subtotal / 100) * 10
        total = subtotal + delivery;

        res.render('user/checkout', {
            user: userData,
            addresses,
            products,
            subtotal,
            delivery,
            discount,
            total,
            coupons
        });

    } catch (error) {
        console.log('Error while loading the checkout page', error);
        res.status(500).send("Internal Server Error");
    }
};


const loadPayment = async (req, res) => {

    try {

        const id = req.query.id

        const userId = req.session.user;
        
        const userData = await User.findOne({ _id: userId });

        const cartData = await Cart.findOne({ userId: userId }).populate("items.productId");

        if (!cartData) {
            return res.redirect("/checkout"); 
        }

        let products = [];
        let subtotal = 0;
        let delivery = 88;  
        let discount = 0;
        let total = 0;
        let cashCollectionCharge = 30; 

        if (Array.isArray(cartData.items)) {
            products = cartData.items.map(item => ({
                productId: item.productId._id,
                name: item.productId.productName,
                price: item.productId.salePrice,
                quantity: item.quantity,
                totalPrice: item.totalPrice
            }));

            subtotal = products.reduce((acc, product) => acc + (product.totalPrice || 0), 0);
            subtotal = subtotal + 88; 
        }

        discount = (subtotal / 100) * 10;
        // total = subtotal + delivery - discount; 
        total = subtotal

        const offerPrice = req.session.offerPrice || 0

        total = total - parseInt(offerPrice) 

        const userAddress = await Address.find({ userId: userData._id }, { address: true })

        const selectedAddress = userAddress[0].address.find((addr) => addr._id.toString() === id)
        console.log('Selected user address', selectedAddress);
        
        const wallet = await Wallet.findOne({ user: userId });
        const walletBalance = wallet ? wallet.balance : 0; 
        const balanceAfterPayment = walletBalance - total

        res.render('user/payment', {
            user: userData,
            customerName: selectedAddress.name,
            deliveryType: "Standard", 
            itemCount: products.length,
            items: products,
            totalMRP: subtotal,
            bagDiscount: discount,
            subtotal,
            delivery,
            total,
            cashCollectionCharge,
            selectedAddressId: id,
            walletBalance,
            balanceAfterPayment
        });

    } catch (error) {
        console.log('Error while loading the payment', error);
        res.redirect('/pageNotFound');
    }
};

const placeOrder = async (req, res) => {

    try {

        const userId = req.session.user;
        const { paymentMethod, addressId, snum } = req.body;

        console.log('Received body: ', req.body);

        const userCart = await Cart.findOne({ userId }).populate('items.productId');

        if (!userCart || userCart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const userAddress = await Address.findOne({ userId });

        if (!userAddress || !userAddress.address.id(addressId)) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        const selectedAddress = userAddress.address.id(addressId);

        const orderedItems = userCart.items.map(item => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            productImage: item.productId.productImage,
            size: item.size,
            productName: item.productId.productName
        }));

        console.log('----------');
        
        console.log('ordered items when plcaing the order: ', orderedItems);
        console.log('Order item size: ', orderedItems.size);
        

        let totalPrice = orderedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const deliveryCharge = 88;
        const discount = req.session.offerPrice || 0;
        let finalAmount = totalPrice + deliveryCharge - parseInt(discount);

        console.log('snum: ', snum);
    
        if (snum == 'payment-fail') {
            
            console.log('snum: ', snum);
            
            const newOrder = new Order({
                userId,
                orderedItems,
                totalPrice,
                discount,
                finalAmount,
                deliveryCharge,
                address: selectedAddress,
                paymentMethod,
                status: "payment pending",
                couponApplied: discount > 0,  
            });
    
            await newOrder.save();

            req.session.finalAmount = finalAmount
    
            req.session.offerPrice = null;
    
            for (const item of orderedItems) {
                await Product.updateOne(
                    { _id: item.product },
                    { 
                        $inc: { quantity: -item.quantity },
                    } 
                );         

                await Product.updateOne(
                    { _id: item.product },
                    { 
                        $inc: { [`sizes.${item.size}`]: -item.quantity }  
                    }
                ); 
            }
            
    
            await Cart.findOneAndUpdate(
                { userId },
                { $set: { items: [] } }
            );
    
            req.session.orderId = newOrder._id;

            console.log('order id of: ', req.session.orderId);
            
            await req.session.save();

            res.json({ success: true, message: ''});    
            return;
        }

        const newOrder = new Order({
            userId,
            orderedItems,
            totalPrice,
            discount,
            finalAmount,
            deliveryCharge,
            address: selectedAddress,
            paymentMethod,
            status: "Pending",
            couponApplied: discount > 0,
            paymentStatus: 'success'  
        });

        await newOrder.save();

        req.session.offerPrice = null;
        req.session.orderId = newOrder._id;

        for (const item of orderedItems) {
            await Product.updateOne(
                { _id: item.product },
                { 
                    $inc: { quantity: -item.quantity }, 
                } 
            );         
        
            await Product.updateOne(
                { _id: item.product },
                { 
                    $inc: { [`sizes.${item.size}`]: -item.quantity } 
                }
            ); 
        }
        

        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        );

        req.session.orderId = newOrder._id;
        await req.session.save();

        if (paymentMethod === "upi") {
            console.log('Processing UPI payment...');

            let wallet = await Wallet.findOne({ user: userId });

            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transaction: [] });
            }


            wallet.transaction.push({
                type: "debit",
                amount: finalAmount,
                transactionId: `TXN${Date.now()}`, 
                createdAt: new Date(),
                productName: orderedItems.map(item => item.product.toString())
            });

            await wallet.save();

            return res.json({ success: true, message: 'Payment Successful!', walletBalance: wallet.balance });
        } else if (paymentMethod === 'wallet') {

            console.log('Processing UPI payment...');

            let wallet = await Wallet.findOne({ user: userId });

            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transaction: [] });
            }


            wallet.transaction.push({
                type: "debit",
                amount: finalAmount,
                transactionId: `TXN${Date.now()}`, 
                createdAt: new Date(),
                productName: orderedItems.map(item => item.product.toString())
            });

            wallet.balance = !wallet.balance ? 0 : wallet.balance - finalAmount

            await wallet.save();

            return res.json({ success: true, message: 'Payment Successful!', walletBalance: wallet.balance });
        }
        
        res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id });

    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};



const loadOrderConfirmation = async (req, res) => {

    try {
        
        const orderId = req.session.orderId;

        console.log('order Id', orderId);

        const userId = req.session.user
        const userData = await User.findOne({ _id: userId})
        

        if (!orderId) {
            return res.redirect('/pageNotFound');
        }

        const order = await Order.findById( orderId ).populate('orderedItems.product');

        if (!order) {
            console.log('Order details', order);
            
            return res.redirect('/pageNotFound');
        }

        res.render('user/order-success', { order, user: userData });

    } catch (error) {
        
        console.log('Error while loading the order success page!', error);
        res.redirect('/pageNotFound')

    }

}


const generatePDF = async (req, res) => {

    try {
        const { orderId, customerDetails, orderItems, totalAmount } = req.body;

        console.log(orderId, customerDetails, orderItems, totalAmount);
        

        if (!orderId || !customerDetails || !orderItems || !totalAmount) {
            return res.status(400).json({ success: false, message: "Missing order details" });
        }

        const doc = new PDFDocument();
        const fileName = `invoice-${orderId}.pdf`;
        const filePath = path.join(__dirname, '../public/invoices', fileName);

     
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        doc.fontSize(20).text('Invoice', { align: 'center' }).moveDown(2);

        const customer = JSON.parse(customerDetails);
        doc.fontSize(14).text(`Order ID: ${orderId}`).moveDown(0.5);
        doc.text(`Customer Name: ${customer.name}`);
        doc.text(`Email: ${customer.email}`);
        doc.text(`Address: ${customer.address}`).moveDown(1);


        doc.fontSize(16).text('Order Items:', { underline: true }).moveDown(0.5);
        const items = JSON.parse(orderItems);
        items.forEach((item, index) => {
            doc.fontSize(14).text(`${index + 1}. ${item.productName} - ${item.quantity} x $${item.price}`);
        });

        doc.moveDown(1);
        doc.fontSize(16).text(`Total Amount: $${totalAmount}`, { bold: true });

        doc.end();

        writeStream.on('finish', () => {
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    res.status(500).json({ success: false, message: "Error downloading PDF" });
                }
   
                setTimeout(() => fs.unlinkSync(filePath), 60000);
            });
        });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, message: "Server error while generating PDF" });
    }
};


const loadOrders = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.session.user);
        const userData = await User.findOne({ _id: req.session.user });

        const page = parseInt(req.query.page) || 1;
        const limit = 2; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId });

        const orders = await Order.find({ userId })
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'productName productImage salePrice'
            })
            .populate('address', 'city state pincode')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const formattedOrders = orders.map(order => ({
            orderId: order.orderId,
            orderNumber: order._id.toString().slice(-6),
            orderDate: order.createdOn.toISOString().split('T')[0],
            totalAmount: order.totalPrice,
            finalAmount: order.finalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            couponApplied: order.couponApplied,
            products: order.orderedItems.map(item => ({
                id: item.product._id,
                name: item.product.productName,
                image: item.product.productImage[0],
                quantity: item.quantity,
                price: item.price,
                size: item.size
            })),
            address: order.address ? `${order.address.addressType}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}` : 'N/A'
        }));

        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalItems: totalOrders,
            limit
        };

        res.render('user/my-order', { orders: formattedOrders, user: userData, pagination });

    } catch (error) {
        console.error('Error while loading the order page:', error);
        res.redirect('/pageNotFound');
    }
};



const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;

        console.log('Order ID for cancellation:', orderId);

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log('-----------------------');
        const userData = await User.findOne({ _id: order.userId });
        console.log('User data:', userData);

        for (const item of order.orderedItems) {
            const product = await Product.findById(item.product);
            
            if (!product) continue;

            product.quantity += item.quantity;

            if (item.size && product.sizes.has(item.size)) {
                product.sizes.set(item.size, (product.sizes.get(item.size) || 0) + item.quantity);
            }

            await product.save();
        }

        if (order.paymentMethod === 'upi' || order.paymentMethod === 'wallet') {
            const userWallet = await Wallet.findOne({ user: order.userId });

            if (userWallet) {
                userWallet.balance += order.finalAmount;

                userWallet.transaction.push({
                    amount: order.finalAmount,
                    transactionId: order.orderId,
                    productName: order.orderedItems.map(item => item.product.toString()),
                    type: 'credit',
                });

                await userWallet.save();
                console.log('Refund added to wallet successfully.');
            } else {
                console.log('User wallet not found.');
            }
        }

        await Order.findOneAndDelete({ orderId });

        res.json({ success: true, message: 'Order cancelled, stock updated, and deleted successfully' });

    } catch (error) {
        console.error('Error while cancelling the order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const cancelProduct = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        console.log('Cancel specific product in order:', orderId, 'Product:', productId);

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (!order.orderedItems || order.orderedItems.length === 0) {
            return res.status(404).json({ success: false, message: 'No products found in the order' });
        }

        const productIndex = order.orderedItems.findIndex(item => item.product.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        const canceledProduct = order.orderedItems[productIndex];

        const product = await Product.findById(productId);
        if (product) {

            product.quantity += canceledProduct.quantity;

            if (canceledProduct.size && product.sizes.has(canceledProduct.size)) {
                product.sizes.set(canceledProduct.size, (product.sizes.get(canceledProduct.size) || 0) + canceledProduct.quantity);
            }

            await product.save();
        }

        const productTotalPrice = canceledProduct.price * canceledProduct.quantity;
        order.finalAmount -= productTotalPrice;
        order.totalPrice -= productTotalPrice;

        if (order.finalAmount < 0) {
            order.finalAmount = 0;
            order.totalPrice = 0;
        }

        const userWallet = await Wallet.findOne({ user: order.userId });

            if (userWallet) {

                console.log('user wallet product total price: ', productTotalPrice);
                
                userWallet.balance += productTotalPrice;

                userWallet.transaction.push({
                    amount: productTotalPrice,
                    transactionId: order.orderId,
                    productName: order.orderedItems.map(item => item.product.toString()),
                    type: 'credit',
                });

                await userWallet.save();
                console.log('Refund added to wallet successfully.');
            } else {
                console.log('User wallet not found.');
            }

        

        order.orderedItems.splice(productIndex, 1);

        if (order.orderedItems.length === 0) {

            await Order.findOneAndDelete({ orderId });
            return res.json({ success: true, message: 'Product removed. Order deleted as no products remain.' });

        } else {
            await order.save();
            return res.json({ 
                success: true, 
                message: 'Product removed from order successfully.', 
                updatedAmount: order.finalAmount 
            });
        }

    } catch (error) {
        console.error('Error while canceling the product:', error);
        res.status(500).json({ success: false, message: 'Server error while canceling product' });
    }
};

const loadOrderDetails = async (req, res) => {

    try {
        const orderId = req.params.id;
        
        const order = await Order.findOne({ orderId })
            .populate({
                path: 'orderedItems.product',
                model: 'Product',
                select: 'name price image',
            })
            .populate({
                path: 'userId',
                model: 'User',
                select: 'email',
            });

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        const formattedOrder = {
            orderId: order.orderId,
            orderNumber: order._id.toString().slice(-6).toUpperCase(), 
            orderDate: order.createdOn.toLocaleDateString(),
            confirmationDate: order.status !== 'Pending' ? order.createdOn.toLocaleDateString() : null,
            completionDate: order.status === 'Completed' ? order.invoiceDate?.toLocaleDateString() : null,
            cancellationDate: order.status === 'Cancelled' ? order.invoiceDate?.toLocaleDateString() : null,
            status: order.status,
            paymentMethod: order.paymentMethod,
            shippingMethod: 'Standard Delivery', 
            email: order.userId?.email || 'N/A',
            address: `${order.address.name}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`,
            totalAmount: order.totalPrice,
            shippingCost: 5,
            discount: order.discount,
            finalAmount: order.finalAmount,
            products: order.orderedItems.map(item => ({
                name: item.product.name,
                price: item.price,
                quantity: item.quantity,
            })),
        };

        res.render('user/order-details', { order: formattedOrder });

    } catch (error) {
        console.error('Error while loading the order detail page:', error);
        res.redirect('/pageNotFound');
    }
};


const returnOrder = async (req, res) => {

    const { orderId, productId, reason } = req.body;

    try {

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const productIndex = order.orderedItems.findIndex(item => item.product.toString() === productId);

        if (productIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in the order' });
        }

        order.orderedItems[productIndex].returnRequest = {
            status: 'Pending',
            reason,
            requestDate: new Date()
        };

        const allProductsReturned = order.orderedItems.every(item => item.returnRequest?.status === 'Pending');

        if (allProductsReturned) {
            order.status = 'Return Request';
        }

        await order.save();

        return res.status(200).json({ success: true, message: 'Return request submitted successfully', order });

    } catch (error) {
        console.error('Error while processing return request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
    
};



const paymentFailure = async (req, res) => {

    try {

        const { paymentMethod, addressId } = req.query;

        const amount = req.session.finalAmount
        const orderId = req.session.orderId
        const userId = req.session.user

        console.log('amount of payment failure: ', amount);


       
        const finalAmount = Math.round(amount)
        res.render('user/payment-failure', {
            orderId: orderId || 'N/A',
            amount: finalAmount || 'N/A',
            paymentMethod: paymentMethod || 'N/A',
            razorpayKeyId: process.env.RAZORPAY_KEY,
            addressId: addressId,
            userEmail: req.user?.email || '',
            userPhone: req.user?.phone || ''
        });

    } catch (error) {
        console.log('Error while handling the payment failure: ', error);
        res.redirect('/pageNotFound');
    }
}


const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;

        const order = await Order.findOne({ orderId })
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName price');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const fileName = `invoice-${orderId}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/pdf');

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        const colors = {
            primary: '#333333',
            secondary: '#666666',
            accent: '#4A90E2',
            light: '#F5F5F5',
            border: '#DDDDDD'
        };

        const drawHorizontalLine = (y) => {
            doc.strokeColor(colors.border).lineWidth(1)
               .moveTo(50, y).lineTo(550, y).stroke();
        };

        const formatCurrency = (amount) => {
            return `₹${parseFloat(amount).toFixed(2)}`;
        };

        doc.fontSize(24).fillColor(colors.primary).text('VOGUE VAULT', { align: 'center' });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(colors.secondary).text('Premium Fashion Store', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).fillColor(colors.accent).text('INVOICE', { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(10).fillColor(colors.secondary);

        const leftColX = 50;
        doc.text('BILLED TO:', leftColX, doc.y);
        doc.fontSize(12).fillColor(colors.primary)
           .text(order.userId.name, leftColX, doc.y + 15)
           .fontSize(10).fillColor(colors.secondary)
           .text(order.userId.email, leftColX, doc.y + 15);

        const rightColX = 350;
        doc.fontSize(10).fillColor(colors.secondary)
           .text('INVOICE DETAILS:', rightColX, 135);
        doc.fontSize(12).fillColor(colors.primary)
           .text(`Invoice #: ${order.orderId}`, rightColX, doc.y + 15)
           .fontSize(10).fillColor(colors.secondary)
           .text(`Date: ${new Date(order.invoiceDate || Date.now()).toLocaleDateString()}`, rightColX, doc.y + 15)
           .text(`Payment Method: ${order.paymentMethod}`, rightColX, doc.y + 15);

        doc.moveDown(2);

        const currentY = doc.y;
        doc.fontSize(10).fillColor(colors.secondary)
           .text('SHIPPING ADDRESS:', leftColX, currentY);
        doc.fontSize(12).fillColor(colors.primary)
           .text(order.address.name, leftColX, doc.y + 15)
           .fontSize(10).fillColor(colors.secondary)
           .text(`${order.address.city}, ${order.address.state}, ${order.address.pincode}`, leftColX, doc.y + 15)
           .text(`Phone: ${order.address.phone}`, leftColX, doc.y + 15);

        doc.moveDown(2);

        const tableTop = doc.y;
        doc.rect(50, tableTop, 500, 20).fill(colors.light);
        doc.fillColor(colors.primary).fontSize(10);

        const colProduct = 60;
        const colSize = 260;
        const colQty = 330;
        const colPrice = 400;
        const colTotal = 480;

        doc.text('PRODUCT', colProduct, tableTop + 5)
           .text('SIZE', colSize, tableTop + 5)
           .text('QTY', colQty, tableTop + 5)
           .text('PRICE', colPrice, tableTop + 5)
           .text('TOTAL', colTotal, tableTop + 5);
        
        doc.moveDown(1);

        let itemY = doc.y;
        
        order.orderedItems.forEach((item, i) => {
            const y = itemY + (i * 25);

            if (i % 2 === 0) {
                doc.rect(50, y - 5, 500, 25).fill('#f9f9f9');
            }
            
            doc.fillColor(colors.primary);

            const productName = item.product.productName;
            const displayName = productName.length > 25 
                ? productName.substring(0, 22) + '...' 
                : productName;
            
            doc.text(displayName, colProduct, y)
               .text(item.size || 'N/A', colSize, y)
               .text(item.quantity.toString(), colQty, y)
               .text(formatCurrency(item.price), colPrice, y)
               .text(formatCurrency(item.price * item.quantity), colTotal, y);
        });

        const tableBottom = itemY + (order.orderedItems.length * 25) + 10;
        doc.y = tableBottom;
        
        drawHorizontalLine(doc.y);
        doc.moveDown(1);

        const deliveryCharge = 88;
        const summaryLabelX = 400; 
        const summaryValueX = 480; 
        
        doc.fontSize(10).fillColor(colors.secondary)
            .text('Delivery:', summaryLabelX, doc.y);
        doc.fontSize(10).fillColor(colors.primary)
            .text(formatCurrency(deliveryCharge), summaryValueX, doc.y - 10, { align: 'left' });
        
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor(colors.secondary)
            .text('TOTAL DUE:', summaryLabelX, doc.y);
        doc.fontSize(10).fillColor(colors.primary)
            .text(formatCurrency(order.finalAmount), summaryValueX, doc.y - 10, { align: 'left' });
        
        doc.moveDown(2);

        doc.rect(50, doc.y, 500, 30).fill(colors.light);
        doc.fillColor(colors.primary).fontSize(12)
           .text(`Order Status: ${order.status.toUpperCase()}`, 0, doc.y + 10, { align: 'center' });
        
        doc.moveDown(3);

        doc.fontSize(10).fillColor(colors.secondary)
           .text('Thank you for shopping with us!', { align: 'center' })
           .text('Please keep this invoice for your records.', { align: 'center' });

        doc.rect(40, 40, 520, doc.y - 30).stroke(colors.border);

        doc.end();
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const retryPayment = async (req, res) => {

    try {
        const { orderId, snum } = req.body;

        console.log('Data in the retry payment:', req.body);

        if (snum == 'retry') {

            const updateOrder = await Order.updateOne({ _id: orderId }, { status: 'Pending' });

            if (updateOrder.modifiedCount > 0) {

                console.log('order success!');
    
                req.session.orderId = orderId
                        
                res.status(200).json({ success: true });
                return;
            }
    
            res.status(500).json({ success: false, message: 'Order not updated' });
            return;
        }

        const updateOrder = await Order.updateOne({ orderId: orderId }, { status: 'Pending' });

        if (updateOrder.modifiedCount > 0) {

            console.log('order success!');

            req.session.orderId = orderId
                    
            res.status(200).json({ success: true });
            return;
        }

        res.status(500).json({ success: false, message: 'Order not updated' });

    } catch (error) {
        console.error('Error while updating the order:', error);
        res.redirect('/pageNotFound');
    }
};

const loadPaymentSuccess = async (req, res) => {

    try {
        
        res.render('user/payment-success')

    } catch (error) {
        
        console.log('Error while loading the payment success!', error);
        res.redirect('/pageNotFound')

    }
}




module.exports = {
    loadCheckOut,
    loadPayment,
    placeOrder,
    loadOrderConfirmation,
    generatePDF,
    loadOrders,
    cancelOrder,
    cancelProduct,
    loadOrderDetails,
    returnOrder,
    paymentFailure,
    downloadInvoice,
    retryPayment,
    loadPaymentSuccess
}