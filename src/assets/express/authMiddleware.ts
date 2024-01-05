import {config as denvConf} from 'dotenv'; denvConf();
import lcl from 'cli-color';
import { Request, Response, NextFunction } from 'express';

export default function (req: Request, res: Response, next: NextFunction) {
    try {
        // Check the request for the correct auth header
        if (!process.env.HTTP_AUTH || !req.headers.authorization) throw new Error('Invalid Auth');
        
        // Auth header should be basic auth
        let authHeader = req.headers.authorization.split(' ');
        if (authHeader[0] !== 'Basic') throw new Error('Invalid Auth');
        if (authHeader[1] !== process.env.HTTP_AUTH) throw new Error('Invalid Auth');

        // Auth is valid
        next();
    } catch(err: any) {
        console.log(`${lcl.redBright(`[Express - Auth]`)} ${err.message}`);
        return res.status(err['statusCode'] || 401).json({
            status: false,
            message: err.message
        });
    }
}