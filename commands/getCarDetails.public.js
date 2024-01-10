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
                .setDescription('The license plate of the car. Without spaces.')
                .setMinLength(2)
                .setMaxLength(7)
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        try {
            if (!process.env.GOV_VES_KEY || !process.env.GOV_MOT_KEY) throw new Error("Missing API Keys for VES and/or MOT");
            const carRegNumber = interaction.options.getString('reg')?.toString().replace(/\s/g, '').toUpperCase().trim();

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
                            let carMake = motData['make'].charAt(0).toUpperCase() + motData['make'].slice(1).toLowerCase();

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
                            if (!motData['motTests'] || motData['motTests'].length <= 0) {
                                // no test have been done yet or they dont exist for some reason
                                let motFirstDate = await dateTime(new Date(motData['motTestExpiryDate']));
                                motTestsEmbed.setDescription(`No MOT Tests Found... First Test Due [${motFirstDate['relativeTime'].replace("in", "within")}](https://www.gov.uk/check-mot-history "${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}")`);
                            } else {
                                // add 3 to the year as the first mot is due 3 years after the first registration
                                let firstRegDate = new Date(motData['firstUsedDate']);
                                firstRegDate.setFullYear(firstRegDate.getFullYear() + 3);
                                let motFirstDate = dateTime(firstRegDate);

                                motTestsEmbed.setDescription(`${motData['motTests'].length} MOT Test${motData['motTests'].length > 1 ? "s" : ""} Found... First Test Date [${motFirstDate['relativeTime']}](https://www.gov.uk/check-mot-history "${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}")\n\n**The MOT test changed on 20th May 2018.**\nDefects are now categorised according to their severity - dangerous, major, and minor.`);
                            }
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
                                        motTestEmbed.addFields([{ "name": "Expires", "value": `${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${motExpiryDate['year'] !== currentDate['year'] ? ` ${motExpiryDate['year']}` : ''}`, "inline": true }]);
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
                if (channel['ownerId'] !== interaction.client.user.id) continue;
                threadChannel = channel;
                break;
            }
            if (!threadChannel) {
                // create a new thread
                threadChannel = await interaction.channel.threads.create({
                    name: carRegNumber,
                    autoArchiveDuration: 1440, // 24 hours
                    reason: `Car Registration Number: ${carRegNumber} for ${interaction.user.username}`
                });
            }

            // send embeds
            for (let embedGroup of embedsToSend) {
                await threadChannel.send({
                    embeds: embedGroup
                });
            }

            // Send Embeds
            if (createdEmbeds.length <= 0) throw new Error("No Data Found for that Registration Number");
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