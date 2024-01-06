const lcl = require('cli-color');
const { EmbedBuilder } = require('discord.js');
const { InteractionResponseType, InteractionResponseFlags, InteractionType } = require('discord-interactions');
const { verify } = require('discord-verify');
const defaultFetchHeaders = require('../../utils/defaultFetchHeaders');
const dateTime = require('../../utils/dateTime');
const fetch = require('node-fetch');

// The DVLA Returns the color as a work like "BLUE" or "RED" so we need to convert it to a hex code for the embed
const { GET_CAR_COMMAND } = require('../../utils/discordCommands');
let carColors = { "BEIGE": "#F5F5DC", "BLACK": "#000000", "BLUE": "DarkBlue", "BRONZE": "#CD7F32", "BROWN": "#A52A2A", "BUFF": "#F0DC82", "CREAM": "#FFFDD0", "GOLD": "#FFD700", "GREEN": "#008000", "GREY": "#808080", "IVORY": "#FFFFF0", "MAROON": "#800000", "ORANGE": "#FFA500", "PINK": "#FFC0CB", "PURPLE": "#800080", "RED": "#FF0000", "SILVER": "#C0C0C0", "TURQUOISE": "#40E0D0", "WHITE": "#FFFFFF", "YELLOW": "#FFFF00" };
let registerMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", 'November', "December"];

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
        if (requestBody.type === InteractionType.PING) {
            console.log(`${lcl.greenBright('[Discord - Success]')} Successfully pinged Discord!`);
            return res.status(200).json({
                type: InteractionResponseType.PONG
            });
        }

        if (requestBody.type === InteractionType.APPLICATION_COMMAND) {
            console.log(`${lcl.blueBright('[Discord - Info]')} Received command: "${requestBody.data.name}"`);
            switch (requestBody.data.name?.toString().toLowerCase()) {
                default:
                    console.log(`${lcl.yellowBright('[Discord - Warn]')} Unknown command: "${requestBody.data.name}"`);
                    let errorEmbed = new EmbedBuilder()
                        .setTitle('Unknown command')
                        .setDescription(`The command "${requestBody.data.name}" is unknown. Please try again.`)
                        .setColor('#FF6961')
                        .setTimestamp();
                    return res.status(200).json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            embeds: [errorEmbed.toJSON()],
                            flags: InteractionResponseFlags.EPHEMERAL
                        }
                    });
            }
        }
    } catch (err) {
        console.error(`${lcl.redBright('[Vercel - Error]')} ${lcl.yellow(err['statusCode'] || 500)} - ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            success: false,
            message: err['message'] || 'Something went wrong... Whooops :3'
        });
    }
}