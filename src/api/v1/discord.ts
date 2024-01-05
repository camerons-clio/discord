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
            switch (requestBody.data.name.toLowerCase()) { // They should already be lowercase...
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
    try {
        if (!process.env.APP_ID) throw new Error('No app id found');

        // register commands with discord
        let commandsArray = [GET_CAR_COMMAND];
        let registedCommands = await fetch(`https://discord.com/api/v10/applications/${process.env.APP_ID}/commands`, {
            method: 'PUT',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `Bot ${process.env.TOKEN}`,
                "User-Agent": `Node/${process.version} Github/Joshua-Noakes1/camerons-clio`
            },
            body: JSON.stringify(commandsArray)
        });
        if (registedCommands.status !== 200) {
            let error = new Error('Failed to register commands');
            error['statusCode'] = registedCommands.status || 500;
            throw error;
        }

        return res.status(200).json({
            status: true,
            message: `Successfully registered ${commandsArray.length} command${commandsArray.length > 1 ? 's' : ''}`
        });
    } catch (err: any) {
        console.log(`${lcl.red('[Discord - Error]')} ${err['message']}`)
        return res.status(err['statusCode'] || 500).json({
            status: false,
            message: err.message
        });
    }
});

export default router;