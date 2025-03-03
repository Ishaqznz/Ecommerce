const User = require('../../model/userSchema')


const loadAccount = async (req, res) => {

    try {

        const userId = req.session.user

        console.log('User Id is here', userId);
        
        const userData = await User.findOne({_id: userId})

        console.log('user datas', userData);
        
        
        res.render('user/account', {
            user: userData
        })
    } catch (error) {
        
        console.log('error while loading the account page', error);
        res.redirect('/pagenotfound')
    }
}


const loadEditAccount = async (req, res) => {

    try {

        const userId = req.session.user
        
        const userData = await User.findOne({ _id: userId })
        console.log('user datas: ', userData);
        

        res.render('user/edit-account', {
            user: userData
        })

    } catch (error) {
        
        console.log('Error while loading the edit account page', error);
        res.redirect('/pageNotFound')
        
    }
}

const verifyOtp = async (req, res) => {

    try {
        
        const serverOtp = req.session.userOtp
        console.log(serverOtp);

        const { otpValue } = req.body

        console.log('client otp', otpValue);
        console.log('server otp', serverOtp);
        

        if (parseInt(serverOtp) == parseInt(otpValue)) {
            return res.status(200).json({success: true, message: 'Successfully verified'})
        }
        return res.status(500).json({success: false, message: 'Invalid OTP! Please try again'})
        
    } catch (error) {

        console.log('error while verifying otp', error);
        res.redirect('/pageNotFound')
    }
}

const saveEmail = async (req, res) => {

    try {
        
        const userId = req.session.user
        const { changeEmail } = req.body
        console.log('change email ', changeEmail);
        
        const changingEmail = await User.updateOne({ _id: userId }, { $set: { email: changeEmail } })

        console.log('changing email', changingEmail);

        if (changingEmail.modifiedCount > 0) {

            return res.status(200).json({success: true, message: 'Successfully email updated!'})

        }

        return res.status(500).json({ success: false, message: 'Error while updating the email id!'})


    } catch (error) {

        console.log('Error while updating the email id', error);
        res.redirect('/pageNotFound')   
    }
}

const saveDetails = async (req, res) => {

    try {
        
        const { fullName, email, mobile} = req.body
        const userId = req.session.user

        const updateData = await User.updateOne({ _id: userId }, { $set: {
            name: fullName,
            email: email,
            phoneNumber: mobile
        }})

        if (updateData.modifiedCount > 0) {
            return res.status(200).json({success: true, message: 'Successfully updated the user data!'})
        }

        return res.status(500).json({ success: false, message: 'error while updating the details!'})

    } catch (error) {
        
        console.log('Error while updating the data', error);
        res.redirect('/pageNotFound')
        
    }
}

module.exports = {
    loadAccount,
    loadEditAccount,
    verifyOtp,
    saveEmail,
    saveDetails
}