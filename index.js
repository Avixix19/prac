import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import {createServer} from "http";


const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "logos",
  password: "1234",
  port: 5432,
});

db.connect();

let logoarray = [];
let currentQuestion = {};
let totalcorrect = 0;
let lives = 3;

db.query("SELECT * FROM logo", (err, res) => {
  if (err) {
    console.error("Execution error", err.stack);
  } else {
    logoarray = res.rows;
  }
});

function getRandomQuestion() {
  const que = logoarray[Math.floor(Math.random() * logoarray.length)];
  currentQuestion = que;
}

app.get("/", (req, res) => {
  totalcorrect = 0;
  lives = 3;
  getRandomQuestion();
  res.render("index.ejs", {
    question: currentQuestion,
    totalScore: totalcorrect,
    lives: lives,
    gameOver: false,
  });
});

app.post("/submit", (req, res) => {
  const answer = req.body.answer.trim().toLowerCase();
  const correct = currentQuestion.name.toLowerCase();

  if (answer === correct) {
    totalcorrect++;
  } else {
    lives--;
  }

  if (lives <= 0) {
    res.render("index.ejs", {
      question: null,
      totalScore: totalcorrect,
      lives: 0,
      gameOver: true,
    });
  } else {
    getRandomQuestion();
    res.render("index.ejs", {
      question: currentQuestion,
      totalScore: totalcorrect,
      lives: lives,
      gameOver: false,
    });
  }
});

app.post("/restart", (req, res) => {
  totalcorrect = 0;
  lives = 3;
  getRandomQuestion();
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
