const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
  "username": String,
  "password": String,
  "type": {type: String,
           default: 'user'
            },
  "todos": [
    {
      "name": String,
      "done": {
        type: Boolean,
        default: false
      }
    }
  ]
});

const usersModel = mongoose.model('w1users', usersSchema);
module.exports = usersModel;