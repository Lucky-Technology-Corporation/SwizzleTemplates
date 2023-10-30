//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.google.js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { db } = require('swizzle-js');
const { searchUsers, createUser, optionalAuthentication } = require('swizzle-js');

/*
    POST /auth/google
    {
        token: "<response.tokenId from Google>"
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
app.post('/auth/google', async (req, res) => {
  const token = req.body.token;
  try {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    var userId;
    const payload = ticket.getPayload();
    const googleUserId = payload['sub'];
    const userIfGoogleIdExists = searchUsers({googleUserId: googleUserId})
    if(userIfGoogleIdExists.length > 0){
        userId = userIfGoogleIdExists[0].userId
    } else{
        //Add additional properties to the user object here if needed
        //Properties are available under the payload object (e.g. payload["email"]) 
        //Make sure you request the correct scopes from Google
        const newUserObject = { googleUserId: googleUserId, email: payload["email"] }
        const newUser = await createUser(newUserObject, req)
        userId = newUser.userId
    }
    
    const accessToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_JWT_SECRET_KEY, { expiresIn: '{{"Token expiry"}}h' });
    const refreshToken = jwt.sign({ userId: userId }, process.env.SWIZZLE_REFRESH_JWT_SECRET_KEY);

    res.status(200).json({ userId: userId, accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ error: error });
  }
});
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.google.refresh.js
/*
    POST /auth/google/refresh
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
router.post('/auth/google/refresh', optionalAuthentication, async (request, result) => {
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
