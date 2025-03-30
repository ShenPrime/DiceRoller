require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes } = require('discord.js');
const commands = require('./commands');
const db = require('./database/DBController');

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

  if (interaction.commandName === 'leaderboard') {
    try {
      const limit = interaction.options.getInteger('limit') || 10;
      const leaderboards = await db.getLeaderboard(limit);
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🏆 Dice Rolling Leaderboard')
        .setDescription('Server Dice Rolling Statistics');

      // Overall Leaderboard
      let overallField = '```\nRank   User         Rolls   Crits   Roll %   Crit %\n--------------------------------------------------\n';
      for (const [index, stats] of leaderboards.overallLeaderboard.entries()) {
        const user = await client.users.fetch(stats.user_id);
        overallField += `${String(index + 1).padStart(4)}   ${user.username.padEnd(12)}${String(stats.total_rolls).padStart(7)}   ${String(stats.total_crits).padStart(6)}   ${String(stats.overall_roll_percentage).padStart(6)}%   ${String(stats.overall_crit_percentage).padStart(5)}%\n`;
      }
      overallField += '```';
      embed.addFields({ name: '📊 Server Statistics', value: overallField || 'No data available' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.reply({ content: 'There was an error fetching the leaderboard!', ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === 'stats') {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    try {
      const stats = await db.getUserStats(targetUser.id);
      
      if (!stats.overallStats) {
        return interaction.reply({ content: `No roll statistics found for ${targetUser.username}`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🎲 Roll Statistics for ${targetUser.username}`)
        .setDescription('Here are your dice rolling statistics:')
        .addFields(
          {
            name: '📊 Overall Stats',
            value: `Total Rolls: ${stats.overallStats.total_rolls}
Critical Hits: ${stats.overallStats.total_crits}
Overall Roll %: ${stats.overallStats.overall_roll_percentage}%
Critical Hit %: ${stats.overallStats.overall_crit_percentage}%`
          }
        );

      // Add individual dice stats
      for (const diceStat of stats.diceStats) {
        embed.addFields({
          name: `d${diceStat.dice_type} Stats`,
          value: `Rolls: ${diceStat.total_rolls}
Crits: ${diceStat.total_crits}
Roll %: ${diceStat.roll_percentage}%
Crit %: ${diceStat.crit_percentage}%`,
          inline: true
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching stats:', error);
      await interaction.reply({ content: 'There was an error fetching the statistics!', ephemeral: true });
    }
    return;
  }

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

  let roll;
  let rolls = [];
  let total = 0;
  let result;

  if (parsed.type === 'advantage' || parsed.type === 'disadvantage') {
    roll = parsed.type === 'advantage' ? rollWithAdvantage() : rollWithDisadvantage();
    rolls = roll.rolls;
    result = roll.result;
    embed.setDescription(`Rolling with ${parsed.type}...`)
      .addFields(
        { name: 'Rolls', value: rolls.join(', '), inline: true },
        { name: 'Result', value: result.toString(), inline: true }
      );
  } else {
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
    // Update roll statistics in database
    if (parsed.type === 'advantage' || parsed.type === 'disadvantage') {
      await db.updateRollStats(interaction.user.id, 20, result);
    } else if (!parsed.keepHighest) {
      for (const roll of rolls) {
        await db.updateRollStats(interaction.user.id, parsed.sides, roll);
      }
    } else {
      for (const roll of rolls.slice(0, parsed.keepHighest)) {
        await db.updateRollStats(interaction.user.id, parsed.sides, roll);
      }
    }

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

    // Initialize database connection
    await db.connect();
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);