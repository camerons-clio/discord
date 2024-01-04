const lcl = require('cli-color');
const {
    SlashCommandBuilder
} = require('discord.js');
const commandFailedEmbed = require('../assets/Discord/commandFailedEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Pong!'),
    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        try {
            console.log(l)
            await interaction.editReply({
                content: 'Pong!'
            });
        } catch (err) {
            await commandFailedEmbed(interaction, err);
        }
    }
}