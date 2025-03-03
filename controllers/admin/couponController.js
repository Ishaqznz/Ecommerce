const Coupon = require('../../model/couponSchema')

const loadCoupon = async (req, res) => {

    try {
        const coupons = await Coupon.find({ isList: true }); 
        res.render('load-coupon', { coupons }); 
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Internal Server Error');
    }
}

const createCoupon = async (req, res) => {

    try {
    
        const { couponName, startDate, expiryDate, offerPrice, minimumPrice } = req.body;

        if (!couponName || !startDate || !expiryDate || !offerPrice || !minimumPrice) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const findCoupon = await Coupon.findOne({ name: couponName })

        if (findCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon is already available!' })
        }

        const newCoupon = new Coupon({
            name: couponName,
            createdOn: new Date(startDate),
            expireOn: new Date(expiryDate),
            offerPrice: parseFloat(offerPrice),
            minimumPrice: parseFloat(minimumPrice),
            isList: true
        });

        await newCoupon.save();

        res.status(201).json({ message: "Coupon created successfully!" });
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const deleteCoupon = async (req, res) => {

    try {

        const { couponName } = req.body

        const deleteCoupon = await Coupon.deleteOne({ name: couponName })

        if (deleteCoupon) {
            return res.status(200).json({ success: true, message: 'Coupon created successfully!' })
        }

        res.status(500).json({ success: false, message: 'Error while deleting coupon!' })

    } catch (error) {

        console.log('Error while creating coupon', error);
        res.redirect('/admin/pageerror')      
    }

}

const getCoupon = async (req, res) => {

    try {
        const couponName = req.params.name
        console.log('coupon name: ', couponName);
        
        const coupon = await Coupon.findOne({ name: couponName })

        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        res.json(coupon);

    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
}

const editCoupon = async (req, res) => {

    try {
        
        console.log('data:: ', req.body)
        const { couponName, startDate, expiryDate, offerPrice, minimumPrice } = req.body

        const updateCoupon = await Coupon.updateOne({ name: couponName }, {
            $set: {
                name: couponName,
                createdOn: startDate,
                expireOn: expiryDate,
                offerPrice: offerPrice,
                minimumPrice: minimumPrice
            }
        })

        if (updateCoupon) {
            return res.status(200).json({ success: true, message: 'Coupon updated successfully!'})
        }

        res.status(500).json({ success: false, message: 'Error while editing the coupon' })

    } catch (error) {

        console.log('Error while creating the coupon', error);
        res.redirect('/admin/pageError')

    }
}
module.exports = {
    createCoupon, 
    loadCoupon,
    deleteCoupon,
    getCoupon,
    editCoupon
}