//_SWIZZLE_FILE_PATH_post-auth-anonymous.js//
const { searchUsers, createUser, optionalAuthentication } = require('swizzle-js');

/*
    POST /auth/anonymous
    {
        deviceId: '<any id>'
    }
*/
router.post('/auth/anonymous', optionalAuthentication, async (request, result) => {
      
    if(request.user){
        const userIfRequestIsAuthenticated = getUser(request.user)
        if(userIfRequestIsAuthenticated){
            return result.json({ userId: userIfRequestIsAuthenticated.userId });
        }
    } 

    const userIfDeviceIdExists = searchUsers({deviceId: request.body.deviceId})
    if(userIfDeviceIdExists.length > 0){
        return result.json({ userId: userIfDeviceIdExists[0].userId });
    }

    const user = await createUser({deviceId: request.body.deviceId, isAnonymous: true}, request)

    // Create a JWT token
    const accessToken = jwt.sign({ userId: user.userId }, process.env.SWIZZLE_JWT_SECRET_KEY, { expiresIn: '{{"Token expiry"}}h' });
    const refreshToken = jwt.sign({ userId: user.userId }, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY);

    return result.json({ userId: user.userId, accessToken: accessToken, refreshToken: refreshToken });
});
//_SWIZZLE_FILE_SPLIT_//
//_SWIZZLE_FILE_PATH_post-auth-anonymous-refresh.js//
const { searchUsers, optionalAuthentication } = require('swizzle-js');
const jwt = require('jsonwebtoken');

/*
    POST /auth/refresh
    {
        refreshToken: "<token>"
    }
*/
router.post('/auth/anonymous/refresh', optionalAuthentication, async (request, result) => {
    try{
        const { refreshToken } = request.body;

        if (!refreshToken) {
            return result.status(400).send({ error: 'Refresh token is required' });
        }
        
        var userId;
        try {
            userId = jwt.verify(refreshToken, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY).userId;
        } catch (err) {
            return result.status(401).send({ error: 'Invalid refresh token' });
        }
                  
        const accessToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_JWT_SECRET_KEY, { expiresIn: '{{"Token expiry"}}h' });
        const newRefreshToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY);

        await editUser(userId, {updatedAt: new Date()}, request)

        return result.json({ userId: userId, accessToken: accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        console.error(err.message);
        result.status(500).send({error: "Couldn't refresh your token"});
    }
});
