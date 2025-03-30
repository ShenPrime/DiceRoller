const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('explain')
    .setDescription('Get detailed explanation and usage examples for commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('The command to explain')
        .setRequired(true)
        .addChoices(
          { name: 'help', value: 'help' },
          { name: 'setup', value: 'setup' },
          { name: 'delete_server_data', value: 'delete_server_data' },
          { name: 'delete_user_data', value: 'delete_user_data' },
          { name: 'leaderboard', value: 'leaderboard' },
          { name: 'roll', value: 'roll' },
          { name: 'stats', value: 'stats' }
        )
    ),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands with usage examples'),
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Initialize the bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('delete_server_data')
    .setDescription('Delete all dice roll data for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('delete_user_data')
    .setDescription('Delete your dice roll data for this server'),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server-wide dice rolling statistics')
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of players to show (default: 10)')
        .setMinValue(1)
        .setMaxValue(25)
    ),
  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll some dice!')
    .addStringOption(option =>
      option
        .setName('dice')
        .setDescription('The dice to roll (e.g., 2d6)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('modifier')
        .setDescription('Roll with advantage or disadvantage')
        .addChoices(
          { name: 'advantage', value: 'advantage' },
          { name: 'disadvantage', value: 'disadvantage' }
        )
    ),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your dice rolling statistics')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to check stats for (defaults to yourself)')
        .setRequired(false)
    ),
];

module.exports = commands;