const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// ======== MODELS ==========
// Connect to mongodb
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true})
.then(() => { console.log("[INFO] Connected to MongoDB.") })
.catch((err) => { console.log("[ERR] ", err) });

// Create schema
const userSchema = new mongoose.Schema({
  username : { type: String, required: true, unique: true }
});
const exerciseSchema = new mongoose.Schema({
  // userId will store _id of User this belong to
  userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description : String,
  duration : Number,
  date : Date
})

let User = mongoose.model("User", userSchema);
let Exercise = mongoose.model("Exercise", exerciseSchema);

// Add middleware delete exercise if user is deleted
userSchema.pre('remove', async function (next) {
  try {
    await Exercise.deleteMany({ userId: this._id });
    next();
  } catch (err) {
    next(err);
  }
});
// ========= END MODELS =========

// Config
app.use(require("body-parser").urlencoded( {extended : false} ));

// ========= ROUTERS =========
app.route("/api/users")
.get(async function(req, res) {
  
  try {
    let users = await User.find({}, 'username _id');
    res.json(users);
  } catch (err) {
    res.json({ error: 'Server error'});
  }
}).post(async function(req, res) {

  const username = req.body.username;
  if (!username) {
    return res.json({ error: 'username is required' });
  }

  try {
    // check duplicate
    let user = await User.findOne({ username });
    if (user) {
      return res.json({ username: user.username, _id: user._id });
    }

    user = await User.create({ username });
    console.log(user);
    res.json({ username: user.username, _id: user._id });
  } catch (err) {
    console.log("[ERR] ", err);
    res.json({ error: 'Server error'});
  }
});

app.route("/api/users/:_id/exercises")
.post(async function(req, res) {
  const userId = req.params._id;
  const { description, duration } = req.body;
  let date = req.body.date;

  try {
    // Get date if date is not in req.body
    if (!date)
      date = new Date();
    else
      date = new Date(date);

    // Find user
    const user = await User.findById(userId);
    if (!user)
      return res.json({ error: "User not found" });

    // Create new exercise
    const newExercise = await Exercise.create({
      userId: user._id,
      description: description,
      duration: parseInt(duration),
      date: date
    });

    // Response with user object and exercise fields added
    res.json({
      _id: userId,
      username: user.username,
      description: newExercise.description,
      duration: newExercise.duration,
      date: newExercise.date.toDateString()
    });
  } catch (err) {
    console.log("[ERR] ", err);
    res.json({ error: "Server error" });
  }
});

app.route("/api/users/:_id/logs")
.get(async function (req, res) {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: "User not found" });
    }

    // Get log
    const filter = { userId: user._id };
    if (from || to) {
      filter.date = {};
      if (from)
        filter.date.$gte = new Date(from);
      if (to)
        filter.date.$lte = new Date(to);
    }
    let query =  Exercise.find(filter);
    if (limit)
      query = query.limit(parseInt(limit));

    const exercises = await query.exec();
    const log = exercises.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }));

    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log
    })
  } catch (err) {
    res.json({ error: "Server error" });
  }
});
// ========= END ROUTERS ==========


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
