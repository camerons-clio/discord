const lcl = require('cli-color');
const fetch = require('node-fetch');
const dateTime = require('../assets/time/dateTime');
const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const commandFailedEmbed = require('../assets/discord/commandFailedEmbed');

// The DVLA Returns the color as a work like "BLUE" or "RED" so we need to convert it to a hex code for the embed
let carColors = { "BEIGE": "#F5F5DC", "BLACK": "#000000", "BLUE": "DarkBlue", "BRONZE": "#CD7F32", "BROWN": "#A52A2A", "BUFF": "#F0DC82", "CREAM": "#FFFDD0", "GOLD": "#FFD700", "GREEN": "#008000", "GREY": "#808080", "IVORY": "#FFFFF0", "MAROON": "#800000", "ORANGE": "#FFA500", "PINK": "#FFC0CB", "PURPLE": "#800080", "RED": "#FF0000", "SILVER": "#C0C0C0", "TURQUOISE": "#40E0D0", "WHITE": "#FFFFFF", "YELLOW": "#FFFF00" };
let registerMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", 'November', "December"];

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
            if (!process.env.GOV_VES_KEY || !process.env.GOV_MOT_KEY) throw new Error("Missing API Keys for VES and/or MOT");
            const carRegNumber = interaction.options.getString('reg')?.toString().replace(/\s/g, '').toUpperCase().trim();
            if (!carRegNumber) throw new Error("Invalid Car Registration Number");

            // get Vehicle Enquiry Service Data
            let vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
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
            let vesData = await vesDataRaw.json();

            // get MOT Data
            let motDataRaw = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${carRegNumber}`, {
                method: 'GET',
                headers: {
                    "Accept": "application/json",
                    "x-api-key": process.env.GOV_MOT_KEY
                }
            });
            if (motDataRaw.status === 401) throw new Error("Invalid MOT API Key");
            let motDataArray = await motDataRaw.json();

            // make embeds to send to client
            let createdEmbeds = [];
            if (vesDataRaw.status === 200) {
                try {
                    // the ves api returns all words as uppercase
                    let carMake = vesData['make'].charAt(0).toUpperCase() + vesData['make'].slice(1).toLowerCase();
                    let carColour = vesData['colour'].charAt(0).toUpperCase() + vesData['colour'].slice(1).toLowerCase();

                    let vesEmbed = new EmbedBuilder()
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
                    } catch (err) {
                        console.log(err);
                        console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating Registration Data: ${err}`);
                    }

                    // fuel data
                    try {
                        if (vesData['fuelType']) {
                            // we need to take each word and title case it
                            let fuelType = vesData['fuelType'].split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
                            vesEmbed.addFields([{ "name": "Fuel Type", "value": fuelType, "inline": true }]);
                        } else {
                            vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                        }
                        if (vesData['engineCapacity']) {
                            let roundedEngineCapacity = (Math.ceil(vesData['engineCapacity'] / 100) / 10).toFixed(1);
                            vesEmbed.addFields([{ "name": "Engine Capacity", "value": `${roundedEngineCapacity}L`, "inline": true }]);
                        } else {
                            vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                        }
                        if (vesData['co2Emissions']) {
                            vesEmbed.addFields([{ "name": "CO2 Emissions", "value": `${vesData['co2Emissions']}g/km`, "inline": true }]);
                        } else {
                            vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                        }
                    } catch (err) {
                        console.log(err);
                        console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating Fuel Data: ${err}`);
                    }

                    // tax data
                    try {
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
                    } catch (err) {
                        console.log(err);
                        console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating Tax Data: ${err}`);
                    }

                    // mot data
                    try {
                        if (vesData['motStatus']) {
                            vesEmbed.addFields([{ "name": "MOT Status", "value": vesData['motStatus'], "inline": true }]);
                        } else {
                            vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                        }
                        if (vesData['motExpiryDate']) {
                            let currentDate = dateTime(new Date());
                            let motExpiryDate = dateTime(new Date(vesData['motExpiryDate']));
                            vesEmbed.addFields([{ "name": "MOT Due", "value": `[Due ${motExpiryDate['relativeTime']}](https://www.check-mot.service.gov.uk/results?registration=${vesData['registrationNumber']}&checkRecalls=true "${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${currentDate['year'] !== motExpiryDate['year'] ? ` ${motExpiryDate['year']}` : ''}")`, "inline": true }]);
                        } else {
                            vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                        }
                        vesEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                    } catch (err) {
                        console.log(err);
                        console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating MOT Data: ${err}`);
                    }

                    createdEmbeds.push(vesEmbed);
                } catch (err) {
                    console.log(err);
                    console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating VES Embed: ${err}`);
                }
            }

            // mot data
            if (motDataRaw.status === 200) {
                try {
                    for (let motData of motDataArray) { // 
                        try {
                            // car make to title case
                            let carMake = motData['make']?.toString().charAt(0).toUpperCase() + motData['make']?.toString().slice(1).toLowerCase();

                            // base embed
                            let motTestsEmbed = new EmbedBuilder()
                                .setTitle(`${carMake} - ${motData['model']} | MOT History`)
                                .setThumbnail(`https://www.carlogos.org/car-logos/${motData['make'].toLowerCase()}-logo.png`)
                                .setColor(carColors[motData['primaryColour'].toString().toUpperCase()] || 'Random')
                                .setTimestamp()
                                .setFooter({
                                    "text": `Requested by ${interaction.user.username}`,
                                    "iconURL": interaction.user.avatarURL()
                                });

                            // add the optional data fields
                            // MOT Warning
                            let motFirstDate = await dateTime(new Date(motData['motTests'][motData['motTests'].length - 1]['completedDate']));
                            if (new Date(motFirstDate['dateTime']) < new Date("2018-05-20T00:00:00.000Z")) motTestsEmbed.setDescription(`[**The MOT test changed on 20th May 2018.**](https://www.gov.uk/government/news/mot-changes-20-may-2018)`)

                            // first registration date
                            if (motData['firstUsedDate']) {
                                let firstUsedDate = await dateTime(new Date(motData['firstUsedDate']));
                                motTestsEmbed.addFields([{ "name": "First Registered", "value": `${firstUsedDate['date']}${firstUsedDate['ordinal']} ${firstUsedDate['monthName']} ${firstUsedDate['year']}`, "inline": true }]);
                            }

                            // first test date
                            motTestsEmbed.addFields([{ "name": "First Test Date", "value": `[${motFirstDate['relativeTime']}](https://www.check-mot.service.gov.uk/results?registration=${vesData['registrationNumber']}&checkRecalls=true "${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}")`, "inline": true }]);
                            createdEmbeds.push(motTestsEmbed);

                            // create the embeds for each test
                            let motTestEmbeds = [];
                            for (let motTestIndex in motData['motTests']) {
                                try {
                                    let currentTestEmbed = [];
                                    let motTest = motData['motTests'][motTestIndex];
                                    let motTestDate = dateTime(new Date(motTest['completedDate']));

                                    // find the color for the embed
                                    let embedColor = "Random"; // we should never get a random color.... but just in case (The docs for the MOT API are not very good)
                                    switch (motTest['testResult']) {
                                        case "PASSED":
                                            embedColor = "DarkGreen";
                                            break;
                                        case "FAILED":
                                        case "ABANDON":
                                            embedColor = "DarkRed";
                                            break;
                                        case "ABORT":
                                            embedColor = "DarkBlue";
                                            break;
                                    }

                                    // build embed
                                    let motTestEmbed = new EmbedBuilder()
                                        .setTitle(`${motTest['testResult'].charAt(0).toUpperCase() + motTest['testResult'].slice(1).toLowerCase()} | MOT Test ${parseInt(motTestIndex) + 1} / ${motData['motTests'].length}`)
                                        .setColor(embedColor)
                                        .addFields([
                                            { "name": "Test Date", "value": `${motTestDate['time']['hours']}:${motTestDate['time']['minutes']} ${motTestDate['date']}${motTestDate['ordinal']} ${motTestDate['monthName']} ${motTestDate['year']}`, "inline": true },
                                        ])
                                        .setFooter({
                                            "text": `MOT Test Number: ${motTest['motTestNumber']}`,
                                        });
                                    if (motTest['expiryDate']) {
                                        let motExpiryDate = dateTime(new Date(motTest['expiryDate']));
                                        let currentDate = dateTime(new Date());

                                        // assume the test has expired by default unless the date is in the future
                                        let testStatus = "Expired";
                                        if (new Date(motExpiryDate['dateTime']) > new Date()) testStatus = "Expires";

                                        motTestEmbed.addFields([{ "name": testStatus, "value": `${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${motExpiryDate['year'] !== currentDate['year'] ? ` ${motExpiryDate['year']}` : ''}`, "inline": true }]);
                                    } else {
                                        motTestEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
                                    }
                                    motTestEmbed.addFields([{ "name": "Mileage at MOT", "value": `${motTest['odometerValue'].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${motTest['odometerUnit']}`, "inline": true }]);

                                    // add the fail reasons
                                    let amountOfEmbedFields = 3;
                                    let rfrAndComments = [...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "FAIL"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "MINOR"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "ADVISORY"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] !== "FAIL" && rfr['type'] !== "MINOR" && rfr['type'] !== "ADVISORY")];
                                    for (let reasonForRefusal of rfrAndComments) {
                                        if (amountOfEmbedFields >= 25) {
                                            // we have maxed out the amount of fields we can have in an embed
                                            currentTestEmbed.push(motTestEmbed);
                                            // make a new embed
                                            motTestEmbed = new EmbedBuilder()
                                                .setTitle(`${motTest['testResult'].charAt(0).toUpperCase() + motTest['testResult'].slice(1).toLowerCase()} | MOT Test ${parseInt(motTestIndex) + 1} / ${motData['motTests'].length} (Continued)`)
                                                .setColor(embedColor) // we should never get a random color.... but just in case (The docs for the MOT API are not very good)
                                                .setFooter({
                                                    "text": `MOT Test Number: ${motTest['motTestNumber']}`,
                                                });
                                            amountOfEmbedFields = 0;
                                        }

                                        // add the field
                                        motTestEmbed.addFields({ "name": `${reasonForRefusal['type'].charAt(0).toUpperCase() + reasonForRefusal['type'].slice(1).toLowerCase()}`, "value": `${reasonForRefusal['text']}` });
                                        amountOfEmbedFields++;
                                    }

                                    // add the embed data
                                    currentTestEmbed.push(motTestEmbed);
                                    motTestEmbeds.push(...currentTestEmbed);
                                } catch (err) {
                                    console.log(err);
                                    console.log(`${lcl.redBright('[DVLA - Error]')} Failed to create MOT test data: ${err}`);
                                }
                            }

                            // add the embeds to the created embeds array
                            createdEmbeds.push(...motTestEmbeds);
                        } catch (err) {
                            console.log(err);
                            console.log(`${lcl.redBright('[DVLA - Error]')} Failed to create MOT data: ${err}`);
                        }
                    }
                } catch (err) {
                    console.log(err);
                    console.log(`${lcl.redBright('[DVLA - Error]')} Failed to format MOT data: ${err}`);
                }
            }

            // check if we have any embeds to send
            if (createdEmbeds.length <= 0) throw new Error("No Data Found for that Registration Number");

            // split the embeds into groups of 10
            let embedsToSend = [];
            for (let i = 0; i < createdEmbeds.length; i += 10) {
                embedsToSend.push(createdEmbeds.slice(i, i + 10));
            }

            // get all threads in the server
            let threadChannel;
            for (let guildChannel of interaction.guild.channels.cache) {
                let channel = guildChannel[1];
                if (channel['type'] !== 11) continue; // not a thread
                if (channel['name'] !== carRegNumber) continue; // not the thread we are looking for
                threadChannel = channel;
                break;
            }
            if (!threadChannel) {
                let validChannelType = false;
                try {
                    // get the channel that we are currently in
                    let interactionChannel = interaction.channel;

                    // You can only create threads in actual text channels so we need to filter out only regular text channels and therads 
                    if (interactionChannel.type.toString() === "0") validChannelType = true;
                    if (interactionChannel.type.toString() === "11") validChannelType = true;
                    if (!validChannelType) throw new Error("Invalid Channel Type");

                    // we need to check to see if we are in a channel or a thread, if we are in a thread we need to get the parent channel
                    if (interactionChannel.type.toString() === "11") interactionChannel = await interaction.guild.channels.fetch(interactionChannel.parentId);

                    // create a new thread
                    threadChannel = await interactionChannel.threads.create({
                        name: carRegNumber,
                        autoArchiveDuration: 1440, // 24 hours
                        reason: `Car Registration Number: ${carRegNumber} for ${interaction.user.username}`
                    });
                } catch (err) {
                    console.log(err);
                    console.log(`${lcl.redBright('[DVLA - Error]')} Failed to create thread: ${err}`);
                    throw new Error(!validChannelType ? "This command only works in a regular text channel" : "Failed to create a thread for the car registration number");
                }
            }

            // send embeds
            for (let embedGroup of embedsToSend) {
                await threadChannel.send({
                    embeds: embedGroup
                });
            }

            // Send Embeds
            let finalEmbed = new EmbedBuilder()
                .setTitle(`Sent ${createdEmbeds.length} embed${createdEmbeds.length > 1 ? "s" : ""} to ${threadChannel.toString()}`)
                .setColor('DarkGreen')
                .setTimestamp();
            return await interaction.editReply({
                embeds: [finalEmbed],
                ephemeral: true
            });
        } catch (err) {
            await commandFailedEmbed(interaction, err);
        }
    }
}