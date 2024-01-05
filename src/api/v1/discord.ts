import { config as denvConf } from 'dotenv'; denvConf();
import { default as lcl } from 'cli-color';
import { EmbedBuilder } from 'discord.js';
import { InteractionResponseType, InteractionResponseFlags, InteractionType } from 'discord-interactions';
import { verify } from 'discord-verify';
import crypto from 'node:crypto';
import authMiddleware from '../../assets/express/authMiddleware';
import defaultFetchHeaders from '../../assets/fetch/defaultHeaders';
import dateTime from '../../assets/express/dateTime';

import { GET_CAR_COMMAND } from '../../assets/discord/commands';
// The DVLA Returns the color as a work like "BLUE" or "RED" so we need to convert it to a hex code for the embed
let carColors = { "BEIGE": "#F5F5DC", "BLACK": "#000000", "BLUE": "DarkBlue", "BRONZE": "#CD7F32", "BROWN": "#A52A2A", "BUFF": "#F0DC82", "CREAM": "#FFFDD0", "GOLD": "#FFD700", "GREEN": "#008000", "GREY": "#808080", "IVORY": "#FFFFF0", "MAROON": "#800000", "ORANGE": "#FFA500", "PINK": "#FFC0CB", "PURPLE": "#800080", "RED": "#FF0000", "SILVER": "#C0C0C0", "TURQUOISE": "#40E0D0", "WHITE": "#FFFFFF", "YELLOW": "#FFFF00" };
let registerMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", 'November', "December"];

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
                    try {
                        // get the reg from the request
                        const carRegNumber = requestBody.data.options[0].value?.toString().toUpperCase().replace(/\s/g, '').trim();
                        if (carRegNumber.length < 2 || carRegNumber.length > 7) throw new Error('Invalid Registration Number');

                        // try to get the car data from VES and MOT
                        // get VES
                        let vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
                            method: 'POST',
                            headers: {
                                ...defaultFetchHeaders(),
                                "Content-Type": 'application/json',
                                "x-api-key": process.env.VES_KEY,
                            },
                            body: JSON.stringify({
                                registrationNumber: carRegNumber
                            })
                        });
                        if (vesDataRaw.status >= 500) throw new Error('VES Service Error');
                        let vesData = await vesDataRaw.json();

                        // get MOT
                        let motDataRaw = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${carRegNumber}`, {
                            headers: {
                                ...defaultFetchHeaders(),
                                "Content-Type": 'application/json',
                                "x-api-key": process.env.MOT_KEY,
                            }
                        });
                        if (motDataRaw.status >= 500) throw new Error('MOT Service Error');
                        let motData = await motDataRaw.json();

                        // make ves data embed
                        let embedsToSend = [];
                        if (vesDataRaw.status === 200) {
                            try {
                                // the ves api returns all words as uppercase
                                let carMake = vesData['make'].charAt(0).toUpperCase() + vesData['make'].slice(1).toLowerCase();
                                let carColour = vesData['colour'].charAt(0).toUpperCase() + vesData['colour'].slice(1).toLowerCase();

                                let vesEmbed = new EmbedBuilder()
                                    .setTitle(`${carMake} - "${vesData['registrationNumber']}" (${vesData['yearOfManufacture']} - ${carColour})`)
                                    .setThumbnail(`https://www.carlogos.org/car-logos/${carMake.toLowerCase()}-logo.png`)
                                    .setColor(carColors[carColour?.toString().toUpperCase()] || 'Random')
                                    .setTimestamp();

                                // the ves api will only return keys if they have a value so we need to check if they exist
                                vesEmbed.addFields([{ "name": "Make", "value": carMake, "inline": true }])
                                if (vesData['monthOfFirstRegistration']) {
                                    // the first registration date is in the format "YYYY-MM"
                                    let firstRegMonth = parseInt(vesData['monthOfFirstRegistration'].split("-")[1]);
                                    let firstRegYear = parseInt(vesData['monthOfFirstRegistration'].split("-")[0]);
                                    vesEmbed.addFields([{ "name": "First Registered", "value": `${registerMonthNames[firstRegMonth - 1]} ${firstRegYear}`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['monthOfFirstDvlaRegistration']) {
                                    // again based on the format "YYYY-MM"
                                    let firstDvlaRegMonth = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[1]);
                                    let firstDvlaRegYear = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[0]);
                                    vesEmbed.addFields([{ "name": "First Registered with DVLA", "value": `${registerMonthNames[firstDvlaRegMonth - 1]} ${firstDvlaRegYear}`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }

                                // fuel data
                                if (vesData['fuelType']) {
                                    // we need to take each word and title case it
                                    let fuelType = vesData['fuelType'].split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
                                    vesEmbed.addFields([{ "name": "Fuel Type", "value": fuelType, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['engineCapacity']) {
                                    let roundedEngineCapacity = Math.floor((Math.ceil(vesData['engineCapacity'] / 100) * 100) / 1000).toFixed(1);
                                    vesEmbed.addFields([{ "name": "Engine Capacity", "value": `${roundedEngineCapacity}L`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['co2Emissions']) {
                                    vesEmbed.addFields([{ "name": "CO2 Emissions", "value": `${vesData['co2Emissions']}g/km`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }

                                // tax data
                                if (vesData['taxStatus']) {
                                    vesEmbed.addFields([{ "name": "Tax Status", "value": vesData['taxStatus'], "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['taxDueDate']) {
                                    let currentDate = dateTime(new Date());
                                    let taxDueDate = dateTime(new Date(vesData['taxDueDate']));
                                    vesEmbed.addFields([{ "name": "Tax Due", "value": `[Due ${taxDueDate['relativeTime']}](https://www.gov.uk/check-vehicle-tax "${taxDueDate['date']}${taxDueDate['ordinal']} ${taxDueDate['monthName']}${currentDate['year'] !== taxDueDate['year'] ? ` ${taxDueDate['year']}` : ''}")`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['artEndDate']) {
                                    let currentDate = dateTime(new Date());
                                    let artEndDate = dateTime(new Date(vesData['artEndDate']));
                                    vesEmbed.addFields([{ "name": "ART Ends", "value": `[${artEndDate['relativeTime'].charAt(0).toUpperCase() + artEndDate['relativeTime'].slice(1).toLowerCase()}](https://www.gov.uk/check-vehicle-tax "${artEndDate['date']}${artEndDate['ordinal']} ${artEndDate['monthName']}${currentDate['year'] !== artEndDate['year'] ? ` ${artEndDate['year']}` : ''}")`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }

                                // mot data
                                if (vesData['motStatus']) {
                                    vesEmbed.addFields([{ "name": "MOT Status", "value": vesData['motStatus'], "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                if (vesData['motExpiryDate']) {
                                    let currentDate = dateTime(new Date());
                                    let motExpiryDate = dateTime(new Date(vesData['motExpiryDate']));
                                    vesEmbed.addFields([{ "name": "MOT Due", "value": `[Due ${motExpiryDate['relativeTime']}](https://www.gov.uk/check-mot-history "${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${currentDate['year'] !== motExpiryDate['year'] ? ` ${motExpiryDate['year']}` : ''}")`, "inline": true }]);
                                } else {
                                    vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                }
                                vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);


                                embedsToSend.push(vesEmbed);
                            } catch (err: any) {
                                console.log(`${lcl.red('[VES API - Error]')} ${err['message']}`);
                            }
                        }

                        if (embedsToSend.length <= 0) throw new Error(`No car found with registration "${carRegNumber}"`);
                        return res.status(200).json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                embeds: [...embedsToSend]
                            }
                        });
                    } catch (err: any) {
                        console.log(`${lcl.red('[Discord Interaction - Error]')} ${err['message']}`);
                        let errorEmbed = new EmbedBuilder()
                            .setTitle(err['message'] || 'Something went wrong')
                            .setColor('#FF6961')
                            .setTimestamp();
                        return res.status(200).json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                embeds: [errorEmbed],
                                flags: InteractionResponseFlags.EPHEMERAL
                            }
                        });
                    }
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
                ...defaultFetchHeaders(),
                "Content-Type": 'application/json',
                "Authorization": `Bot ${process.env.TOKEN}`
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