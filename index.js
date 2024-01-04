require("dotenv").config();
const lcl = require("cli-color");
const path = require("path");
const {
    REST
} = require('@discordjs/rest');
const {
    Client,
    GatewayIntentBits,
    Routes,
    Collection,
    ActivityType,
    EmbedBuilder
} = require("discord.js");
const {
    existsSync,
    mkdirSync,
    readdirSync
} = require('fs');

const client = new Client({
    disableEveryone: true,
    intents: [GatewayIntentBits.Guilds],
});

try {
    // check that the commands folder exists if not create it
    if (!existsSync(path.join(__dirname, 'commands'))) {
        console.log(`${lcl.blue('[Discord - Info]')} Creating commands folder.`);
        mkdirSync(path.join(__dirname, 'commands'));
    }

    // get base for commands
    const commands = [];
    const commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    client.commands = new Collection();

    for (const file of commandFiles) {
        try {
            const command = require(path.join(__dirname, 'commands', file));
            // if we are in production (not NODE_ENV=development), skip dev commands (commands that are not .public.js)
            if (process.env.NODE_ENV != "development" && !file.endsWith(".public.js")) continue;
            commands.push(command.data.toJSON());
            client.commands.set(command.data.name, command);
        } catch (err) {
            console.log(`${lcl.redBright('[Discord - Error]')} Failed to load command "${lcl.yellowBright(file)}": ${lcl.yellowBright(err.message)}`);
        }
    }

    if (commands.length <= 0) throw new Error("No commands found");

    const rest = new REST({
        version: '10'
    }).setToken(process.env.TOKEN);

    let clientOnline = false;
    client.once("ready", async (client) => {
        // set the bot to idle during startup
        await client.user.setPresence({ activities: [{ name: 'Loading...', type: ActivityType.Idle }], status: 'idle' });

        // get client ID
        const clientId = client.user.id;

        // attempt to clear commands
        if (process.env.NO_REFRESH != "true") {
            try {
                console.log(lcl.blue("[Discord - Info]"), `Clearing application (/) commands.`);
                if (process.env.SERVER != undefined && process.env.SERVER != "") {
                    try {
                        console.log(lcl.blue("[Discord - Info]"), "Clearing server ID: " + process.env.SERVER);
                        var data = await rest.put(
                            Routes.applicationGuildCommands(clientId, process.env.SERVER), {
                            body: []
                        });
                    } catch (err) {
                        console.log(lcl.red("[Discord - Error]"), `Failed to clear application (/) commands on server ID: ${process.env.SERVER}`);
                    }
                }
                var data = await rest.put(
                    Routes.applicationCommands(clientId), {
                    body: []
                });
                console.log(lcl.green("[Discord - Success]"), `Successfully cleared application (/) commands.`);
            } catch (err) {
                throw new Error("Failed to clear application (/) commands.");
            }
        }

        // attempt to register commands
        try {
            console.log(lcl.blue("[Discord - Info]"), `Started refreshing ${lcl.yellow(commands.length)} application (/) ${commands.length > 1 ? "commands" : "command"}.`);
            if (process.env.NODE_ENV == "development" && (process.env.SERVER != undefined && process.env.SERVER != "")) {
                console.log(lcl.blue("[Discord - Info (Dev)]"), "Using server ID: " + process.env.SERVER);
                var data = await rest.put(
                    Routes.applicationGuildCommands(clientId, process.env.SERVER), {
                    body: commands
                });
            } else {
                var data = await rest.put(
                    Routes.applicationCommands(clientId), {
                    body: commands
                });
            }
            console.log(lcl.green("[Discord - Success]"), `Successfully reloaded ${lcl.yellow(data.length)} application (/) ${commands.length > 1 ? "commands" : "command"}.`);
        } catch (err) {
            throw new Error("Failed to register application (/) commands.");
        }

        // set the bot to online
        await client.user.setPresence({ activities: [{ name: 'Online', type: ActivityType.Idle }], status: 'online' });

        // finish
        clientOnline = true;
        console.log(lcl.blue("[Discord - Info]"), `Logged in as "${lcl.yellow(client.user.tag)}"!`);
    });

    client.on('interactionCreate', async interaction => {
        // try find command
        try {
            // if bot is not online send loading embed
            if (!clientOnline) {
                let loadingEmbed = new EmbedBuilder()
                    .setTitle('Loading...')
                    .setColor('#FF964F');
                return await interaction.reply({
                    embeds: [loadingEmbed],
                    ephemeral: true
                });
            }

            // if no command or bot is author, return
            if (!interaction.isCommand() || interaction.user.bot) return;

            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            // try executing command
            console.log(`${lcl.blue('[Discord - Info]')} Executing command: "${lcl.yellowBright(interaction.commandName)}" (${interaction.user.username}${interaction.user.tag !== interaction.user.username ? `#${interaction.user.tag}` : ""})`);
            await command.execute(interaction);
        } catch (err) {
            console.log(lcl.red("[Discord - Error]"), `Failed to execute command: "${interaction.commandName}"`);
            console.error(err);

            let interactionErrorEmbed = new EmbedBuilder()
                .setTitle('Error - Failed to execute command')
                .setDescription(`${process.env.NODE_ENV == "development" ? `${err['message']}\n\n` : ""}Failed to execute command: "${interaction.commandName}"`)
                .setColor('#FF6961');
            await interaction.reply({
                embeds: [interactionErrorEmbed],
                ephemeral: true
            });
        }
    })

    client.login(process.env.TOKEN);
} catch (err) {
    console.log(`${lcl.redBright('[Discord - Error]')} Failed to start bot "${lcl.yellowBright(err.message)}"`);
    process.exit(1);
}