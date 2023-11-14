const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const { validatePassword, isSignedIn, verifyUser, validateNickname } = require('../middleware');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const passport = require('passport')
const redis = require('redis');
require('dotenv').config();


const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
    legacyMode: true, // 반드시 설정 !!
});
redisClient.on('connect', () => {
    console.info('Redis connected!@@');
});
redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});
redisClient.connect().then(); // redis v4 연결 (비동기)
const redisCli = redisClient.v4; // 기본 redisClient 객체는 콜백기반인데 v4버젼은 프로미스 기반이라 사용


router.get('/signup', (req, res) => {
    res.render('users/signup');
});

router.get('/signup2', (req, res) => {
    res.render('users/signup2');
});

router.get('/forgotpwd', (req, res) => {
    res.render('users/forgotPwd');
});

router.get('/userinfo', isSignedIn, (req, res) => {
    res.render('users/checkuser');
});
router.get('/modifyUserInfo', (req, res) => {
    //페이지를 잘못 찾았을 때 표시할 페이지도 만들어야 할듯함.
    res.redirect('/index');
});
router.post('/modifyUserInfo', isSignedIn, verifyUser, catchAsync( async(req, res) => {
    const{ nickname, email } = req.user;
    res.render('users/modifyUserInfo', {nickname, email});
}));

router.put('/saveUserInfo', isSignedIn, validateNickname, catchAsync( async(req, res) => {

    const userNick = {nickname: req.body.nickname};
    await User.findByIdAndUpdate(req.user.id, userNick);
    res.status(200).json({ok: true});
}));

router.post('/forgotpwd/temppwd', catchAsync( async(req, res) => {
    const { email } = req.body;
    const user = await User.find({email:email});
    const randomString = Math.random().toString(36).slice(2);

    await user[0].setPassword(randomString);
    await user[0].save();

    const smtpTransport = nodemailer.createTransport({
        service: 'gmail', // 사용할 메일 서비스
        auth: {
          user: process.env.NODE_MAILER_ID,
          pass: process.env.NODE_MAILER_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const mailOptions = {
        from: process.env.NODE_MAILER_ID,
        to: email,
        subject: "temporary password",
        text: "nodemailer 테스트 메일입니다.",
        html: `<p>임시 비밀번호는 ${randomString} 입니다. 로그인 후 반드시 비밀번호를 변경해 주세요.</p>`
      };

      await smtpTransport.sendMail(mailOptions, (error, responses) => {
        if (error) {
          res.status(400).json({ ok: false });
        } else {
          res.status(200).json({ ok: true });
        }
        smtpTransport.close();
      });

      res.status(200).json({ ok: true });
}));

router.post('/forgotpwd/check', catchAsync( async(req, res) => {
    const {email} = req.body;
    console.log("email체크: ", email);
    if(email) {
        const user = await User.find({email:email});
        if(user.length > 0){
            return res.send('ok');
        }
        if(user.length == 0) {
            return res.send('notok');
        }
    }
    res.send('notok');
}));

router.get('/signup/check', catchAsync( async(req, res) => { 
    const {email, nickname} = req.query;
    if(email){
        const user = await User.find({email: email}); // user가 []인데 Boolean이 왜 true가 나오지?, query객체의 키값을(Object.keys()) 사용해서 한 줄로 하려고 했지만 변수를 인식하지 못함.
        if(user.length == 0){
            return res.send("ok");
        }
    }
    if(nickname){
        const user = await User.find({nickname: nickname}); 
        if(user.length == 0){
            return res.send("ok");
        }
    }
    res.send("notok")
}));

router.get('/signup/verifyemail', catchAsync( async(req, res) => {
    const { email } = req.query;
    const payload = Math.floor(100000 + Math.random() * 900000);

    await redisCli.set(email, payload); // OK
    await redisCli.expire(email, 180);
    
    const smtpTransport = nodemailer.createTransport({
        service: 'gmail', // 사용할 메일 서비스
        auth: {
          user: process.env.NODE_MAILER_ID,
          pass: process.env.NODE_MAILER_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    
      const mailOptions = {
        from: process.env.NODE_MAILER_ID,
        to: email,
        subject: "Message title",
        text: "nodemailer 테스트 메일입니다.",
        html: `<p>인증번호는 ${payload} 입니다.</p>`
      };

      await smtpTransport.sendMail(mailOptions, (error, responses) => {
        if (error) {
          res.status(400).json({ ok: false });
        } else {
          res.status(200).json({ ok: true });
        }
        smtpTransport.close();
      });

      res.status(200).json({ ok: true });
}));

router.post('/signup/verifycode', catchAsync( async(req, res) => {
    const {userCode, email} = req.body;햣
    let redisData = await redisCli.get(email); // 123

    if( userCode === redisData) {
        return res.status(200).json('ok');
    }
    if(!redisData) {
        return res.status(400).json('not exist');
    }
    if(userCode != redisData){
        return res.status(400).json('incorrect');
    }
}));

router.post('/signup', catchAsync( async(req, res, next) => {
    try{
        const {email, nickname, password} = req.body;
        const user = new User({email, nickname});
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {  // req.login()  => passport doc 참고
            if(err) return next(err);
            res.redirect('/index');
        });
    } catch (e) {
        res.redirect('/signup');
    }
}));

router.get('/signin', (req, res) => {
    const {redirectUrl} = req.query
    if(!req.session.backTo){    // navbar를 클릭해서 로그인 후 페이지 돌아가기 관련.
        req.session.backTo = redirectUrl
    }
    res.render('users/signin', {redirectUrl});
});

router.post('/signin', passport.authenticate('local', { failureFlash: true, failureRedirect: '/signin', keepSessionInfo: true }), (req, res) => {
    const redirectUrl = req.session.backTo || `/index`;
    delete req.session.backTo;
    res.redirect(redirectUrl);
});

router.get('/signout', (req, res) => {
    const redirectUrl = req.query.redirectUrl;
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        if(redirectUrl){
            return res.redirect(`${redirectUrl}`);
        }
        res.redirect(`/index`);
    });
});

router.get('/currentUser', (req, res) => {
    res.json(req.user.nickname);
});

module.exports = router;