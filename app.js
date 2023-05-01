const express = require('express');
const app = express();
const session = require('express-session')
const usersModel = require('./models/w1users');
const bcrypt = require('bcrypt');
const Joi = require("joi");
const dotenv = require('dotenv')
dotenv.config();

var MongoDBStore = require('connect-mongodb-session')(session);

/* secret information section */
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */


var dbStore = new MongoDBStore({
    // uri: 'mongodb://localhost:27017/connect_mongodb_session_test',
    uri: `mongodb+srv://${process.env.ATLAS_DB_USER}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_DB_HOST}/comp2537w1?retryWrites=true&w=majority`,
    collection: 'Sessions',
    crypto: {
        secret: mongodb_session_secret
    }
});


const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour  (hours * minutes * seconds * millis)

app.use(express.urlencoded({ extended: false }))

app.use(session({
    secret: node_session_secret,
    store: dbStore,
    resave: false,
    saveUninitialized: false,
    cooke: { maxAge: expireTime}
}))

app.get('/', (req, res) => {
    html = `
    <form action="/signup" method="get">
    <input type="submit" value="Sign up"/>
    </form>
    <form action="/login" method="get">
    <input type="submit" value="Log in"/>
    </form>
    `
    if (req.session.GLOBAL_AUTHENTICATED) {
        html = `
        <h1>Hello, ${req.session.username}!</h1>
        <br>
        <form action="/Members" method="get">
        <input type="submit" value="Go to Members Area"/>
        </form>
        <form action="/logout" method="get">
        <input type="submit" value="Logout"/>
        </form>
        `
    }
    res.send(html)
})

app.get('/signup', (req, res) => {
    var html = `
    create user
    <form action='/submitUser' method='post'>
    <br>
    <input name='username' type='text' placeholder='username'>
    <br>
    <input name='email' type='text' placeholder='email'>
    <br>
    <input name='password' type='password' placeholder='password'>
    <br><br>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    var email = req.body.email;

    if (username == "" || password == "" || email == "") {
        var message = ``
        if (username == "") {
            message += `<p>Name is missing</p><br>`
            
        }
        if (email == "") {
            message += `<p>Email is missing</p><br>`
        }
        if (password == "") {
            message += '<p>Password is missing</p><br>'
        }
        message += `Name, email, and password are all required
    <form action='/signup' method='get'>
    <input type='submit' value='Try again'/>
    </form>`
        res.send(message)
        return
    }

    const username_test = Joi.string().alphanum().min(3).max(30).required();
    const username_result = username_test.validate(username);

    const password_test = Joi.string().alphanum().min(5).max(20).required()
    const password_result = password_test.validate(password)

    if (username_result.error || password_result.error) {
        console.log('Please fix your username/password')
        res.redirect("/signup");
        return;
    }

    var userPassword = await bcrypt.hash(password, 12);
    await usersModel.insertMany([{ username: username, password: userPassword }]);
    req.session.GLOBAL_AUTHENTICATED = true;
    req.session.username = username;
    req.session.password = userPassword;
    console.log("Inserted user");
    res.redirect('/members');
});



app.get('/login', (req, res) => {
    res.send(`
        <form action="/loggingin" method="post">
            log in
            <br>
            <input type="text" name="username" placeholder="Enter your username" />
            <br>
            <input type="password" name="password" placeholder="Enter your password" />
            <br>
            <input type="submit" value="Login"/>
        </form>
    `)
});

app.post('/loggingin', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(username);
    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.redirect("/login");
        return;
    }

    const result = await usersModel.findOne({ username: username })
    if (!result) {
        console.log("user not found");
        res.send(`
        User is not found
        <form action="/login" method="get">
        <input type="submit" value="Try again"/>
        </form>
    `)
        return;
    }
    if (await bcrypt.compare(password, result.password)) {
        req.session.GLOBAL_AUTHENTICATED = true;
        req.session.username = username;
        res.redirect('/Members');
        return;
    }
    else {
        console.log('wrong password')
        res.send(`
        Invalid username/password combination
        <form action="/login" method="get">
        <input type="submit" value="Try again"/>
        </form>
    `)
        return;
    }
});

app.use(express.static('public'))

app.get('/Members', (req, res) => {
    const randomImageNumber = Math.floor(Math.random() * 3) + 1;
    const imageName = `${randomImageNumber}.png`;
    HTMLResponse = `
      <h1>Hello ${req.session.username}</h1><br>
      <img src="${imageName}"/>
      <form action="/logout" method="get">
      <input type="submit" value="Sign Out"/>
      </form>
      `
    if (req.session.GLOBAL_AUTHENTICATED) {
        res.send(HTMLResponse);
    } else {
        res.redirect('/');
        return
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('*', (req, res) => {
    res.status(404).send('<h1> 404 Page not found</h1>');
});

// authenticated users only
const authenticatedOnly = (req, res, next) => {
    if (!req.session.GLOBAL_AUTHENTICATED) {
        return res.status(401).json({ error: 'not authenticated' });
    }
    next(); // allow the next route to run
};

app.use(authenticatedOnly);

module.exports = app;
