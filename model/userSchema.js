const mongoose = require('mongoose');
const {Schema} = require('mongoose')

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String, 
        required: true,
        unique: true, 
    },
    phoneNumber: {
        type: String,
        required: false,
        sparse: true,
        default: null
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    }, 
    googleId: {
        type: String,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    isAdmin: {
        type: Boolean,
        default: false 
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: 'wishlist'
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createdAt: {
        type: Date,
        default: Date.now 
    },
    updatedAt: {
        type: Date,
        default: Date.now 
    },
    referralCode: {
        type: String
    },
    
});

// Create a model from the schema
const User = mongoose.model('User', userSchema);

module.exports = User;


