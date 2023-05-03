const mongoose = require('mongoose')

const ConnectionDataSchema = new mongoose.Schema(
	{
		email: { type: String, required: true},
		memoName: { type: String, required: true },
        connectionID: { type: String, required: true }

	},
	{ collection: 'connections' }
)

const ConnectionDataSchemaModel = mongoose.model('ConnectionDataSchema', ConnectionDataSchema)

module.exports = ConnectionDataSchemaModel
