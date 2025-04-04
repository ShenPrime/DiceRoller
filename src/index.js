require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
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

  if (interaction.commandName === 'setup') {
    try {
      const success = await db.createServerSchema(interaction.guildId);
      if (success) {
        await interaction.reply({ content: 'Server successfully initialized! The bot is now ready to track dice rolls.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Server initialization failed. Please try again later.', ephemeral: true });
      }
    } catch (error) {
      console.error('Error initializing server:', error);
      await interaction.reply({ content: 'There was an error initializing the server!', ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === 'leaderboard') {
    try {
      const limit = interaction.options.getInteger('limit') || 20;
      const leaderboards = await db.getLeaderboard(interaction.guildId, limit);
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🏆 Dice Rolling Leaderboard')
        .setDescription('Server Dice Rolling Statistics');

      // Get rank emojis for top positions
      const getRankEmoji = (position) => {
        const emojis = ['👑', '⭐', '✨'];
        return position < emojis.length ? emojis[position] : `${position + 1}`;
      };

      embed.setDescription(`🎲 **Server Leaderboard**\n*Top ${leaderboards.overallLeaderboard.length} Players*`);

      // Add individual player stats as separate fields
      for (const [index, stats] of leaderboards.overallLeaderboard.entries()) {
        const member = await interaction.guild.members.fetch(stats.user_id);
        const displayName = member.nickname || member.user.displayName || member.user.username;
        const rankDisplay = getRankEmoji(index);
        const critRate = stats.overall_crit_percentage;
        
        // Dynamic performance indicators
        const critEmoji = critRate >= 15 ? '🔥' : (critRate >= 10 ? '⚡' : '🎯');
        const progressBar = '▰'.repeat(Math.min(10, Math.floor(critRate / 5))) + '▱'.repeat(Math.max(0, 10 - Math.floor(critRate / 5)));
        
        embed.addFields({
          name: `${rankDisplay} ${displayName}`,
          value: `${critEmoji} **${stats.total_rolls}** rolls • **${stats.total_crits}** crits\n${progressBar} **${critRate}%** crit rate`,
          inline: false
        });
      }

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
      const stats = await db.getUserStats(targetUser.id, interaction.guildId);
      
      if (!stats.overallStats) {
        return interaction.reply({ content: `No roll statistics found for ${targetUser.username}`, ephemeral: true });
      }

      const member = await interaction.guild.members.fetch(targetUser.id);
      const displayName = member.nickname || targetUser.displayName || targetUser.username;
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🎲 Roll Statistics for ${displayName}`)
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

  if (interaction.commandName === 'delete_server_data') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }
    
    try {
      await db.deleteServerData(interaction.guildId);
      await interaction.reply({ content: 'All server data has been deleted successfully!', ephemeral: true });
    } catch (error) {
      console.error('Error deleting server data:', error);
      await interaction.reply({ content: 'There was an error deleting server data!', ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === 'delete_user_data') {
    try {
      await db.deleteUserData(interaction.user.id, interaction.guildId);
      await interaction.reply({ content: 'Your personal roll data has been deleted successfully!', ephemeral: true });
    } catch (error) {
      console.error('Error deleting user data:', error);
      await interaction.reply({ content: 'There was an error deleting your data!', ephemeral: true });
    }
    return;
  }

  if (interaction.commandName === 'explain') {
    const commandToExplain = interaction.options.getString('command');
    
    const explanations = {
      help: {
        title: '🎲 Help Command',
        description: 'Displays all available commands with brief usage examples.',
        examples: ['/help']
      },
      setup: {
        title: '⚙️ Setup Command',
        description: 'Initializes the bot for this server. This must be run before any other commands will work.',
        examples: ['/setup'],
        note: '*Admin only*'
      },
      roll: {
        title: '🎲 Roll Command',
        description: 'Rolls various types of dice with different modifiers.',
        examples: [
          '/roll dice:2d6',
          '/roll dice:4d6kh3',
          '/roll dice:d20 modifier:advantage',
          '/roll dice:d20 modifier:disadvantage'
        ]
      },
      leaderboard: {
        title: '🏆 Leaderboard Command',
        description: 'Shows server-wide dice rolling statistics, including top players by number of rolls and critical hits.\n\n**Roll%** shows what percentage of rolls are at or above the average roll for that die type (e.g. 11+ on d20).',
        examples: ['/leaderboard', '/leaderboard limit:5']
      },
      stats: {
        title: '📊 Stats Command',
        description: 'Displays detailed dice rolling statistics for yourself or another user.\n\n**Roll%** shows what percentage of your rolls are at or above the average roll for that die type (e.g. 11+ on d20).',
        examples: ['/stats', '/stats user:@username']
      },
      delete_user_data: {
        title: '🗑️ Delete User Data',
        description: 'Permanently deletes your personal roll data for this server.',
        examples: ['/delete_user_data']
      },
      delete_server_data: {
        title: '⚠️ Delete Server Data',
        description: 'Permanently deletes ALL roll data for this server.',
        examples: ['/delete_server_data'],
        note: '*Admin only*'
      }
    };
    
    const commandInfo = explanations[commandToExplain];
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(commandInfo.title)
      .setDescription(commandInfo.description)
      .addFields({
        name: 'Usage Examples',
        value: commandInfo.examples.map(ex => `• ${ex}`).join('\n')
      });
      
    if (commandInfo.note) {
      embed.addFields({
        name: 'Note',
        value: commandInfo.note
      });
    }
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  
  if (interaction.commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎲 Dice Roller Bot Commands')
      .setDescription('Here are all available commands with usage examples:')
      .addFields(
        {
          name: '/setup',
          value: 'Initialize the bot for this server\n*Admin only*'
        },
        {
          name: '/roll dice:[number]d[sides]',
          value: 'Roll dice (e.g., `/roll dice:2d6`, `/roll dice:d20`)'
        },
        {
          name: '/roll dice:[number]d[sides]kh[number]',
          value: 'Roll dice and keep highest rolls (e.g., `/roll dice:4d6kh3`)'
        },
        {
          name: '/roll dice:d20 modifier:advantage',
          value: 'Roll with advantage'
        },
        {
          name: '/roll dice:d20 modifier:disadvantage',
          value: 'Roll with disadvantage'
        },
        {
          name: '/leaderboard [limit]',
          value: 'View server-wide dice rolling statistics (default: 10 players)'
        },
        {
          name: '/stats [user]',
          value: 'View dice rolling statistics for yourself or another user'
        },
        {
          name: '/delete_user_data',
          value: 'Delete your personal roll data for this server'
        },
        {
          name: '/delete_server_data',
          value: 'Delete all server roll data\n*Admin only*'
        }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
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
      await db.updateRollStats(interaction.user.id, interaction.guildId, 20, result);
    } else if (!parsed.keepHighest) {
      for (const roll of rolls) {
        await db.updateRollStats(interaction.user.id, interaction.guildId, parsed.sides, roll);
      }
    } else {
      for (const roll of rolls.slice(0, parsed.keepHighest)) {
        await db.updateRollStats(interaction.user.id, interaction.guildId, parsed.sides, roll);
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