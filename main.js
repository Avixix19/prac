import express from "express";
import { createServer } from "http";
import pg from "pg";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import session from "express-session";

const app = express();
const port = 3000;
const server = createServer(app);
const io = new Server(server);

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "logologin",
    password: "1234",
    port: 5432
});

db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(
    session({
        secret: "Huuloo",
        resave: false,
        saveUninitialized: true,
    })
);

// Handle socket connections
io.on("connection", (socket) => {
    console.log("User connected with socket ID", socket.id);
    socket.on("disconnect", () => {
        console.log("User disconnected with socket ID", socket.id);
    });
});

app.get("/", (req, res) => {
    res.render("login.ejs");
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM logindetails WHERE email = $1", [email], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("An error occurred, try again");
        }

        if (result.rows.length === 0) {
            return res.send("Wrong email or password");
        }

        const user = result.rows[0];

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error(err);
                return res.send("An error occurred.");
            }

            if (!isMatch) {
                return res.send("Invalid email or password.");
            }

            req.session.user = {
                email: user.email,
                highscore: user.highscore
            };

            res.redirect("/game");
        });
    });
});

app.get("/signup", (req, res) => {
    res.render("signup.ejs");
});

app.post("/signup", async (req, res) => {
    const { email, password, confirmpassword } = req.body;

    if (password !== confirmpassword) {
        return res.send("Passwords don't match.");
    }

    try {
        const hashpass = await bcrypt.hash(password, 10);

        db.query("INSERT INTO logindetails(email, password) VALUES($1, $2) RETURNING *", [email, hashpass], (err, result) => {
            if (err) {
                console.error(err);
                return res.send("An error occurred while signing up.");
            }
            console.log("User signed up successfully:", result.rows[0]);
            res.redirect("/");
        });
    } catch (err) {
        console.error(err);
        res.send("An error occurred while hashing.");
    }
});

let logoarray = [];
let currentQuestion = {};


const dbb = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "logos",
    password: "1234",
    port: 5432,
});

dbb.connect();

dbb.query("SELECT * FROM logo", (err, res) => {
    if (err) {
        console.error("Execution error", err.stack);
    } else {
        logoarray = res.rows;
    }
});

function getRandomQuestion() {
    currentQuestion = logoarray[Math.floor(Math.random() * logoarray.length)];
}

app.get("/game", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }

    req.session.lives = 3;  
    req.session.totalcorrect = 0;

    getRandomQuestion();

    try {
        const { rows } = await db.query("SELECT * FROM logindetails ORDER BY highscore DESC LIMIT 1");
        const topPlayer = rows.length ? rows[0] : null;

        res.render("index.ejs", {
            question: currentQuestion,
            totalScore: req.session.totalcorrect,
            lives: req.session.lives,
            gameOver: false,
            topPlayer: topPlayer
        });
    } catch (err) {
        console.error("Error fetching top player:", err);
        res.render("index.ejs", {
            question: currentQuestion,
            totalScore: req.session.totalcorrect,
            lives: req.session.lives,
            gameOver: false,
            topPlayer: null
        });
    }
});


app.post("/submit", async (req, res) => {
    console.log(req.body.answer);
    const answer = req.body.answer ? req.body.answer.trim().toLowerCase() : '';
    const correct = currentQuestion.name.toLowerCase();

    if (answer === correct) {
        req.session.totalcorrect++;
    } else {
        req.session.lives--;
    }

    let topPlayer = null;

    if (req.session.lives <= 0) {
        if (req.session.user && req.session.totalcorrect > req.session.user.highscore) {
            await db.query("UPDATE logindetails SET highscore = $1 WHERE email = $2", [req.session.totalcorrect, req.session.user.email]);
        }

        try {
            const { rows } = await db.query("SELECT * FROM logindetails ORDER BY highscore DESC LIMIT 1");
            topPlayer = rows.length ? rows[0] : null;
        } catch (err) {
            console.error("Error fetching top player:", err);
        }

        return res.render("index.ejs", {
            question: null,
            totalScore: req.session.totalcorrect,
            lives: 0,
            gameOver: true,
            topPlayer: topPlayer // Ensure topPlayer is properly passed
        });
    }

    getRandomQuestion();
    return res.render("index.ejs", {
        question: currentQuestion,
        totalScore: req.session.totalcorrect,
        lives: req.session.lives,
        gameOver: false,
        topPlayer: topPlayer
    });
});




app.post("/restart", (req, res) => {
    req.session.totalcorrect = 0;
    req.session.lives = 3;
    getRandomQuestion();
    res.redirect("/game");
});

app.listen(port, () => {
    console.log("listening...");
});