//_SWIZZLE_FILE_PATH_post-auth-sms-request.js
const { createUser, optionalAuthentication } = require('swizzle-js');
var telnyx = new Telnyx(process.env.TELNYX_KEY);

/*
    POST /auth/sms/request
    {
        phoneNumber: '+15555555555'
    }
*/
router.post('/auth/sms/request', optionalAuthentication, async (request, result) => {
    try{
        const phoneNumber = request.body.phoneNumber;
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        if(request.user){
            await editUser(request.user, {phoneNumber: phoneNumber, verificationCode: verificationCode}, request)
        }
        else{
            await createUser({phoneNumber: phoneNumber, verificationCode: verificationCode}, request)
        }
        
        await telnyx.messages.create({
            from: '+18887881468', 
            to: phoneNumber, 
            text: `{{"Message text"}}: ${verificationCode}`
        });
        
        return result.status(200).json({ message: 'Verification code sent' });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't send verification code"});
    }
});
//_SWIZZLE_FILE_PATH_post-auth-sms-confirm.js
const { searchUsers, optionalAuthentication } = require('swizzle-js');
const jwt = require('jsonwebtoken');

/*
    POST /auth/sms/confirm
    {
        phone_number: '+15555555555',
        code: '123456'
    }
*/
router.post('/auth/sms/confirm', optionalAuthentication, async (request, result) => {
    try{
        const userSearch = searchUsers({phoneNumber: request.body.phone_number, verificationCode: request.body.code})
        if(userSearch.length === 0) {
            return result.status(400).json({ error: 'Invalid code.' });
        }

        const pendingUser = userSearch[0]
        if(pendingUser._deactivated){
            return result.status(401).json({ error: 'User deactivated.' });
        }
        
        const updatedUser = await editUser(pendingUser, { verificationCode: null, isAnonymous: false, updatedAt: new Date() }, request)
        const userId = updatedUser.userId;

        const accessToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_JWT_SECRET_KEY, { expiresIn: '24h' });
        const refreshToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY);
        
        return result.status(200).json({ userId: userId, accessToken, refreshToken });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't confirm your phone number"});
    }
});
//_SWIZZLE_FILE_PATH_post-auth-sms-refresh.js
const { searchUsers, optionalAuthentication } = require('swizzle-js');
const jwt = require('jsonwebtoken');

/*
    POST /auth/refresh
    {
        refreshToken: "<token>"
    }
*/
router.post('/auth/sms/refresh', optionalAuthentication, async (request, result) => {
    try{
        const { refreshToken } = request.body;

        if (!refreshToken) {
            return result.status(400).send({ error: 'Refresh token is required' });
        }
        
        try {
            userId = jwt.verify(refreshToken, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY).userId;
        } catch (err) {
            return result.status(401).send({ error: 'Invalid refresh token' });
        }
                  
        const accessToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_JWT_SECRET_KEY, { expiresIn: '24h' });
        const newRefreshToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY);

        await editUser(userId, {updatedAt: new Date()}, request)

        return result.json({ userId: userId, accessToken: accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't refresh your token"});
    }
});