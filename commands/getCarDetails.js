const lcl = require('cli-color');
const fetch = require('node-fetch');
const {
    SlashCommandBuilder
} = require('discord.js');
const commandFailedEmbed = require('../assets/Discord/commandFailedEmbed');

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
            const reg = interaction.options.getString('reg');

            // get the VES Data
            let vesData = await fetch(`https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`, {
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
            if (vesData.status !== 200) throw new Error(`VES API returned ${vesData.status}`);
            vesData = await vesData.json();

            // get the MOT Data
            let motData = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${reg}`, {
                method: 'GET',
                headers: {
                    "Accept": "application/json",
                    "x-api-key": process.env.MOT_KEY
                }
            });
            if (motData.status !== 200) throw new Error(`MOT API returned ${motData.status}`);
            motData = await motData.json();
            
            console.log(vesData, motData)

            await interaction.edit({
                content: JSON.stringify(vesData, null, 2)
            })
        } catch (err) {
            await commandFailedEmbed(interaction, err);
        }
    }
}