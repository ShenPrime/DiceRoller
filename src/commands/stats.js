module.exports = {
    name: 'stats',
    description: 'View your dice rolling statistics',
    type: 1,
    options: [
        {
            name: 'user',
            description: 'User to check stats for (defaults to yourself)',
            type: 6,
            required: false
        }
    ]
};