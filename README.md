# D&D Dice Roller Discord Bot

A Discord bot that helps you roll dice for D&D and other tabletop games. Supports all standard D&D dice types and includes features for advantage/disadvantage rolls.

## Features

- Roll any standard D&D dice (d4, d6, d8, d10, d12, d20, d100)
- Roll multiple dice at once
- Support for advantage and disadvantage on d20 rolls
- Keep highest rolls using the 'kh' modifier
- Shows individual roll results and totals
- Beautiful embedded messages for roll results

## Commands

- `/setup` - Initialize the bot for this server (Admin only)
- `/roll dice:[number]d[sides]` - Roll dice (e.g., `/roll dice:2d6`, `/roll dice:d20`)
- `/roll dice:[number]d[sides]kh[number]` - Roll dice and keep highest rolls (e.g., `/roll dice:4d6kh3`)
- `/roll dice:d20 modifier:advantage` - Roll with advantage
- `/roll dice:d20 modifier:disadvantage` - Roll with disadvantage
- `/leaderboard [limit]` - View server-wide dice rolling statistics (default: 10 players)
- `/stats [user]` - View dice rolling statistics for yourself or another user
- `/delete_user_data` - Delete your personal roll data for this server
- `/delete_server_data` - Delete all server roll data (Admin only)
- `/help` - Display all available commands with usage examples

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

- `/roll dice:2d6` - Roll two six-sided dice
- `/roll dice:d20` - Roll one twenty-sided die
- `/roll dice:3d8` - Roll three eight-sided dice
- `/roll dice:4d6kh3` - Roll four six-sided dice and keep the highest three (common for D&D character creation)
- `/roll dice:d20 modifier:advantage` - Roll d20 with advantage
- `/roll dice:d20 modifier:disadvantage` - Roll d20 with disadvantage