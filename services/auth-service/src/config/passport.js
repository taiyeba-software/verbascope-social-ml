import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import userModel from '../model/user.model.js';
import config from './config.js';

passport.use(
    new GoogleStrategy(
        {
            clientID: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
            callbackURL: config.GOOGLE_CALLBACK_URL,
            scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const googleID = profile.id;
                const firstName = profile.name?.givenName || 'User';
                const lastName = profile.name?.familyName || '';

                // Find existing user by googleID or email
                let user = await userModel.findOne({
                    $or: [{ googleID }, { email }],
                });

                if (user) {
                    // Link googleID if they registered with email before
                    if (!user.googleID) {
                        user.googleID = googleID;
                        await user.save();
                    }
                    return done(null, user, { isNewUser: false });
                }

                // Create new user
                user = await userModel.create({
                    email,
                    googleID,
                    fullname: { firstName, lastName },
                });

                return done(null, user, { isNewUser: true });
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

export default passport;