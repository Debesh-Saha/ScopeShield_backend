import dotenv from "dotenv";
dotenv.config();

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";;

export const authMiddleware= (req: Request, res: Response, next: NextFunction)=>{
    const header= req.headers["authorization"];
    const decoded= jwt.verify(header as string, process.env.JWT_SECRET as string);

    if(decoded){
        if(typeof decoded=== "string"){
            res.status(403).json({
                message: "Invalid Token Payload"
            })
            return;
        }
        req.userId= (decoded as JwtPayload).id;
        next()
    } else{
            res.status(403).json({
                message: "You are not logged in"
            })
        }
}