const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userSchema'); // Ensure this path is correct
require('dotenv').config(); // Load environment variables

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('Google Profile:', profile); // Debugging: Log profile info

                // Check if user exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    console.log('User found:', user); // Debugging: Log existing user
                    return done(null, user);
                }

                // Create a new user if not found
                user = new User({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    googleId: profile.id,
                });

                await user.save();
                console.log('New user created:', user); // Debugging: Log new user
                return done(null, user);
            } catch (error) {
                console.error('Error in Google Strategy:', error);
                return done(error, null);
            }
        }
    )
);

// Serialize user to store in session
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id); // Debugging: Log user ID
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        console.log('Deserializing user:', user); // Debugging: Log user info
        done(null, user);
    } catch (err) {
        console.error('Error deserializing user:', err);
        done(err, null);
    }
});

module.exports = passport;
