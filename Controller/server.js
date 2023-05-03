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
require('dotenv').config() 

// models
const ConnectionDataSchema = require('./model/ConnectionDataSchema')
const TwoFactorDataSchema = require('./model/TwoFactorData')


// setting global attributes
global.connectionId = null;
global.credDef = null;
global.credStatus = null;
global.proofStatus = null;
global.retrievedAttribute = null;

const service_endpoint = "https://79c9-103-103-98-35.ngrok-free.app"

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
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false 
}))

// setting up the server side render engine  
app.set("view engine", "ejs");

// setting up various parsers
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

var transport = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.emailSender,
		pass: process.env.emailSenderAppKey
	}
});

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
	console.log("AT HOOK") 
	console.log(conStatus) 
	if(conID){
		if(conStatus === "completed"){
			console.log('ENTERED 1')
			connectionId= conID
		}
		if(req.body['state'] === 'credential_acked'){
			console.log('ENTERED 2')
			console.log(req.body)
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
				const connectionID = resp.data['connection_id']
				try {
					// storing data for accessing in future
					const response = ConnectionDataSchema.create({
						email,
						memoName,
						connectionID
					})
				} catch (error) {
					if (error.code === 11000) {
						// duplicate key
						return res.json({ status: 'error', error: 'provided data already in use' })
					}
					throw error
				}
				// parsing data into QR
				const inviteURL = JSON.stringify(resp.data['invitation_url'], null, 4);
				qr.toDataURL(inviteURL, (err, src) => {
					// passing the data to invitation.ejs page to show QR Code
					res.render("invitationQr", { src, connectionID });
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
				res.end(JSON.stringify({ status: true, connection: conID }));
			} else {
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ status: false }));
			}
		}).catch((err) => {
			console.error(err);
		});
});

// rendering the connected page upon request
app.get("/connected", (req, res) => {
	res.render("connected");
});

// get the updated connection status
app.get("/status", (req, res) => {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	if (connectionId === null){
		res.end("Nothing..");
	}	
	else
	{	
		req.session.conID = connectionId
		res.end(connectionId);
	}
});

// render credential data form page
app.get('/regDataForm', (req, res) => {
	res.render("regData")
})

// send credential offer
app.post('/offerCredential', async function(req,res) {
	// if(!req.session.conID){
	// 	res.status(403).json({ message: "Please establish a connection first"})
	// }

	console.log("At Post Credential!")
	
	const name = req.body.name
	const email = req.body.email
	const address = req.body.address
	const dob = req.body.dob

	const [day, month, year] = dob.split('/');
	const date = new Date(+year, month - 1, +day);

	// fetching the credential definition
	axios.get('http://127.0.0.1:8021/credential-definitions/created')
		.then((resp) => {
			const credID = resp.data['credential_definition_ids'][0];
			console.log("Credential ID : " + credID)
			if(credID){
				req.session.credID = credID
				console.log( req.session.conID )
				const data = {
					"auto_issue": true,
					"auto_remove": true,
					"connection_id":req.session.conID,
					"cred_def_id":credID,
					"comment":"Offer on cred def id " + credID,
					"credential_preview":{
						"@type":"https://didcomm.org/issue-credential/1.0/credential-preview",
						"attributes":[
							{
								"name":"name",
								"value":name
							},
							{
								"name":"email",
								"value":email
							},
							{
								"name":"address",
								"value":address
							},
							{
								"name":"birthdate_dateint",
								"value":dob
							},
							{
								"name":"role",
								"value":"student"
							},
							{
								"name":"timestamp",
								"value": ""+Date.now()
							}
						]
					}
				};
				axios.post('http://127.0.0.1:8021/issue-credential/send-offer', data)
				res.cookie('conID', req.session.conID, { maxAge: 900000, httpOnly: true });
				res.render("loading")
			}
		}).catch((err) => {
			console.error(err);
		});
});

// check the status of issuing credential
app.get("/credStatus", (req, res) => {
	console.log("At Cred status:");
	res.writeHead(200, {'Content-Type': 'text/plain'});
	
	if (credStatus === null){
		res.end("Status unavailable");
	}
	else {
		console.log('ON ELSE')
		res.end(JSON.stringify(credStatus));
	}
});

// requesting user to proof VC
app.get('/proofReq', async function(req,res) {
	// console.log("At Proof Request!")
	// console.log("Connection ID:", req.cookies.conID) 
	// var role = ""
	// if(req.session.reqPage === "Page1"){
	// 	role = "student"
	// }
	// else if(req.session.reqPage === "Page2"){
	// 	role = "faculty"
	// }
	// search for matching credential definition
	axios.get('http://127.0.0.1:8021/credential-definitions/created')
		.then((resp) => {

			const credID = resp.data['credential_definition_ids'][0];

			if(req.cookies.conID){
				req.cookies.conID
				const data = {
					"connection_id": req.cookies.conID,
					"proof_request": {
						"name": "Proof of Role",
						"version": "1.0",
						"requested_attributes": {
							"0_role": {
								"name": "role",
								"restrictions": [
									{
										"schema_name": "bracu schema",
										"cred_def_id": credID
									}
								]
							}
						},
						"requested_predicates": {
						}
					}
				}; 
				// request holder for a proof request
				axios.post('http://127.0.0.1:8021/present-proof/send-request', data)
					.then((resp) => {
						res.render("loadingProof");
					}).catch((err) => {
						// console.error(err);
						console.error("Error at issuing credentials!")
					});
			}
		}).catch((err) => {
			console.error(err);
		});
});

// fetching status of presentation proof
app.get("/proofStatus", (req, res) => {
	console.log("At Cred status:");
	res.writeHead(200, {'Content-Type': 'text/plain'});
	
	if (proofStatus === null){
		res.end("In progress..");
	}
	else {
		req.session.verified = true
		req.session.retrievedAttribute = retrievedAttribute
		res.end(JSON.stringify(proofStatus))
	}
		
});

// serve food page
app.get('/food', checkUserSession, function(req,res) {
	res.render("food")
});
  
// check user session
function checkUserSession( req, res,  next){
	if (req.session.verified){
		next()
	}
	else{  
		res.redirect('/');
	}
}

//logout
app.get('/logout', async (req, res) => {
	req.session.destroy();
	global.connectionStatus = null;
	global.credDef = null;
	global.credStatus = null;
	global.proofStatus = null;
	global.retrievedAttribute = null;
	res.clearCookie("conID")
	res.clearCookie("memoName")
	res.redirect("/");
})

// render reconnect form page
app.get('/reconnect', function(req,res) {
	res.render("reconnect")
});

// storing and sending TF code and data
app.post('/twoFactor', function(req,res) {
	const { conID } = req.body
	const connectionID = conID

	ConnectionDataSchema.findOne({connectionID: connectionID}, function(err,obj) { 

		const email = obj.email;
		const memoName = obj.memoName;
		const connectionID = obj.connectionID;
		const status = false;
		const code = Math.floor(1000 + Math.random() * 9000);

		try {
			const response = TwoFactorDataSchema.create({
				email,
				memoName,
				connectionID,
				code, 
				status
			})

			var mailOptions = {
				from: process.env.emailSender,
				to: email,
				subject: 'SSI Code',
				text: "" + code
			  };
			  
			  transport.sendMail(mailOptions, function(error, info){
				if (error) {
				  console.error(error);
				} else {
				  console.log('Email sent: ' + info.response);
				}
			  });

		} catch (error) {
			if (error.code === 11000) {
				// duplicate key
				return res.json({ status: 'error', error: 'Username already in use' })
			}
			throw error
		}
		res.cookie('conID', conID, { maxAge: 900000, httpOnly: true });
		res.cookie('memoName', memoName, { maxAge: 900000, httpOnly: true });

		req.session.conID = conID
		res.render("twoFactor");
	});

});

// check the SSI code
app.post('/twoFactorCheck', function(req,res) {
	// Your code here
	const { codeData } = req.body

	if(req.cookies.conID && req.cookies.memoName){
		const connectionID = req.cookies.conID
		const memoName = req.cookies.memoName
		// remove only the attributes passed are matched
		TwoFactorDataSchema.remove({connectionID: connectionID, memoName: memoName, code: codeData}, (err) => {
			if (!err) {
				res.render("connected");
			}
			else{
				res.status(500).json(err)
			}
		});
	}
});



/*************************************************************
 *  ALL OF YOUR API SHOULD BE ABOVE BELOW THIS LINE
*************************************************************/
app.listen(9999, () => {
	console.log('Server up at 9999')
})