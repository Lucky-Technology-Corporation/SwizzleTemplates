//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.email.signup.ts
import bcrypt from 'bcrypt';
import express, { Response } from "express";
import { AuthenticatedRequest, createUser, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
const router = express.Router();

/*
    Request:
    POST /auth/email/signup
    {
        email: 'example@email.com',
        password: 'password123',
        "any": "property" //optional, will be added to the user object
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/email/signup', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  try {
    const email = request.body.email;
    const password = request.body.password
    if(!email || !password){
        return response.status(400).json({ error: 'Email and password are required' });
    }
  
    var userId
    const emailUserExists = await searchUsers({ email: email })
    
    //Check if the email exists
    if(emailUserExists.length > 0){
        return response.status(400).json({ error: 'This email already exists, login instead.' });
    } 

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUserObject = { email: email, password: hashedPassword, ...request.body }
    const newUser = await createUser(newUserObject, request)
    userId = newUser.userId
    
    const { accessToken, refreshToken } = await signTokens(userId, {{"Token expiry"}});

    response.status(200).json({ userId: userId, accessToken, refreshToken });
  } catch (error) {
    response.status(500).json({ error: error });
  }
});

export default router;
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.email.login.ts
import bcrypt from 'bcrypt';
import express, { Response } from "express";
import { AuthenticatedRequest, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
const router = express.Router();

/*
    Request:
    POST /auth/email/login
    {
        email: 'example@email.com',
        password: 'password123'
    }

    Response:
    {
        userId: '<user id>'
        accessToken: '<token>'
        refreshToken: '<token>'
    }
*/
router.post('/auth/email/login', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  const email = request.body.email;
  try {

    //Check if the email exists
    const emailUserExists = await searchUsers({ email: email })
    if(emailUserExists.length < 1){
        return response.status(400).json({ error: 'This email does not exist, signup instead.' });
    }
    const pendingUser = emailUserExists[0]
    
    //Check if the user is a Google user
    const isEmailUser = pendingUser.authMethod == 'email'
    if(!isEmailUser){
        return response.status(400).json({ error: 'This email is connected to another authentication method' });
    }

    //Check if the password is correct
    const passwordMatch = await bcrypt.compare(request.body.password, pendingUser.password);
    if(!passwordMatch){
        return response.status(401).json({ error: 'Incorrect password' });
    }
    
    const { accessToken, refreshToken } = await signTokens(pendingUser.userId, {{"Token expiry"}});
    response.status(200).json({ userId: pendingUser.userId, accessToken, refreshToken });
  } catch (error) {
    response.status(401).json({ error: error });
  }
});

export default router;
//_SWIZZLE_FILE_PATH_frontend/src/components/EmailSignup.tsx
import api from "../Api";
import { useSignIn } from 'react-auth-kit'
import { useState } from "react";

function EmailSignup() {
    const signIn = useSignIn()
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignup = async (event) => {
        event.preventDefault();

        try{
            const { data } = await api.post('/auth/email/signup', { email, password })

            signIn({
                token: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: {{"Token expiry"}}*60,
                tokenType: "Bearer",
                authState: { userId: data.userId },
            });

        } catch (error) {
            console.error('Error during sign up:', error);
        }
    }

    return (
        <form onSubmit={handleSignup} className="flex flex-col items-center">
            <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="px-4 py-2 rounded border border-gray-300"
            />
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="px-4 py-2 rounded border border-gray-300"
            />
            <button
                type="submit"
                className="bg-indigo-700 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded mt-4"
            >
                Sign Up
            </button>
        </form>
    )
}

export default EmailSignup;
//_SWIZZLE_FILE_PATH_frontend/src/components/EmailLogin.tsx
import api from "../Api";
import { useSignIn } from 'react-auth-kit'
import { useState } from "react";

function EmailLogin() {
    const signIn = useSignIn()
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (event) => {
        event.preventDefault();

        try{
            const { data } = await api.post('/auth/email/login', { email, password })

            signIn({
                token: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: {{"Token expiry"}}*60,
                tokenType: "Bearer",
                authState: { userId: data.userId },
            });

        } catch (error) {
            console.error('Error during login:', error);
        }
    }

    return (
        <form onSubmit={handleLogin} className="flex flex-col items-center">
            <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="px-4 py-2 rounded border border-gray-300"
            />
            <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="px-4 py-2 rounded border border-gray-300"
            />
            <button
                type="submit"
                className="bg-indigo-700 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded mt-4"
            >
                Login
            </button>
        </form>
    )
}

export default EmailLogin;