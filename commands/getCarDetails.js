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

                            // get the date value - I don't really know what or why this is so broken. This whole API is a mess
                            let motFirstDate;
                            if (motData['firstUsedDate']) {
                                motFirstDate = dateTime(new Date(motData['firstUsedDate']));
                            } else if (motData['motTestExpiryDate']) {
                                motFirstDate = dateTime(new Date(motData['motTestExpiryDate']));
                            }

                            // base embed
                            let motTestsEmbed = new EmbedBuilder()
                                .setTitle(`${carMake} - ${motData['model']} | MOT History`)
                                .setThumbnail(`https://www.carlogos.org/car-logos/${motData['make'].toLowerCase()}-logo.png`)
                                .setColor(carColors[motData['primaryColour'].toString().toUpperCase()] || 'Random')
                                .setFooter({
                                    "text": `Requested by ${interaction.user.username}`,
                                    "iconURL": interaction.user.avatarURL()
                                });

                            // add the optional data fields
                            if (!motData['motTests'] || motData['motTests'].length <= 0) {
                                // no test have been done yet or they dont exist for some reason
                                motTestsEmbed.setDescription(`No MOT Tests Found... First Test Due [${motFirstDate['relativeTime'].replace("in", "within")}](https://www.gov.uk/check-mot-history "${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}")`);
                            } else {
                                motTestsEmbed.setDescription(`${motData['motTests'].length} MOT Test${motData['motTests'].length > 1 ? "s" : ""} Found... First Test Date [${motFirstDate['relativeTime']}](https://www.gov.uk/check-mot-history "${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}")`);
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

            // Send Embeds
            if (createdEmbeds.length <= 0) throw new Error("No Data Found for that Registration Number");
            return await interaction.editReply({
                embeds: createdEmbeds.splice(0, 10),
                ephemeral: true
            });
        } catch (err) {
            await commandFailedEmbed(interaction, err);
        }

        //     // check for ves and mot keys
        //     if (!process.env.GOV_VES_KEY || !process.env.GOV_MOT_KEY) throw new Error("Missing API Keys for VES and/or MOT");
        //     // get the registration number from the command
        //     const reg = interaction.options.getString('reg')?.toString().replace(/\s/g, '').toUpperCase().trim();

        //     // check if the registration number is valid
        //     if (reg.length < 2 || reg.length > 7) throw new Error("Invalid Registration Number");
        //     let workingEmbed = new EmbedBuilder()
        //         .setTitle(`Getting Data for ${reg}`)
        //         .setColor("#FFB347");
        //     await interaction.editReply({
        //         embeds: [workingEmbed]
        //     });

        //     console.log(`${lcl.blueBright('[DVLA - Info]')} Getting Data for ${reg}`);

        //     // get the VES Data
        //     let vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
        //         method: 'POST',
        //         headers: {
        //             "Accept": "application/json",
        //             "Content-Type": "application/json",
        //             "x-api-key": process.env.GOV_VES_KEY
        //         },
        //         body: JSON.stringify({
        //             registrationNumber: reg
        //         })
        //     });
        //     let vesData = await vesDataRaw.json();

        //     // get the MOT Data
        //     let motDataRaw = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${reg}`, {
        //         method: 'GET',
        //         headers: {
        //             "Accept": "application/json",
        //             "x-api-key": process.env.GOV_MOT_KEY
        //         }
        //     });
        //     let motDataArray = await motDataRaw.json();
        //     if (vesDataRaw.status !== 200 && motDataRaw.status !== 200) throw new Error("No Data Found for that Registration Number"); // if neither are found throw an error
        //     console.log(`${lcl.greenBright('[DVLA - Success]')} Found ${reg} in DVLA Database`);

        //     // Make Embed for Car's Data
        //     let embeds = [];
        //     // VES Embed
        //     if (vesDataRaw.status === 200) {
        //         try {
        //             // title case some of the data we use  more than once
        //             let carMake = vesData['make'].charAt(0).toUpperCase() + vesData['make'].slice(1).toLowerCase();

        //             let vesInitialEmbed = new EmbedBuilder()
        //                 .setTitle(`${carMake} - "${vesData['registrationNumber']}" (${vesData['yearOfManufacture']} - ${vesData['colour'].charAt(0).toUpperCase() + vesData['colour'].slice(1).toLowerCase()})`)
        //                 .setThumbnail(`https://www.carlogos.org/car-logos/${vesData['make'].toLowerCase()}-logo.png`)
        //                 .setColor(carColors[vesData['colour'].toString().toUpperCase()])
        //                 .setFooter({
        //                     "text": `Requested by ${interaction.user.username}`,
        //                     "iconURL": interaction.user.avatarURL()
        //                 })
        //                 .setTimestamp();

        //             // add the optional data fields
        //             vesInitialEmbed.addFields([{ "name": "Make", "value": carMake, "inline": true }])
        //             if (vesData['monthOfFirstRegistration']) {
        //                 // the first registration date is in the format "YYYY-MM"
        //                 let firstRegMonth = parseInt(vesData['monthOfFirstRegistration'].split("-")[1]);
        //                 let firstRegYear = parseInt(vesData['monthOfFirstRegistration'].split("-")[0]);
        //                 vesInitialEmbed.addFields([{ "name": "First Registered", "value": `${registerMonthNames[firstRegMonth - 1]} ${firstRegYear}`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['monthOfFirstDvlaRegistration']) {
        //                 // again based on the format "YYYY-MM"
        //                 let firstDvlaRegMonth = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[1]);
        //                 let firstDvlaRegYear = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[0]);
        //                 vesInitialEmbed.addFields([{ "name": "First Registered with DVLA", "value": `${registerMonthNames[firstDvlaRegMonth - 1]} ${firstDvlaRegYear}`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }

        //             // fuel data
        //             if (vesData['fuelType']) {
        //                 // we need to take each word and title case it
        //                 let fuelType = vesData['fuelType'].split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        //                 vesInitialEmbed.addFields([{ "name": "Fuel Type", "value": fuelType, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['engineCapacity']) {
        //                 let roundedEngineCapacity = Math.floor((Math.ceil(vesData['engineCapacity'] / 100) * 100) / 1000).toFixed(1);
        //                 vesInitialEmbed.addFields([{ "name": "Engine Capacity", "value": `${roundedEngineCapacity}L`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['co2Emissions']) {
        //                 vesInitialEmbed.addFields([{ "name": "CO2 Emissions", "value": `${vesData['co2Emissions']}g/km`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }

        //             // tax data
        //             if (vesData['taxStatus']) {
        //                 vesInitialEmbed.addFields([{ "name": "Tax Status", "value": vesData['taxStatus'], "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['taxDueDate']) {
        //                 let currentDate = dateTime(new Date());
        //                 let taxDueDate = dateTime(new Date(vesData['taxDueDate']));
        //                 vesInitialEmbed.addFields([{ "name": "Tax Due", "value": `Due ${taxDueDate['relativeTime']} (${taxDueDate['date']}${taxDueDate['ordinal']} ${taxDueDate['monthName']}${currentDate['year'] !== taxDueDate['year'] ? ` ${taxDueDate['year']}` : ''})`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['artEndDate']) {
        //                 let currentDate = dateTime(new Date());
        //                 let artEndDate = dateTime(new Date(vesData['artEndDate']));
        //                 vesInitialEmbed.addFields([{ "name": "ART Ends", "value": `${artEndDate['relativeTime'].charAt(0).toUpperCase() + artEndDate['relativeTime'].slice(1).toLowerCase()} (${artEndDate['date']}${artEndDate['ordinal']} ${artEndDate['monthName']}${currentDate['year'] !== artEndDate['year'] ? ` ${artEndDate['year']}` : ''})`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }

        //             // mot data
        //             if (vesData['motStatus']) {
        //                 vesInitialEmbed.addFields([{ "name": "MOT Status", "value": vesData['motStatus'], "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             if (vesData['motExpiryDate']) {
        //                 let currentDate = dateTime(new Date());
        //                 let motExpiryDate = dateTime(new Date(vesData['motExpiryDate']));
        //                 vesInitialEmbed.addFields([{ "name": "MOT Due", "value": `Due ${motExpiryDate['relativeTime']} (${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${currentDate['year'] !== motExpiryDate['year'] ? ` ${motExpiryDate['year']}` : ''})`, "inline": true }]);
        //             } else {
        //                 vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //             }
        //             vesInitialEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);

        //             // add to the embeds array
        //             embeds.push(vesInitialEmbed);

        //         } catch (err) {
        //             console.log(err);
        //             console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating VES Embed: ${err}`);
        //         }
        //     }

        //     // MOT Embed (if available)
        //     if (motDataRaw.status === 200) {
        //         for (let motData of motDataArray) {
        //             try {
        //                 // base embed
        //                 // title case some of the data we use  more than once
        //                 let carMake = motData['make'].charAt(0).toUpperCase() + motData['make'].slice(1).toLowerCase();
        //                 // the MOT Api either returns a motTestExpiryDate or a firstUsedDate key depending on if the requested car has had an MOT yet
        //                 let motFirstDate = '';
        //                 if (motData['firstUsedDate']) {
        //                     // the first registration date is in the format "YYYY.MM.DD"
        //                     motFirstDate = dateTime(new Date(motData['firstUsedDate'].replace(/\./g, "-")));
        //                 } else if (motData['motTestExpiryDate']) {
        //                     motFirstDate = dateTime(new Date(motData['motTestExpiryDate'])); // possibly comes from the VES API in the YYYY-MM-DD format unlike everyother date in the MOT API
        //                 }

        //                 // get an image of the car with the make and model
        //                 let baseMotEmbed = new EmbedBuilder()
        //                     .setTitle(`${carMake} | ${motData['model']} "${motData['registration']}" - MOT History`)
        //                     .setThumbnail(`https://www.carlogos.org/car-logos/${motData['make'].toLowerCase()}-logo.png`)
        //                     .setColor(carColors[motData['primaryColour'].toString().toUpperCase()])
        //                     .setFooter({
        //                         "text": `Requested by ${interaction.user.username}`,
        //                         "iconURL": interaction.user.avatarURL()
        //                     });

        //                 // add the optional data fields
        //                 let motTestEmbeds = [];
        //                 if (!motData['motTests']) {
        //                     // Not tests yet done on the car? Car may be new
        //                     baseMotEmbed.setDescription(`Not MOT Tests Found... First Test Due ${motFirstDate['relativeTime'].replace("in", "within")} (${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''})`);
        //                 } else {
        //                     baseMotEmbed.setDescription(`${motData['motTests'].length} MOT Test${motData['motTests'].length > 1 ? "s" : ""} Found... First Test Date ${motFirstDate['date']}${motFirstDate['ordinal']} ${motFirstDate['monthName']}${motFirstDate['year'] !== dateTime(new Date())['year'] ? ` ${motFirstDate['year']}` : ''}`);

        //                     // for each test make an embed 
        //                     let reversed
        //                     for (let motTestIndex in motData['motTests']) {
        //                         try {
        //                             let currentTestEmbeds = [];
        //                             let motTest = motData['motTests'][motTestIndex];
        //                             let motTestDate = dateTime(new Date(motTest['completedDate']));

        //                             let motTestEmbed = new EmbedBuilder()
        //                                 .setTitle(`${motTest['testResult'].charAt(0).toUpperCase() + motTest['testResult'].slice(1).toLowerCase()} | MOT Test ${parseInt(motTestIndex) + 1} / ${motData['motTests'].length}`)
        //                                 .setColor(motTest['testResult'] === "FAILED" ? "DarkRed" : motTest['testResult'] === "PASSED" ? "DarkGreen" : "Random") // we should never get a random color.... but just in case (The docs for the MOT API are not very good)
        //                                 .addFields([
        //                                     { "name": "Test Date", "value": `${motTestDate['time']['hours']}:${motTestDate['time']['minutes']} ${motTestDate['date']}${motTestDate['ordinal']} ${motTestDate['monthName']} ${motTestDate['year']}`, "inline": true },
        //                                 ])
        //                                 .setFooter({
        //                                     "text": `MOT Test Number: ${motTest['motTestNumber']}`,
        //                                 })
        //                             // set the expiry date if available (Only if its a passed test)
        //                             if (motTest['expiryDate']) {
        //                                 let motTestExpiryDate = dateTime(new Date(motTest['expiryDate']));
        //                                 motTestEmbed.addFields([{ "name": "Expires", "value": `${motTestExpiryDate['date']}${motTestExpiryDate['ordinal']} ${motTestExpiryDate['monthName']} ${motTestExpiryDate['year']}`, "inline": true }]);
        //                             } else {
        //                                 motTestEmbed.addFields([{ "name": "\u200b", "value": "\u200b", "inline": true }]);
        //                             }
        //                             motTestEmbed.addFields([{ "name": "Mileage at MOT", "value": `${motTest['odometerValue'].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${motTest['odometerUnit']}`, "inline": true }]);

        //                             // sort the rfrs by type Fail, Minor, Advisory, Anythign else
        //                             let rfrAndComments = [...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "FAIL"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "MINOR"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] === "ADVISORY"), ...motTest['rfrAndComments'].filter(rfr => rfr['type'] !== "FAIL" && rfr['type'] !== "MINOR" && rfr['type'] !== "ADVISORY")];

        //                             // if rfrAndComments is over a length 22 we need to split the whole embed into chunks
        //                             let totalRfrSize = 3;
        //                             for (let eachRfr of rfrAndComments) {
        //                                 if (totalRfrSize >= 25) {
        //                                     // we need to make a new embed
        //                                     currentTestEmbeds.push(motTestEmbed);
        //                                     motTestEmbed = new EmbedBuilder()
        //                                         .setTitle(`${motTest['testResult'].charAt(0).toUpperCase() + motTest['testResult'].slice(1).toLowerCase()} | MOT Test ${parseInt(motTestIndex) + 1} / ${motData['motTests'].length} (Continued)`)
        //                                         .setColor(motTest['testResult'] === "FAILED" ? "DarkRed" : motTest['testResult'] === "PASSED" ? "DarkGreen" : "Random") // we should never get a random color.... but just in case (The docs for the MOT API are not very good)
        //                                         .setFooter({
        //                                             "text": `MOT Test Number: ${motTest['motTestNumber']}`,
        //                                         })
        //                                     totalRfrSize = 0;
        //                                 }

        //                                 // add the rfr to the embed
        //                                 motTestEmbed.addFields({ "name": `${eachRfr['type'].charAt(0).toUpperCase() + eachRfr['type'].slice(1).toLowerCase()}`, "value": `${eachRfr['text']}` });
        //                                 totalRfrSize++;
        //                             }


        //                             // push embeds
        //                             currentTestEmbeds.push(motTestEmbed);
        //                             motTestEmbeds.push(...currentTestEmbeds);
        //                         } catch (err) {
        //                             console.log(err);
        //                             console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating MOT Test Embed: ${err}`);
        //                         }
        //                     }
        //                 }

        //                 // add to the embeds array
        //                 embeds.push(baseMotEmbed, ...motTestEmbeds);
        //             } catch (err) {
        //                 console.log(err);
        //                 console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating MOT Embed: ${err}`);
        //             }
        //         }
        //     }

        //     // send to discord
        //     if (embeds.length <= 0) throw new Error("No Data Found for that Registration Number");

        //     let totalEmbedSize = 0;
        //     let embedsChunks = [];
        //     let currentEmbedChunk = [];
        //     // if the embeds array is longer than 10 we need to split it into chunks
        //     for (let eachEmbed of embeds) {
        //         if (totalEmbedSize >= 10) {
        //             embedsChunks.push(currentEmbedChunk);
        //             currentEmbedChunk = [];
        //             totalEmbedSize = 0;
        //         }
        //         currentEmbedChunk.push(eachEmbed);
        //         totalEmbedSize++;
        //     }
        //     if (currentEmbedChunk.length > 0) embedsChunks.push(currentEmbedChunk);

        //     // check we arent currently in a thread
        //     if (!interaction.channel.isThread()) {
        //         // if a thread already exists we can just send the embeds to it to keep them all in one place
        //         var thread = undefined;
        //         for (let serverChannel of interaction.guild.channels.cache) {
        //             if (serverChannel[1]['type'] !== 11) continue;
        //             if (serverChannel[1]['name'] !== `${reg}`) continue;
        //             thread = serverChannel[1];
        //         }
        //         if (!thread) {
        //             thread = await interaction.channel.threads.create({
        //                 name: `${reg}`,
        //                 autoArchiveDuration: 1440,
        //                 reason: `MOT History for ${reg}`
        //             });
        //         }
        //     }

        //     // send chunks
        //     for (let eachEmbedChunk of embedsChunks) {
        //         if (!interaction.channel.isThread()) {
        //             await thread.send({
        //                 embeds: eachEmbedChunk
        //             });
        //         } else {
        //             await interaction.followUp({
        //                 embeds: eachEmbedChunk,
        //                 thread: thread
        //             });
        //         }
        //         await new Promise(resolve => setTimeout(resolve, 500));
        //     }

        //     // send final message
        //     let finalThreadNotifyEmbed = new EmbedBuilder()
        //         .setTitle(`MOT History for ${reg}`)
        //         .setDescription(`MOT History for ${reg} has been sent to ${thread}`)
        //         .setColor("#FFB347");
        //     await interaction.editReply({
        //         embeds: [finalThreadNotifyEmbed]
        //     });
    }
}