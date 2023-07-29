const {Client} = require("pg");
const client = new Client({
    host:'localhost',
    database:'database',
    port:5432,
    password:'password',
    user:'user'
});

client.connect();

module.exports.clientPG = client;