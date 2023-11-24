//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.eth.ts
import { ethers } from "ethers";
import express, { Response } from "express";
import { AuthenticatedRequest, createUser, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
const router = express.Router();

/*
    Request:
    POST /auth/eth
    {
        account: '<account string>',
        signature: '<signature string>',
        "any": "property" //optional, will be added to the user object
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/eth', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
    const account = request.body.account;
    const signature = request.body.signature
    if(!account || !signature){
        return response.status(400).json({ error: 'Email and password are required' });
    }
    var filteredRequestBody = request.body
    delete filteredRequestBody.account
    delete filteredRequestBody.signature
  
    try {
        // The original message that was signed on the client side
        const originalMessage = 'Please sign this message for authentication. Nonce: [nonce]';

        // Recover the address from the signature
        const recoveredAddress = ethers.verifyMessage(originalMessage, signature);

        if (recoveredAddress.toLowerCase() === account.toLowerCase()) {
            const ethUserExists = await searchUsers({ ethAddress: recoveredAddress.toLowerCase() })
            if(ethUserExists.length > 0){
                const { accessToken, refreshToken } = await signTokens(ethUserExists[0].userId, /*{{"Token expiry"}}*/);
                return response.status(200).json({ userId: ethUserExists[0].userId, accessToken, refreshToken });
            } else{
                const newUserObject = { authMethod: "eth", ethAddress: recoveredAddress.toLowerCase(), ...filteredRequestBody }
                const newUser = await createUser(newUserObject, request)
                const { accessToken, refreshToken } = await signTokens(newUser.userId, /*{{"Token expiry"}}*/);
                return response.status(200).json({ userId: newUser.userId, accessToken, refreshToken });
            }

        } else {
            response.status(401).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        response.status(500).json({ error: 'Error verifying signature' });
    }
});

export default router;
