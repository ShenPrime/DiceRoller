require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const commands = require('./commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent
  ]
});

const diceTypes = [4, 6, 8, 10, 12, 20, 100];

function rollDice(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function rollWithAdvantage() {
  const roll1 = rollDice(20);
  const roll2 = rollDice(20);
  return { rolls: [roll1, roll2], result: Math.max(roll1, roll2) };
}

function rollWithDisadvantage() {
  const roll1 = rollDice(20);
  const roll2 = rollDice(20);
  return { rolls: [roll1, roll2], result: Math.min(roll1, roll2) };
}

function parseRollCommand(command) {
  const parts = command.toLowerCase().split(' ');
  const rollPart = parts[0];
  const hasAdvantage = parts.includes('advantage');
  const hasDisadvantage = parts.includes('disadvantage');

  if (hasAdvantage || hasDisadvantage) {
    if (rollPart !== 'd20' && rollPart !== '1d20') {
      return { error: 'Advantage/Disadvantage only works with d20 rolls' };
    }
    return {
      type: hasAdvantage ? 'advantage' : 'disadvantage'
    };
  }

  const match = rollPart.match(/^(\d+)?d(\d+)(kh\d+)?$/);
  if (!match) return { error: 'Invalid roll format. Use: [number]d[sides] or [number]d[sides]kh[number] (e.g., 2d6 or 4d6kh3)' };

  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const keepHighest = match[3] ? parseInt(match[3].substring(2)) : null;

  if (count > 100) return { error: 'Cannot roll more than 100 dice at once' };
  if (!diceTypes.includes(sides)) return { error: `Invalid die type. Available types: ${diceTypes.join(', ')}` };
  if (keepHighest !== null && keepHighest > count) return { error: 'Cannot keep more dice than you roll' };

  return { count, sides, keepHighest };
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'roll') return;

  const dice = interaction.options.getString('dice');
  const modifier = interaction.options.getString('modifier');
  const command = modifier ? `${dice} ${modifier}` : dice;
  const parsed = parseRollCommand(command);

  if (parsed.error) {
    return interaction.reply({ content: parsed.error, ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🎲 Dice Roll');

  if (parsed.type === 'advantage' || parsed.type === 'disadvantage') {
    const roll = parsed.type === 'advantage' ? rollWithAdvantage() : rollWithDisadvantage();
    embed.setDescription(`Rolling with ${parsed.type}...`)
      .addFields(
        { name: 'Rolls', value: roll.rolls.join(', '), inline: true },
        { name: 'Result', value: roll.result.toString(), inline: true }
      );
  } else {
    const rolls = [];
    let total = 0;

    for (let i = 0; i < parsed.count; i++) {
      const roll = rollDice(parsed.sides);
      rolls.push(roll);
    }

    if (parsed.keepHighest) {
      rolls.sort((a, b) => b - a);
      const keptRolls = rolls.slice(0, parsed.keepHighest);
      total = keptRolls.reduce((sum, roll) => sum + roll, 0);
      embed.setDescription(`Rolling ${parsed.count}d${parsed.sides} keeping highest ${parsed.keepHighest}...`)
        .addFields(
          { name: 'All Rolls', value: rolls.join(', '), inline: true },
          { name: 'Kept Rolls', value: keptRolls.join(', '), inline: true },
          { name: 'Total', value: total.toString(), inline: true }
        );
    } else {
      total = rolls.reduce((sum, roll) => sum + roll, 0);
      embed.setDescription(`Rolling ${parsed.count}d${parsed.sides}...`)
        .addFields(
          { name: 'Rolls', value: rolls.join(', '), inline: true },
          { name: 'Total', value: total.toString(), inline: true }
        );
    }
  }

  try {
    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error handling slash command:', error);
    if (!interaction.replied) {
      await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
  }
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error registering application commands:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);