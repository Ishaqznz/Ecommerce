const mongoose = require('mongoose')
require('dotenv').config();


const connectDB = () => {
    mongoose.connect(process.env.mongoURI) .then(() => {
        console.log('Successfully connected to the database');
    }) .catch((error) => {
        console.log('error while connecting to the database', error);
    })
}


module.exports = {
    connectDB
}