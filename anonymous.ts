//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.anonymous.ts
import express, { Response } from "express";
import { AuthenticatedRequest, createUser, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
const router = express.Router();

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
router.post('/auth/anonymous', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
    
    const { deviceId } = request.body;
    if (!deviceId) {
        return response.status(400).send({ error: 'Device id is required' });
    }

    if(request.user){
        return response.status(400).send({error: "Already logged in!"});
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

    return response.json({ userId: userId, accessToken: accessToken, refreshToken: refreshToken });
});