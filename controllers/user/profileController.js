
const User = require('../../model/userSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const Product = require('../../model/productSchema')
const Address = require('../../model/addressSchema')
const env = require('dotenv').config()
const mongoose = require('mongoose')

const loadAddress = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });

        if (!userData) {
            return res.status(404).json({ message: "User not found" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 3;  
        const skip = (page - 1) * limit;

        const userAddressData = await Address.findOne({ userId: userData._id });

        if (!userAddressData || !userAddressData.address || userAddressData.address.length === 0) {
            return res.render('user/add-address', {
                user: userData,
                userAddress: [],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    limit: limit,
                    totalItems: 0
                }
            });
        }

        const totalItems = userAddressData.address.length;
        const totalPages = Math.ceil(totalItems / limit);

        const paginatedAddresses = userAddressData.address.slice(skip, skip + limit);

        console.log('Paginated Addresses:', JSON.stringify(paginatedAddresses, null, 2));

        res.render('user/add-address', {
            user: userData,
            userAddress: paginatedAddresses, 
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                limit: limit,
                totalItems: totalItems
            }
        });

    } catch (error) {
        console.error('Error while loading the address section:', error);
        res.redirect('/pageNotFound');
    }
};




const addAddress = async (req, res) => {

    try {

        console.log('address data: ', req.body);
        
        
        if (!req.session.user) {
            return res.status(401).json({ message: "Unauthorized. Please log in." });
        }

        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })

        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        console.log(addressType);
        
        let userAddress = await Address.findOne({ userId: userData._id });

        if (!userAddress) {

            const newAddress = new Address ({
                userId: userData._id,
                address: [{
                    addressType, name, city, landMark, state, pincode, phone, altPhone
                }]
            })

            await newAddress.save()
        } else {
            userAddress.address.push({
                addressType, name, city, landMark, state, pincode, phone, altPhone
            })
            await userAddress.save()
        }

        const savedUserAddress = await Address.findOne({userId: userData._id})
        console.log(savedUserAddress);

        const findUser = await User.findOne({_id: req.session.user})
        console.log(findUser);
        
        res.status(201).json({"message": "success"})

    } catch (error) {

        console.log('error happened while posting the address', error);
        res.status(500).json({"message": "failed"})
    }
}

const deleteAddress = async (req, res) => {


    try {
        
        const addressId = req.params.id;
        const user = req.session.user
        
        console.log(addressId);

        const addressObjectId = new mongoose.Types.ObjectId(addressId);
        
        const result = await Address.updateOne(
            { userId: user },
            { $pull: { address: { _id: addressObjectId } } } 
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "Address not found" });
        }

        console.log('Deleted successfully', result);
        res.status(200).json({ message: "Address deleted successfully" });
        

    } catch (error) {
        
        console.error("Error deleting address:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

const editAddress = async (req, res) => {

    try {
        const addressId = req.params.id;
        const user = req.session.user;
        const updatedData = req.body; 

        console.log("Updating Address ID:", addressId);

        const addressObjectId = new mongoose.Types.ObjectId(addressId);

        const result = await Address.updateOne(
            { userId: user, "address._id": addressObjectId },
            { $set: { "address.$": updatedData } } 
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "Address not found or not updated" });
        }

        console.log("Updated successfully", result);
        res.status(200).json({ message: "Address updated successfully" });

    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }

}


module.exports = {
    addAddress,
    loadAddress,
    deleteAddress,
    editAddress
}