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
                dice_type INTEGER NOT NULL,
                total_rolls INTEGER DEFAULT 0,
                total_crits INTEGER DEFAULT 0,
                total_value INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, dice_type)
            );
        `;

        const createOverallStatsTable = `
            CREATE TABLE IF NOT EXISTS user_overall_stats (
                user_id VARCHAR(255) PRIMARY KEY,
                total_rolls INTEGER DEFAULT 0,
                total_crits INTEGER DEFAULT 0,
                total_value INTEGER DEFAULT 0,
                total_possible_value INTEGER DEFAULT 0
            );
        `;

        await this.query(createUserStatsTable);
        await this.query(createOverallStatsTable);
    }

    async updateRollStats(userId, diceType, rollValue) {
        // Update dice-specific stats
        const updateDiceStats = `
            INSERT INTO user_dice_stats (user_id, dice_type, total_rolls, total_crits, total_value)
            VALUES ($1, $2, 1, $3, $4)
            ON CONFLICT (user_id, dice_type) DO UPDATE SET
                total_rolls = user_dice_stats.total_rolls + 1,
                total_crits = user_dice_stats.total_crits + $3,
                total_value = user_dice_stats.total_value + $4;
        `;

        // Update overall stats
        const updateOverallStats = `
            INSERT INTO user_overall_stats (user_id, total_rolls, total_crits, total_value, total_possible_value)
            VALUES ($1, 1, $2, $3, $4)
            ON CONFLICT (user_id) DO UPDATE SET
                total_rolls = user_overall_stats.total_rolls + 1,
                total_crits = user_overall_stats.total_crits + $2,
                total_value = user_overall_stats.total_value + $3,
                total_possible_value = user_overall_stats.total_possible_value + $4;
        `;

        const isCrit = rollValue === diceType;
        
        await this.query(updateDiceStats, [userId, diceType, isCrit ? 1 : 0, rollValue]);
        await this.query(updateOverallStats, [userId, isCrit ? 1 : 0, rollValue, diceType]);
    }

    async getUserStats(userId) {
        const diceStats = `
            SELECT 
                dice_type,
                total_rolls,
                total_crits,
                ROUND((total_value::float / (dice_type * total_rolls) * 100)::numeric, 2) as roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as crit_percentage
            FROM user_dice_stats
            WHERE user_id = $1
            ORDER BY dice_type;
        `;

        const overallStats = `
            SELECT 
                total_rolls,
                total_crits,
                ROUND((total_value::float / total_possible_value * 100)::numeric, 2) as overall_roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as overall_crit_percentage
            FROM user_overall_stats
            WHERE user_id = $1;
        `;

        const [diceResults, overallResults] = await Promise.all([
            this.query(diceStats, [userId]),
            this.query(overallStats, [userId])
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

    async getLeaderboard(limit = 10) {
        const overallLeaderboard = `
            SELECT 
                user_id,
                total_rolls,
                total_crits,
                ROUND((total_value::float / total_possible_value * 100)::numeric, 2) as overall_roll_percentage,
                ROUND((total_crits::float / total_rolls * 100)::numeric, 2) as overall_crit_percentage
            FROM user_overall_stats
            WHERE total_rolls > 0
            ORDER BY total_rolls DESC
            LIMIT $1;
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
            WHERE total_rolls > 0
            ORDER BY total_rolls DESC
            LIMIT $1;
        `;

        const [overallResults, diceResults] = await Promise.all([
            this.query(overallLeaderboard, [limit]),
            this.query(diceLeaderboards, [limit])
        ]);

        return {
            overallLeaderboard: overallResults.rows,
            diceLeaderboard: diceResults.rows
        };
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = new DBController();