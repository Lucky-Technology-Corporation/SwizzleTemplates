//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.anonymous.js
const { searchUsers, createUser, optionalAuthentication, signTokens } = require('swizzle-js');

/*
    Request:
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

    const { accessToken, refreshToken } = signTokens(userId, '{{"Token expiry"}}');

    return result.json({ userId: userId, accessToken: accessToken, refreshToken: refreshToken });
});