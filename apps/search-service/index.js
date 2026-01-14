const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const { createClient } = require('redis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3002;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/airline_db';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// --- Database Setup ---
const sequelize = new Sequelize(DATABASE_URL, { logging: false });
const Flight = sequelize.define('Flight', {
    code: { type: DataTypes.STRING, allowNull: false },
    from: { type: DataTypes.STRING, allowNull: false },
    to: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    capacity: { type: DataTypes.INTEGER, allowNull: false }
});

// --- Redis Setup ---
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.log('Redis Client Error', err));

// --- Routes (Version v1) ---
app.get('/v1/search/flights', async (req, res) => {
    const { from, to, date } = req.query;

    if (!from || !to) {
        return res.status(400).json({ error: "Please provide 'from' and 'to' parameters" });
    }

    const cacheKey = `search:v1:${from}:${to}:${date || 'any'}`; // Updated cache key for versioning

    try {
        // 1. Check Cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            console.log("Cache Hit");
            return res.json(JSON.parse(cachedData));
        }

        console.log("Cache Miss");
        // 2. Query DB
        const whereClause = { from, to };
        if (date) {
            whereClause.date = date;
        }

        const flights = await Flight.findAll({
            where: whereClause
        });

        // 3. Set Cache (Expire in 60s)
        await redisClient.set(cacheKey, JSON.stringify(flights), { EX: 60 });

        res.json(flights);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- Start Server ---
(async () => {
    await redisClient.connect();
    console.log("Connected to Redis");
    await sequelize.sync();
    app.listen(PORT, () => {
        console.log(`Search Service running on port ${PORT}`);
    });
})();
