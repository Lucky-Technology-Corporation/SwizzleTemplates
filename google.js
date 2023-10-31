//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.google.js
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { searchUsers, createUser } = require('swizzle-js');

/*
    Request:
    POST /auth/google
    {
        tokenId: 'response.tokenId from Google>'
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
app.post('/auth/google', async (req, res) => {
  const token = req.body.tokenId;
  try {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });

    var userId;
    const payload = ticket.getPayload();
    const googleUserId = payload['sub'];
    
    const userIfGoogleIdExists = searchUsers({ googleUserId: googleUserId })
    
    if(userIfGoogleIdExists.length > 0){
        userId = userIfGoogleIdExists[0].userId
    } else{
        //Add additional properties to the user object here if needed
        //Properties are available under the payload object (e.g. payload['email']) 
        //Make sure you request the correct scopes from Google

        const newUserObject = { googleUserId: googleUserId, email: payload['email'] }
        const newUser = await createUser(newUserObject, req)
        userId = newUser.userId
    }
    
    const { accessToken, refreshToken } = signTokens(userId, '{{"Token expiry"}}');

    res.status(200).json({ userId: userId, accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ error: error });
  }
});