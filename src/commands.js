const { SlashCommandBuilder } = require('discord.js');

const commands = [
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
];

module.exports = commands;