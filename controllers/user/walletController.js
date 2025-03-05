const User = require('../../model/userSchema')
const Razorpay = require('razorpay');
require('dotenv').config();
const Wallet = require('../../model/walletSchema')
const crypto = require('crypto');


const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found!' });
        }

        const wallet = await Wallet.findOne({ user: userId });

        if (!wallet) {
            return res.render('user/wallet', { 
                walletBalance: 0, 
                transactions: [], 
                user: user 
            });
        }

        const sortedTransactions = wallet.transaction.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.render('user/wallet', { 
            walletBalance: wallet.balance, 
            transactions: sortedTransactions, 
            user: user 
        });

    } catch (error) {
        console.error('Error while loading the wallet:', error);
        res.status(500).send('Internal Server Error');
    }
};


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});


const upiCheckout = async (req, res) => {

    console.log("It's coming here atleast in the upi");

    const { amount, currency } = req.body;

    console.log('data in the upi: ', req.body);
    

    try {
        const options = {
            amount: parseInt(amount) * 100, 
            currency: currency || "INR",
            payment_capture: 1, 
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
        
    } catch (error) {

        console.log('Error while add the upi payment: ', error);     
        res.status(500).json({ success: false, error: error.message });
    }
}


const payWithWallet = async (req, res) => {

    try {

        const userId = req.session.user
        
        const { paymentAmount } = req.body
        console.log('payment amount: ', paymentAmount);

        const wallet = await Wallet.findOne({ user: userId })

        const walletBalance = wallet ? wallet.balance : 0; 
        console.log('wallet balance: ', walletBalance);
        
        if (walletBalance < paymentAmount) {
            res.status(400).json({ success: false, message: 'Insufficient balance in the wallet!' })
            return;
        }
 
        res.status(200).json({ success: true, message: 'You have an isuffucent balance in the wallet' })
 
    } catch (error) {

        console.log('Error while paying with wallet: ', error);
        res.redirect('/pageNotfound')

    }
}


const createRetryOrder = async (req, res) => {
    
    try {
        const { amount, currency, orderId } = req.body;

        if (!amount || !currency || !orderId) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const receipt = `retry_${orderId}`.slice(0, 40); 

        const options = {
            amount: amount * 100,
            currency,
            receipt,  
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const createAddMoneyOrder = async (req, res) => {

    try {
        const userId = req.session.user;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid amount'
            });
        }

        const user = await User.findById(userId);

        const options = {
            amount: amount * 100, 
            currency: 'INR',
            receipt: `wallet-${userId.slice(-6)}-${Date.now().toString().slice(-6)}`,
            notes: {
                userId: userId,
                type: 'wallet_recharge'
            }
        };        
        
        const order = await razorpay.orders.create(options);
        
        res.json({
            success: true,
            key_id: process.env.RAZORPAY_KEY,
            order: order,
            user: {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber
            }
        });
        
    } catch (error) {
        console.error('Error creating add money order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};


const verifyAddMoneyPayment = async (req, res) => {
    try {
        const userId = req.session.user;
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
        
        const isSignatureValid = generatedSignature === razorpay_signature;
        
        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        
        if (payment.status !== 'captured') {
            return res.status(400).json({
                success: false,
                message: 'Payment not captured'
            });
        }
  
        const amountInRupees = payment.amount / 100;

        let wallet = await Wallet.findOne({ user: userId });
        
        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                balance: 0,
                transaction: []
            });
        }

        wallet.balance += amountInRupees;
        wallet.transaction.push({
            amount: amountInRupees,
            createdAt: new Date(),
            transactionId: razorpay_payment_id,
            type: 'credit',
            productName: ['Wallet Recharge']
        });
        
        await wallet.save();
        
        res.json({
            success: true,
            message: 'Money added to wallet successfully',
            newBalance: wallet.balance
        });
        
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
};



module.exports = {
    loadWallet,
    upiCheckout,
    payWithWallet,
    createRetryOrder,
    createAddMoneyOrder,
    verifyAddMoneyPayment
}