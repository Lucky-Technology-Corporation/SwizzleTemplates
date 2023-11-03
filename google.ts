//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.google.ts
import { OAuth2Client } from 'google-auth-library';
import express, { Response } from "express";
import { searchUsers, createUser, signTokens, optionalAuthentication, AuthenticatedRequest } from "swizzle-js";
const client = new OAuth2Client('{{"Google Client ID"}}');
const router = express.Router();

/*
    Request:
    POST /auth/google
    {
        tokenId: '<response.tokenId from Google>'
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/google', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  const token = request.body.tokenId;
  try {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: '{{"Google Client ID"}}',
    });

    var userId;
    const payload = ticket.getPayload() || {};
    const googleUserId = payload['sub'];
    
    const userIfGoogleIdExists = searchUsers({ googleUserId: googleUserId })
    
    if(userIfGoogleIdExists.length > 0){
        userId = userIfGoogleIdExists[0].userId
    } else{
        //Add additional properties to the user object here if needed
        //Properties are available under the payload object (e.g. payload['email']) 
        //Make sure you request the correct scopes from Google

        const newUserObject = { googleUserId: googleUserId, email: payload['email'] }
        const newUser = await createUser(newUserObject, request)
        userId = newUser.userId
    }
    
    const { accessToken, refreshToken } = signTokens(userId, '{{"Token expiry"}}');

    response.status(200).json({ userId: userId, accessToken, refreshToken });
  } catch (error) {
    response.status(401).json({ error: error });
  }
});
//_SWIZZLE_FILE_PATH_frontend/src/components/GoogleSignInButton.tsx
import React from 'react';
import { useAuth } from 'react-auth-kit';
import { GoogleLogin } from 'react-google-login';
import api from '../Api'; // Adjust the path accordingly

function GoogleSignInButton() {
  const { signIn } = useAuth();

  const handleGoogleSuccess = async (response) => {
    try {
      const { data } = await api.post('/auth/google', { tokenId: response.tokenId });
      
      signIn({
        token: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: {{"Token expiry"}}*60,
        tokenType: "Bearer",
        userId: data.userId,
      });
    } catch (error) {
      console.error('Error during Google Sign-In:', error);
    }
  };

  const handleGoogleFailure = (response) => {
    console.error('Google Sign-In failed:', response);
  };

  return (
    <GoogleLogin
      clientId={'{{"Google Client ID"}}'} // Replace with your Google Client ID
      buttonText="Login with Google"
      onSuccess={handleGoogleSuccess}
      onFailure={handleGoogleFailure}
      cookiePolicy={'single_host_origin'}
    />
  );
}

export default GoogleSignInButton;