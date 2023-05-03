const mongoose = require('mongoose')

const TwoFactorDataSchema = new mongoose.Schema(
	{
		email: { type: String, required: true},
		memoName: { type: String, required: true },
        connectionID: { type: String, required: true },
        code: { type: String, required: true, unique: true },
        status: { type: Boolean, required: true },
	},
	{ collection: 'emailMemoConCode' }
)

const TwoFactorDataModel = mongoose.model('TwoFactorDataSchema', TwoFactorDataSchema)

module.exports = TwoFactorDataModel
