const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const http = require('http'); // Added for Render health check
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const TICKET_QUEUE = 'ticket_notifications';
const MILES_QUEUE = 'miles_notifications';

// Gmail Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

async function sendEmail(to, subject, text) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        console.log(`[Mock Email] To: ${to}, Subject: ${subject}, Body: ${text}`);
        return;
    }

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject,
            text
        });
        console.log(`[Email Sent] To: ${to}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

async function startConsumer() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        await channel.assertQueue(TICKET_QUEUE);
        await channel.assertQueue(MILES_QUEUE);

        console.log(`Waiting for messages in ${TICKET_QUEUE} and ${MILES_QUEUE}...`);

        // Ticket Notifications
        channel.consume(TICKET_QUEUE, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                console.log(`[Notification] Received Event: ${content.type}`);

                if (content.type === 'TICKET_SOLD') {
                    const { email, flightCode, passengerName, paidWithMiles, milesCost } = content.data;
                    const subject = `Flight Confirmation: ${flightCode}`;
                    let text = `Dear ${passengerName},\n\nYour ticket for flight ${flightCode} has been successfully purchased.\n\nThank you for flying with us!`;

                    if (paidWithMiles) {
                        text += `\n\nPayment Method: Miles&Smiles Points\nMiles Deducted: ${milesCost}`;
                    }

                    sendEmail(email, subject, text);
                } else if (content.type === 'USER_REGISTERED') {
                    const { username, firstName, lastName } = content.data;
                    // Assuming username is email
                    const subject = "Welcome to SkyHigh Airlines!";
                    const text = `Dear ${firstName} ${lastName},\n\nWelcome to SkyHigh Airlines! We are thrilled to have you with us.\n\nStart booking your flights today and earn miles for every journey.\n\nSafe travels,\nThe SkyHigh Team`;

                    if (username.includes('@')) {
                        sendEmail(username, subject, text);
                    } else {
                        console.log(`[Warning] Username ${username} is not an email. Welcome email skipped.`);
                    }
                }

                channel.ack(msg);
            }
        });

        // Miles Notifications
        channel.consume(MILES_QUEUE, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                console.log(`[Notification] Received Event: ${content.type}`);

                if (content.type === 'MILES_ADDED') {
                    const { username, milesEarned, totalMiles, flightCode } = content.data;
                    // Assuming username is email for simplicity, or we would need a lookup. 
                    // For this assignment, let's assume username IS an email or we send to a default/mock one if it's not.
                    // If username is not an email, we'd fall back to a mock log or need the email in the event payload.
                    // Updated flight-service to pass email if possible, but for now let's try to send to username if it looks like an email.

                    const email = username.includes('@') ? username : 'mock@example.com';

                    const subject = `Miles Earned!`;
                    const text = `Congratulations ${username}!\n\nYou have earned ${milesEarned} Miles&Smiles points from your flight ${flightCode}.\nTotal Balance: ${totalMiles} Miles.\n\nKeep flying!`;

                    if (username.includes('@')) {
                        sendEmail(email, subject, text);
                    } else {
                        console.log(`[Warning] Username ${username} is not an email. Mock sent.`);
                    }
                }

                channel.ack(msg);
            }
        });

    } catch (error) {
        console.log("Error connecting to RabbitMQ, retrying...", error);
        setTimeout(startConsumer, 5000);
    }
}

startConsumer();

// Dummy HTTP Server for Render
const PORT = process.env.PORT || 3003;
const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Notification Service is Running\n');
});

server.listen(PORT, () => {
    console.log(`Dummy HTTP server running on port ${PORT}`);
});
