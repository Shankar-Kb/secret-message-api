const express = require('express');
const mongodb = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const Mail = require('nodemailer/lib/mailer');

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const DB_URL = process.env.DB_URL || "mongodb://127.0.0.1:27017";
const port = process.env.PORT || 3001;
const saltRounds = 10;

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    }
})

const mailData = {
    from: process.env.EMAIL,
    subject: "S*CR*T M*SSAG*"
}

const mailMessage = (url, pass) => {
    return (
        `<p>Hi this is Raavan from gaming World,<br />
            you have a SECRET MESSAGE waiting for only you to open. <br />
            <a href='${url}' target='_blank'>${url}</a><br />
            Here is your pass to view the message - ${pass}
            Don't Tell It To Anyone...
         </p>`
    );
}


app.post('/create-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL, {useUnifiedTopology: true});
        const db = client.db('secretMessageDatabase');
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(req.body.password, salt);
        const data = {
            key: req.body.randomKey,
            password: hash,
            message: req.body.message,
            messagePass: req.body.messagePass,
            //createdAt: new Date(),
            //expiresIn: req.body.expiresIn
        }
        await db.collection('secretMessage').insertOne(data);
        //db.collection('secretMessage').createIndex( { "createdAt": 1 }, { expireAfterSeconds: data.expiresIn } );
        const result = await db.collection('secretMessage').findOne({key: data.key});
        const userMailUrl = `${req.body.targetURL}/msg?result_id=${result._id}`;
        mailData.to = req.body.targetMail;
        mailData.html = mailMessage(userMailUrl, messagePass);
        await transporter.sendMail(mailData);
        client.close();
        res.status(200).json({message: "secret message is sent. Don't forget yout secret key and password", result});
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.get('/message-by-id/:id', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL, {useUnifiedTopology: true});
        const db = client.db('secretMessageDatabase');
        const result = await db.collection('secretMessage').find({_id: objectId(req.params.id)}).project({password: 0, _id: 0, key: 0}).toArray();
        client.close();
        res.status(200).json({message: "message has been fetched successfully", result});
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.delete('/delete-message', async (req, res) => {
    try {
        const client = await mongoClient.connect(DB_URL, {useUnifiedTopology: true});
        const db = client.db('secretMessageDatabase');
        const secret = await db.collection('secretMessage').findOne({key: req.body.secretKey});
        if(secret){
            const compare = await bcrypt.compare(req.body.password, secret.password);
            if (compare){
                await db.collection('secretMessage').findOneAndDelete({key: req.body.secretKey});
                client.close();
                res.status(200).json({message: "message has been deleted successfully"});
            }else{
                client.close();
                res.status(401).json({message: "incorrect password!"});
            }
        }else{
            client.close();
            res.status(404).json({message: "Secret key not found!"});
        }
    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
})

app.listen(port, () => console.log(`::: Server is UP and running on port: ${port} :::`));