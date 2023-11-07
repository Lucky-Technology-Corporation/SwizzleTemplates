//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.email.signup.ts
import express, { Response } from "express";
import { AuthenticatedRequest, createUser, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
import bcrypt from 'bcrypt'
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
  const email = request.body.email;
  try {
    var userId
    const emailUserExists = await searchUsers({ email: email })
    
    //Check if the email exists
    if(emailUserExists.length > 0){
        return response.status(400).json({ error: 'This email already exists, login instead.' });
    } 

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(request.body.password, salt);
    const newUserObject = { email: email, password: hashedPassword, ...request.body }
    const newUser = await createUser(newUserObject, request)
    userId = newUser.userId
    
    const { accessToken, refreshToken } = await signTokens(userId, {{"Token expiry"}});

    response.status(200).json({ userId: userId, accessToken, refreshToken });
  } catch (error) {
    response.status(401).json({ error: error });
  }
});

module.exports = router;
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.auth.email.login.ts
import express, { Response } from "express";
import { AuthenticatedRequest, createUser, optionalAuthentication, searchUsers, signTokens } from "swizzle-js";
import bcrypt from 'bcrypt'
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

module.exports = router;
