//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.sms.request.js
const { createUser, optionalAuthentication } = require('swizzle-js');
var telnyx = new Telnyx(process.env.TELNYX_KEY);

/*
    Request:
    POST /auth/sms/request
    {
        phoneNumber: '+15555555555'
    }

    Response:
    {
        message: '<status message>'
    }
*/
router.post('/auth/sms/request', optionalAuthentication, async (request, result) => {
    try{
        if(request.user){
            return result.status(400).send({error: "Already logged in!"});
        }

        const phoneNumber = request.body.phoneNumber;
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        const userSearch = searchUsers({phoneNumber: phoneNumber})
        if(userSearch.length > 0){
            await editUser(userSearch[0], {verificationCode: verificationCode}, request)
        } else{
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
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.sms.confirm.js
const { searchUsers, optionalAuthentication, signTokens } = require('swizzle-js');
const jwt = require('jsonwebtoken');

/*
    POST /auth/sms/confirm
    {
        phone_number: '+15555555555',
        code: '123456'
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
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

        const { accessToken, refreshToken } = signTokens(userId, '{{"Token expiry"}}');
        
        return result.status(200).json({ userId: userId, accessToken, refreshToken });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't confirm your phone number"});
    }
});