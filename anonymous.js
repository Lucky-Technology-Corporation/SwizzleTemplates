//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.anonymous.js
const { searchUsers, createUser, optionalAuthentication, signTokens } = require('swizzle-js');

/*
    POST /auth/anonymous
    {
        deviceId: '<any id>'
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/anonymous', optionalAuthentication, async (request, result) => {
    
    const { deviceId } = request.body;
    if (!deviceId) {
        return result.status(400).send({ error: 'Device id is required' });
    }

    if(request.user){
        return result.status(400).send({error: "Already logged in!"});
    } 

    var userId;
    const userIfDeviceIdExists = searchUsers({deviceId: deviceId})

    if(userIfDeviceIdExists.length > 0){
        userId = userIfDeviceIdExists[0].userId
    } else{
        const user = await createUser({deviceId: deviceId, isAnonymous: true}, request)
        userId = user.userId
    }

    const { accessToken, refreshToken } = signTokens(userId);

    return result.json({ userId: userId, accessToken: accessToken, refreshToken: refreshToken });
});
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.anonymous.refresh.js
const { searchUsers, optionalAuthentication, signTokens } = require('swizzle-js');
const jwt = require('jsonwebtoken');

/*
    POST /auth/anonymous/refresh
    {
        refreshToken: "<token>"
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/anonymous/refresh', optionalAuthentication, async (request, result) => {
    try{
        const { refreshToken } = request.body;

        if (!refreshToken) {
            return result.status(400).send({ error: 'Refresh token is required' });
        }

        const tokens = refreshTokens(refreshToken, '{{"Token expiry"}}');
        
        if(tokens == null){
            return result.status(401).send({ error: 'Invalid refresh token' });
        }
        
        await editUser(userId, {updatedAt: new Date()}, request)

        return result.json({ userId: userId, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't refresh your token"});
    }
});
