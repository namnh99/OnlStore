const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AccountModel = require('../models/account.models/account.model');
const UserModel = require('../models/account.models/user.model');
const jwt = require('jsonwebtoken');
const express = require('express');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

//authentication with JWT
const jwtAuthentication = async (req, res, next) => {
  try {
    res.locals.isAuth = false;
    let token = null;
    if (express().get('env') === 'production') token = req.query.token;
    else token = req.cookies.access_token;

    //if not exist cookie[access_token] -> isAuth = false -> next
    if (!token) {
      next();
      return;
    }
    //verify jwt
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (decoded) {
      const { accountId } = decoded.sub;
      const user = await AccountModel.findById(accountId);
      if (user) {
        res.locals.isAuth = true;
        req.user = user;
      }
    }
    next();
  } catch (error) {
    return res.status(401).json({
      message: 'Unauthorized.',
      error,
    });
  }
};

// ! xác thực với google OAuth2
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/apis/login/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, name } = profile;
        const { familyName, givenName } = name;
        const email = profile.emails[0].value;
        // kiểm tra email đã tồn tại hay chưa
        const localUser = await AccountModel.findOne({
          email,
          authType: 'local',
        });
        if (localUser) return done(null, localUser);

        const user = await AccountModel.findOne({
          googleId: id,
          authType: 'google',
        });
        if (user) return done(null, user);

        // tạo account và user tương ứng
        const newAccount = await AccountModel.create({
          authType: 'google',
          googleId: id,
          email,
        });

        await UserModel.create({
          accountId: newAccount._id,
          email,
          fullName: familyName + ' ' + givenName,
        });

        done(null, newAccount);
      } catch (error) {
        console.log(error);
        done(error, false);
      }
    },
  ),
);

module.exports = {
  jwtAuthentication,
};
