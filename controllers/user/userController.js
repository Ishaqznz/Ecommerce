
const User = require('../../model/userSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const Product = require('../../model/productSchema')
const Category = require('../../model/categorySchema')
const env = require('dotenv').config()


// const user = req.session.user 
// const userData = await User.findOne({_id: user})



const loadHomePage = async (req, res) => {

    try {
        const user = req.session.user 

        if (user) {
            const userData = await User.findOne({_id: user})
            console.log(userData);
            
            res.render('user/home', {
                user: userData, 
            })
        } else {
            console.log('No user found');
            return res.render('user/home')
        }

    } catch (error) {

        console.log('Home page not found!');
        res.status(500).send('Server error!')

    }
}

const pageNotFound = (req, res) => {
    try {
        return res.render('user/error')
    } catch (error) {
        res.status(500).send('Error while loading error page')
    }
}

const pageRedirect = (req, res) => {
    res.redirect('/pageNotFound')
}


const loadSignup = (req, res) => {
    try {
        return res.render('user/signup', {msg: null})
    } catch (error) {
        res.status(500).send('Error while loading signup page')
    }
} 

const loadLogin = (req, res) => {
    try {
        if (!req.session.user) {
            return res.render('user/login', {message: null})
        } else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
        res.status(500).send('Error while loading the login page')
    }
}

const login = async (req, res) => {
    try {
        const {email, password} = req.body
        const findUser = await User.findOne({isAdmin: 0, email: email})

        if (!findUser) {
            return res.render('user/login', {message: 'User not found!'})
        }

        if (findUser.isBlocked) {
            return res.render('user/login', {message: 'User is blocked by admin'})
        }


        const passwordMatch = await bcrypt.compare(password, findUser.password)

        if (!passwordMatch) {
            return res.render('user/login', {message: 'Incorrect password'})
        }

        req.session.user = findUser._id 
        console.log(req.session.user);
        
        console.log(findUser.name);
        res.locals.user = findUser.fullName     
        console.log(findUser.fullName);
        
        res.redirect('/')


    } catch (error) {
        
        console.error('login error', error);
        res.render('user/login', {message: 'login failed. Please try again later'})
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Session destruction error');
                return res.redirect('/pageNotFound')
            } 
            return res.redirect('/login')
        })
    } catch (error) {
        console.log('Logout error', error);
        res.redirect('/pageNotFound')
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        })


        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp} </b>`,

        })

        console.log('otp succesffully sent ', otp);
        

        return info.accepted.length > 0

    } catch (error) {
        console.log('Error sending email', error);
        return false
    }
}

const signUp = async (req, res) => {
    try {

        const {fullName, phone, email, password, confirmPassword} = req.body

        const findUser = await User.findOne({email}) 
        console.log(findUser);
        console.log(req.body);
        
        if (findUser) {
            return res.render('user/signup', {msg: 'email is already existed'})
        }

        const otp = generateOtp()

        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            return res.json('email-error')
        }

        req.session.otp = otp

        if (!req.session.userData) {
            req.session.userData = {fullName, phone, email, password}
        }

        console.log(req.session.userData);
        

        res.render('user/verify-otp', {otp: otp, timer: 60, email: email})
        console.log('OTP sent', otp);
        

     } catch (error) {

        console.log('Signup error', error);
        res.redirect('/pageNotFound')
     }
}

const otpVerified = async (req, res) => {

    try {

        const {fullName, phone, email, password} = req.session.userData

        const pass = await securePassword(password)


        const newUser = new User({
            name: fullName,        
            email: email,          
            password: pass,       
            phoneNumber: phone,
            googleId: generateOtp()
        })
        
        await newUser.save()

        const user = await User.findOne({email: email})

        req.session.user = user._id

        res.locals.user = user.fullName

        res.redirect('/')
        
    } catch (error) {

        console.log(error);
        
        res.status(500).send('error while saving the data into the database')
    }
}


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log('error while securing the password');
    }
}

function randomId() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

const verifyOtp = async (req, res) => {
    try {
        const {otp} = req.body
        console.log(otp);

        if (otp === req.session.otp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const random = randomId()
            const saveUserData=  new User({
                name: user.fullName,
                email: user.email,
                phoneNumber: user.phone,
                password: passwordHash,
                googleId: random
            })
            
            await saveUserData.save()
            req.session.userData = saveUserData._id
            res.json({success: true, redirectUrl: '/'})

        } else {
            res.status(400).json({success: false, message: 'Invalid OTP, Please try again'})
        }
        
    } catch (error) {
        console.log('Error while verifying otp', error);
        res.status(500).json({success: false, message: 'An error occured'})
    }
}

const resendOtp = async (req, res) => {
    try {
        
        const {changeEmail, value} = req.body

        console.log(changeEmail + value);
        

        if (value == 'edit') {

            console.log("It's coming here in otp resend", changeEmail);
            
            const otp = generateOtp()

            req.session.userOtp = otp

            const findEmail = await User.findOne({email: changeEmail})

            if (findEmail) {
                return res.status(500).json({success: false, message: 'Email is already existed!'})
            }
            const emailSent = await sendVerificationEmail(changeEmail, otp)

            if (emailSent) {

                console.log('Resend otp', otp);
                res.status(200).json({success: true, message: 'OTP resend Successfully'})

            } else {

                res.status(500).json({success: false, message: 'Falied to resend OTP. Please try again later'})

            }
            return;
        }
        const {email} = req.session.userData
        if (!email) {
            return res.status(400).json({success: false, message: 'Email not found in session'})
        }

        const otp = generateOtp()
        req.session.userOtp = otp

        const emailSent = await sendVerificationEmail(email, otp)

        if (emailSent) {
            console.log('Resend otp', otp);
            res.status(200).json({success: true, message: 'OTP resend Successfully'})
        } else {
            res.status(500).json({success: false, message: 'Falied to resend OTP. Please try again later'})
        }

    } catch (error) {

        console.error('Error while sending otp', error);
        res.status(500).json({success: false, message: 'Internal Server error! please try again later'})
    }
}

const loadForgotPassword = (req, res) => {
    try {
        res.render('user/forgot-password', {msg: null})
    } catch (error) {
        res.status(500).send('error while loading forgot password section')
    }
}

const forgotPassword = async (req, res) => {

    try {

        const { email, resendOtpValue } = req.body

        if (resendOtpValue) {

            const otp = generateOtp()
            await sendVerificationEmail(email, otp)
            return res.render('user/forgot-otp', {timer: 60, otp: otp, email: email})

        }
        
        const user = await User.findOne({email: email})
        
        if (!user) {

            res.render('user/forgot-password', {msg: 'no user found!'})

        } else {

            const otp = generateOtp()
            await sendVerificationEmail(email, otp)

            res.render('user/forgot-otp', {timer: 60, otp: otp, email: email});

        }
        
    } catch (error) {
        res.status(500).send('error while posting data into forgot password')
    }
}

const resetPassword = async (req, res) => {

    const { email } = req.body

    try {

        res.render('user/reset-password', { msg: null, email: email})

    } catch (error) {
        res.status(500).send('error while loading the reset password section')
    }
}

const resetVerify = async (req, res) => {

    try {
        
        const {email, newPassword} = req.body

           const pass = await securePassword(newPassword)
           await User.updateOne({email: email}, {$set: {password: pass}})
           res.redirect('/login')

    } catch (error) {
        res.status(500).send('error happened while resetting password')
    }
}


const getShopProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const products = await Product.find({}).populate('category').lean();
        const userData = await User.findOne({ _id: user });

        const categories = await Category.find({ isListed: true }).lean();

        const updatedProducts = products.map(product => {
            const originalPrice = product.regularPrice || 0;
            const categoryDiscount = product.category?.categoryOffer || 0;  
            const productDiscount = product.productOffer || 0;  

            const maxDiscount = Math.max(categoryDiscount, productDiscount);
            const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

            return {
                ...product,
                originalPrice,
                finalPrice,
                maxDiscount  
            };
        });

        res.render('user/shop', {
            products: updatedProducts,
            user: userData,
            categories  
        });

    } catch (error) {
        console.log('Error while loading the shop page:', error);
        res.status(500).send('Internal Server Error');
    }
};



const getProductsByCategory = async (req, res) => {
    
    try {
        const categoryId = req.params.categoryId;
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });


        const products = await Product.find({ category: categoryId })
            .populate('category') 
            .lean();

            const categories = await Category.aggregate([
                {
                    $match: { isListed: true }
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: 'category',
                        as: 'products'
                    }
                },
                {
                    $project: {
                        name: 1,
                        categoryOffer: 1, 
                        productCount: { $size: '$products' }
                    }
                }
            ]);
            

        const updatedProducts = products.map(product => {
            const originalPrice = product.regularPrice || 0;
            const categoryDiscount = product.category?.categoryOffer || 0; 
            const productDiscount = product.productOffer || 0;

            const maxDiscount = Math.max(categoryDiscount, productDiscount);
            const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

            return {
                ...product,
                originalPrice,
                finalPrice,
                maxDiscount  
            };
        });

        console.log("Updated Products:", updatedProducts); 

        res.render('user/shop', {
            products: updatedProducts,
            user: userData,
            categories,
            selectedCategory: categoryId
        });
    } catch (error) {
        console.log('Error while loading category products', error);
        res.status(500).send('Internal Server Error');
    }
};


const getProductByPrice = async (req, res) => {
    try {
        const { minPrice, maxPrice, categoryId } = req.query;

        let min = Number(minPrice) || 0;
        let max = Number(maxPrice) || 10000;

        console.log('Received query:', req.query);

        const user = req.session.user;
        const userData = await User.findById(user);
        const categoriesOfShop = await Category.find({ isListed: true }).lean();

        let query = {
            salePrice: { $gte: min, $lte: max },
            isBlocked: false,
            status: 'Available'
        };

        if (categoryId) {
            query.category = categoryId;
        }

        const listProducts = await Product.find(query)
            .populate('category')
            .sort({ createdAt: -1 })
            .lean();

        console.log('Filtered Products:', listProducts);

        const updatedProducts = listProducts.map(product => {
            const originalPrice = product.regularPrice || 0;
            const categoryDiscount = product.category?.categoryOffer || 0;  
            const productDiscount = product.productOffer || 0;  

            const maxDiscount = Math.max(categoryDiscount, productDiscount);
            const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

            return {
                ...product,
                originalPrice,
                finalPrice,
                maxDiscount  
            };
        });

        res.render('user/shop', {
            products: updatedProducts,
            categories: categoriesOfShop,
            user: userData,
            minPrice: min,
            maxPrice: max,
            categoryId: categoryId || null
        });

    } catch (error) {
        console.error('Error filtering products by price:', error);
        res.status(500).send('Server Error');
    }
};



const getMyProfile = async (req, res) => {

    try {
        
        const user = req.session.user
        const userData = await User.findOne({_id: user})
        
        res.render('user/my-profile', {
            user: userData
        })

    } catch (error) {
        
        console.log('Error while loading my Profile');
        res.redirect('/pageNotFound')
    }
}


const checkingValues = async (req, res) => {
   
        console.log('logged session values', req.session);
        console.log('id', req.sessionID);
        console.log('store', req.sessionStore);
    
        const userData = await User.find({_id: req.session.user})
    
        console.log(req.session.user);
        console.log(userData);
        
        
        res.send(`
            req.session: ${req.session},
    
            req.sessionId: ${req.sessionID},
    
            req.sessionStore: ${req.sessionStore}
            `)
}


const changePass = async (req, res) => {
    try {
        
        const { newPassword, currentPwd } = req.body
        const userId = req.session.user

        const findUser = await User.findOne({ _id: userId })


        const passCheck = await bcrypt.compare( currentPwd, findUser.password)

        if (!passCheck) {
            res.status(400).json({ success: false, message: 'password mismatch!' })
            return;
        }

        const hashedNewPass = await bcrypt.hash(newPassword, 10)

        const updatedUser = await User.updateOne({ _id: userId }, {
            password: hashedNewPass
        })

        if (updatedUser.modifiedCount > 0) {
            res.status(200).json({ success: true, message: 'password changed successfully! '})
        }
        
    } catch (error) {
        
        console.log('Error while changing the password: ', error);
        res.redirect('/pageNotFound')

    }
}



const getProductsBySearch = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.redirect('/pageNotFound');
        }

        const userData = await User.findOne({ _id: req.session.user })

        console.log('Searching in the shop:', query);

        const categoriesOfShop = await Category.find({ isListed: true }).lean();

        const listProducts = await Product.find({
            productName: { $regex: query, $options: 'i' }, 
            isBlocked: false,
            status: 'Available'
        }).populate('category').lean();

        const updatedProducts = listProducts.map(product => {
            const originalPrice = product.regularPrice || 0;
            const categoryDiscount = product.category?.categoryOffer || 0;  
            const productDiscount = product.productOffer || 0;  

            const maxDiscount = Math.max(categoryDiscount, productDiscount);
            const finalPrice = originalPrice > 0 ? Math.round(originalPrice * (1 - maxDiscount / 100)) : 0;

            return {
                ...product,
                originalPrice,
                finalPrice,
                maxDiscount  
            };
        });


        console.log('Found products:', listProducts);

        res.render('user/shop', {
            products: updatedProducts,
            categories: categoriesOfShop,
            user: userData,
            searchQuery: query
        });

    } catch (error) {
        console.error('Error while searching:', error);
        res.redirect('/pageNotFound');
    }
};


module.exports = {
    loadHomePage,
    pageNotFound,
    pageRedirect,
    loadSignup,
    loadLogin,
    signUp,
    verifyOtp,
    resendOtp,
    login,
    logout,
    loadForgotPassword,
    forgotPassword,
    resetPassword,
    resetVerify,
    otpVerified,
    getShopProducts,
    getMyProfile,
    checkingValues,
    getProductsByCategory,
    changePass,
    getProductByPrice,
    getProductsBySearch
}