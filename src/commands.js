const { SlashCommandBuilder } = require('discord.js');

const commands = [
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