import dotenv from "dotenv";
dotenv.config();


import { UserModel } from "../db";
import express, {Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import bcrypt from "bcrypt";
import { authMiddleware } from "../middleware/authmiddleware";

const AuthRouter = express.Router();

AuthRouter.post("/signup", async (req: Request, res: Response) => {
    const requirebody = z.object({
        username: z.string().min(3, "username cannot be less than 3 characters").max(60, "Username must be less than 10 characters"),
        password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/, {
            message: "Password must contain 8-20 letters, atleast one uppercase, one lowercase, one number, one special character"
        })
    });

    const parseDataWithSuccess = requirebody.safeParse(req.body);

    if (!parseDataWithSuccess.success) {
        const errorMessages = parseDataWithSuccess.error.issues.map(issue => issue.message);

        res.status(411).json({
            message: "Incorrect format of credentials!",
            error: errorMessages,
        });
        return
    }

    const username = req.body.username;
    const password = req.body.password;
    let errorthrown = false;

    try {
        const hashedpassword = await bcrypt.hash(password, 5);

        await UserModel.create({
            username: username,
            password: hashedpassword
        })

        res.json({
            message: "You are signed up!"
        })
    } catch (e) {
        res.status(403).json({
            message: "User already exits"
        })
    }
})

AuthRouter.post("/signin", async (req: Request, res: Response) => {
    const username = req.body.username;
    const password = req.body.password;
    const response = await UserModel.findOne({
        username: username
    });

    if (!response) {
        res.json({
            message: "User is not present in the database"
        })
        return;
    }

    const passwordMatch = await bcrypt.compare(password, response.password as string);

    if (passwordMatch) {
        const token = jwt.sign({
            id: response._id
        }, process.env.JWT_SECRET as string);
        res.json({
            message: "You are succesfully signed in!!",
            token: token
        })
    }
    else {
        res.status(403).json({
            message: "Incorrect Signin credential!! Signin Failed!!"
        })
    }
})

AuthRouter.get("/api/v1/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = await UserModel.findById(req.userId).select("username email");
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json({
        username: user.username,
        email: user.email
      });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

export default AuthRouter;