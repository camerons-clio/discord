const lcl = require('cli-color');
const fetch = require('node-fetch');
const dateTime = require('../assets/Time/dateTime');
const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const commandFailedEmbed = require('../assets/Discord/commandFailedEmbed');

// The DVLA Returns the color as a work like "BLUE" or "RED" so we need to convert it to a hex code for the embed
let carColors = { "BEIGE": "#F5F5DC", "BLACK": "#000000", "BLUE": "#0000FF", "BRONZE": "#CD7F32", "BROWN": "#A52A2A", "BUFF": "#F0DC82", "CREAM": "#FFFDD0", "GOLD": "#FFD700", "GREEN": "#008000", "GREY": "#808080", "IVORY": "#FFFFF0", "MAROON": "#800000", "ORANGE": "#FFA500", "PINK": "#FFC0CB", "PURPLE": "#800080", "RED": "#FF0000", "SILVER": "#C0C0C0", "TURQUOISE": "#40E0D0", "WHITE": "#FFFFFF", "YELLOW": "#FFFF00" };
let registerMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", 'November', "December"];

// Docs: https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/v1.2.0-vehicle-enquiry-service.html#schemas-properties-3
// TODO: This should be an HTTP Bot
module.exports = {
    data: new SlashCommandBuilder()
        .setName('car')
        .setDescription('Get Vehicle Details and MOT History')
        .addStringOption(option =>
            option.setName('reg')
                .setDescription('Vehicle Registration Number')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        try {
            // check for ves and mot keys
            if (!process.env.VES_KEY || !process.env.MOT_KEY) throw new Error("Missing API Keys for VES and/or MOT");
            // get the registration number from the command
            const reg = interaction.options.getString('reg')?.toString().replace(/\s/g, '').toUpperCase().trim();

            // check if the registration number is valid
            if (reg.length < 2 || reg.length > 7) throw new Error("Invalid Registration Number");
            let workingEmbed = new EmbedBuilder()
                .setTitle(`Getting Data for ${reg}`)
                .setColor("#FFB347");
            await interaction.editReply({
                embeds: [workingEmbed]
            });

            console.log(`${lcl.blueBright('[DVLA - Info]')} Getting Data for ${reg}`);

            // get the VES Data
            let vesDataRaw = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
                method: 'POST',
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "x-api-key": process.env.VES_KEY
                },
                body: JSON.stringify({
                    registrationNumber: reg
                })
            });
            let vesData = await vesDataRaw.json();

            // get the MOT Data
            let motDataRaw = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${reg}`, {
                method: 'GET',
                headers: {
                    "Accept": "application/json",
                    "x-api-key": process.env.MOT_KEY
                }
            });
            let motData = await motDataRaw.json();
            if (vesDataRaw.status !== 200 && motDataRaw.status !== 200) throw new Error("No Data Found for that Registration Number"); // if neither are found throw an error
            console.log(`${lcl.greenBright('[DVLA - Success]')} Found ${reg} in DVLA Database`);

            // Make Embed for Car's Data
            let embeds = [];
            // VES Embed
            if (vesDataRaw.status === 200) {
                try {
                    // title case some of the data we use  more than once
                    let carMake = vesData['make'].charAt(0).toUpperCase() + vesData['make'].slice(1).toLowerCase();

                    let vesInitialEmbed = new EmbedBuilder()
                        .setTitle(`${carMake} - "${vesData['registrationNumber']}" (${vesData['yearOfManufacture']} - ${vesData['colour'].charAt(0).toUpperCase() + vesData['colour'].slice(1).toLowerCase()})`)
                        .setThumbnail(`https://www.carlogos.org/car-logos/${vesData['make'].toLowerCase()}-logo.png`)
                        .setColor(carColors[vesData['colour'].toString().toUpperCase()])
                        .setFooter({
                            "text": `Requested by ${interaction.user.username}`,
                            "iconURL": interaction.user.avatarURL()
                        })
                        .setTimestamp();

                    // add the optional data fields
                    vesInitialEmbed.addFields([{"name": "Make", "value": carMake, "inline": true}])
                    if (vesData['monthOfFirstRegistration']) {
                        // the first registration date is in the format "YYYY-MM"
                        let firstRegMonth = parseInt(vesData['monthOfFirstRegistration'].split("-")[1]);
                        let firstRegYear = parseInt(vesData['monthOfFirstRegistration'].split("-")[0]);
                        vesInitialEmbed.addFields([{"name": "First Registered", "value": `${registerMonthNames[firstRegMonth - 1]} ${firstRegYear}`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['monthOfFirstDvlaRegistration']) {
                        // again based on the format "YYYY-MM"
                        let firstDvlaRegMonth = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[1]);
                        let firstDvlaRegYear = parseInt(vesData['monthOfFirstDvlaRegistration'].split("-")[0]);
                        vesInitialEmbed.addFields([{"name": "First Registered with DVLA", "value": `${registerMonthNames[firstDvlaRegMonth - 1]} ${firstDvlaRegYear}`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }

                    // fuel data
                    if (vesData['fuelType']) {
                        // we need to take each word and title case it
                        let fuelType = vesData['fuelType'].split(" ").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
                        vesInitialEmbed.addFields([{"name": "Fuel Type", "value": fuelType, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['engineCapacity']) {
                        let roundedEngineCapacity = Math.floor((Math.ceil(vesData['engineCapacity'] / 100) * 100) / 1000).toFixed(1);
                        vesInitialEmbed.addFields([{"name": "Engine Capacity", "value": `${roundedEngineCapacity}L`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['co2Emissions']) {
                        vesInitialEmbed.addFields([{"name": "CO2 Emissions", "value": `${vesData['co2Emissions']}g/km`, "inline": true}]);
                    } else { 
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }

                    // tax data
                    if (vesData['taxStatus']) {
                        vesInitialEmbed.addFields([{"name": "Tax Status", "value": vesData['taxStatus'], "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['taxDueDate']) {
                        let currentDate = dateTime(new Date());
                        let taxDueDate = dateTime(new Date(vesData['taxDueDate']));
                        vesInitialEmbed.addFields([{"name": "Tax Due", "value": `Due ${taxDueDate['relativeTime']} (${taxDueDate['date']}${taxDueDate['ordinal']} ${taxDueDate['monthName']}${currentDate['year'] !== taxDueDate['year'] ? ` ${taxDueDate['year']}` : ''})`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['artEndDate']) {
                        let currentDate = dateTime(new Date());
                        let artEndDate = dateTime(new Date(vesData['artEndDate']));
                        vesInitialEmbed.addFields([{"name": "ART Ends", "value": `${artEndDate['relativeTime'].charAt(0).toUpperCase() + artEndDate['relativeTime'].slice(1).toLowerCase()} (${artEndDate['date']}${artEndDate['ordinal']} ${artEndDate['monthName']}${currentDate['year'] !== artEndDate['year'] ? ` ${artEndDate['year']}` : ''})`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }

                    // mot data
                    if (vesData['motStatus']) {
                        vesInitialEmbed.addFields([{"name": "MOT Status", "value": vesData['motStatus'], "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    if (vesData['motExpiryDate']) {
                        let currentDate = dateTime(new Date());
                        let motExpiryDate = dateTime(new Date(vesData['motExpiryDate']));
                        vesInitialEmbed.addFields([{"name": "MOT Due", "value": `Due ${motExpiryDate['relativeTime']} (${motExpiryDate['date']}${motExpiryDate['ordinal']} ${motExpiryDate['monthName']}${currentDate['year'] !== motExpiryDate['year'] ? ` ${motExpiryDate['year']}` : ''})`, "inline": true}]);
                    } else {
                        vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);
                    }
                    vesInitialEmbed.addFields([{"name": "\u200b", "value": "\u200b", "inline": true}]);

                    // add to the embeds array
                    embeds.push(vesInitialEmbed);

                } catch (err) {
                    console.log(err);
                    console.log(`${lcl.redBright('[DVLA - Error]')} Error Creating VES Embed: ${err}`);
                }
            }

            // send to discord
            if (embeds.length <= 0) throw new Error("No Data Found for that Registration Number");
            await interaction.followUp({
                embeds
            })
        } catch (err) {
            await commandFailedEmbed(interaction, err);
        }
    }
}