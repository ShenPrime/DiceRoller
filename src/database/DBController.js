const { Pool } = require('pg');

class DBController {
        constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.Postgres_DATABASE_URL
        });
    }

    async connect() {
        try {
            await this.pool.connect();
            console.log('Database connected successfully');
            await this.initializeTables();
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }

    async initializeTables() {
        const createUserStatsTable = `
            CREATE TABLE IF NOT EXISTS user_dice_stats (
                user_id VARCHAR(255) NOT NULL,
                server_id VARCHAR(255) NOT NULL,
                dice_type INTEGER NOT NULL,
                total_rolls INTEGER DEFAULT 0,
                total_crits INTEGER DEFAULT 0,
                total_value INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, server_id, dice_type)
            );
        `;

        const createOverallStatsTable = `
            CREATE TABLE IF NOT EXISTS user_overall_stats (
                user_id VARCHAR(255) NOT NULL,
                server_id VARCHAR(255) NOT NULL,
                total_rolls INTEGER DEFAULT 0,
                total_crits INTEGER DEFAULT 0,
                total_value INTEGER DEFAULT 0,
                total_possible_value INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, server_id)
            );
        `;

        await this.query(createUserStatsTable);
        await this.query(createOverallStatsTable);
    }

    async updateRollStats(userId, serverId, diceType, rollValue) {
        // Update dice-specific stats
        const updateDiceStats = `
            INSERT INTO user_dice_stats (user_id, server_id, dice_type, total_rolls, total_crits, total_value)
            VALUES ($1, $2, $3, 1, $4, $5)
            ON CONFLICT (user_id, server_id, dice_type) DO UPDATE SET
                total_rolls = user_dice_stats.total_rolls + 1,
                total_crits = user_dice_stats.total_crits + $4,
                total_value = user_dice_stats.total_value + $5;
        `;

        // Update overall stats
        const updateOverallStats = `
            INSERT INTO user_overall_stats (user_id, server_id, total_rolls, total_crits, total_value, total_possible_value)
            VALUES ($1, $2, 1, $3, $4, $5)
            ON CONFLICT (user_id, server_id) DO UPDATE SET
                total_rolls = user_overall_stats.total_rolls + 1,
                total_crits = user_overall_stats.total_crits + $3,
                total_value = user_overall_stats.total_value + $4,
                total_possible_value = user_overall_stats.total_possible_value + $5;
        `;

        const isCrit = rollValue === diceType;
        
        await this.query(updateDiceStats, [userId, serverId, diceType, isCrit ? 1 : 0, rollValue]);
        await this.query(updateOverallStats, [userId, serverId, isCrit ? 1 : 0, rollValue, diceType]);
    }

    async getUserStats(userId, serverId) {
        const diceStats = `
            SELECT 
                dice_type,
                total_rolls,
                total_crits,
                ROUND((total_value::float / (dice_type * total_rolls) * 100)::numeric, 2) as roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as crit_percentage
            FROM user_dice_stats
            WHERE user_id = $1 AND server_id = $2
            ORDER BY dice_type;
        `;

        const overallStats = `
            SELECT 
                total_rolls,
                total_crits,
                ROUND((total_value::float / total_possible_value * 100)::numeric, 2) as overall_roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as overall_crit_percentage
            FROM user_overall_stats
            WHERE user_id = $1 AND server_id = $2;
        `;

        const [diceResults, overallResults] = await Promise.all([
            this.query(diceStats, [userId, serverId]),
            this.query(overallStats, [userId, serverId])
        ]);

        return {
            diceStats: diceResults.rows,
            overallStats: overallResults.rows[0]
        };
    }

    async query(text, params) {
        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }

    async getLeaderboard(serverId, limit = 10) {
        const overallLeaderboard = `
            SELECT 
                user_id,
                total_rolls,
                total_crits,
                ROUND((total_value::float / total_possible_value * 100)::numeric, 2) as overall_roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as overall_crit_percentage
            FROM user_overall_stats
            WHERE total_rolls > 0 AND server_id = $1
            ORDER BY total_rolls DESC
            LIMIT $2;
        `;

        const diceLeaderboards = `
            SELECT 
                user_id,
                dice_type,
                total_rolls,
                total_crits,
                ROUND((total_value::float / (dice_type * total_rolls) * 100)::numeric, 2) as roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as crit_percentage
            FROM user_dice_stats
            WHERE total_rolls > 0 AND server_id = $1
            ORDER BY total_rolls DESC
            LIMIT $2;
        `;

        const [overallResults, diceResults] = await Promise.all([
            this.query(overallLeaderboard, [serverId, limit]),
            this.query(diceLeaderboards, [serverId, limit])
        ]);

        return {
            overallLeaderboard: overallResults.rows,
            diceLeaderboard: diceResults.rows
        };
    }

    async close() {
        await this.pool.end();
    }

    async deleteUserData(userId, serverId) {
        const deleteUserDiceStats = 'DELETE FROM user_dice_stats WHERE user_id = $1 AND server_id = $2;';
        const deleteUserOverallStats = 'DELETE FROM user_overall_stats WHERE user_id = $1 AND server_id = $2;';

        await Promise.all([
            this.query(deleteUserDiceStats, [userId, serverId]),
            this.query(deleteUserOverallStats, [userId, serverId])
        ]);
    }

    async deleteServerData(serverId) {
        const deleteServerDiceStats = 'DELETE FROM user_dice_stats WHERE server_id = $1;';
        const deleteServerOverallStats = 'DELETE FROM user_overall_stats WHERE server_id = $1;';

        await Promise.all([
            this.query(deleteServerDiceStats, [serverId]),
            this.query(deleteServerOverallStats, [serverId])
        ]);
    }

    async isServerInitialized(serverId) {
        const checkStats = 'SELECT COUNT(*) as count FROM user_overall_stats WHERE server_id = $1;';
        const result = await this.query(checkStats, [serverId]);
        return result.rows[0].count > 0;
    }
}

module.exports = new DBController();