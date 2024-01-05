const lcl = require('cli-color');
const { EmbedBuilder } = require('discord.js');
const { InteractionResponseType, InteractionResponseFlags, InteractionType } = require('discord-interactions');
const { verify } = require('discord-verify');

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            let error = new Error('Method not allowed');
            error['statusCode'] = 405;
            throw error;
        }

        // handle discord interaction auth
        const requestSignature = req.headers['x-signature-ed25519'];
        const requestTimestamp = req.headers['x-signature-timestamp'];
        const requestBody = req.body;
        if (!requestSignature || !requestTimestamp || !requestBody) {
            let error = new Error('Unauthorized');
            error['statusCode'] = 401;
            throw error;
        }
        const isVerified = await verify(
            JSON.stringify(requestBody),
            requestSignature,
            requestTimestamp,
            process.env.DCORD_PUBLIC_KEY,
            crypto.subtle
        );
        if (!isVerified) {
            let error = new Error('Unauthorized');
            error['statusCode'] = 401;
            throw error;
        }

        // handle discord interaction
        console.log(`${lcl.blueBright('[Discord - Info]')} New interaction received!`);

        // handle discord ping (initial handshake)
        if (req.body.type === InteractionType.PING) {
            console.log(`${lcl.greenBright('[Discord - Success]')} Successfully pinged Discord!`);
            return res.status(200).json({
                type: InteractionResponseType.PONG
            });
        }
    } catch (err) {
        console.error(`${lcl.redBright('[Vercel - Error]')} ${lcl.yellow(err['statusCode'] || 500)} - ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            success: false,
            message: err['message'] || 'Something went wrong... Whooops :3'
        });
    }
}