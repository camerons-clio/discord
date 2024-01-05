import { config as denvConf } from 'dotenv'; denvConf();
import { default as lcl } from 'cli-color';
import { InteractionResponseType, InteractionResponseFlags, InteractionType } from 'discord-interactions';
import { verify } from 'discord-verify';
import crypto from 'node:crypto';

import express from 'express';
const router = express.Router();

router.post('/', async function (req, res) {
    try {
        if (req.headers['content-type'] !== 'application/json') {
            let error = new Error('Invalid Request');
            error['statusCode'] = 400;
            throw error;
        }

        // check the request for the correct parameters
        const requestSignature = req.headers['x-signature-ed25519'] as string;
        const requestTimestamp = req.headers['x-signature-timestamp'] as string;
        const requestBody = req.body;
        if (!requestSignature || !requestTimestamp || !requestBody) {
            throw new Error('Invalid Request');
        }

        // verify the request
        const isValid = await verify(
            JSON.stringify(requestBody),
            requestSignature,
            requestTimestamp,
            process.env.PUBLIC_KEY,
            crypto.webcrypto.subtle
        );
        if (!isValid) {
            let error = new Error('Invalid Request');
            error['statusCode'] = 401;
            throw error;
        }

        // handle if discord ping
        if (requestBody.type === InteractionType.PING) {
            return res.status(200).json({
                type: InteractionResponseType.PONG
            });
        }

        // Do command stuff here
    } catch (err: any) {
        console.log(`${lcl.red(['Discord Interaction - Error'])} ${lcl.yellow(err)}`);
        return res.status(err['statusCode'] || 500).json({
            status: false,
            message: err.message
        });
    }
});

export default router;