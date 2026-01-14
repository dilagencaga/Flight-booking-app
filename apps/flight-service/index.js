const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const amqp = require('amqplib');
const cors = require('cors');
const cron = require('node-cron');
global.fetch = require('node-fetch'); // Polyfill for Amazon Cognito
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
require('dotenv').config();

const poolData = {
    UserPoolId: 'eu-north-1_bx2oUakJx',
    ClientId: '7bqmgn6dtmbfc5po38oml1ujol'
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/airline_db';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// --- Database Setup ---
const sequelize = new Sequelize(DATABASE_URL, {
    logging: false
});

const Flight = sequelize.define('Flight', {
    code: { type: DataTypes.STRING, allowNull: false },
    from: { type: DataTypes.STRING, allowNull: false },
    to: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.STRING, allowNull: false }, // Simplistic date string
    price: { type: DataTypes.FLOAT, allowNull: false },
    priceBusiness: { type: DataTypes.FLOAT, allowNull: true }, // Added Business Price
    capacity: { type: DataTypes.INTEGER, allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: true } // Duration in minutes
});

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true }, // Email
    firstName: { type: DataTypes.STRING },
    lastName: { type: DataTypes.STRING },
    dob: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },
    miles: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const Ticket = sequelize.define('Ticket', {
    flightId: { type: DataTypes.INTEGER, allowNull: false },
    username: { type: DataTypes.STRING, allowNull: false },
    processed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const MilesSmilesUser = sequelize.define('MilesSmilesUser', {
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }, // In production, hash this!
    memberId: { type: DataTypes.STRING, unique: true }
});

// --- RabbitMQ Setup ---
// ... (RabbitMQ setup remains the same)

// --- Standard Auth Routes ---

// --- Standard Auth Routes ---

app.post('/v1/auth/register', async (req, res) => {
    console.log("[DEBUG] Register Request:", req.body);
    try {
        const { firstName, lastName, dob, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const attributeList = [];
        attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: "email", Value: email }));
        // attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: "custom:firstName", Value: firstName }));

        // Fix for "Username cannot be of email format" error:
        // Use a safe username, but let them login with email via alias.
        const cognitoUsername = "user_" + Date.now();

        console.log("[DEBUG] Calling userPool.signUp with username:", cognitoUsername);
        userPool.signUp(cognitoUsername, password, attributeList, null, async (err, result) => {
            if (err) {
                console.error("[ERROR] Cognito SignUp Callback Error:", err);
                return res.status(500).json({ error: err.message || JSON.stringify(err) });
            }

            console.log("[DEBUG] Cognito SignUp Success:", result);

            // Success in Cognito -> Create Local DB Record
            try {
                const user = await User.create({
                    username: email,
                    firstName,
                    lastName,
                    dob,
                    password: 'COGNITO_AUTH_USER', // Password check delegated to AWS
                    miles: 0
                });

                // Publish Welcome Event
                if (channel) {
                    const event = {
                        type: 'USER_REGISTERED',
                        data: {
                            username: user.username,
                            firstName: user.firstName,
                            lastName: user.lastName
                        }
                    };
                    channel.sendToQueue('ticket_notifications', Buffer.from(JSON.stringify(event)));
                }

                res.status(201).json({ message: "Registration successful via AWS Cognito", user });
            } catch (dbError) {
                console.error("[ERROR] DB Create Error:", dbError);
                if (dbError.name === 'SequelizeUniqueConstraintError') {
                    // Try to recover if user exists in DB but just signed up in Cognito?
                    return res.status(409).json({ error: "Email already exists in local DB" });
                }
                res.status(500).json({ error: "Cognito OK, but DB Failed: " + dbError.message });
            }
        });
    } catch (e) {
        console.error("[ERROR] Top-level Register Exception:", e);
        res.status(500).json({ error: "Internal Server Error: " + e.message });
    }
});

app.post('/v1/auth/login', async (req, res) => {
    console.log("[DEBUG] Login Request:", req.body);
    const { email, password } = req.body;

    try {
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: email,
            Password: password,
        });

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: email,
            Pool: userPool,
        });

        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: async function (result) {
                console.log("[DEBUG] Cognito Login Success");

                // Get User Attributes to find the Email (which is the key in our DB)
                cognitoUser.getUserAttributes(async function (err, attributes) {
                    if (err) {
                        console.error("[ERROR] Failed to get user attributes:", err);
                        return res.status(500).json({ error: "Failed to fetch user attributes" });
                    }

                    const emailAttr = attributes.find(attr => attr.getName() === 'email');
                    const dbLookupValue = emailAttr ? emailAttr.getValue() : email;

                    console.log("[DEBUG] DB Lookup via:", dbLookupValue);

                    try {
                        // Find user in local DB to return profile data
                        const user = await User.findOne({ where: { username: dbLookupValue } });

                        if (!user) {
                            console.log("[DEBUG] User valid in Cognito but missing in DB");
                            return res.status(404).json({ error: "User valid in AWS, but profile missing in local DB." });
                        }

                        res.json({
                            id: user.id,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.username,
                            miles: user.miles,
                            token: result.getAccessToken().getJwtToken()
                        });
                    } catch (err) {
                        console.error("[ERROR] DB Lookup in Login:", err);
                        res.status(500).json({ error: err.message });
                    }
                });
            },
            onFailure: function (err) {
                console.error("[ERROR] Cognito Login Fail:", err);
                res.status(401).json({ error: "AWS Identity: " + (err.message || JSON.stringify(err)) });
            },
            newPasswordRequired: function (userAttributes, requiredAttributes) {
                console.log("[DEBUG] New Password Required");
                // Handle new password challenge if created by admin
                res.status(401).json({ error: "New Password Required (ForceChangePassword)" });
            }
        });
    } catch (e) {
        console.error("[ERROR] Top-level Login Exception:", e);
        res.status(500).json({ error: "Internal Server Error: " + e.message });
    }
});

// --- RabbitMQ Setup ---
let channel;
async function connectQueue() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('ticket_notifications');
        await channel.assertQueue('miles_notifications'); // New queue for miles
        console.log("Connected to RabbitMQ user");
    } catch (error) {
        console.log("Error connecting to RabbitMQ", error);
        // Retry logic could go here
        setTimeout(connectQueue, 5000);
    }
}

// --- Routes ---

// Admin: Add Flight
app.post('/flights/add', async (req, res) => {
    try {
        const flight = await Flight.create(req.body);
        res.status(201).json(flight);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Delete Flight
app.delete('/flights/delete', async (req, res) => {
    const { id } = req.body;
    try {
        if (!id) {
            return res.status(400).json({ error: "Flight ID is required" });
        }
        const result = await Flight.destroy({ where: { id } });
        if (result === 0) {
            return res.status(404).json({ error: "Flight not found" });
        }
        res.json({ message: "Flight deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Add Miles
app.post('/miles/add', async (req, res) => {
    const { username, amount } = req.body;
    try {
        const [user, created] = await User.findOrCreate({
            where: { username },
            defaults: { miles: 0 }
        });

        user.miles += parseInt(amount);
        await user.save();

        res.json({ message: "Miles added successfully", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User: Get Miles
app.get('/miles/:username', async (req, res) => {
    try {
        const user = await User.findOne({ where: { username: req.params.username } });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ username: user.username, miles: user.miles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User: Get Miles History (RECONCILED)
app.get('/miles/history/:username', async (req, res) => {
    try {
        // 1. Get User for total miles
        const user = await User.findOne({ where: { username: req.params.username } });

        // 2. Get Tickets for flight history
        const tickets = await Ticket.findAll({
            where: { username: req.params.username }
        });

        const history = [];
        let totalFlightEarnings = 0;

        for (const ticket of tickets) {
            const flight = await Flight.findByPk(ticket.flightId);
            if (flight) {
                const earned = Math.floor(flight.price * 0.1);
                history.push({
                    id: ticket.id,
                    flightCode: flight.code,
                    from: flight.from,
                    to: flight.to,
                    date: flight.date,
                    earned: earned,
                    processed: ticket.processed,
                    type: 'FLIGHT'
                });

                if (ticket.processed) {
                    totalFlightEarnings += earned;
                }
            }
        }

        // 3. Add Reconciliation Row
        if (user) {
            const discrepancy = user.miles - totalFlightEarnings;
            if (discrepancy !== 0) {
                history.push({
                    id: 999999,
                    flightCode: discrepancy > 0 ? 'BONUS/OTHER' : 'REDEMPTION',
                    from: 'System',
                    to: discrepancy > 0 ? 'Credit' : 'Debit',
                    date: new Date().toISOString().split('T')[0],
                    earned: discrepancy,
                    processed: true,
                    type: 'ADJUSTMENT'
                });
            }
        }

        history.sort((a, b) => b.id - a.id);

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public: List Flights
app.get('/flights', async (req, res) => {
    const flights = await Flight.findAll();
    res.json(flights);
});

// Admin: List All Added Flights
app.get('/flights/admin', async (req, res) => {
    const flights = await Flight.findAll();
    res.json(flights);
});

// User: Buy Ticket
app.post('/flights/buy', async (req, res) => {
    const { flightId, passengerName, email, paymentMethod } = req.body; // paymentMethod: 'card' | 'miles'

    try {
        const flight = await Flight.findByPk(flightId);
        if (!flight) return res.status(404).json({ error: "Flight not found" });

        if (flight.capacity <= 0) return res.status(400).json({ error: "Flight full" });

        let milesDeducted = 0;

        // Payment Logic
        if (paymentMethod === 'miles') {
            const milesCost = Math.floor(flight.price / 10); // 1 USD = 0.1 Mile (Adjusted for decimal format)
            console.log(`[DEBUG] Buying flight ${flight.code}. Price: ${flight.price}, Miles Cost: ${milesCost}`);
            const user = await User.findOne({ where: { username: email } }); // Link by EMAIL

            if (!user) {
                return res.status(400).json({ error: "User profile (email) required for Miles payment" });
            }

            if (user.miles < milesCost) {
                return res.status(400).json({ error: `Insufficient miles. Access: ${user.miles}, Required: ${milesCost}` });
            }

            user.miles -= milesCost;
            await user.save();
            milesDeducted = milesCost;
        }

        // Decrement capacity
        flight.capacity -= 1;
        await flight.save();

        // Save Ticket
        // CRITICAL: Linking Ticket to EMAIL so Cron Job sends miles to the correct registered user account
        await Ticket.create({
            flightId: flight.id,
            username: email // Storing Email as username to link to User model
        });

        // Ensure user exists (if not miles payment) -> Create "User" for this email if not exists
        if (paymentMethod !== 'miles') {
            await User.findOrCreate({
                where: { username: email },
                defaults: { miles: 0 }
            });
        }

        // Publish event
        if (channel) {
            const event = {
                type: 'TICKET_SOLD',
                data: {
                    flightCode: flight.code,
                    passengerName,
                    email,
                    date: new Date().toISOString(),
                    paidWithMiles: paymentMethod === 'miles',
                    milesCost: milesDeducted
                }
            };
            channel.sendToQueue('ticket_notifications', Buffer.from(JSON.stringify(event)));
        }

        res.json({ message: "Ticket purchased successfully", flight, milesDeducted });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Cron Job (Nightly Process) ---
// Running every minute for demonstration/testing purposes: '0 0 * * *' would be nightly
cron.schedule('* * * * *', async () => {
    console.log("Running Nightly Miles Processing...");
    try {
        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
        const tickets = await Ticket.findAll({
            where: {
                processed: false,
                createdAt: {
                    [Sequelize.Op.lt]: threeMinutesAgo
                }
            }
        });
        console.log(`[Cron] Found ${tickets.length} tickets older than 3 minutes to process.`);

        for (const ticket of tickets) {
            console.log(`[Cron] Processing ticket for user: ${ticket.username}, flightId: ${ticket.flightId}`);

            const flight = await Flight.findByPk(ticket.flightId);
            if (flight) {
                // Award 10% of price as miles
                const milesEarned = Math.floor(flight.price * 0.1);

                const user = await User.findOne({ where: { username: ticket.username } });
                if (user) {
                    user.miles += milesEarned;
                    await user.save();
                    console.log(`[Cron] Awarded ${milesEarned} miles to ${user.username}`);

                    // Publish MILES_ADDED event
                    if (channel) {
                        const event = {
                            type: 'MILES_ADDED',
                            data: {
                                username: user.username,
                                milesEarned,
                                totalMiles: user.miles,
                                flightCode: flight.code
                            }
                        };
                        channel.sendToQueue('miles_notifications', Buffer.from(JSON.stringify(event)));
                        console.log(`[Cron] Published MILES_ADDED event for ${user.username}`);
                    } else {
                        console.log("[Cron] Error: RabbitMQ channel not available");
                    }
                } else {
                    console.log(`[Cron] User ${ticket.username} not found!`);
                }
            } else {
                console.log(`[Cron] Flight ${ticket.flightId} not found!`);
            }
            ticket.processed = true;
            await ticket.save();
        }
    } catch (error) {
        console.error("Error in cron job:", error);
    }
});

// --- Miles&Smiles Routes ---

// Register Member
app.post('/miles-smiles/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;
    try {
        // Generate a random 9-digit member ID
        const memberId = 'TK' + Math.floor(100000000 + Math.random() * 900000000).toString();

        const user = await MilesSmilesUser.create({
            firstName,
            lastName,
            email,
            password,
            memberId
        });

        // Ensure generic User exists too for login/miles tracking unification if desired, 
        // but requirements distinguish them. 
        // We will just send Notification.

        if (channel) {
            const event = {
                type: 'USER_REGISTERED',
                data: {
                    username: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName
                }
            };
            channel.sendToQueue('ticket_notifications', Buffer.from(JSON.stringify(event)));
        }

        res.status(201).json({ message: "Member registered successfully", memberId: user.memberId });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: "Bu email ile zaten bir hesap mevcut." });
        }
        res.status(500).json({ error: error.message });
    }
});

// Login Member
// Login Member - Unified
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`[DEBUG] Unified Login attempt for: ${email}`);
    try {
        // 1. Check Standard User
        const stdUser = await User.findOne({ where: { username: email } });
        if (stdUser && stdUser.password === password) {
            console.log(`[DEBUG] Login successful (Standard) for: ${email}`);
            return res.json({
                type: 'STANDARD',
                id: stdUser.id,
                firstName: stdUser.firstName,
                lastName: stdUser.lastName,
                email: stdUser.username,
                miles: stdUser.miles // Usually 0 or non-redeemable
            });
        }

        // 2. Check Miles&Smiles User
        const milesUser = await MilesSmilesUser.findOne({
            where: {
                [Sequelize.Op.or]: [
                    { email: email },
                    { memberId: email }
                ]
            }
        });

        if (milesUser && milesUser.password === password) {
            console.log(`[DEBUG] Login successful (Miles) for: ${email}`);
            return res.json({
                type: 'MILES',
                id: milesUser.id,
                firstName: milesUser.firstName,
                lastName: milesUser.lastName,
                email: milesUser.email,
                memberId: milesUser.memberId,
                miles: milesUser.miles,
                status: milesUser.status
            });
        }

        // 3. Failed
        console.log(`[DEBUG] Login failed for: ${email} (Not found or invalid password in both DBs)`);
        res.status(401).json({ error: "Invalid credentials" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Members
app.get('/miles-smiles/members', async (req, res) => {
    try {
        const members = await MilesSmilesUser.findAll();
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete All Members (Standard + Miles)
app.delete('/miles-smiles/members/all', async (req, res) => {
    try {
        await MilesSmilesUser.destroy({ where: {}, truncate: true });
        await User.destroy({ where: {}, truncate: true });
        // Wipe Tickets too so new users don't inherit old history
        await Ticket.destroy({ where: {}, truncate: true });

        res.json({ message: "All Standard and Miles&Smiles members deleted successfully." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Member by ID
app.delete('/miles-smiles/members/:id', async (req, res) => {
    try {
        const result = await MilesSmilesUser.destroy({ where: { id: req.params.id } });
        if (result === 0) return res.status(404).json({ error: "Member not found" });
        res.json({ message: "Member deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Start Server ---
sequelize.sync({ alter: true }).then(() => {
    console.log("Database synced");
    app.listen(PORT, () => {
        console.log(`Flight Service running on port ${PORT}`);
        connectQueue();
    });
});
