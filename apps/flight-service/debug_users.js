const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/airline_db';

const sequelize = new Sequelize(DATABASE_URL, {
    logging: false
});

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true }, // Email
    password: { type: DataTypes.STRING },
    miles: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const MilesSmilesUser = sequelize.define('MilesSmilesUser', {
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    memberId: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING }
});

async function listUsers() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const stdUsers = await User.findAll();
        console.log("\n--- STANDARD USERS ---");
        stdUsers.forEach(u => {
            console.log(`ID: ${u.id}, Email: ${u.username}, Password: ${u.password}, Miles: ${u.miles}`);
        });

        const milesUsers = await MilesSmilesUser.findAll();
        console.log("\n--- MILES&SMILES USERS ---");
        milesUsers.forEach(u => {
            console.log(`ID: ${u.id}, Email: ${u.email}, MemberID: ${u.memberId}, Password: ${u.password}`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await sequelize.close();
    }
}

listUsers();
