//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.google.ts
import { OAuth2Client } from 'google-auth-library';
import express, { Response } from "express";
import { searchUsers, createUser, signTokens, optionalAuthentication, AuthenticatedRequest } from "swizzle-js";
const googleClientId = '{{"Google Client ID"}}'
const client = new OAuth2Client(googleClientId);
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
        audience: googleClientId,
    });

    var userId;
    const payload = ticket.getPayload() || {};
    const googleUserId = payload['sub'];
    
    const userIfGoogleIdExists = await searchUsers({ googleUserId: googleUserId })
    
    if(userIfGoogleIdExists.length > 0){
        userId = userIfGoogleIdExists[0].userId
    } else{
        const newUserObject = { googleUserId: googleUserId, email: payload['email'], authMethod: 'google' }
        const newUser = await createUser(newUserObject, request)
        userId = newUser.userId
    }
    
    const { accessToken, refreshToken } = await signTokens(userId, {{"Token expiry"}});

    response.status(200).json({ userId, accessToken, refreshToken });
  } catch (error) {
    response.status(401).json({ error });
  }
});

export default router;
//_SWIZZLE_FILE_PATH_frontend/src/components/GoogleSignInButton.tsx
import React from 'react';
import { useSignIn } from 'react-auth-kit';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import api from '../Api'; // Adjust the path accordingly

const clientId = '{{"Google Client ID"}}';

function GoogleSignInButton() {
  const signIn = useSignIn();

  const handleGoogleSuccess = async (response) => {
    try {
      const { data } = await api.post('/auth/google', { tokenId: response.credential });
      
      signIn({
        token: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: {{"Token expiry"}}*60,
        tokenType: "Bearer",
        authState: { userId: data.userId },
      });
    } catch (error) {
      console.error('Error during Google Sign-In:', error);
    }
  };

  return (
    <GoogleOAuthProvider clientId={clientId}>
        <GoogleLogin
            onSuccess={credentialResponse => {
                handleGoogleSuccess(credentialResponse);    
            }}
            onError={() => {
                console.log('Login Failed');
            }}
        />
    </GoogleOAuthProvider>
  );
}

export default GoogleSignInButton;