const lcl = require('cli-color');
const fetch = require('node-fetch');
const dateTime = require('../assets/time/dateTime');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const commandFailedEmbed = require('../assets/discord/commandFailedEmbed');

// The DVLA Returns the color as a word like "BLUE" or "RED" so we need to convert it to a hex code for the embed
const carColors = {
    "BEIGE": "#F5F5DC",
    "BLACK": "#000000",
    "BLUE": "DarkBlue",
    "BRONZE": "#CD7F32",
    "BROWN": "#A52A2A",
    "BUFF": "#F0DC82",
    "CREAM": "#FFFDD0",
    "GOLD": "#FFD700",
    "GREEN": "#008000",
    "GREY": "#808080",
    "IVORY": "#FFFFF0",
    "MAROON": "#800000",
    "ORANGE": "#FFA500",
    "PINK": "#FFC0CB",
    "PURPLE": "#800080",
    "RED": "#FF0000",
    "SILVER": "#C0C0C0",
    "TURQUOISE": "#40E0D0",
    "WHITE": "#FFFFFF",
    "YELLOW": "#FFFF00"
};
const registerMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const blankField = { "name": "\u200b", "value": "\u200b", "inline": true };

const logInfo = (message) => console.log(`${lcl.blue('[DVLA - Info]')} ${message}`);
const logWarn = (message) => console.log(`${lcl.yellow('[DVLA - Warn]')} ${message}`);
const logError = (message) => console.log(`${lcl.redBright('[DVLA - Error]')} ${message}`);

let motAccessToken = null;
let motAccessTokenExpiresAt = 0;

const capitalize = (value = "") => {
    if (value === undefined || value === null) return "";
    const text = value.toString();
    if (!text) return "";
    return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
};

const titleCaseWords = (value = "") =>
    value
        .toString()
        .split(" ")
        .filter(Boolean)
        .map(capitalize)
        .join(" ");

const addFieldOrBlank = (embed, field) => {
    embed.addFields([field ?? blankField]);
};

const formatDateTitle = (dateInfo, currentYear) =>
    `${dateInfo['date']}${dateInfo['ordinal']} ${dateInfo['monthName']}${currentYear !== dateInfo['year'] ? ` ${dateInfo['year']}` : ''}`;

const getUserTag = (user) => `${user.username}${user.tag !== user.username ? `#${user.tag}` : ""}`;

const getEmbedSize = (embed) => {
    const data = embed.data ?? {};
    let total = 0;
    if (data.title) total += data.title.length;
    if (data.description) total += data.description.length;
    if (data.footer?.text) total += data.footer.text.length;
    if (data.author?.name) total += data.author.name.length;
    if (data.fields?.length) {
        for (const field of data.fields) {
            if (field?.name) total += field.name.length;
            if (field?.value) total += field.value.length;
        }
    }
    return total;
};

const ensureEmbedSize = (currentEmbed, newField, makeNewEmbed) => {
    const sizeLimit = 5900; // safety buffer below 6000
    const projected = getEmbedSize(currentEmbed) + (newField?.name?.length ?? 0) + (newField?.value?.length ?? 0);
    if (projected > sizeLimit) {
        return makeNewEmbed();
    }
    return currentEmbed;
};

const getMotAccessToken = async () => {
    if (motAccessToken && motAccessTokenExpiresAt > Date.now() + 60_000) {
        return motAccessToken;
    }

    const tokenUrl = process.env.GOV_MOT_CREDS_TOKEN;
    const clientId = process.env.GOV_MOT_CREDS_ID;
    const clientSecret = process.env.GOV_MOT_CREDS_SECRET;
    const scope = process.env.GOV_MOT_CREDS_SCOPE;

    const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope
        })
    });

    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        throw new Error(`Failed to obtain MOT access token (${tokenResponse.status}): ${errorBody}`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error("MOT access token missing in response");

    motAccessToken = tokenData.access_token;
    const expiresInSeconds = Number(tokenData.expires_in || 3600);
    motAccessTokenExpiresAt = Date.now() + (expiresInSeconds * 1000);

    return motAccessToken;
};

const fetchVesData = async (carRegNumber) => {
    logInfo(`Requesting VES data | reg=${carRegNumber}`);
    const vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
        method: 'POST',
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "x-api-key": process.env.GOV_VES_KEY
        },
        body: JSON.stringify({
            registrationNumber: carRegNumber
        })
    });
    if (vesDataRaw.status === 401) throw new Error("Invalid VES API Key");
    const vesData = await vesDataRaw.json();
    logInfo(`VES response | status=${vesDataRaw.status} | reg=${carRegNumber}`);
    return { status: vesDataRaw.status, data: vesData };
};

const fetchMotData = async (carRegNumber) => {
    logInfo(`Requesting MOT data | reg=${carRegNumber}`);
    const accessToken = await getMotAccessToken();
    const motDataRaw = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${carRegNumber}`, {
        method: 'GET',
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "X-API-Key": process.env.GOV_MOT_CREDS_KEY
        }
    });
    if (motDataRaw.status === 401) throw new Error("Invalid MOT API credentials");
    const motData = await motDataRaw.json();
    logInfo(`MOT response | status=${motDataRaw.status} | tests=${motData?.motTests?.length ?? 0} | reg=${carRegNumber}`);
    return { status: motDataRaw.status, data: motData };
};

const buildVesEmbed = (vesData, interaction) => {
    const carMake = capitalize(vesData['make']);
    const carColour = capitalize(vesData['colour']);

    const vesEmbed = new EmbedBuilder()
        .setTitle(`${carMake} - "${vesData['registrationNumber']}" (${vesData['yearOfManufacture']} - ${carColour})`)
        .setThumbnail(`https://www.carlogos.org/car-logos/${carMake.toLowerCase()}-logo.png`)
        .setColor(carColors[carColour?.toString().toUpperCase()] || 'Random')
        .setTimestamp()
        .setFooter({
            "text": `Requested by ${interaction.user.username}`,
            "iconURL": interaction.user.avatarURL()
        });

    // the ves api will only return keys if they have a value so we need to check if they exist
    vesEmbed.addFields([{ "name": "Make", "value": carMake, "inline": true }]);
    try {
        if (vesData['monthOfFirstRegistration']) {
            // the first registration date is in the format "YYYY-MM"
            const firstRegMonth = parseInt(vesData['monthOfFirstRegistration'].split("-")[1]);
            const firstRegYear = parseInt(vesData['monthOfFirstRegistration'].split("-")[0]);
            vesEmbed.addFields([{ "name": "First Registered", "value": `${registerMonthNames[firstRegMonth - 1]} ${firstRegYear}`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['monthOfFirstDvlaRegistration']) {
            // again based on the format "YYYY-MM"
            const firstDvlaRegMonth = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[1]);
            const firstDvlaRegYear = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[0]);
            vesEmbed.addFields([{ "name": "First Registered with DVLA", "value": `${registerMonthNames[firstDvlaRegMonth - 1]} ${firstDvlaRegYear}`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
    } catch (err) {
        console.log(err);
        logError(`Error Creating Registration Data: ${err}`);
    }

    // fuel data
    try {
        if (vesData['fuelType']) {
            // we need to take each word and title case it
            const fuelType = titleCaseWords(vesData['fuelType']);
            vesEmbed.addFields([{ "name": "Fuel Type", "value": fuelType, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['engineCapacity']) {
            const roundedEngineCapacity = (Math.ceil(vesData['engineCapacity'] / 100) / 10).toFixed(1);
            vesEmbed.addFields([{ "name": "Engine Capacity", "value": `${roundedEngineCapacity}L`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['co2Emissions']) {
            vesEmbed.addFields([{ "name": "CO2 Emissions", "value": `${vesData['co2Emissions']}g/km`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
    } catch (err) {
        console.log(err);
        logError(`Error Creating Fuel Data: ${err}`);
    }

    // tax data
    try {
        if (vesData['taxStatus']) {
            vesEmbed.addFields([{ "name": "Tax Status", "value": vesData['taxStatus'], "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['taxDueDate']) {
            const currentDate = dateTime(new Date());
            const taxDueDate = dateTime(new Date(vesData['taxDueDate']));
            vesEmbed.addFields([{ "name": "Tax Due", "value": `[Due ${taxDueDate['relativeTime']}](https://www.gov.uk/check-vehicle-tax "${formatDateTitle(taxDueDate, currentDate['year'])}")`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['artEndDate']) {
            const currentDate = dateTime(new Date());
            const artEndDate = dateTime(new Date(vesData['artEndDate']));
            vesEmbed.addFields([{ "name": "ART Ends", "value": `[${capitalize(artEndDate['relativeTime'])}](https://www.gov.uk/check-vehicle-tax "${formatDateTitle(artEndDate, currentDate['year'])}")`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
    } catch (err) {
        console.log(err);
        logError(`Error Creating Tax Data: ${err}`);
    }

    // mot data
    try {
        if (vesData['motStatus']) {
            vesEmbed.addFields([{ "name": "MOT Status", "value": vesData['motStatus'], "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        if (vesData['motExpiryDate']) {
            const currentDate = dateTime(new Date());
            const motExpiryDate = dateTime(new Date(vesData['motExpiryDate']));
            vesEmbed.addFields([{ "name": "MOT Due", "value": `[Due ${motExpiryDate['relativeTime']}](https://www.check-mot.service.gov.uk/results?registration=${vesData['registrationNumber']}&checkRecalls=true "${formatDateTitle(motExpiryDate, currentDate['year'])}")`, "inline": true }]);
        } else {
            addFieldOrBlank(vesEmbed);
        }
        addFieldOrBlank(vesEmbed);
    } catch (err) {
        console.log(err);
        logError(`Error Creating MOT Data: ${err}`);
    }

    return vesEmbed;
};

const buildMotEmbeds = (motData, vesData, interaction) => {
    const embeds = [];
    try {
        const carMake = capitalize(motData?.make);
        const carModel = motData?.model ?? "Unknown";
        const primaryColour = motData?.primaryColour ?? "Unknown";

        const motTestsEmbed = new EmbedBuilder()
            .setTitle(`${carMake} - ${carModel} | MOT History`)
            .setColor(carColors[primaryColour.toString().toUpperCase()] || 'Random')
            .setTimestamp()
            .setFooter({
                "text": `Requested by ${interaction.user.username}`,
                "iconURL": interaction.user.avatarURL()
            });
        if (carMake) {
            motTestsEmbed.setThumbnail(`https://www.carlogos.org/car-logos/${carMake.toLowerCase()}-logo.png`);
        }

        let motFirstDate;
        if (motData?.motTests?.length) {
            motFirstDate = dateTime(new Date(motData.motTests[motData.motTests.length - 1].completedDate), true);
            if (new Date(motFirstDate['dateTime']) < new Date("2018-05-20T00:00:00.000Z")) {
                motTestsEmbed.setDescription(`[**The MOT test changed on 20th May 2018.**](https://www.gov.uk/government/news/mot-changes-20-may-2018)`);
            }
        }

        if (motData?.firstUsedDate) {
            const firstUsedDate = dateTime(new Date(motData.firstUsedDate), true);
            motTestsEmbed.addFields([{ "name": "First Registered", "value": `${firstUsedDate['date']}${firstUsedDate['ordinal']} ${firstUsedDate['monthName']} ${firstUsedDate['year']}`, "inline": true }]);
        }

        if (motFirstDate) {
            const currentDate = dateTime(new Date());
            const regForLink = vesData?.registrationNumber ?? motData?.registration ?? "";
            motTestsEmbed.addFields([{ "name": "First Test Date", "value": `[${motFirstDate['relativeTime']}](https://www.check-mot.service.gov.uk/results?registration=${regForLink}&checkRecalls=true "${formatDateTitle(motFirstDate, currentDate['year'])}")`, "inline": true }]);
        }
        embeds.push(motTestsEmbed);

        const motTestEmbeds = [];
        if (motData?.motTests?.length) {
            for (const [motTestIndex, motTest] of motData.motTests.entries()) {
                try {
                    const currentTestEmbed = [];
                    const motTestDate = dateTime(new Date(motTest.completedDate));

                    let embedColor = "Random"; // we should never get a random color.... but just in case (The docs for the MOT API are not very good)
                    switch (motTest.testResult) {
                        case "PASSED":
                            embedColor = "DarkGreen";
                            break;
                        case "FAILED":
                            embedColor = "DarkRed";
                            break;
                    }

                    const makeMotTestEmbed = (suffix = "") => new EmbedBuilder()
                        .setTitle(`${capitalize(motTest.testResult)} | MOT Test ${motTestIndex + 1} / ${motData.motTests.length}${suffix}`)
                        .setColor(embedColor)
                        .addFields([
                            { "name": "Test Date", "value": `${motTestDate['time']['hours']}:${motTestDate['time']['minutes']} ${motTestDate['date']}${motTestDate['ordinal']} ${motTestDate['monthName']} ${motTestDate['year']}`, "inline": true },
                        ])
                        .setFooter({
                            "text": `MOT Test Number: ${motTest.motTestNumber ?? "Unknown"}`,
                        });
                    let motTestEmbed = makeMotTestEmbed();
                    if (motTest.expiryDate) {
                        const motExpiryDate = dateTime(new Date(motTest.expiryDate));
                        const currentDate = dateTime(new Date());

                        let testStatus = "Expired";
                        if (new Date(motExpiryDate['dateTime']) > new Date()) testStatus = "Expires";

                        motTestEmbed.addFields([{ "name": testStatus, "value": `${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${motExpiryDate['year'] !== currentDate['year'] ? ` ${motExpiryDate['year']}` : ''}`, "inline": true }]);
                    } else {
                        addFieldOrBlank(motTestEmbed);
                    }
                    if (motTest.odometerValue && motTest.odometerUnit) {
                        motTestEmbed.addFields([{ "name": "Mileage at MOT", "value": `${motTest.odometerValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${motTest.odometerUnit}`, "inline": true }]);
                    } else {
                        addFieldOrBlank(motTestEmbed);
                    }

                    let amountOfEmbedFields = 3;
                    const defects = motTest.defects ?? [];
                        for (const defect of defects) {
                            const defectType = defect?.type ? capitalize(defect.type) : "Defect";
                            const defectText = defect?.text ?? "No details provided";
                            const field = { "name": defectType, "value": defectText };

                            if (amountOfEmbedFields >= 25) {
                                currentTestEmbed.push(motTestEmbed);
                                motTestEmbed = makeMotTestEmbed(" (Continued)");
                                amountOfEmbedFields = 0;
                            }

                            const resizedEmbed = ensureEmbedSize(
                                motTestEmbed,
                                field,
                                () => {
                                    currentTestEmbed.push(motTestEmbed);
                                    amountOfEmbedFields = 0;
                                    return makeMotTestEmbed(" (Continued)");
                                }
                            );
                            motTestEmbed = resizedEmbed;

                            motTestEmbed.addFields(field);
                            amountOfEmbedFields++;
                        }

                    currentTestEmbed.push(motTestEmbed);
                    motTestEmbeds.push(...currentTestEmbed);
                } catch (err) {
                    console.log(err);
                    logError(`Failed to create MOT test data: ${err}`);
                }
            }
        }

        embeds.push(...motTestEmbeds);
    } catch (err) {
        console.log(err);
        logError(`Failed to create MOT data: ${err}`);
    }
    return embeds;
};

const findOrCreateThread = async (interaction, carRegNumber) => {
    let threadChannel;
    for (const [, channel] of interaction.guild.channels.cache) {
        if (channel['type'] !== 11) continue; // not a thread
        if (channel['name'] !== carRegNumber) continue; // not the thread we are looking for
        threadChannel = channel;
        break;
    }
    if (threadChannel) {
        logInfo(`Thread found | thread=${threadChannel.id} | reg=${carRegNumber}`);
        return threadChannel;
    }

    let validChannelType = false;
    try {
        let interactionChannel = interaction.channel;

        // You can only create threads in actual text channels so we need to filter out only regular text channels and threads
        if (interactionChannel.type.toString() === "0") validChannelType = true;
        if (interactionChannel.type.toString() === "11") validChannelType = true;
        if (!validChannelType) throw new Error("Invalid Channel Type");

        // we need to check to see if we are in a channel or a thread, if we are in a thread we need to get the parent channel
        if (interactionChannel.type.toString() === "11") interactionChannel = await interaction.guild.channels.fetch(interactionChannel.parentId);

        threadChannel = await interactionChannel.threads.create({
            name: carRegNumber,
            autoArchiveDuration: 1440, // 24 hours
            reason: `Car Registration Number: ${carRegNumber} for ${interaction.user.username}`
        });
        logInfo(`Thread created | thread=${threadChannel.id} | reg=${carRegNumber}`);
        return threadChannel;
    } catch (err) {
        console.log(err);
        logError(`Failed to create thread: ${err}`);
        throw new Error(!validChannelType ? "This command only works in a regular text channel" : "Failed to create a thread for the car registration number");
    }
};

// Docs: https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/v1.2.0-vehicle-enquiry-service.html#schemas-properties-3
// TODO: This should be an HTTP Bot
module.exports = {
    data: new SlashCommandBuilder()
        .setName('car')
        .setDescription('Get a car\'s MOT and Vehicle Information')
        .addStringOption(option =>
            option.setName('reg')
                .setDescription('The license plate of the car.')
                .setMinLength(2)
                .setMaxLength(8)
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        try {
            if (!process.env.GOV_VES_KEY) throw new Error("Missing API Keys for VES");
            if (!process.env.GOV_MOT_CREDS_ID || !process.env.GOV_MOT_CREDS_SECRET || !process.env.GOV_MOT_CREDS_SCOPE || !process.env.GOV_MOT_CREDS_TOKEN || !process.env.GOV_MOT_CREDS_KEY) {
                throw new Error("Missing MOT API credentials");
            }
            const carRegNumber = interaction.options.getString('reg')?.toString().replace(/\s/g, '').toUpperCase().trim();
            if (!carRegNumber) throw new Error("Invalid Car Registration Number");
            logInfo(`Command start | reg=${carRegNumber} | user=${getUserTag(interaction.user)}`);

            const [vesResult, motResult] = await Promise.allSettled([
                fetchVesData(carRegNumber),
                fetchMotData(carRegNumber)
            ]);

            const createdEmbeds = [];
            let vesData = null;

            if (vesResult.status === "fulfilled") {
                if (vesResult.value.status === 200) {
                    try {
                        vesData = vesResult.value.data;
                        const vesEmbed = buildVesEmbed(vesResult.value.data, interaction);
                        createdEmbeds.push(vesEmbed);
                    } catch (err) {
                        console.log(err);
                        logError(`Error Creating VES Embed: ${err}`);
                    }
                } else {
                    logWarn(`VES returned status ${vesResult.value.status} | reg=${carRegNumber}`);
                }
            } else {
                logError(`VES request failed | reg=${carRegNumber} | err=${vesResult.reason}`);
            }

            if (motResult.status === "fulfilled") {
                if (motResult.value.status === 200) {
                    try {
                        const motEmbeds = buildMotEmbeds(motResult.value.data, vesData || { registrationNumber: carRegNumber }, interaction);
                        createdEmbeds.push(...motEmbeds);
                    } catch (err) {
                        console.log(err);
                        logError(`Failed to format MOT data: ${err}`);
                    }
                } else {
                    logWarn(`MOT returned status ${motResult.value.status} | reg=${carRegNumber}`);
                }
            } else {
                logError(`MOT request failed | reg=${carRegNumber} | err=${motResult.reason}`);
            }

            if (createdEmbeds.length <= 0) {
                logWarn(`No data found | reg=${carRegNumber}`);
                const errorEmbed = new EmbedBuilder()
                    .setTitle(`No Data Found for "${carRegNumber}"`)
                    .setDescription(`No data was found for the car registration number "${carRegNumber}"`)
                    .setColor('DarkRed')
                    .setTimestamp();
                return await interaction.editReply({
                    embeds: [errorEmbed],
                    ephemeral: true
                });
            }

            const embedsToSend = [];
            for (let i = 0; i < createdEmbeds.length; i += 10) {
                embedsToSend.push(createdEmbeds.slice(i, i + 10));
            }
            logInfo(`Embeds prepared | count=${createdEmbeds.length} | groups=${embedsToSend.length} | reg=${carRegNumber}`);

            const threadChannel = await findOrCreateThread(interaction, carRegNumber);

            for (const embedGroup of embedsToSend) {
                await threadChannel.send({
                    embeds: embedGroup
                });
            }
            logInfo(`Embeds sent | count=${createdEmbeds.length} | reg=${carRegNumber}`);

            const finalEmbed = new EmbedBuilder()
                .setTitle(`Sent ${createdEmbeds.length} embed${createdEmbeds.length > 1 ? "s" : ""} to ${threadChannel.toString()}`)
                .setColor('DarkGreen')
                .setTimestamp();
            return await interaction.editReply({
                embeds: [finalEmbed],
                ephemeral: true
            });
        } catch (err) {
            logError(`Command failed | reg=${interaction.options.getString('reg')} | err=${err}`);
            await commandFailedEmbed(interaction, err);
        }
    }
};
