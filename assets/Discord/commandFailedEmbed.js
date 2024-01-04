require('dotenv').config();
const lcl = require('cli-color');
const { EmbedBuilder } = require('discord.js');

async function commandFailedEmbed(interaction, err) {
    // capatalize first letter of command name
    let commandName = `${interaction.commandName?.toString().charAt(0).toUpperCase()}${interaction.commandName?.toString().slice(1)}`;
    console.log(`${lcl.redBright('[Discord - Error]')} Command ${commandName} failed: "${lcl.yellowBright(err.message)}"`);

    // build and send error embed
    let errorEmbed = new EmbedBuilder()
        .setTitle(`Error - ${commandName} Failed`)
        // check if we are development or not to send detauled error message
        .setDescription(process.env.NODE_ENV == "development" ? err['message'] || `Something went wrong while executing ${commandName}` : `Something went wrong while executing ${commandName}`)
        .setColor('#FF6961');
    await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true
    });
}

module.exports = commandFailedEmbed;