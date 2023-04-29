const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const qr = require("qrcode");
const session = require('express-session')
const axios = require('axios');
var qs = require('querystring');
const cookieParser = require('cookie-parser')
const exphbs = require('express-handlebars')
const helpers = require('handlebars-helpers')
var nodemailer = require('nodemailer')


// setting global attributes
global.connectionId = null;
global.credDef = null;
global.credStatus = null;
global.proofStatus = null;
global.retrievedAttribute = null;

const service_endpoint = "https://7fbd-103-103-98-37.ngrok-free.app"

// connecting to mongodb where the database name is ssi-cafe
mongoose.connect('mongodb://127.0.0.1:27017/ssi-cafe', {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useCreateIndex: true
})



// initiating the express js
const app = express()

// setting session for express
const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
    secret: "this_is_your_random_secrcte_key_fhrgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false 
}))

// setting up the server side render engine  
app.set("view engine", "ejs");

// setting up various parsers
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());



// Simple routing to the index.ejs file
app.get("/", (req, res) => {
    res.render("index");
})

/*************************************************************
 *  ALL OF YOUR API SHOULD BE WRITTEN BELOW THIS LINE
*************************************************************/
// receive webhook events upon state changes
app.post("/webhooks/*", (req, res) => {
	const conID = req.body['connection_id']
	const conStatus = req.body['rfc23_state']
	if(conID){
		if(conStatus === "completed"){
			console.log('ENTERED 1')
			connectionId= conID
		}
		if(req.body['state'] === 'credential_acked'){
			console.log('ENTERED 2')
			console.log("Credential acked...")
			credStatus = true
		}
		if(req.body['verified'] === 'true'){
			console.log('ENTERED 3')
			var base64data = JSON.stringify(req.body['presentation_request_dict']['request_presentations~attach'][0]['data']['base64'])
			const decodedString = Buffer.from(base64data, "base64");
			const jsonData = JSON.parse(decodedString.toString());
			proofStatus = true
			retrievedAttribute = jsonData['requested_attributes']['0_role']['value']
		}
	}
	res.writeHead(200, {'Content-Type': 'text/plain'});
  	res.end('Event Receied\n');
})

app.get('/newConData', (req, res) => {
	res.render("invitationData")
})

// check create new connection invitation
app.post('/newCon', async function(req,res) {
	const memoName = req.body.memoNameData
	const email = req.body.emailData
	const bodyData = {
		"my_label": memoName,
	};
	// create the invitation data
	axios.post('http://127.0.0.1:8021/connections/create-invitation?alias='+memoName, bodyData)
		.then((resp) => {
			if (resp) {
				console.log({resp})
				const connId = resp.data['connection_id']
				// try {
				// 	// storing data for two factor auth access
				// 	const response = twoFactor.create({
				// 		email,
				// 		memoName,
				// 		connId
				// 	})
				// } catch (error) {
				// 	if (error.code === 11000) {
				// 		// duplicate key
				// 		return res.json({ status: 'error', error: 'provided data already in use' })
				// 	}
				// 	throw error
				// }
				// parsing data into QR
				const inviteURL = JSON.stringify(resp.data['invitation_url'], null, 4);
				qr.toDataURL(inviteURL, (err, src) => {
					// passing the data to invitation.ejs page to show QR Code
					res.render("invitationQr", { src, connId });
				});
			}
		}).catch((err) => {
			console.error(err);
		});
});

// check if the memoName already exist or not.
app.post('/checkMemName', function(req,res) {
	// Your code here
	
	const { memoName } = req.body
	console.log(memoName)
	// fetching the current connection
	axios.get('http://127.0.0.1:8021/connections')
		.then((resp) => {
			let flag = false;
			let conID;
			resp.data['results'].forEach((element) => {
				if(element.hasOwnProperty('alias')){
					const alias = element['alias']
					if(alias === memoName) {
						flag = true;
						conID = element["connection_id"];
						console.log("Matching found....");
					}
				}
			})
			if(flag){
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ status: false }));
			} else {
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ status: true }));
			}
		}).catch((err) => {
			console.error(err);
		});
  });


/*************************************************************
 *  ALL OF YOUR API SHOULD BE ABOVE BELOW THIS LINE
*************************************************************/
app.listen(9999, () => {
	console.log('Server up at 9999')
})