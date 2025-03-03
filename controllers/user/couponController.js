const Coupon = require('../../model/couponSchema')


const applyCoupon = async (req, res) => {

    try {

        const { productPrice, couponCode } = req.body
        
        const findCoupon = await Coupon.findOne({ name: couponCode })

        if (findCoupon) {

            const findMinimumPrice = findCoupon.minimumPrice

            if (productPrice >= findMinimumPrice) {

                req.session.offerPrice = findCoupon.offerPrice

                console.log('offer price stored in session: ', req.session.offerPrice);
                
                res.status(200).json({ success: true, message: 'Applied coupon succesfully!', offerPrice: findCoupon.offerPrice })

                return;
            }   

            res.status(400).json({ success: false, message: `You should buy more than ${ findMinimumPrice } in order to apply ${ couponCode }`}) 
            return;    
        }

        res.status(500).json({success: false, message: 'Coupon not found! '})

    } catch (error) {
        console.log('Error while applying the coupon ', error);
        res.redirect('/pageNotFound')
    }
}


const removeCoupon = async (req, res) => {
    try {
        
        req.session.offerPrice = 0
        res.status(200).json({
            success: true, message: 'Coupon removed successfully!'
        })

    } catch (error) {
        console.log('Error while removing the coupon!', error);
        res.redirect('/pageNotFound')
    }
}

module.exports = {
    applyCoupon,
    removeCoupon
}