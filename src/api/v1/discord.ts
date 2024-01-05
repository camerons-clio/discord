import { config as denvConf } from 'dotenv'; denvConf();
import { default as lcl } from 'cli-color';
import { InteractionResponseType, InteractionResponseFlags, InteractionType } from 'discord-interactions';
import { verify } from 'discord-verify';
import crypto from 'node:crypto';
import authMiddleware from '../../assets/express/authMiddleware';

import { GET_CAR_COMMAND } from '../../assets/discord/commands';

import express from 'express';
const router = express.Router();

// Handle Discord Interactions
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
        if (requestBody.type === InteractionType.APPLICATION_COMMAND) {
            switch(requestBody.data.name.toLowerCase()) { // They should already be lowercase...
                case GET_CAR_COMMAND.name.toLowerCase():
                        // get the reg from the request
                        const reg = requestBody.data.options[0].value;
                        console.log(reg);

                        return res.status(200).json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `You requested ${reg}`
                            }
                        });
                    break;
                default:
                    console.log(`${lcl.red('[Discord Interaction - Error]')} Invalid Command`);
                    return res.status(400).json({
                        status: false,
                        message: 'Invalid Command'
                    });
            }
        }
    } catch (err: any) {
        console.log(`${lcl.red('[Discord Interaction - Error]')} ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            status: false,
            message: err.message
        });
    }
});

// Register Commands
router.get('/register', authMiddleware, async function (req, res) {
    return res.status(200).json({
        status: true,
        message: 'Registering Commands'
    });
});

export default router;