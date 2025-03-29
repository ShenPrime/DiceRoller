# D&D Dice Roller Discord Bot

A Discord bot that helps you roll dice for D&D and other tabletop games. Supports all standard D&D dice types and includes features for advantage/disadvantage rolls.

## Features

- Roll any standard D&D dice (d4, d6, d8, d10, d12, d20, d100)
- Roll multiple dice at once
- Support for advantage and disadvantage on d20 rolls
- Shows individual roll results and totals
- Beautiful embedded messages for roll results

## Commands

- `!roll [number]d[sides]` - Roll dice (e.g., `!roll 2d6`, `!roll d20`)
- `!roll d20 advantage` - Roll with advantage
- `!roll d20 disadvantage` - Roll with disadvantage

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and add your Discord bot token:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   ```

3. Start the bot:
   ```bash
   npm start
   ```

## Examples

- `!roll 2d6` - Roll two six-sided dice
- `!roll d20` - Roll one twenty-sided die
- `!roll 3d8` - Roll three eight-sided dice
- `!roll d20 advantage` - Roll d20 with advantage
- `!roll d20 disadvantage` - Roll d20 with disadvantage