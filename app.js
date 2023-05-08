const express = require('express');
const app = express();
const session = require('express-session')
const usersModel = require('./models/w1users');
const bcrypt = require('bcrypt');
const Joi = require("joi");
const dotenv = require('dotenv');
dotenv.config();

var MongoDBStore = require('connect-mongodb-session')(session);

/* secret information section */
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
const collection_database = process.env.COLLECTION_DATABASE;
/* END secret section */

app.set('view engine', 'ejs');

var dbStore = new MongoDBStore({
    // uri: 'mongodb://localhost:27017/connect_mongodb_session_test',
    uri: `mongodb+srv://${process.env.ATLAS_DB_USER}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_DB_HOST}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority`,
    collection: collection_database,
    crypto: {
        secret: mongodb_session_secret
    }
});

app.use(express.urlencoded({ extended: false }))
const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour (hours * minutes * seconds * millis)

app.use(session({
    secret: node_session_secret,
    store: dbStore,
    resave: false,
    saveUninitialized: false,
}))

function isValidSession(req) {
    return req.session.GLOBAL_AUTHENTICATED;
}

function sessionValidation(req, res, next) {
    if (isValidSession(req)) {
        next();
    }
    else {
        res.redirect('/login');
    }
}

function isAdmin(req) {
    if (req.session.type == "admin") {
        return true;
    }
    return false;
}

function adminAuthorization(req, res, next) {
    if (!isAdmin(req)) {
        res.status(403);
        res.render("error", { error: "This page is for administrators only. You are not authorized" });
        console.log(req.session.type)
        return;
    }
    else {
        next();
    }
}

app.get('/', (req, res) => {
    res.render('home', {user: req.session.username, authenticated: req.session.GLOBAL_AUTHENTICATED});
});

app.get('/signup', (req, res) => {
    res.render('signUp')
});

app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;
    var username_message = ''
    var password_message = ''
    var email_message = ''
    if (username == "" || password == "" || email == "") {
        if (username == "") {
            username_message = 'Name is missing'
        }
        if (email == "") {
            email_message += 'Email is missing\n'
        }
        if (password == "") {
            password_message += 'Password is missing\n'
        }
        res.render('submitMissing', {username_message: username_message, email_message: email_message, password_message: password_message })
        return
    }

    const username_test = Joi.string().alphanum().min(3).max(30).required();
    const username_result = username_test.validate(username);
    const password_test = Joi.string().alphanum().min(5).max(20).required()
    const password_result = password_test.validate(password)
    if (username_result.error || password_result.error) {
        console.log('Please fix your username/password')
        res.render('submitError')
        return;
    }
    var userPassword = await bcrypt.hash(password, 12);
    await usersModel.insertMany([{ username: username, password: userPassword, type: "admin" }]);
    req.session.GLOBAL_AUTHENTICATED = true;
    req.session.username = username;
    req.session.password = userPassword;
    req.session.cookie.maxAge = expireTime;
    req.session.type = "admin";
    console.log("Inserted user");
    res.redirect('/members');
});

app.get('/login', (req, res) => {
    res.render('login.ejs')
});

app.post('/loggingin', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(username);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect('/login');
        return;
    }

    const result = await usersModel.findOne({ username: username })
    if (!result) {
        console.log("user not found");
        res.render('loginError', { message: 'User is not found' })
        return
    }
    if (await bcrypt.compare(password, result.password)) {
        req.session.GLOBAL_AUTHENTICATED = true;
        req.session.username = username;
        req.session.type = result.type;
        res.redirect('/Members');
        return;
    }
    else {
        console.log('wrong password')
        res.render('loginError', { message: 'Invalid username/password combination' })
        return
    }
});

app.get('/admin', sessionValidation, adminAuthorization, async (req, res) => {
    const result = await usersModel.find();
    res.render("admin", { users: result });
});

app.get('/toAdmin/:username/:type', sessionValidation, adminAuthorization, async (req, res) => {
    await usersModel.updateOne({ username: req.params.username }, { $set: { type: "admin" } })
    const user = await usersModel.findOne({ username: req.params.username });
    res.render('switchType', { user: user });
})

app.get('/toUser/:username/:type', sessionValidation, adminAuthorization, async (req, res) => {
    await usersModel.updateOne({ username: req.params.username }, { $set: { type: "user" } })
    const user = await usersModel.findOne({ username: req.params.username });
    res.render('switchType', { user: user });
})

app.use(express.static('public'))

app.get('/members', async (req, res) => {
    // const randomImageNumber = Math.floor(Math.random() * 3) + 1;
    // const imageName = `${randomImageNumber}.png`;
    // HTMLResponse = `
    //   <h1>Hello ${req.session.username}</h1><br>
    //   <img src="${imageName}"/>
    //   <form action="/logout" method="get">
    //   <input type="submit" value="Sign Out"/>
    //   </form>
    //   `
    console.log(req.session.type)
    if (req.session.GLOBAL_AUTHENTICATED) {
        const result = await usersModel.findOne({ username: req.session.username })
        res.render('members.ejs', {
            "x": req.session.username,
            "todos": result.todos
        })
    } else {
        res.redirect('/');
        return
    }
});

app.post('/addNewToDoItem', async (req, res) => {
    const updateResult = await usersModel.updateOne({ username: req.session.username }, { $push: { todos: { "name": req.body.theLabelOfThenNewItem } } })
    console.log(updateResult);
    res.redirect('/members');
})

app.post('/flipTodoItem', async (req, res) => {
    const result = await usersModel.findOne({ username: req.session.username })
    const newArr = result.todos.map((todoItem) => {
        if (todoItem.name == req.body.x) {
            todoItem.done = !todoItem.done
        }
        return todoItem
    })
    const updateResult = await usersModel.updateOne({ username: req.session.username }, { $set: { todos: newArr } })
    res.redirect('/members');
})

app.post('/deleteToDoItem', async (req, res) => {
    try {
        const result = await usersModel.findOne({ username: req.session.username })
        const newArr = result.todos.filter(todoItem =>
            todoItem.name != req.body.x
        )
        const updateResult = await usersModel.updateOne({ username: req.session.username }, { $set: { todos: newArr } })
        res.redirect('/members');
    }
    catch (error) {
        console.log(error);
    }
})

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/images', (req, res) => {
    var html = `<form action="http://localhost:3000/upload" method="post" enctype="multipart/form-data">
    <input type="file" name="kittenFile" />
    <input type="submit" value="Upload">
  </form>`
  res.send(html)
    
})
app.get('*', (req, res) => {
    res.status(404).render('404.ejs')
});

module.exports = app;
