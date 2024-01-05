import lcl from 'cli-color';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { EmbedBuilder } from 'discord.js';
import { InteractionResponseType, InteractionResponseFlags, InteractionType } from 'discord-interactions';
import { verify } from 'discord-verify';

export default async (req: VercelRequest, res: VercelResponse) => {
    try {
        // check for ves and mot keys
        if (!process.env.VES_KEY || !process.env.MOT_KEY) throw new Error('Missing keys!');
        if (req.method !== 'POST') {
            let error = new Error('Method not allowed!');
            error['statusCode'] = 405;
            throw error;
        }

        // verify discord request
        const requestSignature = req.headers['x-signature-ed25519'] as string;
        const requestTimestamp = req.headers['x-signature-timestamp'] as string;
        const requestBody = req.body;
        if (!requestSignature || !requestTimestamp || !requestBody) throw new Error('Invalid request!');

        const isValid = await verify(
            JSON.stringify(requestBody),
            requestSignature,
            requestTimestamp,
            process.env.PUBLIC_KEY,
            crypto.subtle
        )
        if (!isValid) {
            let error = new Error('Invalid request!');
            error['statusCode'] = 401;
            throw error;
        }

        // handle interaction
        if (requestBody.type == InteractionType.PING) {
            return res.status(200).json({
                type: InteractionResponseType.PONG
            });
        }
    } catch (err: any) {
        console.log(`${lcl.redBright('[Vercel - Error]')} ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            success: false,
            message: err['message'] || "Something went wrong!"
        });
    }
};