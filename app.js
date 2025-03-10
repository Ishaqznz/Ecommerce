const express = require('express')
const app = express()
const session = require('express-session')
const passport = require('./config/passport')
const env = require('dotenv').config()
const {connectDB} = require('./config/db')
const path = require('path') 
const userRouter = require('./routes/userRouter')
const adminRouter = require('./routes/adminRouter')
const nocache = require('nocache')
const flash = require('express-flash');
const cors = require('cors')


// Connecting database
connectDB()



// using built-in middleware for json payloads and body
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


// setup session
app.use(session ({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72*60*60*1000
    }
}))

app.use(flash())

// Setting res.locals in every route and ejs
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Make user available in all routes
    next();
});




//implmenting nocache
app.use(nocache())

// using passport authentication
app.use(passport.initialize())
app.use(passport.session());

// applying cors
app.use(cors());

// set up view engine and other configuration
app.set('view engine', 'ejs')
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static('public'))
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter)
app.use('/admin', adminRouter)


// Set up server
app.listen(process.env.PORT, '0.0.0.0', () => {
    console.log(`Server started on ${process.env.PORT}`);
})

module.exports = app


