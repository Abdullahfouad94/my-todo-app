const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(toEmail, username, otp) {
    const mailOptions = {
        from: `"My To-Do App" <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject: "Verify Your Email - My To-Do App",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4a90d9;">Email Verification</h2>
                <p>Hello <strong>${username}</strong>,</p>
                <p>Your verification code is:</p>
                <div style="background: #f0f2f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
                </div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = { generateOTP, sendOTPEmail };
