const lcl = require('cli-color');
const { EmbedBuilder } = require('discord.js');
const { InteractionResponseType, InteractionResponseFlags, InteractionType, verifyKey } = require('discord-interactions');
const defaultFetchHeaders = require('../../utils/defaultFetchHeaders');
const dateTime = require('../../utils/dateTime');

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
        const isVerified = await verifyKey(
            JSON.stringify(requestBody),
            requestSignature,
            requestTimestamp,
            process.env.DCORD_PUBLIC_KEY
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

        if (req.body.type === InteractionType.APPLICATION_COMMAND) {
            console.log(`${lcl.blueBright('[Discord - Info]')} Received command: "${req.body.data.name}"`);
            switch (req.body.data.name?.toString().toLowerCase()) {
                case GET_CAR_COMMAND['name'].toString().toLowerCase():
                    try {
                        // get the reg from the request
                        const carRegNumber = requestBody.data.options[0].value?.toString().toUpperCase().replace(/\s/g, '').trim();

                        // get the data from VES and MOT APIs
                        let vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
                            method: 'POST',
                            headers: {
                                ...defaultFetchHeaders(),
                                "Content-Type": 'application/json',
                                "x-api-key": process.env.GOV_VES_KEY,
                            },
                            body: JSON.stringify({
                                registrationNumber: carRegNumber
                            })
                        });
                        if (vesDataRaw.status === 401) throw new Error('Invalid API Key');
                        if (vesDataRaw.status >= 500) throw new Error('VES Service Error');
                        let vesData = await vesDataRaw.json();

                        // get MOT
                        // let motDataRaw = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${carRegNumber}`, {
                        //     headers: {
                        //         ...defaultFetchHeaders(),
                        //         "Content-Type": 'application/json',
                        //         "x-api-key": process.env.GOV_MOT_KEY,
                        //     }
                        // });
                        // if (motDataRaw.status >= 500) throw new Error('MOT Service Error');
                        // let motData = await motDataRaw.json();

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
                            } catch (err) {
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
                    } catch (err) {
                        console.log(`${lcl.red('[Discord - Error]')} ${err['message']}`);
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
                    console.log(`${lcl.yellowBright('[Discord - Warn]')} Unknown command: "${req.body.data.name}"`);
                    let errorEmbed = new EmbedBuilder()
                        .setTitle('Unknown command')
                        .setDescription(`The command "${req.body.data.name}" is unknown. Please try again.`)
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