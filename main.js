const Discord = require("discord.js");
const config= require("./config.json");
const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const { access } = require("fs");
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildInvites
    ]
})

client.login(config.token);

app.use(express.json());
app.use(cors());

const clientPG = require("./database.js").clientPG;

client.on("ready",async()=>{

    console.log("Bot ready to work !");
    const embed = new Discord.EmbedBuilder()
    .setTitle("Appuyez sur le bouton en dessous de ce message afin d'accéder à un essai de trois jours dans le serveur premium")
    .setDescription("Cet essai exclusif n'est pas renouvelable.")
    .setColor("Yellow")

    const button = new Discord.ButtonBuilder()
    .setURL("https://discord.com/api/oauth2/authorize?response_type=code&client_id=1105916122924073001&redirect_uri=http%3A%2F%2F95.179.242.225%3A3000%2Fdiscord&scope=guilds.join%20identify%20guilds")
    .setLabel("Rejoindre")
    .setStyle(Discord.ButtonStyle.Link);

    const row = new Discord.ActionRowBuilder()
    .addComponents([button]);

    const channel = client.guilds.cache.get(config.guilID).channels.cache.get(config.channelID);
    await channel.messages.fetch();

    await client.guilds.cache.get(config.guilID).channels.cache.get(config.channelID).lastMessage?.delete();

    channel.send({embeds:[embed], components: [row]});

    const interval = setInterval(async()=>{
        const joinedData = (await clientPG.query('select * from free_join')).rows;
        joinedData.forEach(async(data)=>{
            const joinedTime = data.timestamp;
            const now = Date.now();

            const diff = now- joinedTime;
            console.log(diff);

            if(diff > 30000){
                await client.guilds.cache.get(config.guildPremiumID).members.fetch();
                const member = client.guilds.cache.get(config.guildPremiumID).members.cache.get(data.user_id);
                if(member?.roles?.cache?.has(config.joiningRoleID)){
                    member?.kick();
                    await clientPG.query('delete from free_join where user_id = $1',[data.user_id]);
                }else{
                    await clientPG.query('delete from free_join where user_id = $1',[data.user_id]);
                }
                
            }
        })
    },20000);    
})

app.listen(3000, ()=>{
    console.log("listening requests on port 3000")
})

app.get("/discord",async(req, res)=>{
    console.log("received a request !");
    const code = req.query.code;

    console.log(`Code : ${code}`);

    const body = new URLSearchParams();

    body.append('client_id', config.clientID);
    body.append('client_secret', config.secret);
    body.append('grant_type', 'authorization_code');
    body.append('code', code)
    body.append('redirect_uri', 'http://95.179.242.225:3000/discord');

    const data = await(await fetch("https://discord.com/api/v9/oauth2/token",{
        body : body,
        method: "POST",
        headers:{
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })).json();

    const token = data.access_token;

    console.log(`Token : ${token}`);
    const dataUser = await(await fetch("https://discord.com/api/v9/users/@me", {
        method: 'GET',
        headers: {'Authorization': `Bearer ${token}`}
    })).json();

    console.log(dataUser);

    

    const userId = dataUser.id;
    const dataJoined = (await clientPG.query('select from joined where user_id = $1',[userId])).rows;

    if(dataJoined.length > 0){
        res.sendFile(path.join(__dirname,"already-tried.html"));
        return;
    }
    await client.guilds.cache.get(config.guildPremiumID).members.fetch();
    if(client.guilds.cache.get(config.guildPremiumID).members.cache.has(userId)){
        res.sendFile(path.join(__dirname, "/already-joined.html"));
        return;
    }
    await clientPG.query('insert into access_tokens values($1,$2)',[userId, token]);
    await clientPG.query('insert into free_join values($1,$2)',[userId,Date.now()]);
    await clientPG.query('insert into joined values($1)',[userId]);
    
    console.log((await fetch(`https://discord.com/api/v9/guilds/${config.guildPremiumID}/members/${userId}`,{
        "method": 'PUT',
        "headers":{
            "Content-Type": "application/json",
            'Authorization' : `Bot ${config.token}`
        },
        "body": JSON.stringify({
            "access_token" : token,
            "roles": [config.joiningRoleID]
        })
    })));

    

    res.sendFile(path.join(__dirname, "/success.html"));

     
})
