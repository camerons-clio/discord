const lcl = require('cli-color');
const checkAuth = require('../../utils/auth');
const defaultFetchHeaders = require('../../utils/defaultFetchHeaders');

const { GET_CAR_COMMAND } = require('../../utils/discordCommands');

export default async function handler(req, res) {
    try {
        if (!checkAuth(req.headers['authorization'])) {
            let error = new Error('Unauthorized');
            error['statusCode'] = 401;
            throw error;
        }
        // register commands with discord
        let commandsArray = [GET_CAR_COMMAND];
        let registedCommands = await fetch(`https://discord.com/api/v10/applications/${process.env.DCORD_APP_ID}/commands`, {
            method: 'PUT',
            headers: {
                ...defaultFetchHeaders(),
                "Content-Type": 'application/json',
                "Authorization": `Bot ${process.env.DCORD_TOKEN}`
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
    } catch (err) {
        console.error(`${lcl.redBright('[Vercel - Error]')} ${lcl.yellow(err['statusCode'] || 500)} - ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            success: false,
            message: err['message'] || 'Something went wrong... Whooops :3'
        });
    }
}